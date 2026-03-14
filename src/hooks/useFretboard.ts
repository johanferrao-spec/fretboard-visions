import { useState, useCallback } from 'react';
import { NoteName, NOTE_NAMES } from '@/lib/music';

export type ScaleMode = 'scale' | 'arpeggio';
export type DisplayMode = 'notes' | 'degrees';
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
  isShell?: boolean;
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
  const [primaryScale, setPrimaryScale] = useState<ScaleSelection>({ mode: 'scale', root: 'A', scale: 'Natural Minor' });
  const [secondaryScale, setSecondaryScale] = useState<ScaleSelection>({ mode: 'scale', root: 'E', scale: 'Superlocrian' });
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

  // Chord mode
  const [activeChord, setActiveChord] = useState<ChordSelection | null>(null);

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

  return {
    maxFrets, setMaxFrets,
    primaryScale, setPrimaryScale,
    secondaryScale, setSecondaryScale,
    secondaryEnabled, setSecondaryEnabled,
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
  };
}
