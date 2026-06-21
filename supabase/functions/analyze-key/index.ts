const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChordIn {
  root: string;
  chordType: string;
  startBeat: number;
  duration: number;
  bassNote?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { chords, measures, bpm } = await req.json() as {
      chords: ChordIn[]; measures: number; bpm?: number;
    };
    if (!Array.isArray(chords) || chords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No chords supplied' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sorted = [...chords].sort((a, b) => a.startBeat - b.startBeat);
    const progression = sorted.map(c => {
      const slash = c.bassNote ? `/${c.bassNote}` : '';
      const beats = Number(c.duration.toFixed(2));
      return `${c.root} ${c.chordType}${slash} (${beats}b)`;
    }).join(' → ');

    const prompt = `You are an expert music theorist analyzing a chord progression.

Progression (${measures} bars${bpm ? `, ${bpm} BPM` : ''}):
${progression}

Determine:
1) The most likely overall key/tonal centre (e.g. "G major", "E minor", "D Dorian").
2) Whether the progression is diatonic, modal, or contains borrowed/non-diatonic chords.
3) Practical advice on WHAT TO THINK / WHAT SCALES OR MODES TO PLAY over the changes — including any chord-specific scale choices when the progression leaves the key.

Return STRICT JSON only, matching this exact shape:
{
  "key": "string e.g. G major",
  "tonalCentre": "G",
  "mode": "major | minor | dorian | phrygian | lydian | mixolydian | locrian | mixed",
  "analysis": "1-2 sentence summary of the harmony",
  "whatToPlay": "2-4 sentences of actionable advice on what to think/play over the progression",
  "chordNotes": [
    { "chord": "C7", "advice": "what scale/mode to think over this chord" }
  ]
}
Only include chordNotes entries for chords that need special treatment (non-diatonic, secondary dominants, modal shifts). Do not wrap in markdown.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a precise music theory assistant. Respond ONLY with valid JSON, no markdown.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return new Response(
        JSON.stringify({ error: `AI gateway error ${aiRes.status}`, detail: text }),
        { status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await aiRes.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    let parsed: unknown = null;
    try { parsed = JSON.parse(raw); } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch {/* ignore */} }
    }

    return new Response(
      JSON.stringify({ result: parsed, raw }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
