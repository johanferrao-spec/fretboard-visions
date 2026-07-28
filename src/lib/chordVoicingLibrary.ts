// AUTO-GENERATED chord voicing library (source: all-guitar-chords.com data supplied by the user).
// Section 1 shapes are movable (reference root = C) and transposed to all 12 roots at build time.
// Section 2 shapes use open strings and are fixed to their listed root.

export interface LibraryVoicing {
  frets: number[];
  fingers?: (number | 'B' | 0)[];
  barreFrom?: number;
  barreTo?: number;
  barreFret?: number;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
type Note = typeof NOTES[number];

/** Movable shapes, written as played with root = C. */
export const MOVABLE_SHAPES: Record<string, LibraryVoicing[]> = {
  "Power (5)": [
    { frets: [-1, 3, 5, -1, -1, -1], fingers: [0, 1, 3, 0, 0, 0] },
    { frets: [-1, 3, 5, 5, -1, -1], fingers: [0, 1, 3, 3, 0, 0], barreFrom: 2, barreTo: 3, barreFret: 5 },
    { frets: [-1, -1, 5, 5, -1, -1], fingers: [0, 0, 2, 3, 0, 0] },
    { frets: [8, 10, -1, -1, -1, -1], fingers: [1, 3, 0, 0, 0, 0] },
  ],
  "Major 6": [
    { frets: [-1, -1, 2, 2, 1, 3], fingers: [0, 0, 2, 3, 1, 4] },
    { frets: [-1, 3, 5, 5, 5, 5], fingers: [0, 1, 3, 3, 3, 3], barreFrom: 2, barreTo: 5, barreFret: 5 },
    { frets: [-1, -1, 5, 5, 5, 5], fingers: [0, 0, 1, 1, 1, 1], barreFrom: 2, barreTo: 5, barreFret: 5 },
    { frets: [5, 7, 5, 5, 5, 5], fingers: [1, 3, 1, 1, 1, 1], barreFrom: 0, barreTo: 5, barreFret: 5 },
    { frets: [8, -1, 7, 9, 8, -1], fingers: [2, 0, 1, 4, 3, 0] },
  ],
  "Dominant 7": [
    { frets: [-1, -1, 2, 3, 1, 3], fingers: [0, 0, 2, 3, 1, 4] },
    { frets: [-1, 3, 2, 3, 1, -1], fingers: [0, 3, 2, 4, 1, 0] },
    { frets: [-1, 3, 5, 3, 5, 3], fingers: [0, 1, 3, 1, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [-1, -1, 5, 5, 5, 6], fingers: [0, 0, 1, 1, 1, 2], barreFrom: 2, barreTo: 4, barreFret: 5 },
  ],
  "Dominant 9": [
    { frets: [-1, 3, 2, 3, 3, 3], fingers: [0, 2, 1, 3, 3, 3], barreFrom: 3, barreTo: 5, barreFret: 3 },
    { frets: [-1, 5, 5, 5, 5, 6], fingers: [0, 1, 1, 1, 1, 2], barreFrom: 1, barreTo: 4, barreFret: 5 },
    { frets: [8, 7, 8, 7, 8, -1], fingers: [2, 1, 3, 1, 4, 0], barreFrom: 1, barreTo: 3, barreFret: 7 },
    { frets: [8, -1, 8, 7, 8, 8], fingers: [0, 0, 2, 1, 3, 3], barreFrom: 4, barreTo: 5, barreFret: 8 },
    { frets: [8, 10, 8, 9, 8, 10], fingers: [1, 3, 1, 2, 1, 4], barreFrom: 0, barreTo: 4, barreFret: 8 },
  ],
  "11": [
    { frets: [-1, 3, -1, 3, 3, 1], fingers: [0, 2, 0, 3, 4, 1] },
    { frets: [-1, 3, 3, 3, 3, 3], fingers: [0, 1, 1, 1, 1, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [8, -1, 8, 7, 6, -1], fingers: [3, 0, 4, 2, 1, 0] },
  ],
  "13": [
    { frets: [-1, 3, 2, 3, 3, 5], fingers: [0, 2, 1, 3, 3, 4], barreFrom: 3, barreTo: 4, barreFret: 3 },
    { frets: [8, -1, 8, 7, 5, 5], fingers: [3, 0, 4, 2, 1, 1], barreFrom: 4, barreTo: 5, barreFret: 5 },
    { frets: [8, -1, 8, 9, 10, -1], fingers: [1, 0, 2, 3, 4, 0] },
    { frets: [-1, -1, 8, 9, 10, 8], fingers: [0, 0, 1, 2, 3, 1], barreFrom: 2, barreTo: 5, barreFret: 8 },
  ],
  "Major": [
    { frets: [-1, 3, 5, 5, 5, 3], fingers: [0, 1, 2, 3, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [-1, -1, 5, 5, 5, 8], fingers: [0, 0, 1, 1, 1, 4], barreFrom: 2, barreTo: 4, barreFret: 5 },
    { frets: [8, 10, 10, 9, 8, 8], fingers: [1, 3, 4, 2, 1, 1], barreFrom: 0, barreTo: 5, barreFret: 8 },
    { frets: [-1, -1, 10, 12, 13, 12], fingers: [0, 0, 1, 2, 4, 3] },
  ],
  "Minor": [
    { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [8, 10, 10, 8, 8, 8], fingers: [1, 3, 4, 1, 1, 1], barreFrom: 0, barreTo: 5, barreFret: 8 },
    { frets: [-1, -1, 10, 12, 13, 11], fingers: [0, 0, 1, 3, 4, 2] },
  ],
  "Diminished": [
    { frets: [-1, 3, 4, 5, 4, -1], fingers: [0, 1, 2, 4, 3, 0] },
    { frets: [8, 9, 10, 8, -1, -1], fingers: [1, 2, 3, 1, 0, 0], barreFrom: 0, barreTo: 3, barreFret: 8 },
  ],
  "Dim 7": [
    { frets: [2, -1, 1, 2, 1, -1], fingers: [2, 0, 1, 3, 1, 0], barreFrom: 2, barreTo: 4, barreFret: 1 },
    { frets: [-1, 3, 4, 2, 4, -1], fingers: [0, 2, 3, 1, 4, 0] },
    { frets: [5, -1, 4, 5, 4, -1], fingers: [2, 0, 1, 3, 1, 0], barreFrom: 2, barreTo: 4, barreFret: 4 },
    { frets: [-1, 6, 7, 5, 7, -1], fingers: [0, 2, 3, 1, 4, 0] },
    { frets: [8, -1, 7, 8, 7, -1], fingers: [2, 0, 1, 3, 1, 0], barreFrom: 2, barreTo: 4, barreFret: 7 },
  ],
  "Augmented": [
    { frets: [-1, 3, 2, 1, 1, -1], fingers: [0, 4, 3, 1, 2, 0] },
    { frets: [-1, -1, 6, 5, 5, 4], fingers: [0, 0, 4, 2, 3, 1] },
    { frets: [8, 7, 6, 5, 5, -1], fingers: [4, 3, 2, 1, 1, 0], barreFrom: 3, barreTo: 4, barreFret: 5 },
  ],
  "Sus2": [
    { frets: [-1, 3, 5, 5, 3, 3], fingers: [0, 1, 3, 4, 1, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [-1, -1, 10, 12, 13, 10], fingers: [0, 0, 1, 3, 4, 1], barreFrom: 2, barreTo: 5, barreFret: 10 },
  ],
  "Sus4": [
    { frets: [-1, 3, 5, 5, 6, 3], fingers: [0, 1, 2, 3, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [-1, -1, 5, 5, 6, 8], fingers: [0, 0, 1, 1, 2, 4], barreFrom: 2, barreTo: 3, barreFret: 5 },
    { frets: [8, 10, 10, 10, 8, 8], fingers: [1, 2, 3, 4, 1, 1], barreFrom: 0, barreTo: 5, barreFret: 8 },
    { frets: [-1, -1, 10, 10, 8, 8], fingers: [0, 0, 3, 4, 1, 1], barreFrom: 4, barreTo: 5, barreFret: 8 },
  ],
  "Major 7": [
    { frets: [-1, -1, 2, 4, 1, 3], fingers: [0, 0, 2, 4, 1, 3] },
    { frets: [-1, 3, 5, 4, 5, 3], fingers: [0, 1, 3, 2, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [3, 3, 5, 4, 5, 3], fingers: [1, 1, 3, 2, 4, 1], barreFrom: 0, barreTo: 5, barreFret: 3 },
    { frets: [-1, 7, 5, 5, 5, 7], fingers: [0, 3, 1, 1, 1, 4], barreFrom: 2, barreTo: 4, barreFret: 5 },
    { frets: [-1, -1, 10, 9, 8, 7], fingers: [0, 0, 4, 3, 2, 1] },
  ],
  "Minor 7": [
    { frets: [-1, 3, 1, 3, 1, -1], fingers: [0, 3, 1, 4, 1, 0], barreFrom: 2, barreTo: 4, barreFret: 1 },
    { frets: [-1, 1, 1, 3, 1, 3], fingers: [0, 1, 1, 3, 1, 4], barreFrom: 1, barreTo: 4, barreFret: 1 },
    { frets: [-1, 3, 5, 3, 4, 3], fingers: [0, 1, 3, 1, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [-1, -1, 5, 5, 4, 6], fingers: [0, 0, 2, 3, 1, 4] },
    { frets: [8, 10, 8, 8, 8, 8], fingers: [1, 3, 1, 1, 1, 1], barreFrom: 0, barreTo: 5, barreFret: 8 },
  ],
  "7sus4": [
    { frets: [-1, 3, 5, 3, 6, 3], fingers: [0, 1, 3, 1, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [8, 10, 8, 10, 8, 8], fingers: [1, 3, 1, 4, 1, 1], barreFrom: 0, barreTo: 5, barreFret: 8 },
    { frets: [-1, -1, 10, 12, 11, 13], fingers: [0, 0, 1, 3, 2, 4] },
  ],
  "Major 9": [
    { frets: [-1, 3, 2, 4, 3, -1], fingers: [0, 2, 1, 4, 3, 0] },
    { frets: [-1, 3, 5, 4, 3, 3], fingers: [0, 1, 3, 2, 1, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [8, 7, 9, 7, 8, 7], fingers: [2, 1, 4, 1, 3, 1], barreFrom: 1, barreTo: 5, barreFret: 7 },
    { frets: [8, -1, 9, 7, 8, -1], fingers: [2, 0, 4, 1, 3, 0] },
    { frets: [-1, -1, 10, 12, 12, 10], fingers: [0, 0, 1, 3, 4, 1], barreFrom: 2, barreTo: 5, barreFret: 10 },
  ],
  "Maj11": [
    { frets: [-1, 3, 2, 4, 1, 1], fingers: [0, 3, 2, 4, 1, 1], barreFrom: 4, barreTo: 5, barreFret: 1 },
  ],
  "Maj13": [
    { frets: [-1, 3, -1, 4, 5, 5], fingers: [0, 1, 0, 2, 4, 4], barreFrom: 4, barreTo: 5, barreFret: 5 },
    { frets: [8, 7, 7, 7, 8, 7], fingers: [2, 1, 1, 1, 3, 1], barreFrom: 1, barreTo: 5, barreFret: 7 },
    { frets: [8, -1, 9, 9, 10, 10], fingers: [1, 0, 2, 2, 4, 4], barreFrom: 2, barreTo: 3, barreFret: 9 },
  ],
  "Maj9#11": [
    { frets: [-1, 3, 2, 4, 3, 2], fingers: [0, 2, 1, 4, 3, 1], barreFrom: 2, barreTo: 5, barreFret: 2 },
    { frets: [8, 7, 9, 7, 7, 7], fingers: [2, 1, 3, 1, 1, 1], barreFrom: 1, barreTo: 5, barreFret: 7 },
  ],
  "Maj13#11": [
    { frets: [-1, 3, 2, 2, 3, 2], fingers: [0, 2, 1, 1, 3, 1], barreFrom: 2, barreTo: 5, barreFret: 2 },
    { frets: [8, 7, 7, 7, 7, 7], fingers: [2, 1, 1, 1, 1, 1], barreFrom: 1, barreTo: 5, barreFret: 7 },
  ],
  "Add9": [
    { frets: [8, 7, 5, 7, 5, -1], fingers: [4, 2, 1, 3, 1, 0], barreFrom: 2, barreTo: 4, barreFret: 5 },
  ],
  "6add9": [
    { frets: [-1, 3, 2, 2, 3, 3], fingers: [0, 2, 1, 1, 3, 4], barreFrom: 2, barreTo: 3, barreFret: 2 },
    { frets: [8, -1, 7, 7, 5, -1], fingers: [4, 0, 2, 3, 1, 0] },
    { frets: [8, 7, 7, 7, 8, 8], fingers: [2, 1, 1, 1, 3, 4], barreFrom: 1, barreTo: 3, barreFret: 7 },
  ],
  "Major 7♭5": [
    { frets: [-1, 3, -1, 4, 5, 2], fingers: [0, 2, 0, 3, 4, 1] },
    { frets: [8, -1, 9, 9, 7, -1], fingers: [2, 0, 3, 4, 1, 0] },
    { frets: [-1, -1, 10, 9, 7, 7], fingers: [0, 0, 4, 3, 1, 1], barreFrom: 4, barreTo: 5, barreFret: 7 },
    { frets: [-1, -1, 10, 11, 12, 12], fingers: [0, 0, 1, 2, 4, 4], barreFrom: 4, barreTo: 5, barreFret: 12 },
  ],
  "Major 7#5": [
    { frets: [-1, 3, -1, 4, 5, 4], fingers: [0, 1, 0, 2, 4, 3] },
    { frets: [-1, 7, 6, 5, 5, 7], fingers: [0, 3, 2, 1, 1, 4], barreFrom: 3, barreTo: 4, barreFret: 5 },
    { frets: [-1, -1, 10, 9, 9, 7], fingers: [0, 0, 4, 2, 3, 1] },
    { frets: [8, -1, 9, 9, 9, -1], fingers: [1, 0, 3, 3, 3, 0], barreFrom: 2, barreTo: 4, barreFret: 9 },
    { frets: [-1, 11, 10, 9, 12, 12], fingers: [0, 3, 2, 1, 4, 4], barreFrom: 4, barreTo: 5, barreFret: 12 },
  ],
  "Minor 6": [
    { frets: [-1, 3, 1, 2, 1, 3], fingers: [0, 3, 1, 2, 1, 4], barreFrom: 2, barreTo: 4, barreFret: 1 },
    { frets: [-1, 3, -1, 2, 4, 3], fingers: [0, 2, 0, 1, 4, 3] },
    { frets: [-1, -1, 5, 5, 4, 5], fingers: [0, 0, 2, 3, 1, 4] },
    { frets: [5, 6, 5, 5, 8, 5], fingers: [1, 2, 1, 1, 4, 1], barreFrom: 0, barreTo: 5, barreFret: 5 },
    { frets: [8, -1, 7, 8, 8, -1], fingers: [2, 0, 1, 3, 4, 0] },
  ],
  "Minor 9": [
    { frets: [-1, 3, 1, 3, 3, -1], fingers: [0, 2, 1, 3, 4, 0] },
    { frets: [8, -1, 8, 8, 8, 10], fingers: [1, 0, 1, 1, 1, 4], barreFrom: 0, barreTo: 4, barreFret: 8 },
  ],
  "Minor 11": [
    { frets: [-1, 3, 3, 3, 4, 3], fingers: [0, 1, 1, 1, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [8, -1, 8, 8, 6, -1], fingers: [2, 0, 3, 4, 1, 0] },
    { frets: [8, 8, 8, 8, 8, 8], fingers: [1, 1, 1, 1, 1, 1], barreFrom: 0, barreTo: 5, barreFret: 8 },
    { frets: [-1, -1, 10, 10, 11, 11], fingers: [0, 0, 1, 1, 2, 2], barreFrom: 2, barreTo: 3, barreFret: 10 },
  ],
  "Minor 13": [
    { frets: [-1, 3, 5, 3, 4, 5], fingers: [0, 1, 3, 1, 2, 4], barreFrom: 1, barreTo: 3, barreFret: 3 },
    { frets: [8, 10, 8, 8, 10, 10], fingers: [1, 2, 1, 1, 3, 4], barreFrom: 0, barreTo: 3, barreFret: 8 },
  ],
  "Madd9": [
    { frets: [-1, -1, 10, 8, 8, 10], fingers: [0, 0, 3, 1, 1, 4], barreFrom: 3, barreTo: 4, barreFret: 8 },
  ],
  "m6add9": [
    { frets: [-1, 3, 1, 2, 3, -1], fingers: [0, 3, 1, 2, 4, 0] },
    { frets: [-1, 6, 7, 7, 8, 8], fingers: [0, 1, 2, 2, 4, 4], barreFrom: 2, barreTo: 3, barreFret: 7 },
    { frets: [-1, -1, 10, 8, 10, 10], fingers: [0, 0, 2, 1, 3, 4] },
  ],
  "Min/Maj 7": [
    { frets: [-1, 3, 5, 4, 4, 3], fingers: [0, 1, 4, 2, 3, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [-1, -1, 5, 5, 4, 7], fingers: [0, 0, 2, 3, 1, 4] },
    { frets: [-1, -1, 10, 8, 8, 7], fingers: [0, 0, 4, 2, 3, 1] },
    { frets: [8, 10, 9, 8, 8, 8], fingers: [1, 3, 2, 1, 1, 1], barreFrom: 0, barreTo: 5, barreFret: 8 },
    { frets: [-1, -1, 10, 12, 12, 11], fingers: [0, 0, 1, 3, 4, 2] },
  ],
  "mMaj9": [
    { frets: [-1, 3, 1, 4, 3, -1], fingers: [0, 2, 1, 4, 3, 0] },
    { frets: [8, 10, 9, 8, 8, 10], fingers: [1, 3, 2, 1, 1, 4], barreFrom: 0, barreTo: 4, barreFret: 8 },
  ],
  "Half-Dim 7": [
    { frets: [-1, 1, 1, 3, 1, 2], fingers: [0, 1, 1, 3, 1, 2], barreFrom: 1, barreTo: 4, barreFret: 1 },
    { frets: [-1, -1, 1, 3, 1, 2], fingers: [0, 0, 1, 3, 1, 2], barreFrom: 2, barreTo: 4, barreFret: 1 },
    { frets: [-1, 3, -1, 3, 4, 2], fingers: [0, 2, 0, 3, 4, 1] },
    { frets: [-1, 3, 4, 3, 4, -1], fingers: [0, 1, 3, 2, 4, 0] },
    { frets: [-1, 6, 4, 5, 4, 6], fingers: [0, 3, 1, 2, 1, 4], barreFrom: 2, barreTo: 4, barreFret: 4 },
  ],
  "m7#5": [
    { frets: [-1, 3, -1, 3, 4, 4], fingers: [0, 1, 0, 2, 3, 4] },
    { frets: [8, -1, 8, 8, 9, -1], fingers: [1, 0, 2, 3, 4, 0] },
  ],
  "7♭5": [
    { frets: [2, -1, 2, 3, 1, -1], fingers: [2, 0, 3, 4, 1, 0] },
    { frets: [-1, -1, 2, 3, 1, 2], fingers: [0, 0, 2, 4, 1, 3] },
    { frets: [-1, 3, 4, 3, 5, -1], fingers: [0, 1, 2, 1, 3, 0], barreFrom: 1, barreTo: 3, barreFret: 3 },
    { frets: [-1, 3, 4, 3, 5, 6], fingers: [0, 1, 2, 1, 3, 4], barreFrom: 1, barreTo: 3, barreFret: 3 },
    { frets: [8, -1, 8, 9, 7, -1], fingers: [2, 0, 3, 4, 1, 0] },
  ],
  "7#5": [
    { frets: [-1, 1, 2, 1, 1, -1], fingers: [0, 1, 2, 1, 1, 0], barreFrom: 1, barreTo: 4, barreFret: 1 },
    { frets: [-1, 1, 2, 3, 1, 4], fingers: [0, 1, 2, 3, 1, 4], barreFrom: 1, barreTo: 4, barreFret: 1 },
    { frets: [-1, 3, -1, 3, 5, 4], fingers: [0, 1, 0, 2, 4, 3] },
    { frets: [-1, 3, 6, 3, 5, 4], fingers: [0, 1, 4, 1, 3, 2], barreFrom: 1, barreTo: 3, barreFret: 3 },
    { frets: [-1, -1, 6, 5, 5, 6], fingers: [0, 0, 2, 1, 1, 3], barreFrom: 3, barreTo: 4, barreFret: 5 },
  ],
  "7♭9": [
    { frets: [-1, 3, 2, 3, 2, 3], fingers: [0, 2, 1, 3, 1, 4], barreFrom: 2, barreTo: 4, barreFret: 2 },
    { frets: [-1, -1, 8, 6, 5, 8], fingers: [0, 0, 3, 2, 1, 4] },
    { frets: [8, 10, 8, 9, 8, 9], fingers: [1, 4, 1, 2, 1, 3], barreFrom: 0, barreTo: 4, barreFret: 8 },
    { frets: [-1, -1, 10, 9, 11, 9], fingers: [0, 0, 2, 1, 3, 1], barreFrom: 3, barreTo: 5, barreFret: 9 },
    { frets: [9, 10, 10, 9, 11, 9], fingers: [1, 2, 3, 1, 4, 1], barreFrom: 0, barreTo: 5, barreFret: 9 },
  ],
  "7#9": [
    { frets: [-1, 3, 2, 3, 4, -1], fingers: [0, 2, 1, 3, 4, 0] },
    { frets: [8, 10, 8, 9, 11, 11], fingers: [1, 3, 1, 2, 4, 4], barreFrom: 0, barreTo: 2, barreFret: 8 },
  ],
  "7(♭5,♭9)": [
    { frets: [-1, 3, 2, 3, 2, 2], fingers: [0, 2, 1, 3, 1, 1], barreFrom: 2, barreTo: 5, barreFret: 2 },
    { frets: [8, -1, 8, 6, 7, -1], fingers: [3, 0, 4, 1, 2, 0] },
  ],
  "7(♭5,#9)": [
    { frets: [-1, 3, 2, 3, 4, 2], fingers: [0, 2, 1, 3, 4, 1], barreFrom: 2, barreTo: 5, barreFret: 2 },
  ],
  "7(#5,♭9)": [
    { frets: [-1, 3, 2, 3, 2, 4], fingers: [0, 2, 1, 3, 1, 4], barreFrom: 2, barreTo: 4, barreFret: 2 },
    { frets: [8, -1, 8, 9, 9, 9], fingers: [1, 0, 2, 4, 4, 4], barreFrom: 3, barreTo: 5, barreFret: 9 },
  ],
  "7(#5,#9)": [
    { frets: [-1, 3, 2, 3, 4, 4], fingers: [0, 2, 1, 3, 4, 4], barreFrom: 4, barreTo: 5, barreFret: 4 },
  ],
  "9♭5": [
    { frets: [-1, 3, 2, 3, 3, 2], fingers: [0, 2, 1, 3, 4, 1], barreFrom: 2, barreTo: 5, barreFret: 2 },
    { frets: [8, 7, 8, 7, 7, -1], fingers: [2, 1, 3, 1, 1, 0], barreFrom: 1, barreTo: 4, barreFret: 7 },
  ],
  "9#5": [
    { frets: [-1, 3, 2, 3, 3, 4], fingers: [0, 2, 1, 3, 3, 4], barreFrom: 3, barreTo: 4, barreFret: 3 },
    { frets: [8, -1, 8, 9, 9, 10], fingers: [0, 0, 1, 2, 3, 4] },
  ],
  "13#11": [
    { frets: [-1, 3, 4, 3, 5, 5], fingers: [0, 1, 2, 1, 3, 4], barreFrom: 1, barreTo: 3, barreFret: 3 },
    { frets: [8, 9, 8, 9, 10, 10], fingers: [1, 2, 1, 3, 4, 4], barreFrom: 0, barreTo: 2, barreFret: 8 },
  ],
  "13♭9": [
    { frets: [-1, 3, 2, 3, 2, 5], fingers: [0, 2, 1, 3, 1, 4], barreFrom: 2, barreTo: 4, barreFret: 2 },
    { frets: [8, -1, 8, 6, 5, 5], fingers: [3, 0, 4, 2, 1, 1], barreFrom: 4, barreTo: 5, barreFret: 5 },
    { frets: [8, -1, 8, 9, 10, 9], fingers: [0, 0, 1, 2, 4, 3] },
  ],
  "11♭9": [
    { frets: [-1, 3, 3, 3, 2, -1], fingers: [0, 2, 3, 4, 1, 0] },
    { frets: [8, -1, 8, 6, 6, -1], fingers: [3, 0, 4, 1, 1, 0], barreFrom: 3, barreTo: 4, barreFret: 6 },
    { frets: [-1, -1, 10, 10, 11, 9], fingers: [0, 0, 2, 3, 4, 1] },
  ],
  "Sus2Sus4": [
    { frets: [-1, 3, 3, 5, 3, 3], fingers: [0, 1, 1, 4, 1, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    { frets: [8, 8, 10, 10, 8, 10], fingers: [1, 1, 2, 3, 1, 4], barreFrom: 0, barreTo: 4, barreFret: 8 },
    { frets: [-1, -1, 10, 10, 13, 10], fingers: [0, 0, 1, 1, 4, 1], barreFrom: 2, barreTo: 5, barreFret: 10 },
  ],
};

/** Open-position shapes, fixed to the listed root. */
export const OPEN_SHAPES: Record<string, Record<string, LibraryVoicing[]>> = {
  'C': {
    "Power (5)": [
      { frets: [-1, -1, -1, 0, 1, -1], fingers: [0, 0, 0, 0, 1, 0] },
    ],
    "Dominant 7": [
      { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
    ],
    "Major": [
      { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    ],
    "Minor": [
      { frets: [-1, 3, 1, 0, 1, 3], fingers: [0, 3, 1, 0, 2, 4] },
    ],
    "Augmented": [
      { frets: [-1, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
      { frets: [-1, -1, 2, 1, 1, 0], fingers: [0, 0, 3, 1, 2, 0] },
    ],
    "Sus4": [
      { frets: [-1, 3, 3, 0, 1, -1], fingers: [0, 3, 4, 0, 1, 0] },
    ],
    "Madd9": [
      { frets: [-1, 3, 1, 0, 3, -1], fingers: [0, 3, 1, 0, 4, 0] },
    ],
  },
  'D': {
    "Power (5)": [
      { frets: [-1, -1, 0, 2, 3, -1], fingers: [0, 0, 0, 1, 2, 0] },
    ],
    "Major 6": [
      { frets: [-1, -1, 0, 2, 0, 2], fingers: [0, 0, 0, 1, 0, 2] },
    ],
    "Dominant 7": [
      { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
    ],
    "Dominant 9": [
      { frets: [0, 0, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
    ],
    "Major": [
      { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
    ],
    "Minor": [
      { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
    ],
    "Dim 7": [
      { frets: [-1, -1, 0, 1, 0, 1], fingers: [0, 0, 0, 1, 0, 2] },
    ],
    "Augmented": [
      { frets: [-1, -1, 0, 3, 3, 2], fingers: [0, 0, 0, 2, 3, 1] },
    ],
    "Sus2": [
      { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
    ],
    "Sus4": [
      { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
    ],
    "Major 7": [
      { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1], barreFrom: 3, barreTo: 5, barreFret: 2 },
    ],
    "Minor 7": [
      { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 3, 1, 2] },
    ],
    "7sus4": [
      { frets: [-1, -1, 0, 2, 1, 3], fingers: [0, 0, 0, 2, 1, 4] },
    ],
    "Major 9": [
      { frets: [-1, -1, 0, 2, 2, 0], fingers: [0, 0, 0, 2, 3, 0] },
    ],
    "Major 7♭5": [
      { frets: [-1, -1, 0, 1, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
    ],
    "Minor 6": [
      { frets: [-1, -1, 0, 2, 0, 1], fingers: [0, 0, 0, 2, 0, 1] },
    ],
    "Minor 11": [
      { frets: [-1, -1, 0, 0, 1, 1], fingers: [0, 0, 0, 0, 2, 3] },
    ],
    "Min/Maj 7": [
      { frets: [-1, -1, 0, 2, 2, 1], fingers: [0, 0, 0, 2, 3, 1] },
    ],
    "Half-Dim 7": [
      { frets: [-1, -1, 0, 1, 1, 1], fingers: [0, 0, 0, 1, 1, 1], barreFrom: 3, barreTo: 5, barreFret: 1 },
    ],
    "7♭5": [
      { frets: [-1, -1, 0, 1, 1, 2], fingers: [0, 0, 0, 1, 2, 4] },
    ],
    "Sus2Sus4": [
      { frets: [-1, -1, 0, 0, 3, 0], fingers: [0, 0, 0, 0, 1, 0] },
    ],
  },
  'E': {
    "Power (5)": [
      { frets: [0, 2, -1, -1, -1, -1], fingers: [0, 1, 0, 0, 0, 0] },
    ],
    "Major 6": [
      { frets: [-1, 2, 2, 1, 2, 0], fingers: [0, 2, 3, 1, 4, 0] },
    ],
    "Dominant 7": [
      { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
    ],
    "Dominant 9": [
      { frets: [0, 2, 0, 1, 0, 2], fingers: [0, 2, 0, 1, 0, 4] },
    ],
    "13": [
      { frets: [0, -1, 0, 1, 2, -1], fingers: [0, 0, 0, 1, 2, 0] },
    ],
    "Major": [
      { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
    ],
    "Minor": [
      { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
    ],
    "Diminished": [
      { frets: [0, 1, 2, 0, -1, -1], fingers: [0, 1, 2, 0, 0, 0] },
    ],
    "Dim 7": [
      { frets: [-1, 1, 2, 0, 2, -1], fingers: [0, 1, 2, 0, 3, 0] },
    ],
    "Augmented": [
      { frets: [0, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
    ],
    "Sus4": [
      { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 1, 1, 0, 0], barreFrom: 1, barreTo: 3, barreFret: 2 },
    ],
    "Major 7": [
      { frets: [0, -1, 1, 1, 0, -1], fingers: [0, 0, 2, 3, 0, 0] },
    ],
    "Minor 7": [
      { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 1, 0, 0, 0, 0] },
    ],
    "7sus4": [
      { frets: [0, 2, 0, 2, 0, 0], fingers: [0, 1, 0, 2, 0, 0] },
    ],
    "Maj13": [
      { frets: [0, -1, 1, 1, 2, 2], fingers: [0, 0, 1, 1, 2, 2], barreFrom: 2, barreTo: 3, barreFret: 1 },
    ],
    "Major 7#5": [
      { frets: [0, -1, 1, 1, 1, -1], fingers: [0, 0, 1, 1, 1, 0], barreFrom: 2, barreTo: 4, barreFret: 1 },
    ],
    "Minor 6": [
      { frets: [0, 2, 2, 0, 2, 0], fingers: [0, 2, 3, 0, 4, 0] },
    ],
    "Minor 9": [
      { frets: [0, -1, 0, 0, 0, 2], fingers: [0, 0, 0, 0, 0, 1] },
    ],
    "Minor 11": [
      { frets: [0, 0, 0, 0, 0, 0], fingers: [0, 0, 0, 0, 0, 0] },
    ],
    "Minor 13": [
      { frets: [0, 2, 0, 0, 2, 2], fingers: [0, 2, 0, 0, 3, 4] },
    ],
    "m6add9": [
      { frets: [-1, -1, 2, 0, 2, 2], fingers: [0, 0, 2, 0, 3, 4] },
    ],
    "Min/Maj 7": [
      { frets: [0, 2, 1, 0, 0, 0], fingers: [0, 2, 1, 0, 0, 0] },
    ],
    "mMaj9": [
      { frets: [0, 2, 1, 0, 0, 2], fingers: [0, 2, 1, 0, 0, 3] },
    ],
    "Half-Dim 7": [
      { frets: [0, 1, 0, 0, 3, 0], fingers: [0, 1, 0, 0, 4, 0] },
    ],
    "m7#5": [
      { frets: [0, -1, 0, 0, 1, -1], fingers: [0, 0, 0, 0, 1, 0] },
    ],
    "7#5": [
      { frets: [0, -1, 0, 1, 1, -1], fingers: [0, 0, 0, 2, 3, 0] },
    ],
    "7♭9": [
      { frets: [0, 2, 0, 1, 0, 1], fingers: [0, 4, 0, 1, 0, 2] },
    ],
    "7#9": [
      { frets: [0, 2, 0, 1, 3, 3], fingers: [0, 2, 0, 1, 3, 4] },
    ],
    "7(#5,♭9)": [
      { frets: [0, -1, 0, 1, 1, 1], fingers: [0, 0, 0, 1, 1, 1], barreFrom: 3, barreTo: 5, barreFret: 1 },
    ],
    "9#5": [
      { frets: [0, -1, 0, 1, 1, 2], fingers: [0, 0, 0, 1, 2, 4] },
    ],
    "13#11": [
      { frets: [0, 1, 0, 1, 2, 2], fingers: [0, 1, 0, 2, 3, 4] },
    ],
    "13♭9": [
      { frets: [0, -1, 0, 1, 2, 1], fingers: [0, 0, 0, 1, 3, 2] },
    ],
    "Sus2Sus4": [
      { frets: [0, 0, 2, 2, 0, 2], fingers: [0, 0, 2, 3, 0, 4] },
    ],
  },
  'A': {
    "Power (5)": [
      { frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 2, 3, 0, 0] },
    ],
    "Major 6": [
      { frets: [-1, 0, 2, 2, 2, 2], fingers: [0, 0, 1, 1, 1, 1], barreFrom: 2, barreTo: 5, barreFret: 2 },
    ],
    "Dominant 7": [
      { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
    ],
    "11": [
      { frets: [-1, 0, 0, 0, 0, 0], fingers: [0, 0, 0, 0, 0, 0] },
    ],
    "Major": [
      { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
    ],
    "Minor": [
      { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
    ],
    "Diminished": [
      { frets: [-1, 0, 1, 2, 1, -1], fingers: [0, 0, 1, 3, 2, 0] },
    ],
    "Augmented": [
      { frets: [-1, 0, 3, 2, 2, 1], fingers: [0, 0, 4, 2, 3, 1] },
    ],
    "Sus2": [
      { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 2, 3, 0, 0] },
    ],
    "Sus4": [
      { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 4, 0] },
    ],
    "Major 7": [
      { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
    ],
    "Minor 7": [
      { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
    ],
    "7sus4": [
      { frets: [-1, 0, 2, 0, 3, 0], fingers: [0, 0, 2, 0, 4, 0] },
    ],
    "Major 9": [
      { frets: [-1, 0, 2, 1, 0, 0], fingers: [0, 0, 2, 1, 0, 0] },
    ],
    "Maj13": [
      { frets: [-1, 0, -1, 1, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
    ],
    "Major 7#5": [
      { frets: [-1, 0, -1, 1, 2, 1], fingers: [0, 0, 0, 1, 3, 2] },
    ],
    "Minor 11": [
      { frets: [-1, 0, 0, 0, 1, 0], fingers: [0, 0, 0, 0, 1, 0] },
    ],
    "Minor 13": [
      { frets: [-1, 0, 2, 0, 1, 2], fingers: [0, 0, 2, 0, 1, 3] },
    ],
    "Min/Maj 7": [
      { frets: [-1, 0, 2, 1, 1, 0], fingers: [0, 0, 3, 1, 2, 0] },
    ],
    "Half-Dim 7": [
      { frets: [-1, 0, 1, 0, 1, -1], fingers: [0, 0, 1, 0, 2, 0] },
    ],
    "m7#5": [
      { frets: [-1, 0, -1, 0, 1, 1], fingers: [0, 0, 0, 0, 2, 3] },
    ],
    "7♭5": [
      { frets: [-1, 0, 1, 0, 2, -1], fingers: [0, 0, 2, 0, 4, 0] },
    ],
    "7#5": [
      { frets: [-1, 0, -1, 0, 2, 1], fingers: [0, 0, 0, 0, 2, 1] },
    ],
    "13#11": [
      { frets: [-1, 0, 1, 0, 2, 2], fingers: [0, 0, 1, 0, 2, 3] },
    ],
    "Sus2Sus4": [
      { frets: [-1, 0, 0, 2, 0, 0], fingers: [0, 0, 0, 1, 0, 0] },
    ],
  },
  'G': {
    "Power (5)": [
      { frets: [-1, -1, 0, 0, -1, -1], fingers: [0, 0, 0, 0, 0, 0] },
    ],
    "Major 6": [
      { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 1, 0, 0, 0, 0] },
    ],
    "Dominant 7": [
      { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
    ],
    "Dominant 9": [
      { frets: [-1, 0, 0, 0, 0, 1], fingers: [0, 0, 0, 0, 0, 1] },
    ],
    "Major": [
      { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
    ],
    "Dim 7": [
      { frets: [-1, 1, 2, 0, 2, -1], fingers: [0, 1, 2, 0, 3, 0] },
    ],
    "Augmented": [
      { frets: [3, 2, 1, 0, 0, 3], fingers: [3, 2, 1, 0, 0, 4] },
    ],
    "Major 7": [
      { frets: [-1, 2, 0, 0, 0, 2], fingers: [0, 2, 0, 0, 0, 3] },
    ],
    "6add9": [
      { frets: [3, -1, 2, 2, 0, -1], fingers: [3, 0, 1, 2, 0, 0] },
    ],
    "Major 7#5": [
      { frets: [-1, 2, 1, 0, 0, 2], fingers: [0, 2, 1, 0, 0, 3] },
    ],
    "Minor 6": [
      { frets: [0, 1, 0, 0, 3, 0], fingers: [0, 1, 0, 0, 4, 0] },
    ],
    "7#5": [
      { frets: [-1, -1, 1, 0, 0, 1], fingers: [0, 0, 1, 0, 0, 2] },
    ],
    "7♭9": [
      { frets: [-1, -1, 3, 1, 0, 3], fingers: [0, 0, 3, 1, 0, 4] },
    ],
  },
};

function transpose(v: LibraryVoicing, semitones: number): LibraryVoicing | null {
  let frets = v.frets.map(f => (f < 0 ? -1 : f + semitones));
  let barreFret = v.barreFret != null ? v.barreFret + semitones : undefined;
  const fretted = frets.filter(f => f > 0);
  if (fretted.length && Math.min(...fretted) >= 12) {
    frets = frets.map(f => (f > 0 ? f - 12 : f));
    if (barreFret != null) barreFret -= 12;
  }
  const played = frets.filter(f => f > 0);
  if (played.length && Math.max(...played) > 17) return null;
  return { frets, fingers: v.fingers, barreFrom: v.barreFrom, barreTo: v.barreTo, barreFret };
}

/** Build the full curated library: every movable shape in all 12 keys + open shapes. */
export function buildCuratedVoicings(): Record<string, Record<string, LibraryVoicing[]>> {
  const out: Record<string, Record<string, LibraryVoicing[]>> = {};
  NOTES.forEach((root, semitones) => {
    const byType: Record<string, LibraryVoicing[]> = {};
    for (const [chordType, shapes] of Object.entries(MOVABLE_SHAPES)) {
      const list = shapes
        .map(s => transpose(s, semitones))
        .filter((s): s is LibraryVoicing => s !== null);
      if (list.length) byType[chordType] = list;
    }
    const open = OPEN_SHAPES[root as Note];
    if (open) {
      for (const [chordType, shapes] of Object.entries(open)) {
        byType[chordType] = [...shapes, ...(byType[chordType] ?? [])];
      }
    }
    // Lowest shapes first so the nut-position voicings lead each list.
    for (const list of Object.values(byType)) {
      list.sort((a, b) => {
        const lo = (v: LibraryVoicing) => {
          const f = v.frets.filter(x => x > 0);
          return f.length ? Math.min(...f) : 0;
        };
        return lo(a) - lo(b);
      });
    }
    out[root] = byType;
  });
  return out;
}
