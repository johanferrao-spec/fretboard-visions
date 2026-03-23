import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  noteAtFret, isNoteInSelection, getIntervalName, getExtendedIntervalName, getDiatonicChord,
  NoteName, STRING_NAMES, STANDARD_TUNING, DEGREE_COLORS, DEGREE_LEGEND, INTERVAL_TO_POSITION,
  getVoicingsForChord, getArpeggioSequence, getDiatonicArpeggioType, getMidiNote, findNotePositions,
  type ChordVoicing,
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
  fretBoxStringStart: number;
  fretBoxStringSize: number;
  setFretBoxStringStart: (v: number) => void;
  setFretBoxStringSize: (v: number) => void;
  noteMarkerSize: number;
  degreeColors: boolean;
  setDegreeColors: (v: boolean) => void;
  disabledDegrees: Set<string>;
  toggleDegree: (d: string) => void;
  setShowFretBox: (v: boolean) => void;
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
  fretBoxStringStart, fretBoxStringSize, setFretBoxStringStart, setFretBoxStringSize,
  noteMarkerSize, degreeColors, setDegreeColors, disabledDegrees, toggleDegree, setShowFretBox,
}: FretboardProps) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, i) => i);
  const widths = fretWidths(maxFrets);
  const [hoveredDiatonic, setHoveredDiatonic] = useState<{ notes: NoteName[]; name: string; root: NoteName } | null>(null);

  // Guided drag arpeggio state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPath, setDragPath] = useState<DragNote[]>([]);
  const [dragArpRoot, setDragArpRoot] = useState<NoteName | null>(null);
  const [dragArpSequence, setDragArpSequence] = useState<number[]>([]);
  const [dragArpStepIndex, setDragArpStepIndex] = useState(0);
  const [persistedPaths, setPersistedPaths] = useState<DragNote[][]>([]);
  const fretboardRef = useRef<HTMLDivElement>(null);

  // Position box drag state
  const [boxDragging, setBoxDragging] = useState<'move' | 'left' | 'right' | null>(null);
  const boxDragStartRef = useRef<{ mouseX: number; startFret: number; startSize: number }>({ mouseX: 0, startFret: 0, startSize: 0 });

  const cumLeft: number[] = [];
  let acc = 0;
  for (const w of widths) { cumLeft.push(acc); acc += w; }

  // Get chord voicing notes
  const chordVoicing = activeChord
    ? (() => {
        const voicings = getVoicingsForChord(activeChord.root, activeChord.chordType, activeChord.voicingSource);
        const v = voicings[activeChord.voicingIndex];
        return v ? v.frets : null;
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

  // Compute which notes are valid targets for guided arpeggio
  const guidedTargets = useMemo(() => {
    if (!isDragging || !dragArpRoot || dragArpSequence.length === 0 || dragPath.length === 0) return new Set<string>();
    
    const rootIdx = (['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).indexOf(dragArpRoot);
    const nextStep = dragArpStepIndex < dragArpSequence.length ? dragArpSequence[dragArpStepIndex] : 0; // wrap to root
    const targetNote = (['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const)[(rootIdx + (nextStep % 12)) % 12];
    
    // Find the MIDI note of the last note in the path
    const lastNote = dragPath[dragPath.length - 1];
    const lastMidi = getMidiNote(lastNote.stringIndex, lastNote.fret);
    
    // Find closest target note positions (same octave = within ~6 semitones)
    const positions = findNotePositions(targetNote, 0, maxFrets);
    const targets = new Set<string>();
    
    // Filter to nearby positions (within reasonable reach)
    for (const pos of positions) {
      const posMidi = getMidiNote(pos.stringIndex, pos.fret);
      // For ascending: target should be higher or same octave
      // For the 3rd step specifically, restrict to same octave
      const midiDiff = posMidi - lastMidi;
      if (dragArpStepIndex === 0) {
        // First step (finding 3rd): within ~7 semitones up or down
        if (Math.abs(midiDiff) <= 7 && midiDiff !== 0) {
          targets.add(`${pos.stringIndex}-${pos.fret}`);
        }
      } else {
        // Subsequent steps: prefer ascending
        if (midiDiff > 0 && midiDiff <= 12) {
          targets.add(`${pos.stringIndex}-${pos.fret}`);
        }
        // Also allow descending for flexibility
        if (midiDiff < 0 && midiDiff >= -5) {
          targets.add(`${pos.stringIndex}-${pos.fret}`);
        }
      }
    }
    
    return targets;
  }, [isDragging, dragArpRoot, dragArpSequence, dragArpStepIndex, dragPath, maxFrets]);

  // Notes already in the drag path
  const pathNoteSet = useMemo(() => {
    const set = new Set<string>();
    for (const dn of dragPath) set.add(`${dn.stringIndex}-${dn.fret}`);
    for (const path of persistedPaths) {
      for (const dn of path) set.add(`${dn.stringIndex}-${dn.fret}`);
    }
    return set;
  }, [dragPath, persistedPaths]);

  function getDegreeColor(root: NoteName, note: NoteName): string | null {
    const interval = getIntervalName(root, note);
    const position = INTERVAL_TO_POSITION[interval];
    if (position !== undefined && disabledDegrees.has(String(position))) return null;
    const degColor = DEGREE_COLORS[interval];
    if (degColor) return `hsl(${degColor})`;
    return null;
  }

  function getNoteStyle(note: NoteName, stringIndex: number, fret: number) {
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
    const interval = getIntervalName(activeRoot, note);

    let bg = pColor;
    if (degreeColors) {
      const dc = getDegreeColor(activeRoot, note);
      if (dc) bg = dc;
      else bg = pColor; // disabled degree → default color
    }

    let opacity = 1;
    let ring = false;
    const ringColor = sColor;
    let greyed = false;

    if (inPrimary && inSecondary) {
      if (!degreeColors) bg = activePrimary ? pColor : sColor;
      ring = true;
    } else if (inPrimary && !inSecondary) {
      if (!degreeColors) bg = pColor;
      opacity = activePrimary ? 1 : secondaryOpacity;
    } else if (inSecondary && !inPrimary) {
      bg = sColor;
      opacity = activePrimary ? secondaryOpacity : 1;
    }

    // Diatonic hover
    if (hoveredDiatonic && hoveredDiatonic.notes.length > 0) {
      if (!hoveredDiatonic.notes.includes(note)) {
        greyed = true; opacity = 0.15;
      } else {
        opacity = 1;
        if (degreeColors) {
          const dc = getDegreeColor(hoveredDiatonic.root, note);
          if (dc) bg = dc;
        }
      }
    }

    // Guided drag arpeggio: only show target notes + path notes
    if (isDragging && dragPath.length > 0 && guidedTargets.size > 0) {
      const key = `${stringIndex}-${fret}`;
      if (!guidedTargets.has(key) && !pathNoteSet.has(key)) {
        greyed = true; opacity = 0.1;
      }
    }

    // Position box: grey out notes outside
    if (showFretBox && fret > 0) {
      if (fret < fretBoxStart || fret > fretBoxEnd) {
        greyed = true; opacity = 0.15;
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

  // Guided drag arpeggio handlers
  const handleDragStart = (stringIndex: number, fret: number, note: NoteName) => {
    // Determine diatonic arpeggio type for this note
    const activeScale = activePrimary ? primaryScale : secondaryScale;
    const arpType = getDiatonicArpeggioType(activeScale.root, activeScale.scale, note);
    if (!arpType) return;

    const sequence = getArpeggioSequence(arpType);
    setIsDragging(true);
    setDragPath([{ stringIndex, fret, note }]);
    setDragArpRoot(note);
    setDragArpSequence(sequence);
    setDragArpStepIndex(1); // Next step is the 2nd tone (e.g., 3rd)
  };

  const handleDragEnter = (stringIndex: number, fret: number, note: NoteName) => {
    if (!isDragging || !dragArpRoot) return;
    const last = dragPath[dragPath.length - 1];
    if (last.stringIndex === stringIndex && last.fret === fret) return;

    // Cancel if returning to start
    if (dragPath.length > 1 && dragPath[0].stringIndex === stringIndex && dragPath[0].fret === fret) {
      setDragPath([]);
      setIsDragging(false);
      setDragArpRoot(null);
      return;
    }

    // Only connect to guided target notes
    const key = `${stringIndex}-${fret}`;
    if (!guidedTargets.has(key)) return;

    setDragPath(prev => [...prev, { stringIndex, fret, note }]);
    
    // Advance to next step
    if (dragArpStepIndex < dragArpSequence.length - 1) {
      setDragArpStepIndex(prev => prev + 1);
    } else {
      // Completed one cycle, allow extending to next octave
      setDragArpStepIndex(0);
    }
  };

  const handleDragEnd = () => {
    if (isDragging && dragPath.length >= 2) {
      setPersistedPaths(prev => [...prev, dragPath]);
    }
    setIsDragging(false);
    setDragPath([]);
    setDragArpRoot(null);
    setDragArpSequence([]);
    setDragArpStepIndex(0);
  };

  // Double-click on fretboard to clear paths
  const handleDoubleClick = useCallback(() => {
    if (persistedPaths.length > 0) {
      setPersistedPaths([]);
    }
  }, [persistedPaths]);

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

  // Open string glow detection
  const getOpenStringGlow = () => {
    const glowSet = new Set<number>();
    for (const si of stringOrder) {
      if (disabledStrings.has(si)) continue;
      const note = noteAtFret(si, 0);
      const style = getNoteStyle(note, si, 0);
      if (style && !style.greyed) glowSet.add(si);
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
      const avgFretWidth = 100 / (maxFrets + 1);
      const dFrets = Math.round(dPct / avgFretWidth);
      const { startFret, startSize } = boxDragStartRef.current;
      if (boxDragging === 'move') {
        setFretBoxStart(Math.max(1, Math.min(maxFrets - startSize + 1, startFret + dFrets)));
      } else if (boxDragging === 'left') {
        const newStart = Math.max(1, Math.min(startFret + startSize - 3, startFret + dFrets));
        const newSize = startSize - (newStart - startFret);
        if (newSize >= 3 && newSize <= 12) { setFretBoxStart(newStart); setFretBoxSize(newSize); }
      } else if (boxDragging === 'right') {
        const newSize = Math.max(3, Math.min(12, startSize + dFrets));
        if (startFret + newSize - 1 <= maxFrets) setFretBoxSize(newSize);
      }
    };
    const handleMouseUp = () => setBoxDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [boxDragging, maxFrets, setFretBoxStart, setFretBoxSize]);

  const allPaths = [...persistedPaths, ...(isDragging && dragPath.length >= 2 ? [dragPath] : [])];

  const getChordLabel = (note: NoteName, fret: number, stringIndex: number): string => {
    if (activeChord && displayMode !== 'notes') return getExtendedIntervalName(activeChord.root, note);
    if (displayMode === 'degrees') {
      const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;
      return getIntervalName(activeRoot, note);
    }
    if (displayMode === 'fingers' && activeChord) {
      const voicings = getVoicingsForChord(activeChord.root, activeChord.chordType, activeChord.voicingSource);
      const v = voicings[activeChord.voicingIndex];
      if (v?.fingers) {
        const f = v.fingers[stringIndex];
        if (f === 0) return 'O';
        if (f === 'B') return 'B';
        return String(f);
      }
    }
    return note;
  };

  return (
    <div
      className={`w-full relative ${isVertical ? 'flex justify-center' : ''}`}
      onMouseUp={handleDragEnd}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={isVertical ? 'origin-center' : ''}
        style={isVertical ? { transform: 'rotate(90deg)', width: '80vh', maxWidth: 900 } : {}}
      >
        {/* Degree color key + toggles + position box toggle */}
        <div className={`flex items-center gap-1 mb-2 flex-wrap ${isVertical ? '-rotate-90' : ''}`}>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mr-1">Key:</span>
          {DEGREE_LEGEND.map(d => {
            const posKey = String(d.position);
            const isOff = disabledDegrees.has(posKey);
            return (
              <button
                key={d.label}
                onClick={() => toggleDegree(posKey)}
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-all ${isOff ? 'opacity-30' : 'opacity-100'}`}
                title={`Toggle ${d.label}`}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${d.color})` }} />
                <span className="text-[8px] font-mono text-muted-foreground">{d.label}</span>
              </button>
            );
          })}
          {/* Degrees Active / Disable All toggle */}
          <button
            onClick={() => {
              if (!degreeColors) {
                // Turn on degree colors and enable all degrees
                setDegreeColors(true);
                DEGREE_LEGEND.forEach(d => { const k = String(d.position); if (disabledDegrees.has(k)) toggleDegree(k); });
              } else {
                const allOn = DEGREE_LEGEND.every(d => !disabledDegrees.has(String(d.position)));
                if (allOn) {
                  // Disable all individual degrees (keeps degreeColors true but no colors show)
                  DEGREE_LEGEND.forEach(d => { const k = String(d.position); if (!disabledDegrees.has(k)) toggleDegree(k); });
                } else {
                  // Enable all individual degrees
                  DEGREE_LEGEND.forEach(d => { const k = String(d.position); if (disabledDegrees.has(k)) toggleDegree(k); });
                }
              }
            }}
            className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider transition-colors ml-1 ${
              degreeColors && DEGREE_LEGEND.every(d => !disabledDegrees.has(String(d.position)))
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {degreeColors && DEGREE_LEGEND.every(d => !disabledDegrees.has(String(d.position))) ? 'Disable All' : 'Degrees Active'}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowFretBox(!showFretBox)}
              className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider transition-colors ${
                showFretBox ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              Box {showFretBox ? 'ON' : 'OFF'}
            </button>
          </div>
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
              style={{
                width: `calc((100% - 28px) * ${widths[f]} / 100)`,
                fontSize: 10,
                ...(GLOW_FRETS.includes(f) ? {
                  textShadow: '0 0 8px hsl(130 70% 45%), 0 0 16px hsl(130 70% 45%)',
                  color: 'hsl(130, 70%, 55%)',
                  fontWeight: 700,
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

          {/* Position box overlay */}
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
              <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent/30 z-30" onMouseDown={e => handleBoxMouseDown(e, 'left')} />
              <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent/30 z-30" onMouseDown={e => handleBoxMouseDown(e, 'right')} />
            </div>
          )}

          {/* Drag arpeggio lines overlay */}
          {allPaths.map((path, pathIdx) => {
            const pts = getPathLinePoints(path);
            if (pts.length < 2) return null;
            const totalH = 6 * stringH;
            return (
              <svg
                key={pathIdx}
                className="absolute inset-0 pointer-events-none z-30"
                style={{ left: 28, width: 'calc(100% - 28px)', height: '100%' }}
                viewBox={`0 0 100 ${totalH}`}
                preserveAspectRatio="none"
              >
                {pts.map((pt, i, arr) => {
                  if (i === 0) return null;
                  const prev = arr[i - 1];
                  return (
                    <line
                      key={i}
                      x1={prev.x} y1={prev.y * totalH / 100}
                      x2={pt.x} y2={pt.y * totalH / 100}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeLinecap="round"
                      opacity={0.7}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
                {pts.map((pt, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={pt.x} cy={pt.y * totalH / 100}
                    r={4}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    opacity={0.8}
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
            const isChordMuted = activeChord && chordVoicing && chordVoicing[stringIdx] === -1;

            return (
              <div key={stringIdx} className="flex items-center relative" style={{ height: stringH }}>
                {/* String label */}
                <button
                  onDoubleClick={(e) => { e.stopPropagation(); onToggleString(stringIdx); }}
                  className={`shrink-0 w-7 h-full flex items-center justify-center font-mono font-bold transition-all z-10 ${
                    isDisabled ? 'text-muted-foreground/30 line-through' : 'text-muted-foreground'
                  } ${isVertical ? '-rotate-90' : ''}`}
                  style={{
                    fontSize: 9,
                    ...(isChordMuted ? { color: 'hsl(var(--destructive))', fontSize: 10, textShadow: '0 0 4px hsl(var(--destructive))' } : {}),
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

                    if (isOpenString && style && !style.greyed) {
                      return (
                        <div key={fret} className="flex items-center justify-center relative" style={{ width: `${widths[fret]}%`, height: stringH }}>
                          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-fretboard-nut" />
                        </div>
                      );
                    }

                    return (
                      <div key={fret} className="flex items-center justify-center relative" style={{ width: `${widths[fret]}%`, height: stringH }}>
                        {fret > 0 && <div className="absolute left-0 top-0 bottom-0 bg-fretboard-fret" style={{ width: 2, opacity: 0.6 }} />}
                        {fret === 0 && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-fretboard-nut" />}

                        {style && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onNoteClick(note); }}
                            onMouseDown={(e) => { e.preventDefault(); handleDragStart(stringIdx, fret, note); }}
                            onMouseEnter={() => { handleDragEnter(stringIdx, fret, note); handleNoteHover(note); }}
                            onMouseLeave={() => { if (!isDragging) setHoveredDiatonic(null); }}
                            className={`relative z-10 rounded-full flex items-center justify-center font-mono font-bold transition-all duration-150 hover:scale-110 active:scale-95 shadow-md cursor-pointer select-none ${
                              style.ring ? 'ring-2' : ''
                            } ${isVertical ? '-rotate-90' : ''}`}
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
        <div className="relative" style={{ marginLeft: 28, width: 'calc(100% - 28px)', height: 10 }}>
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-[hsl(30,25%,14%)] to-transparent rounded-b-lg" />
        </div>
      </div>

      {/* Diatonic hover tooltip */}
      {hoveredDiatonic && hoveredDiatonic.name && !activeChord && (
        <div className={`absolute z-50 bg-card border border-border rounded-lg shadow-xl px-3 py-2 pointer-events-none ${
          isVertical ? 'top-2 right-2' : 'top-0 right-0'
        }`}>
          <div className="text-xs font-mono font-bold text-foreground">{hoveredDiatonic.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{hoveredDiatonic.notes.join(' – ')}</div>
        </div>
      )}
    </div>
  );
}
