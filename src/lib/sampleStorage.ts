/**
 * Tiny IndexedDB wrapper for storing user-uploaded audio samples as Blobs.
 * Survives reloads. When auth is added later, samples can be uploaded to
 * Cloud Storage on sign-in.
 */

const DB_NAME = 'mf-sample-library';
const DB_VERSION = 3;
const STORE = 'samples';
const BASS_ICON_STORE = 'bass_icons';
const INSTRUMENT_ICON_STORE = 'instrument_icons';

export interface StoredSample {
  /** Unique id, also used as IndexedDB primary key */
  id: string;
  /** User-friendly file name */
  name: string;
  /** Which instrument this belongs to: e.g. 'drums:snare', 'bass', 'keys' */
  slot: string;
  /** Display color (HSL string) for the part/sample chip */
  color: string;
  /** Optional kit tag (Funk | Jazz | Rock | Latin) for drum-slot samples.
   *  Used so that "Apply kit" prefers user samples tagged for that kit. */
  kit?: 'Funk' | 'Jazz' | 'Rock' | 'Latin' | 'Pop';
  /** Audio MIME type */
  mime: string;
  /** Stored blob */
  blob: Blob;
  createdAt: number;
  /** Detected fundamental pitch as MIDI note (bass/keys multi-sampling). */
  pitch?: number;
  /** Slot index inside a multi-sample group (e.g. bass slots 0..3). */
  slotIndex?: number;
  /** Optional artwork (PNG/JPG) shown next to the sample in the UI. */
  imageBlob?: Blob;
  imageMime?: string;
}

export interface StoredBassIcon {
  kit: 'Funk' | 'Jazz' | 'Rock' | 'Latin' | 'Pop';
  blob: Blob;
  mime: string;
  updatedAt: number;
}

/**
 * Generic per-instrument icon, keyed by a composite string `slot|variant`.
 * Examples:
 *   drums:kick|Rock       — Rock kick drum image
 *   drums:snare|Jazz      — Jazz snare image
 *   keys|upright          — Upright piano image
 * Persists across reloads via IndexedDB.
 */
export interface StoredInstrumentIcon {
  /** Composite primary key: `${slot}|${variant}` */
  key: string;
  blob: Blob;
  mime: string;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('slot', 'slot');
      }
      if (!db.objectStoreNames.contains(BASS_ICON_STORE)) {
        db.createObjectStore(BASS_ICON_STORE, { keyPath: 'kit' });
      }
      if (!db.objectStoreNames.contains(INSTRUMENT_ICON_STORE)) {
        db.createObjectStore(INSTRUMENT_ICON_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putSample(s: StoredSample): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(s);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAllSamples(): Promise<StoredSample[]> {
  const db = await openDb();
  const out = await new Promise<StoredSample[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredSample[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function deleteSample(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function putBassIcon(icon: StoredBassIcon): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BASS_ICON_STORE, 'readwrite');
    tx.objectStore(BASS_ICON_STORE).put(icon);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAllBassIcons(): Promise<StoredBassIcon[]> {
  const db = await openDb();
  const out = await new Promise<StoredBassIcon[]>((resolve, reject) => {
    const tx = db.transaction(BASS_ICON_STORE, 'readonly');
    const req = tx.objectStore(BASS_ICON_STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredBassIcon[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function deleteBassIcon(kit: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BASS_ICON_STORE, 'readwrite');
    tx.objectStore(BASS_ICON_STORE).delete(kit);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function putInstrumentIcon(icon: StoredInstrumentIcon): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(INSTRUMENT_ICON_STORE, 'readwrite');
    tx.objectStore(INSTRUMENT_ICON_STORE).put(icon);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAllInstrumentIcons(): Promise<StoredInstrumentIcon[]> {
  const db = await openDb();
  const out = await new Promise<StoredInstrumentIcon[]>((resolve, reject) => {
    const tx = db.transaction(INSTRUMENT_ICON_STORE, 'readonly');
    const req = tx.objectStore(INSTRUMENT_ICON_STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredInstrumentIcon[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function deleteInstrumentIcon(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(INSTRUMENT_ICON_STORE, 'readwrite');
    tx.objectStore(INSTRUMENT_ICON_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
