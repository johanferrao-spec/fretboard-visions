-- Lock the instrument-assets bucket: allow public read + authenticated insert,
-- but DENY UPDATE and DELETE on its objects so dropped files can never be removed.

-- Read (public)
DROP POLICY IF EXISTS "instrument-assets public read" ON storage.objects;
CREATE POLICY "instrument-assets public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'instrument-assets');

-- Insert (anyone — matches current drag-drop flow which uses anon key)
DROP POLICY IF EXISTS "instrument-assets public insert" ON storage.objects;
CREATE POLICY "instrument-assets public insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'instrument-assets');

-- Explicitly NO update / delete policies for this bucket.
-- (Absence of a permissive policy under RLS = denied.)
-- Defensive: drop any pre-existing update/delete policies that may have allowed it.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polcmd IN ('w','d')  -- UPDATE, DELETE
      AND pg_get_expr(polqual, polrelid) LIKE '%instrument-assets%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.polname);
  END LOOP;
END $$;