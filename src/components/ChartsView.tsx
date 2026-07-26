import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X, Loader2, Group, Trash2, GripVertical, Upload, Undo2, Save, RotateCcw, FileDown, Share2 } from 'lucide-react';

import { buildChartPdf, downloadPdf, type ChartPdfData } from '@/lib/chartPdf';
import ChartPreview from '@/components/ChartPreview';


import type { NoteName, KeyMode } from '@/lib/music';
import { getDiatonicChords, getDiatonicSevenths, spellDiatonicRoots, getChordDegree, SCALE_DEGREE_COLORS, NOTE_NAMES } from '@/lib/music';
import { parseChordSymbol } from '@/lib/chordParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ChordBuilder } from '@/components/ChordReference';
import { ScaleRootSelector } from '@/components/ControlPanel';
import type { TimelineChord } from '@/hooks/useSongTimeline';

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
  /** Slash-chord bass note (e.g. Gmaj7/B). */
  bass?: NoteName;
}


export interface ChartSlot {
  id: string;
  /** How many 1/8-bar units this slot spans (min 1). 8 = one bar. */
  bars: number;
  chord?: ChartChord;
  /** Volta / repeat ending: 1 = first time round, 2 = second time round.
      Ending-2 slots are laid out directly beneath their ending-1 counterparts. */
  ending?: 1 | 2 | 3;
}


interface ChartsViewProps {
  currentKey: NoteName;
  keyMode: KeyMode;
  onToggleCharts?: () => void;
  /** Fired whenever the arrangement (or its underlying chords) change, so the
      parent can push the resulting chord progression into the backing-track timeline. */
  onArrangementChange?: (data: { chords: TimelineChord[]; measures: number; bpm: number; sections: { id: string; name: string; color: string; startBeat: number; lengthBeats: number }[] }) => void;
  /** Called when the user confirms a full chart reset, so the parent can also
      clear the backing-track timeline (which sits above the Charts panel). */
  onResetAll?: () => void;
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

/**
 * Collapse adjacent empty slots that live inside the same bar into a single
 * cell, and absorb sub-bar empty slivers into the neighbouring empty cell.
 * Without this, resizing can leave 1/8-wide "ghost" cells (e.g. 9½, 9⅝).
 */
const mergeEmptySlots = (list: ChartSlot[]): ChartSlot[] => {
  const out: ChartSlot[] = [];
  let unit = 0;
  for (const slot of list) {
    const prev = out[out.length - 1];
    const prevStart = unit - (prev?.bars ?? 0);
    const sameBar =
      prev &&
      !prev.chord &&
      !slot.chord &&
      Math.floor(prevStart / UNITS_PER_BAR) === Math.floor(unit / UNITS_PER_BAR);
    if (sameBar) {
      out[out.length - 1] = { ...prev, bars: prev.bars + slot.bars };
    } else {
      out.push(slot);
    }
    unit += slot.bars;
  }
  return out;
};

const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'D♭', 'D#': 'E♭', 'F#': 'G♭', 'G#': 'A♭', 'A#': 'B♭',
};

/** Spell a chord root using the key signature's preferred accidental. */
const spellRootInKey = (root: NoteName, key: NoteName, keyMode: KeyMode): string => {
  try {
    const spelled = spellDiatonicRoots(key, keyMode);
    const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const pcOf = (s: string) => {
      const letter = s[0];
      const acc = s.slice(1);
      const shift = /[#]/.test(acc) ? 1 : /[b♭]/.test(acc) ? -1 : 0;
      return ((LETTER_PC[letter] ?? 0) + shift + 12) % 12;
    };
    const rootPc = NOTE_NAMES.indexOf(root);
    for (const s of spelled) if (pcOf(s) === rootPc) return s;
    // Non-diatonic: prefer flat spelling if the key signature uses flats.
    const flatKey = spelled.some(s => /[b♭]/.test(s.slice(1)));
    return flatKey && SHARP_TO_FLAT[root] ? SHARP_TO_FLAT[root] : root;
  } catch {
    return root;
  }
};

const CHORD_ABBR: Record<string, string> = {
  'Major': '', 'Minor': 'm', 'Diminished': 'dim', 'Dim 7': 'dim7', 'Half-Dim 7': 'm7♭5',
  'Augmented': 'aug', 'Aug 7': 'aug7', 'Sus2': 'sus2', 'Sus4': 'sus4', '7sus4': '7sus4',
  'Major 7': 'maj7', 'Major 9': 'maj9', 'Maj11': 'maj11', 'Maj13': 'maj13',
  'Minor 7': 'm7', 'Minor 9': 'm9', 'Minor 11': 'm11', 'Minor 13': 'm13', 'Minor 6': 'm6',
  'Dominant 7': '7', 'Dominant 9': '9', '11': '11', '13': '13',
  'Major 6': '6', '6add9': '6/9', 'Add9': 'add9', 'Madd9': 'madd9', 'Power (5)': '5',
  'Min/Maj 7': 'mMaj7',
};

const abbrForType = (t: string) => CHORD_ABBR[t] ?? t.replace(/\s+/g, '');

const formatChordLabel = (c: ChartChord, key?: NoteName, keyMode?: KeyMode): string => {
  const spell = (n: NoteName) => (key && keyMode ? spellRootInKey(n, key, keyMode) : n);
  const root = spell(c.root);
  return `${root}${abbrForType(c.chordType)}${c.bass ? `/${spell(c.bass)}` : ''}`;
};




const ROMANS_UP = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

/** Reduce a chord type to a broad family for key matching. */
const chordFamily = (t: string): 'maj' | 'min' | 'dom' | 'dim' | 'other' => {
  const s = t.toLowerCase();
  if (/half|m7b5|m7♭5|dim/.test(s)) return 'dim';
  if (/^min|^m(?!aj)/.test(s)) return 'min';
  if (/dominant|^7|^9$|^11$|^13$|7sus/.test(s)) return 'dom';
  if (/maj|major|^6|add9|power/.test(s)) return 'maj';
  return 'other';
};

/**
 * Guess the key of a progression from the chords used.
 * Scores every candidate tonic on diatonic fit (root + quality), weighted by
 * bar length, with bonuses for starting/ending on the tonic and for a V7.
 */
const detectKeyFromChords = (
  entries: { chord: ChartChord; bars: number }[],
  keyMode: KeyMode,
): NoteName | null => {
  if (entries.length < 2) return null;
  let best: NoteName | null = null;
  let bestScore = -Infinity;
  for (const candidate of NOTE_NAMES) {
    const dia = getDiatonicChords(candidate, keyMode);
    const rootMap = new Map<NoteName, string>();
    dia.forEach(d => rootMap.set(d.root, chordFamily(d.type)));
    let score = 0;
    entries.forEach((e, i) => {
      const w = Math.max(1, e.bars) / UNITS_PER_BAR;
      const fam = rootMap.get(e.chord.root);
      if (fam === undefined) { score -= 2 * w; return; }
      score += 2 * w;
      const cf = chordFamily(e.chord.chordType);
      if (cf === fam) score += 1.5 * w;
      // Dominant 7 on the 5th degree is a strong tonal signal.
      if (e.chord.root === dia[4].root && cf === 'dom') score += 2;
      if (e.chord.root === candidate) {
        score += 1;
        if (i === 0) score += 2;
        if (i === entries.length - 1) score += 3;
      }
    });
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return best;
};


const romanForChord = (chord: ChartChord, key: NoteName): string => {
  const keyIdx = NOTE_NAMES.indexOf(key);
  const rootIdx = NOTE_NAMES.indexOf(chord.root);
  if (keyIdx < 0 || rootIdx < 0) return '?';
  const semis = (rootIdx - keyIdx + 12) % 12;
  let degree = MAJOR_INTERVALS.indexOf(semis);
  let accidental = '';
  if (degree === -1) {
    const flat = MAJOR_INTERVALS.indexOf((semis + 1) % 12);
    if (flat !== -1) { degree = flat; accidental = 'b'; }
    else {
      const sharp = MAJOR_INTERVALS.indexOf((semis + 11) % 12);
      if (sharp !== -1) { degree = sharp; accidental = '#'; }
    }
  }
  if (degree === -1) return '?';
  const t = chord.chordType;
  const isMinorish = /^(Minor|Diminished|Half|m7b5)/i.test(t) || t.toLowerCase().startsWith('minor');
  const base = ROMANS_UP[degree];
  const roman = isMinorish ? base.toLowerCase() : base;
  const suffix = /Diminished|m7b5|Half/i.test(t) ? '°' : '';
  return accidental + roman + suffix;
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

export default function ChartsView({ currentKey, keyMode, onToggleCharts, onArrangementChange, onResetAll }: ChartsViewProps) {
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
  // Auto key detection stays on until the user picks a key by hand.
  const [autoKey, setAutoKey] = useState(true);
  const [useSevenths, setUseSevenths] = useState(false);

  const diatonicChords = useMemo(() => getDiatonicChords(chartKey, keyMode), [chartKey, keyMode]);
  const diatonicSevenths = useMemo(() => getDiatonicSevenths(chartKey, keyMode), [chartKey, keyMode]);
  const spelledRoots = useMemo(() => spellDiatonicRoots(chartKey, keyMode), [chartKey, keyMode]);
  const getChordColor = useCallback((chord: ChartChord) => {
    const deg = getChordDegree(chartKey, chord.root, chord.chordType, keyMode);
    return deg >= 0 ? SCALE_DEGREE_COLORS[deg] : '220, 15%, 50%';
  }, [chartKey, keyMode]);

  const [slots, setSlots] = useState<ChartSlot[]>(() => persisted.slots?.length ? persisted.slots! : makeSlots(DEFAULT_SLOT_COUNT));

  // Detect the key from the chords in use (unless the user chose one manually).
  useEffect(() => {
    if (!autoKey) return;
    const entries = slots.filter(s => s.chord).map(s => ({ chord: s.chord!, bars: s.bars }));
    const detected = detectKeyFromChords(entries, keyMode);
    if (detected && detected !== chartKey) setChartKey(detected);
  }, [slots, keyMode, autoKey, chartKey]);

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

  // Auto-recognise a repeat of an earlier section: a run of unsectioned bars
  // whose chords match an existing section becomes another occurrence of that
  // section, with the differing tail bars marked as the next volta ending.
  useEffect(() => {
    const secOf = (i: number) => sections.find(s => i >= s.startIdx && i <= s.endIdx);
    const runs: { start: number; end: number }[] = [];
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i].chord || secOf(i)) continue;
      let j = i;
      while (j + 1 < slots.length && slots[j + 1].chord && !secOf(j + 1)) j++;
      if (j - i + 1 >= 4) runs.push({ start: i, end: j });
      i = j;
    }
    if (!runs.length) return;
    const same = (a?: ChartChord, b?: ChartChord) =>
      !!a && !!b && a.root === b.root && a.chordType === b.chordType && a.bass === b.bass;
    const added: Section[] = [];
    const endingUpdates = new Map<string, 1 | 2 | 3>();
    for (const run of runs) {
      for (const sec of sections) {
        const base: ChartSlot[] = [];
        for (let k = Math.max(0, sec.startIdx); k <= Math.min(sec.endIdx, slots.length - 1); k++) {
          if (slots[k].chord && !slots[k].ending) base.push(slots[k]);
        }
        if (base.length < 4) continue;
        const runSlots = slots.slice(run.start, run.end + 1).filter(s => s.chord);
        if (runSlots.length < base.length) continue;
        let hits = 0;
        for (let k = 0; k < base.length; k++) if (same(base[k].chord, runSlots[k]?.chord)) hits++;
        if (hits / base.length < 0.75) continue;
        let maxEnding = 0;
        for (let k = Math.max(0, sec.startIdx); k <= Math.min(sec.endIdx, slots.length - 1); k++) {
          maxEnding = Math.max(maxEnding, slots[k].ending ?? 0);
        }
        const next = Math.min(3, maxEnding + 1) as 1 | 2 | 3;
        runSlots.slice(base.length).forEach(s => { if (s.ending !== next) endingUpdates.set(s.id, next); });
        added.push({ id: uid('sec'), name: sec.name, color: sec.color, startIdx: run.start, endIdx: run.end });
        break;
      }
    }
    if (!added.length) return;
    setSections(prev => [...prev, ...added]);
    if (endingUpdates.size) {
      setSlots(prev => prev.map(s => (endingUpdates.has(s.id) ? { ...s, ending: endingUpdates.get(s.id) } : s)));
    }
    setArrangement(prev => [...prev, ...added.map(s => ({ id: uid('arr'), sectionId: s.id }))]);
  }, [slots, sections]);

  const [arrDragOverIdx, setArrDragOverIdx] = useState<number | null>(null);
  const [editorSlotId, setEditorSlotId] = useState<string | null>(null);
  const [editorPos, setEditorPos] = useState<{ top: number; left: number } | null>(null);
  // Chart metadata
  const [title, setTitle] = useState(persisted.title ?? 'Untitled');
  const [composer, setComposer] = useState(persisted.composer ?? '');
  const [tempo, setTempo] = useState<number>(persisted.tempo ?? 120);
  const [tempoDraft, setTempoDraft] = useState<string>(String(persisted.tempo ?? 120));
  useEffect(() => { setTempoDraft(String(tempo)); }, [tempo]);

  const [timeSig, setTimeSig] = useState(persisted.timeSig ?? '4/4');
  const [feel, setFeel] = useState(persisted.feel ?? 'Straight');
  const [readingChart, setReadingChart] = useState(false);
  const [readDragOver, setReadDragOver] = useState(false);
  const readInputRef = useRef<HTMLInputElement | null>(null);

  // ---- iReal-style PDF export ----
  const [exportData, setExportData] = useState<ChartPdfData | null>(null);

  const irealLabel = useCallback((c: { root: string; chordType: string; bass?: string }) => {
    const root = spellRootInKey(c.root as NoteName, chartKey, keyMode);
    const map: Record<string, string> = {
      'Major': '', 'Minor': '-', 'Minor 7': '-7', 'Minor 9': '-9', 'Minor 11': '-11',
      'Minor 6': '-6', 'Major 7': 'Δ', 'Major 9': 'Δ9', 'Maj11': 'Δ11', 'Maj13': 'Δ13',
      'Dominant 7': '7', 'Dominant 9': '9', '11': '11', '13': '13',
      'Diminished': '°', 'Dim 7': '°7', 'Half-Dim 7': 'ø7', 'Augmented': '+', 'Aug 7': '+7',
      'Sus2': 'sus2', 'Sus4': 'sus4', '7sus4': '7sus4', 'Add9': 'add9',
      'Major 6': '6', '6add9': '6/9', 'Madd9': '-add9', 'Power (5)': '5',
    };
    const bass = c.bass ? `/${spellRootInKey(c.bass as NoteName, chartKey, keyMode)}` : '';
    return `${root}${map[c.chordType] ?? c.chordType}${bass}`;
  }, [chartKey, keyMode]);


  const openExport = useCallback(() => {
    try {
      setExportData({
        title,
        composer,
        style: feel,
        tempo,
        timeSig,
        slots,
        sections: sections.map(s => ({ id: s.id, name: s.name, startIdx: s.startIdx, endIdx: s.endIdx })),
        arrangement: arrangement.map(a => a.sectionId),
        label: irealLabel,
      });
    } catch (e) {
      toast({ title: 'Export failed', description: String(e) });
    }
  }, [title, composer, feel, tempo, timeSig, slots, sections, arrangement, irealLabel]);

  const closeExport = useCallback(() => setExportData(null), []);

  const downloadExport = useCallback(() => {
    if (!exportData) return;
    try {
      downloadPdf(buildChartPdf(exportData), `${(title || 'chart').replace(/[^\w\-]+/g, '_')}.pdf`);
    } catch (e) {
      toast({ title: 'Download failed', description: String(e) });
    }
  }, [exportData, title]);


  // (Song audio analysis feature removed.)

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
    const outSections: { id: string; name: string; color: string; startBeat: number; lengthBeats: number }[] = [];
    let cursorBeats = 0;
    let chordIdx = 0;
    for (const item of arrangement) {
      const sec = sections.find(s => s.id === item.sectionId);
      if (!sec) continue;
      const sectionStartBeat = cursorBeats;
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
      const lengthBeats = cursorBeats - sectionStartBeat;
      if (lengthBeats > 0) {
        outSections.push({ id: `${item.id}`, name: sec.name, color: sec.color, startBeat: sectionStartBeat, lengthBeats });
      }
    }
    const measures = Math.max(2, Math.ceil(cursorBeats / 4));
    emitRef.current({ chords: out, measures, bpm: tempo, sections: outSections });
  }, [arrangement, sections, slots, tempo]);



  // Auto-linking of consecutive identical chords was removed — each cell should
  // stay visually distinct even when neighbouring chords match.


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
    setEditValue(slot.chord ? formatChordLabel(slot.chord, chartKey, keyMode) : '');
  }, []);

  const commitEdit = useCallback(async (slotId: string, raw: string) => {
    const text = raw.trim();
    setEditingSlot(null);
    setEditValue('');
    if (!text) return;

    const local = parseChordSymbol(text);
    if (local) setSlotChord(slotId, { root: local.root, chordType: local.quality, bass: local.bass });

    setParsingSlot(slotId);
    try {
      const { data, error } = await supabase.functions.invoke('parse-chord', { body: { input: text } });
      if (error) throw error;
      if (data?.root && data?.chordType) {
        setSlotChord(slotId, {
          root: data.root as NoteName,
          chordType: data.chordType,
          bass: (data.bass as NoteName) ?? local?.bass,
        });
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
      const chords: Array<{ root: NoteName; chordType: string; bass?: NoteName; bars: number; section?: string; ending?: 1 | 2 | 3 }> = data?.chords ?? [];
      const meta: { title?: string; composer?: string; timeSig?: string; style?: string; tempo?: number } = data?.meta ?? {};
      if (chords.length === 0) {
        toast({ title: 'No chords detected', description: 'Try a clearer image or crop to the chord chart.', variant: 'destructive' });
        return;
      }
      // Song metadata read off the sheet (title / composer / time signature / feel).
      if (meta.title) setTitle(meta.title);
      if (meta.composer) setComposer(meta.composer);
      if (meta.timeSig) setTimeSig(meta.timeSig);
      if (meta.style) setFeel(meta.style);
      if (typeof meta.tempo === 'number' && meta.tempo > 20 && meta.tempo < 400) setTempo(meta.tempo);
      // Convert to slots (1 bar = UNITS_PER_BAR eighths). Snap fractional bars to nearest 1/8.
      // Track which slot index each chord landed on so we can build sections.
      const newSlots: ChartSlot[] = [];
      const slotSectionLabels: (string | undefined)[] = [];
      chords.forEach(c => {
        const units = Math.max(1, Math.round(c.bars * UNITS_PER_BAR));
        newSlots.push({
          id: uid('slot'),
          bars: units,
          chord: { root: c.root, chordType: c.chordType, ...(c.bass ? { bass: c.bass } : {}) },
          ...(c.ending === 1 || c.ending === 2 || c.ending === 3 ? { ending: c.ending } : {}),
        });
        slotSectionLabels.push(c.section);
      });


      // Pad with empty bars up to at least DEFAULT_SLOT_COUNT bars.
      const usedUnits = newSlots.reduce((n, s) => n + s.bars, 0);
      const minUnits = DEFAULT_SLOT_COUNT * UNITS_PER_BAR;
      let padUnits = Math.max(0, minUnits - usedUnits);
      while (padUnits > 0) {
        newSlots.push({ id: uid('slot'), bars: UNITS_PER_BAR });
        slotSectionLabels.push(undefined);
        padUnits -= UNITS_PER_BAR;
      }

      // Build sections from contiguous runs of the same section label.
      // A label like "A" -> "A Section", full names ("Verse") pass through.
      const expandName = (raw: string) => {
        const t = raw.trim();
        if (/^[A-Z]$/i.test(t)) return `${t.toUpperCase()} Section`;
        return t.charAt(0).toUpperCase() + t.slice(1);
      };
      const newSections: Section[] = [];
      const newArrangement: ArrangementItem[] = [];
      // Repeated labels reuse the same name + colour, but every contiguous run
      // becomes its OWN section so each pass gets its own enclosure box.
      const labelToColor = new Map<string, string>();
      let runStart = -1;
      let runLabel: string | undefined;
      const flushRun = (endIdxExclusive: number) => {
        if (runStart < 0 || !runLabel) return;
        const name = expandName(runLabel);
        let color = labelToColor.get(runLabel);
        if (!color) {
          color = SECTION_COLORS[labelToColor.size % SECTION_COLORS.length];
          labelToColor.set(runLabel, color);
        }
        const secId = uid('sec');
        newSections.push({ id: secId, name, startIdx: runStart, endIdx: endIdxExclusive - 1, color });
        newArrangement.push({ id: uid('arr'), sectionId: secId });
      };
      for (let i = 0; i < slotSectionLabels.length; i++) {
        const lbl = slotSectionLabels[i];
        if (lbl !== runLabel) {
          flushRun(i);
          runStart = lbl ? i : -1;
          runLabel = lbl;
        }
      }
      flushRun(slotSectionLabels.length);

      snapshot();
      setSlots(newSlots);
      setSections(newSections);
      setArrangement(newArrangement);
      const sectionMsg = newSections.length > 0 ? ` in ${newSections.length} section${newSections.length === 1 ? '' : 's'}` : '';
      toast({ title: 'Chart imported', description: `Loaded ${chords.length} chord${chords.length === 1 ? '' : 's'}${sectionMsg}.` });
    } catch (err) {
      toast({ title: 'Read chart failed', description: (err as Error).message ?? 'Try again.', variant: 'destructive' });
    } finally {
      setReadingChart(false);
    }
  }, [snapshot]);






  // Resize by growing/shrinking from a specific edge.
  // Behaviour:
  //  • `targetBars` is the total desired CHAIN length in 1/8-bar units.
  //  • The anchor slot grows/shrinks within its own bar first.
  //  • Any additional units past the anchor's bar spill into subsequent (or
  //    preceding) bars as replicated chord cells — one cell per bar so each
  //    bar stays visually separate. The last replica may be a partial-bar
  //    (1/8-step) so chains can be any 1/8-unit length across the row.
  const resizeSlotEdge = useCallback((slotId: string, targetBars: number, edge: 'right' | 'left') => {
    setSlots(prev => {
      const idx = prev.findIndex(sl => sl.id === slotId);
      if (idx < 0) return prev;
      const current = prev[idx];
      const chord = current.chord;
      const desired = Math.max(1, targetBars);

      // Absolute unit position of the anchor slot.
      let slotStartUnit = 0;
      for (let i = 0; i < idx; i++) slotStartUnit += prev[i].bars;
      const slotEndUnit = slotStartUnit + current.bars;
      const offsetInBar = slotStartUnit % UNITS_PER_BAR;
      const anchorBarStart = slotStartUnit - offsetInBar;
      const anchorBarEnd = anchorBarStart + UNITS_PER_BAR;

      // Row this chain lives in.
      const rowStart = Math.floor(slotStartUnit / COLS) * COLS;
      const rowEnd = rowStart + COLS;

      if (edge === 'right') {
        // Region ends at the row boundary OR the start of the next different
        // chord slot in this row — whichever comes first. This prevents the
        // rebuild from clobbering unrelated chords.
        let regionEndUnit = rowEnd;
        {
          let pos = slotEndUnit;
          for (let i = idx + 1; i < prev.length && pos < rowEnd; i++) {
            const nb = prev[i];
            if (nb.chord && !chordsEqual(nb.chord, chord)) { regionEndUnit = pos; break; }
            pos += nb.bars;
          }
        }
        const regionUnits = regionEndUnit - slotStartUnit;
        if (regionUnits <= 0) return prev;

        const maxOwnBars = Math.min(anchorBarEnd - slotStartUnit, regionUnits);
        const clampedDesired = Math.min(desired, regionUnits);
        const ownDesired = Math.min(clampedDesired, maxOwnBars);
        const extraUnits = chord ? Math.max(0, clampedDesired - maxOwnBars) : 0;

        // Collect region slots (idx .. endIdx) totalling regionUnits units.
        let endIdx = idx;
        let acc = 0;
        for (let i = idx; i < prev.length; i++) {
          acc += prev[i].bars;
          endIdx = i;
          if (acc >= regionUnits) break;
        }

        const region: ChartSlot[] = [];
        region.push({ ...current, bars: ownDesired });
        let placed = ownDesired;

        // Fill remainder of anchor's bar with empty if the anchor didn't reach it.
        if (ownDesired < maxOwnBars) {
          region.push({ id: uid('slot'), bars: maxOwnBars - ownDesired });
          placed = maxOwnBars;
        }

        // Fill remaining bars in the region.
        let remainingExtra = extraUnits;
        while (placed < regionUnits) {
          const barUnits = Math.min(UNITS_PER_BAR, regionUnits - placed);
          if (remainingExtra >= barUnits) {
            region.push({ id: uid('slot'), bars: barUnits, chord: { ...chord! } });
            remainingExtra -= barUnits;
          } else if (remainingExtra > 0) {
            region.push({ id: uid('slot'), bars: remainingExtra, chord: { ...chord! } });
            region.push({ id: uid('slot'), bars: barUnits - remainingExtra });
            remainingExtra = 0;
          } else {
            region.push({ id: uid('slot'), bars: barUnits });
          }
          placed += barUnits;
        }

        const next = prev.slice();
        next.splice(idx, endIdx - idx + 1, ...region);
        return mergeEmptySlots(next);
      } else {
        // LEFT edge — region starts at rowStart OR just after the previous
        // different chord slot in this row, whichever is later.
        let regionStartUnit = rowStart;
        {
          let pos = slotStartUnit;
          for (let i = idx - 1; i >= 0 && pos > rowStart; i--) {
            const nb = prev[i];
            if (nb.chord && !chordsEqual(nb.chord, chord)) { regionStartUnit = pos; break; }
            pos -= nb.bars;
          }
        }
        const regionUnits = slotEndUnit - regionStartUnit;
        if (regionUnits <= 0) return prev;

        const maxOwnBars = Math.min(slotEndUnit - anchorBarStart, regionUnits);
        const clampedDesired = Math.min(desired, regionUnits);
        const ownDesired = Math.min(clampedDesired, maxOwnBars);
        const extraUnits = chord ? Math.max(0, clampedDesired - maxOwnBars) : 0;

        let startIdx = idx;
        let acc = current.bars;
        for (let i = idx - 1; i >= 0; i--) {
          if (acc >= regionUnits) break;
          acc += prev[i].bars;
          startIdx = i;
        }

        const region: ChartSlot[] = [];
        // Bars entirely to the LEFT of anchor's bar within the region.
        // regionStartUnit may not be bar-aligned if a partial replica of another
        // chord sits nearby; in that case the leading bar is truncated.
        const leftUnits = anchorBarStart - regionStartUnit;
        if (leftUnits > 0) {
          const bars: ChartSlot[][] = [];
          let remaining = leftUnits;
          // Split into bar-aligned chunks starting from regionStartUnit.
          let cursor = regionStartUnit;
          while (remaining > 0) {
            const nextBar = Math.floor(cursor / UNITS_PER_BAR) * UNITS_PER_BAR + UNITS_PER_BAR;
            const chunk = Math.min(remaining, nextBar - cursor);
            bars.push([{ id: uid('slot'), bars: chunk }]);
            cursor += chunk;
            remaining -= chunk;
          }
          // Fill from the RIGHT with chord replicas until extraUnits is spent.
          let toFill = extraUnits;
          let bIdx = bars.length - 1;
          while (toFill > 0 && bIdx >= 0) {
            const chunkBars = bars[bIdx][0].bars;
            if (toFill >= chunkBars) {
              bars[bIdx] = [{ id: uid('slot'), bars: chunkBars, chord: { ...chord! } }];
              toFill -= chunkBars;
            } else {
              bars[bIdx] = [
                { id: uid('slot'), bars: chunkBars - toFill },
                { id: uid('slot'), bars: toFill, chord: { ...chord! } },
              ];
              toFill = 0;
            }
            bIdx--;
          }
          for (const b of bars) region.push(...b);
        }

        // Anchor's own bar: optional empty filler to the left of the anchor.
        if (ownDesired < maxOwnBars) {
          region.push({ id: uid('slot'), bars: maxOwnBars - ownDesired });
        }
        region.push({ ...current, bars: ownDesired });

        const next = prev.slice();
        next.splice(startIdx, idx - startIdx + 1, ...region);
        return mergeEmptySlots(next);
      }

    });
  }, []);



  const handleDrop = (slotId: string, e: React.DragEvent) => {
    e.preventDefault();
    setHoverSlot(null);
    const degreeData = e.dataTransfer.getData('application/diatonic-degree');
    if (degreeData) {
      try {
        const { degree } = JSON.parse(degreeData);
        const dc = useSevenths ? diatonicSevenths[degree] : diatonicChords[degree];
        if (dc) {
          setSlotChord(slotId, { root: dc.root, chordType: dc.type });
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

  const startResize = (slotId: string, _startBars: number, edge: 'right' | 'left', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const styles = window.getComputedStyle(grid);
    const gap = parseFloat(styles.columnGap || '0') || 0;
    const unitWidth = (grid.clientWidth - gap * (COLS - 1)) / COLS;
    const startX = e.clientX;

    const idx = slots.findIndex(s => s.id === slotId);
    if (idx < 0) return;
    const slot = slots[idx];
    const chord = slot.chord;

    // Absolute unit position of this slot.
    let slotStartUnit = 0;
    for (let i = 0; i < idx; i++) slotStartUnit += slots[i].bars;
    const slotEndUnit = slotStartUnit + slot.bars;

    // Row this anchor lives in.
    const rowStart = Math.floor(slotStartUnit / COLS) * COLS;
    const rowEnd = rowStart + COLS;

    // Include existing chord replicas (including partial-bar ones) as part of
    // the effective start size so shrinking removes replicas before eating
    // into the anchor slot itself.
    let chainBars = slot.bars;
    if (chord) {
      if (edge === 'right') {
        let pos = slotEndUnit;
        for (let i = idx + 1; i < slots.length && pos < rowEnd; i++) {
          const nb = slots[i];
          if (chordsEqual(nb.chord, chord)) {
            chainBars += nb.bars; pos += nb.bars;
          } else break;
        }
      } else {
        let pos = slotStartUnit;
        for (let i = idx - 1; i >= 0 && pos > rowStart; i--) {
          const nb = slots[i];
          if (chordsEqual(nb.chord, chord)) {
            chainBars += nb.bars; pos -= nb.bars;
          } else break;
        }
      }
    }

    // Cap resize at the row boundary AND at the nearest different-chord slot.
    let boundary = edge === 'right' ? rowEnd : rowStart;
    if (edge === 'right') {
      let pos = slotEndUnit;
      for (let i = idx + 1; i < slots.length && pos < rowEnd; i++) {
        const nb = slots[i];
        if (nb.chord && !chordsEqual(nb.chord, chord)) { boundary = pos; break; }
        pos += nb.bars;
      }
    } else {
      let pos = slotStartUnit;
      for (let i = idx - 1; i >= 0 && pos > rowStart; i--) {
        const nb = slots[i];
        if (nb.chord && !chordsEqual(nb.chord, chord)) { boundary = pos; break; }
        pos -= nb.bars;
      }
    }
    const maxBars = edge === 'right'
      ? boundary - slotStartUnit
      : slotEndUnit - boundary;



    const startBars = chainBars;
    let lastBars = startBars;
    let snapped = false;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const delta = edge === 'right' ? Math.round(dx / unitWidth) : Math.round(-dx / unitWidth);
      const nextBars = Math.min(maxBars, Math.max(1, startBars + delta));
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




  // A 2nd/3rd ending only stacks on a new row when it directly follows a
  // 1st-ending run. A lone later ending (e.g. the "3." at the end of a repeated
  // section) stays inline in the normal flow with just its dotted bracket.
  const stackedEnding: boolean[] = slots.map((s, i) => {
    if (!s.ending || s.ending < 2) return false;
    let j = i - 1;
    while (j >= 0 && (slots[j].ending ?? 0) >= 2) j--;
    return j >= 0 && slots[j].ending === 1;
  });
  const endingRowOffset = (i: number) => (stackedEnding[i] ? slots[i].ending! - 1 : 0);

  // Cumulative unit offset (1/8 bar) at start of each slot.
  // Ending-2 (volta) slots do NOT advance the flow: they are an alternative to
  // the preceding ending-1 bars, so they reuse the same columns one row below.
  const startUnits: number[] = [];
  {
    let n = 0;
    let voltaCursor: number | null = null;
    let voltaEnding: number | null = null;
    slots.forEach((s, i) => {
      if (s.ending && s.ending >= 2 && stackedEnding[i]) {
        if (voltaCursor === null || voltaEnding !== s.ending) {

          voltaEnding = s.ending;
          // Align the 2nd ending with the TAIL of the 1st ending: both endings
          // replace the same number of bars, so the run is right-aligned to
          // where the 1st ending finishes.
          let total2 = 0;
          for (let k = i; k < slots.length && slots[k].ending === s.ending; k++) total2 += slots[k].bars;
          // Walk back over any earlier ending runs (3rd ending sits after the
          // 2nd) until the 1st-ending run is found — that's the anchor.
          let j = i - 1;
          while (j >= 0 && (slots[j].ending ?? 0) >= 2) j--;
          let end1: number | null = null;
          let anchor: number | null = null;
          while (j >= 0 && slots[j].ending === 1) {
            if (end1 === null) end1 = startUnits[j] + slots[j].bars;
            anchor = startUnits[j];
            j--;
          }

          voltaCursor = end1 !== null
            ? Math.max(anchor ?? 0, end1 - total2)
            : Math.floor(n / COLS) * COLS;
        }

        startUnits.push(voltaCursor);
        voltaCursor += s.bars;
      } else {

        voltaCursor = null;
        voltaEnding = null;
        startUnits.push(n);
        n += s.bars;
      }
    });
  }



  const sectionOfSlot = (idx: number): Section | undefined =>
    sections.find(sec => idx >= sec.startIdx && idx <= sec.endIdx);

  // Pickup bars: a chord that sits outside every section and leads straight
  // back into a section (or is the final bar, looping back to the top).
  const pickupSlotIds = new Set<string>(
    slots
      .filter((s, i) => {
        if (!s.chord) return false;
        if (sectionOfSlot(i)) return false;
        const nextStartsSection = sections.some(sec => sec.startIdx === i + 1);
        const isLastChord = !slots.slice(i + 1).some(n => n.chord);
        return nextStartsSection || isLastChord;
      })
      .map(s => s.id),
  );



  // ---- Section-aware row layout ----
  // Each logical row holds COLS units (BARS_PER_ROW bars). We add an extra
  // spacer row between consecutive logical rows when they belong to different
  // sections, so groups are visually separated vertically.
  const logicalRowOf = (idx: number) => Math.floor(startUnits[idx] / COLS);
  const totalLogicalRows = slots.length > 0
    ? Math.max(1, ...slots.map((s, i) => Math.ceil((startUnits[i] + s.bars) / COLS)))
    : 1;
  const firstSlotOnRow: number[] = new Array(totalLogicalRows).fill(-1);
  const lastSlotOnRow: number[] = new Array(totalLogicalRows).fill(-1);
  // Rows that need an extra "second ending" row directly beneath them.
  const extraVoltaRows: number[] = new Array(totalLogicalRows).fill(0);
  slots.forEach((s, i) => {
    const r = logicalRowOf(i);
    if (firstSlotOnRow[r] === -1) firstSlotOnRow[r] = i;
    lastSlotOnRow[r] = i;
    if (s.ending && s.ending >= 2 && stackedEnding[i]) extraVoltaRows[r] = Math.max(extraVoltaRows[r], s.ending - 1);
  });
  const hasSpacerBefore: boolean[] = new Array(totalLogicalRows).fill(false);
  for (let r = 1; r < totalLogicalRows; r++) {
    const prevSec = lastSlotOnRow[r - 1] >= 0 ? sectionOfSlot(lastSlotOnRow[r - 1])?.id : undefined;
    const currSec = firstSlotOnRow[r] >= 0 ? sectionOfSlot(firstSlotOnRow[r])?.id : undefined;
    if (prevSec !== currSec) hasSpacerBefore[r] = true;
  }
  // Grid render-row (1-based) for each logical row + a matching template.
  const renderRowOfLogical: number[] = new Array(totalLogicalRows).fill(1);
  const rowHeights: string[] = [];
  {
    let cursor = 0;
    for (let r = 0; r < totalLogicalRows; r++) {
      if (r > 0 && hasSpacerBefore[r]) { rowHeights.push('2rem'); cursor += 1; }
      cursor += 1;
      renderRowOfLogical[r] = cursor;
      rowHeights.push('2.5rem');
      for (let v = 0; v < extraVoltaRows[r]; v++) { cursor += 1; rowHeights.push('2.5rem'); }
    }
  }
  // Detect sections that are near-copies of an earlier section (e.g. a second
  // A section whose only difference is the final chord) so they can be marked A′.
  const sectionVariation = (() => {
    const map = new Map<string, { ofName: string; diffSlotIds: Set<string> }>();
    const chordsOf = (sec: Section) =>
      slots.slice(sec.startIdx, sec.endIdx + 1).filter(s => s.chord);
    for (let a = 1; a < sections.length; a++) {
      const cur = chordsOf(sections[a]);
      if (cur.length < 3) continue;
      for (let b = 0; b < a; b++) {
        const prev = chordsOf(sections[b]);
        if (prev.length !== cur.length) continue;
        const diff = new Set<string>();
        cur.forEach((s, i) => {
          const p = prev[i].chord!;
          const c = s.chord!;
          if (p.root !== c.root || p.chordType !== c.chordType || p.bass !== c.bass) diff.add(s.id);
        });
        if (diff.size > 0 && diff.size <= Math.max(1, Math.floor(cur.length * 0.25))) {
          map.set(sections[a].id, { ofName: sections[b].name, diffSlotIds: diff });
          break;
        }
      }
    }
    return map;
  })();
  const variantSlotIds = new Set<string>(
    [...sectionVariation.values()].flatMap(v => [...v.diffSlotIds]),
  );

  // Precompute section overlay segments: one single box per section (spanning all rows it touches).
  const sectionSegments = sections.flatMap(sec => {
    if (slots.length === 0) return [];
    // Clamp to the current slot range — indices can drift after merges/resizes,
    // and bailing out here used to silently drop the last section's box.
    const secStart = Math.max(0, Math.min(sec.startIdx, slots.length - 1));
    const secEnd = Math.max(secStart, Math.min(sec.endIdx, slots.length - 1));
    sec = { ...sec, startIdx: secStart, endIdx: secEnd };
    const startRow = logicalRowOf(sec.startIdx);
    const endRow = logicalRowOf(sec.endIdx);
    const singleRow = startRow === endRow;
    const colStart = singleRow ? (startUnits[sec.startIdx] % COLS) + 1 : 1;

    const colEnd = singleRow
      ? Math.max(
          (startUnits[sec.endIdx] % COLS) + slots[sec.endIdx].bars + 1,
          // A second-ending run can extend further right than the last slot.
          ...slots.slice(sec.startIdx, sec.endIdx + 1)
            .map((s, k) => (startUnits[sec.startIdx + k] % COLS) + s.bars + 1),
        )
      : COLS + 1;
    // Wrap tightly to the lowest render row actually occupied by this section.
    let lastRenderRow = renderRowOfLogical[startRow];
    for (let i = sec.startIdx; i <= sec.endIdx; i++) {
      const rr = renderRowOfLogical[logicalRowOf(i)] + endingRowOffset(i);
      if (rr > lastRenderRow) lastRenderRow = rr;
    }
    const variation = sectionVariation.get(sec.id);
    return [{
      key: `${sec.id}-box`,
      rowStart: renderRowOfLogical[startRow],
      rowEnd: lastRenderRow + 1,
      colStart,
      colEnd,
      color: sec.color,
      name: sec.name,
      variation,
      showLabel: true,
    }];
  });


  // Volta (1st / 2nd ending) enclosure boxes — nested inside the section box.
  const voltaSegments = (() => {
    const out: {
      key: string; rowStart: number; rowEnd: number; colStart: number; colEnd: number;
      color: string; label: string;
    }[] = [];
    let i = 0;
    while (i < slots.length) {
      const e = slots[i].ending;
      if (!e) { i++; continue; }
      let j = i;
      while (j + 1 < slots.length && slots[j + 1].ending === e) j++;
      const row = renderRowOfLogical[logicalRowOf(i)] + endingRowOffset(i);
      // A 1st-ending bracket only covers the bars the 2nd ending replaces,
      // so it starts where the (right-aligned) 2nd-ending run starts.
      const nextIsLaterEnding = e === 1 && j + 1 < slots.length && (slots[j + 1].ending ?? 0) >= 2;
      const colStart = nextIsLaterEnding
        ? (startUnits[j + 1] % COLS) + 1
        : (startUnits[i] % COLS) + 1;
      const colEnd = (startUnits[j] % COLS) + slots[j].bars + 1;

      const sec = sectionOfSlot(i);
      out.push({
        key: `volta-${slots[i].id}`,
        rowStart: row,
        rowEnd: row + 1,
        colStart,
        colEnd,
        color: sec?.color ?? '220, 15%, 60%',
        label: `${e}.`,
      });
      i = j + 1;
    }
    return out;
  })();


  // Orphan runs: consecutive chord bars that belong to no section still get a
  // single enclosure box (a run of 2+ bars reads as its own group).
  const orphanSegments = (() => {
    const out: {
      key: string; rowStart: number; rowEnd: number; colStart: number; colEnd: number;
    }[] = [];
    let i = 0;
    while (i < slots.length) {
      if (!slots[i].chord || sectionOfSlot(i)) { i++; continue; }
      let j = i;
      while (j + 1 < slots.length && slots[j + 1].chord && !sectionOfSlot(j + 1)) j++;
      if (j > i) {
        const rows = [];
        for (let k = i; k <= j; k++) rows.push(renderRowOfLogical[logicalRowOf(k)] + endingRowOffset(k));
        const rowStart = Math.min(...rows);
        const rowEnd = Math.max(...rows) + 1;
        const singleRow = rowEnd - rowStart === 1;
        out.push({
          key: `orphan-${slots[i].id}`,
          rowStart,
          rowEnd,
          colStart: singleRow ? (startUnits[i] % COLS) + 1 : 1,
          colEnd: singleRow ? (startUnits[j] % COLS) + slots[j].bars + 1 : COLS + 1,
        });
      }
      i = j + 1;
    }
    return out;
  })();







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

  const shareChart = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast({ title: 'Sign in required', description: 'Create an account to share charts with the community.' });
      return;
    }
    let author = localStorage.getItem('mf-share-author') || '';
    if (!author) {
      author = window.prompt('Enter your display name for the community library:')?.trim() || '';
      if (!author) return;
      localStorage.setItem('mf-share-author', author);
    }
    if (!confirm(`Share "${title || 'Untitled'}" with the community?`)) return;

    const payload = {
      user_id: uid,
      author_name: author,
      kind: 'chart',
      title: title || 'Untitled',
      composer: composer || null,
      tempo: tempo || null,
      time_sig: timeSig || null,
      feel: feel || null,
      genre: null,
      description: null,
      data: { slots, sections, arrangement, chartKey, title, composer, tempo, timeSig, feel } as never,
    };
    const { error } = await supabase.from('shared_charts').insert(payload);

    if (error) {
      toast({ title: 'Share failed', description: error.message });
      return;
    }
    toast({ title: 'Shared with the community', description: `"${payload.title}" is now public.` });
  };

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
        <button
          onClick={() => {
            try {
              const LIB_KEY = 'mf-charts-library';
              const raw = localStorage.getItem(LIB_KEY);
              const lib: any[] = raw ? JSON.parse(raw) : [];
              const payload = { slots, sections, arrangement, chartKey, title, composer, tempo, timeSig, feel };
              const existingIdx = lib.findIndex((c) => c.title === title && title !== 'Untitled');
              const entry = {
                id: existingIdx >= 0 ? lib[existingIdx].id : `chart-${Date.now()}`,
                title: title || 'Untitled',
                composer,
                tempo,
                timeSig,
                feel,
                updatedAt: Date.now(),
                data: payload,
              };
              if (existingIdx >= 0) lib[existingIdx] = entry; else lib.push(entry);
              localStorage.setItem(LIB_KEY, JSON.stringify(lib));
              toast({ title: 'Chart saved', description: `"${entry.title}" added to My Charts.` });
            } catch (e) {
              toast({ title: 'Save failed', description: String(e) });
            }
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider bg-success text-success-foreground hover:bg-success/90 transition-colors shadow-sm"
          title="Save this chart to your library"
        >
          <Save size={10} />
          Save
        </button>
        <button
          onClick={() => {
            if (!confirm('Are you sure? This will clear the current chart, sections, arrangement AND the backing-track timeline chords.')) return;
            setSlots(makeSlots(DEFAULT_SLOT_COUNT));
            setSections([]);
            setArrangement([]);
            setChartKey(currentKey);
            setAutoKey(true);

            setTitle('Untitled');
            setComposer('');
            setTempo(120);
            setTimeSig('4/4');
            setFeel('Straight');
            historyRef.current = [];
            try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
            onResetAll?.();
            toast({ title: 'Chart reset', description: 'A fresh blank chart has been created.' });
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
          title="Reset the current chart to a blank state"
        >
          <RotateCcw size={10} />
          Reset
        </button>
        <button
          onClick={shareChart}
          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider bg-info text-info-foreground hover:bg-info/90 transition-colors shadow-sm"
          title="Share this chart with the community"
        >
          <Share2 size={10} />
          Share
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
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Key</span>
              <button
                onClick={() => setAutoKey(a => !a)}
                title="Detect the key automatically from the chords used"
                className={`px-1 rounded text-[8px] font-mono uppercase tracking-wider border transition-colors ${
                  autoKey ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                }`}
              >Auto</button>
            </div>
            <ScaleRootSelector selectedRoot={chartKey} onSelect={(n) => { setAutoKey(false); setChartKey(n); }} />

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
              type="text"
              inputMode="numeric"
              value={tempoDraft}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setTempoDraft(v);
                if (v !== '') {
                  const n = Math.max(20, Math.min(400, Number(v)));
                  setTempo(n);
                }
              }}
              onBlur={() => {
                const n = Math.max(20, Math.min(400, Number(tempoDraft) || tempo));
                setTempo(n);
                setTempoDraft(String(n));
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              onMouseDown={(e) => {
                const input = e.currentTarget;
                const startY = e.clientY;
                const startTempo = tempo;
                let dragged = false;
                const onMove = (ev: MouseEvent) => {
                  const dy = startY - ev.clientY;
                  if (!dragged && Math.abs(dy) < 3) return;
                  dragged = true;
                  const next = Math.max(20, Math.min(400, startTempo + Math.round(dy / 2)));
                  setTempo(next);
                  setTempoDraft(String(next));
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                  if (dragged) input.blur();
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary cursor-ns-resize"
              title="Type a tempo, or click and drag up/down to change"
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
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Diatonic</span>
                <label className="flex items-center gap-1 cursor-pointer select-none" title="Add 7th extensions to dragged chords">
                  <input
                    type="checkbox"
                    checked={useSevenths}
                    onChange={(e) => setUseSevenths(e.target.checked)}
                    className="w-3 h-3 accent-primary cursor-pointer"
                  />
                  <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">7ths</span>
                </label>
              </div>
              {diatonicChords.slice(0, 7).map((dc, i) => {
                const source = useSevenths ? diatonicSevenths[i] : dc;
                const color = getChordColor({ root: source.root, chordType: source.type });
                const spelledRoot = spelledRoots[i] ?? source.root;
                const suffix = source.symbol.slice(source.root.length);
                const spelledSymbol = spelledRoot + suffix;
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
                    title={`${source.roman} — ${spelledSymbol} (drag into a slot)`}
                  >
                    <span className="text-[10px] font-mono font-bold opacity-80">{source.roman}</span>
                    <span className="text-[11px] font-mono font-bold">{spelledSymbol}</span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={openExport}
            className="mt-1 w-full flex items-center justify-center gap-1 rounded border border-primary/60 bg-primary/15 hover:bg-primary/25 text-primary px-1.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider transition"
            title="Export this chart as an iReal Pro style PDF"
          >
            <FileDown size={11} />
            Export Chart
          </button>



          {sections.length > 0 && (
            <div className="w-full flex flex-col items-stretch gap-1 mt-1 border-t border-border pt-2">
              <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground text-center">Sections</div>
              {sections.map(sec => {
                const progression = slots
                  .slice(sec.startIdx, sec.endIdx + 1)
                  .filter(s => s.chord)
                  .map(s => romanForChord(s.chord!, chartKey))
                  .join('-');
                return (
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
                    {progression && (
                      <span className="ml-auto opacity-80 normal-case truncate">({progression})</span>
                    )}
                  </button>
                  <button
                    onClick={() => removeSection(sec.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    title="Delete section"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                );
              })}

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
                ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                : 'border-border/60 text-muted-foreground hover:border-amber-400/60 hover:text-amber-300'
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
            className="grid gap-1.5 pt-6 pb-2"
            style={{
              gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
              gridTemplateRows: rowHeights.join(' '),
            }}
          >
            {/* Section enclosure boxes — drawn above cells like the fretboard position-focus box. */}
            {sectionSegments.map(seg => (
              <div
                key={seg.key}
                className="pointer-events-none rounded-lg relative"
                style={{
                  gridRow: `${seg.rowStart} / ${seg.rowEnd}`,
                  gridColumn: `${seg.colStart} / ${seg.colEnd}`,
                  border: `3px ${seg.variation ? 'dashed' : 'solid'} hsl(${seg.color} / 0.85)`,
                  background: `hsl(${seg.color} / 0.08)`,
                  margin: '-6px -5px',
                  zIndex: 3,
                }}
              >
                {seg.showLabel && (
                  <span
                    onDoubleClick={(e) => { e.stopPropagation(); renameSection(seg.key.split('-box')[0]); }}
                    className="pointer-events-auto cursor-text absolute -top-2.5 left-2 px-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-background rounded select-none"
                    style={{ color: `hsl(${seg.color})` }}
                    title={seg.variation ? `Variation of ${seg.variation.ofName} — differing bars highlighted` : 'Double-click to rename'}
                  >
                    {seg.name}{seg.variation ? '′' : ''}
                    {seg.variation && (
                      <span className="ml-1 normal-case tracking-normal opacity-80">
                        (var. of {seg.variation.ofName})
                      </span>
                    )}
                  </span>
                )}

              </div>
            ))}
            {/* Volta (1st / 2nd ending) boxes nested inside the section box. */}
            {voltaSegments.map(seg => (
              <div
                key={seg.key}
                className="pointer-events-none rounded-md relative"
                style={{
                  gridRow: `${seg.rowStart} / ${seg.rowEnd}`,
                  gridColumn: `${seg.colStart} / ${seg.colEnd}`,
                  border: `2px dashed hsl(${seg.color} / 0.9)`,
                  margin: '-2px -2px',
                  zIndex: 4,
                }}
              >
                <span
                  className="absolute -top-2 left-1.5 px-1 text-[9px] font-mono font-bold bg-background rounded select-none"
                  style={{ color: `hsl(${seg.color})` }}
                >
                  {seg.label}
                </span>
              </div>
            ))}
            {/* Unsectioned runs of consecutive chords still get one enclosure box. */}
            {orphanSegments.map(seg => (
              <div
                key={seg.key}
                className="pointer-events-none rounded-lg"
                style={{
                  gridRow: `${seg.rowStart} / ${seg.rowEnd}`,
                  gridColumn: `${seg.colStart} / ${seg.colEnd}`,
                  border: '3px solid hsl(220 15% 60% / 0.7)',
                  background: 'hsl(220 15% 60% / 0.07)',
                  margin: '-6px -5px',
                  zIndex: 3,
                }}
              />
            ))}



            {slots.map((slot, idx) => {
              const isHover = hoverSlot === slot.id;
              const isEditing = editingSlot === slot.id;
              const isParsing = parsingSlot === slot.id;
              const color = slot.chord ? getChordColor(slot.chord) : null;
              const section = sectionOfSlot(idx);
              const inDragSel = sectionMode && dragSel && idx >= dragSelStart && idx <= dragSelEnd;
              const startUnit = startUnits[idx];
              const barLabel = formatBarNumber(startUnit);
              const logicalRow = logicalRowOf(idx);
              const gridRowIndex = renderRowOfLogical[logicalRow] + endingRowOffset(idx);
              

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
                    gridColumn: `${(startUnit % COLS) + 1} / span ${slot.bars}`,
                    gridRow: gridRowIndex,
                    background: color ? `hsl(${color})` : undefined,
                    boxShadow: isHover
                      ? 'inset 0 0 0 2px hsl(var(--primary))'
                      : inDragSel
                        ? 'inset 0 0 0 2px hsl(var(--primary))'
                        : variantSlotIds.has(slot.id)
                          ? 'inset 0 0 0 2px hsl(45 95% 60%)'
                          : undefined,

                    zIndex: 1,
                  }}
                  className={`group relative rounded-md flex items-center justify-center transition-colors overflow-hidden ${
                    sectionMode ? 'cursor-crosshair select-none ' : slot.chord ? 'cursor-pointer ' : ''
                  }${
                    color
                      ? 'brightness-100 hover:brightness-110'
                      : 'bg-muted/20 border border-dashed border-border/50 hover:border-primary/60 hover:bg-muted/30'
                  }`}
                  title={slot.chord
                    ? `${formatChordLabel(slot.chord, chartKey, keyMode)} — click to edit extensions`
                    : 'Double-click to type a chord, or drop one here'}
                >
                  {/* Section enclosure is drawn as a single sibling box across all cells (see sectionSegments above). */}

                  {/* Internal bar dividers when a chord spans past its own cell */}
                  {slot.bars > 1 && (() => {
                    const lines: JSX.Element[] = [];
                    for (let u = 1; u < slot.bars; u++) {
                      if ((startUnit + u) % UNITS_PER_BAR !== 0) continue;
                      const leftPct = (u / slot.bars) * 100;
                      lines.push(
                        <div
                          key={u}
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{
                            left: `${leftPct}%`,
                            width: 0,
                            borderLeft: '1px dashed rgba(0,0,0,0.35)',
                          }}
                        />
                      );
                    }
                    return lines;
                  })()}


                  <span
                    className="absolute top-0.5 left-1 text-[9px] font-mono font-bold pointer-events-none select-none"
                    style={{ color: color ? 'rgba(0,0,0,0.65)' : undefined }}
                  >
                    {barLabel}
                  </span>

                  {/* Pickup bar leading back into a section */}
                  {pickupSlotIds.has(slot.id) && (
                    <>
                      <span
                        className="absolute top-0.5 right-1 text-[8px] font-mono font-bold uppercase tracking-wider pointer-events-none select-none"
                        style={{ color: 'rgba(0,0,0,0.7)' }}
                      >
                        Pickup →
                      </span>
                      <div
                        className="absolute inset-0 rounded-md pointer-events-none"
                        style={{ border: '2px dashed hsl(45 95% 55% / 0.95)' }}
                      />
                    </>
                  )}

                  {/* Volta brackets are drawn as their own enclosure boxes (see voltaSegments). */}




                  {section && section.startIdx === idx && (
                    <span
                      className="sr-only"
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
                      {formatChordLabel(slot.chord, chartKey, keyMode)}
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
          {(() => {
            // Endings available inside each section (sorted, distinct).
            const endingsBySection = new Map<string, number[]>();
            sections.forEach(sec => {
              const set = new Set<number>();
              for (let i = Math.max(0, sec.startIdx); i <= Math.min(slots.length - 1, sec.endIdx); i++) {
                const e = slots[i]?.ending;
                if (e) set.add(e);
              }
              endingsBySection.set(sec.id, [...set].sort((a, b) => a - b));
            });
            const total = new Map<string, number>();
            arrangement.forEach(a => total.set(a.sectionId, (total.get(a.sectionId) ?? 0) + 1));
            const occurrence = new Map<string, number>();
            // A section that holds several endings is played once per ending, so
            // its last arrangement entry expands into one chip per remaining ending.
            const chips: { item: ArrangementItem; idx: number; sec: Section; ending: number | null; key: string }[] = [];
            arrangement.forEach((item, i) => {
              const sec = sections.find(s => s.id === item.sectionId);
              if (!sec) return;
              const n = occurrence.get(sec.id) ?? 0;
              occurrence.set(sec.id, n + 1);
              const list = endingsBySection.get(sec.id) ?? [];
              const isLast = n === (total.get(sec.id) ?? 1) - 1;
              const mine = isLast ? list.slice(n) : list.slice(n, n + 1);
              if (!mine.length) {
                chips.push({ item, idx: i, sec, ending: null, key: item.id });
              } else {
                mine.forEach(e => chips.push({ item, idx: i, sec, ending: e, key: `${item.id}-${e}` }));
              }
            });
            return chips.map(({ item, idx: i, sec, ending, key }) => {
              const isOver = arrDragOverIdx === i;
              return (
                <div key={key} className="flex items-center">
                  <div
                    className={`h-1 w-1 rounded-full ${isOver ? 'bg-primary' : 'bg-transparent'}`}
                    onDragOver={(e) => { e.preventDefault(); setArrDragOverIdx(i); }}
                  />
                  <div className="flex flex-col items-stretch gap-0.5">
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
                    {ending && (
                      <div
                        className="rounded border border-dashed px-1 py-[1px] text-center text-[9px] font-mono leading-tight"
                        style={{ borderColor: `hsl(${sec.color} / 0.6)`, color: `hsl(${sec.color})` }}
                      >
                        {ending}. ending
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}


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
            getChordCellLabel={(ct) => formatChordLabel({ root: editorChord.root, chordType: ct }, chartKey, keyMode)}
            draggable={false}
          />
        </div>
      )}

      {/* iReal-style PDF preview */}
      {exportData && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-6"
          onClick={closeExport}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
            style={{ width: 'min(880px, 92vw)', height: 'min(90vh, 1000px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Chart preview · {title || 'Untitled'}
              </span>
              <button
                onClick={downloadExport}
                className="ml-auto flex items-center gap-1 rounded border border-primary/60 bg-primary/15 hover:bg-primary/25 text-primary px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider"
              >
                <FileDown size={11} />
                Download PDF
              </button>
              <button onClick={closeExport} className="text-muted-foreground hover:text-foreground" title="Close">
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden bg-white">
              <ChartPreview data={exportData} />
            </div>
          </div>
        </div>
      )}

    </div>



  );
}


