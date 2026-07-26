CREATE TABLE public.shared_charts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  kind TEXT NOT NULL CHECK (kind IN ('chart','track')),
  title TEXT NOT NULL,
  composer TEXT,
  tempo INTEGER,
  time_sig TEXT,
  feel TEXT,
  genre TEXT,
  description TEXT,
  data JSONB NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shared_charts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_charts TO authenticated;
GRANT ALL ON public.shared_charts TO service_role;

ALTER TABLE public.shared_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shared charts are viewable by everyone"
  ON public.shared_charts FOR SELECT
  USING (true);

CREATE POLICY "Users can publish their own shared charts"
  ON public.shared_charts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shared charts"
  ON public.shared_charts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared charts"
  ON public.shared_charts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_shared_charts_updated_at
  BEFORE UPDATE ON public.shared_charts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX shared_charts_created_at_idx ON public.shared_charts (created_at DESC);

CREATE OR REPLACE FUNCTION public.increment_shared_chart_downloads(_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shared_charts SET downloads = downloads + 1 WHERE id = _id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_shared_chart_downloads(UUID) TO anon, authenticated;