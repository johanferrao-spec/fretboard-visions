import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Music, Upload } from 'lucide-react';
import type { DrumPart } from '@/lib/backingTrackTypes';
import type { Genre } from '@/hooks/useSongTimeline';
import { useSampleLibrary, type SlotKey, type SampleListEntry } from '@/hooks/useSampleLibrary';
import {
  KIT_COLORS,
  KIT_CYMBAL_COLORS,
  KIT_PARTS,
  CYMBAL_PARTS,
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
  hihat: 'Hi-Hat',
  ride: 'Ride',
  tom1: 'Tom 1',
  tom2: 'Tom 2',
  crash: 'Crash',
};

const DRUM_KITS: DrumKitGenre[] = ['Funk', 'Jazz', 'Rock', 'Latin'];

/** Map a song genre to its closest drum-kit genre (Pop falls back to Rock). */
function songGenreToKit(g: Genre): DrumKitGenre {
  return (g === 'Pop' ? 'Rock' : g) as DrumKitGenre;
}

type KeysVariant = 'upright' | 'electric' | 'synth' | 'organ' | 'sampler';
const KEYS_OPTIONS: { id: KeysVariant; label: string }[] = [
  { id: 'upright', label: 'Upright Piano' },
  { id: 'electric', label: 'Electric Piano' },
  { id: 'synth', label: 'Synthesiser' },
  { id: 'organ', label: 'Organ' },
  { id: 'sampler', label: 'Sampler' },
];
const KEYS_VARIANT_KEY = 'mf-keys-variant';

export default function InstrumentSamplers({ volume, genre }: Props) {
  const lib = useSampleLibrary();
  const [selection, setSelection] = useState<Selection>({ instrument: 'drums', part: 'snare' });
  const [dragOver, setDragOver] = useState<SlotKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  /** Keys icon variant — user choice, persisted per-browser (not genre-driven). */
  const [keysVariant, setKeysVariant] = useState<KeysVariant>(() => {
    try {
      const v = localStorage.getItem(KEYS_VARIANT_KEY) as KeysVariant | null;
      return v && KEYS_OPTIONS.some(o => o.id === v) ? v : 'upright';
    } catch { return 'upright'; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEYS_VARIANT_KEY, keysVariant); } catch {}
  }, [keysVariant]);

  /** Pending file dropped on a drum slot — awaiting kit choice from the dialog. */
  const [pendingDrop, setPendingDrop] = useState<{ slot: SlotKey; file: File } | null>(null);

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
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/^audio\//.test(file.type) && !/\.(wav|mp3|ogg|m4a|aiff?)$/i.test(file.name)) return;

    if (dropSlot.startsWith('drums:')) {
      // Drum drop → ask which kit to save under before storing.
      setPendingDrop({ slot: dropSlot, file });
      return;
    }
    // Bass / Keys: no kit needed.
    await lib.addSample(dropSlot, file);
    setSelection({ instrument: dropSlot as 'bass' | 'keys' });
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

  const previewSample = (entry: SampleListEntry) => {
    if (entry.kind !== 'user' || !entry.userSample) return;
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.src = '';
    }
    const url = URL.createObjectURL(entry.userSample.blob);
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, volume));
    a.play().catch(() => {});
    a.onended = () => URL.revokeObjectURL(url);
    previewRef.current = a;
  };

  useEffect(() => () => {
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current = null;
    }
  }, []);

  // ── Drum SVG helpers (top-down view) ──────────────────────────────
  const STROKE_DEFAULT = 'hsl(220 10% 50%)';
  const DEFAULT_FILL = 'hsl(220 12% 28%)';
  const partFill = (part: DrumPart) => {
    const tint = partTints[part];
    return tint ? `hsl(${tint})` : DEFAULT_FILL;
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
    onClick: () => setSelection({ instrument: 'drums', part }),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(`drums:${part}` as SlotKey); },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => handleDrop(e, `drums:${part}` as SlotKey),
    style: { cursor: 'pointer' as const },
  });

  const bassKit = songGenreToKit(genre);

  return (
    <div className="flex h-full bg-card border-t border-border overflow-hidden">
      {/* LEFT COLUMN: per-piece header + sample list (no part-icon grid) */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
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

        {/* Sample list for the active slot */}
        <div className="flex-1 overflow-y-auto">
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
                onClick={() => lib.selectSample(slot, s.id)}
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

        {/* Quick "apply whole kit" buttons */}
        {selection.instrument === 'drums' && (
          <div className="px-2 py-2 border-t border-border">
            <div className="text-[9px] font-mono uppercase text-muted-foreground mb-1">Apply kit</div>
            <div className="grid grid-cols-4 gap-1">
              {DRUM_KITS.map(kit => (
                <button
                  key={kit}
                  onClick={() => lib.applyKitForAllParts(kit)}
                  className="text-[9px] font-mono uppercase rounded py-1 border border-border hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: `hsl(${KIT_COLORS[kit]} / 0.3)`, color: 'hsl(var(--foreground))' }}
                  title={`Set every drum to the ${kit} kit`}
                >
                  {kit}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CENTER + RIGHT: vector art for all three instruments */}
      <div className="flex-1 flex items-stretch justify-around gap-3 p-3 overflow-x-auto">
        {/* DRUM KIT — top-down view */}
        <div className="flex flex-col items-center min-w-[320px] flex-1">
          <svg viewBox="0 0 320 220" className="w-full h-full max-h-[200px]">
            {/* KICK — back-centre, large drum sitting behind the rack tom.
                Rendered FIRST so the rack tom and snare overlap on top of it
                (matches the reference: kick is partially hidden under the toms). */}
            <g {...partProps('kick')}>
              <circle cx="160" cy="105" r="52" fill={partFill('kick')} stroke={partStroke('kick')} strokeWidth={partStrokeWidth('kick')} />
              {/* tension lugs around the rim */}
              {[0,1,2,3,4,5,6,7,8,9].map(i => {
                const ang = (i * Math.PI) / 5 - Math.PI / 2;
                const x = 160 + Math.cos(ang) * 52;
                const y = 105 + Math.sin(ang) * 52;
                return <rect key={i} x={x-3} y={y-2} width="6" height="4" fill="hsl(220 10% 25%)" />;
              })}
            </g>

            {/* Crash (top-left, large cymbal) — drawn over the kick */}
            <g {...partProps('crash')}>
              <circle cx="55" cy="55" r="42" fill={partFill('crash')} stroke={partStroke('crash')} strokeWidth={partStrokeWidth('crash')} />
              {[34, 26, 18, 10].map(r => (
                <circle key={r} cx="55" cy="55" r={r} fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.8" />
              ))}
              <circle cx="55" cy="55" r="2" fill="hsl(220 10% 12%)" />
            </g>

            {/* Ride (top-right, large cymbal) */}
            <g {...partProps('ride')}>
              <circle cx="265" cy="55" r="44" fill={partFill('ride')} stroke={partStroke('ride')} strokeWidth={partStrokeWidth('ride')} />
              {[36, 28, 20, 12].map(r => (
                <circle key={r} cx="265" cy="55" r={r} fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.8" />
              ))}
              <circle cx="265" cy="55" r="2" fill="hsl(220 10% 12%)" />
            </g>

            {/* Rack tom — mounted on top of the kick, slightly left of centre */}
            <g {...partProps('tom1')}>
              <circle cx="135" cy="115" r="28" fill={partFill('tom1')} stroke={partStroke('tom1')} strokeWidth={partStrokeWidth('tom1')} />
              <circle cx="135" cy="115" r="20" fill="none" stroke="hsl(220 10% 25% / 0.4)" strokeWidth="0.6" />
              <circle cx="135" cy="115" r="2" fill="hsl(220 10% 12%)" />
              {[0,1,2,3,4,5,6,7].map(i => {
                const ang = (i * Math.PI) / 4;
                const x = 135 + Math.cos(ang) * 28;
                const y = 115 + Math.sin(ang) * 28;
                return <rect key={i} x={x-2} y={y-1.5} width="4" height="3" fill="hsl(220 10% 30%)" />;
              })}
            </g>

            {/* Hi-hat pedal cymbal (small, between snare and kick at the front) */}
            <g {...partProps('hihat')}>
              <circle cx="155" cy="200" r="10" fill={partFill('hihat')} stroke={partStroke('hihat')} strokeWidth={partStrokeWidth('hihat')} />
              <rect x="151" y="200" width="8" height="18" fill="hsl(220 10% 25%)" opacity="0.6" />
              <line x1="148" y1="200" x2="162" y2="200" stroke="hsl(220 10% 15%)" strokeWidth="0.6" />
            </g>

            {/* Snare (front-left, with hi-hat stand symbolised by the small left cymbal stack) */}
            <g {...partProps('snare')}>
              <circle cx="80" cy="165" r="34" fill={partFill('snare')} stroke={partStroke('snare')} strokeWidth={partStrokeWidth('snare')} />
              <circle cx="80" cy="165" r="26" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.7" />
              <circle cx="80" cy="165" r="2" fill="hsl(220 10% 12%)" />
              {[0,1,2,3,4,5,6,7,8,9].map(i => {
                const ang = (i * Math.PI) / 5;
                const x = 80 + Math.cos(ang) * 34;
                const y = 165 + Math.sin(ang) * 34;
                return <rect key={i} x={x-2} y={y-1.5} width="4" height="3" fill="hsl(220 10% 30%)" />;
              })}
            </g>

            {/* Floor tom (front-right, largest of the toms) — re-uses the tom2 slot */}
            <g {...partProps('tom2')}>
              <circle cx="245" cy="165" r="42" fill={partFill('tom2')} stroke={partStroke('tom2')} strokeWidth={partStrokeWidth('tom2')} />
              <circle cx="245" cy="165" r="32" fill="none" stroke="hsl(220 10% 25% / 0.4)" strokeWidth="0.7" />
              <circle cx="245" cy="165" r="3" fill="hsl(220 10% 12%)" />
              {[0,1,2,3,4,5,6,7,8,9].map(i => {
                const ang = (i * Math.PI) / 5;
                const x = 245 + Math.cos(ang) * 42;
                const y = 165 + Math.sin(ang) * 42;
                return <rect key={i} x={x-2.5} y={y-2} width="5" height="4" fill="hsl(220 10% 30%)" />;
              })}
            </g>
          </svg>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Drums (top view)</div>
        </div>

        {/* BASS — genre-specific icon */}
        <div
          className={`flex flex-col items-center min-w-[110px] rounded-md transition-colors ${dragOver === 'bass' ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
          onClick={() => setSelection({ instrument: 'bass' })}
          onDragOver={(e) => { e.preventDefault(); setDragOver('bass'); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, 'bass')}
          style={{ cursor: 'pointer' }}
        >
          <BassIcon
            kit={bassKit}
            active={!!bassActive}
            color={bassActive?.color}
            selected={selection.instrument === 'bass'}
          />
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
            Bass · {bassKit}
          </div>
        </div>

        {/* KEYS — user-chosen icon variant */}
        <div
          className={`flex flex-col items-center min-w-[180px] rounded-md transition-colors ${dragOver === 'keys' ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
          onClick={() => setSelection({ instrument: 'keys' })}
          onDragOver={(e) => { e.preventDefault(); setDragOver('keys'); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, 'keys')}
          style={{ cursor: 'pointer' }}
        >
          <KeysIcon
            variant={keysVariant}
            active={!!keysActive}
            color={keysActive?.color}
            selected={selection.instrument === 'keys'}
          />
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
  return 'hsl(0 65% 45%)'; // rock — fiesta red
}

/** Fender Precision — slab body, single split-coil pickup, large headstock. */
function PrecisionBass({ body, accent, stroke, sw }: { body: string; accent: string; stroke: string; sw: number }) {
  return (
    <svg viewBox="0 0 100 200" className="h-full max-h-[200px]">
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
    <svg viewBox="0 0 100 200" className="h-full max-h-[200px]">
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
    <svg viewBox="0 0 100 200" className="h-full max-h-[200px]">
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
    <svg viewBox="0 0 100 200" className="h-full max-h-[200px]">
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
    case 'organ':    return <OrganIcon tint={tint} stroke={stroke} sw={sw} />;
    case 'sampler':  return <SamplerIcon tint={tint} stroke={stroke} sw={sw} />;
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
