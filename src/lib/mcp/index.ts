import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCoursesTool from "./tools/list-courses";
import getCourseTool from "./tools/get-course";
import createCourseTool from "./tools/create-course";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fretboard-visions-mcp",
  title: "Fretboard Visions",
  version: "0.1.0",
  instructions:
    "Tools for the Fretboard Visions guitar app. Use `list_courses` to browse the signed-in user's courses, `get_course` to inspect a course and its lessons, and `create_course` to add a new one.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCoursesTool, getCourseTool, createCourseTool],
});
