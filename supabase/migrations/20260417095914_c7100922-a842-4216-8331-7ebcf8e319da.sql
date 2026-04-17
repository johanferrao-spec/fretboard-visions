-- Add description to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- Create course_tabs table (lessons within a course)
CREATE TABLE IF NOT EXISTS public.course_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled lesson',
  position integer NOT NULL DEFAULT 0,
  key_root text NOT NULL DEFAULT 'A',
  key_quality text NOT NULL DEFAULT 'Minor',
  time_signature text NOT NULL DEFAULT '4/4',
  tempo integer NOT NULL DEFAULT 100,
  phrase jsonb NOT NULL DEFAULT '{"notes":[],"lengthGrid":32}'::jsonb,
  chord_track jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_track jsonb NOT NULL DEFAULT '[]'::jsonb,
  tempo_track jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_tabs_course ON public.course_tabs(course_id, position);

ALTER TABLE public.course_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Course tabs viewable by authenticated users"
  ON public.course_tabs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert tabs in own courses"
  ON public.course_tabs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own course tabs"
  ON public.course_tabs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own course tabs"
  ON public.course_tabs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_course_tabs_updated_at
  BEFORE UPDATE ON public.course_tabs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();