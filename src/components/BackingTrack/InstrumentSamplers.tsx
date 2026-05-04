import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Music, Upload } from 'lucide-react';
import BassSlotGrid from './BassSlotGrid';
import { detectPitchFromBlob } from '@/lib/pitchDetect';
import { autoTrimImageBlob } from '@/lib/imageTrim';
import type { DrumPart } from '@/lib/backingTrackTypes';
import type { Genre } from '@/hooks/useSongTimeline';
import { useSharedSampleLibrary as useSampleLibrary } from '@/hooks/SampleLibraryContext';
import type { BassIconKit, SlotKey, SampleListEntry } from '@/hooks/useSampleLibrary';
import {
  BUILT_IN_KIT_SAMPLES,
  KIT_COLORS,
  KIT_CYMBAL_COLORS,
  KIT_PARTS,
  CYMBAL_PARTS,
  colorForKitPart,
  type DrumKitGenre,
} from '@/lib/builtInKits';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  /** Master volume so the preview button matches playback level. */
  volume: number;
  /** Current song genre (drives bass icon variant). */
  genre: Genre;
}

type Selection =
  | { instrument: 'drums'; part: DrumPart }
  | { instrument: 'bass' }
  | { instrument: 'keys' };

function selectionToSlot(sel: Selection): SlotKey {
  if (sel.instrument === 'drums') return `drums:${sel.part}`;
  return sel.instrument;
}

const PART_LABEL: Record<DrumPart, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hihat_closed: 'Closed Hat',
  hihat_pedal: 'Pedal Hat',
  hihat_open: 'Open Hat',
  ride: 'Ride',
  tom1: 'Rack Tom 1',
  tom2: 'Floor Tom',
  tom3: 'Rack Tom 2',
  crash: 'Crash',
};

const DRUM_KITS: DrumKitGenre[] = ['Funk', 'Jazz', 'Rock', 'Latin', 'Pop'];

/** Mirror of the slot indices used by BassSlotGrid (Rock,Jazz,Funk,Latin,Pop). */
const BASS_KIT_INDEX: Record<DrumKitGenre, number> = {
  Rock: 0, Jazz: 1, Funk: 2, Latin: 3, Pop: 4,
};

// (Removed songGenreToKit — Pop is now its own kit and bass/drum kit
// selection is fully decoupled from song genre.)

type KeysVariant = 'upright' | 'electric' | 'synth';
const KEYS_OPTIONS: { id: KeysVariant; label: string }[] = [
  { id: 'upright', label: 'Upright Piano' },
  { id: 'electric', label: 'Electric Piano' },
  { id: 'synth', label: 'Synthesiser' },
];
const KEYS_VARIANT_KEY = 'mf-keys-variant';
const BASS_KIT_CHOICE_KEY = 'mf-bass-kit-choice';

const LEFT_COL_WIDTH_KEY = 'mf-sampler-left-width';

export default function InstrumentSamplers({ volume, genre: _genre }: Props) {
  const lib = useSampleLibrary();
  const [selection, setSelection] = useState<Selection>({ instrument: 'drums', part: 'snare' });
  const [dragOver, setDragOver] = useState<SlotKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  /** Width of the left sample-list column. User-resizable, persisted per-browser. */
  const [leftColWidth, setLeftColWidth] = useState<number>(() => {
    try {
      const v = parseInt(localStorage.getItem(LEFT_COL_WIDTH_KEY) ?? '', 10);
      return Number.isFinite(v) && v >= 200 && v <= 720 ? v : 288;
    } catch { return 288; }
  });
  useEffect(() => {
    try { localStorage.setItem(LEFT_COL_WIDTH_KEY, String(leftColWidth)); } catch { /* ignore */ }
  }, [leftColWidth]);

  /** Keys icon variant — user choice, persisted per-browser (not genre-driven). */
  const [keysVariant, setKeysVariant] = useState<KeysVariant>(() => {
    try {
      const v = localStorage.getItem(KEYS_VARIANT_KEY) as KeysVariant | null;
      return v && KEYS_OPTIONS.some(o => o.id === v) ? v : 'upright';
    } catch { return 'upright'; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEYS_VARIANT_KEY, keysVariant); } catch { /* ignore unavailable localStorage */ }
  }, [keysVariant]);

  /** Bass kit choice — user picks any kit (Funk in Jazz groove, etc).
   *  Independent of song genre. Persisted per-browser. */
  const [bassKitChoice, setBassKitChoice] = useState<DrumKitGenre>(() => {
    try {
      const v = localStorage.getItem(BASS_KIT_CHOICE_KEY) as DrumKitGenre | null;
      return v && (['Funk', 'Jazz', 'Rock', 'Latin', 'Pop'] as DrumKitGenre[]).includes(v) ? v : 'Rock';
    } catch { return 'Rock'; }
  });
  useEffect(() => {
    try { localStorage.setItem(BASS_KIT_CHOICE_KEY, bassKitChoice); } catch { /* ignore */ }
  }, [bassKitChoice]);

  /** Which kit the overview panel is currently viewing. Defaults to the kit
   *  of the active drum-part selection (or Rock). */
  const [viewKit, setViewKit] = useState<DrumKitGenre>('Rock');

  /** Pending file dropped on a drum slot — awaiting kit choice from the dialog. */
  const [pendingDrop, setPendingDrop] = useState<{ slot: SlotKey; file: File } | null>(null);

  /** Track object-URLs for every loaded instrument icon. Recreated whenever
   *  the underlying blob (or its `updatedAt` stamp) changes. */
  const iconUrls = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, icon] of Object.entries(lib.instrumentIcons)) {
      out[key] = URL.createObjectURL(icon.blob);
    }
    return out;
    // We deliberately key on the updatedAt timestamps so we recreate URLs
    // ONLY when an icon actually changes (avoids leaking blobs on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.entries(lib.instrumentIcons).map(([k, v]) => `${k}:${v.updatedAt}`).join('|')]);
  useEffect(() => () => {
    Object.values(iconUrls).forEach(u => URL.revokeObjectURL(u));
  }, [iconUrls]);

  const slot = selectionToSlot(selection);
  const slotSamples = lib.samplesForSlot(slot);
  const activeEntry = lib.activeEntryFor(slot);

  // Map each drum part -> its currently active kit color (bronze for cymbals).
  const partTints = useMemo(() => {
    const tints: Partial<Record<DrumPart, string>> = {};
    KIT_PARTS.forEach(part => {
      const a = lib.activeEntryFor(`drums:${part}` as SlotKey);
      if (a) tints[part] = a.color;
    });
    return tints;
  }, [lib]);

  const bassActive = lib.activeEntryFor('bass');
  const keysActive = lib.activeEntryFor('keys');

  const handleDrop = async (e: React.DragEvent, dropSlot: SlotKey) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    const audio = files.find(f => /^audio\//.test(f.type) || /\.(wav|mp3|ogg|m4a|aiff?|flac)$/i.test(f.name));
    const image = files.find(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(f.name));

    if (dropSlot.startsWith('drums:')) {
      // Image dropped on a drum part → store as the icon for THIS part + the
      // currently-viewed kit. Replaces only this specific (part, kit) image
      // and does not affect any other kit/part combo.
      if (image) {
        const iconKey = `${dropSlot}|${viewKit}`;
        await lib.setInstrumentIcon(iconKey, image, image.type || 'image/png');
      }
      // Audio drop → save directly under the currently-viewed kit (no prompt).
      if (audio) {
        await lib.addSample(dropSlot, audio, viewKit);
        const part = dropSlot.split(':')[1] as DrumPart;
        setSelection({ instrument: 'drums', part });
      }
      return;
    }
    if (dropSlot === 'bass') {
      // Drop onto the main bass icon → assign to the slot for the current
      // song's bass kit, with auto-pitch detection. Mirrors BassSlotGrid.
      const bassKitForDrop = bassKitChoice;
      const slotIndex = BASS_KIT_INDEX[bassKitForDrop];
      // Auto-trim transparent / uniform-background borders so the artwork
      // hugs the frame regardless of the source image's aspect ratio.
      const trimmed = image ? await autoTrimImageBlob(image) : null;
      if (trimmed) await lib.setBassIcon(bassKitForDrop, trimmed.blob, trimmed.mime);
      if (audio) {
        const detected = await detectPitchFromBlob(audio);
        let snapped: number | undefined = detected?.midi;
        if (typeof snapped === 'number') {
          while (snapped < 28) snapped += 12;
          while (snapped > 52) snapped -= 12;
        }
        await lib.setSlotIndexedSample('bass', slotIndex, audio, {
          pitch: snapped,
          kit: bassKitForDrop,
          ...(trimmed ? { imageBlob: trimmed.blob, imageMime: trimmed.mime } : {}),
        });
      } else if (trimmed) {
        // No audio — attach artwork to the existing sample for this kit.
        const existing = lib.samples.find(s => s.slot === 'bass' && s.kit === bassKitForDrop);
        if (existing) {
          await lib.updateSample(existing.id, {
            imageBlob: trimmed.blob,
            imageMime: trimmed.mime,
          });
        }
      }
      setSelection({ instrument: 'bass' });
      return;
    }
    // Keys: image drops set the icon for the currently-selected keys variant.
    if (dropSlot === 'keys' && image) {
      await lib.setInstrumentIcon(`keys|${keysVariant}`, image, image.type || 'image/png');
    }
    if (audio) {
      await lib.addSample(dropSlot, audio);
      setSelection({ instrument: dropSlot as 'bass' | 'keys' });
    }
  };

  const confirmKitForPending = async (kit: DrumKitGenre) => {
    if (!pendingDrop) return;
    const { slot: dropSlot, file } = pendingDrop;
    setPendingDrop(null);
    await lib.addSample(dropSlot, file, kit);
    if (dropSlot.startsWith('drums:')) {
      const part = dropSlot.split(':')[1] as DrumPart;
      setSelection({ instrument: 'drums', part });
    }
  };

  /** Drop handler for kit-overview rows: kit is implicit (the panel's viewKit),
   *  so we bypass the picker dialog and store immediately. Accepts both audio
   *  (replaces the kit's sample) and image (replaces only the icon for this
   *  specific part + kit combo). */
  const handleOverviewDrop = async (e: React.DragEvent, dropSlot: SlotKey, kit: DrumKitGenre) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const files = Array.from(e.dataTransfer.files ?? []);
    const audio = files.find(f => /^audio\//.test(f.type) || /\.(wav|mp3|ogg|m4a|aiff?|flac)$/i.test(f.name));
    const image = files.find(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(f.name));
    if (image) {
      await lib.setInstrumentIcon(`${dropSlot}|${kit}`, image, image.type || 'image/png');
    }
    if (audio) {
      await lib.addSample(dropSlot, audio, kit);
      if (dropSlot.startsWith('drums:')) {
        const part = dropSlot.split(':')[1] as DrumPart;
        setSelection({ instrument: 'drums', part });
      }
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (slot.startsWith('drums:')) {
      setPendingDrop({ slot, file });
    } else {
      await lib.addSample(slot, file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Play a short preview of any sample entry (user upload OR jazz built-in).
   *  Synth-based built-ins (Funk/Rock/Latin) have no preview wav — they will
   *  silently no-op. */
  const previewSample = (entry: SampleListEntry | null, semitoneShift = 0) => {
    if (!entry) return;
    if (previewRef.current) {
      try { previewRef.current.pause(); } catch { /* ignore preview cleanup */ }
      previewRef.current.src = '';
    }
    let url: string | null = null;
    let revoke = false;
    if (entry.kind === 'user' && entry.userSample) {
      url = URL.createObjectURL(entry.userSample.blob);
      revoke = true;
    } else if (entry.kind === 'builtin' && entry.kit === 'Jazz' && entry.part) {
      // Jazz built-ins have wavs. Closed/Pedal/Open all share hihat.wav.
      const fileMap: Record<string, string> = {
        kick: 'kick', snare: 'snare', ride: 'ride',
        hihat_closed: 'hihat', hihat_pedal: 'hihat', hihat_open: 'hihat',
      };
      const file = fileMap[entry.part];
      if (file) url = `/samples/jazz/${file}.wav`;
    }
    if (!url) return;
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, volume));
    if (semitoneShift !== 0) {
      a.preservesPitch = false;
      // @ts-expect-error vendor prefix
      a.mozPreservesPitch = false;
      // @ts-expect-error vendor prefix
      a.webkitPreservesPitch = false;
      a.playbackRate = Math.pow(2, semitoneShift / 12);
    }
    a.play().catch(() => {});
    if (revoke) a.onended = () => URL.revokeObjectURL(url!);
    previewRef.current = a;
  };

  useEffect(() => () => {
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current = null;
    }
  }, []);

  // ── Drum SVG helpers (front-view illustration) ────────────────────
  const STROKE_DEFAULT = 'hsl(220 10% 35%)';
  const SKIN_FILL = 'hsl(220 8% 88%)';            // light grey drum heads
  const HARDWARE = 'hsl(220 8% 65%)';              // chrome stands
  const HARDWARE_DARK = 'hsl(220 10% 30%)';        // pedals & feet
  const CYMBAL_FILL = 'hsl(42 78% 62%)';           // warm gold
  const CYMBAL_STROKE = 'hsl(38 60% 40%)';

  // Default shell colour per kit when no sample is assigned.
  const KIT_SHELL: Record<DrumKitGenre, string> = {
    Rock:  'hsl(0 70% 45%)',     // classic red
    Funk:  'hsl(28 85% 50%)',    // burnt orange
    Jazz:  'hsl(35 55% 32%)',    // vintage walnut
    Latin: 'hsl(48 80% 50%)',    // amber yellow
    Pop:   'hsl(200 70% 75%)',   // pale blue
  };
  const SHELL_FILL = KIT_SHELL[viewKit];
  const DEFAULT_FILL = SHELL_FILL;
  const partFill = (part: DrumPart) => {
    // Cymbals always render as gold; drums use kit shell colour (or sample tint).
    if (part === 'crash' || part === 'ride' || part === 'hihat_closed' || part === 'hihat_open' || part === 'hihat_pedal') {
      const tint = partTints[part];
      return tint ? `hsl(${tint})` : CYMBAL_FILL;
    }
    const tint = partTints[part];
    return tint ? `hsl(${tint})` : SHELL_FILL;
  };
  const isPartSelected = (part: DrumPart) =>
    selection.instrument === 'drums' && selection.part === part;
  const isPartDragOver = (part: DrumPart) => dragOver === `drums:${part}`;
  const partStroke = (part: DrumPart) =>
    isPartSelected(part) ? 'hsl(var(--primary))' :
    isPartDragOver(part) ? 'hsl(var(--beginner-yellow))' :
    STROKE_DEFAULT;
  const partStrokeWidth = (part: DrumPart) =>
    isPartSelected(part) || isPartDragOver(part) ? 2.5 : 1;

  const partProps = (part: DrumPart) => ({
    onClick: () => {
      setSelection({ instrument: 'drums', part });
      // Preview whatever sample is currently active for this part.
      previewSample(lib.activeEntryFor(`drums:${part}` as SlotKey));
    },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(`drums:${part}` as SlotKey); },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => handleDrop(e, `drums:${part}` as SlotKey),
    style: { cursor: 'pointer' as const },
  });

  // Bass display kit: prefer the active sample's kit, then the user's
  // explicit choice, then fall back to the song genre. This lets the user
  // pick e.g. Funk bass while playing a Jazz groove.
  const bassKit = (bassActive?.userSample?.kit as DrumKitGenre | undefined) ?? bassKitChoice;

  return (
    <div className="flex h-full min-h-0 bg-card border-t border-border overflow-hidden">
      {/* LEFT COLUMN: per-piece header + sample list (no part-icon grid) */}
      <div className="shrink-0 flex flex-col h-full min-h-0 overflow-y-auto" style={{ width: leftColWidth }}>
        <div className="px-3 py-2 border-b border-border">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {selection.instrument === 'drums' ? `Drums · ${PART_LABEL[selection.part]}` : selection.instrument === 'bass' ? 'Bass sampler' : 'Keys sampler'}
          </div>
          <div className="text-[10px] font-mono text-foreground mt-0.5 truncate">
            {activeEntry ? activeEntry.name : 'No sample selected'}
          </div>
        </div>

        {/* Keys variant picker (only when keys selected) */}
        {selection.instrument === 'keys' && (
          <div className="px-2 py-2 border-b border-border">
            <div className="text-[9px] font-mono uppercase text-muted-foreground mb-1">Icon style</div>
            <div className="grid grid-cols-2 gap-1">
              {KEYS_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setKeysVariant(opt.id)}
                  className={`text-[9px] font-mono uppercase rounded py-1 border transition-colors ${
                    keysVariant === opt.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bass: dedicated 4-slot multi-sampler with image + auto-pitch detection */}
        {selection.instrument === 'bass' && (
          <BassSlotGrid lib={lib} volume={volume} />
        )}

        {/* Sample list for the active slot (drums + keys only — bass uses the
            slot grid above which encapsulates upload & preview controls). */}
        {selection.instrument !== 'bass' && (
        <div className="shrink-0">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-muted-foreground">
              {selection.instrument === 'drums' ? `${PART_LABEL[selection.part]} samples` : 'Samples'}
            </span>
            <button
              onClick={handleUploadClick}
              className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-muted flex items-center gap-1"
              title="Upload audio file"
            >
              <Upload size={9} /> Add
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.ogg,.m4a,.aiff,.aif"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>
          {slotSamples.length === 0 && (
            <div className="px-3 py-3 text-[10px] font-mono text-muted-foreground italic">
              {lib.loaded ? 'Drop a .wav onto the diagram or use Add' : 'Loading library…'}
            </div>
          )}
          {slotSamples.map(s => {
            const isActive = activeEntry?.id === s.id;
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 ${isActive ? 'bg-muted/70' : ''}`}
                onClick={() => {
                  // Hi-hat slots are grouped: choosing any hi-hat sample
                  // from a kit reassigns all 3 hi-hat slots to that kit.
                  const isHihat = slot === 'drums:hihat_closed' || slot === 'drums:hihat_pedal' || slot === 'drums:hihat_open';
                  const kit = isHihat ? lib.kitForSampleId(s.id) : null;
                  if (isHihat && kit) {
                    lib.selectHihatGroup(kit);
                  } else {
                    lib.selectSample(slot, s.id);
                  }
                  previewSample(s);
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: `hsl(${s.color})` }}
                />
                <span className="text-[10px] font-mono text-foreground truncate flex-1">
                  {s.kind === 'builtin'
                    ? <><span className="opacity-70">{s.kit}</span> <span>{s.part}</span></>
                    : <>{s.kit && <span className="opacity-70">{s.kit} </span>}{s.name}</>}
                </span>
                {s.kind === 'user' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); previewSample(s); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                      title="Preview"
                    >
                      <Music size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); lib.removeSample(s.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* KIT OVERVIEW — every part for the selected kit, missing slots
            droppable, click a row to play that kit-part's sample. */}
        {selection.instrument === 'drums' && (
          <div className="border-t border-border flex flex-col">
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                Kit overview
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => lib.applyKitForAllParts(viewKit)}
                  className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-muted"
                  title={`Set every drum part to ${viewKit}`}
                >
                  Apply
                </button>
                <button
                  onClick={() => lib.resetKit(viewKit)}
                  className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30"
                  title={`Reset ${viewKit} kit to defaults (removes custom icons & samples)`}
                >
                  Reset
                </button>
              </div>
            </div>
            {/* Kit picker tabs */}
            <div className="grid grid-cols-4 gap-1 px-2">
              {DRUM_KITS.map(kit => {
                const isOn = viewKit === kit;
                return (
                  <button
                    key={kit}
                    onClick={() => setViewKit(kit)}
                    className={`text-[9px] font-mono uppercase rounded py-1 border transition-colors ${
                      isOn ? 'border-primary text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40'
                    }`}
                    style={isOn ? { backgroundColor: `hsl(${KIT_COLORS[kit]} / 0.35)` } : undefined}
                  >
                    {kit}
                  </button>
                );
              })}
            </div>
            {/* Part rows — ordered: kick, snare, toms, then cymbals */}
            <div className="px-2 py-2 space-y-1">
              {(['kick','snare','tom1','tom3','tom2','hihat_closed','hihat_pedal','hihat_open','ride','crash'] as DrumPart[]).map(part => {
                const slotKey = `drums:${part}` as SlotKey;
                const userSampleForKit = lib.samples.find(s => s.slot === slotKey && s.kit === viewKit);
                const builtInId = `kit:${viewKit.toLowerCase()}:${part}`;
                const builtInDef = BUILT_IN_KIT_SAMPLES.find(s => s.id === builtInId);
                const builtInHasAudio = builtInDef?.source === 'jazz-sample';
                // For built-in audio samples, show the actual on-disk filename
                // (e.g. "kick.wav", "hihat.wav") so users see the real asset.
                const builtInFileMap: Record<string, string> = {
                  kick: 'kick.wav', snare: 'snare.wav', ride: 'ride.wav',
                  hihat_closed: 'hihat.wav', hihat_pedal: 'hihat.wav', hihat_open: 'hihat.wav',
                };
                const builtInDisplayName = builtInHasAudio
                  ? builtInFileMap[part] ?? `${viewKit} ${PART_LABEL[part]}`
                  : null;
                const builtInEntry: SampleListEntry = {
                  id: builtInId,
                  name: `${viewKit} ${part}`,
                  color: colorForKitPart(viewKit, part),
                  kind: 'builtin',
                  kit: viewKit,
                  part,
                };
                const entryToUse: SampleListEntry = userSampleForKit
                  ? {
                      id: userSampleForKit.id,
                      name: userSampleForKit.name,
                      color: userSampleForKit.color,
                      kind: 'user',
                      kit: viewKit,
                      userSample: userSampleForKit,
                    }
                  : builtInEntry;
                // "Missing" only when neither a user upload nor a built-in audio sample exists.
                const isMissing = !userSampleForKit && !builtInHasAudio;
                const displayName = userSampleForKit
                  ? userSampleForKit.name
                  : builtInDisplayName ?? 'Drop sample';
                const isDragOverThis = dragOver === slotKey;
                const isSelected = selection.instrument === 'drums' && selection.part === part;
                return (
                  <div key={part}>
                    {part === 'tom1' && (
                      <div className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/70 px-1 pt-1 pb-0.5">Toms</div>
                    )}
                    {part === 'hihat_closed' && (
                      <div className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/70 px-1 pt-1 pb-0.5">Cymbals</div>
                    )}
                    <div
                      onClick={() => {
                      setSelection({ instrument: 'drums', part });
                      const isHihat = part === 'hihat_closed' || part === 'hihat_pedal' || part === 'hihat_open';
                      if (isHihat) {
                        lib.selectHihatGroup(viewKit);
                      } else {
                        lib.selectSample(slotKey, entryToUse.id);
                      }
                      previewSample(entryToUse);
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(slotKey); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => handleOverviewDrop(e, slotKey, viewKit)}
                    className={`group flex items-center gap-2 px-2 py-1 rounded cursor-pointer border transition-colors ${
                      isDragOverThis
                        ? 'border-primary bg-primary/10'
                        : isSelected
                          ? 'border-primary/60 bg-muted/60'
                          : isMissing
                            ? 'border-dashed border-border/70 hover:bg-muted/30'
                            : 'border-border hover:bg-muted/40'
                    }`}
                    title={isMissing ? `Drop a sample to add a ${PART_LABEL[part]} to the ${viewKit} kit` : `Click to play ${PART_LABEL[part]}`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{
                        backgroundColor: `hsl(${entryToUse.color}${isMissing ? ' / 0.35' : ''})`,
                        border: isMissing ? '1px dashed hsl(var(--muted-foreground) / 0.5)' : undefined,
                      }}
                    />
                    <span className="text-[10px] font-mono text-foreground flex-1 truncate">
                      {PART_LABEL[part]}
                    </span>
                    <span className={`text-[9px] font-mono ${isMissing ? 'text-muted-foreground/60 italic' : 'text-muted-foreground truncate max-w-[100px]'}`}>
                      {displayName}
                    </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CENTER + RIGHT: vector art for all three instruments — drums shown
          in parallel (cymbals row above, drums row below) rather than as a
          set-up kit. Vertical dividers separate drums | bass | keys. */}
      <div className="flex-1 flex items-stretch justify-around gap-3 p-3 overflow-x-auto divide-x divide-border">
        {/* DRUM KIT — parallel layout */}
        <div className="flex flex-col items-center min-w-[360px] flex-1 px-3">
          <div className="flex flex-col gap-3 w-full max-h-[260px]">
            {/* CYMBALS ROW (top) — uniform square frames */}
            <div className="flex items-end justify-around gap-2">
             {(['hihat_closed', 'hihat_pedal', 'hihat_open', 'crash', 'ride'] as DrumPart[]).map(part => {
                // Approx real-world cymbal sizes (inches): hi-hat 14", crash 16-18", ride 20-22"
                const CYMBAL_DIM: Record<string, number> = {
                  hihat_closed: 60,
                  hihat_pedal: 60,
                  hihat_open: 60,
                  crash: 78,
                  ride: 96,
                };
                const w = CYMBAL_DIM[part] ?? 78;
                const h = w;
                return (
                  <div key={part} className="flex flex-col items-center gap-1" {...partProps(part)}>
                    <div
                      className={`relative overflow-hidden rounded-md border bg-background/40 ${
                        isPartSelected(part) ? 'ring-2 ring-primary border-primary' :
                        isPartDragOver(part) ? 'ring-2 ring-[hsl(var(--beginner-yellow))] border-[hsl(var(--beginner-yellow))]' :
                        'border-border'
                      }`}
                      style={{ width: w, height: h }}
                    >
                      {iconUrls[`drums:${part}|${viewKit}`] ? (
                        <img
                          src={iconUrls[`drums:${part}|${viewKit}`]}
                          alt={`${viewKit} ${PART_LABEL[part]}`}
                          className="absolute inset-0 w-full h-full object-contain"
                          draggable={false}
                        />
                      ) : (
                        <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 w-full h-full">
                          <line x1={w/2} y1={h*0.55} x2={w/2} y2={h-2} stroke={HARDWARE} strokeWidth="2" />
                          {part === 'hihat_pedal' ? (
                            <>
                              <ellipse cx={w/2} cy={h*0.4} rx={w*0.4} ry={5} fill={partFill(part)} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)} />
                              <ellipse cx={w/2} cy={h*0.5} rx={w*0.4} ry={5} fill={partFill(part)} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)} opacity="0.85" />
                              <rect x={w*0.2} y={h-12} width={w*0.6} height={6} rx={1} fill={HARDWARE_DARK} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)*0.6} />
                            </>
                          ) : (
                            <ellipse cx={w/2} cy={h*0.45} rx={w*0.45} ry={part === 'crash' || part === 'ride' ? 12 : 8} fill={partFill(part)} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)} />
                          )}
                        </svg>
                      )}
                    </div>
                    <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
                      {PART_LABEL[part]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DRUMS ROW (bottom) — uniform rectangular frames */}
            <div className="flex items-end justify-around gap-3 mt-2">
             {(['kick', 'snare', 'tom1', 'tom3', 'tom2'] as DrumPart[]).map(part => {
                // Approx real-world drum sizes: kick 22", floor tom 16", rack tom 12", snare 14"x6"
                const DRUM_DIM: Record<string, { w: number; h: number }> = {
                  kick: { w: 120, h: 120 },
                  tom2: { w: 92, h: 92 },   // floor tom
                  snare: { w: 80, h: 64 },  // shallow shell
                  tom1: { w: 70, h: 70 },   // rack tom 1
                  tom3: { w: 70, h: 70 },   // rack tom 2
                };
                const { w, h } = DRUM_DIM[part] ?? { w: 88, h: 88 };
                return (
                  <div key={part} className="flex flex-col items-center gap-1" {...partProps(part)}>
                    <div
                      className={`relative overflow-hidden rounded-md border bg-background/40 ${
                        isPartSelected(part) ? 'ring-2 ring-primary border-primary' :
                        isPartDragOver(part) ? 'ring-2 ring-[hsl(var(--beginner-yellow))] border-[hsl(var(--beginner-yellow))]' :
                        'border-border'
                      }`}
                      style={{ width: w, height: h }}
                    >
                      {iconUrls[`drums:${part}|${viewKit}`] ? (
                        <img
                          src={iconUrls[`drums:${part}|${viewKit}`]}
                          alt={`${viewKit} ${PART_LABEL[part]}`}
                          className="absolute inset-0 w-full h-full object-contain"
                          draggable={false}
                        />
                      ) : (
                        <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 w-full h-full">
                          {part === 'kick' ? (
                            <>
                              <circle cx={w/2} cy={h/2} r={h/2 - 6} fill={partFill(part)} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)} />
                              <circle cx={w/2} cy={h/2} r={h/2 - 14} fill={SKIN_FILL} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)*0.5} />
                            </>
                          ) : (
                            <>
                              <rect x={6} y={14} width={w-12} height={h-24} fill={partFill(part)} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)} />
                              <ellipse cx={w/2} cy={14} rx={(w-12)/2} ry={8} fill={SKIN_FILL} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)} />
                              <ellipse cx={w/2} cy={h-10} rx={(w-12)/2} ry={6} fill={partFill(part)} stroke={partStroke(part)} strokeWidth={partStrokeWidth(part)} />
                              {[0,1,2,3,4].map(i => (
                                <rect key={i} x={12 + i*((w-24)/4) - 1.5} y={18} width="3" height={h - 32} fill={SKIN_FILL} opacity={0.85} />
                              ))}
                            </>
                          )}
                        </svg>
                      )}
                    </div>
                    <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
                      {PART_LABEL[part]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-3">Drum kit · {viewKit}</div>
        </div>

        {/* BASS — genre-specific icon (or dropped artwork if available) */}
        <div className="px-3">
          <BassMainIcon
            lib={lib}
            bassKit={bassKit}
            bassActive={bassActive}
            dragOver={dragOver === 'bass'}
            selected={selection.instrument === 'bass'}
            onSelect={() => { setSelection({ instrument: 'bass' }); previewSample(lib.activeEntryFor('bass')); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver('bass'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, 'bass')}
            onPickKit={setBassKitChoice}
          />
        </div>

        {/* KEYS — user-chosen icon variant */}
        <div
          className={`flex flex-col items-center min-w-[180px] rounded-md transition-colors px-3 ${dragOver === 'keys' ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
          onClick={() => { setSelection({ instrument: 'keys' }); previewSample(lib.activeEntryFor('keys')); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver('keys'); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, 'keys')}
          style={{ cursor: 'pointer' }}
        >
          {iconUrls[`keys|${keysVariant}`] ? (
            <img
              src={iconUrls[`keys|${keysVariant}`]}
              alt={`${keysVariant} keys`}
              className={`h-[180px] w-auto object-contain rounded ${selection.instrument === 'keys' ? 'ring-2 ring-primary' : ''}`}
              draggable={false}
            />
          ) : (
            <KeysIcon
              variant={keysVariant}
              active={!!keysActive}
              color={keysActive?.color}
              selected={selection.instrument === 'keys'}
            />
          )}
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
            {KEYS_OPTIONS.find(o => o.id === keysVariant)?.label}
          </div>
        </div>
      </div>

      {/* Kit-picker dialog shown after dropping a sample on a drum part */}
      <Dialog open={!!pendingDrop} onOpenChange={(open) => { if (!open) setPendingDrop(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save sample to which kit?</DialogTitle>
            <DialogDescription>
              Choose the kit this {pendingDrop?.slot.startsWith('drums:') ? PART_LABEL[pendingDrop.slot.split(':')[1] as DrumPart].toLowerCase() : ''} sample belongs to.
              It will be tinted with that kit's colour and used whenever you "Apply" that kit.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {DRUM_KITS.map(kit => {
              const part = pendingDrop?.slot.startsWith('drums:')
                ? (pendingDrop.slot.split(':')[1] as DrumPart)
                : null;
              const swatch = part && CYMBAL_PARTS.has(part) ? KIT_CYMBAL_COLORS[kit] : KIT_COLORS[kit];
              return (
                <button
                  key={kit}
                  onClick={() => confirmKitForPending(kit)}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  <span
                    className="w-4 h-4 rounded-sm shrink-0"
                    style={{ backgroundColor: `hsl(${swatch})` }}
                  />
                  <span className="text-sm font-mono">{kit}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bass main icon — shows dropped artwork (per kit) when available so that
// uploaded bass samples don't "disappear" behind the SVG. Falls back to
// the genre-specific vector illustration.
// ─────────────────────────────────────────────────────────────────────
const BASS_KITS_ALL: DrumKitGenre[] = ['Rock', 'Jazz', 'Funk', 'Latin', 'Pop'];

function getBassKitAtPoint(x: number, y: number): BassIconKit | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const target = el?.closest?.('[data-bass-kit]') as HTMLElement | null;
  const kit = target?.dataset.bassKit as BassIconKit | undefined;
  return kit && BASS_KITS_ALL.includes(kit) ? kit : null;
}

function BassMainIcon({
  lib, bassKit, bassActive, dragOver, selected,
  onSelect, onDragOver, onDragLeave, onDrop, onPickKit,
}: {
  lib: ReturnType<typeof useSampleLibrary>;
  bassKit: DrumKitGenre;
  bassActive: SampleListEntry | null;
  dragOver: boolean;
  selected: boolean;
  onSelect: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onPickKit: (kit: DrumKitGenre) => void;
}) {
  const [chipDragOver, setChipDragOver] = useState<BassIconKit | null>(null);
  // Find the bass sample assigned to the current kit (preferred) and the
  // one currently active; either may carry artwork we want to render.
  const sampleForKit = useMemo(
    () => lib.samples.find(s => s.slot === 'bass' && s.kit === bassKit) ?? null,
    [lib.samples, bassKit],
  );
  const artworkSample = sampleForKit?.imageBlob ? sampleForKit : (bassActive?.userSample?.imageBlob ? bassActive.userSample : null);
  const artworkIcon = lib.bassIcons[bassKit];

  // Manage object URL for the dropped artwork.
  const [artUrl, setArtUrl] = useState<string | null>(null);
  useEffect(() => {
    const blob = artworkSample?.imageBlob ?? artworkIcon?.blob;
    if (!blob) { setArtUrl(null); return; }
    const url = URL.createObjectURL(blob);
    setArtUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [artworkSample?.id, artworkSample?.imageBlob, artworkIcon?.blob, artworkIcon?.updatedAt]);

  return (
    <div
      className={`flex flex-col items-center min-w-[180px] rounded-md transition-colors ${dragOver ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
      onClick={onSelect}
      onDragOver={onDragOver}
      onDragEnter={(e) => setChipDragOver(getBassKitAtPoint(e.clientX, e.clientY))}
      onDragOverCapture={(e) => setChipDragOver(getBassKitAtPoint(e.clientX, e.clientY))}
      onDragLeave={onDragLeave}
      onDrop={async (e) => {
        // If the drop landed on a kit chip, persist the upload under THAT
        // kit (image -> bass_icons + sample.imageBlob, audio -> new sample
        // tagged with the chip's kit). Otherwise defer to the parent
        // handleDrop which uses the currently-active bassKitChoice.
        const kitTarget = getBassKitAtPoint(e.clientX, e.clientY);
        setChipDragOver(null);
        if (!kitTarget) { onDrop(e); return; }
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files ?? []);
        const rawImage = files.find(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(f.name));
        const audio = files.find(f => /^audio\//.test(f.type) || /\.(wav|mp3|ogg|m4a|aiff?|flac)$/i.test(f.name));
        // Auto-trim transparent / uniform-background borders so the artwork
        // hugs the frame regardless of the source aspect ratio.
        let image: { blob: Blob; mime: string } | null = null;
        if (rawImage) {
          const trimmed = await autoTrimImageBlob(rawImage);
          image = trimmed;
        }
        // Persist the icon to its own store first (survives reload even
        // when no audio sample exists for this kit yet).
        if (image) {
          await lib.setBassIcon(kitTarget, image.blob, image.mime);
        }
        if (audio) {
          // Reuse the parent's slot-index map by promoting this kit, then
          // write a new sample tagged with the chip's kit. Pitch detection
          // is handled here mirroring the parent path.
          const idx = ['Rock','Jazz','Funk','Latin','Pop'].indexOf(kitTarget);
          if (idx >= 0) {
            await lib.setSlotIndexedSample('bass', idx, audio, {
              kit: kitTarget as DrumKitGenre,
              ...(image ? { imageBlob: image.blob, imageMime: image.mime } : {}),
            });
          }
        } else if (image) {
          // No audio file dropped → also stamp the image onto any existing
          // sample for this kit so the per-sample artwork stays in sync.
          const existing = lib.samples.find(s => s.slot === 'bass' && s.kit === kitTarget);
          if (existing) {
            await lib.updateSample(existing.id, { imageBlob: image.blob, imageMime: image.mime });
          }
        }
        // Promote the chip's kit so future bass playback uses this sample.
        onPickKit(kitTarget as DrumKitGenre);
      }}
      style={{ cursor: 'pointer' }}
    >
      <div
        className={`relative overflow-hidden rounded-md border bg-background/40 ${selected ? 'ring-2 ring-primary border-primary' : 'border-border'}`}
        style={{ width: 180, height: 280 }}
      >
        {artUrl ? (
          <img
            src={artUrl}
            alt={`${bassKit} bass artwork`}
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BassIcon
              kit={bassKit}
              active={!!bassActive}
              color={bassActive?.color}
              selected={false}
            />
          </div>
        )}
      </div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
        Bass · {bassKit}
      </div>
      {/* Kit selector chips so user can pick which bass plays */}
      <div className="flex gap-1 mt-1">
        {BASS_KITS_ALL.map(k => {
          const has = lib.samples.some(s => s.slot === 'bass' && s.kit === k);
          const isOn = k === bassKit;
          return (
            <button
              key={k}
              data-bass-kit={k}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // Always remember the user's chosen kit (independent of song genre).
                onPickKit(k as DrumKitGenre);
                // If a sample exists for that kit, also promote it as the active bass.
                const sample = lib.samples.find(s => s.slot === 'bass' && s.kit === k);
                if (sample) lib.selectSample('bass', sample.id);
                else lib.selectSample('bass', null);
              }}
              className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border transition-colors ${
                isOn
                  ? 'border-primary bg-primary/15 text-foreground'
                  : chipDragOver === k
                    ? 'border-primary bg-primary/10 text-foreground'
                  : has
                    ? 'border-border text-foreground hover:bg-muted/40'
                    : 'border-dashed border-border/60 text-muted-foreground/60'
              }`}
              title={has ? `Use ${k} bass sample` : `No ${k} bass sample yet`}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bass icon — genre-specific body shape
// ─────────────────────────────────────────────────────────────────────
const BASS_STROKE = 'hsl(220 10% 50%)';

function BassIcon({
  kit, active, color, selected,
}: { kit: DrumKitGenre; active: boolean; color?: string; selected: boolean }) {
  const bodyFill = active && color ? `hsl(${color})` : kitDefaultBassFill(kit);
  const accent = active && color ? `hsl(${color} / 0.7)` : 'hsl(30 30% 20%)';
  const stroke = selected ? 'hsl(var(--primary))' : BASS_STROKE;
  const sw = selected ? 2.5 : 1;

  if (kit === 'Jazz') return <UprightBass body={bodyFill} stroke={stroke} sw={sw} />;
  if (kit === 'Funk') return <FenderJazzBass body={bodyFill} accent={accent} stroke={stroke} sw={sw} />;
  if (kit === 'Latin') return <AcousticBass body={bodyFill} accent={accent} stroke={stroke} sw={sw} />;
  // Rock + fallback (Pop)
  return <PrecisionBass body={bodyFill} accent={accent} stroke={stroke} sw={sw} />;
}

function kitDefaultBassFill(kit: DrumKitGenre): string {
  if (kit === 'Jazz')  return 'hsl(28 55% 28%)';   // dark wood
  if (kit === 'Funk')  return 'hsl(50 70% 55%)';   // sunburst yellow
  if (kit === 'Latin') return 'hsl(35 40% 65%)';   // pale wood
  if (kit === 'Pop')   return 'hsl(200 70% 75%)';  // pale blue
  return 'hsl(0 65% 45%)'; // rock
}

/** Fender Precision — slab body, single split-coil pickup, large headstock. */
function PrecisionBass({ body, accent, stroke, sw }: { body: string; accent: string; stroke: string; sw: number }) {
  return (
    <svg viewBox="0 0 100 200" className="h-[280px] w-[140px]">
      {/* Headstock */}
      <path d="M 36 6 L 64 6 L 62 28 L 38 28 Z" fill={body} stroke={stroke} strokeWidth={sw} />
      {[0,1,2,3].map(i => (
        <circle key={i} cx={i % 2 === 0 ? 36 : 64} cy={10 + Math.floor(i/2)*8} r={1.8} fill={stroke} />
      ))}
      {/* Neck */}
      <rect x="44" y="28" width="12" height="80" fill={accent} stroke={stroke} strokeWidth={sw} />
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1="44" y1={36 + i*9} x2="56" y2={36 + i*9} stroke="hsl(45 30% 70%)" strokeWidth={0.5} />
      ))}
      {/* Body — wide slab, double cutaway */}
      <path d="M 18 110 Q 6 130 14 165 Q 30 184 50 178 Q 70 184 86 165 Q 94 130 82 110 Q 70 100 50 105 Q 30 100 18 110 Z"
            fill={body} stroke={stroke} strokeWidth={sw} />
      {/* Split-coil pickup (P-Bass signature) */}
      <rect x="34" y="125" width="14" height="6" rx="1" fill="hsl(220 10% 12%)" />
      <rect x="52" y="133" width="14" height="6" rx="1" fill="hsl(220 10% 12%)" />
      {/* Bridge */}
      <rect x="40" y="160" width="20" height="5" fill="hsl(45 25% 60%)" />
      {/* Strings */}
      {[46, 48.5, 51, 53.5].map((x,i) => (
        <line key={i} x1={x} y1={28} x2={x} y2={163} stroke="hsl(45 50% 80%)" strokeWidth={0.6} />
      ))}
    </svg>
  );
}

/** Fender Jazz — offset waist, two single-coils, slimmer neck. */
function FenderJazzBass({ body, accent, stroke, sw }: { body: string; accent: string; stroke: string; sw: number }) {
  return (
    <svg viewBox="0 0 100 200" className="h-[280px] w-[140px]">
      <path d="M 36 6 L 66 6 L 64 28 L 38 28 Z" fill={body} stroke={stroke} strokeWidth={sw} />
      {[0,1,2,3].map(i => (
        <circle key={i} cx={i % 2 === 0 ? 38 : 64} cy={10 + Math.floor(i/2)*8} r={1.8} fill={stroke} />
      ))}
      {/* Slimmer neck */}
      <rect x="46" y="28" width="9" height="82" fill={accent} stroke={stroke} strokeWidth={sw} />
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1="46" y1={36 + i*9} x2="55" y2={36 + i*9} stroke="hsl(45 30% 70%)" strokeWidth={0.5} />
      ))}
      {/* Offset (asymmetric) body */}
      <path d="M 16 112 Q 4 126 12 158 Q 26 184 48 178 Q 72 186 88 162 Q 96 132 84 112 Q 72 102 50 106 Q 28 100 16 112 Z"
            fill={body} stroke={stroke} strokeWidth={sw} />
      {/* Two single-coil pickups */}
      <rect x="36" y="128" width="28" height="5" rx="1" fill="hsl(220 10% 12%)" />
      <rect x="36" y="148" width="28" height="5" rx="1" fill="hsl(220 10% 12%)" />
      {/* Control plate */}
      <rect x="68" y="158" width="14" height="14" rx="2" fill="hsl(45 35% 70%)" opacity="0.7" />
      <rect x="38" y="166" width="20" height="4" fill="hsl(45 25% 60%)" />
      {[46.5, 49, 51.5, 54].map((x,i) => (
        <line key={i} x1={x} y1={28} x2={x} y2={168} stroke="hsl(45 50% 80%)" strokeWidth={0.6} />
      ))}
    </svg>
  );
}

/** Upright (double) bass — tall scrolled body, F-holes, no frets. */
function UprightBass({ body, stroke, sw }: { body: string; stroke: string; sw: number }) {
  return (
    <svg viewBox="0 0 100 200" className="h-[280px] w-[140px]">
      {/* Scroll */}
      <circle cx="50" cy="10" r="6" fill={body} stroke={stroke} strokeWidth={sw} />
      <circle cx="50" cy="10" r="3" fill="none" stroke={stroke} strokeWidth={0.6} />
      {/* Pegbox */}
      <path d="M 44 14 L 56 14 L 54 32 L 46 32 Z" fill={body} stroke={stroke} strokeWidth={sw} />
      {[0,1,2,3].map(i => (
        <circle key={i} cx={i % 2 === 0 ? 43 : 57} cy={18 + Math.floor(i/2)*7} r={1.4} fill={stroke} />
      ))}
      {/* Fingerboard (no frets) */}
      <rect x="46" y="32" width="8" height="80" fill="hsl(220 10% 14%)" stroke={stroke} strokeWidth={sw * 0.6} />
      {/* Body — large violin-like shape */}
      <path d="M 14 116 Q 0 138 10 168 Q 28 196 50 192 Q 72 196 90 168 Q 100 138 86 116 Q 76 100 64 106 Q 50 102 36 106 Q 24 100 14 116 Z"
            fill={body} stroke={stroke} strokeWidth={sw} />
      {/* F-holes */}
      <path d="M 32 138 Q 30 148 34 158 Q 35 162 33 165" fill="none" stroke="hsl(220 10% 10%)" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M 68 138 Q 70 148 66 158 Q 65 162 67 165" fill="none" stroke="hsl(220 10% 10%)" strokeWidth={1.4} strokeLinecap="round" />
      {/* Bridge */}
      <path d="M 42 150 L 58 150 L 56 158 L 44 158 Z" fill="hsl(35 50% 55%)" stroke={stroke} strokeWidth={0.5} />
      {/* Tailpiece */}
      <path d="M 44 168 L 56 168 L 53 184 L 47 184 Z" fill="hsl(220 10% 12%)" stroke={stroke} strokeWidth={0.5} />
      {/* Strings */}
      {[46.5, 49, 51.5, 54].map((x,i) => (
        <line key={i} x1={x} y1={20} x2={x} y2={170} stroke="hsl(45 50% 80%)" strokeWidth={0.7} />
      ))}
      {/* Endpin */}
      <line x1="50" y1="184" x2="50" y2="198" stroke="hsl(220 10% 30%)" strokeWidth={1.2} />
    </svg>
  );
}

/** Acoustic bass guitar — guitar-shaped hollow body with a sound hole. */
function AcousticBass({ body, accent, stroke, sw }: { body: string; accent: string; stroke: string; sw: number }) {
  return (
    <svg viewBox="0 0 100 200" className="h-[280px] w-[140px]">
      <path d="M 38 6 L 62 6 L 60 28 L 40 28 Z" fill={body} stroke={stroke} strokeWidth={sw} />
      {[0,1,2,3].map(i => (
        <circle key={i} cx={i % 2 === 0 ? 38 : 62} cy={10 + Math.floor(i/2)*8} r={1.8} fill={stroke} />
      ))}
      {/* Neck */}
      <rect x="44" y="28" width="12" height="78" fill={accent} stroke={stroke} strokeWidth={sw} />
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1="44" y1={36 + i*10} x2="56" y2={36 + i*10} stroke="hsl(45 30% 70%)" strokeWidth={0.5} />
      ))}
      {/* Hollow guitar body (figure-8) */}
      <path d="M 18 116 Q 4 134 14 158 Q 26 188 50 184 Q 74 188 86 158 Q 96 134 82 116 Q 70 104 50 110 Q 30 104 18 116 Z"
            fill={body} stroke={stroke} strokeWidth={sw} />
      {/* Sound hole */}
      <circle cx="50" cy="142" r="11" fill="hsl(220 10% 8%)" stroke="hsl(35 40% 35%)" strokeWidth={1} />
      <circle cx="50" cy="142" r="13" fill="none" stroke="hsl(35 40% 35%)" strokeWidth={0.4} />
      {/* Bridge */}
      <rect x="40" y="166" width="20" height="5" rx="1" fill="hsl(35 40% 30%)" />
      {[46, 48.5, 51, 53.5].map((x,i) => (
        <line key={i} x1={x} y1={28} x2={x} y2={168} stroke="hsl(45 50% 80%)" strokeWidth={0.6} />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Keys icons — five user-selectable variants
// ─────────────────────────────────────────────────────────────────────
const KEYS_STROKE = 'hsl(220 10% 50%)';

function KeysIcon({
  variant, active, color, selected,
}: { variant: KeysVariant; active: boolean; color?: string; selected: boolean }) {
  const tint = active && color ? `hsl(${color})` : null;
  const stroke = selected ? 'hsl(var(--primary))' : KEYS_STROKE;
  const sw = selected ? 2.5 : 1;
  switch (variant) {
    case 'upright':  return <UprightPianoIcon tint={tint} stroke={stroke} sw={sw} />;
    case 'electric': return <ElectricPianoIcon tint={tint} stroke={stroke} sw={sw} />;
    case 'synth':    return <SynthIcon tint={tint} stroke={stroke} sw={sw} />;
  }
}

/** Upright piano — tall cabinet, lid, music rest, full keyboard. */
function UprightPianoIcon({ tint, stroke, sw }: { tint: string | null; stroke: string; sw: number }) {
  const cabinet = tint || 'hsl(20 35% 22%)';
  return (
    <svg viewBox="0 0 240 180" className="w-full h-full max-h-[180px]">
      {/* Cabinet */}
      <rect x="20" y="10" width="200" height="160" rx="4" fill={cabinet} stroke={stroke} strokeWidth={sw} />
      {/* Top lid */}
      <rect x="14" y="8" width="212" height="10" rx="2" fill="hsl(20 30% 16%)" stroke={stroke} strokeWidth={sw * 0.6} />
      {/* Front panel inset */}
      <rect x="32" y="26" width="176" height="46" rx="2" fill="hsl(20 30% 16%)" />
      {/* Music rest groove */}
      <line x1="36" y1="68" x2="204" y2="68" stroke="hsl(45 25% 60%)" strokeWidth={0.6} />
      {/* Brand plate */}
      <rect x="100" y="36" width="40" height="10" rx="1" fill="hsl(45 35% 60%)" opacity={0.7} />
      {/* Fallboard (closed-ish, suggesting it's open over the keys) */}
      <rect x="22" y="78" width="196" height="10" fill="hsl(20 30% 14%)" />
      {/* White keys */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`w-${i}`} x={26 + i*13.5} y={92} width={12.5} height={64} fill="hsl(45 30% 95%)" stroke="hsl(220 10% 30%)" strokeWidth={0.5} />
      ))}
      {/* Black keys */}
      {[0,1,3,4,5,7,8,10,11,12].map(i => (
        <rect key={`b-${i}`} x={26 + i*13.5 + 9} y={92} width={7.5} height={40} fill="hsl(220 10% 10%)" stroke="hsl(220 10% 30%)" strokeWidth={0.4} />
      ))}
      {/* Pedals */}
      <rect x="100" y="160" width="6" height="14" fill="hsl(45 35% 55%)" />
      <rect x="116" y="160" width="6" height="14" fill="hsl(45 35% 55%)" />
      <rect x="132" y="160" width="6" height="14" fill="hsl(45 35% 55%)" />
    </svg>
  );
}

/** Electric piano — Rhodes-style suitcase with tine bar visible. */
function ElectricPianoIcon({ tint, stroke, sw }: { tint: string | null; stroke: string; sw: number }) {
  const body = tint || 'hsl(0 0% 18%)';
  return (
    <svg viewBox="0 0 240 180" className="w-full h-full max-h-[180px]">
      {/* Suitcase body */}
      <rect x="6" y="40" width="228" height="120" rx="6" fill={body} stroke={stroke} strokeWidth={sw} />
      {/* Top lid raised */}
      <path d="M 6 40 L 18 16 L 222 16 L 234 40 Z" fill="hsl(0 0% 12%)" stroke={stroke} strokeWidth={sw * 0.6} />
      {/* Rhodes logo strip */}
      <rect x="80" y="22" width="80" height="10" rx="1" fill="hsl(0 80% 40%)" opacity={0.85} />
      <text x="120" y="30" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="hsl(45 30% 95%)">RHODES</text>
      {/* Control panel */}
      <rect x="14" y="48" width="212" height="20" rx="2" fill="hsl(0 0% 10%)" />
      {[0,1,2,3,4].map(i => (
        <circle key={i} cx={28 + i*22} cy={58} r={3.5} fill="hsl(45 35% 70%)" />
      ))}
      {/* Keys */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`w-${i}`} x={14 + i*16} y={76} width={15} height={76} fill="hsl(45 30% 95%)" stroke="hsl(220 10% 30%)" strokeWidth={0.5} />
      ))}
      {[0,1,3,4,5,7,8,10,11,12].map(i => (
        <rect key={`b-${i}`} x={14 + i*16 + 11} y={76} width={9} height={46} fill="hsl(220 10% 10%)" stroke="hsl(220 10% 30%)" strokeWidth={0.4} />
      ))}
    </svg>
  );
}

/** Synthesiser — slim chassis with knobs, sliders and modulation wheels. */
function SynthIcon({ tint, stroke, sw }: { tint: string | null; stroke: string; sw: number }) {
  const body = tint || 'hsl(220 15% 14%)';
  return (
    <svg viewBox="0 0 240 180" className="w-full h-full max-h-[180px]">
      <rect x="4" y="20" width="232" height="140" rx="6" fill={body} stroke={stroke} strokeWidth={sw} />
      {/* Top control strip */}
      <rect x="14" y="28" width="212" height="36" rx="3" fill="hsl(220 12% 10%)" />
      {/* Knobs */}
      {[0,1,2,3,4,5,6].map(i => (
        <g key={`k-${i}`}>
          <circle cx={32 + i*24} cy={42} r={5} fill="hsl(220 10% 22%)" stroke="hsl(220 10% 35%)" strokeWidth={0.5} />
          <line x1={32 + i*24} y1={42} x2={32 + i*24} y2={38} stroke="hsl(45 35% 70%)" strokeWidth={1} />
        </g>
      ))}
      {/* Sliders */}
      {[0,1,2,3].map(i => (
        <g key={`s-${i}`}>
          <rect x={196 - i*0} y={32} width={2} height={28} fill="hsl(220 10% 30%)" />
          <rect x={193 - i*0} y={42 + i*3} width={8} height={4} fill="hsl(160 60% 45%)" />
        </g>
      ))}
      {/* Mod / pitch wheels */}
      <rect x="10" y="78" width="14" height="46" rx="3" fill="hsl(220 10% 18%)" stroke={stroke} strokeWidth={0.5} />
      <rect x="11" y="92" width="12" height="6" rx="1" fill="hsl(160 50% 45%)" />
      <rect x="28" y="78" width="14" height="46" rx="3" fill="hsl(220 10% 18%)" stroke={stroke} strokeWidth={0.5} />
      <rect x="29" y="98" width="12" height="6" rx="1" fill="hsl(160 50% 45%)" />
      {/* Keys */}
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={`w-${i}`} x={48 + i*15} y={80} width={14} height={72} fill="hsl(45 30% 95%)" stroke="hsl(220 10% 30%)" strokeWidth={0.5} />
      ))}
      {[0,1,3,4,5,7,8,10].map(i => (
        <rect key={`b-${i}`} x={48 + i*15 + 10} y={80} width={8} height={42} fill="hsl(220 10% 10%)" stroke="hsl(220 10% 30%)" strokeWidth={0.4} />
      ))}
    </svg>
  );
}

/** Hammond-style organ — two manuals + drawbars on the side. */
function OrganIcon({ tint, stroke, sw }: { tint: string | null; stroke: string; sw: number }) {
  const wood = tint || 'hsl(25 50% 28%)';
  return (
    <svg viewBox="0 0 240 180" className="w-full h-full max-h-[180px]">
      {/* Cabinet */}
      <rect x="10" y="14" width="220" height="148" rx="4" fill={wood} stroke={stroke} strokeWidth={sw} />
      {/* Drawbars panel */}
      <rect x="20" y="22" width="120" height="22" rx="2" fill="hsl(20 30% 14%)" />
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={`d-${i}`} x={26 + i*12} y={26 + (i % 3) * 2} width={8} height={12} fill={i < 4 ? 'hsl(45 35% 75%)' : 'hsl(0 60% 40%)'} stroke="hsl(220 10% 20%)" strokeWidth={0.4} />
      ))}
      {/* Right-side controls */}
      <rect x="148" y="22" width="80" height="22" rx="2" fill="hsl(20 30% 14%)" />
      {[0,1,2,3,4].map(i => (
        <circle key={`c-${i}`} cx={158 + i*16} cy={33} r={3.5} fill="hsl(45 30% 70%)" />
      ))}
      {/* Upper manual */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`u-${i}`} x={16 + i*15.5} y={56} width={14.5} height={42} fill="hsl(45 30% 95%)" stroke="hsl(220 10% 30%)" strokeWidth={0.5} />
      ))}
      {[0,1,3,4,5,7,8,10,11,12].map(i => (
        <rect key={`ub-${i}`} x={16 + i*15.5 + 10} y={56} width={8} height={26} fill="hsl(220 10% 10%)" />
      ))}
      {/* Lower manual */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`l-${i}`} x={16 + i*15.5} y={108} width={14.5} height={42} fill="hsl(45 30% 95%)" stroke="hsl(220 10% 30%)" strokeWidth={0.5} />
      ))}
      {[0,1,3,4,5,7,8,10,11,12].map(i => (
        <rect key={`lb-${i}`} x={16 + i*15.5 + 10} y={108} width={8} height={26} fill="hsl(220 10% 10%)" />
      ))}
    </svg>
  );
}

/** Sampler — pad-grid groovebox / MPC-style controller. */
function SamplerIcon({ tint, stroke, sw }: { tint: string | null; stroke: string; sw: number }) {
  const body = tint || 'hsl(0 0% 16%)';
  return (
    <svg viewBox="0 0 240 180" className="w-full h-full max-h-[180px]">
      <rect x="10" y="14" width="220" height="150" rx="8" fill={body} stroke={stroke} strokeWidth={sw} />
      {/* Top screen + transport */}
      <rect x="22" y="22" width="98" height="38" rx="3" fill="hsl(160 60% 25%)" stroke="hsl(160 50% 40%)" strokeWidth={0.5} />
      <line x1="28" y1="32" x2="114" y2="32" stroke="hsl(160 70% 60%)" strokeWidth={0.5} opacity={0.5} />
      <line x1="28" y1="40" x2="114" y2="40" stroke="hsl(160 70% 60%)" strokeWidth={0.5} opacity={0.5} />
      <line x1="28" y1="48" x2="114" y2="48" stroke="hsl(160 70% 60%)" strokeWidth={0.5} opacity={0.5} />
      {/* Knobs */}
      {[0,1,2,3].map(i => (
        <g key={`k-${i}`}>
          <circle cx={138 + i*22} cy={38} r={7} fill="hsl(220 10% 22%)" stroke="hsl(220 10% 35%)" strokeWidth={0.5} />
          <line x1={138 + i*22} y1={38} x2={138 + i*22} y2={32} stroke="hsl(45 35% 70%)" strokeWidth={1} />
        </g>
      ))}
      {/* 4x4 pad grid */}
      {Array.from({ length: 16 }).map((_, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const padColors = ['0 70% 55%', '40 80% 55%', '160 60% 45%', '210 70% 55%'];
        const fill = `hsl(${padColors[c]} / 0.85)`;
        return (
          <rect
            key={`pad-${i}`}
            x={22 + c*42}
            y={70 + r*22}
            width={36}
            height={18}
            rx={3}
            fill={fill}
            stroke="hsl(220 10% 10%)"
            strokeWidth={0.6}
          />
        );
      })}
    </svg>
  );
}
