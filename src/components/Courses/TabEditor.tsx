import { useMemo, useRef, useState } from 'react';
import type { CoursePhrase, CourseNote, NoteKind } from '@/lib/courseTypes';
import { GRID_PER_BEAT, NOTE_KIND_COLOR } from '@/lib/courseTypes';
import { NOTE_NAMES, SCALE_FORMULAS } from '@/lib/music';
import { KEY_QUALITY_SCALE, type KeyQuality } from '@/lib/courseTypes';
import type { NoteName } from '@/lib/music';
import { Trash2 } from 'lucide-react';

interface Props {
  phrase: CoursePhrase;
  setPhrase: (p: CoursePhrase) => void;
  tuning: number[];
  keyRoot: NoteName;
  keyQuality: KeyQuality;
  beatsPerBar: number;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  /** Bar-window viewport: which grid the visible window starts at, and how many grid cells are visible. */
  startGrid?: number;
  visibleGrids?: number;
  /** Optional playhead position in grid units; null means hide. */
  playheadGrid?: number | null;
}

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const CELL_W = 28;
const ROW_H = 22;

export function TabEditor({
  phrase, setPhrase, tuning, keyRoot, keyQuality, beatsPerBar,
  selectedId, setSelectedId, startGrid = 0, visibleGrids, playheadGrid,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingFret, setEditingFret] = useState<{ id: string; value: string } | null>(null);

  const diatonicPC = useMemo(() => {
    const formula = SCALE_FORMULAS[KEY_QUALITY_SCALE[keyQuality]] ?? [];
    const rootIdx = NOTE_NAMES.indexOf(keyRoot);
    return new Set(formula.map(i => (rootIdx + i) % 12));
  }, [keyRoot, keyQuality]);

  // Window length: prefer explicit visibleGrids; otherwise full phrase
  const totalCells = visibleGrids ?? phrase.lengthGrid;

  const addNoteAt = (stringIndex: number, cellInWindow: number) => {
    const beatIndex = startGrid + cellInWindow;
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const note: CourseNote = { id, stringIndex, fret: 0, beatIndex, durationGrid: GRID_PER_BEAT };
    const newLen = Math.max(phrase.lengthGrid, beatIndex + GRID_PER_BEAT * 2);
    setPhrase({ notes: [...phrase.notes, note], lengthGrid: newLen });
    setSelectedId(id);
    setEditingFret({ id, value: '0' });
  };

  const updateNote = (id: string, patch: Partial<CourseNote>) => {
    setPhrase({ ...phrase, notes: phrase.notes.map(n => n.id === id ? { ...n, ...patch } : n) });
  };
  const deleteNote = (id: string) => {
    setPhrase({ ...phrase, notes: phrase.notes.filter(n => n.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  // Notes visible in window
  const visibleNotes = useMemo(() => phrase.notes.filter(n => {
    const end = n.beatIndex + n.durationGrid;
    return end > startGrid && n.beatIndex < startGrid + totalCells;
  }), [phrase.notes, startGrid, totalCells]);

  const beatGroups = useMemo(() => {
    const map = new Map<number, CourseNote[]>();
    visibleNotes.forEach(n => {
      const arr = map.get(n.beatIndex) ?? [];
      arr.push(n);
      map.set(n.beatIndex, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [visibleNotes]);

  const gridStyle: React.CSSProperties = { width: totalCells * CELL_W, minWidth: '100%' };

  const isBarLine = (cellIdx: number) => {
    const absoluteIdx = startGrid + cellIdx;
    return absoluteIdx > 0 && absoluteIdx % (beatsPerBar * GRID_PER_BEAT) === 0;
  };
  const isBeatLine = (cellIdx: number) => {
    const absoluteIdx = startGrid + cellIdx;
    return absoluteIdx > 0 && absoluteIdx % GRID_PER_BEAT === 0;
  };

  // Determine if a given cell is in the "main" 2-bar editable region (centered in 4-bar window)
  const isMainRegion = (cellIdx: number) => {
    if (!visibleGrids) return true;
    const oneBarsCells = beatsPerBar * GRID_PER_BEAT;
    return cellIdx >= oneBarsCells && cellIdx < oneBarsCells * 3;
  };

  return (
    <div ref={containerRef} className="border border-border rounded-lg bg-card overflow-x-auto">
      <div className="relative" style={gridStyle}>
        {/* String rows (high e top → low E bottom) */}
        {[5, 4, 3, 2, 1, 0].map((stringIndex) => (
          <div key={stringIndex} className="relative border-b border-border last:border-b-0" style={{ height: ROW_H }}>
            <div className="absolute left-0 top-0 h-full w-6 flex items-center justify-center text-[10px] font-mono text-muted-foreground bg-muted/30 border-r border-border z-10">
              {STRING_LABELS[stringIndex]}
            </div>
            <div className="absolute inset-0 left-6 flex">
              {Array.from({ length: totalCells }).map((_, cellIdx) => (
                <button
                  key={cellIdx}
                  onClick={() => addNoteAt(stringIndex, cellIdx)}
                  className={`border-r border-border/40 transition-colors ${
                    isMainRegion(cellIdx) ? 'hover:bg-primary/10 bg-transparent' : 'hover:bg-primary/5 bg-muted/10'
                  }`}
                  style={{
                    width: CELL_W,
                    height: ROW_H,
                    borderRightWidth: isBarLine(cellIdx + 1) ? 2 : 1,
                    borderRightColor: isBarLine(cellIdx + 1) ? 'hsl(var(--foreground))' : isBeatLine(cellIdx + 1) ? 'hsl(var(--muted-foreground) / 0.4)' : undefined,
                  }}
                />
              ))}
            </div>
            {visibleNotes.filter(n => n.stringIndex === stringIndex).map(n => {
              const localCell = n.beatIndex - startGrid;
              return (
                <div
                  key={n.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingFret({ id: n.id, value: String(n.fret) }); }}
                  className={`absolute top-0.5 z-20 text-xs font-mono rounded px-1 cursor-pointer ${selectedId === n.id ? 'ring-2 ring-primary bg-primary/20 text-foreground' : 'bg-background/90 text-foreground hover:bg-primary/10'}`}
                  style={{
                    left: 24 + localCell * CELL_W + 2,
                    height: ROW_H - 4,
                    lineHeight: `${ROW_H - 4}px`,
                    minWidth: 18,
                  }}
                >
                  {editingFret?.id === n.id ? (
                    <input
                      autoFocus type="number" value={editingFret.value} min={0} max={24}
                      onChange={e => setEditingFret({ id: n.id, value: e.target.value })}
                      onBlur={() => {
                        const v = parseInt(editingFret.value, 10);
                        if (!isNaN(v) && v >= 0 && v <= 24) updateNote(n.id, { fret: v });
                        setEditingFret(null);
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingFret(null); }}
                      className="w-10 bg-transparent outline-none"
                    />
                  ) : n.fret}
                </div>
              );
            })}
          </div>
        ))}

        {/* Duration bars row */}
        <div className="relative border-t-2 border-border bg-muted/20" style={{ height: ROW_H + 6 }}>
          <div className="absolute left-0 top-0 h-full w-6 flex items-center justify-center text-[9px] font-mono text-muted-foreground bg-muted/30 border-r border-border z-10">⏱</div>
          <div className="absolute inset-0 left-6">
            {beatGroups.map(([beatIdx, notes]) => {
              const dur = Math.max(...notes.map(n => n.durationGrid));
              const kind: NoteKind = notes.length > 1
                ? 'chord'
                : (() => { const n = notes[0]; const pc = ((tuning[n.stringIndex] ?? 0) + n.fret) % 12; return diatonicPC.has(pc) ? 'diatonic' : 'non-diatonic'; })();
              const groupSelected = notes.some(n => n.id === selectedId);
              const localBeat = beatIdx - startGrid;
              return (
                <div
                  key={beatIdx}
                  className={`absolute top-1 rounded-sm flex items-center justify-end pr-1 text-[9px] font-mono text-white/90 cursor-ew-resize ${groupSelected ? 'ring-2 ring-primary' : ''}`}
                  style={{
                    left: localBeat * CELL_W + 1,
                    width: dur * CELL_W - 2,
                    height: ROW_H,
                    backgroundColor: NOTE_KIND_COLOR[kind],
                  }}
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startDur = dur;
                    const onMove = (mv: MouseEvent) => {
                      const delta = Math.round((mv.clientX - startX) / CELL_W);
                      const newDur = Math.max(1, startDur + delta);
                      notes.forEach(n => updateNote(n.id, { durationGrid: newDur }));
                    };
                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(notes[0].id); }}
                >{dur}</div>
              );
            })}
          </div>
        </div>

        {/* Playhead */}
        {playheadGrid != null && playheadGrid >= startGrid && playheadGrid < startGrid + totalCells && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none transition-[left] duration-150"
            style={{ left: 24 + (playheadGrid - startGrid) * CELL_W, boxShadow: '0 0 8px hsl(var(--primary))' }} />
        )}
      </div>

      {selectedId && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/10">
          <span className="text-xs font-mono text-muted-foreground">Selected: {selectedId}</span>
          <button onClick={() => deleteNote(selectedId)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
            <Trash2 className="size-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
