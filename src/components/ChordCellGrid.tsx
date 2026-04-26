import { useEffect, useRef, useState } from 'react';
import { ChevronsLeftRight, Plus } from 'lucide-react';
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
  onResizeChordRange: (id: string, newStartBeat: number, newDuration: number) => void;
  diatonicChords: DiatonicChord[];
}

const BARS_PER_CELL = 4;
const BEATS_PER_BAR = 4;
const CELLS_PER_ROW = 4;
const RESIZE_SNAP = 1; // snap resize to whole beats (= 1/4 of a bar)
const MIN_DURATION = 1; // minimum chord length in beats

/**
 * Cell-based view of the chord track.
 * Each cell represents 4 bars, drawn as 4 large divisions (1 per bar).
 * Drop chords onto a division to fill that bar. Drag the thin handles on the
 * left/right of any chord segment to resize from that side; resizing past a
 * neighbouring chord shrinks (or removes) that neighbour.
 */
export default function CellGridView({
  measures, chords, currentBeat,
  getChordColor, onAddBars, onSeek,
  onAddChord, onRemoveChord, onResizeChordRange,
  diatonicChords,
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

  // Resize drag state.
  const resizeRef = useRef<{
    chordId: string;
    edge: 'left' | 'right';
    startX: number;
    pxPerBeat: number;
    origStart: number;
    origDuration: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dxBeats = (e.clientX - r.startX) / r.pxPerBeat;
      const totalBeats = measures * BEATS_PER_BAR;

      let newStart = r.origStart;
      let newEnd = r.origStart + r.origDuration;

      if (r.edge === 'right') {
        const raw = r.origStart + r.origDuration + dxBeats;
        const snapped = Math.round(raw / RESIZE_SNAP) * RESIZE_SNAP;
        newEnd = Math.max(r.origStart + MIN_DURATION, Math.min(totalBeats, snapped));
      } else {
        const raw = r.origStart + dxBeats;
        const snapped = Math.round(raw / RESIZE_SNAP) * RESIZE_SNAP;
        newStart = Math.max(0, Math.min(newEnd - MIN_DURATION, snapped));
      }

      onResizeChordRange(r.chordId, newStart, newEnd - newStart);
    };
    const onUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [measures, onResizeChordRange]);

  const beginResize = (e: React.MouseEvent, chord: TimelineChord, edge: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    // Find the bar div containing this handle so we can compute pixels-per-beat.
    const barEl = (e.target as HTMLElement).closest('[data-bar-div]') as HTMLElement | null;
    if (!barEl) {
      console.warn('[resize] could not find data-bar-div ancestor');
      return;
    }
    const rect = barEl.getBoundingClientRect();
    const pxPerBeat = rect.width / BEATS_PER_BAR;
    resizeRef.current = {
      chordId: chord.id,
      edge,
      startX: e.clientX,
      pxPerBeat,
      origStart: chord.startBeat,
      origDuration: chord.duration,
    };
    document.body.style.cursor = 'ew-resize';
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
                  const barEndBeat = barStartBeat + BEATS_PER_BAR;
                  const barNumber = cellIdx * BARS_PER_CELL + divIdx + 1;
                  const isWithinTrack = barNumber <= measures;
                  const isPlayheadBar =
                    currentBeat >= barStartBeat &&
                    currentBeat < barEndBeat;
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

                  // Build per-bar chord segments: include any chord intersecting this bar,
                  // clipped to the bar's bounds, plus filler "empty" segments for gaps.
                  type Segment = { chord: TimelineChord | null; start: number; end: number };
                  const segments: Segment[] = [];
                  let cursor = barStartBeat;
                  const overlapping = chords
                    .filter(c => c.startBeat < barEndBeat && c.startBeat + c.duration > barStartBeat)
                    .sort((a, b) => a.startBeat - b.startBeat);
                  for (const c of overlapping) {
                    const segStart = Math.max(barStartBeat, c.startBeat);
                    const segEnd = Math.min(barEndBeat, c.startBeat + c.duration);
                    if (segStart > cursor) {
                      segments.push({ chord: null, start: cursor, end: segStart });
                    }
                    segments.push({ chord: c, start: segStart, end: segEnd });
                    cursor = segEnd;
                  }
                  if (cursor < barEndBeat) {
                    segments.push({ chord: null, start: cursor, end: barEndBeat });
                  }

                  const dropTitle = overlapping.length > 0
                    ? `Bar ${barNumber} — click: seek, double-click: clear`
                    : `Bar ${barNumber} — drop a chord here`;

                  return (
                    <div
                      key={divIdx}
                      data-bar-div
                      onClick={(e) => { e.stopPropagation(); onSeek(barStartBeat); }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        // Remove every chord overlapping this bar
                        overlapping.forEach(c => onRemoveChord(c.id));
                      }}
                      onDragOver={(e) => handleDragOver(e, globalDivKey)}
                      onDragLeave={() => setHoverDivision(prev => prev === globalDivKey ? null : prev)}
                      onDrop={(e) => handleDrop(e, barStartBeat)}
                      className="aspect-[3/2] rounded-sm transition-all hover:brightness-110 flex relative overflow-hidden cursor-pointer"
                      style={{
                        boxShadow: isPlayheadBar
                          ? 'inset 0 0 0 2px hsl(var(--primary)), 0 0 8px hsl(var(--primary) / 0.6)'
                          : isHovered
                            ? 'inset 0 0 0 2px hsl(var(--primary))'
                            : 'inset 0 0 0 1px hsl(220, 15%, 25%)',
                      }}
                      title={dropTitle}
                    >
                      {segments.map((seg, segIdx) => {
                        const segLength = seg.end - seg.start;
                        const flexBasis = `${(segLength / BEATS_PER_BAR) * 100}%`;
                        // Show name only when segment occupies at least half the bar
                        const showName = !!seg.chord && segLength >= BEATS_PER_BAR / 2;

                        if (!seg.chord) {
                          return (
                            <div
                              key={segIdx}
                              style={{
                                flex: `0 0 ${flexBasis}`,
                                background: 'hsl(40, 60%, 30%)',
                                opacity: 0.45,
                              }}
                              className="flex items-center justify-center"
                            >
                              {/* Show bar number only when the empty segment fills the whole bar */}
                              {segLength === BEATS_PER_BAR && (
                                <span className="text-[9px] font-mono text-muted-foreground/60">
                                  {barNumber}
                                </span>
                              )}
                            </div>
                          );
                        }

                        // Resize handles only at the chord's TRUE edges (not at bar boundaries
                        // mid-chord), so a chord spanning multiple bars only shows its handles
                        // on the bar(s) where its real start/end live.
                        const isChordTrueStart = Math.abs(seg.start - seg.chord.startBeat) < 0.001;
                        const isChordTrueEnd =
                          Math.abs(seg.end - (seg.chord.startBeat + seg.chord.duration)) < 0.001;

                        return (
                          <div
                            key={segIdx}
                            style={{
                              flex: `0 0 ${flexBasis}`,
                              background: `hsl(${getChordColor(seg.chord)})`,
                              opacity: 0.9,
                            }}
                            className="flex items-center justify-center px-0.5 min-w-0 relative group/seg"
                            title={`${formatChordLabel(seg.chord)} (${segLength} beat${segLength === 1 ? '' : 's'}) — drag edges to resize`}
                          >
                            {showName && (
                              <span
                                className="text-[11px] font-mono font-bold truncate pointer-events-none"
                                style={{ color: '#000' }}
                              >
                                {formatChordLabel(seg.chord)}
                                {seg.chord.bassNote && (
                                  <span className="opacity-70">/{seg.chord.bassNote}</span>
                                )}
                              </span>
                            )}
                            {/* Left resize handle — wider for easier grabbing, always visible */}
                            {isChordTrueStart && (
                              <div
                                onMouseDown={(e) => beginResize(e, seg.chord!, 'left')}
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => e.stopPropagation()}
                                className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 flex items-center justify-center hover:brightness-125"
                                style={{ background: 'hsl(var(--foreground) / 0.35)' }}
                                title="Drag to resize from left"
                              >
                                <ChevronsLeftRight size={9} className="text-background pointer-events-none" />
                              </div>
                            )}
                            {/* Right resize handle */}
                            {isChordTrueEnd && (
                              <div
                                onMouseDown={(e) => beginResize(e, seg.chord!, 'right')}
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 flex items-center justify-center hover:brightness-125"
                                style={{ background: 'hsl(var(--foreground) / 0.35)' }}
                                title="Drag to resize from right"
                              >
                                <ChevronsLeftRight size={9} className="text-background pointer-events-none" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
