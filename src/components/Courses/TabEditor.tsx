import { useMemo, useRef, useState, useEffect } from 'react';
import type { CoursePhrase, CourseNote, NoteKind, Technique } from '@/lib/courseTypes';
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
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  startGrid?: number;
  visibleGrids?: number;
  playheadGrid?: number | null;
  /** When user clicks a fret on the interactive fretboard while a note is selected, parent passes (stringIndex, fret). */
  pickedFretboardNote?: { stringIndex: number; fret: number; nonce: number } | null;
  /** ⌘ held → click to delete. */
  deleteMode: boolean;
}

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const CELL_W = 28;
const ROW_H = 26;
/** Default duration = 1/8 note = 2 grid units (since GRID_PER_BEAT=4 → 1/16=1, 1/8=2, 1/4=4). */
const DEFAULT_DUR = GRID_PER_BEAT / 2;

const TECHNIQUE_SYMBOL: Record<Technique, string> = {
  hammer: 'h', pull: 'p', 'slide-up': '/', 'slide-down': '\\',
  bend: 'b', release: 'r', vibrato: '~', 'palm-mute': 'PM', tap: 't', harmonic: '◆',
};

export function TabEditor({
  phrase, setPhrase, tuning, keyRoot, keyQuality, beatsPerBar,
  selectedIds, setSelectedIds, startGrid = 0, visibleGrids, playheadGrid,
  pickedFretboardNote, deleteMode,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingFret, setEditingFret] = useState<{ id: string; value: string } | null>(null);
  const lastPickRef = useRef<number>(0);

  const diatonicPC = useMemo(() => {
    const formula = SCALE_FORMULAS[KEY_QUALITY_SCALE[keyQuality]] ?? [];
    const rootIdx = NOTE_NAMES.indexOf(keyRoot);
    return new Set(formula.map(i => (rootIdx + i) % 12));
  }, [keyRoot, keyQuality]);

  const totalCells = visibleGrids ?? phrase.lengthGrid;
  const gridPerBar = beatsPerBar * GRID_PER_BEAT;

  const updateNote = (id: string, patch: Partial<CourseNote>) => {
    setPhrase({ ...phrase, notes: phrase.notes.map(n => n.id === id ? { ...n, ...patch } : n) });
  };

  /** Trim/delete duration bars on this string that overlap [start, start+dur). */
  const trimOverlaps = (notes: CourseNote[], stringIndex: number, start: number, dur: number, ignoreId?: string): CourseNote[] => {
    const end = start + dur;
    const out: CourseNote[] = [];
    for (const n of notes) {
      if (n.id === ignoreId || n.stringIndex !== stringIndex) { out.push(n); continue; }
      const nEnd = n.beatIndex + n.durationGrid;
      // No overlap
      if (nEnd <= start || n.beatIndex >= end) { out.push(n); continue; }
      // Fully inside → drop
      if (n.beatIndex >= start && nEnd <= end) continue;
      // Overlaps from the left → trim its tail
      if (n.beatIndex < start && nEnd > start && nEnd <= end) {
        out.push({ ...n, durationGrid: start - n.beatIndex });
        continue;
      }
      // Overlaps from the right → push start to end
      if (n.beatIndex >= start && n.beatIndex < end && nEnd > end) {
        out.push({ ...n, beatIndex: end, durationGrid: nEnd - end });
        continue;
      }
      // Spans across (existing wider than new) → split into two
      if (n.beatIndex < start && nEnd > end) {
        out.push({ ...n, durationGrid: start - n.beatIndex });
        out.push({ ...n, id: `${n.id}-r`, beatIndex: end, durationGrid: nEnd - end });
        continue;
      }
      out.push(n);
    }
    return out;
  };

  const addNoteAt = (stringIndex: number, cellInWindow: number) => {
    const beatIndex = startGrid + cellInWindow;
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const note: CourseNote = { id, stringIndex, fret: 0, beatIndex, durationGrid: DEFAULT_DUR };
    const trimmed = trimOverlaps(phrase.notes, stringIndex, beatIndex, DEFAULT_DUR);
    const newLen = Math.max(phrase.lengthGrid, beatIndex + DEFAULT_DUR * 2);
    setPhrase({ notes: [...trimmed, note], lengthGrid: newLen });
    setSelectedIds([id]);
    setEditingFret({ id, value: '0' });
  };

  const deleteNotes = (ids: string[]) => {
    setPhrase({ ...phrase, notes: phrase.notes.filter(n => !ids.includes(n.id)) });
    setSelectedIds(selectedIds.filter(id => !ids.includes(id)));
  };

  // Apply picked fret from fretboard to the (single) selected note
  useEffect(() => {
    if (!pickedFretboardNote) return;
    if (pickedFretboardNote.nonce === lastPickRef.current) return;
    lastPickRef.current = pickedFretboardNote.nonce;
    if (selectedIds.length !== 1) return;
    const id = selectedIds[0];
    const n = phrase.notes.find(x => x.id === id);
    if (!n) return;
    const newString = pickedFretboardNote.stringIndex;
    const newFret = pickedFretboardNote.fret;
    // Move the note to the picked string/fret (trim overlaps on the new string)
    const trimmed = trimOverlaps(phrase.notes.filter(x => x.id !== id), newString, n.beatIndex, n.durationGrid);
    const updated = { ...n, stringIndex: newString, fret: newFret };
    setPhrase({ ...phrase, notes: [...trimmed, updated] });
  }, [pickedFretboardNote]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard delete + escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
        e.preventDefault();
        deleteNotes(selectedIds);
      }
      if (e.key === 'Escape') setSelectedIds([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, phrase.notes]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isBarLine = (cellIdx: number) => (startGrid + cellIdx) % gridPerBar === 0;
  const isBeatLine = (cellIdx: number) => (startGrid + cellIdx) % GRID_PER_BEAT === 0;
  const isAnacrusis = (cellIdx: number) => (startGrid + cellIdx) < 0;

  const noteName = (n: CourseNote): string => {
    const pc = ((tuning[n.stringIndex] ?? 0) + n.fret) % 12;
    return NOTE_NAMES[(pc + 12) % 12];
  };

  const toggleSelect = (id: string, multi: boolean) => {
    if (multi) {
      setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  // ===== Drag duration bars =====
  const dragGroup = (notes: CourseNote[], mode: 'move' | 'resize-l' | 'resize-r', e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteMode) { deleteNotes(notes.map(n => n.id)); return; }
    const startX = e.clientX;
    const startBeat = notes[0].beatIndex;
    const startDur = Math.max(...notes.map(n => n.durationGrid));
    const ids = notes.map(n => n.id);

    const onMove = (mv: MouseEvent) => {
      const deltaCells = Math.round((mv.clientX - startX) / CELL_W);
      let newBeat = startBeat;
      let newDur = startDur;
      if (mode === 'move') newBeat = startBeat + deltaCells;
      if (mode === 'resize-r') newDur = Math.max(1, startDur + deltaCells);
      if (mode === 'resize-l') {
        const nb = startBeat + deltaCells;
        const nd = startDur - deltaCells;
        if (nd >= 1) { newBeat = nb; newDur = nd; }
      }
      // Apply with overlap-trim per string
      let next = phrase.notes;
      // Pull out the moved notes
      const moved = ids.map(id => {
        const orig = phrase.notes.find(x => x.id === id);
        if (!orig) return null;
        return { ...orig, beatIndex: newBeat, durationGrid: newDur };
      }).filter(Boolean) as CourseNote[];
      // Remove originals
      next = next.filter(n => !ids.includes(n.id));
      // Trim overlaps on each affected string
      for (const m of moved) {
        next = trimOverlaps(next, m.stringIndex, m.beatIndex, m.durationGrid, m.id);
      }
      next = [...next, ...moved];
      setPhrase({ ...phrase, notes: next });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // White-tab styling: classic black-on-white tablature look
  const stringLineColor = 'rgba(0, 0, 0, 0.55)';
  const noteTextColor = 'rgb(20, 20, 20)';

  return (
    <div ref={containerRef} className="border border-border rounded-lg bg-white text-black">
      <div className="overflow-x-auto">
      <div className="relative" style={gridStyle}>
        {[5, 4, 3, 2, 1, 0].map((stringIndex) => (
          <div key={stringIndex} className="relative" style={{ height: ROW_H }}>
            <div className="absolute left-0 top-0 h-full w-6 flex items-center justify-center text-[10px] font-mono z-10"
              style={{ color: 'rgb(80,80,80)', background: 'rgba(0,0,0,0.04)', borderRight: '1px solid rgba(0,0,0,0.1)' }}>
              {STRING_LABELS[stringIndex]}
            </div>
            <div className="absolute left-6 right-0 pointer-events-none"
              style={{ top: '50%', height: 1, background: stringLineColor, transform: 'translateY(-0.5px)' }} />
            <div className="absolute inset-0 left-6 flex">
              {Array.from({ length: totalCells }).map((_, cellIdx) => (
                <button
                  key={cellIdx}
                  onClick={(e) => { if (deleteMode) return; addNoteAt(stringIndex, cellIdx); }}
                  className="transition-colors hover:bg-primary/10"
                  style={{
                    width: CELL_W,
                    height: ROW_H,
                    background: isAnacrusis(cellIdx) ? 'rgba(0,0,0,0.04)' : 'transparent',
                    borderRight: isBarLine(cellIdx + 1)
                      ? '2px solid rgba(0,0,0,0.7)'
                      : isBeatLine(cellIdx + 1)
                        ? '1px solid rgba(0,0,0,0.25)'
                        : '1px solid rgba(0,0,0,0.07)',
                  }}
                />
              ))}
            </div>
            {visibleNotes.filter(n => n.stringIndex === stringIndex).map(n => {
              const localCell = n.beatIndex - startGrid;
              const tech = n.technique;
              const isSel = selectedIds.includes(n.id);
              return (
                <div
                  key={n.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deleteMode) { deleteNotes([n.id]); return; }
                    toggleSelect(n.id, e.shiftKey || e.metaKey || e.ctrlKey);
                  }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingFret({ id: n.id, value: String(n.fret) }); }}
                  className={`absolute z-20 text-xs font-mono rounded px-1 cursor-pointer flex items-center gap-0.5 ${
                    isSel ? 'ring-2 ring-primary bg-primary/20' : 'bg-white hover:bg-primary/10'
                  } ${deleteMode ? 'ring-2 ring-destructive cursor-not-allowed' : ''}`}
                  style={{
                    left: 24 + localCell * CELL_W + 2,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: ROW_H - 6,
                    lineHeight: `${ROW_H - 6}px`,
                    minWidth: 18,
                    color: noteTextColor,
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
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingFret(null);
                      }}
                      className="w-10 bg-transparent outline-none text-black"
                    />
                  ) : (
                    <>
                      <span>{n.fret}</span>
                      {tech && <span className="text-[9px] text-primary font-bold">{TECHNIQUE_SYMBOL[tech]}</span>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Duration bars row — note-name labels, drag-resize, drag-move */}
        <div className="relative bg-muted/10" style={{ height: ROW_H + 8, borderTop: '2px solid rgba(0,0,0,0.4)' }}>
          <div className="absolute left-0 top-0 h-full w-6 flex items-center justify-center text-[9px] font-mono z-10"
            style={{ color: 'rgb(80,80,80)', background: 'rgba(0,0,0,0.04)', borderRight: '1px solid rgba(0,0,0,0.1)' }}>♪</div>
          <div className="absolute inset-0 left-6">
            {beatGroups.map(([beatIdx, notes]) => {
              const dur = Math.max(...notes.map(n => n.durationGrid));
              const kind: NoteKind = notes.length > 1
                ? 'chord'
                : (() => { const n = notes[0]; const pc = ((tuning[n.stringIndex] ?? 0) + n.fret) % 12; return diatonicPC.has(pc) ? 'diatonic' : 'non-diatonic'; })();
              const groupSelected = notes.some(n => selectedIds.includes(n.id));
              const localBeat = beatIdx - startGrid;
              const label = (() => {
                if (notes.length === 1) return noteName(notes[0]);
                const seen = new Set<string>();
                const names: string[] = [];
                for (const n of notes) {
                  const nm = noteName(n);
                  if (!seen.has(nm)) { seen.add(nm); names.push(nm); }
                }
                return names.join('-');
              })();
              return (
                <div
                  key={beatIdx}
                  className={`absolute top-1 rounded-sm flex items-center justify-center text-[10px] font-mono text-white font-bold select-none overflow-hidden ${
                    groupSelected ? 'ring-2 ring-primary' : ''
                  } ${deleteMode ? 'cursor-not-allowed ring-2 ring-destructive' : 'cursor-move'}`}
                  style={{
                    left: localBeat * CELL_W + 1,
                    width: dur * CELL_W - 2,
                    height: ROW_H,
                    backgroundColor: NOTE_KIND_COLOR[kind],
                  }}
                  onMouseDown={(e) => dragGroup(notes, 'move', e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deleteMode) { deleteNotes(notes.map(n => n.id)); return; }
                    setSelectedIds(notes.map(n => n.id));
                  }}
                  title={label}
                >
                  <div onMouseDown={(e) => dragGroup(notes, 'resize-l', e)} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
                  {label}
                  <div onMouseDown={(e) => dragGroup(notes, 'resize-r', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
                </div>
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

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/10">
          <span className="text-xs font-mono text-muted-foreground">
            {selectedIds.length === 1 ? 'Selected note' : `${selectedIds.length} notes selected`}
            {selectedIds.length === 1 && ' — pick fret on fretboard or double-click to type'}
          </span>
          <button onClick={() => deleteNotes(selectedIds)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
            <Trash2 className="size-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
