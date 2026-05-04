import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteSample, getAllSamples, putBassIcon, getAllBassIcons, deleteBassIcon, putSample, putInstrumentIcon, getAllInstrumentIcons, deleteInstrumentIcon, type StoredBassIcon, type StoredInstrumentIcon, type StoredSample } from '@/lib/sampleStorage';
import {
  uploadBassIcon as cloudUploadBassIcon,
  uploadBassSample as cloudUploadBassSample,
  uploadInstrumentIcon as cloudUploadInstrumentIcon,
  uploadInstrumentSample as cloudUploadInstrumentSample,
  listCloudAssets,
  downloadCloudAsset,
} from '@/lib/cloudAssets';
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
export type BassIconKit = 'Funk' | 'Jazz' | 'Rock' | 'Latin' | 'Pop';

/** Per-sample tint within a slot — used for non-drum (bass/keys) user uploads. */
const SAMPLE_TINTS = [
  '210 80% 60%', '0 75% 60%', '50 90% 55%', '160 65% 50%',
  '280 70% 60%', '25 85% 55%', '320 70% 60%', '180 70% 50%',
];

const ACTIVE_KEY = 'mf-active-samples';

function cloudSampleId(folder: string, base: string): string {
  return `cloud_${folder}_${base}`;
}

function decodeCloudSlot(encoded: string): string {
  if (encoded === 'bass' || encoded === 'keys') return encoded;
  if (encoded.startsWith('drums_')) return encoded.replace(/^drums_/, 'drums:');
  return encoded.replace(/_/g, ':');
}

function canonicalBassKitFromCloudName(name: string): BassIconKit | null {
  const base = name.replace(/__v\d+_[a-z0-9]+(?=\.[^.]+$)/i, '').replace(/\.[^.]+$/, '');
  return ['Funk', 'Jazz', 'Rock', 'Latin', 'Pop'].includes(base) ? (base as BassIconKit) : null;
}

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
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(map)); } catch { /* ignore unavailable localStorage */ }
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
  const [bassIcons, setBassIcons] = useState<Record<BassIconKit, StoredBassIcon | undefined>>({
    Funk: undefined, Jazz: undefined, Rock: undefined, Latin: undefined, Pop: undefined,
  });
  /** Generic per-instrument icons keyed by `${slot}|${variant}`
   *  e.g. `drums:kick|Rock`, `keys|upright`. */
  const [instrumentIcons, setInstrumentIcons] = useState<Record<string, StoredInstrumentIcon>>({});
  // Always-current ref so callbacks never operate on a stale samples snapshot.
  const samplesRef = useRef<StoredSample[]>([]);
  samplesRef.current = samples;
  const bassIconsRef = useRef(bassIcons);
  bassIconsRef.current = bassIcons;
  const instrumentIconsRef = useRef(instrumentIcons);
  instrumentIconsRef.current = instrumentIcons;
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
    getAllSamples().then(async s => {
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

      let idbBassIcons: StoredBassIcon[] = [];
      let idbInstrumentIcons: StoredInstrumentIcon[] = [];
      try {
        idbBassIcons = await getAllBassIcons();
        if (!cancelled) {
          setBassIcons(prev => {
            const next = { ...prev };
            for (const icon of idbBassIcons) next[icon.kit] = icon;
            return next;
          });
        }
      } catch { /* ignore missing icon store during migration */ }
      try {
        idbInstrumentIcons = await getAllInstrumentIcons();
        if (!cancelled) {
          setInstrumentIcons(prev => {
            const next = { ...prev };
            for (const icon of idbInstrumentIcons) next[icon.key] = icon;
            return next;
          });
        }
      } catch { /* ignore missing icon store during migration */ }

      // --- Cloud restore: always merge any missing durable assets back in. ---
      if (!cancelled) {
        try {
          const cloudFiles = (await listCloudAssets()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          if (cancelled || cloudFiles.length === 0) { setLoaded(true); return; }
          console.log('[cloudRestore] restoring', cloudFiles.length, 'assets from cloud');

          const restoredBassKits = new Set<BassIconKit>();
          const existingInstrumentKeys = new Set(idbInstrumentIcons.map(icon => icon.key));
          const existingSampleIds = new Set(migrated.map(sample => sample.id));
          const existingSampleSlots = new Set(migrated.map(sample => `${sample.slot}|${sample.kit ?? 'default'}`));

          for (const cf of cloudFiles) {
            if (cancelled) break;

            if (cf.folder === 'bass' && cf.isImage) {
              // bass icon: name is e.g. "Rock.png" or "Rock__v123_abc.png" → kit = "Rock"
              const kit = canonicalBassKitFromCloudName(cf.name);
              if (!kit || restoredBassKits.has(kit)) continue;
              const dl = await downloadCloudAsset(cf.folder, cf.name);
              if (!dl) continue;
              const icon: StoredBassIcon = { kit, blob: dl.blob, mime: dl.mime, updatedAt: Date.now() };
              await putBassIcon(icon);
              restoredBassKits.add(kit);
              if (!cancelled) setBassIcons(prev => ({ ...prev, [kit]: icon }));
            } else if (cf.folder === 'instruments' && cf.isImage) {
              // instrument icon: name is e.g. "drums_kick__Rock.png"
              // Parse back to key format: slot|variant
              const base = cf.name.replace(/\.[^.]+$/, '');
              const sepIdx = base.indexOf('__');
              if (sepIdx < 0) continue;
              const slot = decodeCloudSlot(base.slice(0, sepIdx));
              const variant = base.slice(sepIdx + 2);
              const key = `${slot}|${variant}`;
              if (existingInstrumentKeys.has(key)) continue;
              const dl = await downloadCloudAsset(cf.folder, cf.name);
              if (!dl) continue;
              const icon: StoredInstrumentIcon = { key, blob: dl.blob, mime: dl.mime, updatedAt: Date.now() };
              await putInstrumentIcon(icon);
              existingInstrumentKeys.add(key);
              if (!cancelled) setInstrumentIcons(prev => ({ ...prev, [key]: icon }));
            } else if (cf.isAudio) {
              // audio sample restore
              const base = cf.name.replace(/\.[^.]+$/, '');
              let slot: string;
              let kit: string | undefined;
              const restoredId = cloudSampleId(cf.folder, base);
              if (existingSampleIds.has(restoredId)) continue;
              if (cf.folder === 'bass') {
                slot = 'bass';
                kit = base; // e.g. "Rock"
              } else {
                const sepIdx = base.indexOf('__');
                if (sepIdx < 0) continue;
                slot = decodeCloudSlot(base.slice(0, sepIdx));
                kit = base.slice(sepIdx + 2);
              }
              const slotKitKey = `${slot}|${kit ?? 'default'}`;
              if (existingSampleSlots.has(slotKitKey)) continue;
              const dl = await downloadCloudAsset(cf.folder, cf.name);
              if (!dl) continue;
              const sample: StoredSample = {
                id: restoredId,
                name: cf.name,
                slot,
                color: '#888',
                mime: dl.mime,
                blob: dl.blob,
                createdAt: Date.now(),
                kit: kit as StoredSample['kit'],
              };
              await putSample(sample);
              existingSampleIds.add(restoredId);
              existingSampleSlots.add(slotKitKey);
              if (!cancelled) setSamples(prev => [...prev, sample]);
            }
          }
        } catch (err) {
          console.warn('[cloudRestore] failed', err);
        }
      }

      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const setBassIcon = useCallback(async (kit: BassIconKit, file: File | Blob, mime?: string) => {
    const resolvedMime = mime || (file instanceof File ? file.type : '') || 'image/png';
    const icon: StoredBassIcon = {
      kit,
      blob: file,
      mime: resolvedMime,
      updatedAt: Date.now(),
    };
    await putBassIcon(icon);
    setBassIcons(prev => ({ ...prev, [kit]: icon }));
    // Mirror to Cloud Storage so the asset survives across devices/browser clears.
    const uploaded = await cloudUploadBassIcon(kit, file, resolvedMime);
    if (!uploaded) console.warn('[sampleLibrary] bass icon saved locally but cloud mirror failed', kit);
    return Boolean(uploaded);
  }, []);

  /** Set a generic per-instrument icon. Key format: `${slot}|${variant}`.
   *  Replaces ONLY this specific (slot, variant) entry — other variants are
   *  untouched. Persisted in IndexedDB so it survives reloads. */
  const setInstrumentIcon = useCallback(async (key: string, file: File | Blob, mime?: string) => {
    const resolvedMime = mime || (file instanceof File ? file.type : '') || 'image/png';
    const icon: StoredInstrumentIcon = {
      key,
      blob: file,
      mime: resolvedMime,
      updatedAt: Date.now(),
    };
    await putInstrumentIcon(icon);
    setInstrumentIcons(prev => ({ ...prev, [key]: icon }));
    // Mirror to Cloud Storage. Key format `${slot}|${variant}`.
    const [slot, variant = 'default'] = key.split('|');
    const uploaded = await cloudUploadInstrumentIcon(slot, variant, file, resolvedMime);
    if (!uploaded) console.warn('[sampleLibrary] instrument icon saved locally but cloud mirror failed', key);
    return Boolean(uploaded);
  }, []);

  const removeInstrumentIcon = useCallback(async (key: string) => {
    await deleteInstrumentIcon(key);
    setInstrumentIcons(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
      // Use the live ref so two rapid uploads can never both pick "tint #0".
      const existingForSlot = samplesRef.current.filter(s => s.slot === slot);
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
    // Mirror to Cloud Storage (durable, cross-device).
    const variant = (isDrum ? kit : undefined) ?? 'default';
    cloudUploadInstrumentSample(slot, variant, file, file.type || 'audio/wav');
    return id;
  }, []);

  /** Update mutable fields on a stored sample. */
  const updateSample = useCallback(async (
    id: string,
    patch: Partial<Pick<StoredSample, 'pitch' | 'slotIndex' | 'imageBlob' | 'imageMime' | 'name' | 'color' | 'kit'>>,
  ) => {
    // Read from the live ref so concurrent updates can't race-overwrite each
    // other in IndexedDB. Without this, calling updateSample(A) and
    // updateSample(B) back-to-back can lose B's patch when A's stale closure
    // writes back the pre-B record.
    const current = samplesRef.current.find(s => s.id === id);
    if (!current) return;
    const next: StoredSample = { ...current, ...patch };
    await putSample(next);
    setSamples(prev => prev.map(s => s.id === id ? next : s));
  }, []);

  /** Replace (or add new) a sample at a specific (slot, slotIndex) pair.
   *  If a sample already lives at that slot index, it's removed first so each
   *  slot index holds at most one sample. */
  const setSlotIndexedSample = useCallback(async (
    slot: SlotKey,
    slotIndex: number,
    file: File,
    extras?: { pitch?: number; imageBlob?: Blob; imageMime?: string; kit?: DrumKitGenre },
  ) => {
    const live = samplesRef.current;
    const existing = live.find(s => s.slot === slot && s.slotIndex === slotIndex);
    if (existing) {
      await deleteSample(existing.id);
    }
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const usedColors = new Set(live.filter(s => s.slot === slot && s.id !== existing?.id).map(s => s.color));
    const color = SAMPLE_TINTS.find(c => !usedColors.has(c)) || SAMPLE_TINTS[slotIndex % SAMPLE_TINTS.length];
    const stored: StoredSample = {
      id,
      name: file.name,
      slot,
      color,
      kit: extras?.kit,
      mime: file.type || 'audio/wav',
      blob: file,
      createdAt: Date.now(),
      slotIndex,
      pitch: extras?.pitch,
      imageBlob: extras?.imageBlob,
      imageMime: extras?.imageMime,
    };
    await putSample(stored);
    setSamples(prev => {
      const filtered = existing ? prev.filter(s => s.id !== existing.id) : prev;
      return [...filtered, stored];
    });
    // Make this the active bass sound immediately; the selector chips can
    // change it later, and playback resolves through this active choice.
    setActive(prev => {
      const next = { ...prev, [slot]: id };
      writeActive(next);
      return next;
    });
    // Mirror to Cloud Storage. For bass: kit-tagged path; otherwise generic.
    if (slot === 'bass' && extras?.kit) {
      cloudUploadBassSample(extras.kit, file, file.type || 'audio/wav');
    } else {
      cloudUploadInstrumentSample(slot, extras?.kit ?? `slot${slotIndex}`, file, file.type || 'audio/wav');
    }
    if (extras?.imageBlob) {
      const variant = extras.kit ?? `slot${slotIndex}`;
      if (slot === 'bass' && extras.kit) {
        cloudUploadBassIcon(extras.kit, extras.imageBlob, extras.imageMime || 'image/png');
      } else {
        cloudUploadInstrumentIcon(slot, variant, extras.imageBlob, extras.imageMime || 'image/png');
      }
    }
    return id;
  }, []);

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
   *  Special-case for the multi-sample bass:
   *    - `slot === 'bass'`           → pick from ALL bass samples
   *    - `slot === 'bass:<Kit>'`     → pick only from samples assigned to that bass kit
   *  In both cases, when `targetPitch` is provided, the sample with the
   *  closest detected natural pitch is chosen.
   */
  const resolveSlot = useCallback((slot: string, targetPitch?: number): SampleResolution | null => {
    // Bass (with optional kit filter): "bass" or "bass:Rock" / "bass:Jazz" / etc.
    if (slot === 'bass' || slot.startsWith('bass:')) {
      const requestedKit = slot.startsWith('bass:') ? slot.slice('bass:'.length) : null;
      // Snap a stored pitch into the bass register E1..E3 (28..52) so that
      // detector sub-harmonic mistakes don't cause octave-up playback.
      const snap = (p: number) => {
        let q = p;
        while (q < 28) q += 12;
        while (q > 52) q -= 12;
        return q;
      };
      let bassSamples = samples
        .filter(s => s.slot === 'bass')
        .map(s => (typeof s.pitch === 'number' ? { ...s, pitch: snap(s.pitch) } : s));
      if (!requestedKit && active.bass) {
        const selected = bassSamples.find(s => s.id === active.bass);
        if (selected) return { kind: 'user', sample: selected };
      }
      if (requestedKit) {
        const kitMatch = bassSamples.filter(s => s.kit === requestedKit);
        if (kitMatch.length > 0) bassSamples = kitMatch;
      }
      if (bassSamples.length === 0) return null;
      if (typeof targetPitch === 'number') {
        let best = bassSamples[0];
        let bestDist = Math.abs(((best.pitch as number | undefined) ?? 40) - targetPitch);
        for (let i = 1; i < bassSamples.length; i++) {
          const d = Math.abs(((bassSamples[i].pitch as number | undefined) ?? 40) - targetPitch);
          if (d < bestDist) { best = bassSamples[i]; bestDist = d; }
        }
        return { kind: 'user', sample: best };
      }
      return { kind: 'user', sample: bassSamples[0] };
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

  /** Reset a kit to factory defaults: remove all custom icons and user samples
   *  for that kit, then re-apply the built-in selections. */
  const resetKit = useCallback(async (kit: DrumKitGenre) => {
    // 1. Remove all instrument icons for this kit's drum slots
    for (const part of KIT_PARTS) {
      const iconKey = `drums:${part}|${kit}`;
      if (instrumentIconsRef.current[iconKey]) {
        await deleteInstrumentIcon(iconKey);
      }
    }
    setInstrumentIcons(prev => {
      const next = { ...prev };
      for (const part of KIT_PARTS) {
        delete next[`drums:${part}|${kit}`];
      }
      return next;
    });

    // 2. Remove user-uploaded samples tagged to this kit
    const toRemove = samplesRef.current.filter(
      s => s.slot?.startsWith('drums:') && s.kit === kit
    );
    for (const s of toRemove) {
      await deleteSample(s.id);
    }
    if (toRemove.length) {
      const removeIds = new Set(toRemove.map(s => s.id));
      setSamples(prev => prev.filter(s => !removeIds.has(s.id)));
    }

    // 3. Reset active selections to built-in defaults
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
    bassIcons,
    instrumentIcons,
    loaded,
    active,
    setBassIcon,
    setInstrumentIcon,
    removeInstrumentIcon,
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
    resetKit,
  };
}
