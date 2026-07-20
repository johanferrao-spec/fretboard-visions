import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Minus, ZoomIn } from 'lucide-react';

import type { MidiNote, TrackId, DrumPart } from '@/lib/backingTrackTypes';
import { TRACK_COLORS, TRACK_LABELS, DRUM_PITCHES } from '@/lib/backingTrackTypes';
import { useSharedSampleLibrary } from '@/hooks/SampleLibraryContext';
import {
  KIT_COLORS,
  KIT_CYMBAL_COLORS,
  CYMBAL_PARTS,
  type DrumKitGenre,
} from '@/lib/builtInKits';

interface PianoRollProps {
  trackId: TrackId;
  notes: MidiNote[];
  measures: number;
  currentBeat: number;
  isPlaying: boolean;
  /** Swing % 0-100 — visualizes how offbeat 8ths are pushed toward triplet feel. */
  swing?: number;
  onChange: (notes: MidiNote[]) => void;
  onClose: () => void;
  /** Optional preview callback — when provided, clicking/adding a note plays it. */
  onPreviewNote?: (trackId: TrackId, pitch: number, velocity: number) => void;
}


const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlackKey = (pitch: number) => [1, 3, 6, 8, 10].includes(pitch % 12);
const pitchLabel = (p: number) => `${NOTE_LETTERS[p % 12]}${Math.floor(p / 12) - 1}`;

const PITCH_TO_PART: Record<number, DrumPart> = {
  [DRUM_PITCHES.kick]: 'kick',
  [DRUM_PITCHES.snare]: 'snare',
  [DRUM_PITCHES.hihat_closed]: 'hihat_closed',
  [DRUM_PITCHES.hihat_pedal]: 'hihat_pedal',
  [DRUM_PITCHES.hihat_open]: 'hihat_open',
  [DRUM_PITCHES.ride]: 'ride',
  [DRUM_PITCHES.crash]: 'crash',
  [DRUM_PITCHES.tom1]: 'tom1',
  [DRUM_PITCHES.tom3]: 'tom3',
  [DRUM_PITCHES.tom2]: 'tom2',
};

const DRUM_LABELS: Record<number, string> = {
  [DRUM_PITCHES.kick]: 'Kick',
  [DRUM_PITCHES.snare]: 'Snare',
  [DRUM_PITCHES.hihat_closed]: 'Closed Hat',
  [DRUM_PITCHES.hihat_pedal]: 'Pedal Hat',
  [DRUM_PITCHES.hihat_open]: 'Open Hat',
  [DRUM_PITCHES.ride]: 'Ride',
  [DRUM_PITCHES.crash]: 'Crash',
  [DRUM_PITCHES.tom1]: 'Rack Tom 1',
  [DRUM_PITCHES.tom3]: 'Rack Tom 2',
  [DRUM_PITCHES.tom2]: 'Floor Tom',
};

/** Small kit-piece icon (18x18) rendered next to each drum row label. */
function DrumPartIcon({ part, kit }: { part: DrumPart; kit: DrumKitGenre | null }) {
  const shell = kit ? `hsl(${KIT_COLORS[kit]})` : 'hsl(220 10% 45%)';
  const cymbal = kit ? `hsl(${KIT_CYMBAL_COLORS[kit]})` : 'hsl(45 30% 55%)';
  const skin = 'hsl(45 40% 88%)';
  const stroke = 'hsl(220 15% 15%)';

  if (CYMBAL_PARTS.has(part)) {
    // Cymbal: side profile ellipse + stand
    const isOpen = part === 'hihat_open';
    const isPair = part === 'hihat_closed' || part === 'hihat_pedal';
    return (
      <svg viewBox="0 0 24 24" width={20} height={20}>
        {isPair && (
          <ellipse cx="12" cy={isOpen ? 8 : 10} rx="9" ry="1.6" fill={cymbal} stroke={stroke} strokeWidth="0.6" />
        )}
        <ellipse cx="12" cy={isPair ? 12 : 11} rx="10" ry={part === 'ride' || part === 'crash' ? 2.4 : 1.8} fill={cymbal} stroke={stroke} strokeWidth="0.6" />
        <circle cx="12" cy={isPair ? 12 : 11} r="0.9" fill={stroke} />
        <rect x="11.5" y={isPair ? 13 : 12} width="1" height="8" fill={stroke} />
      </svg>
    );
  }

  if (part === 'kick') {
    return (
      <svg viewBox="0 0 24 24" width={20} height={20}>
        <circle cx="12" cy="12" r="9" fill={shell} stroke={stroke} strokeWidth="0.8" />
        <circle cx="12" cy="12" r="6.5" fill={skin} stroke={stroke} strokeWidth="0.4" />
        <circle cx="12" cy="12" r="1.2" fill={stroke} />
      </svg>
    );
  }

  // Snare / toms — side view of a shell
  const isSnare = part === 'snare';
  const isFloor = part === 'tom2';
  const width = isFloor ? 18 : isSnare ? 20 : part === 'tom1' ? 16 : 17;
  const height = isFloor ? 16 : isSnare ? 10 : 13;
  const x = (24 - width) / 2;
  const y = (24 - height) / 2;
  return (
    <svg viewBox="0 0 24 24" width={20} height={20}>
      <rect x={x} y={y} width={width} height={height} rx="1.5" fill={shell} stroke={stroke} strokeWidth="0.6" />
      <ellipse cx="12" cy={y + 0.5} rx={width / 2} ry="1.4" fill={skin} stroke={stroke} strokeWidth="0.5" />
      {isSnare && (
        <line x1={x} y1={y + height - 1.5} x2={x + width} y2={y + height - 1.5} stroke={stroke} strokeWidth="0.4" />
      )}
    </svg>
  );
}


let nextNoteId = 1;
const newNoteId = () => `pr-${Date.now()}-${nextNoteId++}`;

export default function PianoRoll({ trackId, notes, measures, currentBeat, isPlaying, swing = 0, onChange, onClose, onPreviewNote }: PianoRollProps) {
  const [snap, setSnap] = useState<1 | 0.5 | 0.25>(0.25);
  const [zoom, setZoom] = useState(1); // 1× – 4× horizontal zoom
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const [size, setSize] = useState(() => ({
    width: 800,
    height: typeof window !== 'undefined' ? Math.max(320, window.innerHeight - 80 - 16) : 420,
  }));
  // Auto-fit height to the viewport bottom on mount + resize (until the user
  // manually resizes the window — resize handle sets a manual flag).
  const manualResizeRef = useRef(false);
  useEffect(() => {
    const fit = () => {
      if (manualResizeRef.current) return;
      setSize(s => ({ ...s, height: Math.max(320, window.innerHeight - pos.y - 16) }));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [pos.y]);

  const [minimized, setMinimized] = useState(false);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const dragRef = useRef<{ kind: 'window' | 'note' | 'resize-note' | 'resize-window' | 'marquee' | null; offsetX: number; offsetY: number; noteId?: string; origStart?: number; origPitch?: number; origDuration?: number; gridX?: number; gridY?: number } | null>(null);



  const totalBeats = measures * 4;
  const color = TRACK_COLORS[trackId];

  // Pitch range
  const isDrums = trackId === 'drums';
  const visiblePitches = isDrums
    ? [
        DRUM_PITCHES.crash,
        DRUM_PITCHES.ride,
        DRUM_PITCHES.hihat_open,
        DRUM_PITCHES.hihat_pedal,
        DRUM_PITCHES.hihat_closed,
        DRUM_PITCHES.tom1, // Rack Tom 1 (45)
        DRUM_PITCHES.tom3, // Rack Tom 2 (48)
        DRUM_PITCHES.tom2, // Floor Tom (47)
        DRUM_PITCHES.snare,
        DRUM_PITCHES.kick,
      ].sort((a, b) => b - a)
    : (() => {
        const range: number[] = [];
        for (let p = 84; p >= 36; p--) range.push(p);
        return range;
      })();

  // Look up the active kit per drum part (built-in kit id encoded as
  // `kit:<kit>:<part>`; user samples carry their own `.kit`).
  const library = useSharedSampleLibrary();
  const kitForPart = useMemo(() => {
    const map: Partial<Record<DrumPart, DrumKitGenre>> = {};
    if (!isDrums) return map;
    for (const [pitchStr, part] of Object.entries(PITCH_TO_PART)) {
      const slot = `drums:${part}`;
      const activeId = library.active?.[slot];
      if (!activeId) continue;
      if (activeId.startsWith('kit:')) {
        const kit = activeId.split(':')[1];
        const cap = kit ? (kit.charAt(0).toUpperCase() + kit.slice(1)) as DrumKitGenre : null;
        if (cap) map[part] = cap;
      } else {
        const sample = library.samples?.find(s => s.id === activeId);
        if (sample?.kit) map[part] = sample.kit as DrumKitGenre;
      }
    }
    return map;
  }, [isDrums, library.active, library.samples]);

  // Object-URL cache for user-dropped instrument icons keyed by
  // `drums:<part>|<Kit>` (matches InstrumentSamplers' key format).
  const iconUrlCacheRef = useRef<Map<string, { blob: Blob; url: string }>>(new Map());
  const iconUrls = useMemo(() => {
    const cache = iconUrlCacheRef.current;
    const out: Record<string, string> = {};
    const live = new Set<string>();
    for (const [key, icon] of Object.entries(library.instrumentIcons ?? {})) {
      if (!key.startsWith('drums:')) continue;
      live.add(key);
      const cached = cache.get(key);
      if (cached && cached.blob === icon.blob) {
        out[key] = cached.url;
      } else {
        if (cached) { try { URL.revokeObjectURL(cached.url); } catch { /* noop */ } }
        const url = URL.createObjectURL(icon.blob);
        cache.set(key, { blob: icon.blob, url });
        out[key] = url;
      }
    }
    for (const key of Array.from(cache.keys())) {
      if (!live.has(key)) {
        const entry = cache.get(key);
        if (entry) { try { URL.revokeObjectURL(entry.url); } catch { /* noop */ } }
        cache.delete(key);
      }
    }
    return out;
  }, [library.instrumentIcons]);
  useEffect(() => () => {
    const cache = iconUrlCacheRef.current;
    cache.forEach(({ url }) => { try { URL.revokeObjectURL(url); } catch { /* noop */ } });
    cache.clear();
  }, []);



  // Fill available vertical space so the last row sits flush with the window bottom.
  // Title bar ≈ 37px, footer ≈ 23px, borders ≈ 2px → reserve 62px of chrome.
  const CHROME_H = 62;
  const minRowH = isDrums ? 28 : 14;
  const rowHeight = Math.max(
    minRowH,
    Math.floor((size.height - CHROME_H) / visiblePitches.length),
  );
  const sidebarWidth = isDrums ? 108 : 80;
  const gridWidth = (size.width - sidebarWidth) * zoom;


  // Tone.Transport.swing is (swing/100) * 0.5 with subdivision '8n'.
  // The offbeat 8th is shifted from 0.5 toward 2/3 of the beat.
  // shiftedOffset = 0.5 + toneSwing * (2/3 - 0.5) = 0.5 + toneSwing/6.
  const toneSwing = Math.max(0, Math.min(1, swing / 100)) * 0.5;
  const swingedBeat = (beat: number) => {
    const whole = Math.floor(beat);
    const frac = beat - whole;
    // Only the mid-beat (offbeat 8th) shifts; other subdivisions ride along
    // linearly between anchor points 0, offbeat, 1 to preserve local grid feel.
    const off = 0.5 + toneSwing / 6;
    if (frac <= 0.5) return whole + (frac / 0.5) * off;
    return whole + off + ((frac - 0.5) / 0.5) * (1 - off);
  };
  const beatToX = (beat: number) => (swingedBeat(beat) / totalBeats) * gridWidth;
  const xToBeat = (x: number) => Math.max(0, Math.min(totalBeats, (x / gridWidth) * totalBeats));
  const snapBeat = (beat: number) => Math.round(beat / snap) * snap;


  // Window drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      if (d.kind === 'window') {
        setPos({ x: e.clientX - d.offsetX, y: Math.max(40, e.clientY - d.offsetY) });
      } else if (d.kind === 'resize-window') {
        setSize({
          width: Math.max(400, e.clientX - pos.x),
          height: Math.max(220, e.clientY - pos.y),
        });
      }
    };
    const onUp = () => { if (dragRef.current?.kind === 'window' || dragRef.current?.kind === 'resize-window') dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [pos]);

  // Note drag/resize
  const handleNoteMouseDown = (e: React.MouseEvent, n: MidiNote, mode: 'move' | 'resize') => {
    e.stopPropagation();
    setSelectedId(n.id);
    if (mode === 'move') onPreviewNote?.(trackId, n.pitch, n.velocity);
    dragRef.current = {
      kind: mode === 'move' ? 'note' : 'resize-note',
      offsetX: e.clientX,
      offsetY: e.clientY,
      noteId: n.id,
      origStart: n.startBeat,
      origPitch: n.pitch,
      origDuration: n.duration,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d || (d.kind !== 'note' && d.kind !== 'resize-note')) return;
      const dxPx = e.clientX - d.offsetX;
      const dyPx = e.clientY - d.offsetY;
      const dBeat = (dxPx / gridWidth) * totalBeats;
      onChange(notes.map(n => {
        if (n.id !== d.noteId) return n;
        if (d.kind === 'note') {
          const newStart = snapBeat(Math.max(0, Math.min(totalBeats - 0.1, (d.origStart || 0) + dBeat)));
          let newPitch = n.pitch;
          if (!isDrums) {
            const dRow = Math.round(dyPx / rowHeight);
            newPitch = Math.max(0, Math.min(127, (d.origPitch || n.pitch) - dRow));
          }
          return { ...n, startBeat: newStart, pitch: newPitch };
        } else {
          const newDur = Math.max(snap, snapBeat((d.origDuration || 0.25) + dBeat));
          return { ...n, duration: newDur };
        }
      }));
    };
    const onUp = () => {
      if (dragRef.current?.kind === 'note' || dragRef.current?.kind === 'resize-note') dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [notes, gridWidth, totalBeats, isDrums, rowHeight, snap, onChange]);

  // Add note on grid double-click
  const handleGridDoubleClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const beat = snapBeat(xToBeat(x));
    const rowIdx = Math.floor(y / rowHeight);
    const pitch = visiblePitches[rowIdx];
    if (pitch == null) return;
    const newNote: MidiNote = {
      id: newNoteId(),
      startBeat: beat,
      duration: snap === 1 ? 1 : snap === 0.5 ? 0.5 : 0.5,
      pitch,
      velocity: 80,
    };
    onChange([...notes, newNote]);
    setSelectedId(newNote.id);
    onPreviewNote?.(trackId, newNote.pitch, newNote.velocity);
  };

  // Marquee drag-select on the grid
  const handleGridMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Skip if started on a note (notes stop propagation in their own handlers)
    const target = e.target as HTMLElement;
    if (target.closest('[data-note-id]')) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragRef.current = { kind: 'marquee', offsetX: e.clientX, offsetY: e.clientY, gridX: rect.left, gridY: rect.top };
    setMarquee({ x1: x, y1: y, x2: x, y2: y });
    setSelectedId(null);
    setSelectedIds(new Set());
  };

  // Use a ref so the latest visiblePitches/notes are always read inside the
  // window-level mouseup handler (avoids stale-closure selection bugs).
  const marqueeStateRef = useRef({ notes, visiblePitches, rowHeight, gridWidth, totalBeats });
  marqueeStateRef.current = { notes, visiblePitches, rowHeight, gridWidth, totalBeats };
  const justFinishedMarqueeRef = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d || d.kind !== 'marquee') return;
      const x = e.clientX - (d.gridX ?? 0);
      const y = e.clientY - (d.gridY ?? 0);
      setMarquee(m => m ? { ...m, x2: x, y2: y } : null);
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d || d.kind !== 'marquee') return;
      dragRef.current = null;
      setMarquee(curr => {
        if (!curr) return null;
        const minX = Math.min(curr.x1, curr.x2);
        const maxX = Math.max(curr.x1, curr.x2);
        const minY = Math.min(curr.y1, curr.y2);
        const maxY = Math.max(curr.y1, curr.y2);
        const { notes: ns, visiblePitches: vps, rowHeight: rh, gridWidth: gw, totalBeats: tb } = marqueeStateRef.current;
        const beatToXLocal = (beat: number) => (beat / tb) * gw;
        const ids = new Set<string>();
        for (const n of ns) {
          const rowIdx = vps.indexOf(n.pitch);
          if (rowIdx < 0) continue;
          const nx1 = beatToXLocal(n.startBeat);
          const nx2 = beatToXLocal(n.startBeat + n.duration);
          const ny1 = rowIdx * rh;
          const ny2 = ny1 + rh;
          // Any intersection (touch counts) selects the note.
          if (nx1 <= maxX && nx2 >= minX && ny1 <= maxY && ny2 >= minY) {
            ids.add(n.id);
          }
        }
        setSelectedIds(ids);
        // Suppress the click that always follows mouseup so we don't immediately
        // clear the selection we just made.
        justFinishedMarqueeRef.current = true;
        setTimeout(() => { justFinishedMarqueeRef.current = false; }, 0);
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Delete key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
        if (inField) return;
        if (selectedIds.size > 0) {
          onChange(notes.filter(n => !selectedIds.has(n.id)));
          setSelectedIds(new Set());
          setSelectedId(null);
        } else if (selectedId) {
          onChange(notes.filter(n => n.id !== selectedId));
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedIds, notes, onChange]);


  if (minimized) {
    return (
      <div
        className="fixed z-50 bg-card border border-border rounded-md shadow-lg flex items-center gap-2 px-3 py-1.5 cursor-grab"
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={(e) => {
          dragRef.current = { kind: 'window', offsetX: e.clientX - pos.x, offsetY: e.clientY - pos.y };
        }}
      >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />
        <span className="text-[10px] font-mono uppercase">{TRACK_LABELS[trackId]} Piano Roll</span>
        <button onClick={() => setMinimized(false)} className="text-muted-foreground hover:text-foreground">
          <Minus size={12} className="rotate-90" />
        </button>
        <button onClick={onClose} className="text-muted-foreground hover:text-destructive">
          <X size={12} />
        </button>
      </div>
    );
  }

  const playPct = (currentBeat / totalBeats) * 100;

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden animate-fade-in"
      style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing select-none"
        style={{ backgroundColor: `hsl(${color} / 0.15)` }}
        onMouseDown={(e) => {
          dragRef.current = { kind: 'window', offsetX: e.clientX - pos.x, offsetY: e.clientY - pos.y };
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
            Piano Roll — {TRACK_LABELS[trackId]}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">{notes.length} notes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase text-muted-foreground">Snap</span>
          {([1, 0.5, 0.25] as const).map(s => (
            <button
              key={s}
              onClick={() => setSnap(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                snap === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'
              }`}
            >{s === 1 ? '1/4' : s === 0.5 ? '1/8' : '1/16'}</button>
          ))}
          <div className="flex items-center gap-1 pl-2 ml-1 border-l border-border/50" onMouseDown={(e) => e.stopPropagation()}>
            <ZoomIn size={11} className="text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={4}

              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-20 h-1 accent-primary cursor-pointer"
              title={`Zoom ${zoom.toFixed(1)}×`}
            />
            <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">{zoom.toFixed(1)}×</span>
          </div>

          <button onClick={() => setMinimized(true)} className="text-muted-foreground hover:text-foreground" title="Minimize">
            <Minus size={14} />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-destructive" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — pitch labels */}
        <div
          className="border-r border-border overflow-y-auto bg-secondary/20 shrink-0"
          style={{ width: sidebarWidth, scrollbarWidth: 'none' }}
        >
          {visiblePitches.map(p => {
            const part = PITCH_TO_PART[p];
            return (
              <div
                key={p}
                className="border-b border-border/30 flex items-center gap-1.5 px-2 text-[9px] font-mono"
                style={{
                  height: rowHeight,
                  backgroundColor: isDrums
                    ? 'transparent'
                    : isBlackKey(p) ? 'hsl(220, 15%, 12%)' : 'hsl(220, 15%, 18%)',
                  color: isDrums ? 'hsl(var(--foreground))' : isBlackKey(p) ? 'hsl(220, 10%, 50%)' : 'hsl(220, 10%, 75%)',
                }}
              >
                {isDrums && part && (() => {
                  const kit = kitForPart[part];
                  const url = kit ? iconUrls[`drums:${part}|${kit}`] : undefined;
                  return url ? (
                    <img
                      src={url}
                      alt=""
                      draggable={false}
                      style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }}
                    />
                  ) : (
                    <DrumPartIcon part={part} kit={kit ?? null} />
                  );
                })()}

                <span className="truncate">{isDrums ? (DRUM_LABELS[p] || pitchLabel(p)) : pitchLabel(p)}</span>
              </div>
            );
          })}
        </div>


        {/* Grid */}
        <div className="flex-1 overflow-auto relative" onClick={() => { if (justFinishedMarqueeRef.current) return; setSelectedId(null); setSelectedIds(new Set()); }}>
          <div
            className="relative"
            style={{ width: gridWidth, height: visiblePitches.length * rowHeight, minWidth: '100%' }}
            onDoubleClick={handleGridDoubleClick}
            onMouseDown={handleGridMouseDown}
          >
            {/* Row backgrounds */}
            {visiblePitches.map((p, i) => (
              <div
                key={p}
                className="absolute left-0 right-0 border-b border-border/20"
                style={{
                  top: i * rowHeight,
                  height: rowHeight,
                  backgroundColor: isDrums
                    ? (i % 2 === 0 ? 'hsl(220, 15%, 14%)' : 'hsl(220, 15%, 16%)')
                    : isBlackKey(p) ? 'hsl(220, 15%, 13%)' : 'hsl(220, 15%, 16%)',
                }}
              />
            ))}
            {/* Beat lines */}
            {Array.from({ length: totalBeats + 1 }, (_, b) => (
              <div
                key={b}
                className="absolute top-0 bottom-0"
                style={{
                  left: beatToX(b),
                  borderLeft: b % 4 === 0 ? '1.5px solid hsl(220, 15%, 35%)' : '1px solid hsl(220, 15%, 22%)',
                }}
              />
            ))}
            {/* Sub-beat lines */}
            {snap < 1 && Array.from({ length: Math.round(totalBeats / snap) }, (_, i) => {
              const beat = i * snap;
              if (beat % 1 === 0) return null;
              return (
                <div
                  key={`sub-${i}`}
                  className="absolute top-0 bottom-0"
                  style={{ left: beatToX(beat), borderLeft: '1px dashed hsl(220, 15%, 18%)' }}
                />
              );
            })}
            {/* Notes */}
            {notes.map(n => {
              const rowIdx = visiblePitches.indexOf(n.pitch);
              if (rowIdx < 0) return null;
              const isSel = selectedId === n.id || selectedIds.has(n.id);
              const velFrac = Math.max(0.28, Math.min(1, n.velocity / 127));
              const maxNoteH = rowHeight - 2;
              const noteH = Math.max(4, maxNoteH * velFrac);
              const noteTop = rowIdx * rowHeight + 1 + (maxNoteH - noteH) / 2;
              return (
                <div
                  key={n.id}
                  data-note-id={n.id}
                  className="absolute rounded-sm cursor-grab active:cursor-grabbing group"
                  style={{
                    left: beatToX(n.startBeat),
                    top: noteTop,
                    width: Math.max(6, beatToX(n.startBeat + n.duration) - beatToX(n.startBeat)),

                    height: noteH,
                    backgroundColor: `hsl(${color} / ${0.6 + (n.velocity / 127) * 0.4})`,
                    border: isSel ? '2px solid hsl(var(--primary))' : `1px solid hsl(${color})`,
                    boxShadow: isSel ? '0 0 6px hsl(var(--primary) / 0.7)' : `0 0 2px hsl(${color} / 0.5)`,
                    zIndex: isSel ? 5 : 2,
                  }}
                  onMouseDown={(e) => handleNoteMouseDown(e, n, 'move')}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); setSelectedIds(new Set()); }}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
                    onMouseDown={(e) => handleNoteMouseDown(e, n, 'resize')}
                  />
                </div>
              );
            })}
            {/* Marquee selection rectangle */}
            {marquee && (
              <div
                className="absolute pointer-events-none border-2 border-primary"
                style={{
                  left: Math.min(marquee.x1, marquee.x2),
                  top: Math.min(marquee.y1, marquee.y2),
                  width: Math.abs(marquee.x2 - marquee.x1),
                  height: Math.abs(marquee.y2 - marquee.y1),
                  backgroundColor: 'hsl(var(--primary) / 0.15)',
                  zIndex: 6,
                }}
              />
            )}
            {/* Playhead */}
            {(isPlaying || currentBeat > 0) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none"
                style={{
                  left: `${playPct}%`,
                  backgroundColor: 'hsl(var(--primary))',
                  boxShadow: '0 0 4px hsl(var(--primary))',
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-border flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
        <span>Double-click empty grid to add</span>
        <span>•</span>
        <span>Drag to move</span>
        <span>•</span>
        <span>Drag right edge to resize</span>
        <span>•</span>
        <span>Delete key removes selected</span>
      </div>

      {/* Resize corner */}
      {/* Resize corner — invisible but still draggable */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={(e) => {
          manualResizeRef.current = true;
          dragRef.current = { kind: 'resize-window', offsetX: 0, offsetY: 0 };

          e.stopPropagation();
          e.preventDefault();
        }}
      />
    </div>
  );
}
