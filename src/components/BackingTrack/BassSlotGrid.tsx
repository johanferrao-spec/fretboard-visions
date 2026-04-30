import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Music, Trash2, Upload } from 'lucide-react';
import type { useSampleLibrary } from '@/hooks/useSampleLibrary';
import type { StoredSample } from '@/lib/sampleStorage';
import { detectPitchFromBlob, midiToName } from '@/lib/pitchDetect';

type LibValue = ReturnType<typeof useSampleLibrary>;

interface Props {
  lib: LibValue;
  /** Volume 0..1 used for previewing samples through HTMLAudio. */
  volume: number;
}

/** The four bass slots are pinned to one bass type each, keyed by `kit`. */
type BassKit = 'Rock' | 'Jazz' | 'Funk' | 'Latin';
const BASS_KITS: { kit: BassKit; index: number; label: string }[] = [
  { kit: 'Rock',  index: 0, label: 'Rock'  },
  { kit: 'Jazz',  index: 1, label: 'Jazz'  },
  { kit: 'Funk',  index: 2, label: 'Funk'  },
  { kit: 'Latin', index: 3, label: 'Latin' },
];

interface SlotEntry {
  index: number;
  kit: BassKit;
  label: string;
  sample: StoredSample | null;
}

const isAudioFile = (f: File) =>
  /^audio\//.test(f.type) || /\.(wav|mp3|ogg|m4a|aiff?|flac)$/i.test(f.name);
const isImageFile = (f: File) =>
  /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(f.name);

/**
 * Four-slot bass sampler — one slot per bass kit (Rock / Jazz / Funk / Latin).
 * Each slot is a drop target for both a `.wav` (audio, auto pitch-detected)
 * and a `.png/.jpg` (artwork). The sample assigned to a slot inherits that
 * slot's kit so it can be looked up by kit at playback time.
 */
export default function BassSlotGrid({ lib, volume }: Props) {
  // Build the 4 visible slots from samples whose kit field matches.
  const slots: SlotEntry[] = useMemo(() => {
    return BASS_KITS.map(({ kit, index, label }) => {
      const s =
        lib.samples.find(s => s.slot === 'bass' && s.kit === kit) ||
        // Backwards-compat: legacy samples stored only by slotIndex.
        lib.samples.find(s => s.slot === 'bass' && s.kit === undefined && s.slotIndex === index) ||
        null;
      return { index, kit, label, sample: s };
    });
  }, [lib.samples]);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const audioInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const imageInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  // Object URLs for slot artwork; recreated whenever the underlying blob changes.
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    const created: string[] = [];
    for (const s of slots) {
      if (s.sample?.imageBlob) {
        const url = URL.createObjectURL(s.sample.imageBlob);
        next[s.sample.id] = url;
        created.push(url);
      }
    }
    setImageUrls(next);
    return () => { created.forEach(u => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.map(s => s.sample?.id + ':' + (s.sample?.imageBlob ? '1' : '0')).join('|')]);

  useEffect(() => () => {
    if (previewRef.current) {
      try { previewRef.current.pause(); } catch {}
      previewRef.current = null;
    }
  }, []);

  const previewSlot = (sample: StoredSample | null) => {
    if (!sample) return;
    if (previewRef.current) {
      try { previewRef.current.pause(); } catch {}
    }
    const url = URL.createObjectURL(sample.blob);
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, volume));
    a.onended = () => URL.revokeObjectURL(url);
    a.play().catch(() => {});
    previewRef.current = a;
  };

  const slotByIndex = (index: number) => slots[index];

  const assignAudio = async (index: number, file: File) => {
    setBusyIndex(index);
    try {
      const detected = await detectPitchFromBlob(file);
      // Snap the detected pitch into the bass register (E1=28 .. E3=52).
      // Detectors often latch onto a sub-harmonic for low notes — without
      // this, samples can play back 1–2 octaves too high.
      let snapped: number | undefined = detected?.midi;
      if (typeof snapped === 'number') {
        while (snapped < 28) snapped += 12;
        while (snapped > 52) snapped -= 12;
      }
      const slot = slotByIndex(index);
      // Carry over any existing artwork on this slot to the new sample.
      const existing = slot.sample;
      const carryImage = existing?.imageBlob
        ? { imageBlob: existing.imageBlob, imageMime: existing.imageMime }
        : {};
      await lib.setSlotIndexedSample('bass', index, file, {
        pitch: snapped,
        kit: slot.kit,
        ...carryImage,
      });
    } finally {
      setBusyIndex(null);
    }
  };

  const assignImage = async (index: number, file: File) => {
    const slot = slotByIndex(index);
    const existing = slot.sample;
    if (existing) {
      await lib.updateSample(existing.id, { imageBlob: file, imageMime: file.type || 'image/png' });
    } else {
      // eslint-disable-next-line no-console
      console.warn('[bass slot] image dropped on empty slot — drop a .wav first');
    }
  };

  const handleFiles = async (index: number, files: FileList | File[]) => {
    const arr = Array.from(files);
    const audio = arr.find(isAudioFile);
    const image = arr.find(isImageFile);
    if (audio) await assignAudio(index, audio);
    if (image) {
      if (audio || slots[index].sample) await assignImage(index, image);
    }
  };

  const handleDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    if (!e.dataTransfer.files?.length) return;
    await handleFiles(index, e.dataTransfer.files);
  };

  return (
    <div className="px-3 py-2 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
          Bass slots · per-kit
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">
          drop .wav + .png
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {slots.map(({ index, kit, label, sample }) => {
          const isOver = dragOverIndex === index;
          const isBusy = busyIndex === index;
          const imageUrl = sample ? imageUrls[sample.id] : undefined;
          const noteName =
            typeof sample?.pitch === 'number' ? midiToName(sample.pitch) : null;
          return (
            <div
              key={kit}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
              onDragLeave={() => setDragOverIndex(o => (o === index ? null : o))}
              onDrop={(e) => handleDrop(e, index)}
              className={`group relative rounded-md border transition-colors overflow-hidden flex flex-col ${
                isOver
                  ? 'border-primary bg-primary/10'
                  : sample
                    ? 'border-border bg-muted/30'
                    : 'border-dashed border-border bg-background/40'
              }`}
              style={sample ? { boxShadow: `inset 0 0 0 1px hsl(${sample.color} / 0.4)` } : undefined}
            >
              {/* Kit label header */}
              <div className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border bg-background/50 text-center">
                {label} bass
              </div>

              {/* Artwork area — drop zone for both audio + image. Click previews. */}
              <button
                type="button"
                onClick={() => previewSlot(sample)}
                className="relative w-full aspect-square bg-background/60 flex items-center justify-center"
                title={sample ? 'Preview sample' : `Drop a ${label} bass .wav here`}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={sample?.name ?? `${label} bass`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : sample ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: `hsl(${sample.color} / 0.18)` }}
                  >
                    <Music size={20} className="text-muted-foreground" />
                  </div>
                ) : (
                  <div className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider px-1 text-center">
                    Drop {label}<br/>.wav + .png
                  </div>
                )}
                {isBusy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <span className="text-[9px] font-mono uppercase text-muted-foreground">
                      Detecting…
                    </span>
                  </div>
                )}
                {/* Detected note badge */}
                {noteName && (
                  <span className="absolute top-1 left-1 text-[9px] font-mono uppercase tracking-widest px-1 py-0.5 rounded bg-background/80 text-foreground border border-border">
                    {noteName}
                  </span>
                )}
              </button>

              {/* Footer: name + small action buttons */}
              <div className="px-1.5 py-1 flex items-center gap-1 border-t border-border bg-background/60">
                <span className="text-[9px] font-mono text-foreground truncate flex-1" title={sample?.name}>
                  {sample?.name ?? '—'}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); audioInputRefs.current[index]?.click(); }}
                  title="Upload .wav"
                  className="text-muted-foreground hover:text-foreground p-0.5"
                >
                  <Upload size={10} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); imageInputRefs.current[index]?.click(); }}
                  title="Upload .png artwork"
                  className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-30"
                  disabled={!sample}
                >
                  <ImagePlus size={10} />
                </button>
                {sample && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); lib.removeSample(sample.id); }}
                    title="Remove"
                    className="text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>

              <input
                ref={(el) => { audioInputRefs.current[index] = el; }}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.m4a,.aiff,.aif,.flac"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await assignAudio(index, f);
                  if (e.target) e.target.value = '';
                }}
              />
              <input
                ref={(el) => { imageInputRefs.current[index] = el; }}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await assignImage(index, f);
                  if (e.target) e.target.value = '';
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="text-[9px] font-mono text-muted-foreground italic mt-2 leading-snug">
        Each slot is locked to a bass kit. Pitches are detected automatically;
        the active kit's slot is used at playback (closest pitch is shifted to
        each note).
      </div>
    </div>
  );
}
