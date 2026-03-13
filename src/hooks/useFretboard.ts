import { useState, useCallback } from 'react';
import { NoteName, NOTE_NAMES } from '@/lib/music';

export interface ScaleSelection {
  root: NoteName;
  scale: string;
}

export interface NoteColors {
  [note: string]: string; // HSL string
}

const DEFAULT_COLORS: NoteColors = {};
NOTE_NAMES.forEach(note => {
  DEFAULT_COLORS[note] = ''; // empty means use CSS variable default
});

export function useFretboard() {
  const [maxFrets, setMaxFrets] = useState(22);
  const [primaryScale, setPrimaryScale] = useState<ScaleSelection>({ root: 'A', scale: 'Natural Minor' });
  const [secondaryScale, setSecondaryScale] = useState<ScaleSelection>({ root: 'E', scale: 'Superlocrian' });
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  const [activePrimary, setActivePrimary] = useState(true); // which scale is "active" (bright)
  const [noteColors, setNoteColors] = useState<NoteColors>(DEFAULT_COLORS);
  const [selectedNote, setSelectedNote] = useState<NoteName | null>(null);

  const updateNoteColor = useCallback((note: NoteName, color: string) => {
    setNoteColors(prev => ({ ...prev, [note]: color }));
  }, []);

  return {
    maxFrets, setMaxFrets,
    primaryScale, setPrimaryScale,
    secondaryScale, setSecondaryScale,
    secondaryEnabled, setSecondaryEnabled,
    activePrimary, setActivePrimary,
    noteColors, updateNoteColor,
    selectedNote, setSelectedNote,
  };
}
