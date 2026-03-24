import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Square, Trash2, Settings, Music, GripVertical } from 'lucide-react';
import type { TimelineChord, SnapValue, Genre } from '@/hooks/useSongTimeline';
import type { NoteName } from '@/lib/music';
import { NOTE_NAMES, CHORD_FORMULAS } from '@/lib/music';

interface SongTimelineProps {
  chords: TimelineChord[];
  measures: number;
  setMeasures: (v: number) => void;
  bpm: number;
  setBpm: (v: number) => void;
  genre: Genre;
  setGenre: (v: Genre) => void;
  snap: SnapValue;
  setSnap: (v: SnapValue) => void;
  isPlaying: boolean;
  currentBeat: number;
  panelHeight: number;
  setPanelHeight: (v: number) => void;
  onPlay: () => void;
  onStop: () => void;
  onAddChord: (root: NoteName, chordType: string, startBeat: number, duration?: number) => string;
  onMoveChord: (id: string, newStartBeat: number) => void;
  onResizeChord: (id: string, newDuration: number) => void;
  onRemoveChord: (id: string) => void;
  onClearTimeline: () => void;
}

// Chord colors based on root note
const ROOT_COLORS: Record<string, string> = {
  C: '0, 85%, 60%', 'C#': '20, 85%, 55%',
  D: '45, 90%, 55%', 'D#': '60, 80%, 50%',
  E: '120, 70%, 45%', F: '160, 75%, 45%',
  'F#': '185, 80%, 50%', G: '210, 85%, 55%',
  'G#': '240, 75%, 60%', A: '270, 80%, 60%',
  'A#': '310, 80%, 55%', B: '340, 85%, 58%',
};

export default function SongTimeline({
  chords, measures, setMeasures, bpm, setBpm,
  genre, setGenre, snap, setSnap,
  isPlaying, currentBeat, panelHeight, setPanelHeight,
  onPlay, onStop, onAddChord, onMoveChord, onResizeChord, onRemoveChord, onClearTimeline,
}: SongTimelineProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragChord, setDragChord] = useState<string | null>(null);
  const [resizeChord, setResizeChord] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [resizingPanel, setResizingPanel] = useState(false);
  const resizeStartRef = useRef<{ y: number; height: number }>({ y: 0, height: 220 });

  const totalBeats = measures * 4;
  const snapGrid = snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25;

  const getBeatFromX = useCallback((clientX: number): number => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const rawBeat = (x / rect.width) * totalBeats;
    return Math.max(0, Math.min(totalBeats - snapGrid, Math.round(rawBeat / snapGrid) * snapGrid));
  }, [totalBeats, snapGrid]);

  // Panel resize
  useEffect(() => {
    if (!resizingPanel) return;
    const onMove = (e: MouseEvent) => {
      const dy = resizeStartRef.current.y - e.clientY;
      setPanelHeight(Math.max(140, Math.min(500, resizeStartRef.current.height + dy)));
    };
    const onUp = () => setResizingPanel(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizingPanel, setPanelHeight]);

  // Drag move
  useEffect(() => {
    if (!dragChord) return;
    const onMove = (e: MouseEvent) => {
      const beat = getBeatFromX(e.clientX);
      onMoveChord(dragChord, beat);
    };
    const onUp = () => setDragChord(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragChord, getBeatFromX, onMoveChord]);

  // Resize chord
  useEffect(() => {
    if (!resizeChord) return;
    const chord = chords.find(c => c.id === resizeChord);
    if (!chord) return;
    const onMove = (e: MouseEvent) => {
      const beat = getBeatFromX(e.clientX);
      const newDur = beat - chord.startBeat;
      if (newDur >= snapGrid) onResizeChord(resizeChord, newDur);
    };
    const onUp = () => setResizeChord(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizeChord, chords, getBeatFromX, onResizeChord, snapGrid]);

  // Handle drop from chord library (via data transfer)
  const handleGridDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/chord');
    if (!data) return;
    try {
      const { root, chordType } = JSON.parse(data);
      const beat = getBeatFromX(e.clientX);
      onAddChord(root, chordType, beat, snap === '1/4' ? 2 : snap === '1/8' ? 1 : 0.5);
    } catch {}
  }, [getBeatFromX, onAddChord, snap]);

  const handleGridDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Double-click to add chord
  const handleGridDoubleClick = useCallback((e: React.MouseEvent) => {
    const beat = getBeatFromX(e.clientX);
    onAddChord('C', 'Major', beat, snap === '1/4' ? 2 : snap === '1/8' ? 1 : 0.5);
  }, [getBeatFromX, onAddChord, snap]);

  const playheadPct = (currentBeat / totalBeats) * 100;

  return (
    <div
      className="border-t border-border bg-card flex flex-col shrink-0"
      style={{ height: 160 }}
    >

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <button
          onClick={isPlaying ? onStop : onPlay}
          className={`p-1.5 rounded-md transition-colors ${
            isPlaying
              ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
              : 'bg-primary/20 text-primary hover:bg-primary/30'
          }`}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
        </button>

        <div className="flex items-center gap-1">
          <Music size={12} className="text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase">BPM</span>
          <input
            type="number"
            value={bpm}
            onChange={e => setBpm(Math.max(40, Math.min(300, Number(e.target.value))))}
            className="w-12 bg-secondary text-foreground text-[10px] font-mono rounded px-1 py-0.5 border border-border text-center"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Genre</span>
          <select
            value={genre}
            onChange={e => setGenre(e.target.value as Genre)}
            className="bg-secondary text-secondary-foreground text-[10px] font-mono uppercase rounded px-1.5 py-0.5 border border-border"
          >
            <option value="Rock">Rock</option>
            <option value="Pop">Pop</option>
            <option value="Jazz">Jazz</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Snap</span>
          {(['1/4', '1/8', '1/16'] as SnapValue[]).map(s => (
            <button
              key={s}
              onClick={() => setSnap(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                snap === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >{s}</button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Bars</span>
          <input
            type="number"
            value={measures}
            onChange={e => setMeasures(Math.max(1, Math.min(32, Number(e.target.value))))}
            className="w-10 bg-secondary text-foreground text-[10px] font-mono rounded px-1 py-0.5 border border-border text-center"
          />
        </div>

        <button
          onClick={onClearTimeline}
          className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Clear timeline"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Timeline grid */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        {/* Measure labels */}
        <div className="flex items-center" style={{ minWidth: `${measures * 200}px` }}>
          <div className="w-0" />
          {Array.from({ length: measures }, (_, m) => (
            <div key={m} className="flex-1 text-center border-l border-border/50 first:border-l-0">
              <span className="text-[9px] font-mono text-muted-foreground">{m + 1}</span>
            </div>
          ))}
        </div>

        {/* Grid area */}
        <div
          ref={gridRef}
          className="relative flex-1 bg-secondary/20 border-t border-border/30"
          style={{ minWidth: `${measures * 200}px`, height: `calc(100% - 24px)` }}
          onDrop={handleGridDrop}
          onDragOver={handleGridDragOver}
          onDoubleClick={handleGridDoubleClick}
        >
          {/* Grid lines */}
          {Array.from({ length: totalBeats }, (_, i) => {
            const isMeasure = i % 4 === 0;
            return (
              <div
                key={i}
                className={`absolute top-0 bottom-0 ${isMeasure ? 'border-l border-border/60' : 'border-l border-border/20'}`}
                style={{ left: `${(i / totalBeats) * 100}%` }}
              />
            );
          })}

          {/* Sub-beat lines for 1/8 and 1/16 */}
          {snap !== '1/4' && Array.from({ length: totalBeats * 2 }, (_, i) => {
            if (i % 2 === 0) return null;
            return (
              <div
                key={`8-${i}`}
                className="absolute top-0 bottom-0 border-l border-border/10"
                style={{ left: `${(i / (totalBeats * 2)) * 100}%` }}
              />
            );
          })}

          {/* Playhead */}
          {isPlaying && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none"
              style={{ left: `${playheadPct}%`, boxShadow: '0 0 8px hsl(var(--primary)), 0 0 16px hsl(var(--primary))' }}
            />
          )}

          {/* Chord blocks */}
          {chords.map(chord => {
            const leftPct = (chord.startBeat / totalBeats) * 100;
            const widthPct = (chord.duration / totalBeats) * 100;
            const color = ROOT_COLORS[chord.root] || '220, 15%, 50%';

            return (
              <div
                key={chord.id}
                className="absolute top-2 rounded-md border cursor-grab active:cursor-grabbing select-none flex items-center group"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: 'calc(100% - 16px)',
                  backgroundColor: `hsl(${color} / 0.3)`,
                  borderColor: `hsl(${color} / 0.6)`,
                  minWidth: 20,
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  // Check if clicking resize handle
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX > rect.right - 8) {
                    setResizeChord(chord.id);
                  } else {
                    setDragChord(chord.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onRemoveChord(chord.id);
                }}
                title={`${chord.root} ${chord.chordType} — double-click to remove`}
              >
                <span
                  className="text-[10px] font-mono font-bold px-1.5 truncate"
                  style={{ color: `hsl(${color})` }}
                >
                  {chord.root}{chord.chordType === 'Major' ? '' : chord.chordType === 'Minor' ? 'm' : ` ${chord.chordType}`}
                </span>
                {/* Resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: `hsl(${color} / 0.4)` }}
                />
              </div>
            );
          })}

          {/* Drop hint text when empty */}
          {chords.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] font-mono text-muted-foreground/50">
                Drag chords from the library or double-click to add
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
