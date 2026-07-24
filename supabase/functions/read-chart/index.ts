const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_ROOTS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const VALID_CHORD_TYPES = [
  'Major','Minor','Diminished','Augmented','Sus2','Sus4',
  'Major 7','Major 7♭5','Major 7#5','Minor 7','Dominant 7','Dim 7','Half-Dim 7',
  'Min/Maj 7','Aug 7','Add9','Major 9','Minor 9','Dominant 9','Major 6','Minor 6',
  '7sus4','7sus4♭9','7#9','7♭9','7#5','7♭5','11','Minor 11','13','Minor 13',
  'Power (5)','Maj11','Maj13','Maj9#11','Maj13#11','6add9','Madd9','m6add9','mMaj9',
  'm7#5','9♭5','9#5','13#11','13♭9','11♭9','7(♭5,♭9)','7(♭5,#9)','7(#5,♭9)','7(#5,#9)',
  'Sus2Sus4','Add11','Add13','Madd11','Madd13',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json() as { image: string };
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing image (data URL)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `You are reading a chord chart / lead sheet image. Extract the chord progression in reading order (left-to-right, top-to-bottom).

For each chord return:
- "root": one of ${VALID_ROOTS.join(', ')} (use SHARP form only; convert Db->C#, Eb->D#, Gb->F#, Ab->G#, Bb->A#)
- "chordType": exactly one of: ${VALID_CHORD_TYPES.join(' | ')}
- "bars": duration in bars (number, use fractions like 0.5 if the chord occupies half a bar; default 1 if unclear)

Return STRICT JSON only:
{ "chords": [ { "root": "...", "chordType": "...", "bars": 1 }, ... ] }

No markdown, no commentary. If no chords are visible, return {"chords":[]}.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You extract chord progressions from images. Respond ONLY with valid JSON.' },
          { role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } },
          ]},
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI gateway error ${aiRes.status}`, detail: text }),
        { status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await aiRes.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    let parsed: { chords?: Array<{ root?: string; chordType?: string; bars?: number }> } | null = null;
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }

    const chords = (parsed?.chords ?? []).filter(c =>
      c.root && c.chordType &&
      VALID_ROOTS.includes(c.root) &&
      VALID_CHORD_TYPES.includes(c.chordType)
    ).map(c => ({
      root: c.root!,
      chordType: c.chordType!,
      bars: typeof c.bars === 'number' && c.bars > 0 ? c.bars : 1,
    }));

    return new Response(JSON.stringify({ chords, raw }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
