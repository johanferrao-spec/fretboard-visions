import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { TimelineChord } from '@/hooks/useSongTimeline';
import type { NoteName } from '@/lib/music';

interface DiatonicChord {
  root: NoteName;
  type: string;
  symbol: string;
  roman: string;
}

interface CellGridViewProps {
  measures: number;
  chords: TimelineChord[];
  currentBeat: number;
  totalBeats: number;
  getChordColor: (c: TimelineChord) => string;
  onAddBars: () => void;
  onSeek: (beat: number) => void;
  onAddChord: (root: NoteName, chordType: string, startBeat: number, duration?: number) => string;
  onRemoveChord: (id: string) => void;
  diatonicChords: DiatonicChord[];
}

const BARS_PER_CELL = 4;
const BEATS_PER_BAR = 4;
const CELLS_PER_ROW = 4;

/**
 * Cell-based view of the chord track.
 * Each cell represents 4 bars, drawn as 4 large divisions (1 per bar).
 * Drop chords from the diatonic buttons or chord library onto a division to fill that bar.
 * Cells wrap to a new row after 4 cells.
 */
export default function CellGridView({
  measures, chords, currentBeat,
  getChordColor, onAddBars, onSeek,
  onAddChord, onRemoveChord, diatonicChords,
}: CellGridViewProps) {
  const beatsPerCell = BARS_PER_CELL * BEATS_PER_BAR;
  const totalCells = Math.max(1, Math.ceil(measures / BARS_PER_CELL));
  const [hoverDivision, setHoverDivision] = useState<number | null>(null);

  const chordAtBeat = (beat: number): TimelineChord | null => {
    for (const c of chords) {
      if (beat >= c.startBeat && beat < c.startBeat + c.duration) return c;
    }
    return null;
  };

  const formatChordLabel = (chord: TimelineChord): string => {
    const suffix =
      chord.chordType === 'Major' ? '' :
      chord.chordType === 'Minor' ? 'm' :
      ` ${chord.chordType}`;
    return `${chord.root}${suffix}`;
  };

  const handleDrop = (e: React.DragEvent, barStartBeat: number) => {
    e.preventDefault();
    e.stopPropagation();
    setHoverDivision(null);

    const dur = BEATS_PER_BAR; // fill the entire bar division

    // Replace any existing chord regions overlapping this bar
    const overlaps = chords.filter(c => {
      const cEnd = c.startBeat + c.duration;
      return barStartBeat < cEnd && barStartBeat + dur > c.startBeat;
    });
    overlaps.forEach(c => onRemoveChord(c.id));

    const degreeData = e.dataTransfer.getData('application/diatonic-degree');
    if (degreeData) {
      try {
        const { degree } = JSON.parse(degreeData);
        const dc = diatonicChords[degree];
        if (dc) onAddChord(dc.root, dc.type, barStartBeat, dur);
        return;
      } catch {/* ignore */}
    }
    const chordData = e.dataTransfer.getData('application/chord');
    if (chordData) {
      try {
        const { root, chordType } = JSON.parse(chordData);
        onAddChord(root, chordType, barStartBeat, dur);
      } catch {/* ignore */}
    }
  };

  const handleDragOver = (e: React.DragEvent, divIdx: number) => {
    if (
      e.dataTransfer.types.includes('application/chord') ||
      e.dataTransfer.types.includes('application/diatonic-degree')
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setHoverDivision(divIdx);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-3 bg-secondary/10">
      <div className="flex flex-wrap gap-3 items-stretch">
        {Array.from({ length: totalCells }, (_, cellIdx) => {
          const cellStartBeat = cellIdx * beatsPerCell;
          const cellEndBeat = cellStartBeat + beatsPerCell;
          const isActive = currentBeat >= cellStartBeat && currentBeat < cellEndBeat;

          return (
            <div
              key={cellIdx}
              className={`rounded-md p-1.5 transition-all bg-card/60 ${
                isActive
                  ? 'ring-2 ring-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]'
                  : 'ring-1 ring-border/40'
              }`}
              style={{
                flex: `1 1 calc(${100 / CELLS_PER_ROW}% - 0.75rem)`,
                maxWidth: `calc(${100 / CELLS_PER_ROW}% - 0.75rem)`,
                minWidth: 200,
              }}
            >
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[8px] font-mono uppercase text-muted-foreground tracking-wider">
                  Bars {cellIdx * BARS_PER_CELL + 1}-{cellIdx * BARS_PER_CELL + BARS_PER_CELL}
                </span>
              </div>

              {/* 4 large divisions, 1 per bar */}
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: BARS_PER_CELL }, (_, divIdx) => {
                  const barStartBeat = cellStartBeat + divIdx * BEATS_PER_BAR;
                  const barNumber = cellIdx * BARS_PER_CELL + divIdx + 1;
                  const isWithinTrack = barNumber <= measures;
                  const chord = chordAtBeat(barStartBeat);
                  const isPlayheadBar =
                    currentBeat >= barStartBeat &&
                    currentBeat < barStartBeat + BEATS_PER_BAR;
                  const globalDivKey = cellIdx * BARS_PER_CELL + divIdx;
                  const isHovered = hoverDivision === globalDivKey;

                  if (!isWithinTrack) {
                    return (
                      <div
                        key={divIdx}
                        className="aspect-[3/2] rounded-sm bg-muted/10 border border-dashed border-border/30"
                      />
                    );
                  }

                  let bg = 'hsl(40, 60%, 30%)';
                  let opacity = 0.55;
                  let textColor = 'hsl(var(--foreground))';
                  if (chord) {
                    bg = `hsl(${getChordColor(chord)})`;
                    opacity = 0.9;
                    textColor = '#000';
                  }

                  return (
                    <button
                      key={divIdx}
                      onClick={(e) => { e.stopPropagation(); onSeek(barStartBeat); }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (chord) onRemoveChord(chord.id);
                      }}
                      onDragOver={(e) => handleDragOver(e, globalDivKey)}
                      onDragLeave={() => setHoverDivision(prev => prev === globalDivKey ? null : prev)}
                      onDrop={(e) => handleDrop(e, barStartBeat)}
                      className="aspect-[3/2] rounded-sm transition-all hover:brightness-125 flex items-center justify-center px-1 relative overflow-hidden"
                      style={{
                        background: bg,
                        opacity,
                        boxShadow: isPlayheadBar
                          ? 'inset 0 0 0 2px hsl(var(--primary)), 0 0 8px hsl(var(--primary) / 0.6)'
                          : isHovered
                            ? 'inset 0 0 0 2px hsl(var(--primary))'
                            : 'inset 0 0 0 1px hsl(220, 15%, 25%)',
                      }}
                      title={
                        chord
                          ? `Bar ${barNumber}: ${formatChordLabel(chord)} — click: seek, double-click: remove`
                          : `Bar ${barNumber} — drop a chord here`
                      }
                    >
                      {chord ? (
                        <span
                          className="text-[11px] font-mono font-bold truncate"
                          style={{ color: textColor }}
                        >
                          {formatChordLabel(chord)}
                          {chord.bassNote && (
                            <span className="opacity-70">/{chord.bassNote}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-muted-foreground/60">
                          {barNumber}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* "+" add-bars button — appears in line with the cells */}
        {measures < 32 && (
          <button
            onClick={onAddBars}
            className="self-stretch min-w-[40px] flex items-center justify-center rounded-md border border-dashed border-border hover:border-primary hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary"
            title={`Add 4 bars (currently ${measures} bars)`}
          >
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
