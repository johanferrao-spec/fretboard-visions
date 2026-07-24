-- RLS policies for song-audio bucket: each user can only touch files under a
-- folder named with their own auth uid (e.g. "<uid>/track.mp3").
CREATE POLICY "song-audio: users read own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'song-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "song-audio: users upload own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'song-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "song-audio: users update own files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'song-audio' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'song-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "song-audio: users delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'song-audio' AND auth.uid()::text = (storage.foldername(name))[1]);