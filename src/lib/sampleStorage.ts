/**
 * Tiny IndexedDB wrapper for storing user-uploaded audio samples as Blobs.
 * Survives reloads. When auth is added later, samples can be uploaded to
 * Cloud Storage on sign-in.
 */

const DB_NAME = 'mf-sample-library';
const DB_VERSION = 1;
const STORE = 'samples';

export interface StoredSample {
  /** Unique id, also used as IndexedDB primary key */
  id: string;
  /** User-friendly file name */
  name: string;
  /** Which instrument this belongs to: e.g. 'drums:snare', 'bass', 'keys' */
  slot: string;
  /** Display color (HSL string) for the part/sample chip */
  color: string;
  /** Audio MIME type */
  mime: string;
  /** Stored blob */
  blob: Blob;
  createdAt: number;
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
