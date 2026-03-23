export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = typeof NOTE_NAMES[number];

export const NOTE_CSS_KEYS: Record<NoteName, string> = {
  'C': '--note-c', 'C#': '--note-cs', 'D': '--note-d', 'D#': '--note-ds',
  'E': '--note-e', 'F': '--note-f', 'F#': '--note-fs', 'G': '--note-g',
  'G#': '--note-gs', 'A': '--note-a', 'A#': '--note-as', 'B': '--note-b',
};

export const STANDARD_TUNING = [4, 9, 2, 7, 11, 4]; // E A D G B E
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

// ============================================================
// SCALE FORMULAS + DESCRIPTIONS
// ============================================================

export const SCALE_FORMULAS: Record<string, number[]> = {
  // Major modes
  'Major (Ionian)': [0, 2, 4, 5, 7, 9, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Natural Minor (Aeolian)': [0, 2, 3, 5, 7, 8, 10],
  'Locrian': [0, 1, 3, 5, 6, 8, 10],
  // Harmonic minor modes
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Locrian ♮6': [0, 1, 3, 5, 6, 9, 10],
  'Ionian #5': [0, 2, 4, 5, 8, 9, 11],
  'Dorian #4': [0, 2, 3, 6, 7, 9, 10],
  'Phrygian Dominant': [0, 1, 4, 5, 7, 8, 10],
  'Lydian #2': [0, 3, 4, 6, 7, 9, 11],
  'Superlocrian ♭♭7': [0, 1, 3, 4, 6, 8, 9],
  // Melodic minor modes
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
  'Dorian ♭2': [0, 1, 3, 5, 7, 9, 10],
  'Lydian Augmented': [0, 2, 4, 6, 8, 9, 11],
  'Lydian Dominant': [0, 2, 4, 6, 7, 9, 10],
  'Mixolydian ♭6': [0, 2, 4, 5, 7, 8, 10],
  'Locrian ♮2': [0, 2, 3, 5, 6, 8, 10],
  'Superlocrian (Altered)': [0, 1, 3, 4, 6, 8, 10],
  // Pentatonic & Blues
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Blues Major': [0, 2, 3, 4, 7, 9],
  // Symmetric
  'Whole Tone': [0, 2, 4, 6, 8, 10],
  'Diminished (HW)': [0, 1, 3, 4, 6, 7, 9, 10],
  'Diminished (WH)': [0, 2, 3, 5, 6, 8, 9, 11],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  // Exotic
  'Hungarian Minor': [0, 2, 3, 6, 7, 8, 11],
  'Neapolitan Minor': [0, 1, 3, 5, 7, 8, 11],
  'Neapolitan Major': [0, 1, 3, 5, 7, 9, 11],
  'Double Harmonic Major': [0, 1, 4, 5, 7, 8, 11],
  'Enigmatic': [0, 1, 4, 6, 8, 10, 11],
  'Hirajoshi': [0, 4, 6, 7, 11],
  'In Sen': [0, 1, 5, 7, 10],
  'Kumoi': [0, 2, 3, 7, 9],
  'Bebop Dominant': [0, 2, 4, 5, 7, 9, 10, 11],
  'Bebop Major': [0, 2, 4, 5, 7, 8, 9, 11],
};

export const SCALE_DESCRIPTIONS: Record<string, string> = {
  'Major (Ionian)': 'The foundation of Western music. Bright, happy sound. Use over major chords and progressions.',
  'Dorian': 'Minor scale with a bright ♮6. Essential for jazz, funk, and blues over minor 7th chords.',
  'Phrygian': 'Dark, Spanish/flamenco sound. The ♭2 gives it an exotic, tense quality. Great over sus♭9 chords.',
  'Lydian': 'Dreamy, floating quality from the #4. Used in film scores and jazz over maj7#11 chords.',
  'Mixolydian': 'Bluesy major sound with ♭7. Perfect for dominant 7th chords, rock, and blues.',
  'Natural Minor (Aeolian)': 'The standard minor scale. Sad, melancholic. Foundation for minor key music.',
  'Locrian': 'The darkest mode with ♭2 and ♭5. Used over half-diminished (m7♭5) chords in jazz.',
  'Harmonic Minor': 'Minor with a raised 7th creating a leading tone. Gives a classical/Middle Eastern sound.',
  'Locrian ♮6': '2nd mode of harmonic minor. Dark with a natural 6th. Used over m7♭5 in minor ii-V-i.',
  'Ionian #5': '3rd mode of harmonic minor. Major scale with augmented 5th. Unusual, ethereal quality.',
  'Dorian #4': '4th mode of harmonic minor. Dorian with a raised 4th. Used over minor chords in harmonic minor keys.',
  'Phrygian Dominant': '5th mode of harmonic minor. Sounds Middle Eastern/Jewish. Use over dominant chords resolving to minor.',
  'Lydian #2': '6th mode of harmonic minor. Very bright, unusual augmented 2nd.',
  'Superlocrian ♭♭7': '7th mode of harmonic minor. Extremely dark, diminished quality.',
  'Melodic Minor': 'Jazz minor — minor with ♮6 and ♮7. Smooth ascending sound, huge in jazz improvisation.',
  'Dorian ♭2': '2nd mode of melodic minor. Phrygian with natural 6th. Used in modern jazz.',
  'Lydian Augmented': '3rd mode of melodic minor. Lydian with #5. Bright, expansive, otherworldly.',
  'Lydian Dominant': '4th mode of melodic minor. Lydian with ♭7. Perfect for dominant 7#11 chords. Used by Coltrane.',
  'Mixolydian ♭6': '5th mode of melodic minor. Also called "Hindu scale." Dark dominant sound.',
  'Locrian ♮2': '6th mode of melodic minor. Half-diminished with natural 2nd. Common in jazz over m7♭5.',
  'Superlocrian (Altered)': '7th mode of melodic minor. THE altered scale. Essential over altered dominant chords (7#9, 7♭9, 7#5, 7♭5).',
  'Pentatonic Major': 'The most versatile scale. 5 notes, no avoid notes. Works over almost any major context.',
  'Pentatonic Minor': 'The rock/blues workhorse. 5 notes of pure minor energy. Every guitarist\'s first scale.',
  'Blues': 'Minor pentatonic + ♭5 "blue note." The soul of blues, rock, and jazz guitar.',
  'Blues Major': 'Major pentatonic with chromatic passing tones. Sweet, soulful blues sound.',
  'Whole Tone': 'All whole steps — symmetrical, dreamy, floating. Used over augmented and dominant 7#5 chords.',
  'Diminished (HW)': 'Half-whole pattern. Used over diminished 7th chords. Symmetric — only 3 unique transpositions.',
  'Diminished (WH)': 'Whole-half pattern. Used over dominant 7th chords for a "diminished dominant" sound.',
  'Chromatic': 'All 12 notes. Use for chromatic runs and passing tones.',
  'Hungarian Minor': 'Like harmonic minor with #4. Very dramatic, Eastern European sound.',
  'Neapolitan Minor': 'Minor with ♭2 and major 7th. Dark, classical character.',
  'Neapolitan Major': 'Major with ♭2. Used in Neapolitan chord contexts. Bittersweet quality.',
  'Double Harmonic Major': 'Also "Byzantine scale." ♭2 and ♭6 create an intense Middle Eastern sound.',
  'Enigmatic': 'Rare, atonal scale created by Verdi. ♭2, ♮3, #4, #5, #6, ♮7. Very unusual.',
  'Hirajoshi': 'Japanese pentatonic scale. Haunting, beautiful. Used in ambient and world music.',
  'In Sen': 'Japanese scale with dark, contemplative mood. ♭2 gives it tension.',
  'Kumoi': 'Japanese pentatonic. Gentle, wistful quality. Great for ambient passages.',
  'Bebop Dominant': 'Mixolydian + passing natural 7th. Keeps chord tones on strong beats. Essential for bebop.',
  'Bebop Major': 'Major scale + chromatic passing tone. Smooth bebop lines.',
};

// ============================================================
// CHORD FORMULAS
// ============================================================

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
  'Aug 7': [0, 4, 8, 10],
  'Add9': [0, 4, 7, 14],
  'Major 9': [0, 4, 7, 11, 14],
  'Minor 9': [0, 3, 7, 10, 14],
  'Dominant 9': [0, 4, 7, 10, 14],
  'Major 6': [0, 4, 7, 9],
  'Minor 6': [0, 3, 7, 9],
  '7sus4': [0, 5, 7, 10],
  '7#9': [0, 4, 7, 10, 15],
  '7♭9': [0, 4, 7, 10, 13],
  '7#5': [0, 4, 8, 10],
  '7♭5': [0, 4, 6, 10],
  '11': [0, 4, 7, 10, 17],
  'Minor 11': [0, 3, 7, 10, 17],
  '13': [0, 4, 7, 10, 21],
  'Minor 13': [0, 3, 7, 10, 21],
  'Power (5)': [0, 7],
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

// ============================================================
// CHORD GROUPING for display
// ============================================================

export const CHORD_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Major 3rd', types: ['Major', 'Major 7', 'Dominant 7', 'Augmented', 'Aug 7', 'Add9', 'Major 9', 'Dominant 9', 'Major 6', '7#9', '7♭9', '7#5', '7♭5', '11', '13'] },
  { label: 'Minor 3rd', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'] },
  { label: 'Suspended', types: ['Sus2', 'Sus4', '7sus4', 'Power (5)'] },
];

// ============================================================
// CURATED CHORD VOICINGS (verified, human-playable, max 4-fret span)
// Format: [lowE, A, D, G, B, highE] where -1 = muted, 0 = open
// Fingering: [lowE, A, D, G, B, highE] where 0 = open/muted, 1-4 = finger index, 'B' = barre
// ============================================================

export interface ChordVoicing {
  frets: number[];
  fingers?: (number | 'B' | 0)[];
  barreFrom?: number; // string index where barre starts
  barreTo?: number;   // string index where barre ends
  barreFret?: number; // fret of the barre
}

export const CURATED_VOICINGS: Record<string, Record<string, ChordVoicing[]>> = {
  'C': {
    'Major': [
      { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
      { frets: [-1, 3, 5, 5, 5, 3], fingers: [0, 1, 0, 0, 0, 0], barreFrom: 1, barreTo: 5, barreFret: 3 },
      { frets: [8, 10, 10, 9, 8, 8], fingers: [0, 3, 4, 2, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 8 },
    ],
    'Minor': [
      { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
      { frets: [8, 10, 10, 8, 8, 8], fingers: [0, 3, 4, 0, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 8 },
    ],
    'Major 7': [
      { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
      { frets: [-1, 3, 5, 4, 5, 3], fingers: [0, 1, 3, 2, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    ],
    'Minor 7': [
      { frets: [-1, 3, 5, 3, 4, 3], fingers: [0, 1, 3, 1, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
      { frets: [-1, 3, 1, 3, 1, 3], fingers: [0, 2, 1, 3, 1, 4] },
    ],
    'Dominant 7': [
      { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
      { frets: [-1, 3, 5, 3, 5, 3], fingers: [0, 1, 2, 1, 3, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    ],
    'Diminished': [
      { frets: [-1, 3, 4, 2, 4, 2], fingers: [0, 1, 3, 1, 4, 1] },
    ],
    'Augmented': [
      { frets: [-1, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
    ],
    'Sus2': [
      { frets: [-1, 3, 5, 5, 3, 3], fingers: [0, 1, 3, 4, 1, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    ],
    'Sus4': [
      { frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 2, 3, 0, 1, 1] },
      { frets: [-1, 3, 5, 5, 6, 3], fingers: [0, 1, 2, 3, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 3 },
    ],
    'Dim 7': [
      { frets: [-1, 3, 4, 2, 4, 2], fingers: [0, 1, 3, 1, 4, 1] },
    ],
    'Half-Dim 7': [
      { frets: [-1, 3, 4, 3, 4, -1], fingers: [0, 1, 3, 2, 4, 0] },
    ],
    'Major 9': [
      { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
    ],
    'Dominant 9': [
      { frets: [-1, 3, 2, 3, 3, 0], fingers: [0, 2, 1, 3, 4, 0] },
    ],
    'Minor 9': [
      { frets: [-1, 3, 1, 3, 3, 3], fingers: [0, 2, 1, 3, 3, 4] },
    ],
    'Add9': [
      { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
    ],
    'Major 6': [
      { frets: [-1, 3, 2, 2, 1, 0], fingers: [0, 4, 2, 3, 1, 0] },
    ],
    'Minor 6': [
      { frets: [-1, 3, 1, 2, 1, 3], fingers: [0, 3, 1, 2, 1, 4] },
    ],
    '7sus4': [
      { frets: [-1, 3, 3, 3, 1, 1], fingers: [0, 2, 3, 4, 1, 1] },
    ],
    '7#9': [
      { frets: [-1, 3, 2, 3, 4, -1], fingers: [0, 2, 1, 3, 4, 0] },
    ],
    '7♭9': [
      { frets: [-1, 3, 2, 3, 2, -1], fingers: [0, 2, 1, 3, 1, 0] },
    ],
  },
  'D': {
    'Major': [
      { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
      { frets: [-1, 5, 7, 7, 7, 5], fingers: [0, 1, 3, 3, 3, 1], barreFrom: 1, barreTo: 5, barreFret: 5 },
    ],
    'Minor': [
      { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
      { frets: [-1, 5, 7, 7, 6, 5], fingers: [0, 1, 3, 4, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 5 },
    ],
    'Major 7': [
      { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
    ],
    'Minor 7': [
      { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 3, 1, 1] },
    ],
    'Dominant 7': [
      { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
    ],
    'Diminished': [
      { frets: [-1, -1, 0, 1, 0, 1], fingers: [0, 0, 0, 1, 0, 2] },
    ],
    'Augmented': [
      { frets: [-1, -1, 0, 3, 3, 2], fingers: [0, 0, 0, 2, 3, 1] },
    ],
    'Sus2': [
      { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
    ],
    'Sus4': [
      { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
    ],
    'Add9': [
      { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
    ],
    'Major 6': [
      { frets: [-1, -1, 0, 2, 0, 2], fingers: [0, 0, 0, 1, 0, 2] },
    ],
    'Minor 6': [
      { frets: [-1, -1, 0, 2, 0, 1], fingers: [0, 0, 0, 2, 0, 1] },
    ],
    'Dim 7': [
      { frets: [-1, -1, 0, 1, 0, 1], fingers: [0, 0, 0, 1, 0, 2] },
    ],
    'Half-Dim 7': [
      { frets: [-1, -1, 0, 1, 1, 1], fingers: [0, 0, 0, 1, 2, 3] },
    ],
    'Dominant 9': [
      { frets: [-1, -1, 0, 2, 1, 0], fingers: [0, 0, 0, 2, 1, 0] },
    ],
  },
  'E': {
    'Major': [
      { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
      { frets: [-1, 7, 9, 9, 9, 7], fingers: [0, 1, 3, 3, 3, 1], barreFrom: 1, barreTo: 5, barreFret: 7 },
    ],
    'Minor': [
      { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
      { frets: [-1, 7, 9, 9, 8, 7], fingers: [0, 1, 3, 4, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 7 },
    ],
    'Major 7': [
      { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
    ],
    'Minor 7': [
      { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 1, 0, 0, 0, 0] },
      { frets: [0, 2, 2, 0, 3, 0], fingers: [0, 1, 2, 0, 3, 0] },
    ],
    'Dominant 7': [
      { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
      { frets: [0, 2, 2, 1, 3, 0], fingers: [0, 1, 2, 1, 3, 0] },
    ],
    'Diminished': [
      { frets: [-1, -1, 2, 3, 2, 3], fingers: [0, 0, 1, 3, 2, 4] },
    ],
    'Augmented': [
      { frets: [0, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
    ],
    'Sus2': [
      { frets: [0, 2, 4, 4, 0, 0], fingers: [0, 1, 3, 4, 0, 0] },
    ],
    'Sus4': [
      { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 2, 3, 0, 0] },
    ],
    'Minor 9': [
      { frets: [0, 2, 0, 0, 0, 2], fingers: [0, 1, 0, 0, 0, 2] },
    ],
    'Dominant 9': [
      { frets: [0, 2, 0, 1, 0, 2], fingers: [0, 2, 0, 1, 0, 3] },
    ],
    'Add9': [
      { frets: [0, 2, 2, 1, 0, 2], fingers: [0, 2, 3, 1, 0, 4] },
    ],
    'Dim 7': [
      { frets: [-1, -1, 2, 3, 2, 3], fingers: [0, 0, 1, 3, 2, 4] },
    ],
    'Half-Dim 7': [
      { frets: [0, 1, 0, 0, 0, 0], fingers: [0, 1, 0, 0, 0, 0] },
    ],
    'Major 6': [
      { frets: [0, 2, 2, 1, 2, 0], fingers: [0, 2, 3, 1, 4, 0] },
    ],
    'Minor 6': [
      { frets: [0, 2, 2, 0, 2, 0], fingers: [0, 1, 2, 0, 3, 0] },
    ],
    '7#9': [
      { frets: [0, 2, 0, 1, 3, 3], fingers: [0, 1, 0, 2, 3, 4] },
    ],
  },
  'F': {
    'Major': [
      { frets: [1, 3, 3, 2, 1, 1], fingers: [0, 3, 4, 2, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 1 },
      { frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1] },
    ],
    'Minor': [
      { frets: [1, 3, 3, 1, 1, 1], fingers: [0, 3, 4, 0, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 1 },
    ],
    'Major 7': [
      { frets: [1, -1, 2, 2, 1, 0], fingers: [1, 0, 3, 4, 2, 0] },
      { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
    ],
    'Minor 7': [
      { frets: [1, 3, 1, 1, 1, 1], fingers: [0, 3, 0, 0, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 1 },
    ],
    'Dominant 7': [
      { frets: [1, 3, 1, 2, 1, 1], fingers: [0, 3, 0, 2, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 1 },
    ],
    'Diminished': [
      { frets: [1, 2, 3, 1, -1, -1], fingers: [1, 2, 4, 1, 0, 0] },
    ],
    'Augmented': [
      { frets: [-1, -1, 3, 2, 2, 1], fingers: [0, 0, 4, 2, 3, 1] },
    ],
    'Sus2': [
      { frets: [-1, -1, 3, 0, 1, 1], fingers: [0, 0, 3, 0, 1, 1] },
    ],
    'Sus4': [
      { frets: [1, 1, 3, 3, 1, 1], fingers: [0, 0, 3, 4, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 1 },
    ],
    'Dim 7': [
      { frets: [1, 2, 0, 1, 0, -1], fingers: [1, 3, 0, 2, 0, 0] },
    ],
    'Half-Dim 7': [
      { frets: [1, 2, 3, 1, -1, -1], fingers: [1, 2, 4, 1, 0, 0] },
    ],
  },
  'G': {
    'Major': [
      { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
      { frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4] },
      { frets: [3, 5, 5, 4, 3, 3], fingers: [0, 3, 4, 2, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 3 },
    ],
    'Minor': [
      { frets: [3, 5, 5, 3, 3, 3], fingers: [0, 3, 4, 0, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 3 },
    ],
    'Major 7': [
      { frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1] },
      { frets: [3, 5, 4, 4, 3, 3], fingers: [0, 3, 2, 1, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 3 },
    ],
    'Minor 7': [
      { frets: [3, 5, 3, 3, 3, 3], fingers: [0, 3, 0, 0, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 3 },
    ],
    'Dominant 7': [
      { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
      { frets: [3, 5, 3, 4, 3, 3], fingers: [0, 3, 0, 2, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 3 },
    ],
    'Diminished': [
      { frets: [-1, -1, 5, 6, 5, 6], fingers: [0, 0, 1, 3, 2, 4] },
    ],
    'Augmented': [
      { frets: [3, 2, 1, 0, 0, 3], fingers: [3, 2, 1, 0, 0, 4] },
    ],
    'Sus2': [
      { frets: [3, 0, 0, 0, 3, 3], fingers: [1, 0, 0, 0, 2, 3] },
    ],
    'Sus4': [
      { frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4] },
    ],
    'Dim 7': [
      { frets: [-1, -1, 5, 6, 5, 6], fingers: [0, 0, 1, 3, 2, 4] },
    ],
    'Half-Dim 7': [
      { frets: [-1, -1, 5, 6, 6, 6], fingers: [0, 0, 1, 2, 3, 4] },
    ],
    'Dominant 9': [
      { frets: [3, 2, 0, 2, 0, 1], fingers: [3, 2, 0, 4, 0, 1] },
    ],
    'Add9': [
      { frets: [3, 0, 0, 0, 0, 3], fingers: [2, 0, 0, 0, 0, 3] },
      { frets: [3, 2, 0, 2, 0, 3], fingers: [2, 1, 0, 3, 0, 4] },
    ],
    'Major 6': [
      { frets: [3, 2, 0, 0, 0, 0], fingers: [2, 1, 0, 0, 0, 0] },
    ],
    'Minor 6': [
      { frets: [3, 5, 5, 3, 3, 0], fingers: [1, 3, 4, 1, 1, 0], barreFrom: 0, barreTo: 4, barreFret: 3 },
    ],
  },
  'A': {
    'Major': [
      { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
      { frets: [5, 7, 7, 6, 5, 5], fingers: [0, 3, 4, 2, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 5 },
    ],
    'Minor': [
      { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
      { frets: [5, 7, 7, 5, 5, 5], fingers: [0, 3, 4, 0, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 5 },
    ],
    'Major 7': [
      { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
    ],
    'Minor 7': [
      { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
    ],
    'Dominant 7': [
      { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
    ],
    'Diminished': [
      { frets: [-1, 0, 1, 2, 1, -1], fingers: [0, 0, 1, 3, 2, 0] },
    ],
    'Augmented': [
      { frets: [-1, 0, 3, 2, 2, 1], fingers: [0, 0, 4, 2, 3, 1] },
    ],
    'Sus2': [
      { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
    ],
    'Sus4': [
      { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
    ],
    'Add9': [
      { frets: [-1, 0, 2, 4, 2, 0], fingers: [0, 0, 1, 4, 2, 0] },
    ],
    'Major 6': [
      { frets: [-1, 0, 2, 2, 2, 2], fingers: [0, 0, 1, 1, 1, 1] },
    ],
    'Minor 6': [
      { frets: [-1, 0, 2, 2, 1, 2], fingers: [0, 0, 2, 3, 1, 4] },
    ],
    'Dim 7': [
      { frets: [-1, 0, 1, 2, 1, 2], fingers: [0, 0, 1, 3, 2, 4] },
    ],
    'Half-Dim 7': [
      { frets: [-1, 0, 1, 2, 1, 0], fingers: [0, 0, 1, 3, 2, 0] },
    ],
    'Minor 9': [
      { frets: [-1, 0, 2, 0, 1, 2], fingers: [0, 0, 2, 0, 1, 3] },
    ],
    'Dominant 9': [
      { frets: [-1, 0, 2, 0, 2, 2], fingers: [0, 0, 1, 0, 2, 3] },
    ],
    '7#9': [
      { frets: [-1, 0, 2, 0, 2, 3], fingers: [0, 0, 1, 0, 2, 3] },
    ],
    '7♭9': [
      { frets: [-1, 0, 2, 0, 2, 1], fingers: [0, 0, 2, 0, 3, 1] },
    ],
    '11': [
      { frets: [-1, 0, 0, 0, 2, 0], fingers: [0, 0, 0, 0, 1, 0] },
    ],
    '7sus4': [
      { frets: [-1, 0, 2, 0, 3, 0], fingers: [0, 0, 1, 0, 2, 0] },
    ],
  },
  'B': {
    'Major': [
      { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 2 },
      { frets: [7, 9, 9, 8, 7, 7], fingers: [0, 3, 4, 2, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 7 },
    ],
    'Minor': [
      { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 2 },
      { frets: [7, 9, 9, 7, 7, 7], fingers: [0, 3, 4, 0, 0, 0], barreFrom: 0, barreTo: 5, barreFret: 7 },
    ],
    'Major 7': [
      { frets: [-1, 2, 4, 3, 4, 2], fingers: [0, 1, 3, 2, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 2 },
    ],
    'Minor 7': [
      { frets: [-1, 2, 0, 2, 0, 2], fingers: [0, 1, 0, 2, 0, 3] },
      { frets: [-1, 2, 4, 2, 3, 2], fingers: [0, 1, 3, 1, 2, 1], barreFrom: 1, barreTo: 5, barreFret: 2 },
    ],
    'Dominant 7': [
      { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
      { frets: [-1, 2, 4, 2, 4, 2], fingers: [0, 1, 3, 1, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 2 },
    ],
    'Diminished': [
      { frets: [-1, 2, 3, 4, 3, -1], fingers: [0, 1, 2, 4, 3, 0] },
    ],
    'Augmented': [
      { frets: [-1, 2, 1, 0, 0, 3], fingers: [0, 2, 1, 0, 0, 3] },
    ],
    'Sus2': [
      { frets: [-1, 2, 4, 4, 2, 2], fingers: [0, 1, 3, 4, 1, 1], barreFrom: 1, barreTo: 5, barreFret: 2 },
    ],
    'Sus4': [
      { frets: [-1, 2, 4, 4, 5, 2], fingers: [0, 1, 2, 3, 4, 1], barreFrom: 1, barreTo: 5, barreFret: 2 },
    ],
    'Dim 7': [
      { frets: [-1, 2, 3, 1, 3, 1], fingers: [0, 2, 3, 1, 4, 1] },
    ],
    'Half-Dim 7': [
      { frets: [-1, 2, 3, 2, 3, -1], fingers: [0, 1, 3, 2, 4, 0] },
    ],
  },
};

// Generate voicings for remaining roots by transposing
function transposeVoicing(frets: number[], semitones: number): number[] {
  return frets.map(f => {
    if (f <= 0) return f;
    return f + semitones;
  });
}

const ALL_ROOTS: NoteName[] = [...NOTE_NAMES];
const KNOWN_ROOTS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

for (const root of ALL_ROOTS) {
  if (CURATED_VOICINGS[root]) continue;
  CURATED_VOICINGS[root] = {};
  const rootIdx = NOTE_NAMES.indexOf(root);
  let baseRoot: NoteName | null = null;
  let semitoneOffset = 0;
  for (let offset = 1; offset <= 6; offset++) {
    const candidate = NOTE_NAMES[(rootIdx - offset + 12) % 12];
    if (CURATED_VOICINGS[candidate] && KNOWN_ROOTS.includes(candidate)) {
      baseRoot = candidate;
      semitoneOffset = offset;
      break;
    }
  }
  if (!baseRoot) continue;
  for (const [chordType, voicings] of Object.entries(CURATED_VOICINGS[baseRoot])) {
    CURATED_VOICINGS[root][chordType] = voicings
      .map(v => {
        const newFrets = transposeVoicing(v.frets, semitoneOffset);
        const fretted = newFrets.filter(f => f > 0);
        if (fretted.length > 0 && Math.max(...fretted) > 24) return null;
        if (fretted.length > 1 && Math.max(...fretted) - Math.min(...fretted) > 4) return null;
        return {
          frets: newFrets,
          fingers: v.fingers,
          barreFrom: v.barreFrom,
          barreTo: v.barreTo,
          barreFret: v.barreFret != null ? v.barreFret + semitoneOffset : undefined,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null) as ChordVoicing[];
  }
}

// ============================================================
// TRIAD VOICING GENERATOR (3 adjacent strings, ≤4 fret span)
// ============================================================

export function generateTriadVoicings(root: NoteName, chordType: string): ChordVoicing[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula || formula.length < 3) return [];
  const rootIdx = NOTE_NAMES.indexOf(root);
  const tones = formula.slice(0, 3).map(i => (rootIdx + i) % 12);
  const results: ChordVoicing[] = [];
  const seen = new Set<string>();

  // Try all groups of 3 adjacent strings
  for (let startStr = 0; startStr <= 3; startStr++) {
    const strings = [startStr, startStr + 1, startStr + 2];
    // Try all inversions
    for (let inv = 0; inv < 3; inv++) {
      const invTones = [...tones.slice(inv), ...tones.slice(0, inv)];
      for (let baseFret = 0; baseFret <= 14; baseFret++) {
        const voicing: number[] = [-1, -1, -1, -1, -1, -1];
        let valid = true;
        const playedFrets: number[] = [];
        for (let i = 0; i < 3; i++) {
          const s = strings[i];
          const target = invTones[i];
          let found = false;
          for (let f = Math.max(0, baseFret); f <= baseFret + 4; f++) {
            if (f > 24) break;
            if ((STANDARD_TUNING[s] + f) % 12 === target) {
              voicing[s] = f;
              playedFrets.push(f);
              found = true;
              break;
            }
          }
          if (!found) { valid = false; break; }
        }
        if (!valid) continue;
        const fretted = playedFrets.filter(f => f > 0);
        if (fretted.length > 1 && Math.max(...fretted) - Math.min(...fretted) > 4) continue;
        const key = voicing.join(',');
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ frets: voicing });
        }
      }
    }
  }

  // Sort: root in bass first, then by lowest fret
  results.sort((a, b) => {
    const aFirst = a.frets.findIndex(f => f >= 0);
    const bFirst = b.frets.findIndex(f => f >= 0);
    const aNote = aFirst >= 0 ? (STANDARD_TUNING[aFirst] + a.frets[aFirst]) % 12 : -1;
    const bNote = bFirst >= 0 ? (STANDARD_TUNING[bFirst] + b.frets[bFirst]) % 12 : -1;
    const aHasRoot = aNote === rootIdx % 12;
    const bHasRoot = bNote === rootIdx % 12;
    if (aHasRoot !== bHasRoot) return aHasRoot ? -1 : 1;
    const aMin = Math.min(...a.frets.filter(f => f >= 0));
    const bMin = Math.min(...b.frets.filter(f => f >= 0));
    return aMin - bMin;
  });

  return results.slice(0, 24);
}

// ============================================================
// VOICING GETTERS - curated only (no algorithmic fallback for full)
// ============================================================

export function getVoicingsForChord(root: NoteName, chordType: string, source: 'full' | 'shell' | 'drop2' | 'drop3' | 'triads'): ChordVoicing[] {
  if (source === 'triads') return generateTriadVoicings(root, chordType);
  if (source === 'full') {
    const curated = CURATED_VOICINGS[root]?.[chordType];
    return curated && curated.length > 0 ? curated : [];
  }
  if (source === 'shell') return generateShellVoicings(root, chordType);
  if (source === 'drop2') return generateDrop2Voicings(root, chordType);
  if (source === 'drop3') return generateDrop3Voicings(root, chordType);
  return [];
}

// ============================================================
// DROP 2 / DROP 3 / SHELL VOICING GENERATORS (kept, verified)
// ============================================================

export function generateDrop2Voicings(root: NoteName, chordType: string): ChordVoicing[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula || formula.length < 4) return [];
  const rootIdx = NOTE_NAMES.indexOf(root);
  const tones = formula.slice(0, 4).map(i => (rootIdx + i) % 12);
  const results: ChordVoicing[] = [];
  const seen = new Set<string>();
  const stringGroups = [[0,1,2,3], [1,2,3,4], [2,3,4,5]];
  for (let inv = 0; inv < 4; inv++) {
    const invTones = [...tones.slice(inv), ...tones.slice(0, inv)];
    const drop2 = [invTones[2], invTones[0], invTones[1], invTones[3]];
    for (const strings of stringGroups) {
      for (let baseFret = 0; baseFret <= 14; baseFret++) {
        const voicing: number[] = [-1, -1, -1, -1, -1, -1];
        let valid = true;
        const frets: number[] = [];
        for (let i = 0; i < 4; i++) {
          const s = strings[i];
          const target = drop2[i];
          let found = false;
          for (let f = Math.max(0, baseFret); f <= baseFret + 4; f++) {
            if ((STANDARD_TUNING[s] + f) % 12 === target) { voicing[s] = f; frets.push(f); found = true; break; }
          }
          if (!found) { valid = false; break; }
        }
        if (!valid) continue;
        const playedFrets = frets.filter(f => f > 0);
        if (playedFrets.length > 1 && Math.max(...playedFrets) - Math.min(...playedFrets) > 4) continue;
        // Verify extension notes present
        if (formula.length > 4) {
          const present = new Set<number>();
          voicing.forEach((f, i) => { if (f >= 0) present.add((STANDARD_TUNING[i] + f) % 12); });
          const extTone = (rootIdx + formula[formula.length - 1]) % 12;
          if (!present.has(extTone)) continue;
        }
        const key = voicing.join(',');
        if (!seen.has(key)) { seen.add(key); results.push({ frets: [...voicing] }); }
      }
    }
  }
  return results.slice(0, 20);
}

export function generateDrop3Voicings(root: NoteName, chordType: string): ChordVoicing[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula || formula.length < 4) return [];
  const rootIdx = NOTE_NAMES.indexOf(root);
  const tones = formula.slice(0, 4).map(i => (rootIdx + i) % 12);
  const results: ChordVoicing[] = [];
  const seen = new Set<string>();
  const stringGroups = [[0,1,3,4], [1,2,4,5], [0,1,4,5]];
  for (let inv = 0; inv < 4; inv++) {
    const invTones = [...tones.slice(inv), ...tones.slice(0, inv)];
    const drop3 = [invTones[1], invTones[0], invTones[2], invTones[3]];
    for (const strings of stringGroups) {
      for (let baseFret = 0; baseFret <= 14; baseFret++) {
        const voicing: number[] = [-1, -1, -1, -1, -1, -1];
        let valid = true;
        const frets: number[] = [];
        for (let i = 0; i < 4; i++) {
          const s = strings[i];
          const target = drop3[i];
          let found = false;
          for (let f = Math.max(0, baseFret); f <= baseFret + 4; f++) {
            if ((STANDARD_TUNING[s] + f) % 12 === target) { voicing[s] = f; frets.push(f); found = true; break; }
          }
          if (!found) { valid = false; break; }
        }
        if (!valid) continue;
        const playedFrets = frets.filter(f => f > 0);
        if (playedFrets.length > 1 && Math.max(...playedFrets) - Math.min(...playedFrets) > 4) continue;
        const key = voicing.join(',');
        if (!seen.has(key)) { seen.add(key); results.push({ frets: [...voicing] }); }
      }
    }
  }
  return results.slice(0, 20);
}

export function generateShellVoicings(root: NoteName, chordType: string): ChordVoicing[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return [];
  const rootIdx = NOTE_NAMES.indexOf(root);
  let shellTones: number[];
  if (formula.length >= 4) {
    shellTones = [formula[0], formula[1], formula[3]].map(i => (rootIdx + i) % 12);
  } else {
    shellTones = formula.map(i => (rootIdx + i) % 12);
  }
  const shellSet = new Set(shellTones);
  const results: ChordVoicing[] = [];
  const seen = new Set<string>();
  for (const rootStr of [0, 1, 2]) {
    for (let baseFret = 0; baseFret <= 14; baseFret++) {
      if ((STANDARD_TUNING[rootStr] + baseFret) % 12 !== shellTones[0]) continue;
      const voicing: number[] = [-1, -1, -1, -1, -1, -1];
      voicing[rootStr] = baseFret;
      const usedTones = new Set([shellTones[0]]);
      for (let s = rootStr + 1; s < Math.min(rootStr + 4, 6); s++) {
        for (let f = Math.max(0, baseFret - 2); f <= baseFret + 4; f++) {
          const n = (STANDARD_TUNING[s] + f) % 12;
          if (shellSet.has(n) && !usedTones.has(n)) { voicing[s] = f; usedTones.add(n); break; }
        }
      }
      if (usedTones.size < shellTones.length) continue;
      const playedFrets = voicing.filter(f => f > 0);
      if (playedFrets.length > 1 && Math.max(...playedFrets) - Math.min(...playedFrets) > 4) continue;
      const key = voicing.join(',');
      if (!seen.has(key)) { seen.add(key); results.push({ frets: [...voicing] }); }
    }
  }
  return results.slice(0, 16);
}

// ============================================================
// CAGED PATTERNS
// ============================================================

export type CAGEDShape = 'C' | 'A' | 'G' | 'E' | 'D';

export const CAGED_PATTERNS: Record<CAGEDShape, {
  name: string;
  description: string;
  rootStringFret: [number, number];
  pattern: number[][];
}> = {
  'C': { name: 'C Shape', description: 'Based on the open C chord.', rootStringFret: [1, 3], pattern: [] },
  'A': { name: 'A Shape', description: 'Based on the open A chord.', rootStringFret: [1, 0], pattern: [] },
  'G': { name: 'G Shape', description: 'Based on the open G chord.', rootStringFret: [0, 3], pattern: [] },
  'E': { name: 'E Shape', description: 'Based on the open E chord.', rootStringFret: [0, 0], pattern: [] },
  'D': { name: 'D Shape', description: 'Based on the open D chord.', rootStringFret: [3, 0], pattern: [] },
};

export function getCAGEDPositions(root: NoteName): { shape: CAGEDShape; startFret: number; endFret: number; notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] }[] {
  const rootIdx = NOTE_NAMES.indexOf(root);
  const majorFormula = SCALE_FORMULAS['Major (Ionian)'];
  const scaleTones = new Set(majorFormula.map(i => (rootIdx + i) % 12));
  const shapes: { shape: CAGEDShape; startFret: number; endFret: number; notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] }[] = [];

  const addShape = (shape: CAGEDShape, stringIdx: number, offsetFn: (rootFret: number) => [number, number]) => {
    for (let rootFret = 0; rootFret <= 12; rootFret++) {
      if ((STANDARD_TUNING[stringIdx] + rootFret) % 12 !== rootIdx) continue;
      const [start, end] = offsetFn(rootFret);
      const notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] = [];
      for (let s = 0; s < 6; s++) {
        for (let f = Math.max(0, start - 1); f <= end + 1; f++) {
          const n = (STANDARD_TUNING[s] + f) % 12;
          if (scaleTones.has(n)) {
            notes.push({ stringIndex: s, fret: f, note: NOTE_NAMES[n], interval: getIntervalName(root, NOTE_NAMES[n]) });
          }
        }
      }
      shapes.push({ shape, startFret: start, endFret: end, notes });
      break;
    }
  };

  addShape('E', 0, rf => [Math.max(0, rf), rf + 3]);
  addShape('A', 1, rf => [Math.max(0, rf), rf + 3]);
  addShape('C', 1, rf => [Math.max(0, rf + 3), rf + 6]);
  addShape('G', 0, rf => [Math.max(0, rf - 3), rf]);
  addShape('D', 2, rf => [Math.max(0, rf), rf + 3]);

  return shapes;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

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
  return getScaleNotes(root, scaleName).includes(note);
}

export function isNoteInArpeggio(note: NoteName, root: NoteName, arpeggioName: string): boolean {
  return getArpeggioNotes(root, arpeggioName).includes(note);
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

export function getExtendedIntervalName(root: NoteName, note: NoteName): string {
  const intervals: Record<number, string> = {
    0: 'R', 1: '♭9', 2: '9', 3: '♭3', 4: '3', 5: '11',
    6: '♭5', 7: '5', 8: '♭13', 9: '13', 10: '♭7', 11: '7',
  };
  const rootIdx = NOTE_NAMES.indexOf(root);
  const noteIdx = NOTE_NAMES.indexOf(note);
  const diff = (noteIdx - rootIdx + 12) % 12;
  return intervals[diff] || '?';
}

export function getChordVoicingNotes(voicing: number[]): { stringIndex: number; fret: number; note: NoteName }[] {
  const result: { stringIndex: number; fret: number; note: NoteName }[] = [];
  voicing.forEach((fret, stringIndex) => {
    if (fret >= 0) result.push({ stringIndex, fret, note: noteAtFret(stringIndex, fret) });
  });
  return result;
}

export function getDiatonicChord(root: NoteName, scaleName: string, degree: NoteName): { notes: NoteName[]; name: string } {
  const scaleNotes = getScaleNotes(root, scaleName);
  if (scaleNotes.length < 7) return { notes: [], name: '' };
  const degreeIndex = scaleNotes.indexOf(degree);
  if (degreeIndex === -1) return { notes: [], name: '' };
  const chordTones: NoteName[] = [];
  for (let i = 0; i < 4; i++) chordTones.push(scaleNotes[(degreeIndex + i * 2) % scaleNotes.length]);
  const intervals = chordTones.map(n => (NOTE_NAMES.indexOf(n) - NOTE_NAMES.indexOf(degree) + 12) % 12);
  const [, i2, i3, i4] = intervals;
  let quality = '';
  if (i2 === 4 && i3 === 7 && i4 === 11) quality = 'maj7';
  else if (i2 === 3 && i3 === 7 && i4 === 10) quality = 'min7';
  else if (i2 === 4 && i3 === 7 && i4 === 10) quality = '7';
  else if (i2 === 3 && i3 === 6 && i4 === 10) quality = 'ø7';
  else if (i2 === 3 && i3 === 6 && i4 === 9) quality = '°7';
  else if (i2 === 4 && i3 === 8) quality = 'aug';
  return { notes: chordTones, name: `${degree}${quality}` };
}

// ============================================================
// Diatonic arpeggio helpers for guided drag arpeggio
// ============================================================

export function getDiatonicArpeggioType(root: NoteName, scaleName: string, noteRoot: NoteName): string | null {
  const scaleNotes = getScaleNotes(root, scaleName);
  if (scaleNotes.length < 7) return null;
  const degreeIndex = scaleNotes.indexOf(noteRoot);
  if (degreeIndex === -1) return null;
  const chord = getDiatonicChord(root, scaleName, noteRoot);
  if (!chord.name) return null;
  // Map quality to arpeggio formula name
  const q = chord.name.replace(noteRoot, '');
  if (q === 'maj7') return 'Major 7';
  if (q === 'min7') return 'Minor 7';
  if (q === '7') return 'Dominant 7';
  if (q === 'ø7') return 'Half-Dim 7';
  if (q === '°7') return 'Dim 7';
  return 'Major'; // fallback to triad
}

/**
 * Get the next arpeggio tone for guided drag mode.
 * Sequence: Root → 3rd → 5th → 7th → Root (octave up)
 * Returns the semitone interval of the next target.
 */
export function getArpeggioSequence(arpeggioType: string): number[] {
  const formula = ARPEGGIO_FORMULAS[arpeggioType] || CHORD_FORMULAS[arpeggioType];
  if (!formula) return [0, 4, 7]; // default major triad
  return formula;
}

/**
 * Find all fret positions of a specific note on the fretboard, optionally restricted to a specific octave range.
 */
export function findNotePositions(targetNote: NoteName, minFret = 0, maxFret = 24): { stringIndex: number; fret: number }[] {
  const positions: { stringIndex: number; fret: number }[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = minFret; f <= maxFret; f++) {
      if (noteAtFret(s, f) === targetNote) {
        positions.push({ stringIndex: s, fret: f });
      }
    }
  }
  return positions;
}

/**
 * Get the MIDI note number for a string/fret position (for octave comparison)
 */
export function getMidiNote(stringIndex: number, fret: number): number {
  // Standard tuning MIDI: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
  const baseMidi = [40, 45, 50, 55, 59, 64];
  return baseMidi[stringIndex] + fret;
}

// ============================================================
// DEGREE COLORS
// ============================================================

// Position-based degree colors:
// 1st (Root) = green, 2nd = grey, 3rd = red, 4th = pink, 5th = blue, 6th = turquoise, 7th = orange
export const DEGREE_COLORS: Record<string, string> = {
  'R':  '130 70% 45%',   // green
  '♭2': '0 0% 65%',      // grey (chromatic 2nd variant)
  '2':  '0 0% 65%',      // grey
  '♭3': '0 85% 55%',     // red (minor 3rd = same color as 3rd position)
  '3':  '0 85% 55%',     // red
  '4':  '330 75% 60%',   // pink
  '♭5': '215 85% 55%',   // blue (chromatic 5th variant)
  '5':  '215 85% 55%',   // blue
  '♭6': '175 75% 50%',   // turquoise (chromatic 6th variant)
  '6':  '175 75% 50%',   // turquoise
  '♭7': '25 85% 55%',    // orange (minor 7th = same color as 7th position)
  '7':  '25 85% 55%',    // orange
  '9':  '0 0% 65%',      // grey (= 2nd)
  '♭9': '0 0% 65%',      // grey
  '11': '330 75% 60%',   // pink (= 4th)
  '♭13':'175 75% 50%',   // turquoise (= 6th)
  '13': '175 75% 50%',   // turquoise
};

export const DEGREE_LEGEND: { label: string; color: string; position: number }[] = [
  { label: 'R',   color: DEGREE_COLORS['R'], position: 1 },
  { label: '2',   color: DEGREE_COLORS['2'], position: 2 },
  { label: '3',   color: DEGREE_COLORS['3'], position: 3 },
  { label: '4',   color: DEGREE_COLORS['4'], position: 4 },
  { label: '5',   color: DEGREE_COLORS['5'], position: 5 },
  { label: '6',   color: DEGREE_COLORS['6'], position: 6 },
  { label: '7',   color: DEGREE_COLORS['7'], position: 7 },
];

// Map any interval name to its scale position (1-7)
export const INTERVAL_TO_POSITION: Record<string, number> = {
  'R': 1, '♭2': 2, '2': 2, '♭3': 3, '3': 3,
  '4': 4, '♭5': 5, '5': 5, '♭6': 6, '6': 6,
  '♭7': 7, '7': 7, '9': 2, '♭9': 2, '11': 4,
  '♭13': 6, '13': 6,
};

// Chord categories for NoteInfoPanel
export const CHORD_CATEGORIES: { label: string; types: string[] }[] = [
  { label: 'Triads', types: ['Major', 'Minor', 'Diminished', 'Augmented', 'Sus2', 'Sus4'] },
  { label: '7ths', types: ['Major 7', 'Minor 7', 'Dominant 7', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Aug 7', '7sus4'] },
  { label: 'Extensions', types: ['Add9', 'Major 9', 'Minor 9', 'Dominant 9', '7#9', '7♭9', '7#5', '7♭5', '11', 'Minor 11', '13', 'Minor 13'] },
  { label: '6ths', types: ['Major 6', 'Minor 6'] },
  { label: 'Power', types: ['Power (5)'] },
];
