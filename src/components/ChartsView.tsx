import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X, Loader2, Group, Trash2, GripVertical, Upload, Undo2, Music4, Plus } from 'lucide-react';
import { analyze } from 'web-audio-beat-detector';

import type { NoteName, KeyMode } from '@/lib/music';
import { getDiatonicChords, getChordDegree, SCALE_DEGREE_COLORS } from '@/lib/music';
import { parseChordSymbol } from '@/lib/chordParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ChordBuilder } from '@/components/ChordReference';
import { ScaleRootSelector } from '@/components/ControlPanel';
import type { TimelineChord } from '@/hooks/useSongTimeline';
import { slotsFromBarText, parseMmSs, secondsToBarIndex, type AnalyzedSong } from '@/lib/analyzedSongImport';

const ACCEPTED_AUDIO_MIME = new Set([
  'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mp3', 'audio/mpeg',
  'audio/aiff', 'audio/x-aiff',
  'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-flac',
]);
const MAX_AUDIO_SECONDS = 240;

const STORAGE_KEY = 'chartsView.state.v1';

interface DiatonicChord {
  root: NoteName;
  type: string;
  symbol: string;
  roman: string;
}

export interface ChartChord {
  root: NoteName;
  chordType: string;
}

export interface ChartSlot {
  id: string;
  /** How many 1/8-bar units this slot spans (min 1). 8 = one bar. */
  bars: number;
  chord?: ChartChord;
}

interface ChartsViewProps {
  currentKey: NoteName;
  keyMode: KeyMode;
  onToggleCharts?: () => void;
  /** Fired whenever the arrangement (or its underlying chords) change, so the
      parent can push the resulting chord progression into the backing-track timeline. */
  onArrangementChange?: (data: { chords: TimelineChord[]; measures: number; bpm: number }) => void;
}

/** 1 grid column = 1/8 bar. 32 columns per row = 4 bars per row. */
const UNITS_PER_BAR = 8;
const BARS_PER_ROW = 4;
const COLS = BARS_PER_ROW * UNITS_PER_BAR;
const DEFAULT_SLOT_COUNT = 32;
let nextId = 1;
const uid = (prefix: string) => `${prefix}-${nextId++}`;

const makeSlots = (n: number): ChartSlot[] =>
  Array.from({ length: n }, () => ({ id: uid('slot'), bars: UNITS_PER_BAR }));

const EIGHTH_LABELS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

const formatBarNumber = (startEighth: number): string => {
  const bar = Math.floor(startEighth / UNITS_PER_BAR) + 1;
  const rem = startEighth % UNITS_PER_BAR;
  return rem === 0 ? String(bar) : `${bar}${EIGHTH_LABELS[rem]}`;
};

const formatDuration = (units: number): string => {
  if (units % UNITS_PER_BAR === 0) {
    const bars = units / UNITS_PER_BAR;
    return bars === 1 ? '1 bar' : `${bars} bars`;
  }
  const wholeBars = Math.floor(units / UNITS_PER_BAR);
  const rem = units % UNITS_PER_BAR;
  const frac = EIGHTH_LABELS[rem] || `${rem}/8`;
  return wholeBars > 0 ? `${wholeBars} ${frac}` : frac;
};

const chordsEqual = (a?: ChartChord, b?: ChartChord): boolean =>
  !!a && !!b && a.root === b.root && a.chordType === b.chordType;

const formatChordLabel = (c: ChartChord): string => {
  const suffix =
    c.chordType === 'Major' ? '' :
    c.chordType === 'Minor' ? 'm' :
    ` ${c.chordType}`;
  return `${c.root}${suffix}`;
};

interface Section {
  id: string;
  name: string;
  startIdx: number; // inclusive slot index
  endIdx: number;   // inclusive slot index
  color: string;    // hsl triple
}

interface ArrangementItem {
  id: string;       // instance id
  sectionId: string;
}

const SECTION_COLORS = [
  '210 80% 60%', '340 75% 60%', '45 90% 55%', '150 60% 50%',
  '280 60% 60%', '20 80% 55%', '190 70% 55%', '95 55% 50%',
];

const SECTION_PRESETS = [
  'Intro', 'Verse', 'Chorus', 'Bridge', 'Middle 8',
  'A Section', 'B Section', 'C Section', 'Outro', 'Custom…',
];

export default function ChartsView({ currentKey, keyMode, onToggleCharts, onArrangementChange }: ChartsViewProps) {
  // ---- Persisted state (survives closing/reopening the Charts panel) ----
  type PersistedState = {
    slots: ChartSlot[];
    sections: Section[];
    arrangement: ArrangementItem[];
    chartKey: NoteName;
    title: string;
    composer: string;
    tempo: number;
    timeSig: string;
    feel: string;
  };
  const persisted: Partial<PersistedState> = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, []);

  const [chartKey, setChartKey] = useState<NoteName>(persisted.chartKey ?? currentKey);
  const diatonicChords = useMemo(() => getDiatonicChords(chartKey, keyMode), [chartKey, keyMode]);
  const getChordColor = useCallback((chord: ChartChord) => {
    const deg = getChordDegree(chartKey, chord.root, chord.chordType, keyMode);
    return deg >= 0 ? SCALE_DEGREE_COLORS[deg] : '220, 15%, 50%';
  }, [chartKey, keyMode]);

  const [slots, setSlots] = useState<ChartSlot[]>(() => persisted.slots?.length ? persisted.slots! : makeSlots(DEFAULT_SLOT_COUNT));
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [parsingSlot, setParsingSlot] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>(persisted.sections ?? []);
  const [sectionMode, setSectionMode] = useState(false);
  const [dragSel, setDragSel] = useState<{ start: number; end: number } | null>(null);
  const [pendingRange, setPendingRange] = useState<{ startIdx: number; endIdx: number } | null>(null);
  const [presetPos, setPresetPos] = useState<{ top: number; left: number } | null>(null);
  const [arrangement, setArrangement] = useState<ArrangementItem[]>(persisted.arrangement ?? []);
  const [arrDragOverIdx, setArrDragOverIdx] = useState<number | null>(null);
  const [editorSlotId, setEditorSlotId] = useState<string | null>(null);
  const [editorPos, setEditorPos] = useState<{ top: number; left: number } | null>(null);
  // Chart metadata
  const [title, setTitle] = useState(persisted.title ?? 'Untitled');
  const [composer, setComposer] = useState(persisted.composer ?? '');
  const [tempo, setTempo] = useState<number>(persisted.tempo ?? 120);
  const [timeSig, setTimeSig] = useState(persisted.timeSig ?? '4/4');
  const [feel, setFeel] = useState(persisted.feel ?? 'Straight');
  const [readingChart, setReadingChart] = useState(false);
  const [readDragOver, setReadDragOver] = useState(false);
  const readInputRef = useRef<HTMLInputElement | null>(null);

  // ---- Song audio analysis ----
  const { user } = useAuth();
  const [analyzingAudio, setAnalyzingAudio] = useState<'idle' | 'detecting-bpm' | 'uploading' | 'analyzing'>('idle');
  const [audioDragOver, setAudioDragOver] = useState(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzedSong | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const presetRef = useRef<HTMLDivElement | null>(null);

  // ---- Undo history ----
  type Snapshot = { slots: ChartSlot[]; sections: Section[]; arrangement: ArrangementItem[] };
  const historyRef = useRef<Snapshot[]>([]);
  const isUndoingRef = useRef(false);
  const snapshot = useCallback(() => {
    historyRef.current.push({ slots, sections, arrangement });
    if (historyRef.current.length > 100) historyRef.current.shift();
  }, [slots, sections, arrangement]);
  const undo = useCallback(() => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    isUndoingRef.current = true;
    setSlots(snap.slots);
    setSections(snap.sections);
    setArrangement(snap.arrangement);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  // ---- Persist to localStorage whenever meaningful state changes ----
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        slots, sections, arrangement, chartKey, title, composer, tempo, timeSig, feel,
      }));
    } catch { /* quota or serialization failure — ignore */ }
  }, [slots, sections, arrangement, chartKey, title, composer, tempo, timeSig, feel]);

  // ---- Emit arrangement chords to parent (for the backing-track timeline) ----
  const emitRef = useRef(onArrangementChange);
  emitRef.current = onArrangementChange;
  useEffect(() => {
    if (!emitRef.current) return;
    const out: TimelineChord[] = [];
    let cursorBeats = 0;
    let chordIdx = 0;
    for (const item of arrangement) {
      const sec = sections.find(s => s.id === item.sectionId);
      if (!sec) continue;
      for (let i = sec.startIdx; i <= sec.endIdx && i < slots.length; i++) {
        const sl = slots[i];
        const durBeats = (sl.bars / UNITS_PER_BAR) * 4; // 1 bar = 4 beats
        if (sl.chord) {
          out.push({
            id: `chart-${item.id}-${chordIdx++}`,
            root: sl.chord.root,
            chordType: sl.chord.chordType,
            startBeat: cursorBeats,
            duration: durBeats,
          });
        }
        cursorBeats += durBeats;
      }
    }
    const measures = Math.max(2, Math.ceil(cursorBeats / 4));
    emitRef.current({ chords: out, measures, bpm: tempo });
  }, [arrangement, sections, slots, tempo]);



  // ---- Auto-link consecutive identical chords ----
  useEffect(() => {
    if (isUndoingRef.current) { isUndoingRef.current = false; return; }
    let changed = false;
    const merged: ChartSlot[] = [];
    const indexMap: number[] = []; // old idx -> new idx
    slots.forEach((s) => {
      const last = merged[merged.length - 1];
      if (last && chordsEqual(last.chord, s.chord) && s.chord) {
        merged[merged.length - 1] = { ...last, bars: last.bars + s.bars };
        indexMap.push(merged.length - 1);
        changed = true;
      } else {
        merged.push(s);
        indexMap.push(merged.length - 1);
      }
    });
    if (changed) {
      setSlots(merged);
      setSections(prev => prev.map(sec => ({
        ...sec,
        startIdx: indexMap[sec.startIdx] ?? sec.startIdx,
        endIdx: indexMap[sec.endIdx] ?? sec.endIdx,
      })));
    }
  }, [slots]);

  // Normalize a run of empty (chord-less) slots around idx: merge them and
  // re-split along bar boundaries so a cleared cell falls back to whole bars.
  const normalizeEmptyRun = useCallback((list: ChartSlot[], idx: number): ChartSlot[] => {
    if (idx < 0 || idx >= list.length || list[idx].chord) return list;
    let start = idx, end = idx;
    while (start > 0 && !list[start - 1].chord) start--;
    while (end < list.length - 1 && !list[end + 1].chord) end++;
    let startUnit = 0;
    for (let i = 0; i < start; i++) startUnit += list[i].bars;
    let totalUnits = 0;
    for (let i = start; i <= end; i++) totalUnits += list[i].bars;
    const pieces: ChartSlot[] = [];
    let cursor = startUnit;
    let remaining = totalUnits;
    while (remaining > 0) {
      const nextBoundary = Math.floor(cursor / UNITS_PER_BAR) * UNITS_PER_BAR + UNITS_PER_BAR;
      const size = Math.min(nextBoundary - cursor, remaining);
      pieces.push({ id: uid('slot'), bars: size });
      cursor += size;
      remaining -= size;
    }
    return [...list.slice(0, start), ...pieces, ...list.slice(end + 1)];
  }, []);

  const setSlotChord = useCallback((slotId: string, chord: ChartChord | undefined) => {
    snapshot();
    setSlots(prev => {
      const idx = prev.findIndex(sl => sl.id === slotId);
      if (idx < 0) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], chord };
      return chord ? next : normalizeEmptyRun(next, idx);
    });
  }, [snapshot, normalizeEmptyRun]);



  const beginEdit = useCallback((slot: ChartSlot) => {
    setEditingSlot(slot.id);
    setEditValue(slot.chord ? formatChordLabel(slot.chord) : '');
  }, []);

  const commitEdit = useCallback(async (slotId: string, raw: string) => {
    const text = raw.trim();
    setEditingSlot(null);
    setEditValue('');
    if (!text) return;

    const local = parseChordSymbol(text);
    if (local) setSlotChord(slotId, { root: local.root, chordType: local.quality });

    setParsingSlot(slotId);
    try {
      const { data, error } = await supabase.functions.invoke('parse-chord', { body: { input: text } });
      if (error) throw error;
      if (data?.root && data?.chordType) {
        setSlotChord(slotId, { root: data.root as NoteName, chordType: data.chordType });
      } else if (!local) {
        toast({ title: 'Chord not recognised', description: text, variant: 'destructive' });
      }
    } catch (err) {
      if (!local) {
        toast({
          title: 'Chord parse failed',
          description: (err as Error).message ?? 'Try a simpler notation like "Am7" or "Cmaj7".',
          variant: 'destructive',
        });
      }
    } finally {
      setParsingSlot(prev => (prev === slotId ? null : prev));
    }
  }, [setSlotChord]);

  const readChartFromFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Not an image', description: 'Drop a screenshot or photo of a chord chart.', variant: 'destructive' });
      return;
    }
    setReadingChart(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('read-chart', { body: { image: dataUrl } });
      if (error) throw error;
      const chords: Array<{ root: NoteName; chordType: string; bars: number }> = data?.chords ?? [];
      if (chords.length === 0) {
        toast({ title: 'No chords detected', description: 'Try a clearer image or crop to the chord chart.', variant: 'destructive' });
        return;
      }
      // Convert to slots (1 bar = UNITS_PER_BAR eighths). Snap fractional bars to nearest 1/8.
      const newSlots: ChartSlot[] = chords.map(c => {
        const units = Math.max(1, Math.round(c.bars * UNITS_PER_BAR));
        return { id: uid('slot'), bars: units, chord: { root: c.root, chordType: c.chordType } };
      });
      // Pad with empty bars up to at least DEFAULT_SLOT_COUNT bars.
      const usedUnits = newSlots.reduce((n, s) => n + s.bars, 0);
      const minUnits = DEFAULT_SLOT_COUNT * UNITS_PER_BAR;
      let padUnits = Math.max(0, minUnits - usedUnits);
      while (padUnits > 0) {
        newSlots.push({ id: uid('slot'), bars: UNITS_PER_BAR });
        padUnits -= UNITS_PER_BAR;
      }
      snapshot();
      setSlots(newSlots);
      setSections([]);
      setArrangement([]);
      toast({ title: 'Chart imported', description: `Loaded ${chords.length} chord${chords.length === 1 ? '' : 's'}.` });
    } catch (err) {
      toast({ title: 'Read chart failed', description: (err as Error).message ?? 'Try again.', variant: 'destructive' });
    } finally {
      setReadingChart(false);
    }
  }, [snapshot]);


  // Resize by growing/shrinking from a specific edge. Growth only consumes
  // adjacent EMPTY (chord-less) slots — chord-holding neighbors are not affected.
  const resizeSlotEdge = useCallback((slotId: string, targetBars: number, edge: 'right' | 'left') => {
    setSlots(prev => {
      const idx = prev.findIndex(sl => sl.id === slotId);
      if (idx < 0) return prev;
      const current = prev[idx];
      const desired = Math.max(1, targetBars);
      if (desired === current.bars) return prev;
      const next = prev.slice();

      if (edge === 'right') {
        if (desired > current.bars) {
          let need = desired - current.bars;
          let cursor = idx + 1;
          while (need > 0 && cursor < next.length && !next[cursor].chord) {
            const nb = next[cursor];
            if (nb.bars <= need) { need -= nb.bars; next.splice(cursor, 1); }
            else { next[cursor] = { ...nb, bars: nb.bars - need }; need = 0; }
          }
          next[idx] = { ...current, bars: desired - need };
        } else {
          const freed = current.bars - desired;
          next[idx] = { ...current, bars: desired };
          if (next[idx + 1] && !next[idx + 1].chord) {
            next[idx + 1] = { ...next[idx + 1], bars: next[idx + 1].bars + freed };
          } else {
            next.splice(idx + 1, 0, { id: uid('slot'), bars: freed });
          }
        }
      } else {
        if (desired > current.bars) {
          let need = desired - current.bars;
          let cursor = idx - 1;
          let curIdx = idx;
          while (need > 0 && cursor >= 0 && !next[cursor].chord) {
            const nb = next[cursor];
            if (nb.bars <= need) {
              need -= nb.bars; next.splice(cursor, 1); curIdx--; cursor--;
            } else {
              next[cursor] = { ...nb, bars: nb.bars - need }; need = 0;
            }
          }
          next[curIdx] = { ...current, bars: desired - need };
        } else {
          const freed = current.bars - desired;
          next[idx] = { ...current, bars: desired };
          if (idx > 0 && !next[idx - 1].chord) {
            next[idx - 1] = { ...next[idx - 1], bars: next[idx - 1].bars + freed };
          } else {
            next.splice(idx, 0, { id: uid('slot'), bars: freed });
          }
        }
      }
      return next;
    });
  }, []);


  const handleDrop = (slotId: string, e: React.DragEvent) => {
    e.preventDefault();
    setHoverSlot(null);
    const degreeData = e.dataTransfer.getData('application/diatonic-degree');
    if (degreeData) {
      try {
        const { degree } = JSON.parse(degreeData);
        const dc = diatonicChords[degree];
        if (dc) {
          const chordType = degree === 4 ? 'Dominant 7' : dc.type;
          setSlotChord(slotId, { root: dc.root, chordType });
        }
        return;
      } catch { /* ignore */ }
    }
    const chordData = e.dataTransfer.getData('application/chord');
    if (chordData) {
      try {
        const { root, chordType } = JSON.parse(chordData);
        setSlotChord(slotId, { root, chordType });
      } catch { /* ignore */ }
    }
  };

  const handleDragOver = (slotId: string, e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes('application/chord') ||
      e.dataTransfer.types.includes('application/diatonic-degree')
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setHoverSlot(slotId);
    }
  };

  const startResize = (slotId: string, startBars: number, edge: 'right' | 'left', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const styles = window.getComputedStyle(grid);
    const gap = parseFloat(styles.columnGap || '0') || 0;
    const unitWidth = (grid.clientWidth - gap * (COLS - 1)) / COLS;
    const startX = e.clientX;
    let lastBars = startBars;
    let snapped = false;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      // Left handle: dragging left grows, dragging right shrinks.
      const delta = edge === 'right' ? Math.round(dx / unitWidth) : Math.round(-dx / unitWidth);
      const nextBars = Math.max(1, startBars + delta);
      if (nextBars !== lastBars) {
        if (!snapped) { snapshot(); snapped = true; }
        lastBars = nextBars;
        resizeSlotEdge(slotId, nextBars, edge);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };



  // Cumulative unit offset (1/8 bar) at start of each slot.
  const startUnits: number[] = [];
  {
    let n = 0;
    for (const s of slots) { startUnits.push(n); n += s.bars; }
  }


  const sectionOfSlot = (idx: number): Section | undefined =>
    sections.find(sec => idx >= sec.startIdx && idx <= sec.endIdx);

  // Drag-to-select section range
  const startSectionDrag = (idx: number, e: React.MouseEvent) => {
    if (!sectionMode) return;
    e.preventDefault();
    setDragSel({ start: idx, end: idx });
  };
  const extendSectionDrag = (idx: number) => {
    if (!sectionMode || !dragSel) return;
    if (dragSel.end !== idx) setDragSel({ ...dragSel, end: idx });
  };

  useEffect(() => {
    if (!sectionMode || !dragSel) return;
    const onUp = (ev: MouseEvent) => {
      const start = Math.min(dragSel.start, dragSel.end);
      const end = Math.max(dragSel.start, dragSel.end);
      setDragSel(null);
      setPendingRange({ startIdx: start, endIdx: end });
      // Position preset menu near cursor.
      const left = Math.min(Math.max(8, ev.clientX), window.innerWidth - 220);
      const top = Math.min(ev.clientY + 8, window.innerHeight - 320);
      setPresetPos({ top, left });
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [sectionMode, dragSel]);

  const commitSection = (name: string) => {
    if (!pendingRange) return;
    snapshot();
    const { startIdx, endIdx } = pendingRange;
    setSections(prev => [
      ...prev.filter(s => s.endIdx < startIdx || s.startIdx > endIdx),
      {
        id: uid('sec'),
        name,
        startIdx,
        endIdx,
        color: SECTION_COLORS[prev.length % SECTION_COLORS.length],
      },
    ]);
    setPendingRange(null);
    setPresetPos(null);
    setSectionMode(false);
  };

  const cancelPreset = () => {
    setPendingRange(null);
    setPresetPos(null);
  };

  // Close preset menu on outside click / Escape.
  useEffect(() => {
    if (!pendingRange) return;
    const onDown = (ev: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(ev.target as Node)) cancelPreset();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cancelPreset(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [pendingRange]);

  const renameSection = (id: string) => {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    const name = window.prompt('Rename section', sec.name);
    if (!name) return;
    snapshot();
    setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  const removeSection = (id: string) => {
    snapshot();
    setSections(prev => prev.filter(s => s.id !== id));
    setArrangement(prev => prev.filter(a => a.sectionId !== id));
  };

  // Close editor on outside click / Escape.
  useEffect(() => {
    if (!editorSlotId) return;
    const onDown = (ev: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(ev.target as Node)) {
        setEditorSlotId(null);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setEditorSlotId(null);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [editorSlotId]);

  const openChordEditor = (slot: ChartSlot, target: HTMLElement) => {
    if (!slot.chord) return;
    const rect = target.getBoundingClientRect();
    const width = 320;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 300);
    setEditorPos({ top, left });
    setEditorSlotId(slot.id);
  };

  const editorSlot = editorSlotId ? slots.find(s => s.id === editorSlotId) : null;
  const editorChord = editorSlot?.chord ?? null;
  const totalBars = slots.reduce((n, s) => n + s.bars, 0) / UNITS_PER_BAR;

  // Arrangement drag/drop
  const onArrDropFromToolbar = (e: React.DragEvent, insertAt: number) => {
    e.preventDefault();
    setArrDragOverIdx(null);
    const sectionId = e.dataTransfer.getData('application/chart-section');
    const moveId = e.dataTransfer.getData('application/chart-arrangement-item');
    if (sectionId) {
      snapshot();
      const item: ArrangementItem = { id: uid('arr'), sectionId };
      setArrangement(prev => {
        const next = prev.slice();
        next.splice(insertAt, 0, item);
        return next;
      });
    } else if (moveId) {
      snapshot();
      setArrangement(prev => {
        const fromIdx = prev.findIndex(a => a.id === moveId);
        if (fromIdx < 0) return prev;
        const next = prev.slice();
        const [it] = next.splice(fromIdx, 1);
        const adjusted = fromIdx < insertAt ? insertAt - 1 : insertAt;
        next.splice(adjusted, 0, it);
        return next;
      });
    }
  };

  const dragSelStart = dragSel ? Math.min(dragSel.start, dragSel.end) : -1;
  const dragSelEnd = dragSel ? Math.max(dragSel.start, dragSel.end) : -1;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-card shrink-0">
        <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Charts</span>
        <span className="text-[9px] font-mono text-muted-foreground/70">
          Drag degree chips into a slot. Double-click to type a chord. Click a chord to edit extensions. Drag either edge to resize (1/8 bar steps).
        </span>
        <button
          onClick={undo}
          disabled={historyRef.current.length === 0}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-secondary text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Undo (⌘Z / Ctrl+Z)"
        >
          <Undo2 size={10} />
          Undo
        </button>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/70">
          {totalBars % 1 === 0 ? totalBars : totalBars.toFixed(2)} bars · {slots.length} slots
        </span>
        <button
          onClick={() => onToggleCharts?.()}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-secondary text-muted-foreground hover:bg-muted transition-colors"
          title="Close charts and return to timeline"
        >
          <X size={10} />
          Close
        </button>
      </div>

      {/* Body: vertical toolbar + slot grid */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Vertical toolbar */}
        <div className="w-44 shrink-0 border-r border-border bg-card flex flex-col items-stretch gap-2 py-2 px-2 overflow-y-auto">
          {/* Key selector */}
          <div className="flex flex-col gap-1 chart-key-selector">
            <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground text-center">Key</div>
            <ScaleRootSelector selectedRoot={chartKey} onSelect={(n) => setChartKey(n)} />
          </div>

          <button
            onClick={() => { setSectionMode(m => !m); setDragSel(null); }}
            className={`h-9 rounded flex items-center justify-center gap-1.5 border transition-colors text-[10px] font-mono uppercase tracking-wider ${
              sectionMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted'
            }`}
            title={sectionMode ? 'Drag across slots to group' : 'Group into section'}
          >
            <Group size={13} />
            <span>Section</span>
          </button>

          {/* Chart metadata config */}
          <div className="flex flex-col gap-1 mt-1 border-t border-border pt-2">
            <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground text-center">Chart Info</div>
            <label className="text-[8px] font-mono uppercase text-muted-foreground/80">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary"
              placeholder="Untitled"
            />
            <label className="text-[8px] font-mono uppercase text-muted-foreground/80">Composer</label>
            <input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary"
              placeholder="—"
            />
            <label className="text-[8px] font-mono uppercase text-muted-foreground/80">Tempo (BPM)</label>
            <input
              type="number"
              min={20}
              max={400}
              value={tempo}
              onChange={(e) => setTempo(Math.max(20, Math.min(400, Number(e.target.value) || 0)))}
              className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary"
            />
            <label className="text-[8px] font-mono uppercase text-muted-foreground/80">Time Sig</label>
            <select
              value={timeSig}
              onChange={(e) => setTimeSig(e.target.value)}
              className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary"
            >
              {['2/4','3/4','4/4','5/4','6/8','7/8','12/8'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="text-[8px] font-mono uppercase text-muted-foreground/80">Feel</label>
            <select
              value={feel}
              onChange={(e) => setFeel(e.target.value)}
              className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary"
            >
              {['Straight','Swing','Shuffle','Ballad','Rock','Funk','Latin','Bossa Nova','Samba','Reggae','Jazz','Blues','Folk'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Diatonic chord palette */}

          {diatonicChords.length > 0 && (
            <div className="flex flex-col gap-1 mt-1 border-t border-border pt-2">
              <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground text-center">Diatonic</div>
              {diatonicChords.slice(0, 7).map((dc, i) => {
                const chordType = i === 4 ? 'Dominant 7' : dc.type;
                const color = getChordColor({ root: dc.root, chordType });
                return (
                  <button
                    key={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/diatonic-degree', JSON.stringify({ degree: i }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="rounded px-1.5 py-1 flex items-center justify-between gap-1 leading-tight cursor-grab active:cursor-grabbing hover:brightness-110 transition"
                    style={{ background: `hsl(${color})`, color: '#000' }}
                    title={`${dc.roman} — ${dc.symbol} (drag into a slot)`}
                  >
                    <span className="text-[10px] font-mono font-bold opacity-80">{dc.roman}</span>
                    <span className="text-[11px] font-mono font-bold">{dc.symbol}</span>
                  </button>
                );
              })}
            </div>
          )}

          {sections.length > 0 && (
            <div className="w-full flex flex-col items-stretch gap-1 mt-1 border-t border-border pt-2">
              <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground text-center">Sections</div>
              {sections.map(sec => (
                <div
                  key={sec.id}
                  className="flex items-center gap-1 w-full"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/chart-section', sec.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  title="Drag to arrangement"
                >
                  <button
                    onClick={() => renameSection(sec.id)}
                    className="flex-1 text-[9px] font-mono font-bold uppercase truncate rounded px-1 py-0.5 text-left cursor-grab active:cursor-grabbing flex items-center gap-1"
                    style={{ background: `hsl(${sec.color} / 0.25)`, color: `hsl(${sec.color})` }}
                  >
                    <GripVertical size={9} className="opacity-60 shrink-0" />
                    <span className="truncate">{sec.name}</span>
                  </button>
                  <button
                    onClick={() => removeSection(sec.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    title="Delete section"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Read Chart drop box */}
          <label
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                setReadDragOver(true);
              }
            }}
            onDragLeave={() => setReadDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setReadDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) readChartFromFile(file);
            }}
            className={`mt-auto w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border-2 border-dashed cursor-pointer transition-colors ${
              readDragOver
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:border-primary/60 hover:text-foreground'
            }`}
            title="Drop a screenshot of a chord chart; AI will fill the chart above."
          >
            {readingChart ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            <span className="text-[10px] font-mono uppercase tracking-wider">
              {readingChart ? 'Reading…' : 'Read Chart'}
            </span>
            <input
              ref={readInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readChartFromFile(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {/* Slot grid */}
        <div className="flex-1 overflow-auto p-3 flex flex-col">
          {/* Chart metadata banner */}
          <div className="mb-2 pb-2 border-b border-border flex items-baseline gap-4 flex-wrap">
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight text-foreground">{title || 'Untitled'}</span>
              {composer && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  by {composer}
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span><span className="text-foreground font-bold">{tempo}</span> BPM</span>
              <span><span className="text-foreground font-bold">{timeSig}</span></span>
              <span><span className="text-foreground font-bold">{feel}</span></span>
            </div>
          </div>

          <div
            ref={gridRef}
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
              gridAutoRows: '3rem',
            }}
          >
            {slots.map((slot, idx) => {
              const isHover = hoverSlot === slot.id;
              const isEditing = editingSlot === slot.id;
              const isParsing = parsingSlot === slot.id;
              const color = slot.chord ? getChordColor(slot.chord) : null;
              const section = sectionOfSlot(idx);
              const inDragSel = sectionMode && dragSel && idx >= dragSelStart && idx <= dragSelEnd;
              const startUnit = startUnits[idx];
              const barLabel = formatBarNumber(startUnit);
              return (
                <div
                  key={slot.id}
                  onDragOver={(e) => handleDragOver(slot.id, e)}
                  onDragLeave={() => setHoverSlot(prev => prev === slot.id ? null : prev)}
                  onDrop={(e) => handleDrop(slot.id, e)}
                  onDoubleClick={() => { if (!sectionMode) beginEdit(slot); }}
                  onMouseDown={(e) => startSectionDrag(idx, e)}
                  onMouseEnter={() => extendSectionDrag(idx)}
                  onClick={(e) => {
                    if (sectionMode) return;
                    if (slot.chord && !isEditing) openChordEditor(slot, e.currentTarget as HTMLElement);
                  }}
                  style={{
                    gridColumn: `span ${slot.bars} / span ${slot.bars}`,
                    background: color ? `hsl(${color})` : undefined,
                    boxShadow: isHover
                      ? 'inset 0 0 0 2px hsl(var(--primary))'
                      : inDragSel
                        ? 'inset 0 0 0 2px hsl(var(--primary))'
                        : undefined,
                    borderTop: section ? `3px solid hsl(${section.color})` : undefined,
                  }}
                  className={`group relative rounded-md flex items-center justify-center transition-colors overflow-hidden ${
                    sectionMode ? 'cursor-crosshair select-none ' : slot.chord ? 'cursor-pointer ' : ''
                  }${
                    color
                      ? 'brightness-100 hover:brightness-110'
                      : 'bg-muted/20 border border-dashed border-border/50 hover:border-primary/60 hover:bg-muted/30'
                  }`}
                  title={slot.chord
                    ? `${formatChordLabel(slot.chord)} — click to edit extensions`
                    : 'Double-click to type a chord, or drop one here'}
                >
                  <span
                    className="absolute top-0.5 left-1 text-[9px] font-mono font-bold pointer-events-none select-none"
                    style={{ color: color ? 'rgba(0,0,0,0.65)' : undefined }}
                  >
                    {barLabel}
                  </span>

                  {section && section.startIdx === idx && (
                    <span
                      className="absolute top-0.5 right-2 text-[8px] font-mono font-bold uppercase tracking-wider pointer-events-none"
                      style={{ color: `hsl(${section.color})` }}
                    >
                      {section.name}
                    </span>
                  )}

                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(slot.id, editValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(slot.id, editValue); }
                        else if (e.key === 'Escape') { setEditingSlot(null); setEditValue(''); }
                      }}
                      placeholder="e.g. Am7"
                      className="w-[90%] text-center text-[13px] font-mono font-bold bg-background/90 text-foreground rounded px-1 py-0.5 border border-primary focus:outline-none"
                    />
                  ) : slot.chord ? (
                    <span className="text-[13px] font-mono font-bold pointer-events-none" style={{ color: '#000' }}>
                      {formatChordLabel(slot.chord)}
                    </span>
                  ) : null}

                  {isParsing && (
                    <Loader2 size={10} className="absolute bottom-1 right-3 animate-spin text-foreground/70" />
                  )}

                  {slot.chord && !isEditing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSlotChord(slot.id, undefined); }}
                      className="absolute bottom-1 left-1 p-0.5 rounded bg-background/70 hover:bg-destructive/70 text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Clear chord"
                    >
                      <X size={10} />
                    </button>
                  )}

                  <div
                    onMouseDown={(e) => startResize(slot.id, slot.bars, 'left', e)}
                    className="absolute top-0 left-0 h-full w-2 cursor-ew-resize hover:bg-primary/40 transition-colors"
                    title={`Drag to resize left edge — ${formatDuration(slot.bars)}`}
                  />
                  <div
                    onMouseDown={(e) => startResize(slot.id, slot.bars, 'right', e)}
                    className="absolute top-0 right-0 h-full w-2 cursor-ew-resize hover:bg-primary/40 transition-colors"
                    title={`Drag to resize right edge — ${formatDuration(slot.bars)}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Arrangement strip */}
      <div className="shrink-0 border-t border-border bg-card px-3 py-2 flex items-center gap-2 min-h-[64px]">
        <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider shrink-0">
          Arrangement
        </span>
        <div
          className="flex-1 flex items-center gap-1 overflow-x-auto min-h-[44px] rounded border border-dashed border-border/60 px-2 py-1"
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes('application/chart-section') ||
              e.dataTransfer.types.includes('application/chart-arrangement-item')
            ) {
              e.preventDefault();
              if (arrDragOverIdx === null) setArrDragOverIdx(arrangement.length);
            }
          }}
          onDrop={(e) => onArrDropFromToolbar(e, arrDragOverIdx ?? arrangement.length)}
          onDragLeave={() => setArrDragOverIdx(null)}
        >
          {arrangement.length === 0 && (
            <span className="text-[10px] font-mono text-muted-foreground/60 px-2">
              Drag sections here to build the song arrangement
            </span>
          )}
          {arrangement.map((item, i) => {
            const sec = sections.find(s => s.id === item.sectionId);
            if (!sec) return null;
            const isOver = arrDragOverIdx === i;
            return (
              <div key={item.id} className="flex items-center">
                <div
                  className={`h-1 w-1 rounded-full ${isOver ? 'bg-primary' : 'bg-transparent'}`}
                  onDragOver={(e) => { e.preventDefault(); setArrDragOverIdx(i); }}
                />
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/chart-arrangement-item', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => { e.preventDefault(); setArrDragOverIdx(i); }}
                  className="group flex items-center gap-1 rounded px-2 py-1 cursor-grab active:cursor-grabbing"
                  style={{ background: `hsl(${sec.color} / 0.3)`, color: `hsl(${sec.color})` }}
                  title={`${sec.name} — drag to reorder`}
                >
                  <GripVertical size={10} className="opacity-60" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider">{sec.name}</span>
                  <button
                    onClick={() => { snapshot(); setArrangement(prev => prev.filter(a => a.id !== item.id)); }}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                    title="Remove"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            );
          })}
          {arrangement.length > 0 && (
            <div
              className="flex-1 min-w-[24px] h-full"
              onDragOver={(e) => { e.preventDefault(); setArrDragOverIdx(arrangement.length); }}
            />
          )}
        </div>

      </div>

      {/* Section preset picker */}
      {pendingRange && presetPos && (
        <div
          ref={presetRef}
          className="fixed z-50 rounded-lg border border-border bg-card shadow-xl p-2 w-[200px]"
          style={{ top: presetPos.top, left: presetPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Save section
            </span>
            <button onClick={cancelPreset} className="text-muted-foreground hover:text-foreground" title="Cancel">
              <X size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {SECTION_PRESETS.map((label) => (
              <button
                key={label}
                onClick={() => {
                  if (label === 'Custom…') {
                    const name = window.prompt('Section name', `Section ${String.fromCharCode(65 + sections.length)}`);
                    if (name) commitSection(name);
                    else cancelPreset();
                  } else {
                    commitSection(label);
                  }
                }}
                className="text-[10px] font-mono font-bold uppercase tracking-wider rounded px-2 py-1.5 bg-background border border-border hover:bg-muted hover:border-primary transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chord editor popover */}
      {editorSlot && editorChord && editorPos && (
        <div
          ref={editorRef}
          className="fixed z-50 rounded-lg border border-border bg-card shadow-xl p-3"
          style={{ top: editorPos.top, left: editorPos.left, width: 320 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Edit chord · {editorChord.root}
            </span>
            <button
              onClick={() => setEditorSlotId(null)}
              className="text-muted-foreground hover:text-foreground"
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
          <ChordBuilder
            selectedRoot={editorChord.root}
            selectedChord={editorChord.chordType}
            handleSelectChord={(ct) => {
              setSlotChord(editorSlot.id, { root: editorChord.root, chordType: ct });
            }}
            getChordCellLabel={(ct) => formatChordLabel({ root: editorChord.root, chordType: ct })}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
