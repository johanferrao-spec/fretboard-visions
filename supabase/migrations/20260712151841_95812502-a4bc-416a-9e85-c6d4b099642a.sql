
-- user_samples: per-user metadata mirror of StoredSample (blob lives in Storage)
CREATE TABLE public.user_samples (
  id text NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slot text NOT NULL,
  color text NOT NULL,
  kit text,
  mime text NOT NULL,
  pitch integer,
  slot_index integer,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_samples_user_id_idx ON public.user_samples(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_samples TO authenticated;
GRANT ALL ON public.user_samples TO service_role;

ALTER TABLE public.user_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own samples" ON public.user_samples
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own samples" ON public.user_samples
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own samples" ON public.user_samples
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own samples" ON public.user_samples
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_samples_updated_at
  BEFORE UPDATE ON public.user_samples
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage RLS: scope objects in the user-samples bucket to each user's folder
-- (path prefix = auth.uid()/...)
CREATE POLICY "Users read own sample files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own sample files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own sample files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-samples' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'user-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own sample files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-samples' AND auth.uid()::text = (storage.foldername(name))[1]);
