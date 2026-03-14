export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = typeof NOTE_NAMES[number];

export const NOTE_CSS_KEYS: Record<NoteName, string> = {
  'C': '--note-c', 'C#': '--note-cs', 'D': '--note-d', 'D#': '--note-ds',
  'E': '--note-e', 'F': '--note-f', 'F#': '--note-fs', 'G': '--note-g',
  'G#': '--note-gs', 'A': '--note-a', 'A#': '--note-as', 'B': '--note-b',
};

// Standard tuning: E A D G B E (low to high, index 0 = low E)
export const STANDARD_TUNING = [4, 9, 2, 7, 11, 4]; // E=4, A=9, D=2, G=7, B=11, E=4
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

export const SCALE_FORMULAS: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Locrian': [0, 1, 3, 5, 6, 8, 10],
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Whole Tone': [0, 2, 4, 6, 8, 10],
  'Diminished': [0, 2, 3, 5, 6, 8, 9, 11],
  'Superlocrian': [0, 1, 3, 4, 6, 8, 10],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const CHORD_FORMULAS: Record<string, number[]> = {
  'Major': [0, 4, 7],
  'Minor': [0, 3, 7],
  'Diminished': [0, 3, 6],
  'Augmented': [0, 4, 8],
  'Sus2': [0, 2, 7],
  'Sus4': [0, 5, 7],
  'Major 7': [0, 4, 7, 11],
  'Minor 7': [0, 3, 7, 10],
  'Dominant 7': [0, 4, 7, 10],
  'Dim 7': [0, 3, 6, 9],
  'Half-Dim 7': [0, 3, 6, 10],
  'Min/Maj 7': [0, 3, 7, 11],
  'Add9': [0, 4, 7, 14],
  'Major 9': [0, 4, 7, 11, 14],
  'Minor 9': [0, 3, 7, 10, 14],
  'Dominant 9': [0, 4, 7, 10, 14],
  'Major 6': [0, 4, 7, 9],
  'Minor 6': [0, 3, 7, 9],
  '7sus4': [0, 5, 7, 10],
  '7#9': [0, 4, 7, 10, 15],
  '7♭9': [0, 4, 7, 10, 13],
  '11': [0, 4, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 21],
  'Power (5)': [0, 7],
};

// Playable chord voicings: [lowE, A, D, G, B, highE] (-1 = muted, 0 = open)
export const CHORD_VOICINGS: Record<string, Record<string, number[][]>> = {
  'C': {
    'Major': [[-1, 3, 2, 0, 1, 0], [8, 10, 10, 9, 8, 8]],
    'Minor': [[-1, 3, 5, 5, 4, 3], [8, 10, 10, 8, 8, 8]],
    'Major 7': [[-1, 3, 2, 0, 0, 0], [8, 10, 9, 9, 8, 8]],
    'Minor 7': [[-1, 3, 5, 3, 4, 3], [8, 10, 8, 8, 8, 8]],
    'Dominant 7': [[-1, 3, 2, 3, 1, 0], [8, 10, 8, 9, 8, 8]],
    'Diminished': [[-1, 3, 4, 5, 4, -1]],
    'Augmented': [[-1, 3, 2, 1, 1, 0]],
    'Sus2': [[-1, 3, 0, 0, 1, 3]],
    'Sus4': [[-1, 3, 3, 0, 1, 1]],
  },
  'D': {
    'Major': [[-1, -1, 0, 2, 3, 2], [10, 12, 12, 11, 10, 10]],
    'Minor': [[-1, -1, 0, 2, 3, 1], [10, 12, 12, 10, 10, 10]],
    'Major 7': [[-1, -1, 0, 2, 2, 2]],
    'Minor 7': [[-1, -1, 0, 2, 1, 1]],
    'Dominant 7': [[-1, -1, 0, 2, 1, 2]],
    'Sus2': [[-1, -1, 0, 2, 3, 0]],
    'Sus4': [[-1, -1, 0, 2, 3, 3]],
  },
  'E': {
    'Major': [[0, 2, 2, 1, 0, 0]],
    'Minor': [[0, 2, 2, 0, 0, 0]],
    'Major 7': [[0, 2, 1, 1, 0, 0]],
    'Minor 7': [[0, 2, 0, 0, 0, 0]],
    'Dominant 7': [[0, 2, 0, 1, 0, 0]],
    'Diminished': [[-1, -1, 2, 3, 2, 0]],
    'Augmented': [[0, 3, 2, 1, 1, 0]],
    'Sus2': [[0, 2, 4, 4, 0, 0]],
    'Sus4': [[0, 2, 2, 2, 0, 0]],
  },
  'G': {
    'Major': [[3, 2, 0, 0, 0, 3], [3, 2, 0, 0, 3, 3]],
    'Minor': [[3, 5, 5, 3, 3, 3]],
    'Major 7': [[3, 2, 0, 0, 0, 2]],
    'Dominant 7': [[3, 2, 0, 0, 0, 1]],
    'Diminished': [[-1, -1, 5, 6, 5, 3]],
    'Sus2': [[3, 0, 0, 0, 3, 3]],
    'Sus4': [[3, 3, 0, 0, 1, 3]],
  },
  'A': {
    'Major': [[-1, 0, 2, 2, 2, 0], [5, 7, 7, 6, 5, 5]],
    'Minor': [[-1, 0, 2, 2, 1, 0], [5, 7, 7, 5, 5, 5]],
    'Major 7': [[-1, 0, 2, 1, 2, 0]],
    'Minor 7': [[-1, 0, 2, 0, 1, 0]],
    'Dominant 7': [[-1, 0, 2, 0, 2, 0]],
    'Diminished': [[-1, 0, 1, 2, 1, -1]],
    'Augmented': [[-1, 0, 3, 2, 2, 1]],
    'Sus2': [[-1, 0, 2, 2, 0, 0]],
    'Sus4': [[-1, 0, 2, 2, 3, 0]],
  },
  'F': {
    'Major': [[1, 1, 2, 3, 3, 1], [-1, -1, 3, 2, 1, 1]],
    'Minor': [[1, 1, 1, 3, 3, 1]],
    'Major 7': [[1, -1, 2, 2, 1, 0]],
    'Dominant 7': [[1, 1, 2, 1, 3, 1]],
    'Diminished': [[-1, -1, 3, 4, 3, 1]],
    'Sus2': [[-1, -1, 3, 0, 1, 1]],
    'Sus4': [[1, 1, 3, 3, 1, 1]],
  },
  'B': {
    'Major': [[-1, 2, 4, 4, 4, 2], [7, 9, 9, 8, 7, 7]],
    'Minor': [[-1, 2, 4, 4, 3, 2], [7, 9, 9, 7, 7, 7]],
    'Major 7': [[-1, 2, 4, 3, 4, 2]],
    'Dominant 7': [[-1, 2, 1, 2, 0, 2]],
    'Diminished': [[-1, -1, 0, 1, 0, 1]],
    'Sus2': [[-1, 2, 4, 4, 2, 2]],
    'Sus4': [[-1, 2, 4, 4, 5, 2]],
  },
  'C#': {
    'Major': [[-1, 4, 6, 6, 6, 4], [9, 11, 11, 10, 9, 9]],
    'Minor': [[-1, 4, 6, 6, 5, 4]],
  },
  'D#': {
    'Major': [[-1, 6, 8, 8, 8, 6]],
    'Minor': [[-1, 6, 8, 8, 7, 6]],
  },
  'F#': {
    'Major': [[2, 4, 4, 3, 2, 2]],
    'Minor': [[2, 4, 4, 2, 2, 2]],
    'Major 7': [[2, -1, 3, 3, 2, 1]],
    'Dominant 7': [[2, 4, 2, 3, 2, 2]],
  },
  'G#': {
    'Major': [[4, 6, 6, 5, 4, 4]],
    'Minor': [[4, 6, 6, 4, 4, 4]],
  },
  'A#': {
    'Major': [[-1, 1, 3, 3, 3, 1], [6, 8, 8, 7, 6, 6]],
    'Minor': [[-1, 1, 3, 3, 2, 1]],
    'Major 7': [[-1, 1, 3, 2, 3, 1]],
    'Dominant 7': [[-1, 1, 3, 1, 3, 1]],
  },
};

export const ARPEGGIO_FORMULAS: Record<string, number[]> = {
  'Major': [0, 4, 7],
  'Minor': [0, 3, 7],
  'Diminished': [0, 3, 6],
  'Augmented': [0, 4, 8],
  'Major 7': [0, 4, 7, 11],
  'Minor 7': [0, 3, 7, 10],
  'Dominant 7': [0, 4, 7, 10],
  'Dim 7': [0, 3, 6, 9],
  'Half-Dim 7': [0, 3, 6, 10],
  'Min/Maj 7': [0, 3, 7, 11],
};

export function noteAtFret(stringIndex: number, fret: number): NoteName {
  const openNote = STANDARD_TUNING[stringIndex];
  return NOTE_NAMES[(openNote + fret) % 12];
}

export function getScaleNotes(root: NoteName, scaleName: string): NoteName[] {
  const rootIndex = NOTE_NAMES.indexOf(root);
  const formula = SCALE_FORMULAS[scaleName];
  if (!formula) return [];
  return formula.map(interval => NOTE_NAMES[(rootIndex + interval) % 12]);
}

export function getArpeggioNotes(root: NoteName, arpeggioName: string): NoteName[] {
  const rootIndex = NOTE_NAMES.indexOf(root);
  const formula = ARPEGGIO_FORMULAS[arpeggioName];
  if (!formula) return [];
  return formula.map(interval => NOTE_NAMES[(rootIndex + interval) % 12]);
}

export function isNoteInScale(note: NoteName, root: NoteName, scaleName: string): boolean {
  const scaleNotes = getScaleNotes(root, scaleName);
  return scaleNotes.includes(note);
}

export function isNoteInArpeggio(note: NoteName, root: NoteName, arpeggioName: string): boolean {
  const notes = getArpeggioNotes(root, arpeggioName);
  return notes.includes(note);
}

export function isNoteInSelection(note: NoteName, root: NoteName, name: string, mode: 'scale' | 'arpeggio'): boolean {
  if (mode === 'scale') return isNoteInScale(note, root, name);
  return isNoteInArpeggio(note, root, name);
}

export function getChordsForNote(note: NoteName): { name: string; notes: NoteName[] }[] {
  const rootIndex = NOTE_NAMES.indexOf(note);
  return Object.entries(CHORD_FORMULAS).map(([name, formula]) => ({
    name: `${note} ${name}`,
    notes: formula.map(i => NOTE_NAMES[(rootIndex + i) % 12]),
  }));
}

export function getArpeggiosForNote(note: NoteName): { name: string; notes: NoteName[] }[] {
  const rootIndex = NOTE_NAMES.indexOf(note);
  return Object.entries(ARPEGGIO_FORMULAS).map(([name, formula]) => ({
    name: `${note} ${name}`,
    notes: formula.map(i => NOTE_NAMES[(rootIndex + i) % 12]),
  }));
}

export function getIntervalName(root: NoteName, note: NoteName): string {
  const intervals = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const rootIdx = NOTE_NAMES.indexOf(root);
  const noteIdx = NOTE_NAMES.indexOf(note);
  const diff = (noteIdx - rootIdx + 12) % 12;
  return intervals[diff];
}

// Get notes for a chord voicing on the fretboard
export function getChordVoicingNotes(voicing: number[]): { stringIndex: number; fret: number; note: NoteName }[] {
  const result: { stringIndex: number; fret: number; note: NoteName }[] = [];
  voicing.forEach((fret, stringIndex) => {
    if (fret >= 0) {
      result.push({ stringIndex, fret, note: noteAtFret(stringIndex, fret) });
    }
  });
  return result;
}
