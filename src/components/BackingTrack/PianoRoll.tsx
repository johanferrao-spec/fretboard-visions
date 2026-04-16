import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Minus } from 'lucide-react';
import type { MidiNote, TrackId } from '@/lib/backingTrackTypes';
import { TRACK_COLORS, TRACK_LABELS, DRUM_PITCHES } from '@/lib/backingTrackTypes';

interface PianoRollProps {
  trackId: TrackId;
  notes: MidiNote[];
  measures: number;
  currentBeat: number;
  isPlaying: boolean;
  onChange: (notes: MidiNote[]) => void;
  onClose: () => void;
}

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlackKey = (pitch: number) => [1, 3, 6, 8, 10].includes(pitch % 12);
const pitchLabel = (p: number) => `${NOTE_LETTERS[p % 12]}${Math.floor(p / 12) - 1}`;

const DRUM_LABELS: Record<number, string> = {
  [DRUM_PITCHES.kick]: 'Kick',
  [DRUM_PITCHES.snare]: 'Snare',
  [DRUM_PITCHES.hihat]: 'Hi-Hat',
  [DRUM_PITCHES.ride]: 'Ride',
  [DRUM_PITCHES.tom]: 'Tom',
};

let nextNoteId = 1;
const newNoteId = () => `pr-${Date.now()}-${nextNoteId++}`;

export default function PianoRoll({ trackId, notes, measures, currentBeat, isPlaying, onChange, onClose }: PianoRollProps) {
  const [snap, setSnap] = useState<1 | 0.5 | 0.25>(0.25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const [size, setSize] = useState({ width: 800, height: 420 });
  const [minimized, setMinimized] = useState(false);
  const dragRef = useRef<{ kind: 'window' | 'note' | 'resize-note' | 'resize-window' | null; offsetX: number; offsetY: number; noteId?: string; origStart?: number; origPitch?: number; origDuration?: number } | null>(null);

  const totalBeats = measures * 4;
  const color = TRACK_COLORS[trackId];

  // Pitch range
  const isDrums = trackId === 'drums';
  const visiblePitches = isDrums
    ? [DRUM_PITCHES.kick, DRUM_PITCHES.snare, DRUM_PITCHES.hihat, DRUM_PITCHES.ride].sort((a, b) => b - a)
    : (() => {
        const range: number[] = [];
        for (let p = 84; p >= 36; p--) range.push(p);
        return range;
      })();

  const rowHeight = isDrums ? 28 : 14;
  const gridWidth = size.width - 80; // sidebar width

  const beatToX = (beat: number) => (beat / totalBeats) * gridWidth;
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
  };

  // Delete key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
          onChange(notes.filter(n => n.id !== selectedId));
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, notes, onChange]);

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
        <div className="w-20 border-r border-border overflow-y-auto bg-secondary/20 shrink-0" style={{ scrollbarWidth: 'none' }}>
          {visiblePitches.map(p => (
            <div
              key={p}
              className="border-b border-border/30 flex items-center px-2 text-[9px] font-mono"
              style={{
                height: rowHeight,
                backgroundColor: isDrums
                  ? 'transparent'
                  : isBlackKey(p) ? 'hsl(220, 15%, 12%)' : 'hsl(220, 15%, 18%)',
                color: isDrums ? 'hsl(var(--foreground))' : isBlackKey(p) ? 'hsl(220, 10%, 50%)' : 'hsl(220, 10%, 75%)',
              }}
            >
              {isDrums ? (DRUM_LABELS[p] || pitchLabel(p)) : pitchLabel(p)}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto relative" onClick={() => setSelectedId(null)}>
          <div
            className="relative"
            style={{ width: gridWidth, height: visiblePitches.length * rowHeight, minWidth: '100%' }}
            onDoubleClick={handleGridDoubleClick}
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
              const isSel = selectedId === n.id;
              return (
                <div
                  key={n.id}
                  className="absolute rounded-sm cursor-grab active:cursor-grabbing group"
                  style={{
                    left: beatToX(n.startBeat),
                    top: rowIdx * rowHeight + 1,
                    width: Math.max(6, beatToX(n.duration)),
                    height: rowHeight - 2,
                    backgroundColor: `hsl(${color} / ${0.6 + (n.velocity / 127) * 0.4})`,
                    border: isSel ? '2px solid hsl(var(--primary))' : `1px solid hsl(${color})`,
                    boxShadow: isSel ? '0 0 6px hsl(var(--primary) / 0.7)' : `0 0 2px hsl(${color} / 0.5)`,
                    zIndex: isSel ? 5 : 2,
                  }}
                  onMouseDown={(e) => handleNoteMouseDown(e, n, 'move')}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); }}
                >
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
                    onMouseDown={(e) => handleNoteMouseDown(e, n, 'resize')}
                  />
                </div>
              );
            })}
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
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%)',
        }}
        onMouseDown={(e) => {
          dragRef.current = { kind: 'resize-window', offsetX: 0, offsetY: 0 };
          e.stopPropagation();
          e.preventDefault();
        }}
      />
    </div>
  );
}
