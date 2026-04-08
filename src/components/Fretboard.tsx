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
  identifyBarre: { from: number; to: number; fret: number } | null;
  setIdentifyBarre: (b: { from: number; to: number; fret: number } | null) => void;
  identifyRoot: NoteName | null;
  tuning: number[];
  tuningLabels: string[];
  playingChordTones?: Set<number>;
  arpeggioPosition?: ArpeggioPosition | null;
  arpOverlayOpacity?: number;
  arpPathVisible?: boolean;
  arpAddMode?: boolean;
  arpAddReferenceNotes?: { stringIndex: number; fret: number }[];
  onArpAddClick?: (stringIndex: number, fret: number) => void;
  onArpBarreDrag?: (fromStringIndex: number, toStringIndex: number, fret: number) => void;
  scaleViewChordTones?: Set<number> | null;
  inversionVoicing?: import('@/lib/music').InversionVoicing | null;
  ghostNoteOpacity?: number;
  inversionDegreeColor?: string | null;
  chordAddRootNote?: NoteName | null;
  chordAddHasNotes?: boolean;
  suppressScaleNotes?: boolean;
  tabVisNotes?: { current: Array<{string: number; fret: number}>; upcoming: Array<Array<{string: number; fret: number}>> } | null;
  chordOctaveShift?: number;
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
  identifyMode, identifyFrets, setIdentifyFrets, identifyBarre, setIdentifyBarre, identifyRoot,
  tuning, tuningLabels, playingChordTones, arpeggioPosition,
  arpOverlayOpacity = 0.3, arpPathVisible = true,
  arpAddMode = false, arpAddReferenceNotes, onArpAddClick, onArpBarreDrag,
  scaleViewChordTones,
  inversionVoicing,
  ghostNoteOpacity = 0.75,
  inversionDegreeColor,
  chordAddRootNote,
  chordAddHasNotes,
  suppressScaleNotes = false,
  tabVisNotes,
  chordOctaveShift = 0,
}: FretboardProps) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, i) => i);
  const widths = fretWidths(maxFrets);
  const [hoveredDiatonic, setHoveredDiatonic] = useState<{ notes: NoteName[]; name: string; root: NoteName } | null>(null);
  const [identifyHover, setIdentifyHover] = useState<{ stringIndex: number; fret: number } | null>(null);
  const [identifyDrag, setIdentifyDrag] = useState<{ startString: number; fret: number } | null>(null);
  const identifyMouseDown = useRef(false);
  const lastIdentifyAppliedRef = useRef<string | null>(null);

  // Guided drag arpeggio state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPath, setDragPath] = useState<DragNote[]>([]);
  const [dragArpRoot, setDragArpRoot] = useState<NoteName | null>(null);
  const [dragArpSequence, setDragArpSequence] = useState<number[]>([]);
  const [dragArpStepIndex, setDragArpStepIndex] = useState(0);
  const [persistedPaths, setPersistedPaths] = useState<DragNote[][]>([]);
  const fretboardRef = useRef<HTMLDivElement>(null);
  const arpDragRef = useRef<{startString: number, fret: number, coveredStrings: Set<number>} | null>(null);

  // Position box drag state
  const [boxDragging, setBoxDragging] = useState<'move' | 'left' | 'right' | 'bottom' | 'corner' | null>(null);
  const boxDragStartRef = useRef<{ mouseX: number; mouseY: number; startFret: number; startSize: number; startStrStart: number; startStrSize: number }>({ mouseX: 0, mouseY: 0, startFret: 0, startSize: 0, startStrStart: 0, startStrSize: 0 });

  const cumLeft: number[] = [];
  let acc = 0;
  for (const w of widths) { cumLeft.push(acc); acc += w; }

  // Get chord voicing data (including barre info) — auto-normalize to lowest octave + manual shift
  const chordVoicingData = useMemo(() => {
    if (!activeChord) return null;
    const voicings = getVoicingsForChord(activeChord.root, activeChord.chordType, activeChord.voicingSource);
    const raw = voicings[activeChord.voicingIndex] || null;
    if (!raw) return null;
    // Normalize: find min played fret and shift down by 12s
    const playedFrets = raw.frets.filter(f => f > 0);
    if (playedFrets.length === 0) return raw;
    const minFret = Math.min(...playedFrets);
    const autoShift = -Math.floor(minFret / 12) * 12;
    const totalShift = autoShift + chordOctaveShift * 12;
    if (totalShift === 0) return raw;
    const shifted: ChordVoicing = {
      ...raw,
      frets: raw.frets.map(f => f <= 0 ? f : Math.max(0, Math.min(24, f + totalShift))),
      ...(raw.barreFret != null ? { barreFret: Math.max(0, Math.min(24, raw.barreFret + totalShift)) } : {}),
    };
    return shifted;
  }, [activeChord, chordOctaveShift]);
  const chordVoicing = chordVoicingData ? chordVoicingData.frets : null;

  const chordNoteSet = new Set<string>();
  if (chordVoicing) {
    chordVoicing.forEach((fret, si) => {
      if (fret >= 0) {
        // Skip middle barre notes (only show endpoints)
        if (chordVoicingData && chordVoicingData.barreFret != null && fret === chordVoicingData.barreFret &&
            chordVoicingData.barreFrom != null && chordVoicingData.barreTo != null) {
          const from = chordVoicingData.barreFrom;
          const to = chordVoicingData.barreTo;
          const minS = Math.min(from, to);
          const maxS = Math.max(from, to);
          if (si > minS && si < maxS) return;
        }
        chordNoteSet.add(`${si}-${fret}`);
      }
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
        const isBarreMiddleNote = arpeggioPosition.barreFret != null
          && arpeggioPosition.barreFrom != null
          && arpeggioPosition.barreTo != null
          && n.fret === arpeggioPosition.barreFret
          && n.stringIndex > Math.min(arpeggioPosition.barreFrom, arpeggioPosition.barreTo)
          && n.stringIndex < Math.max(arpeggioPosition.barreFrom, arpeggioPosition.barreTo);
        if (!isBarreMiddleNote) {
          set.add(`${n.stringIndex}-${n.fret}`);
        }
        toneNames.add(noteAtFret(n.stringIndex, n.fret, tuning));
      });
    }
    return { arpPositionSet: set, arpChordToneNames: toneNames };
  }, [arpeggioPosition, tuning]);

  // Reference notes for arp add mode (shows existing arpeggio at reduced opacity)
  const arpAddRefSet = useMemo(() => {
    const set = new Set<string>();
    if (arpAddReferenceNotes) {
      for (const n of arpAddReferenceNotes) set.add(`${n.stringIndex}-${n.fret}`);
    }
    return set;
  }, [arpAddReferenceNotes]);

  // Static voicings from chord library have showPath explicitly set to false
  const isChordLibraryVoicing = arpeggioPosition?.showPath === false;
  const shouldShowGuidedPaths = !arpAddMode && !isChordLibraryVoicing;

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

  // hiddenDegrees: degrees that are completely hidden (double-clicked)
  const [hiddenDegrees, setHiddenDegrees] = useState<Set<string>>(new Set());

  function getDegreeColor(root: NoteName, note: NoteName): string | null {
    const interval = getIntervalName(root, note);
    const position = INTERVAL_TO_POSITION[interval];
    if (position !== undefined && disabledDegrees.has(String(position))) return null;
    const degColor = DEGREE_COLORS[interval];
    if (degColor) return `hsl(${degColor})`;
    return null;
  }

  // Check if a note's degree is hidden (completely removed from fretboard)
  function isNoteHidden(root: NoteName, note: NoteName): boolean {
    if (hiddenDegrees.size === 0) return false;
    const interval = getIntervalName(root, note);
    const position = INTERVAL_TO_POSITION[interval];
    if (position !== undefined && hiddenDegrees.has(String(position))) return true;
    return false;
  }

  // Helper: check if a fret position is outside the position box
  function isOutsidePositionBox(stringIndex: number, fret: number): boolean {
    if (!showFretBox || fret === 0) return false;
    const row = stringOrder.indexOf(stringIndex);
    const outsideH = fret < fretBoxStart || fret > fretBoxEnd;
    const outsideV = row < fretBoxStringStart || row >= fretBoxStringStart + fretBoxStringSize;
    return outsideH || outsideV;
  }

  const applyIdentifySelection = useCallback((stringIndex: number, fret: number, mode: 'toggle' | 'set' = 'set') => {
    const key = `${stringIndex}-${fret}-${mode}`;
    if (identifyMouseDown.current && lastIdentifyAppliedRef.current === key) return;
    const nextFrets = [...identifyFrets];
    if (mode === 'toggle') {
      nextFrets[stringIndex] = nextFrets[stringIndex] === fret ? -1 : fret;
    } else {
      nextFrets[stringIndex] = fret;
    }
    setIdentifyFrets(nextFrets);
    lastIdentifyAppliedRef.current = key;
  }, [identifyFrets, setIdentifyFrets]);

  const applyIdentifyBarreDrag = useCallback((currentStringIndex: number) => {
    if (!identifyDrag) return;
    const newFrets = [...identifyFrets];
    const minS = Math.min(identifyDrag.startString, currentStringIndex);
    const maxS = Math.max(identifyDrag.startString, currentStringIndex);
    const clearDraggedMarker = (stringIndex: number) => {
      if (
        stringIndex !== identifyDrag.startString &&
        stringIndex !== currentStringIndex &&
        newFrets[stringIndex] === identifyDrag.fret
      ) {
        newFrets[stringIndex] = -1;
      }
    };

    if (identifyBarre && identifyBarre.fret === identifyDrag.fret) {
      for (let s = identifyBarre.from; s <= identifyBarre.to; s += 1) {
        if (newFrets[s] === identifyDrag.fret) newFrets[s] = -1;
      }
    }
    for (let s = minS; s <= maxS; s += 1) newFrets[s] = identifyDrag.fret;
    setIdentifyFrets(newFrets);
    setIdentifyBarre(maxS > minS ? { from: minS, to: maxS, fret: identifyDrag.fret } : null);
    lastIdentifyAppliedRef.current = `barre-${minS}-${maxS}-${identifyDrag.fret}`;
  }, [identifyBarre, identifyDrag, identifyFrets, setIdentifyBarre, setIdentifyFrets]);

  useEffect(() => {
    if (!identifyBarre) return;
    const coveredStrings: number[] = [];
    for (let s = identifyBarre.from; s <= identifyBarre.to; s += 1) {
      if (identifyFrets[s] >= identifyBarre.fret) coveredStrings.push(s);
    }
    if (coveredStrings.length < 2) {
      setIdentifyBarre(null);
      return;
    }
    const nextFrom = coveredStrings[0];
    const nextTo = coveredStrings[coveredStrings.length - 1];
    if (nextFrom !== identifyBarre.from || nextTo !== identifyBarre.to) {
      setIdentifyBarre({ ...identifyBarre, from: nextFrom, to: nextTo });
    }
  }, [identifyBarre, identifyFrets, setIdentifyBarre]);

  function getNoteStyle(note: NoteName, stringIndex: number, fret: number) {
    // Tab visualiser mode: only show tab notes
    if (tabVisNotes) {
      if (isOutsidePositionBox(stringIndex, fret)) return null;
      const isCurrent = tabVisNotes.current.some(n => n.string === stringIndex && n.fret === fret);
      if (isCurrent) {
        return { backgroundColor: 'hsl(var(--primary))', opacity: 1, ring: true, ringColor: 'hsl(var(--primary))', greyed: false };
      }
      for (const group of tabVisNotes.upcoming) {
        if (group.some(n => n.string === stringIndex && n.fret === fret)) {
          return { backgroundColor: 'hsl(var(--primary))', opacity: 0.4, ring: false, ringColor: '', greyed: false };
        }
      }
      return null;
    }

    // In arp add mode (custom voicing creation)
    if (arpAddMode && !isChordLibraryVoicing) {
      if (isOutsidePositionBox(stringIndex, fret)) return null;
      const key = `${stringIndex}-${fret}`;

      // Notes that are part of the shape being built (Adding.../Editing...) — full opacity with glow
      if (arpeggioPosition && (arpeggioPosition.label === 'Adding...' || arpeggioPosition.label === 'Editing...') && arpPositionSet.has(key)) {
        let bg = pColor;
        if (degreeColors) {
          const dc = getDegreeColor(primaryScale.root, note);
          if (dc) bg = dc;
        }
        return { backgroundColor: bg, opacity: 1, ring: true, ringColor: bg, greyed: false };
      }

      // All chord tone reference notes at overlay opacity
      if (arpAddRefSet.size > 0 && arpAddRefSet.has(key)) {
        let bg = pColor;
        if (degreeColors) {
          const dc = getDegreeColor(primaryScale.root, note);
          if (dc) bg = dc;
        }
        return { backgroundColor: bg, opacity: arpOverlayOpacity, ring: false, ringColor: '', greyed: false };
      }

      return null;
    }

    // In identify mode, show clicked notes + arpeggio overlay
    if (identifyMode) {
      // Clicked notes always visible (even outside box)
      const isBarreCovered = identifyBarre
        && fret === identifyBarre.fret
        && stringIndex >= identifyBarre.from
        && stringIndex <= identifyBarre.to;
      if (identifyFrets[stringIndex] === fret || isBarreCovered) {
        let bg = 'hsl(var(--primary))';
        if (degreeColors && identifyRoot) {
          const dc = getDegreeColor(identifyRoot, note);
          if (dc) bg = dc;
        }
        return { backgroundColor: bg, opacity: 1, ring: true, ringColor: bg, greyed: false };
      }
      // Hide everything else outside position box
      if (isOutsidePositionBox(stringIndex, fret)) return null;
      // Show arpeggio overlay notes in identify mode (when a chord cell is selected)
      if (arpeggioPosition && arpPositionSet.size > 0 && fret > 0) {
        const key = `${stringIndex}-${fret}`;
        if (arpPositionSet.has(key)) {
          let bg = 'hsl(var(--primary))';
          if (degreeColors && identifyRoot) {
            const dc = getDegreeColor(identifyRoot, note);
            if (dc) bg = dc;
          }
          return { backgroundColor: bg, opacity: arpOverlayOpacity, ring: false, ringColor: '', greyed: false };
        }
      }
      // Show greyed-out preview on hover
      if (identifyHover && identifyHover.stringIndex === stringIndex && identifyHover.fret === fret) {
        return { backgroundColor: 'hsl(var(--muted-foreground))', opacity: 0.5, ring: false, ringColor: '', greyed: true };
      }
      return null;
    }

    // Scale view degree filter: show chord tones bright with glow, rest as ghost
    if (scaleViewChordTones && scaleViewChordTones.size > 0 && !inversionVoicing) {
      if (isOutsidePositionBox(stringIndex, fret)) return null;
      const noteIdx = (['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const).indexOf(note);
      const isChordTone = scaleViewChordTones.has(noteIdx);
      const inP = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
      if (!inP) return null;
      if (isChordTone) {
        let bg = inversionDegreeColor ? `hsl(${inversionDegreeColor})` : pColor;
        if (degreeColors) {
          const dc = getDegreeColor(primaryScale.root, note);
          if (dc) bg = dc;
        }
        // Glow effect via ring
        return { backgroundColor: bg, opacity: 1, ring: true, ringColor: bg, greyed: false };
      }
      // Non-chord-tone scale notes: dimmed by ghost opacity slider
      let ghostBg = pColor;
      if (degreeColors) {
        const dc = getDegreeColor(primaryScale.root, note);
        if (dc) ghostBg = dc;
      }
      return { backgroundColor: ghostBg, opacity: ghostNoteOpacity, ring: false, ringColor: '', greyed: false };
    }

    // Inversion voicing mode: only chord notes visible, opacity dims non-voicing chord tones
    if (inversionVoicing && inversionNoteSet.size > 0) {
      if (isOutsidePositionBox(stringIndex, fret)) return null;
      const noteIdx = (['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const).indexOf(note);
      const isChordTone = scaleViewChordTones && scaleViewChordTones.has(noteIdx);
      if (!isChordTone) return null; // Notes outside chord are completely invisible
      
      const key = `${stringIndex}-${fret}`;
      const isInVoicing = inversionNoteSet.has(key);
      
      // Use the chord root for degree colors in inversion mode
      const chordRoot = inversionVoicing.notes.length > 0
        ? noteAtFret(inversionVoicing.notes[0].stringIndex, inversionVoicing.notes[0].fret, tuning)
        : primaryScale.root;
      
      let bg = inversionDegreeColor ? `hsl(${inversionDegreeColor})` : pColor;
      if (degreeColors) {
        const dc = getDegreeColor(chordRoot, note);
        if (dc) bg = dc;
      }
      
      if (isInVoicing) {
        return { backgroundColor: bg, opacity: 1, ring: true, ringColor: inversionDegreeColor ? `hsl(${inversionDegreeColor})` : 'hsl(var(--primary))', greyed: false };
      }
      // Chord tones not in the voicing: dimmed by ghostNoteOpacity
      return { backgroundColor: bg, opacity: ghostNoteOpacity, ring: false, ringColor: '', greyed: false };
    }


    if (arpeggioPosition && arpPositionSet.size > 0 && !activeChord) {
      if (isOutsidePositionBox(stringIndex, fret)) return null;
      const key = `${stringIndex}-${fret}`;
      const isInPosition = arpPositionSet.has(key);
      const isChordTone = arpChordToneNames.has(note);

      if (isChordLibraryVoicing) {
        if (!isInPosition) return null;

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

    if (suppressScaleNotes) return null;

    // Playing chord tones from timeline — show chord tone notes with a bright highlight
    if (playingChordTones && playingChordTones.size > 0) {
      if (isOutsidePositionBox(stringIndex, fret)) return null;
      const noteIdx = (['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).indexOf(note);
      const inChordTones = playingChordTones.has(noteIdx);
      const inPrimary = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
      const inSecondary = secondaryEnabled && isNoteInSelection(note, secondaryScale.root, secondaryScale.scale, secondaryScale.mode);
      
      if (inChordTones) {
        let bg = 'hsl(130, 70%, 45%)';
        if (degreeColors) {
          const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;
          const dc = getDegreeColor(activeRoot, note);
          if (dc) bg = dc;
        }
        return { backgroundColor: bg, opacity: 1, ring: true, ringColor: 'hsl(130, 70%, 55%)', greyed: false };
      }
      // Dim non-chord-tone scale notes
      if (inPrimary || inSecondary) {
        const bg = inPrimary ? pColor : sColor;
        return { backgroundColor: bg, opacity: 0.2, ring: false, ringColor: '', greyed: true };
      }
      return null;
    }

    const inPrimary = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
    const inSecondary = secondaryEnabled && isNoteInSelection(note, secondaryScale.root, secondaryScale.scale, secondaryScale.mode);
    if (!inPrimary && !inSecondary) return null;

    // Check if this note's degree is hidden
    const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;
    if (isNoteHidden(activeRoot, note)) return null;

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
    if (shouldShowGuidedPaths && pathNoteSet.has(noteKey)) {
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

    // Position box: completely hide notes outside
    if (isOutsidePositionBox(stringIndex, fret)) return null;

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

  const allPaths = shouldShowGuidedPaths
    ? [...persistedPaths, ...(isDragging && dragPath.length >= 2 ? [dragPath] : [])]
    : [];

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
      onMouseUp={() => {
        handleDragEnd();
        // Detect barre from identify drag — only if user actually dragged across multiple strings
        if (identifyMode && identifyDrag && identifyMouseDown.current) {
          // identifyBarre is already set by applyIdentifyBarreDrag during the drag
          // Don't re-detect from fret values — that would create barres from separate clicks
        }
        setIdentifyDrag(null); identifyMouseDown.current = false; arpDragRef.current = null;
      }}
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
            const isHidden = hiddenDegrees.has(posKey);
            return (
              <button
                key={d.label}
                onClick={() => {
                  if (isHidden) {
                    // Click on hidden (X) degree to restore it
                    setHiddenDegrees(prev => { const next = new Set(prev); next.delete(posKey); return next; });
                  } else {
                    toggleDegree(posKey);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!isHidden) {
                    // Double-click to completely hide this degree
                    setHiddenDegrees(prev => { const next = new Set(prev); next.add(posKey); return next; });
                  }
                }}
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-all ${isHidden ? 'opacity-100' : isOff ? 'opacity-30' : 'opacity-100'}`}
                title={isHidden ? `Click to restore ${d.label}` : `Click to toggle, double-click to hide ${d.label}`}
              >
                {isHidden ? (
                  <>
                    <div className="w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold" style={{ backgroundColor: `hsl(${d.color})`, color: '#000' }}>✕</div>
                    <span className="text-[8px] font-mono text-destructive line-through">{d.label}</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${d.color})` }} />
                    <span className="text-[8px] font-mono text-muted-foreground">{d.label}</span>
                  </>
                )}
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





          {/* Barre bar overlay using SVG for precision */}
          {chordVoicingData && chordVoicingData.barreFrom != null && chordVoicingData.barreTo != null && chordVoicingData.barreFret != null && (
            (() => {
              const bf = chordVoicingData.barreFret!;
              const fromRow = stringOrder.indexOf(chordVoicingData.barreFrom!);
              const toRow = stringOrder.indexOf(chordVoicingData.barreTo!);
              const topRow = Math.min(fromRow, toRow);
              const bottomRow = Math.max(fromRow, toRow);
              const barreLeft = cumLeft[bf] || 0;
              const barreW = widths[bf] || 0;
              const centerX = barreLeft + barreW * 0.5;
              const totalH = 6 * stringH;
              const y1 = topRow * stringH + stringH * 0.5;
              const y2 = bottomRow * stringH + stringH * 0.5;
              const barThickY = noteMarkerSize * 0.8;
              const barThickX = noteMarkerSize * 0.08;
              const markerRadiusY = noteMarkerSize / 2;
              const rectY = y1 + markerRadiusY - barThickY / 2;
              const rectHeight = Math.max(barThickY, (y2 - y1) - markerRadiusY * 2 + barThickY);
              return (
                <svg
                  className="absolute inset-0 pointer-events-none z-[2]"
                  style={{ left: 28, width: 'calc(100% - 28px)', height: '100%' }}
                  viewBox={`0 0 100 ${totalH}`}
                  preserveAspectRatio="none"
                >
                  <rect
                    x={centerX - barThickX / 2}
                    y={rectY}
                    width={barThickX}
                    height={rectHeight}
                    rx={barThickX / 2}
                    fill="hsl(var(--muted-foreground))"
                    opacity={0.62}
                  />
                </svg>
              );
            })()
          )}

          {/* Identify mode barre bar */}
          {identifyMode && identifyBarre && identifyBarre.from !== identifyBarre.to && (
            (() => {
              const bf = identifyBarre.fret;
              const fromRow = stringOrder.indexOf(identifyBarre.from);
              const toRow = stringOrder.indexOf(identifyBarre.to);
              const topRow = Math.min(fromRow, toRow);
              const bottomRow = Math.max(fromRow, toRow);
              const barreLeft = cumLeft[bf] || 0;
              const barreW = widths[bf] || 0;
              const centerX = barreLeft + barreW * 0.5;
              const totalH = 6 * stringH;
              const y1 = topRow * stringH + stringH * 0.5;
              const y2 = bottomRow * stringH + stringH * 0.5;
              const barThickY = noteMarkerSize * 0.8;
              const barThickX = noteMarkerSize * 0.08;
              const markerRadiusY = noteMarkerSize / 2;
              const rectY = y1 + markerRadiusY - barThickY / 2;
              const rectHeight = Math.max(barThickY, (y2 - y1) - markerRadiusY * 2 + barThickY);
              return (
                <svg
                  className="absolute inset-0 pointer-events-none z-[2]"
                  style={{ left: 28, width: 'calc(100% - 28px)', height: '100%' }}
                  viewBox={`0 0 100 ${totalH}`}
                  preserveAspectRatio="none"
                >
                  <rect
                    x={centerX - barThickX / 2}
                    y={rectY}
                    width={barThickX}
                    height={rectHeight}
                    rx={barThickX / 2}
                    fill="hsl(var(--muted-foreground))"
                    opacity={0.62}
                  />
                </svg>
              );
            })()
          )}

          {/* Barre bar for ArpeggioPosition (custom voicings) */}
          {arpeggioPosition && arpeggioPosition.barreFrom != null && arpeggioPosition.barreTo != null && arpeggioPosition.barreFret != null && (
            (() => {
              const bf = arpeggioPosition.barreFret!;
              const fromRow = stringOrder.indexOf(arpeggioPosition.barreFrom!);
              const toRow = stringOrder.indexOf(arpeggioPosition.barreTo!);
              const topRow = Math.min(fromRow, toRow);
              const bottomRow = Math.max(fromRow, toRow);
              const barreLeft = cumLeft[bf] || 0;
              const barreW = widths[bf] || 0;
              const centerX = barreLeft + barreW * 0.5;
              const totalH = 6 * stringH;
              const y1 = topRow * stringH + stringH * 0.5;
              const y2 = bottomRow * stringH + stringH * 0.5;
              const barThickY = noteMarkerSize * 0.8;
              const barThickX = noteMarkerSize * 0.08;
              const markerRadiusY = noteMarkerSize / 2;
              const rectY = y1 + markerRadiusY - barThickY / 2;
              const rectHeight = Math.max(barThickY, (y2 - y1) - markerRadiusY * 2 + barThickY);
              return (
                <svg
                  className="absolute inset-0 pointer-events-none z-[2]"
                  style={{ left: 28, width: 'calc(100% - 28px)', height: '100%' }}
                  viewBox={`0 0 100 ${totalH}`}
                  preserveAspectRatio="none"
                >
                  <rect
                    x={centerX - barThickX / 2}
                    y={rectY}
                    width={barThickX}
                    height={rectHeight}
                    rx={barThickX / 2}
                    fill="hsl(var(--muted-foreground))"
                    opacity={0.62}
                  />
                </svg>
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
          {arpPathVisible && !arpAddMode && arpeggioPosition && arpeggioPosition.showPath !== false && arpPositionPath.length >= 2 && (() => {
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

          {/* Inversion voicing — NO paths, notes glow instead */}

          {stringOrder.map((stringIdx, row) => {
            const isDisabled = disabledStrings.has(stringIdx);
            const thickness = Math.max(1, 3.5 - stringIdx * 0.5);
            const isGlowing = glowStrings.has(stringIdx);
            const isChordMuted = activeChord && chordVoicing && chordVoicing[stringIdx] === -1;
            // In arp add mode, strings without notes show as muted (X)
            const isArpAddMuted = arpAddMode && !activeChord && (!arpeggioPosition || !arpeggioPosition.frets || (arpeggioPosition.frets as (number | -1)[])[stringIdx] === -1);

            return (
              <div key={stringIdx} className="flex items-center relative" style={{ height: stringH }}>
                {/* String label */}
                <button
                  onDoubleClick={(e) => { e.stopPropagation(); if (!identifyMode && !arpAddMode) onToggleString(stringIdx); }}
                  onClick={(e) => {
                    if (identifyMode) {
                      e.stopPropagation();
                      const newFrets = [...identifyFrets];
                      newFrets[stringIdx] = newFrets[stringIdx] === -1 ? 0 : -1;
                      setIdentifyFrets(newFrets);
                    } else if (arpAddMode && onArpAddClick) {
                      e.stopPropagation();
                      // Toggle open string (fret 0) in add mode
                      onArpAddClick(stringIdx, 0);
                    }
                  }}
                  className={`shrink-0 w-7 h-full flex items-center justify-center font-mono font-bold transition-all z-10 ${
                    isDisabled ? 'text-muted-foreground/30 line-through' : 'text-muted-foreground'
                  } ${isVertical ? '-rotate-90' : ''}`}
                  style={{
                    fontSize: 9,
                      ...(identifyMode && identifyFrets[stringIdx] === -1 && !(identifyBarre && stringIdx >= identifyBarre.from && stringIdx <= identifyBarre.to) ? { color: 'hsl(var(--destructive))', fontSize: 10, textShadow: '0 0 4px hsl(var(--destructive))' } : {}),
                    ...(isChordMuted && !identifyMode ? { color: 'hsl(var(--destructive))', fontSize: 10, textShadow: '0 0 4px hsl(var(--destructive))' } : {}),
                    ...(isArpAddMuted && !identifyMode ? { color: 'hsl(var(--destructive))', fontSize: 10, textShadow: '0 0 4px hsl(var(--destructive))' } : {}),
                    // In arp add mode, when string IS part of chord, color by degree
                    ...(arpAddMode && !isArpAddMuted && !identifyMode && chordAddRootNote ? (() => {
                      const openNote = noteAtFret(stringIdx, arpeggioPosition?.frets ? (arpeggioPosition.frets as (number | -1)[])[stringIdx] || 0 : 0, tuning);
                      const dc = getDegreeColor(chordAddRootNote, openNote);
                      if (dc) return { color: dc, fontSize: 10, textShadow: `0 0 6px ${dc}, 0 0 12px ${dc}` };
                      return {};
                    })() : {}),
                    ...(isGlowing && !isChordMuted && !isArpAddMuted && !identifyMode && !arpAddMode ? {
                      color: pColor,
                      textShadow: `0 0 8px ${pColor}, 0 0 18px ${pColor}, 0 0 30px ${pColor}`,
                    } : {}),
                  }}
                  title={identifyMode ? "Click to toggle open string" : arpAddMode ? "Click to toggle open string" : "Double-click to toggle string"}
                >
                  {identifyMode && identifyFrets[stringIdx] === -1 && !(identifyBarre && stringIdx >= identifyBarre.from && stringIdx <= identifyBarre.to) ? '×' : isChordMuted && !identifyMode ? '×' : isArpAddMuted && !identifyMode ? '×' : tuningLabels[stringIdx]}
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

                    if (isOpenString && style && !style.greyed && !identifyMode && !arpAddMode) {
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
                        {(identifyMode || arpAddMode) && !style && (identifyMode || fret > 0) && (
                          <button
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (arpAddMode && onArpAddClick) {
                                arpDragRef.current = { startString: stringIdx, fret, coveredStrings: new Set([stringIdx]) };
                                onArpAddClick(stringIdx, fret);
                              } else if (identifyMode) {
                                identifyMouseDown.current = true;
                                setIdentifyDrag({ startString: stringIdx, fret });
                                applyIdentifySelection(stringIdx, fret);
                              }
                            }}
                            onMouseEnter={() => {
                              if (arpAddMode && arpDragRef.current && arpDragRef.current.fret === fret && onArpAddClick) {
                                const minS = Math.min(arpDragRef.current.startString, stringIdx);
                                const maxS = Math.max(arpDragRef.current.startString, stringIdx);
                                // During drag, only set endpoint markers, not intermediate strings
                                if (!arpDragRef.current.coveredStrings.has(stringIdx)) {
                                  arpDragRef.current.coveredStrings.add(stringIdx);
                                }
                                if (maxS > minS) onArpBarreDrag?.(arpDragRef.current.startString, stringIdx, fret);
                              } else if (identifyMode) {
                                setIdentifyHover({ stringIndex: stringIdx, fret });
                                if (identifyMouseDown.current && identifyDrag && identifyDrag.fret === fret) {
                                  applyIdentifyBarreDrag(stringIdx);
                                }
                              }
                            }}
                            onMouseUp={() => {
                              setIdentifyDrag(null);
                              identifyMouseDown.current = false;
                              arpDragRef.current = null;
                              lastIdentifyAppliedRef.current = null;
                            }}
                            onMouseLeave={() => setIdentifyHover(null)}
                            className={`absolute inset-0 z-10 flex items-center justify-center font-mono font-bold cursor-pointer select-none ${isVertical ? '-rotate-90' : ''}`}
                            style={{
                              opacity: identifyHover?.stringIndex === stringIdx && identifyHover?.fret === fret ? 0.6 : 0,
                            }}
                          >
                            <div
                              className="rounded-full flex items-center justify-center"
                              style={{
                                width: noteMarkerSize,
                                height: noteMarkerSize,
                                minWidth: noteMarkerSize,
                                minHeight: noteMarkerSize,
                                flexShrink: 0,
                                backgroundColor: arpAddMode ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                                color: 'hsl(var(--muted-foreground))',
                                fontSize: Math.max(6, noteMarkerSize * 0.35),
                              }}
                            >
                              {note}
                            </div>
                          </button>
                        )}

                        {style && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (arpAddMode && onArpAddClick && fret > 0) {
                                onArpAddClick(stringIdx, fret);
                              } else if (identifyMode) {
                                // Simple toggle like chord library — barre is preserved by useEffect
                                applyIdentifySelection(stringIdx, fret, 'toggle');
                              } else {
                                onNoteClick(note);
                              }
                            }}
                            onMouseDown={(e) => {
                              if (arpAddMode && onArpAddClick && fret > 0) {
                                e.preventDefault();
                                arpDragRef.current = { startString: stringIdx, fret, coveredStrings: new Set([stringIdx]) };
                              } else if (identifyMode) {
                                e.preventDefault();
                                identifyMouseDown.current = true;
                                setIdentifyDrag({ startString: stringIdx, fret });
                                lastIdentifyAppliedRef.current = null;
                              } else {
                                e.preventDefault(); handleDragStart(stringIdx, fret, note);
                              }
                            }}
                            onMouseEnter={() => {
                              if (arpAddMode && arpDragRef.current && arpDragRef.current.fret === fret && onArpAddClick) {
                                const minS = Math.min(arpDragRef.current.startString, stringIdx);
                                const maxS = Math.max(arpDragRef.current.startString, stringIdx);
                                // During drag, only set endpoint markers, not intermediate strings
                                if (!arpDragRef.current.coveredStrings.has(stringIdx)) {
                                  arpDragRef.current.coveredStrings.add(stringIdx);
                                }
                                if (maxS > minS) onArpBarreDrag?.(arpDragRef.current.startString, stringIdx, fret);
                              } else if (identifyMode) {
                                setIdentifyHover({ stringIndex: stringIdx, fret });
                                if (identifyMouseDown.current && identifyDrag && identifyDrag.fret === fret) {
                                  applyIdentifyBarreDrag(stringIdx);
                                }
                              } else {
                                handleDragEnter(stringIdx, fret, note); handleNoteHover(note);
                              }
                            }}
                            onMouseUp={() => {
                              if (identifyMode) {
                                setIdentifyDrag(null);
                                identifyMouseDown.current = false;
                                lastIdentifyAppliedRef.current = null;
                              }
                              arpDragRef.current = null;
                            }}
                            onMouseLeave={() => {
                              if (identifyMode) setIdentifyHover(null);
                              else if (!isDragging) setHoveredDiatonic(null);
                            }}
                            className={`${identifyMode ? 'absolute inset-0 z-10 flex items-center justify-center' : 'relative z-10 rounded-full'} font-mono font-bold transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer select-none ${isVertical ? '-rotate-90' : ''}`}
                            style={{
                              width: identifyMode ? '100%' : noteMarkerSize,
                              height: identifyMode ? '100%' : noteMarkerSize,
                            }}
                          >
                            <div
                              className={`rounded-full flex items-center justify-center font-mono font-bold shadow-md ${
                                style.ring ? 'ring-2' : ''
                              } ${identifyMode && (identifyFrets[stringIdx] === fret || (identifyBarre && fret === identifyBarre.fret && stringIdx >= identifyBarre.from && stringIdx <= identifyBarre.to)) ? 'ring-2 ring-primary' : ''}`}
                              style={{
                                width: noteMarkerSize,
                                height: noteMarkerSize,
                                minWidth: noteMarkerSize,
                                minHeight: noteMarkerSize,
                                flexShrink: 0,
                                backgroundColor: style.greyed ? 'hsl(var(--muted))' : style.backgroundColor,
                                opacity: style.opacity,
                                color: style.greyed
                                  ? 'hsl(var(--muted-foreground))'
                                  : identifyMode && (identifyFrets[stringIdx] === fret || (identifyBarre && fret === identifyBarre.fret && stringIdx >= identifyBarre.from && stringIdx <= identifyBarre.to)) && !(degreeColors && identifyRoot)
                                    ? 'hsl(var(--primary-foreground))'
                                    : 'hsl(220, 20%, 8%)',
                                fontSize: Math.max(6, noteMarkerSize * 0.35),
                                ...(style.ring ? { boxShadow: `0 0 0 2px ${style.ringColor}` } : {}),
                              }}
                            >
                              {label}
                            </div>
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
