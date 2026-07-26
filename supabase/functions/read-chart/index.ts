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

    const prompt = `You are reading a chord chart / lead sheet image. Extract the song metadata AND the chord progression in reading order (left-to-right, top-to-bottom).

Metadata ("meta" object, omit any field you cannot see):
- "title": the song title printed at the top
- "composer": the composer / writer credit (usually top-right)
- "timeSig": the time signature, e.g. "4/4", "3/4", "6/8"
- "style": the feel / style marking, e.g. "Medium Swing", "Bossa Nova", "Ballad", "Latin", "Straight"
- "tempo": printed tempo in BPM (number) if shown

For each chord return:
- "root": one of ${VALID_ROOTS.join(', ')} (use SHARP form only; convert Db->C#, Eb->D#, Gb->F#, Ab->G#, Bb->A#)
- "chordType": exactly one of: ${VALID_CHORD_TYPES.join(' | ')}
- "bass": OPTIONAL. For slash chords (e.g. "C/E", "G7/B", "F-7/Bb") give the bass note after the slash, in the same SHARP form. Omit for normal chords. Never treat "6/9" as a slash chord — that is the chord type 6add9.
- "bars": duration in bars (number, use fractions like 0.5 if the chord occupies half a bar; default 1 if unclear)
- "section": OPTIONAL short label for the song section this chord belongs to (e.g. "A", "B", "C", "Intro", "Verse", "Chorus", "Bridge", "Outro"). Lead sheets often mark rehearsal letters like [A], (A), or "A Section" / "B Section" at the start of a system — assign every subsequent chord to that section until the next marker appears. Omit the field entirely if the chart has no visible section markers.
- "ending": OPTIONAL number 1, 2 or 3. Charts often show volta brackets marked "1.", "2." (and sometimes "3.") — a horizontal bracket above one or more bars. Chords under the "1." bracket get "ending": 1, under "2." get 2, under "3." get 3. IMPORTANT: the later-numbered bars are ALTERNATIVES to the "1." bars — they are played on subsequent passes through the SAME section, so give them the SAME "section" label as the "1." bars, and list them in order (all 1. bars, then all 2. bars, then all 3. bars) immediately after each other. When a section (e.g. the A section) repeats later in the chart with only its last bars different, reuse the SAME section label and mark those differing final bars as the next ending number instead of inventing a new section. Omit "ending" entirely for normal bars.

Return STRICT JSON only:
{ "meta": { "title": "...", "composer": "...", "timeSig": "4/4", "style": "Medium Swing", "tempo": 140 },
  "chords": [ { "root": "...", "chordType": "...", "bass": "E", "bars": 1, "section": "A", "ending": 1 }, ... ] }

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
    let parsed: {
      chords?: Array<{ root?: string; chordType?: string; bass?: string; bars?: number; section?: string; ending?: number }>;
      meta?: { title?: string; composer?: string; timeSig?: string; style?: string; tempo?: number };
    } | null = null;
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
      bass: typeof c.bass === 'string' && VALID_ROOTS.includes(c.bass) ? c.bass : undefined,
      bars: typeof c.bars === 'number' && c.bars > 0 ? c.bars : 1,
      section: typeof (c as any).section === 'string' && (c as any).section.trim() ? (c as any).section.trim() : undefined,
      ending: c.ending === 1 || c.ending === 2 || c.ending === 3 ? c.ending : undefined,
    }));

    // ---- Normalisation so ANY chart the model reads lands in a shape the
    // chart editor can lay out: canonical section labels, sections inherited by
    // volta bars, and ending runs grouped contiguously + renumbered 1..3.
    const canonSection = (raw?: string) => {
      if (!raw) return undefined;
      let t = raw.trim().replace(/^[\[\(\{]|[\]\)\}]$/g, '').trim();
      t = t.replace(/\s*section\s*$/i, '').trim();
      // "A2", "A'", "A′", "A (repeat)" all fold back onto "A".
      const m = t.match(/^([A-Za-z])\s*['′’]*\s*\d*$/);
      if (m) return m[1].toUpperCase();
      return t.replace(/\s+/g, ' ').slice(0, 24);
    };

    type C = typeof chords[number];
    let norm: C[] = chords.map(c => ({ ...c, section: canonSection(c.section) }));
    // Volta bars with no label inherit the section of the preceding chord.
    for (let i = 1; i < norm.length; i++) {
      if (!norm[i].section) norm[i] = { ...norm[i], section: norm[i - 1].section };
    }
    // Per contiguous section run: move ending bars after the plain bars and
    // renumber the ending groups. Numbering continues across later repeats of
    // the SAME section label, so a repeated A section whose tail differs gets
    // the next ending number (1. then 2. then 3.).
    const out: C[] = [];
    const endingCount = new Map<string, number>();
    for (let i = 0; i < norm.length; ) {
      const label = norm[i].section;
      let j = i;
      while (j + 1 < norm.length && norm[j + 1].section === label) j++;
      const run = norm.slice(i, j + 1);
      const plain = run.filter(c => !c.ending);
      const withEnd = run.filter(c => c.ending);
      const order = [...new Set(withEnd.map(c => c.ending!))].sort((a, b) => a - b);
      out.push(...plain);
      const key = label ?? '';
      order.forEach(e => {
        const n = Math.min(3, (endingCount.get(key) ?? 0) + 1);
        endingCount.set(key, n);
        withEnd.filter(c => c.ending === e).forEach(c => out.push({ ...c, ending: n }));
      });
      i = j + 1;
    }
    norm = out;

    const str = (v: unknown, max = 80) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
    const rawMeta = parsed?.meta ?? {};
    const meta = {
      title: str(rawMeta.title),
      composer: str(rawMeta.composer),
      timeSig: /^\d{1,2}\/\d{1,2}$/.test(String(rawMeta.timeSig ?? '')) ? String(rawMeta.timeSig) : undefined,
      style: str(rawMeta.style, 40),
      tempo: typeof rawMeta.tempo === 'number' && rawMeta.tempo > 20 && rawMeta.tempo < 400
        ? Math.round(rawMeta.tempo) : undefined,
    };

    return new Response(JSON.stringify({ chords: norm, meta, raw }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
