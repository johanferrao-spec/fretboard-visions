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
  name: "get_course",
  title: "Get course with lessons",
  description: "Fetch a single course by id along with the ordered list of its lessons (course tabs).",
  inputSchema: {
    course_id: z.string().uuid().describe("The course id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ course_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data: course, error: e1 } = await sb
      .from("courses")
      .select("id, title, description, key_root, key_quality, tempo, time_signature, updated_at")
      .eq("id", course_id)
      .maybeSingle();
    if (e1) return { content: [{ type: "text", text: e1.message }], isError: true };
    if (!course) return { content: [{ type: "text", text: "Course not found" }], isError: true };
    const { data: lessons, error: e2 } = await sb
      .from("course_tabs")
      .select("id, title, position, key_root, key_quality, tempo, time_signature, updated_at")
      .eq("course_id", course_id)
      .order("position", { ascending: true });
    if (e2) return { content: [{ type: "text", text: e2.message }], isError: true };
    const payload = { course, lessons: lessons ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
