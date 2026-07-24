CREATE TABLE public.user_snapshots (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  charts_data JSONB,
  backing_tracks_data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_snapshots TO authenticated;
GRANT ALL ON public.user_snapshots TO service_role;
ALTER TABLE public.user_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own snapshot" ON public.user_snapshots
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_snapshots_updated_at BEFORE UPDATE ON public.user_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();