import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteSample, getAllSamples, putSample, type StoredSample } from '@/lib/sampleStorage';
import type { DrumPart } from '@/lib/backingTrackTypes';
import {
  BUILT_IN_KIT_SAMPLES,
  colorForKitPart,
  defaultActiveKitMap,
  getBuiltInKitSample,
  KIT_COLORS,
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

/** Per-sample tint within a slot — used for non-drum (bass/keys) user uploads. */
const SAMPLE_TINTS = [
  '210 80% 60%', '0 75% 60%', '50 90% 55%', '160 65% 50%',
  '280 70% 60%', '25 85% 55%', '320 70% 60%', '180 70% 50%',
];

const ACTIVE_KEY = 'mf-active-samples';

/** Migrate older slot keys: the legacy `drums:hihat` slot is now split into
 *  closed/pedal/open. We map any pre-existing assignment to `hihat_closed`. */
function migrateSlot(slot: string): string {
  if (slot === 'drums:hihat') return 'drums:hihat_closed';
  return slot;
}

/** Migrate a built-in kit id whose part name has changed. */
function migrateActiveValue(value: string): string {
  if (value.startsWith('kit:') && value.endsWith(':hihat')) {
    return value.replace(/:hihat$/, ':hihat_closed');
  }
  return value;
}

function readActive(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVE_KEY) || '{}') as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) out[migrateSlot(k)] = migrateActiveValue(v);
    return out;
  } catch { return {}; }
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
  // Always-current ref so callbacks never operate on a stale samples snapshot.
  // Without this, two rapid uploads can each see "[]" in their closure and the
  // second write can clobber the first when state finally flushes.
  const samplesRef = useRef<StoredSample[]>([]);
  samplesRef.current = samples;
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
      if (cancelled) return;
      // Migrate any legacy `drums:hihat` slot to `drums:hihat_closed`.
      const migrated = s.map(item => item.slot === 'drums:hihat'
        ? { ...item, slot: 'drums:hihat_closed' }
        : item);
      // CRITICAL: merge with anything the user may have added between mount
      // and the IndexedDB load resolving — otherwise their fresh uploads get
      // silently overwritten and "disappear". Functional setState lets us
      // see the post-mount state.
      setSamples(prev => {
        const seen = new Set(prev.map(p => p.id));
        const merged: StoredSample[] = [...prev];
        for (const m of migrated) if (!seen.has(m.id)) merged.push(m);
        return merged;
      });
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const addSample = useCallback(async (
    slot: SlotKey,
    file: File,
    kit?: DrumKitGenre,
    extras?: { slotIndex?: number; pitch?: number; imageBlob?: Blob; imageMime?: string },
  ) => {
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isDrum = slot.startsWith('drums:');
    const part = isDrum ? (slot.split(':')[1] as DrumPart) : null;
    let color: string;
    if (isDrum && kit && part) {
      color = colorForKitPart(kit, part);
    } else {
      const existingForSlot = samples.filter(s => s.slot === slot);
      const usedColors = new Set(existingForSlot.map(s => s.color));
      color = SAMPLE_TINTS.find(c => !usedColors.has(c)) || SAMPLE_TINTS[existingForSlot.length % SAMPLE_TINTS.length];
    }
    const stored: StoredSample = {
      id,
      name: file.name,
      slot,
      color,
      kit: isDrum ? kit : undefined,
      mime: file.type || 'audio/wav',
      blob: file,
      createdAt: Date.now(),
      ...(extras || {}),
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

  /** Update mutable fields on a stored sample. */
  const updateSample = useCallback(async (
    id: string,
    patch: Partial<Pick<StoredSample, 'pitch' | 'slotIndex' | 'imageBlob' | 'imageMime' | 'name' | 'color'>>,
  ) => {
    const current = samples.find(s => s.id === id);
    if (!current) return;
    const next: StoredSample = { ...current, ...patch };
    await putSample(next);
    setSamples(prev => prev.map(s => s.id === id ? next : s));
  }, [samples]);

  /** Replace (or add new) a sample at a specific (slot, slotIndex) pair.
   *  If a sample already lives at that slot index, it's removed first so each
   *  slot index holds at most one sample. */
  const setSlotIndexedSample = useCallback(async (
    slot: SlotKey,
    slotIndex: number,
    file: File,
    extras?: { pitch?: number; imageBlob?: Blob; imageMime?: string },
  ) => {
    const existing = samples.find(s => s.slot === slot && s.slotIndex === slotIndex);
    if (existing) {
      await deleteSample(existing.id);
    }
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const usedColors = new Set(samples.filter(s => s.slot === slot && s.id !== existing?.id).map(s => s.color));
    const color = SAMPLE_TINTS.find(c => !usedColors.has(c)) || SAMPLE_TINTS[slotIndex % SAMPLE_TINTS.length];
    const stored: StoredSample = {
      id,
      name: file.name,
      slot,
      color,
      mime: file.type || 'audio/wav',
      blob: file,
      createdAt: Date.now(),
      slotIndex,
      ...(extras || {}),
    };
    await putSample(stored);
    setSamples(prev => {
      const filtered = existing ? prev.filter(s => s.id !== existing.id) : prev;
      return [...filtered, stored];
    });
    // Also make this the "active" entry for the slot if none was active yet,
    // so the scheduler resolver returns *something* for legacy single-pick paths.
    setActive(prev => {
      if (prev[slot]) return prev;
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

  /** Determine which kit a given sample id belongs to (built-in or user-tagged). */
  const kitForSampleId = useCallback((id: string): DrumKitGenre | null => {
    if (id.startsWith('kit:')) {
      const k = getBuiltInKitSample(id);
      return k ? k.kit : null;
    }
    const u = samples.find(s => s.id === id);
    return u?.kit ?? null;
  }, [samples]);

  /** Select hi-hat samples for ALL 3 hi-hat slots (closed/pedal/open) from
   *  the given kit. Prefer user samples tagged to that kit; fall back to
   *  the built-in kit piece. Used when the user picks any hi-hat sample
   *  from a different kit — the whole hi-hat group follows. */
  const selectHihatGroup = useCallback((kit: DrumKitGenre) => {
    setActive(prev => {
      const next = { ...prev };
      (['hihat_closed', 'hihat_pedal', 'hihat_open'] as DrumPart[]).forEach(part => {
        const slot = `drums:${part}` as const;
        const tagged = samples.find(s => s.slot === slot && s.kit === kit);
        next[slot] = tagged ? tagged.id : `kit:${kit.toLowerCase()}:${part}`;
      });
      writeActive(next);
      return next;
    });
  }, [samples]);

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
        kit: s.kit,
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

  /** Resolve the active sample for a slot (used by the audio scheduler).
   *  When `targetPitch` is provided AND the slot is `bass`, pick the bass
   *  sample whose detected natural pitch is closest to the target — this
   *  multi-sample lookup gives much better fidelity than pitching one
   *  sample across the whole bass register. */
  const resolveSlot = useCallback((slot: string, targetPitch?: number): SampleResolution | null => {
    if (slot === 'bass' && typeof targetPitch === 'number') {
      const bassSamples = samples.filter(s => s.slot === 'bass' && typeof s.pitch === 'number');
      if (bassSamples.length > 0) {
        let best = bassSamples[0];
        let bestDist = Math.abs((best.pitch as number) - targetPitch);
        for (let i = 1; i < bassSamples.length; i++) {
          const d = Math.abs((bassSamples[i].pitch as number) - targetPitch);
          if (d < bestDist) { best = bassSamples[i]; bestDist = d; }
        }
        return { kind: 'user', sample: best };
      }
    }
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
    return { id: u.id, name: u.name, color: u.color, kind: 'user', kit: u.kit, userSample: u };
  }, [active, samples]);

  /** Apply an entire genre kit to all drum parts. For each part, prefer a
   *  user-uploaded sample tagged to this kit; fall back to the built-in. */
  const applyKitForAllParts = useCallback((kit: DrumKitGenre) => {
    setActive(prev => {
      const next = { ...prev };
      for (const part of KIT_PARTS) {
        const slot = `drums:${part}` as const;
        const tagged = samples.find(s => s.slot === slot && s.kit === kit);
        next[slot] = tagged ? tagged.id : `kit:${kit.toLowerCase()}:${part}`;
      }
      writeActive(next);
      return next;
    });
  }, [samples]);

  return {
    samples,
    loaded,
    active,
    addSample,
    updateSample,
    setSlotIndexedSample,
    removeSample,
    selectSample,
    selectHihatGroup,
    kitForSampleId,
    samplesForSlot,
    resolveSlot,
    activeEntryFor,
    applyKitForAllParts,
  };
}
