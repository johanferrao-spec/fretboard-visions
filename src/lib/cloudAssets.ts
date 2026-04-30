/**
 * Cloud Storage uploads for user-dropped instrument assets.
 *
 * The browser cannot write to the project's `/public` folder at runtime, so
 * dropped images and audio samples are uploaded to the public Supabase
 * Storage bucket `instrument-assets`. IndexedDB still holds a local copy for
 * instant UI; this module just makes the asset durable across devices.
 */
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'instrument-assets';

function extFromMime(mime: string, fallback = 'bin'): string {
  if (!mime) return fallback;
  const m = mime.toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('svg')) return 'svg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('aac') || m.includes('m4a') || m.includes('mp4')) return 'm4a';
  if (m.includes('flac')) return 'flac';
  return fallback;
}

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/** Upload a Blob to a deterministic path; overwrites any existing file. */
async function upload(path: string, blob: Blob, contentType: string): Promise<string | null> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType });
    if (error) {
      console.warn('[cloudAssets] upload failed', path, error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn('[cloudAssets] upload threw', path, err);
    return null;
  }
}

/** Fire-and-forget — caller does not need to await. */
export function uploadBassIcon(kit: string, blob: Blob, mime: string): void {
  const ext = extFromMime(mime, 'png');
  void upload(`bass/${safe(kit)}.${ext}`, blob, mime || 'image/png');
}

export function uploadBassSample(kit: string, blob: Blob, mime: string): void {
  const ext = extFromMime(mime, 'wav');
  void upload(`bass/${safe(kit)}.${ext}`, blob, mime || 'audio/wav');
}

/** Generic per-instrument icon, e.g. slot=`drums:kick` variant=`Rock`. */
export function uploadInstrumentIcon(slot: string, variant: string, blob: Blob, mime: string): void {
  const ext = extFromMime(mime, 'png');
  const path = `instruments/${safe(slot)}__${safe(variant)}.${ext}`;
  void upload(path, blob, mime || 'image/png');
}

/** Generic per-instrument sample (e.g. drum part audio). */
export function uploadInstrumentSample(slot: string, variant: string, blob: Blob, mime: string): void {
  const ext = extFromMime(mime, 'wav');
  const path = `instruments/${safe(slot)}__${safe(variant)}.${ext}`;
  void upload(path, blob, mime || 'audio/wav');
}
