import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  noteAtFret, isNoteInSelection, getIntervalName, getExtendedIntervalName, getDiatonicChord,
  NoteName, STANDARD_TUNING, DEGREE_COLORS, DEGREE_LEGEND, INTERVAL_TO_POSITION,
  getVoicingsForChord, getArpeggioSequence, getDiatonicArpeggioType, getMidiNote, findNotePositions,
  type ChordVoicing, type ArpeggioPosition,
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
  identifyMode: boolean;
  identifyFrets: (number | -1)[];
  setIdentifyFrets: (f: (number | -1)[]) => void;
  identifyRoot: NoteName | null;
  tuning: number[];
  tuningLabels: string[];
  playingChordTones?: Set<number>;
  arpeggioPosition?: ArpeggioPosition | null;
  arpOverlayOpacity?: number;
  arpPathVisible?: boolean;
  arpAddMode?: boolean;
  onArpAddClick?: (stringIndex: number, fret: number) => void;
  scaleViewChordTones?: Set<number> | null;
  inversionVoicing?: import('@/lib/music').InversionVoicing | null;
  ghostNoteOpacity?: number;
  inversionDegreeColor?: string | null;
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
  identifyMode, identifyFrets, setIdentifyFrets, identifyRoot,
  tuning, tuningLabels, playingChordTones, arpeggioPosition,
  arpOverlayOpacity = 0.3, arpPathVisible = true,
  arpAddMode = false, onArpAddClick,
  scaleViewChordTones,
  inversionVoicing,
  ghostNoteOpacity = 0.15,
  inversionDegreeColor,
}: FretboardProps) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, i) => i);
  const widths = fretWidths(maxFrets);
  const [hoveredDiatonic, setHoveredDiatonic] = useState<{ notes: NoteName[]; name: string; root: NoteName } | null>(null);
  const [identifyHover, setIdentifyHover] = useState<{ stringIndex: number; fret: number } | null>(null);
  const [identifyDrag, setIdentifyDrag] = useState<{ startString: number; fret: number } | null>(null);

  // Guided drag arpeggio state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPath, setDragPath] = useState<DragNote[]>([]);
  const [dragArpRoot, setDragArpRoot] = useState<NoteName | null>(null);
  const [dragArpSequence, setDragArpSequence] = useState<number[]>([]);
  const [dragArpStepIndex, setDragArpStepIndex] = useState(0);
  const [persistedPaths, setPersistedPaths] = useState<DragNote[][]>([]);
  const fretboardRef = useRef<HTMLDivElement>(null);

  // Position box drag state
  const [boxDragging, setBoxDragging] = useState<'move' | 'left' | 'right' | 'bottom' | 'corner' | null>(null);
  const boxDragStartRef = useRef<{ mouseX: number; mouseY: number; startFret: number; startSize: number; startStrStart: number; startStrSize: number }>({ mouseX: 0, mouseY: 0, startFret: 0, startSize: 0, startStrStart: 0, startStrSize: 0 });

  const cumLeft: number[] = [];
  let acc = 0;
  for (const w of widths) { cumLeft.push(acc); acc += w; }

  // Get chord voicing data (including barre info)
  const chordVoicingData = activeChord
    ? (() => {
        const voicings = getVoicingsForChord(activeChord.root, activeChord.chordType, activeChord.voicingSource);
        return voicings[activeChord.voicingIndex] || null;
      })()
    : null;
  const chordVoicing = chordVoicingData ? chordVoicingData.frets : null;

  const chordNoteSet = new Set<string>();
  if (chordVoicing) {
    chordVoicing.forEach((fret, si) => {
      if (fret >= 0) chordNoteSet.add(`${si}-${fret}`);
    });
  }

  // Inversion voicing note set
  const inversionNoteSet = useMemo(() => {
    const set = new Set<string>();
    if (inversionVoicing) {
      inversionVoicing.notes.forEach(n => set.add(`${n.stringIndex}-${n.fret}`));
    }
    return set;
  }, [inversionVoicing]);

  // Arpeggio position note set + all arpeggio chord tone names
  const { arpPositionSet, arpChordToneNames } = useMemo(() => {
    const set = new Set<string>();
    const toneNames = new Set<NoteName>();
    if (arpeggioPosition && arpeggioPosition.notes) {
      arpeggioPosition.notes.forEach(n => {
        set.add(`${n.stringIndex}-${n.fret}`);
        toneNames.add(noteAtFret(n.stringIndex, n.fret, tuning));
      });
    }
    return { arpPositionSet: set, arpChordToneNames: toneNames };
  }, [arpeggioPosition, tuning]);

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
    // In identify mode, only show notes that have been clicked or hovered
    if (identifyMode) {
      if (identifyFrets[stringIndex] === fret) {
        let bg = 'hsl(var(--primary))';
        if (degreeColors && identifyRoot) {
          const dc = getDegreeColor(identifyRoot, note);
          if (dc) bg = dc;
        }
        return { backgroundColor: bg, opacity: 1, ring: false, ringColor: '', greyed: false };
      }
      // Show greyed-out preview on hover
      if (identifyHover && identifyHover.stringIndex === stringIndex && identifyHover.fret === fret) {
        return { backgroundColor: 'hsl(var(--muted-foreground))', opacity: 0.5, ring: false, ringColor: '', greyed: true };
      }
      return null;
    }

    // Inversion voicing mode: show voicing notes prominently, chord tones dimmed, scale notes very dimmed
    if (inversionVoicing && inversionNoteSet.size > 0) {
      const key = `${stringIndex}-${fret}`;
      if (inversionNoteSet.has(key)) {
        let bg = 'hsl(330, 70%, 60%)'; // pink
        if (degreeColors) {
          const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;
          const dc = getDegreeColor(activeRoot, note);
          if (dc) bg = dc;
        }
        return { backgroundColor: bg, opacity: 1, ring: true, ringColor: 'hsl(330, 70%, 60%)', greyed: false };
      }
      // Show other scale chord tones dimmed
      if (scaleViewChordTones && scaleViewChordTones.has((['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const).indexOf(note))) {
        return { backgroundColor: pColor, opacity: ghostNoteOpacity * 1.7, ring: false, ringColor: '', greyed: true };
      }
      // Scale notes dimmed but still visible
      const inP = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
      if (inP) return { backgroundColor: pColor, opacity: ghostNoteOpacity, ring: false, ringColor: '', greyed: true };
      return null;
    }


    if (arpeggioPosition && arpPositionSet.size > 0 && !activeChord) {
      const key = `${stringIndex}-${fret}`;
      const isInPosition = arpPositionSet.has(key);
      const isChordTone = arpChordToneNames.has(note);

      if (isInPosition) {
        // Selected position notes always full opacity
        let bg = pColor;
        if (degreeColors) {
          const arpRoot = (() => {
            if (arpeggioPosition.notes && arpeggioPosition.notes.length > 0) {
              const lowest = arpeggioPosition.notes[0];
              return noteAtFret(lowest.stringIndex, lowest.fret, tuning);
            }
            return primaryScale.root;
          })();
          const dc = getDegreeColor(arpRoot, note);
          if (dc) bg = dc;
        }
        return { backgroundColor: bg, opacity: 1, ring: true, ringColor: 'hsl(var(--primary))', greyed: false };
      }
      // All other instances of arpeggio chord tones across fretboard
      if (isChordTone && arpOverlayOpacity > 0 && fret > 0) {
        let bg = pColor;
        if (degreeColors) {
          const arpRoot = (() => {
            if (arpeggioPosition.notes && arpeggioPosition.notes.length > 0) {
              const lowest = arpeggioPosition.notes[0];
              return noteAtFret(lowest.stringIndex, lowest.fret, tuning);
            }
            return primaryScale.root;
          })();
          const dc = getDegreeColor(arpRoot, note);
          if (dc) bg = dc;
        }
        return { backgroundColor: bg, opacity: arpOverlayOpacity, ring: false, ringColor: '', greyed: false };
      }
      // Show scale notes dimmed
      const inPrimary = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
      if (inPrimary) {
        return { backgroundColor: pColor, opacity: 0.15, ring: false, ringColor: '', greyed: true };
      }
      return null;
    }

    if (activeChord) {
      if (!chordNoteSet.has(`${stringIndex}-${fret}`)) return null;
      let bg = pColor;
      if (degreeColors) {
        const dc = getDegreeColor(activeChord.root, note);
        if (dc) bg = dc;
      }
      return { backgroundColor: bg, opacity: 1, ring: false, ringColor: '', greyed: false };
    }

    // Playing chord tones from timeline — show chord tone notes with a bright highlight
    if (playingChordTones && playingChordTones.size > 0) {
      const noteIdx = (['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).indexOf(note);
      const inChordTones = playingChordTones.has(noteIdx);
      const inPrimary = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
      const inSecondary = secondaryEnabled && isNoteInSelection(note, secondaryScale.root, secondaryScale.scale, secondaryScale.mode);
      
      if (inChordTones) {
        let bg = 'hsl(130, 70%, 45%)';
        let opacity = 1;
        let greyed = false;
        if (degreeColors) {
          const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;
          const dc = getDegreeColor(activeRoot, note);
          if (dc) bg = dc;
        }
        // Position box: grey out notes outside
        if (showFretBox && fret > 0) {
          const row = stringOrder.indexOf(stringIndex);
          const outsideH = fret < fretBoxStart || fret > fretBoxEnd;
          const outsideV = row < fretBoxStringStart || row >= fretBoxStringStart + fretBoxStringSize;
          if (outsideH || outsideV) {
            greyed = true; opacity = 0.15;
          }
        }
        return { backgroundColor: bg, opacity, ring: !greyed, ringColor: 'hsl(130, 70%, 55%)', greyed };
      }
      // Dim non-chord-tone scale notes
      if (inPrimary || inSecondary) {
        const bg = inPrimary ? pColor : sColor;
        let opacity = 0.2;
        let greyed = true;
        if (showFretBox && fret > 0) {
          const row = stringOrder.indexOf(stringIndex);
          const outsideH = fret < fretBoxStart || fret > fretBoxEnd;
          const outsideV = row < fretBoxStringStart || row >= fretBoxStringStart + fretBoxStringSize;
          if (outsideH || outsideV) { opacity = 0.08; }
        }
        return { backgroundColor: bg, opacity, ring: false, ringColor: '', greyed };
      }
      return null;
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
    let ringColor = sColor;
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

    // Arpeggio path notes: show ring in purple like dual-scale mode
    const noteKey = `${stringIndex}-${fret}`;
    if (pathNoteSet.has(noteKey)) {
      ring = true;
      ringColor = 'hsl(280, 70%, 60%)';
      opacity = 1;
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

    // Position box: grey out notes outside (horizontal + vertical)
    if (showFretBox && fret > 0) {
      const row = stringOrder.indexOf(stringIndex);
      const outsideH = fret < fretBoxStart || fret > fretBoxEnd;
      const outsideV = row < fretBoxStringStart || row >= fretBoxStringStart + fretBoxStringSize;
      if (outsideH || outsideV) {
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

  // Double-click handled by outer div
  const handleDoubleClick = useCallback(() => {}, []);

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
      const note = noteAtFret(si, 0, tuning);
      const style = getNoteStyle(note, si, 0);
      if (style && !style.greyed) glowSet.add(si);
    }
    return glowSet;
  };
  const glowStrings = getOpenStringGlow();

  // Position box drag handlers
  const handleBoxMouseDown = useCallback((e: React.MouseEvent, mode: 'move' | 'left' | 'right' | 'bottom' | 'corner') => {
    e.preventDefault();
    e.stopPropagation();
    setBoxDragging(mode);
    boxDragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, startFret: fretBoxStart, startSize: fretBoxSize, startStrStart: fretBoxStringStart, startStrSize: fretBoxStringSize };
  }, [fretBoxStart, fretBoxSize, fretBoxStringStart, fretBoxStringSize]);

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
      const { startFret, startSize, startStrStart, startStrSize } = boxDragStartRef.current;

      // Vertical: compute string row delta
      const dy = e.clientY - boxDragStartRef.current.mouseY;
      const stringH = rect.height / 6;
      const dStrings = Math.round(dy / stringH);

      if (boxDragging === 'move') {
        setFretBoxStart(Math.max(1, Math.min(maxFrets - startSize + 1, startFret + dFrets)));
        const newStrStart = Math.max(0, Math.min(6 - startStrSize, startStrStart + dStrings));
        setFretBoxStringStart(newStrStart);
      } else if (boxDragging === 'left') {
        const newStart = Math.max(1, Math.min(startFret + startSize - 3, startFret + dFrets));
        const newSize = startSize - (newStart - startFret);
        if (newSize >= 3 && newSize <= 12) { setFretBoxStart(newStart); setFretBoxSize(newSize); }
      } else if (boxDragging === 'right') {
        const newSize = Math.max(3, Math.min(12, startSize + dFrets));
        if (startFret + newSize - 1 <= maxFrets) setFretBoxSize(newSize);
      } else if (boxDragging === 'bottom') {
        const newStrSize = Math.max(2, Math.min(6, startStrSize + dStrings));
        if (startStrStart + newStrSize <= 6) setFretBoxStringSize(newStrSize);
      } else if (boxDragging === 'corner') {
        // Horizontal
        const newSize = Math.max(3, Math.min(12, startSize + dFrets));
        if (startFret + newSize - 1 <= maxFrets) setFretBoxSize(newSize);
        // Vertical
        const newStrSize = Math.max(2, Math.min(6, startStrSize + dStrings));
        if (startStrStart + newStrSize <= 6) setFretBoxStringSize(newStrSize);
      }
    };
    const handleMouseUp = () => setBoxDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [boxDragging, maxFrets, setFretBoxStart, setFretBoxSize, setFretBoxStringStart, setFretBoxStringSize]);

  const allPaths = [...persistedPaths, ...(isDragging && dragPath.length >= 2 ? [dragPath] : [])];

  // Build arpeggio position path points
  const arpPositionPath = useMemo(() => {
    if (!arpeggioPosition || !arpeggioPosition.notes || arpeggioPosition.notes.length < 2) return [];
    const points: { x: number; y: number }[] = [];
    // Sort notes by midi order (low to high): string low to high, then fret
    const sortedNotes = [...arpeggioPosition.notes].sort((a, b) => {
      const aMidi = ([40, 45, 50, 55, 59, 64][a.stringIndex] || 40) + a.fret;
      const bMidi = ([40, 45, 50, 55, 59, 64][b.stringIndex] || 40) + b.fret;
      return aMidi - bMidi;
    });
    for (const n of sortedNotes) {
      const row = stringOrder.indexOf(n.stringIndex);
      if (row < 0) continue;
      const x = cumLeft[n.fret] + widths[n.fret] / 2;
      const y = (row * stringH + stringH / 2) / (6 * stringH) * 100;
      points.push({ x, y });
    }
    return points;
  }, [arpeggioPosition, stringOrder, cumLeft, widths, stringH]);

  const getChordLabel = (note: NoteName, fret: number, stringIndex: number): string => {
    if (identifyMode && identifyRoot && displayMode === 'degrees') return getIntervalName(identifyRoot, note);
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
      onMouseUp={() => { handleDragEnd(); setIdentifyDrag(null); }}
      onContextMenu={(e) => {
        if (persistedPaths.length > 0) {
          e.preventDefault();
          setPersistedPaths(prev => prev.slice(0, -1));
        }
      }}
      onDoubleClick={(e) => {
        if (persistedPaths.length > 0) {
          setPersistedPaths([]);
          return;
        }
        const fbEl = fretboardRef.current;
        if (fbEl && !showFretBox) {
          const rect = fbEl.getBoundingClientRect();
          const relX = e.clientX - rect.left - 28;
          const fretAreaWidth = rect.width - 28;
          const xPct = (relX / fretAreaWidth) * 100;
          const relY = e.clientY - rect.top;
          const rowH = rect.height / 6;
          const row = Math.floor(relY / rowH);
          let clickedFret = 1;
          for (let f = 1; f <= maxFrets; f++) {
            if (xPct < cumLeft[f] + widths[f]) { clickedFret = f; break; }
          }
          const halfSize = Math.floor(fretBoxSize / 2);
          setFretBoxStart(Math.max(1, Math.min(maxFrets - fretBoxSize + 1, clickedFret - halfSize)));
          const halfStrSize = Math.floor(fretBoxStringSize / 2);
          setFretBoxStringStart(Math.max(0, Math.min(6 - fretBoxStringSize, row - halfStrSize)));
        }
        setShowFretBox(!showFretBox);
      }}
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
                setDegreeColors(true);
                DEGREE_LEGEND.forEach(d => { const k = String(d.position); if (disabledDegrees.has(k)) toggleDegree(k); });
              } else {
                const allOn = DEGREE_LEGEND.every(d => !disabledDegrees.has(String(d.position)));
                if (allOn) {
                  DEGREE_LEGEND.forEach(d => { const k = String(d.position); if (!disabledDegrees.has(k)) toggleDegree(k); });
                } else {
                  DEGREE_LEGEND.forEach(d => { const k = String(d.position); if (disabledDegrees.has(k)) toggleDegree(k); });
                }
              }
            }}
            className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider transition-colors ${
              degreeColors && DEGREE_LEGEND.every(d => !disabledDegrees.has(String(d.position)))
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {degreeColors && DEGREE_LEGEND.every(d => !disabledDegrees.has(String(d.position))) ? 'Disable All' : 'Degrees Active'}
          </button>
          {/* Position focus toggle — right of Degrees Active */}
          <button
            onClick={() => setShowFretBox(!showFretBox)}
            className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider transition-colors ml-1 ${
              showFretBox ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            Position focus: {showFretBox ? 'on' : 'off'}
          </button>
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
              className="absolute border-2 border-accent/70 bg-accent/10 rounded-md z-20 transition-[left,width,top,height] duration-100"
              style={{
                left: `calc(28px + (100% - 28px) * ${cumLeft[fretBoxStart] || 0} / 100)`,
                width: `calc((100% - 28px) * ${(cumLeft[fretBoxEnd + 1] || cumLeft[maxFrets] || 100) - (cumLeft[fretBoxStart] || 0)} / 100)`,
                top: `${(fretBoxStringStart / 6) * 100}%`,
                height: `${(fretBoxStringSize / 6) * 100}%`,
                cursor: boxDragging === 'move' ? 'grabbing' : 'grab',
              }}
              onMouseDown={e => handleBoxMouseDown(e, 'move')}
            >
              <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent/30 z-30" onMouseDown={e => handleBoxMouseDown(e, 'left')} />
              <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent/30 z-30" onMouseDown={e => handleBoxMouseDown(e, 'right')} />
              <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-accent/30 z-30" onMouseDown={e => handleBoxMouseDown(e, 'bottom')} />
              <div className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize hover:bg-accent/40 z-30" onMouseDown={e => handleBoxMouseDown(e, 'corner')} />
            </div>
          )}

          {/* Inversion voicing pink box - REMOVED */}


          {chordVoicingData && chordVoicingData.barreFrom != null && chordVoicingData.barreTo != null && chordVoicingData.barreFret != null && (
            (() => {
              const bf = chordVoicingData.barreFret!;
              const fromRow = stringOrder.indexOf(chordVoicingData.barreFrom!);
              const toRow = stringOrder.indexOf(chordVoicingData.barreTo!);
              const topRow = Math.min(fromRow, toRow);
              const bottomRow = Math.max(fromRow, toRow);
              const barreLeft = cumLeft[bf] || 0;
              const barreWidth = widths[bf] || 0;
              return (
                <div
                  className="absolute z-15 pointer-events-none rounded-full"
                  style={{
                    left: `calc(28px + (100% - 28px) * ${barreLeft + barreWidth * 0.3} / 100)`,
                    width: `calc((100% - 28px) * ${barreWidth * 0.4} / 100)`,
                    top: `${(topRow * stringH + stringH * 0.3) / (6 * stringH) * 100}%`,
                    height: `${((bottomRow - topRow) * stringH + stringH * 0.4) / (6 * stringH) * 100}%`,
                    backgroundColor: 'hsl(var(--foreground))',
                    opacity: 0.35,
                    borderRadius: 6,
                  }}
                />
              );
            })()
          )}

          {allPaths.map((path, pathIdx) => {
            const pts = getPathLinePoints(path);
            if (pts.length < 2) return null;
            const totalH = 6 * stringH;
            return (
              <svg
                key={pathIdx}
                className="absolute inset-0 pointer-events-none z-[5]"
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
                      stroke="hsl(280, 70%, 60%)"
                      strokeWidth={6}
                      strokeLinecap="round"
                      opacity={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
            );
          })}

          {/* Arpeggio position path */}
          {arpPathVisible && arpPositionPath.length >= 2 && (() => {
            const totalH = 6 * stringH;
            return (
              <svg
                className="absolute inset-0 pointer-events-none z-[5]"
                style={{ left: 28, width: 'calc(100% - 28px)', height: '100%' }}
                viewBox={`0 0 100 ${totalH}`}
                preserveAspectRatio="none"
              >
                {arpPositionPath.map((pt, i, arr) => {
                  if (i === 0) return null;
                  const prev = arr[i - 1];
                  return (
                    <line
                      key={i}
                      x1={prev.x} y1={prev.y * totalH / 100}
                      x2={pt.x} y2={pt.y * totalH / 100}
                      stroke="hsl(var(--primary))"
                      strokeWidth={6}
                      strokeLinecap="round"
                      opacity={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
            );
          })()}

          {/* Inversion voicing path */}
          {inversionVoicing && inversionVoicing.notes.length >= 2 && (() => {
            const totalH = 6 * stringH;
            const sortedNotes = [...inversionVoicing.notes].sort((a, b) => {
              const aMidi = ([40, 45, 50, 55, 59, 64][a.stringIndex] || 40) + a.fret;
              const bMidi = ([40, 45, 50, 55, 59, 64][b.stringIndex] || 40) + b.fret;
              return aMidi - bMidi;
            });
            const points = sortedNotes.map(n => {
              const row = stringOrder.indexOf(n.stringIndex);
              if (row < 0) return null;
              return {
                x: cumLeft[n.fret] + widths[n.fret] / 2,
                y: (row * stringH + stringH / 2) / totalH * 100,
              };
            }).filter(Boolean) as { x: number; y: number }[];
            if (points.length < 2) return null;
            const strokeColor = inversionDegreeColor ? `hsl(${inversionDegreeColor})` : 'hsl(330, 70%, 60%)';
            return (
              <svg
                className="absolute inset-0 pointer-events-none z-[5]"
                style={{ left: 28, width: 'calc(100% - 28px)', height: '100%' }}
                viewBox={`0 0 100 ${totalH}`}
                preserveAspectRatio="none"
              >
                {points.map((pt, i, arr) => {
                  if (i === 0) return null;
                  const prev = arr[i - 1];
                  return (
                    <line
                      key={i}
                      x1={prev.x} y1={prev.y * totalH / 100}
                      x2={pt.x} y2={pt.y * totalH / 100}
                      stroke={strokeColor}
                      strokeWidth={6}
                      strokeLinecap="round"
                      opacity={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
            );
          })()}

          {stringOrder.map((stringIdx, row) => {
            const isDisabled = disabledStrings.has(stringIdx);
            const thickness = Math.max(1, 3.5 - stringIdx * 0.5);
            const isGlowing = glowStrings.has(stringIdx);
            const isChordMuted = activeChord && chordVoicing && chordVoicing[stringIdx] === -1;

            return (
              <div key={stringIdx} className="flex items-center relative" style={{ height: stringH }}>
                {/* String label */}
                <button
                  onDoubleClick={(e) => { e.stopPropagation(); if (!identifyMode) onToggleString(stringIdx); }}
                  onClick={(e) => {
                    if (identifyMode) {
                      e.stopPropagation();
                      const newFrets = [...identifyFrets];
                      newFrets[stringIdx] = newFrets[stringIdx] === -1 ? 0 : -1;
                      setIdentifyFrets(newFrets);
                    }
                  }}
                  className={`shrink-0 w-7 h-full flex items-center justify-center font-mono font-bold transition-all z-10 ${
                    isDisabled ? 'text-muted-foreground/30 line-through' : 'text-muted-foreground'
                  } ${isVertical ? '-rotate-90' : ''}`}
                  style={{
                    fontSize: 9,
                    ...(identifyMode && identifyFrets[stringIdx] === -1 ? { color: 'hsl(var(--destructive))', fontSize: 10, textShadow: '0 0 4px hsl(var(--destructive))' } : {}),
                    ...(isChordMuted && !identifyMode ? { color: 'hsl(var(--destructive))', fontSize: 10, textShadow: '0 0 4px hsl(var(--destructive))' } : {}),
                    ...(isGlowing && !isChordMuted && !identifyMode ? {
                      color: pColor,
                      textShadow: `0 0 6px ${pColor}, 0 0 12px ${pColor}`,
                    } : {}),
                  }}
                  title={identifyMode ? "Click to toggle open string" : "Double-click to toggle string"}
                >
                  {identifyMode && identifyFrets[stringIdx] === -1 ? '×' : isChordMuted && !identifyMode ? '×' : tuningLabels[stringIdx]}
                </button>

                {/* String line */}
                {!isDisabled && (
                  <div className="absolute bg-fretboard-string" style={{ height: thickness, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, left: 28, right: 0 }} />
                )}

                {/* Fret cells */}
                <div className="flex items-center flex-1">
                  {frets.map(fret => {
                    const note = noteAtFret(stringIdx, fret, tuning);
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

                        {/* In identify mode or arp add mode, always render a clickable/hoverable target */}
                        {(identifyMode || arpAddMode) && !style && fret > 0 && (
                          <button
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (arpAddMode && onArpAddClick) {
                                onArpAddClick(stringIdx, fret);
                              } else if (identifyMode) {
                                setIdentifyDrag({ startString: stringIdx, fret });
                                const newFrets = [...identifyFrets];
                                newFrets[stringIdx] = fret;
                                setIdentifyFrets(newFrets);
                              }
                            }}
                            onMouseEnter={() => {
                              if (identifyMode) {
                                setIdentifyHover({ stringIndex: stringIdx, fret });
                                if (identifyDrag && identifyDrag.fret === fret) {
                                  const newFrets = [...identifyFrets];
                                  const minS = Math.min(identifyDrag.startString, stringIdx);
                                  const maxS = Math.max(identifyDrag.startString, stringIdx);
                                  for (let s = minS; s <= maxS; s++) {
                                    newFrets[s] = fret;
                                  }
                                  setIdentifyFrets(newFrets);
                                }
                              }
                            }}
                            onMouseUp={() => setIdentifyDrag(null)}
                            onMouseLeave={() => setIdentifyHover(null)}
                            className={`relative z-10 rounded-full flex items-center justify-center font-mono font-bold cursor-pointer select-none opacity-0 hover:opacity-50 transition-opacity ${isVertical ? '-rotate-90' : ''}`}
                            style={{
                              width: noteMarkerSize,
                              height: noteMarkerSize,
                              backgroundColor: arpAddMode ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                              color: 'hsl(var(--muted-foreground))',
                              fontSize: Math.max(6, noteMarkerSize * 0.35),
                            }}
                          >
                            {note}
                          </button>
                        )}

                        {style && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (arpAddMode && onArpAddClick && fret > 0) {
                                onArpAddClick(stringIdx, fret);
                              } else if (identifyMode) {
                                const newFrets = [...identifyFrets];
                                if (newFrets[stringIdx] === fret) {
                                  newFrets[stringIdx] = -1;
                                } else {
                                  newFrets[stringIdx] = fret;
                                }
                                setIdentifyFrets(newFrets);
                              } else {
                                onNoteClick(note);
                              }
                            }}
                            onMouseDown={(e) => {
                              if (identifyMode) {
                                e.preventDefault();
                                setIdentifyDrag({ startString: stringIdx, fret });
                              } else {
                                e.preventDefault(); handleDragStart(stringIdx, fret, note);
                              }
                            }}
                            onMouseEnter={() => {
                              if (identifyMode) {
                                setIdentifyHover({ stringIndex: stringIdx, fret });
                                if (identifyDrag && identifyDrag.fret === fret) {
                                  const newFrets = [...identifyFrets];
                                  const minS = Math.min(identifyDrag.startString, stringIdx);
                                  const maxS = Math.max(identifyDrag.startString, stringIdx);
                                  for (let s = minS; s <= maxS; s++) {
                                    newFrets[s] = fret;
                                  }
                                  setIdentifyFrets(newFrets);
                                }
                              } else {
                                handleDragEnter(stringIdx, fret, note); handleNoteHover(note);
                              }
                            }}
                            onMouseUp={() => { if (identifyMode) setIdentifyDrag(null); }}
                            onMouseLeave={() => {
                              if (identifyMode) setIdentifyHover(null);
                              else if (!isDragging) setHoveredDiatonic(null);
                            }}
                            className={`relative z-10 rounded-full flex items-center justify-center font-mono font-bold transition-all duration-150 hover:scale-110 active:scale-95 shadow-md cursor-pointer select-none ${
                              style.ring ? 'ring-2' : ''
                            } ${isVertical ? '-rotate-90' : ''} ${
                              identifyMode && identifyFrets[stringIdx] === fret ? 'ring-2 ring-primary' : ''
                            }`}
                            style={{
                              width: noteMarkerSize,
                              height: noteMarkerSize,
                              backgroundColor: style.greyed ? 'hsl(var(--muted))' : style.backgroundColor,
                              opacity: style.opacity,
                              color: style.greyed
                                ? 'hsl(var(--muted-foreground))'
                                : identifyMode && identifyFrets[stringIdx] === fret && !(degreeColors && identifyRoot)
                                  ? 'hsl(var(--primary-foreground))'
                                  : 'hsl(220, 20%, 8%)',
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
