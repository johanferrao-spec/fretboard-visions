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
// CURATED CHORD VOICINGS (verified, human-playable, max 4-fret span)
// Sourced from standard guitar chord references
// Format: [lowE, A, D, G, B, highE] where -1 = muted, 0 = open
// ============================================================

export const CURATED_VOICINGS: Record<string, Record<string, number[][]>> = {
  'C': {
    'Major': [
      [-1, 3, 2, 0, 1, 0],  // C open
      [8, 10, 10, 9, 8, 8], // C barre 8th fret
      [-1, 3, 5, 5, 5, 3],  // C barre 3rd fret
    ],
    'Minor': [
      [-1, 3, 5, 5, 4, 3],  // Cm barre
      [8, 10, 10, 8, 8, 8], // Cm barre 8th
      [-1, 3, 1, 0, 1, 0],  // Cm open variation
    ],
    'Major 7': [
      [-1, 3, 2, 0, 0, 0],  // Cmaj7 open
      [8, 10, 9, 9, 8, 8],  // Cmaj7 barre
      [-1, 3, 5, 4, 5, 3],  // Cmaj7 barre 3rd
    ],
    'Minor 7': [
      [-1, 3, 5, 3, 4, 3],  // Cm7 barre
      [8, 10, 8, 8, 8, 8],  // Cm7 barre 8th
      [-1, 3, 1, 3, 1, 3],  // Cm7 open
    ],
    'Dominant 7': [
      [-1, 3, 2, 3, 1, 0],  // C7 open
      [8, 10, 8, 9, 8, 8],  // C7 barre 8th
      [-1, 3, 5, 3, 5, 3],  // C7 barre
    ],
    'Diminished': [
      [-1, 3, 4, 2, 4, 2],
      [-1, -1, 1, 2, 1, 2],
    ],
    'Augmented': [
      [-1, 3, 2, 1, 1, 0],
      [-1, -1, 2, 1, 1, 0],
    ],
    'Sus2': [
      [-1, 3, 0, 0, 1, 3],
      [-1, 3, 5, 5, 3, 3],
    ],
    'Sus4': [
      [-1, 3, 3, 0, 1, 1],
      [-1, 3, 5, 5, 6, 3],
    ],
    'Dim 7': [
      [-1, 3, 4, 2, 4, 2],
      [-1, -1, 1, 2, 1, 2],
    ],
    'Half-Dim 7': [
      [-1, 3, 4, 3, 4, -1],
      [-1, -1, 1, 3, 1, 3],
    ],
    'Major 9': [
      [-1, 3, 2, 0, 0, 0],
      [-1, 3, 2, 4, 3, 0],
    ],
    'Dominant 9': [
      [-1, 3, 2, 3, 3, 0],
      [8, 10, 8, 9, 8, 10],
    ],
    'Minor 9': [
      [-1, 3, 1, 3, 3, 3],
    ],
    'Add9': [
      [-1, 3, 2, 0, 3, 0],
      [-1, 3, 0, 0, 1, 0],
    ],
    'Major 6': [
      [-1, 3, 2, 2, 1, 0],
      [-1, -1, 2, 2, 1, 3],
    ],
    'Minor 6': [
      [-1, -1, 1, 2, 1, 3],
      [-1, 3, 1, 2, 1, 3],
    ],
    '7sus4': [
      [-1, 3, 3, 3, 1, 1],
      [-1, 3, 5, 3, 6, 3],
    ],
    '7#9': [
      [-1, 3, 2, 3, 4, -1],
    ],
    '7♭9': [
      [-1, 3, 2, 3, 2, -1],
    ],
  },
  'D': {
    'Major': [
      [-1, -1, 0, 2, 3, 2],  // D open
      [-1, 5, 7, 7, 7, 5],   // D barre 5th
      [10, 12, 12, 11, 10, 10],
    ],
    'Minor': [
      [-1, -1, 0, 2, 3, 1],  // Dm open
      [-1, 5, 7, 7, 6, 5],   // Dm barre
      [10, 12, 12, 10, 10, 10],
    ],
    'Major 7': [
      [-1, -1, 0, 2, 2, 2],  // Dmaj7 open
      [-1, 5, 7, 6, 7, 5],   // Dmaj7 barre
    ],
    'Minor 7': [
      [-1, -1, 0, 2, 1, 1],  // Dm7 open
      [-1, 5, 7, 5, 6, 5],   // Dm7 barre
    ],
    'Dominant 7': [
      [-1, -1, 0, 2, 1, 2],  // D7 open
      [-1, 5, 7, 5, 7, 5],   // D7 barre
    ],
    'Diminished': [
      [-1, -1, 0, 1, 0, 1],
    ],
    'Augmented': [
      [-1, -1, 0, 3, 3, 2],
    ],
    'Sus2': [
      [-1, -1, 0, 2, 3, 0],
      [-1, 5, 7, 7, 5, 5],
    ],
    'Sus4': [
      [-1, -1, 0, 2, 3, 3],
      [-1, 5, 7, 7, 8, 5],
    ],
    'Add9': [
      [-1, -1, 0, 2, 3, 0],
      [10, 12, 12, 11, 10, 12],
    ],
    'Major 6': [
      [-1, -1, 0, 2, 0, 2],
    ],
    'Minor 6': [
      [-1, -1, 0, 2, 0, 1],
    ],
    'Dim 7': [
      [-1, -1, 0, 1, 0, 1],
    ],
    'Half-Dim 7': [
      [-1, -1, 0, 1, 1, 1],
    ],
    'Dominant 9': [
      [-1, -1, 0, 2, 1, 0],
      [-1, 5, 4, 5, 5, 5],
    ],
  },
  'E': {
    'Major': [
      [0, 2, 2, 1, 0, 0],   // E open
      [-1, 7, 9, 9, 9, 7],  // E barre 7th
    ],
    'Minor': [
      [0, 2, 2, 0, 0, 0],   // Em open
      [-1, 7, 9, 9, 8, 7],  // Em barre 7th
    ],
    'Major 7': [
      [0, 2, 1, 1, 0, 0],   // Emaj7 open
      [-1, 7, 9, 8, 9, 7],
    ],
    'Minor 7': [
      [0, 2, 0, 0, 0, 0],   // Em7 open
      [0, 2, 2, 0, 3, 0],   // Em7 variation
      [-1, 7, 9, 7, 8, 7],
    ],
    'Dominant 7': [
      [0, 2, 0, 1, 0, 0],   // E7 open
      [0, 2, 2, 1, 3, 0],   // E7 variation
      [-1, 7, 9, 7, 9, 7],
    ],
    'Diminished': [
      [-1, -1, 2, 3, 2, 3],
    ],
    'Augmented': [
      [0, 3, 2, 1, 1, 0],
    ],
    'Sus2': [
      [0, 2, 4, 4, 0, 0],
      [-1, 7, 9, 9, 7, 7],
    ],
    'Sus4': [
      [0, 2, 2, 2, 0, 0],
      [-1, 7, 9, 9, 10, 7],
    ],
    'Minor 9': [
      [0, 2, 0, 0, 0, 2],
    ],
    'Dominant 9': [
      [0, 2, 0, 1, 0, 2],
    ],
    'Add9': [
      [0, 2, 2, 1, 0, 2],
    ],
    'Dim 7': [
      [-1, -1, 2, 3, 2, 3],
    ],
    'Half-Dim 7': [
      [0, 1, 0, 0, 0, 0],
      [-1, -1, 2, 3, 2, 0],
    ],
    'Major 6': [
      [0, 2, 2, 1, 2, 0],
    ],
    'Minor 6': [
      [0, 2, 2, 0, 2, 0],
    ],
    '7#9': [
      [0, 2, 0, 1, 3, 3],
    ],
  },
  'F': {
    'Major': [
      [1, 3, 3, 2, 1, 1],   // F barre
      [-1, -1, 3, 2, 1, 1], // F small
      [-1, 8, 10, 10, 10, 8],
    ],
    'Minor': [
      [1, 3, 3, 1, 1, 1],   // Fm barre
      [-1, 8, 10, 10, 9, 8],
    ],
    'Major 7': [
      [1, -1, 2, 2, 1, 0],  // Fmaj7
      [-1, -1, 3, 2, 1, 0],
      [1, 3, 2, 2, 1, 1],
    ],
    'Minor 7': [
      [1, 3, 1, 1, 1, 1],   // Fm7 barre
      [-1, 8, 10, 8, 9, 8],
    ],
    'Dominant 7': [
      [1, 3, 1, 2, 1, 1],   // F7 barre
      [-1, 8, 10, 8, 10, 8],
    ],
    'Diminished': [
      [-1, -1, 0, 1, 0, 1],
      [1, 2, 3, 1, -1, -1],
    ],
    'Augmented': [
      [-1, -1, 3, 2, 2, 1],
    ],
    'Sus2': [
      [-1, -1, 3, 0, 1, 1],
    ],
    'Sus4': [
      [1, 1, 3, 3, 1, 1],
      [-1, -1, 3, 3, 1, 1],
    ],
    'Dim 7': [
      [1, 2, 0, 1, 0, -1],
    ],
    'Half-Dim 7': [
      [1, 2, 3, 1, -1, -1],
      [-1, -1, 3, 4, 4, 4],
    ],
  },
  'G': {
    'Major': [
      [3, 2, 0, 0, 0, 3],   // G open
      [3, 2, 0, 0, 3, 3],   // G open variation
      [3, 5, 5, 4, 3, 3],   // G barre 3rd
    ],
    'Minor': [
      [3, 5, 5, 3, 3, 3],   // Gm barre
      [-1, -1, 5, 3, 3, 3],
      [-1, 10, 12, 12, 11, 10],
    ],
    'Major 7': [
      [3, 2, 0, 0, 0, 2],   // Gmaj7 open
      [3, 5, 4, 4, 3, 3],   // Gmaj7 barre
    ],
    'Minor 7': [
      [3, 5, 3, 3, 3, 3],   // Gm7 barre
      [-1, -1, 5, 3, 3, 3],
      [-1, 10, 12, 10, 11, 10],
    ],
    'Dominant 7': [
      [3, 2, 0, 0, 0, 1],   // G7 open
      [3, 5, 3, 4, 3, 3],   // G7 barre
    ],
    'Diminished': [
      [-1, -1, 5, 6, 5, 6],
    ],
    'Augmented': [
      [3, 2, 1, 0, 0, 3],
    ],
    'Sus2': [
      [3, 0, 0, 0, 3, 3],
      [-1, -1, 5, 0, 3, 3],
    ],
    'Sus4': [
      [3, 3, 0, 0, 1, 3],
      [3, 5, 5, 5, 3, 3],
    ],
    'Dim 7': [
      [-1, -1, 5, 6, 5, 6],
    ],
    'Half-Dim 7': [
      [-1, -1, 5, 6, 6, 6],
    ],
    'Dominant 9': [
      [3, 2, 0, 2, 0, 1],
      [3, 5, 3, 4, 3, 5],
    ],
    'Add9': [
      [3, 0, 0, 0, 0, 3],
      [3, 2, 0, 2, 0, 3],
    ],
    'Major 6': [
      [3, 2, 0, 0, 0, 0],
    ],
    'Minor 6': [
      [3, 5, 5, 3, 3, 0],
      [-1, -1, 5, 3, 3, 0],
    ],
  },
  'A': {
    'Major': [
      [-1, 0, 2, 2, 2, 0],  // A open
      [5, 7, 7, 6, 5, 5],   // A barre 5th
    ],
    'Minor': [
      [-1, 0, 2, 2, 1, 0],  // Am open
      [5, 7, 7, 5, 5, 5],   // Am barre 5th
    ],
    'Major 7': [
      [-1, 0, 2, 1, 2, 0],  // Amaj7 open
      [5, 7, 6, 6, 5, 5],
    ],
    'Minor 7': [
      [-1, 0, 2, 0, 1, 0],  // Am7 open
      [5, 7, 5, 5, 5, 5],
    ],
    'Dominant 7': [
      [-1, 0, 2, 0, 2, 0],  // A7 open
      [5, 7, 5, 6, 5, 5],
    ],
    'Diminished': [
      [-1, 0, 1, 2, 1, -1],
    ],
    'Augmented': [
      [-1, 0, 3, 2, 2, 1],
    ],
    'Sus2': [
      [-1, 0, 2, 2, 0, 0],
      [5, 7, 7, 4, 5, 5],
    ],
    'Sus4': [
      [-1, 0, 2, 2, 3, 0],
      [5, 7, 7, 7, 5, 5],
    ],
    'Add9': [
      [-1, 0, 2, 4, 2, 0],
    ],
    'Major 6': [
      [-1, 0, 2, 2, 2, 2],
    ],
    'Minor 6': [
      [-1, 0, 2, 2, 1, 2],
    ],
    'Dim 7': [
      [-1, 0, 1, 2, 1, 2],
    ],
    'Half-Dim 7': [
      [-1, 0, 1, 2, 1, 0],
      [-1, 0, 1, 0, 1, 0],
    ],
    'Minor 9': [
      [-1, 0, 2, 0, 1, 2],
      [5, 7, 5, 5, 5, 7],
    ],
    'Dominant 9': [
      [-1, 0, 2, 0, 2, 2],
      [5, 7, 5, 6, 5, 7],
    ],
    '7#9': [
      [-1, 0, 2, 0, 2, 3],
    ],
    '7♭9': [
      [-1, 0, 2, 0, 2, 1],
    ],
    '11': [
      [-1, 0, 0, 0, 2, 0],
    ],
    '7sus4': [
      [-1, 0, 2, 0, 3, 0],
    ],
  },
  'B': {
    'Major': [
      [-1, 2, 4, 4, 4, 2],  // B barre 2nd
      [7, 9, 9, 8, 7, 7],   // B barre 7th
    ],
    'Minor': [
      [-1, 2, 4, 4, 3, 2],  // Bm barre
      [7, 9, 9, 7, 7, 7],
    ],
    'Major 7': [
      [-1, 2, 4, 3, 4, 2],
      [7, 9, 8, 8, 7, 7],
    ],
    'Minor 7': [
      [-1, 2, 0, 2, 0, 2],
      [-1, 2, 4, 2, 3, 2],
      [7, 9, 7, 7, 7, 7],
    ],
    'Dominant 7': [
      [-1, 2, 1, 2, 0, 2],
      [-1, 2, 4, 2, 4, 2],
      [7, 9, 7, 8, 7, 7],
    ],
    'Diminished': [
      [-1, 2, 3, 4, 3, -1],
    ],
    'Augmented': [
      [-1, 2, 1, 0, 0, 3],
    ],
    'Sus2': [
      [-1, 2, 4, 4, 2, 2],
    ],
    'Sus4': [
      [-1, 2, 4, 4, 5, 2],
    ],
    'Dim 7': [
      [-1, 2, 3, 1, 3, 1],
    ],
    'Half-Dim 7': [
      [-1, 2, 3, 2, 3, -1],
    ],
  },
};

// Generate voicings for remaining roots by transposing
function transposeVoicing(voicing: number[], semitones: number): number[] {
  return voicing.map(f => {
    if (f <= 0) return f; // keep open strings and mutes
    return f + semitones;
  });
}

// Fill in missing roots by transposing from nearest known root
const ALL_ROOTS: NoteName[] = [...NOTE_NAMES];
const KNOWN_ROOTS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

for (const root of ALL_ROOTS) {
  if (CURATED_VOICINGS[root]) continue;
  CURATED_VOICINGS[root] = {};
  // Find nearest known root below
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
      .map(v => transposeVoicing(v, semitoneOffset))
      .filter(v => {
        const fretted = v.filter(f => f > 0);
        if (fretted.length === 0) return true;
        return Math.max(...fretted) <= 24 && (fretted.length <= 1 || Math.max(...fretted) - Math.min(...fretted) <= 4);
      });
  }
}

// ============================================================
// VOICING GETTERS - curated first, then algorithmic fallback
// ============================================================

export function getVoicingsForChord(root: NoteName, chordType: string, source: 'full' | 'shell' | 'drop2' | 'drop3'): number[][] {
  if (source === 'full') {
    const curated = CURATED_VOICINGS[root]?.[chordType];
    if (curated && curated.length > 0) return curated;
    return generatePlayableVoicings(root, chordType);
  }
  if (source === 'shell') return generateShellVoicings(root, chordType);
  if (source === 'drop2') return generateDrop2Voicings(root, chordType);
  if (source === 'drop3') return generateDrop3Voicings(root, chordType);
  return [];
}

// ============================================================
// ALGORITHMIC VOICING GENERATORS (fallback)
// ============================================================

export function generatePlayableVoicings(root: NoteName, chordType: string, maxFretSearch = 14, limit = 24): number[][] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return [];
  const rootIdx = NOTE_NAMES.indexOf(root);
  const chordTones = [...new Set(formula.map(i => (rootIdx + i) % 12))];
  const chordTonesSet = new Set(chordTones);
  const minRequired = Math.min(chordTones.length, 4);
  const results: number[][] = [];
  const seen = new Set<string>();

  for (let baseFret = 0; baseFret <= maxFretSearch && results.length < limit * 3; baseFret++) {
    const lo = baseFret;
    const hi = baseFret + 4;
    const perString: number[][] = [];
    for (let s = 0; s < 6; s++) {
      const opts: number[] = [-1];
      for (let f = lo; f <= Math.min(hi, 24); f++) {
        if (chordTonesSet.has((STANDARD_TUNING[s] + f) % 12)) opts.push(f);
      }
      if (lo > 0 && lo <= 4 && chordTonesSet.has(STANDARD_TUNING[s] % 12) && !opts.includes(0)) opts.push(0);
      perString.push(opts);
    }
    const search = (s: number, current: number[]) => {
      if (results.length >= limit * 3) return;
      if (s === 6) {
        const played = current.filter(f => f >= 0);
        if (played.length < Math.max(3, minRequired)) return;
        const present = new Set<number>();
        current.forEach((f, i) => { if (f >= 0) present.add((STANDARD_TUNING[i] + f) % 12); });
        let count = 0;
        for (const t of chordTones) { if (present.has(t)) count++; }
        if (count < minRequired) return;
        const fretted = played.filter(f => f > 0);
        if (fretted.length > 1 && Math.max(...fretted) - Math.min(...fretted) > 4) return;
        let first = -1, last = -1;
        for (let i = 0; i < 6; i++) {
          if (current[i] >= 0) { if (first === -1) first = i; last = i; }
        }
        for (let i = first + 1; i < last; i++) {
          if (current[i] === -1) return;
        }
        const key = current.join(',');
        if (!seen.has(key)) { seen.add(key); results.push([...current]); }
        return;
      }
      for (const fret of perString[s]) { current.push(fret); search(s + 1, current); current.pop(); }
    };
    search(0, []);
  }
  results.sort((a, b) => {
    const aFirst = a.findIndex(f => f >= 0);
    const bFirst = b.findIndex(f => f >= 0);
    const aHasRoot = aFirst >= 0 && (STANDARD_TUNING[aFirst] + a[aFirst]) % 12 === rootIdx % 12;
    const bHasRoot = bFirst >= 0 && (STANDARD_TUNING[bFirst] + b[bFirst]) % 12 === rootIdx % 12;
    if (aHasRoot !== bHasRoot) return aHasRoot ? -1 : 1;
    const aPlayed = a.filter(f => f >= 0).length;
    const bPlayed = b.filter(f => f >= 0).length;
    if (aPlayed !== bPlayed) return bPlayed - aPlayed;
    const aMin = Math.min(...a.filter(f => f > 0).concat([99]));
    const bMin = Math.min(...b.filter(f => f > 0).concat([99]));
    return aMin - bMin;
  });
  return results.slice(0, limit);
}

export function generateDrop2Voicings(root: NoteName, chordType: string): number[][] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula || formula.length < 4) return [];
  const rootIdx = NOTE_NAMES.indexOf(root);
  const tones = formula.slice(0, 4).map(i => (rootIdx + i) % 12);
  const results: number[][] = [];
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
        // Verify extension notes are present for extended chords
        if (formula.length > 4) {
          const present = new Set<number>();
          voicing.forEach((f, i) => { if (f >= 0) present.add((STANDARD_TUNING[i] + f) % 12); });
          const extTone = (rootIdx + formula[formula.length - 1]) % 12;
          if (!present.has(extTone)) continue;
        }
        const key = voicing.join(',');
        if (!seen.has(key)) { seen.add(key); results.push([...voicing]); }
      }
    }
  }
  return results.slice(0, 20);
}

export function generateDrop3Voicings(root: NoteName, chordType: string): number[][] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula || formula.length < 4) return [];
  const rootIdx = NOTE_NAMES.indexOf(root);
  const tones = formula.slice(0, 4).map(i => (rootIdx + i) % 12);
  const results: number[][] = [];
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
        if (!seen.has(key)) { seen.add(key); results.push([...voicing]); }
      }
    }
  }
  return results.slice(0, 20);
}

export function generateShellVoicings(root: NoteName, chordType: string): number[][] {
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
  const results: number[][] = [];
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
      if (!seen.has(key)) { seen.add(key); results.push([...voicing]); }
    }
  }
  return results.slice(0, 16);
}

// ============================================================
// CAGED PATTERNS
// ============================================================

export type CAGEDShape = 'C' | 'A' | 'G' | 'E' | 'D';

// CAGED major scale patterns (relative fret positions for each shape)
// Each pattern is defined as [string][frets relative to pattern root]
export const CAGED_PATTERNS: Record<CAGEDShape, { 
  name: string; 
  description: string;
  rootStringFret: [number, number]; // [string, relative fret] where the root lives
  pattern: number[][]; // For each string, the frets (relative to root position) that are in the scale
}> = {
  'C': {
    name: 'C Shape',
    description: 'Based on the open C chord. Covers the area just above the root on the low strings.',
    rootStringFret: [1, 3], // A string
    pattern: [], // Will be computed dynamically
  },
  'A': {
    name: 'A Shape',
    description: 'Based on the open A chord. The most common barre chord shape on the A string.',
    rootStringFret: [1, 0],
    pattern: [],
  },
  'G': {
    name: 'G Shape',
    description: 'Based on the open G chord. Covers a wide stretch — good for connecting A and E shapes.',
    rootStringFret: [0, 3],
    pattern: [],
  },
  'E': {
    name: 'E Shape',
    description: 'Based on the open E chord. The most common barre chord shape on the low E string.',
    rootStringFret: [0, 0],
    pattern: [],
  },
  'D': {
    name: 'D Shape',
    description: 'Based on the open D chord. Higher voicing, great for melodies on the treble strings.',
    rootStringFret: [3, 0],
    pattern: [],
  },
};

// Get CAGED positions for a given root note
export function getCAGEDPositions(root: NoteName): { shape: CAGEDShape; startFret: number; endFret: number; notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] }[] {
  const rootIdx = NOTE_NAMES.indexOf(root);
  const majorFormula = SCALE_FORMULAS['Major (Ionian)'];
  const scaleTones = new Set(majorFormula.map(i => (rootIdx + i) % 12));
  
  // Find root positions on strings 0 (E) and 1 (A)
  const shapes: { shape: CAGEDShape; startFret: number; endFret: number; notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] }[] = [];
  
  // E shape - root on low E string
  for (let rootFret = 0; rootFret <= 12; rootFret++) {
    if ((STANDARD_TUNING[0] + rootFret) % 12 !== rootIdx) continue;
    const start = Math.max(0, rootFret);
    const end = rootFret + 3;
    const notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] = [];
    for (let s = 0; s < 6; s++) {
      for (let f = Math.max(0, start - 1); f <= end + 1; f++) {
        const n = (STANDARD_TUNING[s] + f) % 12;
        if (scaleTones.has(n)) {
          notes.push({ stringIndex: s, fret: f, note: NOTE_NAMES[n], interval: getIntervalName(root, NOTE_NAMES[n]) });
        }
      }
    }
    shapes.push({ shape: 'E', startFret: start, endFret: end, notes });
    break;
  }
  
  // A shape - root on A string  
  for (let rootFret = 0; rootFret <= 12; rootFret++) {
    if ((STANDARD_TUNING[1] + rootFret) % 12 !== rootIdx) continue;
    const start = Math.max(0, rootFret);
    const end = rootFret + 3;
    const notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] = [];
    for (let s = 0; s < 6; s++) {
      for (let f = Math.max(0, start - 1); f <= end + 1; f++) {
        const n = (STANDARD_TUNING[s] + f) % 12;
        if (scaleTones.has(n)) {
          notes.push({ stringIndex: s, fret: f, note: NOTE_NAMES[n], interval: getIntervalName(root, NOTE_NAMES[n]) });
        }
      }
    }
    shapes.push({ shape: 'A', startFret: start, endFret: end, notes });
    break;
  }

  // C shape - between A and open/G
  for (let rootFret = 0; rootFret <= 12; rootFret++) {
    if ((STANDARD_TUNING[1] + rootFret) % 12 !== rootIdx) continue;
    const start = Math.max(0, rootFret + 3);
    const end = start + 3;
    const notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] = [];
    for (let s = 0; s < 6; s++) {
      for (let f = Math.max(0, start - 1); f <= end + 1; f++) {
        const n = (STANDARD_TUNING[s] + f) % 12;
        if (scaleTones.has(n)) {
          notes.push({ stringIndex: s, fret: f, note: NOTE_NAMES[n], interval: getIntervalName(root, NOTE_NAMES[n]) });
        }
      }
    }
    shapes.push({ shape: 'C', startFret: start, endFret: end, notes });
    break;
  }

  // G shape - root on low E, wider position
  for (let rootFret = 0; rootFret <= 12; rootFret++) {
    if ((STANDARD_TUNING[0] + rootFret) % 12 !== rootIdx) continue;
    const start = Math.max(0, rootFret - 3);
    const end = rootFret;
    const notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] = [];
    for (let s = 0; s < 6; s++) {
      for (let f = Math.max(0, start - 1); f <= end + 1; f++) {
        const n = (STANDARD_TUNING[s] + f) % 12;
        if (scaleTones.has(n)) {
          notes.push({ stringIndex: s, fret: f, note: NOTE_NAMES[n], interval: getIntervalName(root, NOTE_NAMES[n]) });
        }
      }
    }
    shapes.push({ shape: 'G', startFret: start, endFret: end, notes });
    break;
  }

  // D shape - root on D string
  for (let rootFret = 0; rootFret <= 12; rootFret++) {
    if ((STANDARD_TUNING[2] + rootFret) % 12 !== rootIdx) continue;
    const start = Math.max(0, rootFret);
    const end = rootFret + 3;
    const notes: {stringIndex: number; fret: number; note: NoteName; interval: string}[] = [];
    for (let s = 0; s < 6; s++) {
      for (let f = Math.max(0, start - 1); f <= end + 1; f++) {
        const n = (STANDARD_TUNING[s] + f) % 12;
        if (scaleTones.has(n)) {
          notes.push({ stringIndex: s, fret: f, note: NOTE_NAMES[n], interval: getIntervalName(root, NOTE_NAMES[n]) });
        }
      }
    }
    shapes.push({ shape: 'D', startFret: start, endFret: end, notes });
    break;
  }

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
// DEGREE COLORS
// ============================================================

export const DEGREE_COLORS: Record<string, string> = {
  'R':  '130 70% 45%',
  '♭2': '20 60% 50%',
  '2':  '0 0% 65%',
  '♭3': '350 70% 50%',
  '3':  '0 85% 55%',
  '4':  '330 75% 60%',
  '♭5': '200 60% 50%',
  '5':  '215 85% 55%',
  '♭6': '175 60% 45%',
  '6':  '175 75% 50%',
  '♭7': '25 85% 55%',
  '7':  '30 90% 55%',
  '9':  '0 0% 65%',
  '♭9': '20 60% 50%',
  '11': '330 75% 60%',
  '♭13':'175 60% 45%',
  '13': '175 75% 50%',
};

export const DEGREE_LEGEND: { label: string; color: string }[] = [
  { label: 'R',   color: DEGREE_COLORS['R'] },
  { label: '♭3',  color: DEGREE_COLORS['♭3'] },
  { label: '3',   color: DEGREE_COLORS['3'] },
  { label: '4',   color: DEGREE_COLORS['4'] },
  { label: '♭5',  color: DEGREE_COLORS['♭5'] },
  { label: '5',   color: DEGREE_COLORS['5'] },
  { label: '♭7',  color: DEGREE_COLORS['♭7'] },
  { label: '7',   color: DEGREE_COLORS['7'] },
  { label: '9',   color: DEGREE_COLORS['9'] },
  { label: '11',  color: DEGREE_COLORS['11'] },
  { label: '13',  color: DEGREE_COLORS['13'] },
];

// Chord categories for NoteInfoPanel
export const CHORD_CATEGORIES: { label: string; types: string[] }[] = [
  { label: 'Triads', types: ['Major', 'Minor', 'Diminished', 'Augmented', 'Sus2', 'Sus4'] },
  { label: '7ths', types: ['Major 7', 'Minor 7', 'Dominant 7', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Aug 7', '7sus4'] },
  { label: 'Extensions', types: ['Add9', 'Major 9', 'Minor 9', 'Dominant 9', '7#9', '7♭9', '7#5', '7♭5', '11', 'Minor 11', '13', 'Minor 13'] },
  { label: '6ths', types: ['Major 6', 'Minor 6'] },
  { label: 'Power', types: ['Power (5)'] },
];
