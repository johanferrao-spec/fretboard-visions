import { useState, useCallback, useRef, useEffect } from 'react';
import {
  noteAtFret, isNoteInSelection, getIntervalName, getExtendedIntervalName, getDiatonicChord,
  NoteName, STRING_NAMES, STANDARD_TUNING, DEGREE_COLORS, DEGREE_LEGEND,
  generatePlayableVoicings, generateShellVoicings, generateDrop2Voicings, generateDrop3Voicings,
} from '@/lib/music';
import type { ScaleSelection, ChordSelection, DisplayMode, Orientation } from '@/hooks/useFretboard';

interface FretboardProps {
  maxFrets: number;
  primaryScale: ScaleSelection;
  secondaryScale: ScaleSelection;
  secondaryEnabled: boolean;
  activePrimary: boolean;
  noteColors: Record<string, string>;
  onNoteClick: (note: NoteName) => void;
  displayMode: DisplayMode;
  disabledStrings: Set<number>;
  onToggleString: (idx: number) => void;
  secondaryOpacity: number;
  secondaryColor: string;
  primaryColor: string;
  activeChord: ChordSelection | null;
  orientation: Orientation;
  showFretBox: boolean;
  fretBoxStart: number;
  fretBoxSize: number;
  setFretBoxStart: (v: number) => void;
  setFretBoxSize: (v: number) => void;
  noteMarkerSize: number;
  degreeColors: boolean;
}

const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DOUBLE_INLAY = [12, 24];
const GLOW_FRETS = [12, 24];

function fretWidths(count: number): number[] {
  const widths: number[] = [];
  for (let i = 0; i <= count; i++) {
    widths.push(i === 0 ? 0.4 : 1 / Math.pow(2, (i - 1) / 12));
  }
  const total = widths.reduce((a, b) => a + b, 0);
  return widths.map(w => (w / total) * 100);
}

interface DragNote {
  stringIndex: number;
  fret: number;
  note: NoteName;
}

export default function Fretboard({
  maxFrets, primaryScale, secondaryScale, secondaryEnabled,
  activePrimary, noteColors, onNoteClick, displayMode,
  disabledStrings, onToggleString, secondaryOpacity,
  secondaryColor, primaryColor, activeChord, orientation,
  showFretBox, fretBoxStart, fretBoxSize, setFretBoxStart, setFretBoxSize,
  noteMarkerSize, degreeColors,
}: FretboardProps) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, i) => i);
  const widths = fretWidths(maxFrets);
  const [hoveredDiatonic, setHoveredDiatonic] = useState<{ notes: NoteName[]; name: string; root: NoteName } | null>(null);

  // Drag arpeggio state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPath, setDragPath] = useState<DragNote[]>([]);
  const [dragDirection, setDragDirection] = useState<'ascending' | 'descending' | null>(null);
  const [persistedPaths, setPersistedPaths] = useState<DragNote[][]>([]);
  const fretboardRef = useRef<HTMLDivElement>(null);

  // Position box drag state
  const [boxDragging, setBoxDragging] = useState<'move' | 'left' | 'right' | null>(null);
  const boxDragStartRef = useRef<{ mouseX: number; startFret: number; startSize: number }>({ mouseX: 0, startFret: 0, startSize: 0 });

  const cumLeft: number[] = [];
  let acc = 0;
  for (const w of widths) {
    cumLeft.push(acc);
    acc += w;
  }

  // Get chord voicing notes
  const chordVoicing = activeChord
    ? (() => {
        let voicings: number[][] = [];
        switch (activeChord.voicingSource) {
          case 'full': voicings = generatePlayableVoicings(activeChord.root, activeChord.chordType); break;
          case 'shell': voicings = generateShellVoicings(activeChord.root, activeChord.chordType); break;
          case 'drop2': voicings = generateDrop2Voicings(activeChord.root, activeChord.chordType); break;
          case 'drop3': voicings = generateDrop3Voicings(activeChord.root, activeChord.chordType); break;
        }
        return voicings[activeChord.voicingIndex] || null;
      })()
    : null;

  const chordNoteSet = new Set<string>();
  if (chordVoicing) {
    chordVoicing.forEach((fret, si) => {
      if (fret >= 0) chordNoteSet.add(`${si}-${fret}`);
    });
  }

  const pColor = primaryColor || 'hsl(var(--primary))';
  const sColor = secondaryColor || 'hsl(200, 80%, 60%)';
  const fretBoxEnd = fretBoxStart + fretBoxSize - 1;

  function getDegreeColor(root: NoteName, note: NoteName): string | null {
    const interval = getIntervalName(root, note);
    const degColor = DEGREE_COLORS[interval];
    if (degColor) return `hsl(${degColor})`;
    return null;
  }

  function getNoteStyle(note: NoteName, stringIndex: number, fret: number) {
    // In chord mode, only show chord notes with degree colors relative to chord root
    if (activeChord) {
      if (!chordNoteSet.has(`${stringIndex}-${fret}`)) return null;
      let bg = pColor;
      if (degreeColors) {
        const dc = getDegreeColor(activeChord.root, note);
        if (dc) bg = dc;
      }
      return { backgroundColor: bg, opacity: 1, ring: false, ringColor: '', greyed: false };
    }

    const inPrimary = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
    const inSecondary = secondaryEnabled && isNoteInSelection(note, secondaryScale.root, secondaryScale.scale, secondaryScale.mode);
    if (!inPrimary && !inSecondary) return null;

    const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;

    // Degree-based coloring — works for BOTH scale and arpeggio mode
    let bg = pColor;
    if (degreeColors) {
      const dc = getDegreeColor(activeRoot, note);
      if (dc) bg = dc;
    }

    let opacity = 1;
    let ring = false;
    const ringColor = sColor;
    let greyed = false;

    if (inPrimary && inSecondary) {
      if (!degreeColors) bg = activePrimary ? pColor : sColor;
      opacity = 1;
      ring = true;
    } else if (inPrimary && !inSecondary) {
      if (!degreeColors) bg = pColor;
      opacity = activePrimary ? 1 : secondaryOpacity;
    } else if (inSecondary && !inPrimary) {
      bg = sColor;
      opacity = activePrimary ? secondaryOpacity : 1;
    }

    // Diatonic hover: grey out notes not in hovered chord, color hovered by degree relative to hovered root
    if (hoveredDiatonic && hoveredDiatonic.notes.length > 0) {
      if (!hoveredDiatonic.notes.includes(note)) {
        greyed = true;
        opacity = 0.15;
      } else {
        opacity = 1;
        if (degreeColors) {
          const dc = getDegreeColor(hoveredDiatonic.root, note);
          if (dc) bg = dc;
        }
      }
    }

    // Drag arpeggio: grey out notes in wrong direction
    if (isDragging && dragPath.length > 0 && dragDirection) {
      const first = dragPath[0];
      if (dragDirection === 'ascending') {
        // Grey out everything to the left of the first note
        if (fret < first.fret || (fret === first.fret && stringIndex > first.stringIndex)) {
          greyed = true;
          opacity = 0.15;
        }
      } else if (dragDirection === 'descending') {
        // Grey out everything to the right of the first note
        if (fret > first.fret || (fret === first.fret && stringIndex < first.stringIndex)) {
          greyed = true;
          opacity = 0.15;
        }
      }
    }

    // Position box: grey out notes outside
    if (showFretBox && fret > 0) {
      if (fret < fretBoxStart || fret > fretBoxEnd) {
        greyed = true;
        opacity = 0.15;
      }
    }

    return { backgroundColor: bg, opacity, ring, ringColor, greyed };
  }

  const handleNoteHover = (note: NoteName) => {
    if (activeChord || isDragging) return;
    const activeScale = activePrimary ? primaryScale : secondaryScale;
    const inScale = isNoteInSelection(note, activeScale.root, activeScale.scale, activeScale.mode);
    if (inScale && activeScale.mode === 'scale') {
      const diatonic = getDiatonicChord(activeScale.root, activeScale.scale, note);
      if (diatonic.notes.length > 0) {
        setHoveredDiatonic({ ...diatonic, root: note });
        return;
      }
    }
    setHoveredDiatonic(null);
  };

  // Drag arpeggio handlers
  const handleDragStart = (stringIndex: number, fret: number, note: NoteName) => {
    setIsDragging(true);
    setDragPath([{ stringIndex, fret, note }]);
    setDragDirection(null);
  };

  const handleDragEnter = (stringIndex: number, fret: number, note: NoteName) => {
    if (!isDragging) return;
    const last = dragPath[dragPath.length - 1];
    if (last.stringIndex === stringIndex && last.fret === fret) return;

    let dir = dragDirection;
    if (!dir && dragPath.length >= 1) {
      const first = dragPath[0];
      if (fret > first.fret || (fret === first.fret && stringIndex < first.stringIndex)) {
        dir = 'ascending';
      } else {
        dir = 'descending';
      }
      setDragDirection(dir);
    }

    // Validate direction
    if (dir === 'ascending') {
      if (fret < last.fret - 1) return;
    } else if (dir === 'descending') {
      if (fret > last.fret + 1) return;
    }

    setDragPath(prev => [...prev, { stringIndex, fret, note }]);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Persist the path if it has at least 2 notes
    if (dragPath.length >= 2) {
      setPersistedPaths(prev => [...prev, dragPath]);
    }
  };

  const clearAllPaths = () => {
    setDragPath([]);
    setPersistedPaths([]);
    setDragDirection(null);
  };

  const stringOrder = [5, 4, 3, 2, 1, 0];
  const isVertical = orientation === 'vertical';
  const stringH = 30;

  const getPathLinePoints = (path: DragNote[]) => {
    if (path.length < 2) return [];
    const points: { x: number; y: number }[] = [];
    for (const dn of path) {
      const row = stringOrder.indexOf(dn.stringIndex);
      const x = cumLeft[dn.fret] + widths[dn.fret] / 2;
      const y = (row * stringH + stringH / 2) / (6 * stringH) * 100;
      points.push({ x, y });
    }
    return points;
  };

  // Detect open string notes for glow
  const getOpenStringGlow = () => {
    const glowSet = new Set<number>();
    for (const si of stringOrder) {
      if (disabledStrings.has(si)) continue;
      const note = noteAtFret(si, 0);
      const style = getNoteStyle(note, si, 0);
      if (style && !style.greyed) {
        glowSet.add(si);
      }
    }
    return glowSet;
  };

  const glowStrings = getOpenStringGlow();

  // Position box drag handlers
  const handleBoxMouseDown = useCallback((e: React.MouseEvent, mode: 'move' | 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setBoxDragging(mode);
    boxDragStartRef.current = { mouseX: e.clientX, startFret: fretBoxStart, startSize: fretBoxSize };
  }, [fretBoxStart, fretBoxSize]);

  useEffect(() => {
    if (!boxDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const fb = fretboardRef.current;
      if (!fb) return;
      const rect = fb.getBoundingClientRect();
      const fretAreaWidth = rect.width - 28;
      const pixPerPercent = fretAreaWidth / 100;
      const dx = e.clientX - boxDragStartRef.current.mouseX;
      const dPct = dx / pixPerPercent;

      // Estimate frets moved
      const avgFretWidth = 100 / (maxFrets + 1);
      const dFrets = Math.round(dPct / avgFretWidth);
      const { startFret, startSize } = boxDragStartRef.current;

      if (boxDragging === 'move') {
        const newStart = Math.max(1, Math.min(maxFrets - startSize + 1, startFret + dFrets));
        setFretBoxStart(newStart);
      } else if (boxDragging === 'left') {
        const newStart = Math.max(1, Math.min(startFret + startSize - 3, startFret + dFrets));
        const newSize = startSize - (newStart - startFret);
        if (newSize >= 3 && newSize <= 12) {
          setFretBoxStart(newStart);
          setFretBoxSize(newSize);
        }
      } else if (boxDragging === 'right') {
        const newSize = Math.max(3, Math.min(12, startSize + dFrets));
        if (startFret + newSize - 1 <= maxFrets) {
          setFretBoxSize(newSize);
        }
      }
    };

    const handleMouseUp = () => setBoxDragging(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [boxDragging, maxFrets, setFretBoxStart, setFretBoxSize]);

  // Render all SVG paths (current drag + persisted)
  const allPaths = [...persistedPaths, ...(dragPath.length >= 2 ? [dragPath] : [])];

  // Get chord label for a note when chord is active
  const getChordLabel = (note: NoteName, fret: number, stringIndex: number): string => {
    if (activeChord && degreeColors) {
      return getExtendedIntervalName(activeChord.root, note);
    }
    if (displayMode === 'degrees') {
      const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;
      return getIntervalName(activeRoot, note);
    }
    return note;
  };

  return (
    <div
      className={`w-full relative ${isVertical ? 'flex justify-center' : ''}`}
      onClick={() => { if (!isDragging && (dragPath.length > 0 || persistedPaths.length > 0)) clearAllPaths(); }}
      onMouseUp={handleDragEnd}
    >
      <div
        className={isVertical ? 'origin-center' : ''}
        style={isVertical ? { transform: 'rotate(-90deg)', width: '70vh', maxWidth: 800 } : {}}
      >
        {/* Degree color key */}
        {degreeColors && (
          <div className={`flex items-center gap-1 mb-2 flex-wrap ${isVertical ? 'rotate-90' : ''}`}>
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mr-1">Degrees:</span>
            {DEGREE_LEGEND.map(d => (
              <div key={d.label} className="flex items-center gap-0.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${d.color})` }} />
                <span className="text-[8px] font-mono text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Fret numbers */}
        <div className="flex items-center mb-1">
          <div style={{ width: 28 }} />
          {frets.map(f => (
            <div
              key={f}
              className={`text-center font-mono text-muted-foreground ${isVertical ? 'rotate-90' : ''} ${
                DOUBLE_INLAY.includes(f) ? 'font-bold text-foreground' : ''
              }`}
              style={{
                width: `calc((100% - 28px) * ${widths[f]} / 100)`,
                fontSize: 9,
                ...(GLOW_FRETS.includes(f) ? {
                  textShadow: '0 0 8px hsl(var(--primary)), 0 0 16px hsl(var(--primary))',
                  color: 'hsl(var(--primary))',
                } : {}),
              }}
            >
              {f === 0 ? '' : f}
            </div>
          ))}
        </div>

        {/* Fretboard */}
        <div ref={fretboardRef} className="relative rounded-lg overflow-hidden border border-border bg-fretboard-wood">
          {/* Inlays */}
          <div className="absolute inset-0 pointer-events-none" style={{ left: 28 }}>
            {frets.filter(f => f > 0 && f <= maxFrets && INLAY_FRETS.includes(f)).map(f => {
              const leftPctBase = cumLeft[f];
              const widthPctBase = widths[f];
              const centerPct = leftPctBase + widthPctBase / 2;
              const isDouble = DOUBLE_INLAY.includes(f);
              return isDouble ? (
                <div key={f}>
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-fretboard-inlay" style={{ left: `${centerPct}%`, top: '25%', transform: 'translate(-50%, -50%)' }} />
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-fretboard-inlay" style={{ left: `${centerPct}%`, top: '75%', transform: 'translate(-50%, -50%)' }} />
                </div>
              ) : (
                <div key={f} className="absolute w-2 h-2 rounded-full bg-fretboard-inlay" style={{ left: `${centerPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }} />
              );
            })}
          </div>

          {/* Position box overlay — draggable */}
          {showFretBox && (
            <div
              className="absolute top-0 bottom-0 border-2 border-accent/70 bg-accent/10 rounded-md z-20 transition-[left,width] duration-100"
              style={{
                left: `calc(28px + (100% - 28px) * ${cumLeft[fretBoxStart] || 0} / 100)`,
                width: `calc((100% - 28px) * ${(cumLeft[fretBoxEnd + 1] || cumLeft[maxFrets] || 100) - (cumLeft[fretBoxStart] || 0)} / 100)`,
                cursor: boxDragging === 'move' ? 'grabbing' : 'grab',
              }}
              onMouseDown={e => handleBoxMouseDown(e, 'move')}
            >
              {/* Left resize handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent/30 z-30"
                onMouseDown={e => handleBoxMouseDown(e, 'left')}
              />
              {/* Right resize handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent/30 z-30"
                onMouseDown={e => handleBoxMouseDown(e, 'right')}
              />
            </div>
          )}

          {/* Drag arpeggio lines overlay */}
          {allPaths.map((path, pathIdx) => {
            const pts = getPathLinePoints(path);
            if (pts.length < 2) return null;
            return (
              <svg
                key={pathIdx}
                className="absolute inset-0 pointer-events-none z-30"
                style={{ left: 28, width: 'calc(100% - 28px)', height: '100%' }}
                viewBox={`0 0 100 ${6 * stringH}`}
                preserveAspectRatio="none"
              >
                {pts.map((pt, i, arr) => {
                  if (i === 0) return null;
                  const prev = arr[i - 1];
                  return (
                    <line
                      key={i}
                      x1={prev.x}
                      y1={prev.y / 100 * 6 * stringH}
                      x2={pt.x}
                      y2={pt.y / 100 * 6 * stringH}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeLinecap="round"
                      opacity={0.8}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
                {pts.map((pt, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={pt.x}
                    cy={pt.y / 100 * 6 * stringH}
                    r={4}
                    fill="hsl(var(--primary))"
                    opacity={0.9}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
            );
          })}

          {/* Strings */}
          {stringOrder.map((stringIdx, row) => {
            const isDisabled = disabledStrings.has(stringIdx);
            const thickness = Math.max(1, 3.5 - stringIdx * 0.5);
            const isGlowing = glowStrings.has(stringIdx);

            // In chord mode, check if this string is muted
            const isChordMuted = activeChord && chordVoicing && chordVoicing[stringIdx] === -1;

            return (
              <div key={stringIdx} className="flex items-center relative" style={{ height: stringH }}>
                {/* String label */}
                <button
                  onDoubleClick={() => onToggleString(stringIdx)}
                  className={`shrink-0 w-7 h-full flex items-center justify-center font-mono font-bold transition-all z-10 ${
                    isDisabled ? 'text-muted-foreground/30 line-through' : 'text-muted-foreground'
                  } ${isVertical ? 'rotate-90' : ''}`}
                  style={{
                    fontSize: 9,
                    ...(isChordMuted ? { color: 'hsl(var(--destructive))', fontSize: 10 } : {}),
                    ...(isGlowing && !isChordMuted ? {
                      color: pColor,
                      textShadow: `0 0 6px ${pColor}, 0 0 12px ${pColor}`,
                    } : {}),
                  }}
                  title="Double-click to toggle string"
                >
                  {isChordMuted ? '×' : STRING_NAMES[stringIdx]}
                </button>

                {/* String line */}
                {!isDisabled && (
                  <div className="absolute bg-fretboard-string" style={{ height: thickness, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, left: 28, right: 0 }} />
                )}

                {/* Fret cells */}
                <div className="flex items-center flex-1">
                  {frets.map(fret => {
                    const note = noteAtFret(stringIdx, fret);
                    const style = isDisabled ? null : getNoteStyle(note, stringIdx, fret);
                    const label = getChordLabel(note, fret, stringIdx);
                    const isOpenString = fret === 0;

                    // For open strings: show glow on label, not a dot
                    if (isOpenString && style && !style.greyed) {
                      return (
                        <div key={fret} className="flex items-center justify-center relative" style={{ width: `${widths[fret]}%`, height: stringH }}>
                          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-fretboard-nut" />
                        </div>
                      );
                    }

                    return (
                      <div key={fret} className="flex items-center justify-center relative" style={{ width: `${widths[fret]}%`, height: stringH }}>
                        {/* Fret wire */}
                        {fret > 0 && (
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-fretboard-fret"
                            style={{ width: 2, opacity: 0.6 }}
                          />
                        )}
                        {fret === 0 && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-fretboard-nut" />}

                        {style && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onNoteClick(note); }}
                            onMouseDown={(e) => { e.preventDefault(); handleDragStart(stringIdx, fret, note); }}
                            onMouseEnter={() => { handleDragEnter(stringIdx, fret, note); handleNoteHover(note); }}
                            onMouseLeave={() => { if (!isDragging) setHoveredDiatonic(null); }}
                            className={`relative z-10 rounded-full flex items-center justify-center font-mono font-bold transition-all duration-150 hover:scale-110 active:scale-95 shadow-md cursor-pointer select-none ${
                              style.ring ? 'ring-2' : ''
                            } ${isVertical ? 'rotate-90' : ''} ${
                              dragPath.some(d => d.stringIndex === stringIdx && d.fret === fret) ? 'ring-2 ring-primary scale-110' : ''
                            }`}
                            style={{
                              width: noteMarkerSize,
                              height: noteMarkerSize,
                              backgroundColor: style.greyed ? 'hsl(var(--muted))' : style.backgroundColor,
                              opacity: style.opacity,
                              color: style.greyed ? 'hsl(var(--muted-foreground))' : 'hsl(220, 20%, 8%)',
                              fontSize: Math.max(6, noteMarkerSize * 0.35),
                              ...(style.ring ? { boxShadow: `0 0 0 2px ${style.ringColor}` } : {}),
                            }}
                          >
                            {label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Guitar body silhouette */}
        <svg viewBox="0 0 800 50" className="w-full h-8 mt-0" preserveAspectRatio="none" style={{ marginLeft: 28, width: 'calc(100% - 28px)' }}>
          <defs>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(30, 25%, 16%)" />
              <stop offset="50%" stopColor="hsl(30, 20%, 10%)" />
              <stop offset="100%" stopColor="hsl(30, 15%, 6%)" />
            </linearGradient>
          </defs>
          <path
            d="M0 0 L800 0 L800 6 Q760 10, 740 16 Q720 26, 680 34 Q640 42, 580 46 Q520 50, 440 48 Q400 46, 380 40 Q360 34, 340 32 Q320 34, 300 40 Q280 46, 220 48 Q160 50, 100 42 Q60 36, 40 24 Q25 14, 0 6Z"
            fill="url(#bodyGrad)"
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
          />
          <rect x="300" y="14" width="80" height="6" rx="2" fill="hsl(var(--muted))" opacity="0.25" />
          <rect x="410" y="14" width="80" height="6" rx="2" fill="hsl(var(--muted))" opacity="0.25" />
        </svg>
      </div>

      {/* Diatonic hover tooltip */}
      {hoveredDiatonic && hoveredDiatonic.name && !activeChord && (
        <div className={`absolute z-50 bg-card border border-border rounded-lg shadow-xl px-3 py-2 pointer-events-none ${
          isVertical ? 'top-2 right-2' : 'top-0 right-0'
        }`}>
          <div className="text-xs font-mono font-bold text-foreground">{hoveredDiatonic.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {hoveredDiatonic.notes.join(' – ')}
          </div>
        </div>
      )}

      {/* Clear paths button */}
      {persistedPaths.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); clearAllPaths(); }}
          className="absolute top-1 left-8 z-40 px-2 py-1 rounded bg-destructive/80 text-destructive-foreground text-[9px] font-mono uppercase tracking-wider hover:bg-destructive transition-colors"
        >
          Clear Paths
        </button>
      )}
    </div>
  );
}