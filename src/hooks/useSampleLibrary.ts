import { useCallback, useEffect, useState } from 'react';
import { deleteSample, getAllSamples, putSample, type StoredSample } from '@/lib/sampleStorage';
import type { DrumPart } from '@/lib/backingTrackTypes';

/** Slot key format:
 *   drums:<part>   e.g. 'drums:snare'
 *   bass           — single bass slot
 *   keys           — single keys slot
 */
export type SlotKey = `drums:${DrumPart}` | 'bass' | 'keys';

/** Distinct color per drum part on the kit vector. */
export const PART_COLORS: Record<DrumPart, string> = {
  kick:  '0 75% 60%',
  snare: '210 80% 60%',
  hihat: '50 90% 55%',
  ride:  '280 70% 60%',
  tom1:  '160 65% 50%',
  tom2:  '25 85% 55%',
  crash: '320 70% 60%',
};

/** Per-sample tint within a slot — cycles through these so each sample
 *  in the snare list etc. has its own colour on the kit vector when active. */
const SAMPLE_TINTS = [
  '210 80% 60%', '0 75% 60%', '50 90% 55%', '160 65% 50%',
  '280 70% 60%', '25 85% 55%', '320 70% 60%', '180 70% 50%',
];

const ACTIVE_KEY = 'mf-active-samples';

function readActive(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || '{}'); }
  catch { return {}; }
}

function writeActive(map: Record<string, string>) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(map)); } catch {}
}

export function useSampleLibrary() {
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [active, setActive] = useState<Record<string, string>>(() => readActive());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllSamples().then(s => {
      if (!cancelled) {
        setSamples(s);
        setLoaded(true);
      }
    }).catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const addSample = useCallback(async (slot: SlotKey, file: File) => {
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Pick a tint not already used for this slot, if possible.
    const existingForSlot = samples.filter(s => s.slot === slot);
    const usedColors = new Set(existingForSlot.map(s => s.color));
    const color = SAMPLE_TINTS.find(c => !usedColors.has(c)) || SAMPLE_TINTS[existingForSlot.length % SAMPLE_TINTS.length];
    const stored: StoredSample = {
      id,
      name: file.name,
      slot,
      color,
      mime: file.type || 'audio/wav',
      blob: file,
      createdAt: Date.now(),
    };
    await putSample(stored);
    setSamples(prev => [...prev, stored]);
    // Auto-select the freshly added sample for this slot.
    setActive(prev => {
      const next = { ...prev, [slot]: id };
      writeActive(next);
      return next;
    });
    return id;
  }, [samples]);

  const removeSample = useCallback(async (id: string) => {
    await deleteSample(id);
    setSamples(prev => prev.filter(s => s.id !== id));
    setActive(prev => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) if (v !== id) next[k] = v;
      writeActive(next);
      return next;
    });
  }, []);

  const selectSample = useCallback((slot: SlotKey, id: string | null) => {
    setActive(prev => {
      const next = { ...prev };
      if (id === null) delete next[slot]; else next[slot] = id;
      writeActive(next);
      return next;
    });
  }, []);

  const samplesForSlot = useCallback(
    (slot: SlotKey) => samples.filter(s => s.slot === slot),
    [samples],
  );

  const activeSampleFor = useCallback((slot: SlotKey): StoredSample | null => {
    const id = active[slot];
    if (!id) return null;
    return samples.find(s => s.id === id) || null;
  }, [active, samples]);

  return {
    samples,
    loaded,
    active,
    addSample,
    removeSample,
    selectSample,
    samplesForSlot,
    activeSampleFor,
  };
}
