import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Loader2, Group, Trash2, Check } from 'lucide-react';

import type { NoteName } from '@/lib/music';
import { parseChordSymbol } from '@/lib/chordParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ChordBuilder } from '@/components/ChordReference';

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
  diatonicChords: DiatonicChord[];
  /** Returns `H, S%, L%` triple (no `hsl()` wrapper). */
  getChordColor: (chord: ChartChord) => string;
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

const formatBarNumber = (startEighth: number): string => {
  const bar = startEighth / UNITS_PER_BAR + 1;
  return Number.isInteger(bar) ? String(bar) : bar.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};


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

const SECTION_COLORS = [
  '210 80% 60%', '340 75% 60%', '45 90% 55%', '150 60% 50%',
  '280 60% 60%', '20 80% 55%', '190 70% 55%', '95 55% 50%',
];

export default function ChartsView({ diatonicChords, getChordColor }: ChartsViewProps) {
  const [slots, setSlots] = useState<ChartSlot[]>(() => makeSlots(DEFAULT_SLOT_COUNT));
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [parsingSlot, setParsingSlot] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionMode, setSectionMode] = useState(false);
  const [sectionStartIdx, setSectionStartIdx] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);


  const setSlotChord = useCallback((slotId: string, chord: ChartChord | undefined) => {
    setSlots(prev => prev.map(sl => sl.id === slotId ? { ...sl, chord } : sl));
  }, []);

  const beginEdit = useCallback((slot: ChartSlot) => {
    setEditingSlot(slot.id);
    setEditValue(slot.chord ? formatChordLabel(slot.chord) : '');
  }, []);

  const commitEdit = useCallback(async (slotId: string, raw: string) => {
    const text = raw.trim();
    setEditingSlot(null);
    setEditValue('');
    if (!text) return;

    // Optimistic local parse for instant feedback.
    const local = parseChordSymbol(text);
    if (local) setSlotChord(slotId, { root: local.root, chordType: local.quality });

    // AI resolution for anything ambiguous or verbose.
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


  const resizeSlot = useCallback((slotId: string, targetBars: number) => {
    setSlots(prev => {
      const idx = prev.findIndex(sl => sl.id === slotId);
      if (idx < 0) return prev;
      const current = prev[idx];
      const desired = Math.max(1, targetBars);
      if (desired === current.bars) return prev;

      if (desired > current.bars) {
        // Grow: consume following slots (each contributes its bars).
        let need = desired - current.bars;
        const next = prev.slice();
        let cursor = idx + 1;
        while (need > 0 && cursor < next.length) {
          const neighbor = next[cursor];
          if (neighbor.bars <= need) {
            need -= neighbor.bars;
            next.splice(cursor, 1);
          } else {
            // Shouldn't happen since slots created by resize are 1 bar,
            // but handle by shrinking the neighbor.
            next[cursor] = { ...neighbor, bars: neighbor.bars - need };
            need = 0;
          }
        }
        const grown = desired - need;
        next[idx] = { ...current, bars: grown };
        return next;
      } else {
        // Shrink: reclaim freed units as a single empty slot after.
        const freed = current.bars - desired;
        const next = prev.slice();
        next[idx] = { ...current, bars: desired };
        next.splice(idx + 1, 0, { id: uid('slot'), bars: freed });
        return next;
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

  const startResize = (slotId: string, startBars: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    // Compute one grid unit (1/8 bar) width from the current grid.
    const styles = window.getComputedStyle(grid);
    const gap = parseFloat(styles.columnGap || '0') || 0;
    const unitWidth = (grid.clientWidth - gap * (COLS - 1)) / COLS;
    const startX = e.clientX;
    let lastBars = startBars;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const delta = Math.round(dx / unitWidth);
      const nextBars = Math.max(1, startBars + delta);
      if (nextBars !== lastBars) {
        lastBars = nextBars;
        resizeSlot(slotId, nextBars);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };




  // Cumulative bar number at start of each slot (1-indexed).
  const barNumbers: number[] = [];
  {
    let n = 1;
    for (const s of slots) { barNumbers.push(n); n += s.bars; }
  }

  const sectionOfSlot = (idx: number): Section | undefined =>
    sections.find(sec => idx >= sec.startIdx && idx <= sec.endIdx);

  const handleSlotClickForSection = (idx: number) => {
    if (!sectionMode) return;
    if (sectionStartIdx === null) {
      setSectionStartIdx(idx);
      return;
    }
    const startIdx = Math.min(sectionStartIdx, idx);
    const endIdx = Math.max(sectionStartIdx, idx);
    const name = window.prompt('Section name', `Section ${String.fromCharCode(65 + sections.length)}`);
    setSectionStartIdx(null);
    setSectionMode(false);
    if (!name) return;
    // Remove any existing sections overlapping this range.
    setSections(prev => [
      ...prev.filter(s => s.endIdx < startIdx || s.startIdx > endIdx),
      { id: uid('sec'), name, startIdx, endIdx, color: SECTION_COLORS[sections.length % SECTION_COLORS.length] },
    ]);
  };

  const renameSection = (id: string) => {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    const name = window.prompt('Rename section', sec.name);
    if (!name) return;
    setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-card shrink-0">
        <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Charts</span>
        <span className="text-[9px] font-mono text-muted-foreground/70">
          Drag coloured degree cells into any slot, or double-click a slot to type a chord (e.g. "Am7", "A minor seventh"). Drag the right edge to resize.
        </span>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/70">
          {slots.reduce((n, s) => n + s.bars, 0)} bars · {slots.length} slots
        </span>
      </div>

      {/* Body: vertical toolbar + slot grid */}
      <div className="flex-1 overflow-hidden flex">
        {/* Vertical toolbar */}
        <div className="w-20 shrink-0 border-r border-border bg-card flex flex-col items-stretch gap-2 py-2 px-1.5 overflow-y-auto">
          <button
            onClick={() => { setSectionMode(m => !m); setSectionStartIdx(null); }}
            className={`h-9 rounded flex items-center justify-center gap-1 border transition-colors ${
              sectionMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted'
            }`}
            title={sectionMode
              ? (sectionStartIdx === null ? 'Click first slot of section' : 'Click last slot of section')
              : 'Group into section'}
          >
            {sectionMode && sectionStartIdx !== null ? <Check size={14} /> : <Group size={14} />}
          </button>

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
                    className="rounded px-1 py-1 flex flex-col items-center leading-tight cursor-grab active:cursor-grabbing hover:brightness-110 transition"
                    style={{ background: `hsl(${color})`, color: '#000' }}
                    title={`${dc.roman} — ${dc.symbol} (drag into a slot)`}
                  >
                    <span className="text-[9px] font-mono font-bold opacity-80">{dc.roman}</span>
                    <span className="text-[11px] font-mono font-bold">{dc.symbol}</span>
                  </button>
                );
              })}
            </div>
          )}


          {sections.length > 0 && (
            <div className="w-full flex flex-col items-center gap-1 mt-1 border-t border-border pt-2">
              {sections.map(sec => (
                <div key={sec.id} className="flex flex-col items-center gap-0.5 w-full px-1">
                  <button
                    onClick={() => renameSection(sec.id)}
                    className="w-full text-[8px] font-mono font-bold uppercase truncate rounded px-0.5 py-0.5"
                    style={{ background: `hsl(${sec.color} / 0.25)`, color: `hsl(${sec.color})` }}
                    title={`Rename "${sec.name}"`}
                  >
                    {sec.name}
                  </button>
                  <button
                    onClick={() => setSections(prev => prev.filter(s => s.id !== sec.id))}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete section"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slot grid */}
        <div className="flex-1 overflow-hidden p-3">
          <div
            ref={gridRef}
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {slots.map((slot, idx) => {
              const isHover = hoverSlot === slot.id;
              const isEditing = editingSlot === slot.id;
              const isParsing = parsingSlot === slot.id;
              const color = slot.chord ? getChordColor(slot.chord) : null;
              const section = sectionOfSlot(idx);
              const isSectionPickStart = sectionMode && sectionStartIdx === idx;
              return (
                <div
                  key={slot.id}
                  onDragOver={(e) => handleDragOver(slot.id, e)}
                  onDragLeave={() => setHoverSlot(prev => prev === slot.id ? null : prev)}
                  onDrop={(e) => handleDrop(slot.id, e)}
                  onDoubleClick={() => { if (!sectionMode) beginEdit(slot); }}
                  onClick={() => handleSlotClickForSection(idx)}
                  style={{
                    gridColumn: `span ${slot.bars} / span ${slot.bars}`,
                    background: color ? `hsl(${color})` : undefined,
                    boxShadow: isHover
                      ? 'inset 0 0 0 2px hsl(var(--primary))'
                      : isSectionPickStart
                        ? 'inset 0 0 0 2px hsl(var(--primary))'
                        : undefined,
                    borderTop: section ? `3px solid hsl(${section.color})` : undefined,
                  }}
                  className={`group relative aspect-[5/1] rounded-md flex items-center justify-center transition-colors overflow-hidden ${
                    sectionMode ? 'cursor-crosshair ' : ''
                  }${
                    color
                      ? 'brightness-100 hover:brightness-110'
                      : 'bg-muted/20 border border-dashed border-border/50 hover:border-primary/60 hover:bg-muted/30'
                  }`}
                  title={slot.chord ? `${formatChordLabel(slot.chord)} — ${slot.bars} bar${slot.bars === 1 ? '' : 's'}` : 'Double-click to type a chord, or drop one here'}
                >
                  {/* Bar number (top-left) */}
                  <span
                    className="absolute top-0.5 left-1 text-[9px] font-mono font-bold pointer-events-none select-none"
                    style={{ color: color ? 'rgba(0,0,0,0.65)' : undefined }}
                  >
                    {barNumbers[idx]}
                  </span>

                  {/* Section label on first slot of a section */}
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

                  {/* Right-edge resize handle */}
                  <div
                    onMouseDown={(e) => startResize(slot.id, slot.bars, e)}
                    className="absolute top-0 right-0 h-full w-2 cursor-ew-resize hover:bg-primary/40 transition-colors"
                    title="Drag to resize"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

