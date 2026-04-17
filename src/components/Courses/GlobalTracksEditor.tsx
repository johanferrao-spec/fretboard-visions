import { useMemo, useState } from 'react';
import { type NoteName, getDiatonicChords, getChordDegree, SCALE_DEGREE_COLORS } from '@/lib/music';
import { GRID_PER_BEAT, type ChordTrackEntry, type KeyChangeEntry, type TempoChangeEntry, type KeyQuality } from '@/lib/courseTypes';
import { Trash2, Scissors } from 'lucide-react';
import { parseChordSymbol, chordToShortLabel } from '@/lib/chordParser';

interface Props {
  chordTrack: ChordTrackEntry[]; setChordTrack: (v: ChordTrackEntry[]) => void;
  keyTrack: KeyChangeEntry[]; setKeyTrack: (v: KeyChangeEntry[]) => void;
  tempoTrack: TempoChangeEntry[]; setTempoTrack: (v: TempoChangeEntry[]) => void;
  startGrid: number;
  visibleGrids: number;
  beatsPerBar: number;
  isOwner: boolean;
  /** Course-level key (used as the implicit first key marker on the lane). */
  defaultKeyRoot: NoteName;
  defaultKeyQuality: KeyQuality;
  /** When the user uses the "split bar" tool, parent supplies the currently selected key from the left scale selector. */
  pendingKey: { root: NoteName; quality: KeyQuality };
}

const CELL_W = 28;
const ROW_H = 28;
const LANE_LABEL_W = 64;

export function GlobalTracksEditor({
  chordTrack, setChordTrack, keyTrack, setKeyTrack, tempoTrack, setTempoTrack,
  startGrid, visibleGrids, beatsPerBar, isOwner, defaultKeyRoot, defaultKeyQuality, pendingKey,
}: Props) {
  const [editingChordId, setEditingChordId] = useState<string | null>(null);
  const [chordInput, setChordInput] = useState('');
  const [editingTempoId, setEditingTempoId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState(false);

  const totalCells = visibleGrids;
  const gridPerBar = beatsPerBar * GRID_PER_BEAT;

  const inWindow = <T extends { beatIndex: number }>(arr: T[]) =>
    arr.filter(e => e.beatIndex >= startGrid && e.beatIndex < startGrid + totalCells);

  // Determine the "active key" at any given grid index (latest keyTrack entry ≤ idx, or default).
  const keyAt = (gridIdx: number): { root: NoteName; quality: KeyQuality } => {
    const sorted = [...keyTrack].filter(k => k.beatIndex <= gridIdx).sort((a, b) => b.beatIndex - a.beatIndex);
    if (sorted[0]) return { root: sorted[0].root, quality: sorted[0].quality };
    return { root: defaultKeyRoot, quality: defaultKeyQuality };
  };

  // Chord color from active key
  const chordColor = (c: ChordTrackEntry) => {
    const k = keyAt(c.beatIndex);
    const mode = k.quality === 'Major' ? 'major' : 'minor';
    const deg = getChordDegree(k.root, c.root, c.quality, mode);
    if (deg >= 0) return SCALE_DEGREE_COLORS[deg];
    return '28, 90%, 55%'; // non-diatonic = orange
  };

  const isBarLine = (cellIdx: number) => {
    const absolute = startGrid + cellIdx;
    return absolute % gridPerBar === 0;
  };

  // ============ Chord lane interactions ============
  const handleChordDrop = (cellIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    const symbol = e.dataTransfer.getData('text/chord-symbol');
    if (!symbol) return;
    const parsed = parseChordSymbol(symbol);
    if (!parsed) return;
    const beatIndex = startGrid + Math.floor(cellIdx / GRID_PER_BEAT) * GRID_PER_BEAT;
    setChordTrack([...chordTrack, {
      id: `c-${Date.now()}`, beatIndex, durationGrid: gridPerBar, root: parsed.root, quality: parsed.quality,
    }]);
  };

  const startTypeChord = (cellIdx: number) => {
    if (!isOwner) return;
    const beatIndex = startGrid + Math.floor(cellIdx / GRID_PER_BEAT) * GRID_PER_BEAT;
    const id = `c-${Date.now()}`;
    setChordTrack([...chordTrack, { id, beatIndex, durationGrid: gridPerBar, root: 'C', quality: 'Major' }]);
    setEditingChordId(id);
    setChordInput('');
  };

  const commitChordType = (id: string) => {
    const parsed = parseChordSymbol(chordInput);
    if (parsed) {
      setChordTrack(chordTrack.map(c => c.id === id ? { ...c, root: parsed.root, quality: parsed.quality } : c));
    }
    setEditingChordId(null);
    setChordInput('');
  };

  // ============ Key lane: split-bar tool ============
  const handleKeyLaneClick = (cellIdx: number) => {
    if (!isOwner || !splitMode) return;
    const beatIndex = startGrid + Math.floor(cellIdx / gridPerBar) * gridPerBar;
    // Don't duplicate a marker at the same position
    if (keyTrack.some(k => k.beatIndex === beatIndex)) return;
    setKeyTrack([...keyTrack, { id: `k-${Date.now()}`, beatIndex, root: pendingKey.root, quality: pendingKey.quality }]);
    setSplitMode(false);
  };

  const handleTempoCellClick = (cellIdx: number) => {
    if (!isOwner) return;
    const beatIndex = startGrid + Math.floor(cellIdx / gridPerBar) * gridPerBar;
    const id = `t-${Date.now()}`;
    setTempoTrack([...tempoTrack, { id, beatIndex, bpm: 100 }]);
    setEditingTempoId(id);
  };

  const visChords = useMemo(() => inWindow(chordTrack), [chordTrack, startGrid, totalCells]);
  const visTempos = useMemo(() => inWindow(tempoTrack), [tempoTrack, startGrid, totalCells]);

  // For the key lane: render the IMPLICIT key (from default) at the start, then any markers in window.
  const visKeyMarkers = useMemo(() => {
    const markers: { id: string; beatIndex: number; root: NoteName; quality: KeyQuality }[] = [];
    // implicit start-of-window marker = active key at startGrid
    const startKey = keyAt(startGrid);
    markers.push({ id: '__implicit', beatIndex: startGrid, root: startKey.root, quality: startKey.quality });
    inWindow(keyTrack).forEach(k => markers.push(k));
    return markers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyTrack, startGrid, totalCells, defaultKeyRoot, defaultKeyQuality]);

  return (
    <div className="border border-border rounded-lg bg-card overflow-x-auto">
      <div className="relative" style={{ width: totalCells * CELL_W + LANE_LABEL_W, minWidth: '100%' }}>
        {/* ============ Chord lane ============ */}
        <Lane label="Chords" color="hsl(210, 80%, 55%)" totalCells={totalCells} isBarLine={isBarLine}
          onCellDoubleClick={startTypeChord}
          onCellDrop={handleChordDrop}
          allowDrop>
          {visChords.map(c => {
            const local = c.beatIndex - startGrid;
            const color = chordColor(c);
            const editing = editingChordId === c.id;
            return (
              <div key={c.id}
                className="absolute top-1 rounded-md text-[11px] font-mono z-20 flex items-center px-1.5 gap-1 group"
                style={{
                  left: LANE_LABEL_W + local * CELL_W,
                  width: c.durationGrid * CELL_W - 2,
                  height: ROW_H - 4,
                  background: `hsl(${color} / 0.30)`,
                  border: `1px solid hsl(${color} / 0.7)`,
                  color: `hsl(${color})`,
                }}>
                {editing && isOwner ? (
                  <input
                    autoFocus
                    value={chordInput}
                    placeholder="e.g. Am7"
                    onChange={e => setChordInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitChordType(c.id);
                      if (e.key === 'Escape') { setEditingChordId(null); setChordInput(''); }
                    }}
                    onBlur={() => commitChordType(c.id)}
                    className="bg-background/80 text-foreground text-[11px] rounded px-1 outline-none flex-1 min-w-0"
                  />
                ) : (
                  <button
                    onDoubleClick={() => {
                      setEditingChordId(c.id);
                      setChordInput(chordToShortLabel(c.root, c.quality));
                    }}
                    className="flex-1 text-left font-bold truncate"
                    title="Double-click to type new chord"
                  >{chordToShortLabel(c.root, c.quality)}</button>
                )}
                <button
                  onClick={() => setChordTrack(chordTrack.filter(x => x.id !== c.id))}
                  className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                  title="Delete chord"
                ><Trash2 className="size-3" /></button>
              </div>
            );
          })}
        </Lane>

        {/* ============ Key lane ============ */}
        <Lane label="Key" color="hsl(280, 70%, 60%)" totalCells={totalCells} isBarLine={isBarLine}
          onCellClick={handleKeyLaneClick}>
          {visKeyMarkers.map(k => {
            const local = Math.max(0, k.beatIndex - startGrid);
            const isImplicit = k.id === '__implicit';
            return (
              <div key={k.id} className="absolute top-1 rounded text-[10px] font-mono z-20 flex items-center px-2 gap-1 group"
                style={{
                  left: LANE_LABEL_W + local * CELL_W,
                  height: ROW_H - 4,
                  background: 'hsl(280, 70%, 60%, 0.25)',
                  border: `1px ${isImplicit ? 'dashed' : 'solid'} hsl(280, 70%, 60%, 0.7)`,
                  color: 'hsl(280, 70%, 80%)',
                }}>
                <span className="font-bold">🎼 {k.root} {k.quality}</span>
                {!isImplicit && isOwner && (
                  <button onClick={() => setKeyTrack(keyTrack.filter(x => x.id !== k.id))}
                    className="opacity-0 group-hover:opacity-100 text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
        </Lane>

        {/* ============ Tempo lane ============ */}
        <Lane label="Tempo" color="hsl(40, 80%, 55%)" totalCells={totalCells} isBarLine={isBarLine}
          onCellClick={handleTempoCellClick}>
          {visTempos.map(t => {
            const local = t.beatIndex - startGrid;
            const editing = editingTempoId === t.id;
            return (
              <div key={t.id} className="absolute top-1 rounded text-[10px] font-mono z-20 flex items-center px-2 gap-1 group"
                style={{
                  left: LANE_LABEL_W + local * CELL_W,
                  height: ROW_H - 4,
                  background: 'hsl(40, 80%, 55%, 0.25)',
                  border: '1px solid hsl(40, 80%, 55%, 0.7)',
                  color: 'hsl(40, 80%, 80%)',
                }}>
                {editing && isOwner ? (
                  <input type="number" autoFocus min={40} max={240} value={t.bpm}
                    onChange={e => setTempoTrack(tempoTrack.map(x => x.id === t.id ? { ...x, bpm: parseInt(e.target.value, 10) || 100 } : x))}
                    onBlur={() => setEditingTempoId(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingTempoId(null); }}
                    className="bg-background/80 text-foreground text-[10px] rounded w-12 px-1 outline-none" />
                ) : (
                  <button onDoubleClick={() => setEditingTempoId(t.id)} className="font-bold">♩= {t.bpm}</button>
                )}
                {isOwner && (
                  <button onClick={() => setTempoTrack(tempoTrack.filter(x => x.id !== t.id))}
                    className="opacity-0 group-hover:opacity-100 text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
        </Lane>
      </div>

      {isOwner && (
        <div className="flex items-center gap-3 px-3 py-2 border-t border-border bg-muted/10 text-[10px] font-mono text-muted-foreground">
          <button
            onClick={() => setSplitMode(s => !s)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
              splitMode ? 'bg-primary/20 border-primary text-primary' : 'bg-muted/40 border-border hover:bg-muted'
            }`}
            title={`Split bar with new key (${pendingKey.root} ${pendingKey.quality})`}
          >
            <Scissors className="size-3" />
            Split bar → new key ({pendingKey.root} {pendingKey.quality})
          </button>
          <span>Drag chords from the palette • Double-click empty chord cell to type • Double-click tempo cell to edit</span>
        </div>
      )}
    </div>
  );
}

interface LaneProps {
  label: string;
  color: string;
  totalCells: number;
  isBarLine: (cellIdx: number) => boolean;
  onCellClick?: (cellIdx: number) => void;
  onCellDoubleClick?: (cellIdx: number) => void;
  onCellDrop?: (cellIdx: number, e: React.DragEvent) => void;
  allowDrop?: boolean;
  children: React.ReactNode;
}

function Lane({ label, color, totalCells, isBarLine, onCellClick, onCellDoubleClick, onCellDrop, allowDrop, children }: LaneProps) {
  return (
    <div className="relative border-b border-border" style={{ height: ROW_H }}>
      <div className="absolute left-0 top-0 h-full flex items-center justify-center text-[9px] font-mono uppercase tracking-wider bg-muted/30 border-r border-border z-10"
        style={{ width: LANE_LABEL_W, color }}>{label}</div>
      <div className="absolute inset-0 flex" style={{ left: LANE_LABEL_W }}>
        {Array.from({ length: totalCells }).map((_, cellIdx) => (
          <div
            key={cellIdx}
            onClick={() => onCellClick?.(cellIdx)}
            onDoubleClick={() => onCellDoubleClick?.(cellIdx)}
            onDragOver={allowDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } : undefined}
            onDrop={allowDrop ? (e) => onCellDrop?.(cellIdx, e) : undefined}
            className="hover:bg-primary/5 cursor-pointer"
            style={{
              width: CELL_W, height: ROW_H,
              borderRight: isBarLine(cellIdx + 1) ? '2px solid hsl(var(--foreground) / 0.5)' : '1px solid hsl(var(--border) / 0.3)',
            }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
