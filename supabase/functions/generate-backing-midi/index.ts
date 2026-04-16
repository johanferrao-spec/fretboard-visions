// Edge function: AI-powered MIDI track regeneration via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trackType, chords, measures, bpm, genre, intensity, complexity } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert composer creating MIDI patterns for a backing track. Generate musical, human-feeling MIDI for the requested instrument that follows the given chord progression. Keep timing tight but with subtle humanization. Use idiomatic patterns for the genre.`;

    const drumGuidance = `Drums use these MIDI pitches: kick=36, snare=38, hihat=42, ride=51. Stay within these for drum tracks.`;
    const bassGuidance = `Bass should stay in MIDI range 28-55 (E1 to G3). Follow chord roots primarily.`;
    const pianoGuidance = `Piano should comp chord voicings in MIDI range 48-84 (C3 to C6). Use rootless/upper-structure voicings for jazz, full triads for rock/pop.`;

    const guide = trackType === 'drums' ? drumGuidance : trackType === 'bass' ? bassGuidance : pianoGuidance;

    const userPrompt = `Generate a ${trackType} part for ${measures} measures (${measures * 4} beats, beat 0 to ${measures * 4}) at ${bpm} BPM in ${genre} style.

Chord progression: ${chords.map((c: any) => `${c.root}${c.chordType} at beat ${c.startBeat} for ${c.duration} beats`).join(', ')}

Intensity: ${Math.round(intensity * 100)}% (higher = more notes, louder, more fills)
Complexity: ${Math.round(complexity * 100)}% (higher = more syncopation, extensions, variation)

${guide}

Return notes with startBeat in [0, ${measures * 4}), velocity 1-127, duration in beats.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_midi_notes",
            description: "Emit the generated MIDI notes",
            parameters: {
              type: "object",
              properties: {
                notes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      startBeat: { type: "number" },
                      duration: { type: "number" },
                      pitch: { type: "integer", minimum: 0, maximum: 127 },
                      velocity: { type: "integer", minimum: 1, maximum: 127 },
                    },
                    required: ["startBeat", "duration", "pitch", "velocity"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["notes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_midi_notes" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded — please try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted — please add credits to your workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No notes generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ notes: args.notes || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-backing-midi error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
