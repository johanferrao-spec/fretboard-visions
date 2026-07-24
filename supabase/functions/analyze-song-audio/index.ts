// Edge function: server-side song audio analysis via Google Gemini's native
// audio-understanding API. Downloads the uploaded track from the private
// `song-audio` Storage bucket using the service-role client, base64-encodes it,
// and asks Gemini for structured JSON (tempo / key / chords / structure).

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ACCEPTED_MIME = new Set([
  'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mp3', 'audio/mpeg',
  'audio/aiff', 'audio/x-aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac', 'audio/x-flac',
]);

function normalizeMime(m: string): string {
  const l = m.toLowerCase();
  if (l === 'audio/x-wav' || l === 'audio/wave') return 'audio/wav';
  if (l === 'audio/mpeg') return 'audio/mp3';
  if (l === 'audio/x-aiff') return 'audio/aiff';
  if (l === 'audio/x-flac') return 'audio/flac';
  return l;
}

function buildPrompt(detectedBpm?: number): string {
  return `You are an expert audio analyst listening to a piece of recorded music.
${detectedBpm ? `A separate beat-detection pass measured tempo at approximately ${detectedBpm} BPM — treat this as a strong prior, but correct it if you clearly hear a different tempo (e.g. a half-time or double-time mismatch).` : ''}

Analyze the audio and determine:
1. tempo: your best BPM estimate (number).
2. key / keyRoot / keyQuality: the overall tonal centre.
3. barText: the chord progression across the song as bar-separated text, "|" between bars, chord symbols separated by spaces within a bar (e.g. "Cmaj7 | A7 | Dm7 G7 | Cmaj7"). If a section repeats verbatim you may represent it once.
4. structure: the song's sections in order, each with an approximate mm:ss start time and a label (Intro / Verse / Pre-Chorus / Chorus / Bridge / Solo / Outro, or whatever actually fits).

This is a best-effort transcription for a musician's personal practice reference — approximate is fine where the audio is genuinely ambiguous, but don't guess wildly; if you're unsure of a chord, pick the closest plausible chord tone rather than an unrelated one.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { audioPath, mimeType, detectedBpm, durationSeconds } = await req.json() as {
      audioPath?: string; mimeType?: string; detectedBpm?: number; durationSeconds?: number;
    };

    if (!audioPath || !mimeType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing audioPath or mimeType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (typeof durationSeconds === 'number' && durationSeconds > 240) {
      return new Response(JSON.stringify({ success: false, error: 'Audio is longer than 4 minutes. Please trim before analyzing.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const normMime = normalizeMime(mimeType);
    if (!ACCEPTED_MIME.has(mimeType.toLowerCase())) {
      return new Response(JSON.stringify({ success: false, error: `Unsupported audio type "${mimeType}". Convert to WAV, MP3, AAC, OGG, FLAC, or AIFF.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Download from private bucket using service role.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const dl = await admin.storage.from('song-audio').download(audioPath);
    if (dl.error || !dl.data) {
      console.error('song-audio download failed:', dl.error);
      return new Response(JSON.stringify({ success: false, error: 'Could not read uploaded audio.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const audioBlob = dl.data;
    const numBytes = audioBlob.size;

    // Upload to Gemini Files API (avoids holding a huge base64 string in memory).
    const startRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(numBytes),
          'X-Goog-Upload-Header-Content-Type': normMime,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: audioPath.split('/').pop() ?? 'audio' } }),
      },
    );
    if (!startRes.ok) {
      const t = await startRes.text();
      console.error('Gemini upload start failed:', startRes.status, t);
      return new Response(JSON.stringify({ success: false, error: 'Failed to start audio upload.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const uploadUrl = startRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      return new Response(JSON.stringify({ success: false, error: 'No upload URL from Gemini.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const finalizeRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(numBytes),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: audioBlob.stream(),
    });
    if (!finalizeRes.ok) {
      const t = await finalizeRes.text();
      console.error('Gemini upload finalize failed:', finalizeRes.status, t);
      return new Response(JSON.stringify({ success: false, error: 'Failed to upload audio to Gemini.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const fileInfo = await finalizeRes.json();
    const fileUri: string | undefined = fileInfo?.file?.uri;
    const fileName: string | undefined = fileInfo?.file?.name;
    let fileState: string = fileInfo?.file?.state ?? 'ACTIVE';
    if (!fileUri) {
      return new Response(JSON.stringify({ success: false, error: 'Gemini file upload returned no URI.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Poll for ACTIVE state (audio may need processing).
    for (let i = 0; i < 20 && fileState === 'PROCESSING'; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const s = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`);
      if (s.ok) {
        const j = await s.json();
        fileState = j?.state ?? fileState;
      }
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: buildPrompt(detectedBpm) },
                { file_data: { mime_type: normMime, file_uri: fileUri } },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: {
              type: 'OBJECT',
              properties: {
                tempo: { type: 'NUMBER' },
                key: { type: 'STRING' },
                keyRoot: { type: 'STRING' },
                keyQuality: { type: 'STRING', enum: ['Major', 'Minor'] },
                barText: { type: 'STRING' },
                structure: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      label: { type: 'STRING' },
                      startTime: { type: 'STRING' },
                    },
                    required: ['label', 'startTime'],
                  },
                },
              },
              required: ['tempo', 'key', 'keyRoot', 'keyQuality', 'barText', 'structure'],
            },
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error(`Gemini audio API error [${geminiRes.status}]:`, errBody);
      return new Response(
        JSON.stringify({ success: false, error: 'Audio analysis failed.', status: geminiRes.status }),
        { status: geminiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await geminiRes.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('Gemini returned no candidates:', JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ success: false, error: 'Could not analyze this audio.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse Gemini JSON:', text.slice(0, 500));
      return new Response(JSON.stringify({ success: false, error: 'Could not analyze this audio.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, ...parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('analyze-song-audio unexpected error:', err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
