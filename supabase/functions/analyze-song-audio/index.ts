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
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    // base64-encode without blowing the stack on large files
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)) as unknown as number[]);
    }
    const base64Audio = btoa(bin);

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
                { inline_data: { mime_type: normMime, data: base64Audio } },
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
