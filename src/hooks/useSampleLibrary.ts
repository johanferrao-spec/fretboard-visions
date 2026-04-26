import { useCallback, useEffect, useState } from 'react';
import { deleteSample, getAllSamples, putSample, type StoredSample } from '@/lib/sampleStorage';
import type { DrumPart } from '@/lib/backingTrackTypes';
import {
  BUILT_IN_KIT_SAMPLES,
  defaultActiveKitMap,
  getBuiltInKitSample,
  KIT_PARTS,
  type BuiltInKitSample,
  type DrumKitGenre,
} from '@/lib/builtInKits';
import type { SampleResolution } from './engine/scheduler';

/** Slot key format:
 *   drums:<part>   e.g. 'drums:snare'
 *   bass           — single bass slot
 *   keys           — single keys slot
 */
export type SlotKey = `drums:${DrumPart}` | 'bass' | 'keys';

/** Per-sample tint within a slot — cycles through these so each user sample
 *  in a slot gets its own colour swatch. Built-in samples use their kit colour. */
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

/** Unified entry shown in the sample list — wraps either a user sample or built-in kit piece. */
export interface SampleListEntry {
  id: string;
  name: string;
  /** HSL color string (no hsl() wrapper) */
  color: string;
  /** Whether this is a built-in kit sample or a user upload */
  kind: 'builtin' | 'user';
  /** Built-in kit name when kind === 'builtin' */
  kit?: DrumKitGenre;
  /** Drum part this entry plays (for drum slots) */
  part?: DrumPart;
  /** Underlying user sample (kind === 'user') for preview playback */
  userSample?: StoredSample;
}

export function useSampleLibrary() {
  const [samples, setSamples] = useState<StoredSample[]>([]);
  // Default: pre-assign every drum part to the Rock kit so audio still plays
  // before the user touches anything. Loaded value (if any) overrides this.
  const [active, setActive] = useState<Record<string, string>>(() => {
    const stored = readActive();
    if (Object.keys(stored).length > 0) return stored;
    return defaultActiveKitMap('Rock');
  });
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

  /**
   * Samples available for a given slot. For drum slots: returns ALL built-in
   * kit samples for that part (across every kit) PLUS any user uploads. For
   * bass/keys: only user uploads.
   */
  const samplesForSlot = useCallback((slot: SlotKey): SampleListEntry[] => {
    const userEntries: SampleListEntry[] = samples
      .filter(s => s.slot === slot)
      .map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        kind: 'user' as const,
        userSample: s,
      }));

    if (slot.startsWith('drums:')) {
      const part = slot.split(':')[1] as DrumPart;
      const builtIns: SampleListEntry[] = BUILT_IN_KIT_SAMPLES
        .filter(k => k.part === part)
        .map<SampleListEntry>(k => ({
          id: k.id,
          name: `${k.kit} ${k.part}`,
          color: k.color,
          kind: 'builtin',
          kit: k.kit,
          part: k.part,
        }));
      return [...builtIns, ...userEntries];
    }
    return userEntries;
  }, [samples]);

  /** Resolve the active sample for a slot (used by the audio scheduler). */
  const resolveSlot = useCallback((slot: string): SampleResolution | null => {
    const id = active[slot];
    if (!id) return null;
    if (id.startsWith('kit:')) {
      const builtIn = getBuiltInKitSample(id);
      if (!builtIn) return null;
      return { kind: 'builtin', sample: builtIn };
    }
    const userSample = samples.find(s => s.id === id);
    if (!userSample) return null;
    return { kind: 'user', sample: userSample };
  }, [active, samples]);

  /** Convenience for UI: return the active list-entry for a slot (or null). */
  const activeEntryFor = useCallback((slot: SlotKey): SampleListEntry | null => {
    const id = active[slot];
    if (!id) return null;
    if (id.startsWith('kit:')) {
      const k = getBuiltInKitSample(id);
      if (!k) return null;
      return {
        id: k.id,
        name: `${k.kit} ${k.part}`,
        color: k.color,
        kind: 'builtin',
        kit: k.kit,
        part: k.part,
      };
    }
    const u = samples.find(s => s.id === id);
    if (!u) return null;
    return { id: u.id, name: u.name, color: u.color, kind: 'user', userSample: u };
  }, [active, samples]);

  /** Apply an entire genre kit to all drum parts in one click. */
  const applyKitForAllParts = useCallback((kit: DrumKitGenre) => {
    setActive(prev => {
      const next = { ...prev };
      for (const part of KIT_PARTS) {
        next[`drums:${part}`] = `kit:${kit.toLowerCase()}:${part}`;
      }
      writeActive(next);
      return next;
    });
  }, []);

  return {
    samples,
    loaded,
    active,
    addSample,
    removeSample,
    selectSample,
    samplesForSlot,
    resolveSlot,
    activeEntryFor,
    applyKitForAllParts,
  };
}
