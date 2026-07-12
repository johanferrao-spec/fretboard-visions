/**
 * Cloud sync for user-uploaded audio samples.
 *
 * IndexedDB (sampleStorage.ts) is the fast local cache; Supabase Storage +
 * the `user_samples` table are the durable source of truth. On sign-in (or
 * anonymous sign-in), we hydrate IndexedDB from the cloud so samples
 * reappear on fresh browsers/origins. On every put/delete we fire a
 * best-effort cloud sync — failures never block local playback.
 */
import { supabase } from '@/integrations/supabase/client';
import { putSample, type StoredSample } from './sampleStorage';

const BUCKET = 'user-samples';

let cachedUserId: string | null = null;
let userIdPromise: Promise<string | null> | null = null;

/** Return the current user's id. If no session exists, sign in anonymously
 *  so cloud sync works with zero friction. Returns null if auth is
 *  unreachable (e.g. offline). Cached after first success. */
export async function ensureUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;
  if (userIdPromise) return userIdPromise;
  userIdPromise = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        cachedUserId = data.session.user.id;
        return cachedUserId;
      }
      const { data: anon, error } = await supabase.auth.signInAnonymously();
      if (error || !anon.user) {
        console.warn('[cloudSamples] anonymous sign-in failed', error?.message);
        return null;
      }
      cachedUserId = anon.user.id;
      return cachedUserId;
    } catch (err) {
      console.warn('[cloudSamples] ensureUserId threw', err);
      return null;
    } finally {
      userIdPromise = null;
    }
  })();
  return userIdPromise;
}

// React to sign-in/out so we don't upload to the wrong folder.
supabase.auth.onAuthStateChange((_evt, session) => {
  cachedUserId = session?.user?.id ?? null;
});

function storagePath(userId: string, sampleId: string): string {
  return `${userId}/${sampleId}`;
}

/** Best-effort upload of a sample to Supabase Storage + metadata upsert.
 *  Never throws — logs and returns false on failure. */
export async function uploadSampleToCloud(sample: StoredSample): Promise<boolean> {
  const userId = await ensureUserId();
  if (!userId) return false;
  const path = storagePath(userId, sample.id);
  try {
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, sample.blob, { upsert: true, contentType: sample.mime });
    if (upErr) {
      console.warn('[cloudSamples] upload failed', sample.id, upErr.message);
      return false;
    }
    const { error: rowErr } = await supabase.from('user_samples').upsert({
      id: sample.id,
      user_id: userId,
      name: sample.name,
      slot: sample.slot,
      color: sample.color,
      kit: sample.kit ?? null,
      mime: sample.mime,
      pitch: sample.pitch ?? null,
      slot_index: sample.slotIndex ?? null,
      storage_path: path,
    });
    if (rowErr) {
      console.warn('[cloudSamples] metadata upsert failed', sample.id, rowErr.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[cloudSamples] uploadSampleToCloud threw', err);
    return false;
  }
}

/** Best-effort delete from Storage + metadata. */
export async function deleteSampleFromCloud(id: string): Promise<void> {
  const userId = await ensureUserId();
  if (!userId) return;
  try {
    await supabase.storage.from(BUCKET).remove([storagePath(userId, id)]);
    await supabase.from('user_samples').delete().eq('id', id);
  } catch (err) {
    console.warn('[cloudSamples] delete failed', id, err);
  }
}

/** Download any cloud samples the local IndexedDB doesn't yet have and
 *  putSample() them so they become visible in the UI on next load. */
export async function hydrateSamplesFromCloud(existingIds: Set<string>): Promise<StoredSample[]> {
  const userId = await ensureUserId();
  if (!userId) return [];
  const restored: StoredSample[] = [];
  try {
    const { data: rows, error } = await supabase
      .from('user_samples')
      .select('*')
      .eq('user_id', userId);
    if (error || !rows) {
      if (error) console.warn('[cloudSamples] list failed', error.message);
      return [];
    }
    for (const r of rows) {
      if (existingIds.has(r.id)) continue;
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(BUCKET)
          .download(r.storage_path);
        if (dlErr || !blob) {
          console.warn('[cloudSamples] download failed', r.id, dlErr?.message);
          continue;
        }
        const sample: StoredSample = {
          id: r.id,
          name: r.name,
          slot: r.slot,
          color: r.color,
          kit: (r.kit ?? undefined) as StoredSample['kit'],
          mime: r.mime,
          blob,
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          pitch: r.pitch ?? undefined,
          slotIndex: r.slot_index ?? undefined,
        };
        // Write to IndexedDB WITHOUT re-triggering cloud sync.
        await putSample(sample, { skipCloudSync: true });
        restored.push(sample);
      } catch (err) {
        console.warn('[cloudSamples] hydrate row failed', r.id, err);
      }
    }
  } catch (err) {
    console.warn('[cloudSamples] hydrateSamplesFromCloud threw', err);
  }
  return restored;
}
