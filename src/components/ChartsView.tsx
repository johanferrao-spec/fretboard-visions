import { useState, useCallback } from 'react';
import { Plus, Minus, Trash2, X } from 'lucide-react';
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
  /** How many half-bar units this slot spans (min 1). 2 = one full bar. */
  halfBars: number;
  chord?: ChartChord;
}

export interface ChartSection {
  id: string;
  label: string;
  slots: ChartSlot[];
}

interface ChartsViewProps {
  diatonicChords: DiatonicChord[];
  /** Returns `H, S%, L%` triple (no `hsl()` wrapper), matching SongTimeline. */
  getChordColor: (chord: ChartChord) => string;
}

const DEFAULT_HALF_BARS_PER_SECTION = 16; // 8 bars each
let nextId = 1;
const uid = (prefix: string) => `${prefix}-${nextId++}`;

const makeSlots = (n: number): ChartSlot[] =>
  Array.from({ length: n }, () => ({ id: uid('slot'), halfBars: 1 }));

const defaultSections = (): ChartSection[] => [
  { id: uid('sec'), label: 'A', slots: makeSlots(DEFAULT_HALF_BARS_PER_SECTION) },
  { id: uid('sec'), label: 'B', slots: makeSlots(DEFAULT_HALF_BARS_PER_SECTION) },
];

const formatChordLabel = (c: ChartChord): string => {
  const suffix =
    c.chordType === 'Major' ? '' :
    c.chordType === 'Minor' ? 'm' :
    ` ${c.chordType}`;
  return `${c.root}${suffix}`;
};

export default function ChartsView({ diatonicChords, getChordColor }: ChartsViewProps) {
  const [sections, setSections] = useState<ChartSection[]>(defaultSections);
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);

  const addSection = useCallback((label: 'A' | 'B') => {
    setSections(prev => [...prev, { id: uid('sec'), label, slots: makeSlots(DEFAULT_HALF_BARS_PER_SECTION) }]);
  }, []);

  const removeSection = useCallback((id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  }, []);

  const relabelSection = useCallback((id: string, label: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  }, []);

  const addSlots = useCallback((sectionId: string, n = 4) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, slots: [...s.slots, ...makeSlots(n)] } : s,
    ));
  }, []);

  const setSlotChord = useCallback((sectionId: string, slotId: string, chord: ChartChord | undefined) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, slots: s.slots.map(sl => sl.id === slotId ? { ...sl, chord } : sl) }
        : s,
    ));
  }, []);

  const extendSlot = useCallback((sectionId: string, slotId: string) => {
    // Extending consumes the next slot in the section (adds half a bar of span).
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const idx = s.slots.findIndex(sl => sl.id === slotId);
      if (idx < 0 || idx >= s.slots.length - 1) return s;
      const next = s.slots.slice();
      next[idx] = { ...next[idx], halfBars: next[idx].halfBars + 1 };
      next.splice(idx + 1, 1);
      return { ...s, slots: next };
    }));
  }, []);

  const shrinkSlot = useCallback((sectionId: string, slotId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const idx = s.slots.findIndex(sl => sl.id === slotId);
      if (idx < 0) return s;
      const slot = s.slots[idx];
      if (slot.halfBars <= 1) return s;
      const next = s.slots.slice();
      next[idx] = { ...slot, halfBars: slot.halfBars - 1 };
      next.splice(idx + 1, 0, { id: uid('slot'), halfBars: 1 });
      return { ...s, slots: next };
    }));
  }, []);

  const handleDrop = (sectionId: string, slotId: string, e: React.DragEvent) => {
    e.preventDefault();
    setHoverSlot(null);
    const degreeData = e.dataTransfer.getData('application/diatonic-degree');
    if (degreeData) {
      try {
        const { degree } = JSON.parse(degreeData);
        const dc = diatonicChords[degree];
        if (dc) {
          const chordType = degree === 4 ? 'Dominant 7' : dc.type;
          setSlotChord(sectionId, slotId, { root: dc.root, chordType });
        }
        return;
      } catch { /* ignore */ }
    }
    const chordData = e.dataTransfer.getData('application/chord');
    if (chordData) {
      try {
        const { root, chordType } = JSON.parse(chordData);
        setSlotChord(sectionId, slotId, { root, chordType });
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-card shrink-0">
        <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Charts</span>
        <span className="text-[9px] font-mono text-muted-foreground/70">Drag the coloured degree cells above into any slot — each slot = ½ bar.</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => addSection('A')}
            className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
            title="Add an A section"
          >
            <Plus size={10} />A Section
          </button>
          <button
            onClick={() => addSection('B')}
            className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-accent/40 text-foreground hover:bg-accent/60 transition-colors flex items-center gap-1"
            title="Add a B section"
          >
            <Plus size={10} />B Section
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {sections.map(section => (
          <div key={section.id} className="rounded-lg border border-border/60 bg-card/40 p-2">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2 px-0.5">
              <input
                value={section.label}
                onChange={e => relabelSection(section.id, e.target.value.slice(0, 8))}
                className="w-10 text-center text-[13px] font-bold font-mono tracking-wider bg-secondary/50 rounded px-1 py-0.5 border border-border/40 focus:outline-none focus:border-primary"
                title="Section label"
              />
              <span className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">
                {section.slots.reduce((n, s) => n + s.halfBars, 0) / 2} bars · {section.slots.length} slots
              </span>
              <button
                onClick={() => addSlots(section.id, 4)}
                className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-secondary hover:bg-muted text-muted-foreground flex items-center gap-1"
                title="Add 4 more half-bar slots"
              >
                <Plus size={9} />4 Slots
              </button>
              <button
                onClick={() => removeSection(section.id)}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete section"
              >
                <Trash2 size={11} />
              </button>
            </div>

            {/* Slot grid */}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
              {section.slots.map(slot => {
                const isHover = hoverSlot === slot.id;
                const color = slot.chord ? getChordColor(slot.chord) : null;
                return (
                  <div
                    key={slot.id}
                    onDragOver={(e) => handleDragOver(slot.id, e)}
                    onDragLeave={() => setHoverSlot(prev => prev === slot.id ? null : prev)}
                    onDrop={(e) => handleDrop(section.id, slot.id, e)}
                    style={{
                      gridColumn: `span ${slot.halfBars} / span ${slot.halfBars}`,
                      background: color ? `hsl(${color})` : undefined,
                      boxShadow: isHover ? 'inset 0 0 0 2px hsl(var(--primary))' : undefined,
                    }}
                    className={`group relative aspect-[3/2] rounded-md flex items-center justify-center transition-all overflow-hidden ${
                      color
                        ? 'brightness-100 hover:brightness-110'
                        : 'bg-muted/20 border border-dashed border-border/50 hover:border-primary/60 hover:bg-muted/30'
                    }`}
                    title={slot.chord ? `${formatChordLabel(slot.chord)} — ${slot.halfBars / 2} bar${slot.halfBars === 2 ? '' : 's'}` : 'Empty slot — drop a chord here'}
                  >
                    {slot.chord ? (
                      <span className="text-[13px] font-mono font-bold pointer-events-none" style={{ color: '#000' }}>
                        {formatChordLabel(slot.chord)}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-muted-foreground/50">½</span>
                    )}

                    {/* Slot controls */}
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); shrinkSlot(section.id, slot.id); }}
                        disabled={slot.halfBars <= 1}
                        className="p-0.5 rounded bg-background/70 hover:bg-background text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Shrink by ½ bar"
                      >
                        <Minus size={9} />
                      </button>
                      {slot.chord && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSlotChord(section.id, slot.id, undefined); }}
                          className="p-0.5 rounded bg-background/70 hover:bg-destructive/70 text-foreground"
                          title="Clear chord"
                        >
                          <X size={9} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); extendSlot(section.id, slot.id); }}
                        className="p-0.5 rounded bg-background/70 hover:bg-background text-foreground"
                        title="Extend by ½ bar (consumes next slot)"
                      >
                        <Plus size={9} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {sections.length === 0 && (
          <div className="text-center text-[11px] font-mono text-muted-foreground py-8">
            No sections. Add an A or B section to get started.
          </div>
        )}
      </div>
    </div>
  );
}
