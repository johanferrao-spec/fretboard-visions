import { useState, useCallback, useRef } from 'react';
import {
  noteAtFret, isNoteInSelection, getIntervalName, getDiatonicChord,
  NoteName, STRING_NAMES, STANDARD_TUNING, DEGREE_COLORS,
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
  noteMarkerSize: number;
  degreeColors: boolean;
}

const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DOUBLE_INLAY = [12, 24];

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
  showFretBox, fretBoxStart, fretBoxSize, noteMarkerSize, degreeColors,
}: FretboardProps) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, i) => i);
  const widths = fretWidths(maxFrets);
  const [hoveredDiatonic, setHoveredDiatonic] = useState<{ notes: NoteName[]; name: string } | null>(null);

  // Drag arpeggio state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPath, setDragPath] = useState<DragNote[]>([]);
  const [dragDirection, setDragDirection] = useState<'ascending' | 'descending' | null>(null);
  const fretboardRef = useRef<HTMLDivElement>(null);

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

  // Open string notes that are active (for glow effect)
  const openStringGlow = new Set<number>();

  const pColor = primaryColor || 'hsl(var(--primary))';
  const sColor = secondaryColor || 'hsl(200, 80%, 60%)';

  const fretBoxEnd = fretBoxStart + fretBoxSize - 1;

  function getNoteStyle(note: NoteName, stringIndex: number, fret: number) {
    // In chord mode, only show chord notes
    if (activeChord) {
      if (!chordNoteSet.has(`${stringIndex}-${fret}`)) return null;
      return { backgroundColor: pColor, opacity: 1, ring: false, ringColor: '', greyed: false };
    }

    const inPrimary = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
    const inSecondary = secondaryEnabled && isNoteInSelection(note, secondaryScale.root, secondaryScale.scale, secondaryScale.mode);
    if (!inPrimary && !inSecondary) return null;

    const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;

    // Degree-based coloring for arpeggios
    let bg = pColor;
    if (degreeColors && (primaryScale.mode === 'arpeggio' || (secondaryEnabled && secondaryScale.mode === 'arpeggio'))) {
      const interval = getIntervalName(activeRoot, note);
      const degColor = DEGREE_COLORS[interval];
      if (degColor) bg = `hsl(${degColor})`;
    }

    let opacity = 1;
    let ring = false;
    const ringColor = sColor;
    let greyed = false;

    if (inPrimary && inSecondary) {
      bg = degreeColors && primaryScale.mode === 'arpeggio' ? bg : (activePrimary ? pColor : sColor);
      opacity = 1;
      ring = true;
    } else if (inPrimary && !inSecondary) {
      if (!degreeColors || primaryScale.mode !== 'arpeggio') bg = pColor;
      opacity = activePrimary ? 1 : secondaryOpacity;
    } else if (inSecondary && !inPrimary) {
      bg = sColor;
      opacity = activePrimary ? secondaryOpacity : 1;
    }

    // Diatonic hover: grey out notes not in hovered chord
    if (hoveredDiatonic && hoveredDiatonic.notes.length > 0) {
      if (!hoveredDiatonic.notes.includes(note)) {
        greyed = true;
        opacity = 0.15;
      } else {
        opacity = 1;
        // Color hovered arpeggio notes by degree
        if (degreeColors) {
          const interval = getIntervalName(hoveredDiatonic.notes[0], note);
          const degColor = DEGREE_COLORS[interval];
          if (degColor) bg = `hsl(${degColor})`;
        }
      }
    }

    // Drag arpeggio: grey out notes in wrong direction
    if (isDragging && dragPath.length > 0 && dragDirection) {
      const lastNote = dragPath[dragPath.length - 1];
      if (dragDirection === 'ascending' && fret < lastNote.fret && stringIndex === lastNote.stringIndex) {
        greyed = true;
        opacity = 0.15;
      } else if (dragDirection === 'descending' && fret > lastNote.fret && stringIndex === lastNote.stringIndex) {
        greyed = true;
        opacity = 0.15;
      }
    }

    // Position box: grey out notes outside the box
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
        setHoveredDiatonic(diatonic);
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

    // Determine direction
    let dir = dragDirection;
    if (!dir && dragPath.length >= 1) {
      if (fret > dragPath[0].fret || (fret === dragPath[0].fret && stringIndex < dragPath[0].stringIndex)) {
        dir = 'ascending';
      } else {
        dir = 'descending';
      }
      setDragDirection(dir);
    }

    // Only allow notes in the established direction
    if (dir === 'ascending') {
      if (fret < last.fret && stringIndex >= last.stringIndex) return;
    } else if (dir === 'descending') {
      if (fret > last.fret && stringIndex <= last.stringIndex) return;
    }

    setDragPath(prev => [...prev, { stringIndex, fret, note }]);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Keep the path visible until user clicks elsewhere
  };

  const clearDragPath = () => {
    setDragPath([]);
    setDragDirection(null);
  };

  // Render strings bottom-to-top: index 0 (low E) at bottom
  const stringOrder = [5, 4, 3, 2, 1, 0];
  const isVertical = orientation === 'vertical';
  const stringH = 30;

  // Calculate positions for drag lines
  const getDragLinePoints = () => {
    if (dragPath.length < 2) return [];
    const points: { x: number; y: number }[] = [];
    for (const dn of dragPath) {
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

  return (
    <div
      className={`w-full relative ${isVertical ? 'flex justify-center' : ''}`}
      onClick={() => { if (!isDragging && dragPath.length > 0) clearDragPath(); }}
      onMouseUp={handleDragEnd}
    >
      <div
        className={isVertical ? 'origin-center' : ''}
        style={isVertical ? { transform: 'rotate(90deg)', width: '70vh', maxWidth: 800 } : {}}
      >
        {/* Guitar headstock */}
        <div className="flex items-end mb-0">
          <div style={{ width: 28 }} />
          <svg viewBox="0 0 400 24" className="w-full h-6 opacity-50" preserveAspectRatio="none">
            <defs>
              <linearGradient id="headGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(30, 20%, 22%)" />
                <stop offset="100%" stopColor="hsl(30, 25%, 14%)" />
              </linearGradient>
            </defs>
            <path
              d="M0 12 Q8 2, 25 4 L45 2 Q55 0, 80 0 L400 0 L400 24 L80 24 Q55 24, 45 22 L25 20 Q8 22, 0 12Z"
              fill="url(#headGrad)"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />
            {/* Tuner pegs */}
            {[60, 100, 140, 220, 260, 300].map((x, i) => (
              <circle key={i} cx={x} cy={i < 3 ? 4 : 20} r={3} fill="hsl(40, 10%, 40%)" opacity={0.6} />
            ))}
          </svg>
        </div>

        {/* Fret numbers */}
        <div className="flex items-center mb-1">
          <div style={{ width: 28 }} />
          {frets.map(f => (
            <div
              key={f}
              className={`text-center font-mono text-muted-foreground ${isVertical ? '-rotate-90' : ''} ${
                DOUBLE_INLAY.includes(f) ? 'font-bold text-foreground' : ''
              }`}
              style={{ width: `calc((100% - 28px) * ${widths[f]} / 100)`, fontSize: 9 }}
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

          {/* Position box overlay */}
          {showFretBox && (
            <div
              className="absolute top-0 bottom-0 border-2 border-accent/70 bg-accent/10 rounded-md pointer-events-none z-20 transition-all duration-300 ease-in-out"
              style={{
                left: `calc(28px + (100% - 28px) * ${cumLeft[fretBoxStart] || 0} / 100)`,
                width: `calc((100% - 28px) * ${(cumLeft[fretBoxEnd + 1] || cumLeft[maxFrets] || 100) - (cumLeft[fretBoxStart] || 0)} / 100)`,
              }}
            />
          )}

          {/* Drag arpeggio lines overlay */}
          {dragPath.length > 1 && (
            <svg
              className="absolute inset-0 pointer-events-none z-30"
              style={{ left: 28, width: 'calc(100% - 28px)', height: '100%' }}
              viewBox={`0 0 100 ${6 * stringH}`}
              preserveAspectRatio="none"
            >
              {getDragLinePoints().map((pt, i, arr) => {
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
              {getDragLinePoints().map((pt, i) => (
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
          )}

          {/* Strings */}
          {stringOrder.map((stringIdx, row) => {
            const isDisabled = disabledStrings.has(stringIdx);
            const thickness = Math.max(1, 3.5 - stringIdx * 0.5);
            const isGlowing = glowStrings.has(stringIdx);

            return (
              <div key={stringIdx} className="flex items-center relative" style={{ height: stringH }}>
                {/* String label */}
                <button
                  onDoubleClick={() => onToggleString(stringIdx)}
                  className={`shrink-0 w-7 h-full flex items-center justify-center font-mono font-bold transition-all z-10 ${
                    isDisabled ? 'text-muted-foreground/30 line-through' : 'text-muted-foreground'
                  } ${isVertical ? '-rotate-90' : ''}`}
                  style={{
                    fontSize: 9,
                    ...(isGlowing ? {
                      color: pColor,
                      textShadow: `0 0 6px ${pColor}, 0 0 12px ${pColor}`,
                    } : {}),
                  }}
                  title="Double-click to toggle string"
                >
                  {STRING_NAMES[stringIdx]}
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
                    const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;
                    const label = displayMode === 'degrees' ? getIntervalName(activeRoot, note) : note;
                    const is12th = fret === 12 || fret === 24;
                    const isOpenString = fret === 0;

                    // For open strings: show glow on label, not a dot
                    if (isOpenString && style && !style.greyed) {
                      // Don't render a dot for open strings - the glow is on the label
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
                            className={`absolute left-0 top-0 bottom-0 ${is12th ? 'bg-fretboard-nut' : 'bg-fretboard-fret'}`}
                            style={{
                              width: is12th ? 3 : 2,
                              opacity: is12th ? 0.9 : 0.6,
                              ...(is12th ? { boxShadow: '0 0 4px hsl(var(--fretboard-nut))' } : {}),
                            }}
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
                            } ${isVertical ? '-rotate-90' : ''} ${
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

        {/* Guitar body silhouette - Shreddage-inspired */}
        <div className="flex items-start mt-0">
          <div style={{ width: 28 }} />
          <svg viewBox="0 0 800 60" className="w-full h-10 opacity-40" preserveAspectRatio="none">
            <defs>
              <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(30, 25%, 16%)" />
                <stop offset="50%" stopColor="hsl(30, 20%, 10%)" />
                <stop offset="100%" stopColor="hsl(30, 15%, 6%)" />
              </linearGradient>
            </defs>
            <path
              d="M0 0 L800 0 L800 8 Q760 12, 740 20 Q720 32, 680 42 Q640 52, 580 56 Q520 60, 440 58 Q400 56, 380 48 Q360 40, 340 38 Q320 40, 300 48 Q280 56, 220 58 Q160 60, 100 52 Q60 44, 40 30 Q25 18, 0 8Z"
              fill="url(#bodyGrad)"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />
            {/* Pickups hint */}
            <rect x="340" y="18" width="60" height="8" rx="2" fill="hsl(var(--muted))" opacity="0.3" />
            <rect x="420" y="18" width="60" height="8" rx="2" fill="hsl(var(--muted))" opacity="0.3" />
          </svg>
        </div>
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
    </div>
  );
}
