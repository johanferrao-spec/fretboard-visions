import { useState, useCallback } from 'react';
import { NoteName, NOTE_NAMES, STANDARD_TUNING, TUNING_PRESETS, type TuningPreset, type ArpeggioPosition } from '@/lib/music';

export type ScaleMode = 'scale' | 'arpeggio';
export type DisplayMode = 'notes' | 'degrees' | 'fingers';
export type Orientation = 'horizontal' | 'vertical';

export interface ScaleSelection {
  mode: ScaleMode;
  root: NoteName;
  scale: string;
}

export interface ChordSelection {
  root: NoteName;
  chordType: string;
  voicingIndex: number;
  voicingSource: 'full' | 'shell' | 'drop2' | 'drop3' | 'triads';
}

export interface NoteColors {
  [note: string]: string;
}

const DEFAULT_COLORS: NoteColors = {};
NOTE_NAMES.forEach(note => {
  DEFAULT_COLORS[note] = '';
});

export function useFretboard() {
  const [maxFrets, setMaxFrets] = useState(22);
  const [primaryScale, setPrimaryScale] = useState<ScaleSelection>({ mode: 'scale', root: 'A', scale: 'Natural Minor (Aeolian)' });
  const [secondaryScale, setSecondaryScale] = useState<ScaleSelection>({ mode: 'scale', root: 'E', scale: 'Superlocrian (Altered)' });
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  const [activePrimary, setActivePrimary] = useState(true);
  const [noteColors, setNoteColors] = useState<NoteColors>(DEFAULT_COLORS);
  const [selectedNote, setSelectedNote] = useState<NoteName | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('notes');
  const [disabledStrings, setDisabledStrings] = useState<Set<number>>(new Set());
  const [secondaryOpacity, setSecondaryOpacity] = useState(0.35);
  const [secondaryColor, setSecondaryColor] = useState('hsl(200, 80%, 60%)');
  const [primaryColor, setPrimaryColor] = useState('');
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [showFretBox, setShowFretBox] = useState(false);
  const [fretBoxStart, setFretBoxStart] = useState(1);
  const [fretBoxSize, setFretBoxSize] = useState(5);
  const [fretBoxStringStart, setFretBoxStringStart] = useState(0); // 0-based row index in stringOrder
  const [fretBoxStringSize, setFretBoxStringSize] = useState(6); // number of strings visible
  const [noteMarkerSize, setNoteMarkerSize] = useState(20);
  const [degreeColors, setDegreeColors] = useState(true);
  const [disabledDegrees, setDisabledDegrees] = useState<Set<string>>(new Set());
  const [activeChord, setActiveChord] = useState<ChordSelection | null>(null);
  const [showCAGED, setShowCAGED] = useState(false);
  const [cagedShape, setCagedShape] = useState<string>('E');
  const [identifyMode, setIdentifyMode] = useState(false);
  const [identifyFrets, setIdentifyFrets] = useState<(number | -1)[]>([-1, -1, -1, -1, -1, -1]);
  const [identifyRoot, setIdentifyRoot] = useState<NoteName | null>(null);
  const [tuning, setTuningState] = useState<number[]>(STANDARD_TUNING);
  const [tuningName, setTuningName] = useState('Standard');
  const [tuningLabels, setTuningLabels] = useState<string[]>(['E', 'A', 'D', 'G', 'B', 'e']);
  const [customTunings, setCustomTunings] = useState<TuningPreset[]>([]);
  const [arpeggioPosition, setArpeggioPosition] = useState<ArpeggioPosition | null>(null);

  const setTuning = useCallback((preset: TuningPreset) => {
    setTuningState(preset.notes);
    setTuningName(preset.name);
    setTuningLabels(preset.labels);
    setActiveChord(null);
  }, []);

  const updateNoteColor = useCallback((note: NoteName, color: string) => {
    setNoteColors(prev => ({ ...prev, [note]: color }));
  }, []);

  const toggleStringDisabled = useCallback((stringIndex: number) => {
    setDisabledStrings(prev => {
      const next = new Set(prev);
      if (next.has(stringIndex)) next.delete(stringIndex);
      else next.add(stringIndex);
      return next;
    });
  }, []);

  const toggleDegree = useCallback((degree: string) => {
    setDisabledDegrees(prev => {
      const next = new Set(prev);
      if (next.has(degree)) next.delete(degree);
      else next.add(degree);
      return next;
    });
  }, []);

  const clearFretboard = useCallback(() => {
    setActiveChord(null);
    setSelectedNote(null);
    setDisabledStrings(new Set());
    setShowFretBox(false);
    setShowCAGED(false);
    setDisabledDegrees(new Set());
    setIdentifyMode(false);
    setIdentifyFrets([-1, -1, -1, -1, -1, -1]);
    setIdentifyRoot(null);
    setNoteMarkerSize(20);
    setArpeggioPosition(null);
  }, []);

  // When enabling dual scale, turn off degree colors by default
  const handleSetSecondaryEnabled = useCallback((v: boolean) => {
    setSecondaryEnabled(v);
    if (v) setDegreeColors(false);
  }, []);

  return {
    maxFrets, setMaxFrets,
    primaryScale, setPrimaryScale,
    secondaryScale, setSecondaryScale,
    secondaryEnabled, setSecondaryEnabled: handleSetSecondaryEnabled,
    activePrimary, setActivePrimary,
    noteColors, updateNoteColor,
    selectedNote, setSelectedNote,
    displayMode, setDisplayMode,
    disabledStrings, toggleStringDisabled,
    secondaryOpacity, setSecondaryOpacity,
    secondaryColor, setSecondaryColor,
    primaryColor, setPrimaryColor,
    activeChord, setActiveChord,
    orientation, setOrientation,
    showFretBox, setShowFretBox,
    fretBoxStart, setFretBoxStart,
    fretBoxSize, setFretBoxSize,
    fretBoxStringStart, setFretBoxStringStart,
    fretBoxStringSize, setFretBoxStringSize,
    noteMarkerSize, setNoteMarkerSize,
    degreeColors, setDegreeColors,
    disabledDegrees, toggleDegree,
    showCAGED, setShowCAGED,
    cagedShape, setCagedShape,
    identifyMode, setIdentifyMode,
    identifyFrets, setIdentifyFrets,
    identifyRoot, setIdentifyRoot,
    tuning, tuningName, tuningLabels, setTuning,
    customTunings, setCustomTunings,
    arpeggioPosition, setArpeggioPosition,
    clearFretboard,
  };
}
