import { useState, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import type { NoteName } from '@/lib/music';

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
  /** How many bars this slot spans (min 1). */
  bars: number;
  chord?: ChartChord;
}

interface ChartsViewProps {
  diatonicChords: DiatonicChord[];
  /** Returns `H, S%, L%` triple (no `hsl()` wrapper). */
  getChordColor: (chord: ChartChord) => string;
}

const DEFAULT_SLOT_COUNT = 32;
const COLS = 4;
let nextId = 1;
const uid = (prefix: string) => `${prefix}-${nextId++}`;

const makeSlots = (n: number): ChartSlot[] =>
  Array.from({ length: n }, () => ({ id: uid('slot'), bars: 1 }));

const formatChordLabel = (c: ChartChord): string => {
  const suffix =
    c.chordType === 'Major' ? '' :
    c.chordType === 'Minor' ? 'm' :
    ` ${c.chordType}`;
  return `${c.root}${suffix}`;
};

export default function ChartsView({ diatonicChords, getChordColor }: ChartsViewProps) {
  const [slots, setSlots] = useState<ChartSlot[]>(() => makeSlots(DEFAULT_SLOT_COUNT));
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const setSlotChord = useCallback((slotId: string, chord: ChartChord | undefined) => {
    setSlots(prev => prev.map(sl => sl.id === slotId ? { ...sl, chord } : sl));
  }, []);

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
        // Shrink: reclaim bars as new empty 1-bar slots after.
        const freed = current.bars - desired;
        const next = prev.slice();
        next[idx] = { ...current, bars: desired };
        const newSlots = Array.from({ length: freed }, () => ({ id: uid('slot'), bars: 1 }));
        next.splice(idx + 1, 0, ...newSlots);
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
    // Compute bar width from the current grid: (grid width - gaps) / COLS.
    const styles = window.getComputedStyle(grid);
    const gap = parseFloat(styles.columnGap || '0') || 0;
    const barWidth = (grid.clientWidth - gap * (COLS - 1)) / COLS;
    const startX = e.clientX;
    let lastBars = startBars;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const delta = Math.round(dx / barWidth);
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-card shrink-0">
        <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Charts</span>
        <span className="text-[9px] font-mono text-muted-foreground/70">
          Drag coloured degree cells above into any slot. Each slot = 1 bar. Drag the right edge to resize.
        </span>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/70">
          {slots.reduce((n, s) => n + s.bars, 0)} bars · {slots.length} slots
        </span>
      </div>

      {/* Slot grid */}
      <div className="flex-1 overflow-hidden p-3">
        <div
          ref={gridRef}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {slots.map(slot => {
            const isHover = hoverSlot === slot.id;
            const color = slot.chord ? getChordColor(slot.chord) : null;
            return (
              <div
                key={slot.id}
                onDragOver={(e) => handleDragOver(slot.id, e)}
                onDragLeave={() => setHoverSlot(prev => prev === slot.id ? null : prev)}
                onDrop={(e) => handleDrop(slot.id, e)}
                style={{
                  gridColumn: `span ${slot.bars} / span ${slot.bars}`,
                  background: color ? `hsl(${color})` : undefined,
                  boxShadow: isHover ? 'inset 0 0 0 2px hsl(var(--primary))' : undefined,
                }}
                className={`group relative aspect-[3/1] rounded-md flex items-center justify-center transition-colors overflow-hidden ${
                  color
                    ? 'brightness-100 hover:brightness-110'
                    : 'bg-muted/20 border border-dashed border-border/50 hover:border-primary/60 hover:bg-muted/30'
                }`}
                title={slot.chord ? `${formatChordLabel(slot.chord)} — ${slot.bars} bar${slot.bars === 1 ? '' : 's'}` : 'Empty slot — drop a chord here'}
              >
                {slot.chord ? (
                  <span className="text-[15px] font-mono font-bold pointer-events-none" style={{ color: '#000' }}>
                    {formatChordLabel(slot.chord)}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground/50">1 bar</span>
                )}

                {slot.chord && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSlotChord(slot.id, undefined); }}
                    className="absolute top-1 left-1 p-0.5 rounded bg-background/70 hover:bg-destructive/70 text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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
  );
}
