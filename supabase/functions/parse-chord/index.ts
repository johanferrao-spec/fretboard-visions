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
    const { input } = await req.json() as { input: string };
    if (!input || typeof input !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `Parse this chord description into a root note and chord type: "${input}"

Return STRICT JSON only:
{ "root": "one of ${VALID_ROOTS.join(', ')} (use sharp form, never flats)", "chordType": "one of exactly: ${VALID_CHORD_TYPES.join(' | ')}" }

Examples:
- "am7" -> {"root":"A","chordType":"Minor 7"}
- "A minor seventh" -> {"root":"A","chordType":"Minor 7"}
- "Bb maj7" -> {"root":"A#","chordType":"Major 7"}
- "F# dominant 9" -> {"root":"F#","chordType":"Dominant 9"}
- "C" -> {"root":"C","chordType":"Major"}
- "Ebmin" -> {"root":"D#","chordType":"Minor"}

Convert any flat root to its sharp equivalent (Db->C#, Eb->D#, Gb->F#, Ab->G#, Bb->A#). No markdown, no commentary.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: 'You are a music theory chord parser. Respond ONLY with valid JSON.' },
          { role: 'user', content: prompt },
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
    let parsed: { root?: string; chordType?: string } | null = null;
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }

    if (!parsed?.root || !parsed?.chordType ||
        !VALID_ROOTS.includes(parsed.root) ||
        !VALID_CHORD_TYPES.includes(parsed.chordType)) {
      return new Response(JSON.stringify({ error: 'Could not parse chord', raw }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ root: parsed.root, chordType: parsed.chordType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
