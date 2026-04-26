import { Plus } from 'lucide-react';
import type { TimelineChord } from '@/hooks/useSongTimeline';

interface CellGridViewProps {
  measures: number;
  chords: TimelineChord[];
  currentBeat: number;
  totalBeats: number;
  getChordColor: (c: TimelineChord) => string;
  onAddBars: () => void;
  onSeek: (beat: number) => void;
}

const BARS_PER_CELL = 4;
const BEATS_PER_BAR = 4;
const SUBS_PER_BEAT = 2; // half-beat granularity → 2 rows × 16 cols visual = 32 squares per row? Actually we render 2 rows × (BARS_PER_CELL*BEATS_PER_BAR) = 16 cols, two rows = 32 squares, each = 0.5 beat
const COLS_PER_CELL = BARS_PER_CELL * BEATS_PER_BAR; // 16
const ROWS_PER_CELL = 2;
const CELLS_PER_ROW = 4;

/**
 * Cell-based view of the chord track.
 * Each cell represents 4 bars, drawn as a 2 × 16 grid of small squares
 * (each square = a half-beat). Cells wrap to a new row after 4 cells.
 */
export default function CellGridView({
  measures, chords, currentBeat, totalBeats,
  getChordColor, onAddBars, onSeek,
}: CellGridViewProps) {
  const beatsPerCell = BARS_PER_CELL * BEATS_PER_BAR;
  const totalCells = Math.max(1, Math.ceil(measures / BARS_PER_CELL));

  // For each "square" within a cell, find the chord that covers it.
  // square index runs 0..(ROWS*COLS - 1); each square spans 0.5 beat
  const squareDuration = 1 / SUBS_PER_BEAT; // 0.5
  const squaresPerCell = ROWS_PER_CELL * COLS_PER_CELL; // 32

  const chordAtBeat = (beat: number): TimelineChord | null => {
    for (const c of chords) {
      if (beat >= c.startBeat && beat < c.startBeat + c.duration) return c;
    }
    return null;
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
              style={{ flex: `1 1 calc(${100 / CELLS_PER_ROW}% - 0.75rem)`, maxWidth: `calc(${100 / CELLS_PER_ROW}% - 0.75rem)`, minWidth: 200 }}
            >
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
            >
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[8px] font-mono uppercase text-muted-foreground tracking-wider">
                  Bars {cellIdx * BARS_PER_CELL + 1}-{cellIdx * BARS_PER_CELL + BARS_PER_CELL}
                </span>
              </div>
              <div
                className="grid gap-[2px]"
                style={{
                  gridTemplateColumns: `repeat(${COLS_PER_CELL}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${ROWS_PER_CELL}, 1fr)`,
                }}
              >
                {Array.from({ length: squaresPerCell }, (_, sqIdx) => {
                  const row = Math.floor(sqIdx / COLS_PER_CELL);
                  const col = sqIdx % COLS_PER_CELL;
                  // Each cell visually has 2 rows × 16 cols. Map to 4 bars × 4 beats × 2 subdivisions:
                  // top row = first 2 bars (8 beats × 2 = 16 squares), bottom row = last 2 bars.
                  const beatInCell = (row * COLS_PER_CELL + col) * squareDuration;
                  const absBeat = cellStartBeat + beatInCell;
                  const isPast = absBeat <= measures * BEATS_PER_BAR;
                  if (!isPast) {
                    return <div key={sqIdx} className="w-full aspect-square rounded-[2px] bg-muted/10" />;
                  }
                  const chord = chordAtBeat(absBeat);
                  const isPlayhead = currentBeat >= absBeat && currentBeat < absBeat + squareDuration;
                  let bg = 'hsl(40, 60%, 35%)'; // default amber square (matches reference image)
                  let opacity = 0.55;
                  if (chord) {
                    bg = `hsl(${getChordColor(chord)})`;
                    opacity = 0.85;
                  }
                  if (isPlayhead) {
                    opacity = 1;
                  }
                  return (
                    <button
                      key={sqIdx}
                      onClick={(e) => { e.stopPropagation(); onSeek(absBeat); }}
                      className="w-full aspect-square rounded-[2px] transition-all hover:brightness-125"
                      style={{
                        background: bg,
                        opacity,
                        boxShadow: isPlayhead
                          ? '0 0 6px hsl(var(--primary)), inset 0 0 0 1px hsl(var(--primary))'
                          : 'none',
                      }}
                      title={`Bar ${Math.floor(absBeat / BEATS_PER_BAR) + 1}, beat ${(absBeat % BEATS_PER_BAR) + 1}`}
                    />
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
