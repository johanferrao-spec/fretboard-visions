const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Step 1: Converting tab image to text with Gemini vision...');

    // Step 1: Use Gemini vision to convert image to text tablature
    const step1Response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an expert at reading guitar tablature images. Convert this guitar tab image into plain text tablature format.

Rules:
- Output 6 lines, one per string, labeled: e|, B|, G|, D|, A|, E|
- Use --- for empty positions between numbers
- Numbers represent fret positions exactly as shown
- Align numbers vertically when they appear at the same horizontal position (played simultaneously)
- Use - (dashes) between notes to show timing/spacing
- Be extremely precise about which fret numbers appear on which strings
- If you see any special notation like h (hammer-on), p (pull-off), / or \\ (slides), just include the fret numbers

Output ONLY the text tablature, nothing else. Example format:
e|---0---3---
B|---1---0---
G|---0---0---
D|---2---0---
A|---3---2---
E|-------3---`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/png'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!step1Response.ok) {
      if (step1Response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limited. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (step1Response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Add funds at Settings > Workspace > Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await step1Response.text();
      console.error('Step 1 AI gateway error:', step1Response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const step1Data = await step1Response.json();
    const textTab = step1Data.choices?.[0]?.message?.content || '';
    console.log('Step 1 - Text tab output:', textTab);

    if (!textTab.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not read tablature from image.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Parse the text tablature into structured JSON
    console.log('Step 2: Parsing text tab into structured data...');

    const step2Response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: `Parse this guitar tablature text into a JSON array. Each element represents one beat/position (left to right). Each element is an array of objects with:
- "string": number 0-5 where 0 = high e string (thinnest), 1 = B, 2 = G, 3 = D, 4 = A, 5 = low E (thickest)
- "fret": the fret number on that string

Notes at the same horizontal position should be grouped together (played simultaneously).
Skip any positions that have no numbers (all dashes).

Here is the tablature:

${textTab}

Output ONLY the JSON array, no explanation. Example: [[{"string":0,"fret":0},{"string":2,"fret":0}],[{"string":1,"fret":3}]]`
          }
        ],
      }),
    });

    if (!step2Response.ok) {
      const errText = await step2Response.text();
      console.error('Step 2 AI error:', step2Response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse tablature text.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const step2Data = await step2Response.json();
    const content = step2Data.choices?.[0]?.message?.content || '';
    console.log('Step 2 - JSON output:', content.substring(0, 500));

    // Extract JSON from the response
    let jsonStr = content.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const filtered = Array.isArray(parsed) ? parsed.filter((p: any[]) => Array.isArray(p) && p.length > 0) : parsed;
      return new Response(
        JSON.stringify({ success: true, positions: filtered, textTab }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseErr) {
      console.error('Failed to parse Step 2 JSON:', jsonStr);
      return new Response(
        JSON.stringify({ success: false, error: 'Could not parse tablature. Try a clearer image.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
