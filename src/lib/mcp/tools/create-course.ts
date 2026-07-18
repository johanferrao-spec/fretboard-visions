import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_course",
  title: "Create course",
  description: "Create a new empty course for the signed-in user. Returns the new course id.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Course title."),
    description: z.string().max(2000).optional().describe("Optional description."),
    key_root: z.string().max(4).optional().describe("Optional key root, e.g. 'G'."),
    key_quality: z.string().max(32).optional().describe("Optional key quality, e.g. 'ionian'."),
    tempo: z.number().int().min(20).max(400).optional().describe("Optional tempo BPM."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const row: Record<string, unknown> = { user_id: ctx.getUserId(), title: input.title };
    if (input.description !== undefined) row.description = input.description;
    if (input.key_root !== undefined) row.key_root = input.key_root;
    if (input.key_quality !== undefined) row.key_quality = input.key_quality;
    if (input.tempo !== undefined) row.tempo = input.tempo;
    const { data, error } = await supabaseForUser(ctx)
      .from("courses")
      .insert(row)
      .select("id, title")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created course "${data.title}" (${data.id})` }],
      structuredContent: { course: data },
    };
  },
});
