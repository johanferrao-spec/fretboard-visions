import { useMemo, useState, useEffect, useRef } from 'react';
import { type NoteName, getChordDegree, SCALE_DEGREE_COLORS } from '@/lib/music';
import { GRID_PER_BEAT, type ChordTrackEntry, type KeyChangeEntry, type TempoChangeEntry, type KeyQuality } from '@/lib/courseTypes';
import { Scissors } from 'lucide-react';
import { parseChordSymbol, chordToShortLabel } from '@/lib/chordParser';

interface Props {
  chordTrack: ChordTrackEntry[]; setChordTrack: (v: ChordTrackEntry[]) => void;
  keyTrack: KeyChangeEntry[]; setKeyTrack: (v: KeyChangeEntry[]) => void;
  tempoTrack: TempoChangeEntry[]; setTempoTrack: (v: TempoChangeEntry[]) => void;
  startGrid: number;
  visibleGrids: number;
  beatsPerBar: number;
  isOwner: boolean;
  defaultKeyRoot: NoteName;
  defaultKeyQuality: KeyQuality;
  defaultTempo: number;
  pendingKey: { root: NoteName; quality: KeyQuality };
  /** Cmd/Meta is being held → cells flash a deletion affordance. */
  deleteMode: boolean;
  /** Optional playhead in absolute grid units. */
  playheadGrid?: number | null;
  /** Cell width — kept in sync with TabEditor for column alignment. */
  cellW: number;
  /** Optional draggable insertion cursor in absolute grid units. */
  cursorGrid?: number;
  setCursorGrid?: (g: number) => void;
}

const ROW_H = 28;
/** Shared gutter width with TabEditor for perfect column alignment. */
const LANE_LABEL_W = 64;
const BAR_ROW_H = 18;

export function GlobalTracksEditor({
  chordTrack, setChordTrack, keyTrack, setKeyTrack, tempoTrack, setTempoTrack,
  startGrid, visibleGrids, beatsPerBar, isOwner, defaultKeyRoot, defaultKeyQuality, defaultTempo, pendingKey,
  deleteMode, playheadGrid, cellW, cursorGrid, setCursorGrid,
}: Props) {
  const [editingChordId, setEditingChordId] = useState<string | null>(null);
  const [chordInput, setChordInput] = useState('');
  const [editingTempoId, setEditingTempoId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState(false);
  const CELL_W = cellW;

  const totalCells = visibleGrids;
  const gridPerBar = beatsPerBar * GRID_PER_BEAT;

  /** Bar markers — same calc as TabEditor for column alignment. */
  const barMarkers = useMemo(() => {
    const out: Array<{ x: number; barNumber: number }> = [];
    for (let cell = 0; cell <= totalCells; cell++) {
      const abs = startGrid + cell;
      if (abs % gridPerBar === 0) {
        out.push({ x: cell * CELL_W, barNumber: Math.floor(abs / gridPerBar) + 1 });
      }
    }
    return out;
  }, [startGrid, totalCells, gridPerBar, CELL_W]);

  const keyAt = (gridIdx: number): { root: NoteName; quality: KeyQuality } => {
    const sorted = [...keyTrack].filter(k => k.beatIndex <= gridIdx).sort((a, b) => b.beatIndex - a.beatIndex);
    if (sorted[0]) return { root: sorted[0].root, quality: sorted[0].quality };
    return { root: defaultKeyRoot, quality: defaultKeyQuality };
  };
  const tempoAt = (gridIdx: number): number => {
    const sorted = [...tempoTrack].filter(t => t.beatIndex <= gridIdx).sort((a, b) => b.beatIndex - a.beatIndex);
    return sorted[0]?.bpm ?? defaultTempo;
  };

  const chordColor = (c: ChordTrackEntry) => {
    const k = keyAt(c.beatIndex);
    const mode = k.quality === 'Major' ? 'major' : 'minor';
    const deg = getChordDegree(k.root, c.root, c.quality, mode);
    if (deg >= 0) return SCALE_DEGREE_COLORS[deg];
    return '28, 90%, 55%';
  };

  const isBarLine = (cellIdx: number) => (startGrid + cellIdx) % gridPerBar === 0;

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
    const beatIndex = startGrid + Math.floor(cellIdx / gridPerBar) * gridPerBar;
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

  // Generic drag/resize for chord lane (objects with beatIndex + durationGrid)
  const dragChord = (id: string, mode: 'move' | 'resize-l' | 'resize-r', e: React.MouseEvent) => {
    if (!isOwner) return;
    e.stopPropagation();
    const startX = e.clientX;
    const c = chordTrack.find(x => x.id === id);
    if (!c) return;
    const startBeat = c.beatIndex;
    const startDur = c.durationGrid;
    const onMove = (mv: MouseEvent) => {
      const deltaCells = Math.round((mv.clientX - startX) / CELL_W);
      let next = { beatIndex: startBeat, durationGrid: startDur };
      if (mode === 'move') next.beatIndex = startBeat + deltaCells;
      if (mode === 'resize-r') next.durationGrid = Math.max(1, startDur + deltaCells);
      if (mode === 'resize-l') {
        const newBeat = startBeat + deltaCells;
        const newDur = startDur - deltaCells;
        if (newDur >= 1) { next.beatIndex = newBeat; next.durationGrid = newDur; }
      }
      setChordTrack(chordTrack.map(x => x.id === id ? { ...x, ...next } : x));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag a key/tempo marker (single point, no width)
  const dragMarker = (id: string, kind: 'key' | 'tempo', e: React.MouseEvent) => {
    if (!isOwner) return;
    e.stopPropagation();
    const startX = e.clientX;
    const arr = kind === 'key' ? keyTrack : tempoTrack;
    const m = arr.find(x => x.id === id);
    if (!m) return;
    const startBeat = m.beatIndex;
    const onMove = (mv: MouseEvent) => {
      const deltaCells = Math.round((mv.clientX - startX) / CELL_W);
      const newBeat = startBeat + deltaCells;
      if (kind === 'key') {
        setKeyTrack(keyTrack.map(x => x.id === id ? { ...x, beatIndex: newBeat } : x));
      } else {
        setTempoTrack(tempoTrack.map(x => x.id === id ? { ...x, beatIndex: newBeat } : x));
      }
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ============ Key lane: split-bar tool ============
  const handleKeyLaneClick = (cellIdx: number) => {
    if (!isOwner || !splitMode) return;
    const beatIndex = startGrid + Math.floor(cellIdx / gridPerBar) * gridPerBar;
    if (keyTrack.some(k => k.beatIndex === beatIndex)) return;
    setKeyTrack([...keyTrack, { id: `k-${Date.now()}`, beatIndex, root: pendingKey.root, quality: pendingKey.quality }]);
    setSplitMode(false);
  };

  const handleTempoCellClick = (cellIdx: number) => {
    if (!isOwner) return;
    const beatIndex = startGrid + Math.floor(cellIdx / gridPerBar) * gridPerBar;
    if (tempoTrack.some(t => t.beatIndex === beatIndex)) return;
    const id = `t-${Date.now()}`;
    setTempoTrack([...tempoTrack, { id, beatIndex, bpm: defaultTempo }]);
    setEditingTempoId(id);
  };

  // Visible chords in window
  const visChords = useMemo(
    () => chordTrack.filter(c => c.beatIndex + c.durationGrid > startGrid && c.beatIndex < startGrid + totalCells),
    [chordTrack, startGrid, totalCells],
  );

  // Build "infinite" key segments — each key entry extends to the next entry (or end of window)
  const keySegments = useMemo(() => {
    // Sort all key markers + implicit at -Infinity (i.e. defaults)
    const all = [
      { id: '__implicit', beatIndex: -Infinity, root: defaultKeyRoot, quality: defaultKeyQuality },
      ...keyTrack,
    ].sort((a, b) => a.beatIndex - b.beatIndex);
    const segs: Array<{ id: string; from: number; to: number; root: NoteName; quality: KeyQuality; isImplicit: boolean }> = [];
    for (let i = 0; i < all.length; i++) {
      const cur = all[i];
      const next = all[i + 1];
      const from = cur.beatIndex === -Infinity ? startGrid : cur.beatIndex;
      const to = next ? next.beatIndex : startGrid + totalCells;
      // only push if visible
      if (to > startGrid && from < startGrid + totalCells) {
        segs.push({
          id: cur.id, from, to,
          root: cur.root, quality: cur.quality,
          isImplicit: cur.id === '__implicit' || cur.beatIndex < startGrid && i === 0,
        });
      }
    }
    return segs;
  }, [keyTrack, startGrid, totalCells, defaultKeyRoot, defaultKeyQuality]);

  const tempoSegments = useMemo(() => {
    const all = [
      { id: '__implicit', beatIndex: -Infinity, bpm: defaultTempo },
      ...tempoTrack,
    ].sort((a, b) => a.beatIndex - b.beatIndex);
    const segs: Array<{ id: string; from: number; to: number; bpm: number; isImplicit: boolean }> = [];
    for (let i = 0; i < all.length; i++) {
      const cur = all[i];
      const next = all[i + 1];
      const from = cur.beatIndex === -Infinity ? startGrid : cur.beatIndex;
      const to = next ? next.beatIndex : startGrid + totalCells;
      if (to > startGrid && from < startGrid + totalCells) {
        segs.push({ id: cur.id, from, to, bpm: cur.bpm, isImplicit: cur.id === '__implicit' });
      }
    }
    return segs;
  }, [tempoTrack, startGrid, totalCells, defaultTempo]);

  const tryDeleteChord = (id: string) => deleteMode && setChordTrack(chordTrack.filter(x => x.id !== id));
  const tryDeleteKey = (id: string) => deleteMode && id !== '__implicit' && setKeyTrack(keyTrack.filter(x => x.id !== id));
  const tryDeleteTempo = (id: string) => deleteMode && id !== '__implicit' && setTempoTrack(tempoTrack.filter(x => x.id !== id));

  return (
    <div className="border border-border rounded-lg bg-card overflow-x-auto relative">
      <div className="relative" style={{ width: totalCells * CELL_W + LANE_LABEL_W, minWidth: '100%' }}>
        {/* ============ Top bar-marker row — clickable to set the cursor ============ */}
        <div
          className="relative cursor-pointer"
          style={{ height: BAR_ROW_H, borderBottom: '1px solid hsl(var(--border))' }}
          onMouseDown={(e) => {
            if (!setCursorGrid) return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left - LANE_LABEL_W;
            if (x < 0) return;
            setCursorGrid(Math.round(startGrid + x / CELL_W));
          }}
          title="Click to move the insertion cursor"
        >
          <div className="absolute left-0 top-0 h-full bg-muted/30 border-r border-border z-10 pointer-events-none" style={{ width: LANE_LABEL_W }} />
          <div className="absolute inset-0" style={{ left: LANE_LABEL_W }}>
            {barMarkers.map(({ x, barNumber }) => (
              <div key={`bar-${barNumber}`}
                className="absolute top-0 bottom-0 flex items-center text-[10px] font-mono font-bold pointer-events-none text-foreground"
                style={{ left: x, paddingLeft: 3 }}
              >{barNumber}</div>
            ))}
          </div>
        </div>

        {/* ============ Chord lane ============ */}
        <Lane label="Chords" totalCells={totalCells} cellW={CELL_W} isBarLine={isBarLine}
          onCellDoubleClick={startTypeChord}
          onCellDrop={handleChordDrop} allowDrop>
          {visChords.map(c => {
            const local = c.beatIndex - startGrid;
            const color = chordColor(c);
            const editing = editingChordId === c.id;
            return (
              <div key={c.id}
                onClick={(e) => { e.stopPropagation(); tryDeleteChord(c.id); }}
                onMouseDown={(e) => !deleteMode && !editing && dragChord(c.id, 'move', e)}
                className={`absolute top-0.5 bottom-0.5 rounded-md text-[11px] font-mono z-20 flex items-center px-2 select-none overflow-hidden ${deleteMode ? 'cursor-not-allowed ring-2 ring-destructive' : 'cursor-move'}`}
                style={{
                  left: LANE_LABEL_W + local * CELL_W,
                  width: c.durationGrid * CELL_W - 2,
                  background: `hsl(${color})`,
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }}>
                {/* left resize */}
                <div onMouseDown={(e) => dragChord(c.id, 'resize-l', e)} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
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
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    className="bg-background/80 text-foreground text-[11px] rounded px-1 outline-none flex-1 min-w-0"
                  />
                ) : (
                  <button
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingChordId(c.id);
                      setChordInput(chordToShortLabel(c.root, c.quality));
                    }}
                    className="flex-1 text-left font-bold truncate px-1"
                    title="Double-click to rename — drag edges to resize — drag body to move"
                  >{chordToShortLabel(c.root, c.quality)}</button>
                )}
                {/* right resize */}
                <div onMouseDown={(e) => dragChord(c.id, 'resize-r', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
              </div>
            );
          })}
        </Lane>

        {/* ============ Key lane (infinite segments) ============ */}
        <Lane label="Key" totalCells={totalCells} cellW={CELL_W} isBarLine={isBarLine}
          onCellClick={handleKeyLaneClick}>
          {keySegments.map(seg => {
            const localFrom = Math.max(0, seg.from - startGrid);
            const localTo = Math.min(totalCells, seg.to - startGrid);
            const width = (localTo - localFrom) * CELL_W - 2;
            return (
              <div key={seg.id}
                onClick={(e) => { e.stopPropagation(); tryDeleteKey(seg.id); }}
                onMouseDown={(e) => !deleteMode && !seg.isImplicit && dragMarker(seg.id, 'key', e)}
                className={`absolute top-0.5 bottom-0.5 rounded text-[10px] font-mono z-20 flex items-center px-2 gap-1 select-none overflow-hidden ${
                  deleteMode && !seg.isImplicit ? 'cursor-not-allowed ring-2 ring-destructive' : seg.isImplicit ? '' : 'cursor-move'
                }`}
                style={{
                  left: LANE_LABEL_W + localFrom * CELL_W,
                  width,
                  background: 'hsl(280, 70%, 55%)',
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  opacity: seg.isImplicit ? 0.7 : 1,
                }}
                title={seg.isImplicit ? 'Default key (set in scale selector)' : 'Drag to move • cmd-click to delete'}>
                <span className="font-bold whitespace-nowrap">🎼 {seg.root} {seg.quality}</span>
              </div>
            );
          })}
        </Lane>

        {/* ============ Tempo lane (infinite segments) ============ */}
        <Lane label="Tempo" totalCells={totalCells} cellW={CELL_W} isBarLine={isBarLine}
          onCellClick={handleTempoCellClick}>
          {tempoSegments.map(seg => {
            const localFrom = Math.max(0, seg.from - startGrid);
            const localTo = Math.min(totalCells, seg.to - startGrid);
            const width = (localTo - localFrom) * CELL_W - 2;
            const editing = editingTempoId === seg.id;
            return (
              <div key={seg.id}
                onClick={(e) => { e.stopPropagation(); tryDeleteTempo(seg.id); }}
                onMouseDown={(e) => !deleteMode && !seg.isImplicit && !editing && dragMarker(seg.id, 'tempo', e)}
                className={`absolute top-0.5 bottom-0.5 rounded text-[10px] font-mono z-20 flex items-center px-2 gap-1 select-none overflow-hidden ${
                  deleteMode && !seg.isImplicit ? 'cursor-not-allowed ring-2 ring-destructive' : seg.isImplicit ? '' : 'cursor-move'
                }`}
                style={{
                  left: LANE_LABEL_W + localFrom * CELL_W,
                  width,
                  background: 'hsl(40, 80%, 50%)',
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  opacity: seg.isImplicit ? 0.7 : 1,
                }}>
                {editing && isOwner ? (
                  <input type="number" autoFocus min={40} max={240} value={seg.bpm}
                    onChange={e => setTempoTrack(tempoTrack.map(x => x.id === seg.id ? { ...x, bpm: parseInt(e.target.value, 10) || 100 } : x))}
                    onBlur={() => setEditingTempoId(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingTempoId(null); }}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    className="bg-background/80 text-foreground text-[10px] rounded w-12 px-1 outline-none" />
                ) : (
                  <button
                    onDoubleClick={(e) => { e.stopPropagation(); if (!seg.isImplicit) setEditingTempoId(seg.id); }}
                    className="font-bold whitespace-nowrap"
                    title={seg.isImplicit ? 'Default tempo' : 'Double-click to edit'}
                  >♩= {seg.bpm}</button>
                )}
              </div>
            );
          })}
        </Lane>

        {/* Playhead spanning all 3 lanes */}
        {playheadGrid != null && playheadGrid >= startGrid && playheadGrid < startGrid + totalCells && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none transition-[left] duration-150"
            style={{ left: LANE_LABEL_W + (playheadGrid - startGrid) * CELL_W, boxShadow: '0 0 8px hsl(var(--primary))' }} />
        )}
      </div>

      {isOwner && (
        <div className="flex items-center gap-3 px-3 py-2 border-t border-border bg-muted/10 text-[10px] font-mono text-muted-foreground flex-wrap">
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
          <span>Drag chords from palette • Double-click empty chord cell to type • Drag edges to resize • Hold ⌘ and click to delete</span>
        </div>
      )}
    </div>
  );
}

interface LaneProps {
  label: string;
  totalCells: number;
  cellW: number;
  isBarLine: (cellIdx: number) => boolean;
  onCellClick?: (cellIdx: number) => void;
  onCellDoubleClick?: (cellIdx: number) => void;
  onCellDrop?: (cellIdx: number, e: React.DragEvent) => void;
  allowDrop?: boolean;
  children: React.ReactNode;
}

function Lane({ label, totalCells, cellW, isBarLine, onCellClick, onCellDoubleClick, onCellDrop, allowDrop, children }: LaneProps) {
  return (
    <div className="relative border-b border-border" style={{ height: ROW_H }}>
      <div className="absolute left-0 top-0 h-full flex items-center justify-center text-[9px] font-mono uppercase tracking-wider bg-muted/30 border-r border-border z-10 text-muted-foreground"
        style={{ width: LANE_LABEL_W }}>{label}</div>
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
              width: cellW, height: ROW_H,
              borderRight: isBarLine(cellIdx + 1) ? '2px solid hsl(var(--foreground) / 0.5)' : '1px solid hsl(var(--border) / 0.3)',
            }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
