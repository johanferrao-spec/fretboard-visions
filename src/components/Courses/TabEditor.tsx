import { useMemo, useRef, useState, useEffect } from 'react';
import type { CoursePhrase, CourseNote, NoteKind, Technique, ChordTrackEntry } from '@/lib/courseTypes';
import { GRID_PER_BEAT, NOTE_KIND_COLOR } from '@/lib/courseTypes';
import { NOTE_NAMES, SCALE_FORMULAS, SCALE_DEGREE_COLORS } from '@/lib/music';
import { KEY_QUALITY_SCALE, type KeyQuality } from '@/lib/courseTypes';
import type { NoteName } from '@/lib/music';
import { Trash2, Grid3x3, Music, ChevronDown, Palette } from 'lucide-react';

/** Subdivision options. Step = grid units between consecutive snap points. */
export type Subdivision = '1/4' | '1/6' | '1/8' | '1/12' | '1/16' | '1/24';
const SUBDIVISION_STEP: Record<Subdivision, number> = {
  '1/4': GRID_PER_BEAT,           // 4
  '1/6': GRID_PER_BEAT * 2 / 3,   // 8/3 ≈ 2.667 (triplet half-beat)
  '1/8': GRID_PER_BEAT / 2,       // 2
  '1/12': GRID_PER_BEAT / 3,      // 4/3 ≈ 1.333 (eighth-note triplet)
  '1/16': 1,                       // 1
  '1/24': GRID_PER_BEAT / 6,      // 2/3 ≈ 0.667 (sixteenth triplet)
};
const SUBDIVISION_LABEL: Record<Subdivision, string> = {
  '1/4': 'Quarter',
  '1/6': 'Quarter triplet',
  '1/8': 'Eighth',
  '1/12': 'Eighth triplet',
  '1/16': 'Sixteenth',
  '1/24': 'Sixteenth triplet',
};

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
  pickedFretboardNote?: { stringIndex: number; fret: number; nonce: number } | null;
  deleteMode: boolean;
  /** Draggable playhead position in grid units (parent-controlled). */
  cursorGrid: number;
  setCursorGrid: (g: number) => void;
  /** Currently selected subdivision (lifted to parent for shared default duration). */
  subdivision: Subdivision;
  setSubdivision: (s: Subdivision) => void;
  /** Cell width in px (controlled by parent so global tracks can match). */
  cellW: number;
  setCellW: (w: number) => void;
  /** Chord lane entries — used for degree-colour mode. */
  chordTrack: ChordTrackEntry[];
  /** Hide the local bar-marker row (when parent renders a shared one above). */
  hideBarRow?: boolean;
}

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const ROW_H = 26;
const BAR_ROW_H = 18;
/** Shared gutter width across TabEditor + GlobalTracksEditor so columns align. */
export const TAB_LABEL_W = 64;
export const MIN_CELL_W = 14;
export const MAX_CELL_W = 56;
const LABEL_W = TAB_LABEL_W;

export function TabEditor({
  phrase, setPhrase, tuning, keyRoot, keyQuality, beatsPerBar,
  selectedIds, setSelectedIds, startGrid = 0, visibleGrids, playheadGrid,
  pickedFretboardNote, deleteMode, cursorGrid, setCursorGrid,
  subdivision, setSubdivision, cellW, setCellW, chordTrack, hideBarRow,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingFret, setEditingFret] = useState<{ id: string; value: string } | null>(null);
  const lastPickRef = useRef<number>(0);
  /** Grid display mode: '16th' = subdivision lines per current subdivision; 'rests' = no subdivisions. */
  const [gridMode, setGridMode] = useState<'16th' | 'rests'>('16th');
  const [subOpen, setSubOpen] = useState(false);
  /** Degree-colour mode: tints fret-number cells by their scale degree relative to the chord at that beat. */
  const [degreeColours, setDegreeColours] = useState(false);
  const CELL_W = cellW;

  /** The default duration of a new note equals the current subdivision length. */
  const defaultDur = SUBDIVISION_STEP[subdivision];

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

  /**
   * Trim notes that overlap [start, start+dur).
   * If `crossString` is true, trims notes on ANY string that start AFTER `start` but before `start+dur`,
   * shortening the new note (returned) to end exactly at the next note's start.
   * Always trims same-string overlaps as before.
   */
  const trimOverlaps = (notes: CourseNote[], stringIndex: number, start: number, dur: number, ignoreId?: string): CourseNote[] => {
    const end = start + dur;
    const out: CourseNote[] = [];
    for (const n of notes) {
      if (n.id === ignoreId || n.stringIndex !== stringIndex) { out.push(n); continue; }
      const nEnd = n.beatIndex + n.durationGrid;
      if (nEnd <= start || n.beatIndex >= end) { out.push(n); continue; }
      if (n.beatIndex >= start && nEnd <= end) continue;
      if (n.beatIndex < start && nEnd > start && nEnd <= end) {
        out.push({ ...n, durationGrid: start - n.beatIndex });
        continue;
      }
      if (n.beatIndex >= start && n.beatIndex < end && nEnd > end) {
        out.push({ ...n, beatIndex: end, durationGrid: nEnd - end });
        continue;
      }
      if (n.beatIndex < start && nEnd > end) {
        out.push({ ...n, durationGrid: start - n.beatIndex });
        out.push({ ...n, id: `${n.id}-r`, beatIndex: end, durationGrid: nEnd - end });
        continue;
      }
      out.push(n);
    }
    return out;
  };

  /**
   * Trim any earlier note (any string) whose duration crosses into `start`,
   * shortening it to end exactly at `start`. Used to prevent visual chord bars
   * when consecutive notes are entered close together on different strings.
   */
  const shortenPreviousAtStart = (notes: CourseNote[], start: number, ignoreId?: string): CourseNote[] => {
    return notes.map(n => {
      if (n.id === ignoreId) return n;
      const nEnd = n.beatIndex + n.durationGrid;
      if (n.beatIndex < start && nEnd > start) {
        return { ...n, durationGrid: start - n.beatIndex };
      }
      return n;
    });
  };

  /** Snap an absolute grid index to the active subdivision. */
  const snapGrid = (g: number) => {
    const step = SUBDIVISION_STEP[subdivision];
    return Math.round(g / step) * step;
  };

  const addNoteAt = (stringIndex: number, cellInWindow: number) => {
    const beatIndex = snapGrid(startGrid + cellInWindow);
    // Block: no two notes may share the same string at the same beat instant
    const collision = phrase.notes.find(n => n.stringIndex === stringIndex && Math.abs(n.beatIndex - beatIndex) < 0.001);
    if (collision) {
      setSelectedIds([collision.id]);
      setEditingFret({ id: collision.id, value: String(collision.fret) });
      return;
    }
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const dur = defaultDur;
    const note: CourseNote = { id, stringIndex, fret: 0, beatIndex, durationGrid: dur };
    let next = trimOverlaps(phrase.notes, stringIndex, beatIndex, dur);
    next = shortenPreviousAtStart(next, beatIndex);
    const newLen = Math.max(phrase.lengthGrid, beatIndex + dur * 2);
    setPhrase({ notes: [...next, note], lengthGrid: newLen });
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
    if (editingFret) {
      setEditingFret({ id: editingFret.id, value: String(pickedFretboardNote.fret) });
      // Also move the note's string if different
      const n = phrase.notes.find(x => x.id === editingFret.id);
      if (n && n.stringIndex !== pickedFretboardNote.stringIndex) {
        const trimmed = trimOverlaps(
          phrase.notes.filter(x => x.id !== editingFret.id),
          pickedFretboardNote.stringIndex, n.beatIndex, n.durationGrid,
        );
        setPhrase({ ...phrase, notes: [...trimmed, { ...n, stringIndex: pickedFretboardNote.stringIndex, fret: pickedFretboardNote.fret }] });
      } else if (n) {
        updateNote(editingFret.id, { fret: pickedFretboardNote.fret });
      }
      return;
    }
    if (selectedIds.length !== 1) return;
    const id = selectedIds[0];
    const n = phrase.notes.find(x => x.id === id);
    if (!n) return;
    const newString = pickedFretboardNote.stringIndex;
    const newFret = pickedFretboardNote.fret;
    // Block move if a different note already occupies that exact slot
    const conflict = phrase.notes.find(x => x.id !== id && x.stringIndex === newString && x.beatIndex === n.beatIndex);
    if (conflict) return;
    const trimmed = trimOverlaps(phrase.notes.filter(x => x.id !== id), newString, n.beatIndex, n.durationGrid);
    setPhrase({ ...phrase, notes: [...trimmed, { ...n, stringIndex: newString, fret: newFret }] });
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

  /**
   * Group notes for the duration bar row.
   * Chord = notes that share the EXACT same start beat. Notes that merely overlap
   * (e.g. an 1/8 followed by a 1/16 on a different string) must NOT be merged into
   * a chord — instead the earlier note will be trimmed by the insertion logic.
   */
  const beatGroups = useMemo(() => {
    const groups = new Map<number, CourseNote[]>();
    for (const n of visibleNotes) {
      const key = Math.round(n.beatIndex * 1000) / 1000; // float-safe key
      const arr = groups.get(key) ?? [];
      arr.push(n);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([start, notes]) => {
        const dur = Math.max(...notes.map(n => n.durationGrid));
        return [start, notes, dur] as [number, CourseNote[], number];
      });
  }, [visibleNotes]);

  /**
   * Compute "rest spans" — gaps in the rhythm row where no note is sounding.
   * Walks the visible window beat-by-subdivision and emits a rest span for each
   * contiguous empty stretch. Each span is then split into musical rest values
   * (whole, half, quarter, eighth, sixteenth) with proper glyphs.
   */
  const REST_GLYPHS: Array<{ grid: number; glyph: string }> = [
    { grid: GRID_PER_BEAT * 4, glyph: '𝄻' }, // whole rest (4 beats)
    { grid: GRID_PER_BEAT * 2, glyph: '𝄼' }, // half rest
    { grid: GRID_PER_BEAT,     glyph: '𝄽' }, // quarter rest
    { grid: GRID_PER_BEAT / 2, glyph: '𝄾' }, // eighth rest
    { grid: GRID_PER_BEAT / 4, glyph: '𝄿' }, // sixteenth rest
  ];
  const restGlyphs = useMemo(() => {
    if (gridMode !== 'rests') return [] as Array<{ x: number; glyph: string; w: number }>;
    // Build a sorted list of "occupied" intervals (across ALL strings).
    const intervals = phrase.notes
      .map(n => [n.beatIndex, n.beatIndex + n.durationGrid] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    // Merge overlapping intervals.
    const merged: Array<[number, number]> = [];
    for (const [s, e] of intervals) {
      if (merged.length === 0 || s > merged[merged.length - 1][1]) merged.push([s, e]);
      else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    }
    // Walk the visible window, finding gaps between merged intervals.
    const out: Array<{ x: number; glyph: string; w: number }> = [];
    let cursor = startGrid;
    const end = startGrid + totalCells;
    const emitRests = (from: number, to: number) => {
      let pos = from;
      while (pos < to - 0.001) {
        const remaining = to - pos;
        // Pick the largest rest value that fits AND aligns to the beat grid where possible.
        const chosen = REST_GLYPHS.find(r => r.grid <= remaining + 0.001) ?? REST_GLYPHS[REST_GLYPHS.length - 1];
        const w = chosen.grid * CELL_W;
        out.push({ x: (pos - startGrid) * CELL_W + w / 2 - 6, glyph: chosen.glyph, w });
        pos += chosen.grid;
      }
    };
    for (const [s, e] of merged) {
      if (e <= startGrid) continue;
      if (s >= end) break;
      const gapStart = Math.max(cursor, startGrid);
      const gapEnd = Math.min(s, end);
      if (gapEnd > gapStart) emitRests(gapStart, gapEnd);
      cursor = Math.max(cursor, e);
    }
    if (cursor < end) emitRests(Math.max(cursor, startGrid), end);
    return out;
  }, [gridMode, phrase.notes, startGrid, totalCells]);

  // (Default duration is now driven by the lifted `subdivision` prop. Selecting a single
  // note no longer mutates the default — the subdivision dropdown is the source of truth.)

  const gridStyle: React.CSSProperties = { width: totalCells * CELL_W, minWidth: '100%' };

  const isAnacrusis = (cellIdx: number) => (startGrid + cellIdx) < 0;

  const noteName = (n: CourseNote): string => {
    const pc = ((tuning[n.stringIndex] ?? 0) + n.fret) % 12;
    return NOTE_NAMES[(pc + 12) % 12];
  };

  /** Major-scale interval table for measuring degree from a chord root. */
  const MAJ_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
  /** Find the chord (from chordTrack) that's sounding at a given grid position. */
  const chordAtBeat = (g: number): ChordTrackEntry | null => {
    for (const c of chordTrack) {
      if (g >= c.beatIndex && g < c.beatIndex + c.durationGrid) return c;
    }
    return null;
  };
  /** Compute the scale-degree colour (HSL string) for a note relative to the chord at its beat. */
  const noteDegreeColour = (n: CourseNote): string | null => {
    const chord = chordAtBeat(n.beatIndex);
    let rootPc: number;
    if (chord) {
      rootPc = NOTE_NAMES.indexOf(chord.root);
    } else {
      // Fallback: use the lesson's key root.
      rootPc = NOTE_NAMES.indexOf(keyRoot);
    }
    if (rootPc < 0) return null;
    const notePc = ((tuning[n.stringIndex] ?? 0) + n.fret) % 12;
    const interval = ((notePc - rootPc) % 12 + 12) % 12;
    const degIdx = MAJ_INTERVALS.indexOf(interval);
    if (degIdx >= 0) return SCALE_DEGREE_COLORS[degIdx];
    // Chromatic note → muted grey
    return '0, 0%, 50%';
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
      let next = phrase.notes;
      const moved = ids.map(id => {
        const orig = phrase.notes.find(x => x.id === id);
        if (!orig) return null;
        return { ...orig, beatIndex: newBeat, durationGrid: newDur };
      }).filter(Boolean) as CourseNote[];
      next = next.filter(n => !ids.includes(n.id));
      for (const m of moved) {
        next = trimOverlaps(next, m.stringIndex, m.beatIndex, m.durationGrid, m.id);
      }
      next = [...next, ...moved];
      setPhrase({ ...phrase, notes: next });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const stringLineColor = 'rgba(0, 0, 0, 0.55)';
  const noteTextColor = 'rgb(20, 20, 20)';

  // ===== Marquee box selection =====
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const startMarquee = (e: React.MouseEvent) => {
    if (deleteMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-note]') || target.closest('[data-duration-bar]')) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMarquee({ x0: x, y0: y, x1: x, y1: y });

    const onMove = (mv: MouseEvent) => {
      const r = gridRef.current?.getBoundingClientRect();
      if (!r) return;
      setMarquee(m => m ? { ...m, x1: mv.clientX - r.left, y1: mv.clientY - r.top } : null);
    };
    const onUp = (mv: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const r = gridRef.current?.getBoundingClientRect();
      if (!r) { setMarquee(null); return; }
      const x1 = mv.clientX - r.left, y1 = mv.clientY - r.top;
      const minX = Math.min(x, x1), maxX = Math.max(x, x1);
      const minY = Math.min(y, y1), maxY = Math.max(y, y1);
      // Pure click (no drag) → deselect
      if (Math.abs(x1 - x) < 5 && Math.abs(y1 - y) < 5) {
        setSelectedIds([]);
        setMarquee(null);
        return;
      }
      const hits: string[] = [];
      for (const n of visibleNotes) {
        const localCell = n.beatIndex - startGrid;
        const noteX = LABEL_W + localCell * CELL_W;
        const noteW = Math.max(CELL_W, n.durationGrid * CELL_W);
        const visibleRowIdx = [5, 4, 3, 2, 1, 0].indexOf(n.stringIndex);
        const noteY = BAR_ROW_H + visibleRowIdx * ROW_H;
        const noteY2 = noteY + ROW_H;
        if (noteX + noteW < minX || noteX > maxX) continue;
        if (noteY2 < minY || noteY > maxY) continue;
        hits.push(n.id);
      }
      setSelectedIds(hits);
      setMarquee(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ===== Bar number markers (drawn at the SAME x as bar gridlines for perfect alignment) =====
  const barMarkers = useMemo(() => {
    const out: Array<{ x: number; barNumber: number }> = [];
    for (let cell = 0; cell <= totalCells; cell++) {
      const abs = startGrid + cell;
      if (abs % gridPerBar === 0) {
        out.push({ x: cell * CELL_W, barNumber: Math.floor(abs / gridPerBar) + 1 });
      }
    }
    return out;
  }, [startGrid, totalCells, gridPerBar]);

  /**
   * Vertical lines (bar + beat + subdivision) drawn as absolute overlays so positions are exact.
   * In '16th' mode we also draw subdivision lines according to the current subdivision.
   * Subdivision step can be fractional (triplets), so we generate from absolute time, not cells.
   */
  const verticalLines = useMemo(() => {
    const lines: Array<{ x: number; kind: 'bar' | 'beat' | 'sub' }> = [];
    const step = SUBDIVISION_STEP[subdivision];
    // Bar lines are ALWAYS drawn (orientation anchor). Beat + sub lines only in '16th' mode.
    for (let cell = 0; cell <= totalCells; cell++) {
      const abs = startGrid + cell;
      if (abs % gridPerBar === 0) {
        lines.push({ x: cell * CELL_W, kind: 'bar' });
      } else if (gridMode === '16th' && abs % GRID_PER_BEAT === 0) {
        lines.push({ x: cell * CELL_W, kind: 'beat' });
      }
    }
    if (gridMode === '16th') {
      const startAbs = startGrid;
      const endAbs = startGrid + totalCells;
      const firstTick = Math.ceil(startAbs / step) * step;
      for (let t = firstTick; t < endAbs + 0.0001; t += step) {
        const cellPos = t - startAbs;
        const onBar = Math.abs((startAbs + cellPos) % gridPerBar) < 0.0001;
        const onBeat = Math.abs((startAbs + cellPos) % GRID_PER_BEAT) < 0.0001;
        if (onBar || onBeat) continue;
        lines.push({ x: cellPos * CELL_W, kind: 'sub' });
      }
    }
    return lines;
  }, [totalCells, startGrid, gridPerBar, gridMode, subdivision, CELL_W]);

  // ===== Tab-style technique notation rendering (slurs, slides, bends, etc.) =====
  /** Find the next note on the same string after a given note. */
  const nextOnString = (n: CourseNote): CourseNote | null => {
    const cands = phrase.notes
      .filter(x => x.stringIndex === n.stringIndex && x.beatIndex > n.beatIndex)
      .sort((a, b) => a.beatIndex - b.beatIndex);
    return cands[0] ?? null;
  };

  /** Tab-row Y for a given stringIndex (relative to the grid container). */
  const stringRowY = (stringIndex: number) => {
    const visibleRowIdx = [5, 4, 3, 2, 1, 0].indexOf(stringIndex);
    return BAR_ROW_H + visibleRowIdx * ROW_H + ROW_H / 2;
  };

  /** SVG layer for technique notation (slurs for h/p, slide lines, bend arrows, vibrato squiggles). */
  const techOverlay = useMemo(() => {
    const elems: React.ReactNode[] = [];
    visibleNotes.forEach(n => {
      if (!n.technique) return;
      const t = n.technique;
      const xStart = LABEL_W + (n.beatIndex - startGrid) * CELL_W + CELL_W / 2;
      const y = stringRowY(n.stringIndex);
      const next = nextOnString(n);
      const xEnd = next ? LABEL_W + (next.beatIndex - startGrid) * CELL_W + CELL_W / 2 : xStart + CELL_W;

      if (t === 'hammer' || t === 'pull') {
        // Slur: arc above the two fret numbers, with 'h' or 'p' label
        const cx = (xStart + xEnd) / 2;
        const cy = y - 14;
        elems.push(
          <g key={`tech-${n.id}`}>
            <path d={`M ${xStart} ${y - 10} Q ${cx} ${cy - 4} ${xEnd} ${y - 10}`}
              fill="none" stroke="rgb(20,20,20)" strokeWidth={1.2} />
            <text x={cx} y={cy - 6} fontSize={9} fontFamily="monospace" textAnchor="middle" fill="rgb(20,20,20)">
              {t === 'hammer' ? 'H' : 'P'}
            </text>
          </g>
        );
      } else if (t === 'slide-up' || t === 'slide-down') {
        // Diagonal line between fret numbers; / for up, \ for down
        const dy = t === 'slide-up' ? -3 : 3;
        elems.push(
          <line key={`tech-${n.id}`}
            x1={xStart + 6} y1={y + dy} x2={xEnd - 6} y2={y - dy}
            stroke="rgb(20,20,20)" strokeWidth={1.4} />
        );
      } else if (t === 'bend' || t === 'release') {
        // Upward arrow with "1/2" or full bend label; "release" mirrors arrow downward
        const up = t === 'bend';
        const top = y - 16;
        elems.push(
          <g key={`tech-${n.id}`}>
            <path d={up
              ? `M ${xStart} ${y - 8} Q ${xStart + 8} ${top} ${xStart + 16} ${top + 2}`
              : `M ${xStart + 16} ${top + 2} Q ${xStart + 8} ${top} ${xStart} ${y - 8}`}
              fill="none" stroke="rgb(20,20,20)" strokeWidth={1.2}
              markerEnd={up ? 'url(#arrowUp)' : 'url(#arrowDown)'} />
            <text x={xStart + 18} y={top + 4} fontSize={8} fontFamily="monospace" fill="rgb(20,20,20)">
              {up ? 'full' : 'rel'}
            </text>
          </g>
        );
      } else if (t === 'vibrato') {
        // Squiggle line above the note
        const len = 18;
        const path: string[] = [`M ${xStart} ${y - 12}`];
        for (let i = 0; i < 4; i++) {
          const x0 = xStart + (i / 4) * len;
          const x1 = xStart + ((i + 0.5) / 4) * len;
          const x2 = xStart + ((i + 1) / 4) * len;
          path.push(`Q ${x1} ${y - 16} ${x2} ${y - 12}`);
        }
        elems.push(
          <path key={`tech-${n.id}`} d={path.join(' ')} fill="none" stroke="rgb(20,20,20)" strokeWidth={1} />
        );
      } else if (t === 'palm-mute') {
        // P.M. with dashed line over the duration
        const x2 = LABEL_W + (n.beatIndex + n.durationGrid - startGrid) * CELL_W;
        elems.push(
          <g key={`tech-${n.id}`}>
            <text x={xStart - 4} y={y - 12} fontSize={8} fontFamily="monospace" fill="rgb(20,20,20)">P.M.</text>
            <line x1={xStart + 16} y1={y - 14} x2={x2} y2={y - 14}
              stroke="rgb(20,20,20)" strokeWidth={1} strokeDasharray="3 2" />
          </g>
        );
      } else if (t === 'tap') {
        elems.push(
          <text key={`tech-${n.id}`} x={xStart} y={y - 12} fontSize={9} fontFamily="monospace" fontWeight="bold"
            textAnchor="middle" fill="rgb(20,20,20)">T</text>
        );
      } else if (t === 'harmonic') {
        // Diamond around fret number — render a small diamond above
        elems.push(
          <g key={`tech-${n.id}`}>
            <polygon points={`${xStart - 5},${y - 12} ${xStart},${y - 17} ${xStart + 5},${y - 12} ${xStart},${y - 7}`}
              fill="none" stroke="rgb(20,20,20)" strokeWidth={1} />
          </g>
        );
      }
    });
    return elems;
  }, [visibleNotes, phrase.notes, startGrid]);

  // ===== Trackpad / Ctrl+wheel zoom on the tab grid =====
  const onWheelZoom = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.05;
    const next = Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, cellW + delta));
    setCellW(next);
  };

  return (
    <div ref={containerRef} className="border border-border rounded-lg bg-white text-black">
      {/* Toolbar above tab: grid mode + degree-colour toggle + subdivision */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setGridMode('16th')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
              gridMode === '16th' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
            title="Show subdivision grid lines"
          >
            <Grid3x3 className="size-3" /> Grid
          </button>
          <button
            onClick={() => setGridMode('rests')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
              gridMode === 'rests' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
            title="Hide all subdivisions; show rest symbols"
          >
            <Music className="size-3" /> Rests
          </button>
          <button
            onClick={() => setDegreeColours(d => !d)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
              degreeColours ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
            title="Colour fret cells by their scale degree relative to the chord at that beat"
          >
            <Palette className="size-3" /> Degree colours
          </button>
        </div>
        <div className="flex items-center gap-3 relative">
          <span className="text-[10px] font-mono text-muted-foreground">Default duration · ⌘/Ctrl+scroll = zoom</span>
          <button
            onClick={() => setSubOpen(o => !o)}
            className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded px-2 py-1 text-[10px] font-mono uppercase tracking-wider hover:bg-secondary/80"
          >
            {subdivision} <ChevronDown className="size-3" />
          </button>
          {subOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg min-w-[10rem] py-1">
              {(Object.keys(SUBDIVISION_LABEL) as Subdivision[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setSubdivision(s); setSubOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent ${s === subdivision ? 'bg-accent text-accent-foreground' : 'text-popover-foreground'}`}
                >
                  <span className="font-bold mr-2">{s}</span>
                  <span className="text-muted-foreground">{SUBDIVISION_LABEL[s]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
      <div className="overflow-x-auto" onWheel={onWheelZoom}>
      <div ref={gridRef} className="relative" style={gridStyle} onMouseDown={startMarquee}>
        {/* SVG defs for arrows */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <marker id="arrowUp" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="rgb(20,20,20)" />
            </marker>
            <marker id="arrowDown" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="rgb(20,20,20)" />
            </marker>
          </defs>
        </svg>

        {/* Bar numbers row — clickable to set the cursor. Hidden when parent renders a shared bar row. */}
        {!hideBarRow && (
          <div
            className="relative cursor-pointer"
            style={{ height: BAR_ROW_H, borderBottom: '1px solid rgba(0,0,0,0.15)' }}
            onMouseDown={(e) => {
              // Click anywhere on the bar row → snap cursor to that grid position.
              if ((e.target as HTMLElement).closest('[data-cursor-handle]')) return;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = e.clientX - rect.left - LABEL_W;
              if (x < 0) return;
              const cell = x / CELL_W;
              setCursorGrid(snapGrid(startGrid + cell));
              e.stopPropagation();
            }}
            title="Click to move the insertion cursor"
          >
            <div className="absolute left-0 top-0 h-full z-10 pointer-events-none" style={{ width: LABEL_W, background: 'rgba(0,0,0,0.04)', borderRight: '1px solid rgba(0,0,0,0.1)' }} />
            <div className="absolute inset-0" style={{ left: LABEL_W }}>
              {barMarkers.map(({ x, barNumber }) => (
                <div key={`bar-${barNumber}`}
                  className="absolute top-0 bottom-0 flex items-center text-[10px] font-mono font-bold pointer-events-none"
                  style={{
                    left: x,
                    paddingLeft: 3,
                    color: 'rgb(0,0,0)',
                  }}
                >{barNumber}</div>
              ))}
            </div>
          </div>
        )}

        {/* String rows */}
        <div className="relative">
          {[5, 4, 3, 2, 1, 0].map((stringIndex) => (
            <div key={stringIndex} className="relative" style={{ height: ROW_H }}>
              <div className="absolute left-0 top-0 h-full flex items-center justify-center text-[10px] font-mono z-10"
                style={{ width: LABEL_W, color: 'rgb(80,80,80)', background: 'rgba(0,0,0,0.04)', borderRight: '1px solid rgba(0,0,0,0.1)' }}>
                {STRING_LABELS[stringIndex]}
              </div>
              <div className="absolute pointer-events-none"
                style={{ left: LABEL_W, right: 0, top: '50%', height: 1, background: stringLineColor, transform: 'translateY(-0.5px)' }} />
              {/* Hit-test cells (no per-cell border — gridlines come from the absolute overlay below) */}
              <div className="absolute inset-0 flex" style={{ left: LABEL_W }}>
                {Array.from({ length: totalCells }).map((_, cellIdx) => (
                  <button
                    key={cellIdx}
                    onDoubleClick={(e) => { e.stopPropagation(); if (deleteMode) return; addNoteAt(stringIndex, cellIdx); }}
                    className="transition-colors hover:bg-primary/5"
                    style={{
                      width: CELL_W,
                      height: ROW_H,
                      background: isAnacrusis(cellIdx) ? 'rgba(0,0,0,0.04)' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Vertical bar/beat/subdivision lines — single source of truth for gridlines */}
          <div className="absolute inset-0 pointer-events-none" style={{ left: LABEL_W }}>
            {verticalLines.map((l, i) => (
              <div key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: l.x,
                  width: l.kind === 'bar' ? 2 : 1,
                  marginLeft: l.kind === 'bar' ? -1 : 0,
                  background: l.kind === 'bar'
                    ? 'rgba(0,0,0,0.7)'
                    : l.kind === 'beat'
                      ? 'rgba(0,0,0,0.22)'
                      : 'rgba(0,0,0,0.07)',
                }}
              />
            ))}
          </div>

          {/* Note markers (fret numbers) — absolute over string rows */}
          <div className="absolute inset-0 pointer-events-none" style={{ left: LABEL_W }}>
            {visibleNotes.map(n => {
              const localCell = n.beatIndex - startGrid;
              const tech = n.technique;
              const isSel = selectedIds.includes(n.id);
              const fretText = String(n.fret);
              const noteW = Math.min(CELL_W, Math.max(16, fretText.length * 8 + 8));
              const cellLeft = localCell * CELL_W;
              const left = cellLeft + (CELL_W - noteW) / 2;
              const visibleRowIdx = [5, 4, 3, 2, 1, 0].indexOf(n.stringIndex);
              const top = visibleRowIdx * ROW_H + ROW_H / 2;
              return (
                <div
                  key={n.id}
                  data-note
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deleteMode) { deleteNotes([n.id]); return; }
                    toggleSelect(n.id, e.shiftKey || e.metaKey || e.ctrlKey);
                  }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingFret({ id: n.id, value: String(n.fret) }); }}
                  className={`absolute pointer-events-auto z-20 text-xs font-mono cursor-pointer flex items-center justify-center rounded ${
                    isSel ? 'ring-2 ring-primary' : ''
                  } ${deleteMode ? 'ring-2 ring-destructive cursor-not-allowed' : ''}`}
                  style={{
                    left,
                    top,
                    transform: 'translateY(-50%)',
                    width: noteW,
                    height: ROW_H - 8,
                    lineHeight: `${ROW_H - 8}px`,
                    color: degreeColours ? 'white' : noteTextColor,
                    background: degreeColours
                      ? `hsl(${noteDegreeColour(n) ?? '0, 0%, 50%'})`
                      : 'white',
                    textShadow: degreeColours ? '0 1px 1px rgba(0,0,0,0.4)' : undefined,
                    paddingLeft: 2,
                    paddingRight: 2,
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
                        if (e.key === 'Enter') {
                          const v = parseInt(editingFret.value, 10);
                          if (!isNaN(v) && v >= 0 && v <= 24) updateNote(n.id, { fret: v });
                          setEditingFret(null);
                        }
                        if (e.key === 'Escape') setEditingFret(null);
                      }}
                      className="w-full bg-transparent outline-none text-black text-center"
                    />
                  ) : (
                    <span className="text-center">{n.fret}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Rest glyphs in 'rests' mode are rendered in the duration-bar row below — not per string. */}

          {/* Technique overlay (slurs, slides, bends, etc.) */}
          <svg className="absolute inset-0 pointer-events-none" style={{ left: 0, width: '100%', height: 6 * ROW_H }}>
            {techOverlay}
          </svg>
        </div>

        {/* Duration bars row — note-name labels, drag-resize, drag-move; double-click adds new */}
        <div className="relative bg-muted/10" style={{ height: ROW_H + 8, borderTop: '2px solid rgba(0,0,0,0.4)' }}
          onDoubleClick={(e) => {
            if (deleteMode) return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left - LABEL_W;
            if (x < 0) return;
            const cellIdx = Math.floor(x / CELL_W);
            const targetString = selectedIds.length === 1
              ? (phrase.notes.find(n => n.id === selectedIds[0])?.stringIndex ?? 5)
              : 5;
            addNoteAt(targetString, cellIdx);
          }}
        >
          <div className="absolute left-0 top-0 h-full flex items-center justify-center text-[9px] font-mono z-10"
            style={{ width: LABEL_W, color: 'rgb(80,80,80)', background: 'rgba(0,0,0,0.04)', borderRight: '1px solid rgba(0,0,0,0.1)' }}>♪</div>
          <div className="absolute inset-0" style={{ left: LABEL_W }}>
            {beatGroups.map(([beatIdx, notes, clusterDur]) => {
              const dur = clusterDur;
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
                  data-duration-bar
                  className={`absolute top-1 rounded-sm flex items-center justify-center text-[10px] font-mono text-white font-bold select-none overflow-hidden ${
                    groupSelected ? 'ring-2 ring-primary' : ''
                  } ${deleteMode ? 'cursor-not-allowed ring-2 ring-destructive' : 'cursor-move'}`}
                  style={{
                    left: localBeat * CELL_W + 1,
                    width: dur * CELL_W - 2,
                    height: ROW_H,
                    backgroundColor: NOTE_KIND_COLOR[kind],
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); dragGroup(notes, 'move', e); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deleteMode) { deleteNotes(notes.map(n => n.id)); return; }
                    setSelectedIds(notes.map(n => n.id));
                  }}
                  title={label}
                >
                  <div onMouseDown={(e) => { e.stopPropagation(); dragGroup(notes, 'resize-l', e); }} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
                  {label}
                  <div onMouseDown={(e) => { e.stopPropagation(); dragGroup(notes, 'resize-r', e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
                </div>
              );
            })}
            {/* Rest glyphs (only in 'rests' mode) — sit in the gaps between duration bars. */}
            {restGlyphs.map((r, i) => (
              <div
                key={`rest-${i}`}
                className="absolute pointer-events-none select-none flex items-center justify-center text-black"
                style={{
                  left: r.x,
                  top: 0,
                  height: ROW_H,
                  width: 12,
                  fontSize: 22,
                  lineHeight: `${ROW_H}px`,
                  fontFamily: '"Bravura", "Noto Music", serif',
                }}
              >{r.glyph}</div>
            ))}
          </div>
        </div>

        {/* Marquee selection rectangle */}
        {marquee && (
          <div
            className="absolute pointer-events-none border-2 border-primary bg-primary/10 z-40"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}

        {/* Playhead (live during playback) */}
        {playheadGrid != null && playheadGrid >= startGrid && playheadGrid < startGrid + totalCells && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none transition-[left] duration-150"
            style={{ left: LABEL_W + (playheadGrid - startGrid) * CELL_W, boxShadow: '0 0 8px hsl(var(--primary))' }} />
        )}

        {/* Insertion cursor (draggable when stopped) — orange triangle + dotted line */}
        {(playheadGrid == null) && cursorGrid >= startGrid && cursorGrid <= startGrid + totalCells && (
          <>
            <div
              data-cursor-handle
              className="absolute z-40 cursor-ew-resize"
              style={{
                left: LABEL_W + (cursorGrid - startGrid) * CELL_W - 6,
                top: 0,
                width: 12,
                height: BAR_ROW_H,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const rect = gridRef.current?.getBoundingClientRect();
                if (!rect) return;
                const onMove = (mv: MouseEvent) => {
                  const x = mv.clientX - rect.left - LABEL_W;
                  const cell = Math.max(0, x / CELL_W);
                  setCursorGrid(snapGrid(startGrid + cell));
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              title="Drag to move insertion cursor"
            >
              <svg viewBox="0 0 12 18" width="12" height={BAR_ROW_H}>
                <polygon points="6,18 0,4 12,4" fill="hsl(28, 90%, 55%)" stroke="rgb(0,0,0)" strokeWidth="0.5" />
              </svg>
            </div>
            <div className="absolute top-0 bottom-0 pointer-events-none z-30"
              style={{
                left: LABEL_W + (cursorGrid - startGrid) * CELL_W,
                width: 1,
                background: 'hsl(28, 90%, 55%)',
                opacity: 0.7,
                borderLeft: '1px dashed hsl(28, 90%, 55%)',
              }} />
          </>
        )}
      </div>
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
