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
// ALTERNATE TUNINGS
// ============================================================

export interface TuningPreset {
  name: string;
  notes: number[]; // semitone values like STANDARD_TUNING
  labels: string[];
}

export const TUNING_PRESETS: TuningPreset[] = [
  { name: 'Standard', notes: [4, 9, 2, 7, 11, 4], labels: ['E', 'A', 'D', 'G', 'B', 'e'] },
  { name: 'Drop D', notes: [2, 9, 2, 7, 11, 4], labels: ['D', 'A', 'D', 'G', 'B', 'e'] },
  { name: 'Open G', notes: [2, 7, 2, 7, 11, 2], labels: ['D', 'G', 'D', 'G', 'B', 'd'] },
  { name: 'Open D', notes: [2, 9, 2, 6, 9, 2], labels: ['D', 'A', 'D', 'F#', 'A', 'd'] },
  { name: 'Open E', notes: [4, 11, 4, 8, 11, 4], labels: ['E', 'B', 'E', 'G#', 'B', 'e'] },
  { name: 'Open A', notes: [4, 9, 4, 9, 1, 4], labels: ['E', 'A', 'E', 'A', 'C#', 'e'] },
  { name: 'DADGAD', notes: [2, 9, 2, 7, 9, 2], labels: ['D', 'A', 'D', 'G', 'A', 'd'] },
  { name: 'Drop C', notes: [0, 7, 0, 5, 9, 2], labels: ['C', 'G', 'C', 'F', 'A', 'd'] },
  { name: 'Half Step Down', notes: [3, 8, 1, 6, 10, 3], labels: ['E♭', 'A♭', 'D♭', 'G♭', 'B♭', 'e♭'] },
  { name: 'Full Step Down', notes: [2, 7, 0, 5, 9, 2], labels: ['D', 'G', 'C', 'F', 'A', 'd'] },
  { name: 'Open C', notes: [0, 7, 0, 7, 0, 4], labels: ['C', 'G', 'C', 'G', 'C', 'e'] },
  { name: 'Nashville', notes: [4, 9, 2, 7, 11, 4], labels: ['e', 'a', 'd', 'G', 'B', 'e'] },
];

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
  'Sus2': [0, 2, 7],
  'Sus4': [0, 5, 7],
  'Major 7': [0, 4, 7, 11],
  'Minor 7': [0, 3, 7, 10],
  'Dominant 7': [0, 4, 7, 10],
  'Dim 7': [0, 3, 6, 9],
  'Half-Dim 7': [0, 3, 6, 10],
  'Min/Maj 7': [0, 3, 7, 11],
  'Aug 7': [0, 4, 8, 10],
  'Major 9': [0, 4, 7, 11, 14],
  'Minor 9': [0, 3, 7, 10, 14],
  'Dominant 9': [0, 4, 7, 10, 14],
  'Major 6': [0, 4, 7, 9],
  'Minor 6': [0, 3, 7, 9],
  '7sus4': [0, 5, 7, 10],
  'Add9': [0, 4, 7, 14],
  '7#9': [0, 4, 7, 10, 15],
  '7♭9': [0, 4, 7, 10, 13],
  '11': [0, 4, 7, 10, 17],
  'Minor 11': [0, 3, 7, 10, 17],
  '13': [0, 4, 7, 10, 21],
  'Minor 13': [0, 3, 7, 10, 21],
};

// ============================================================
// ARPEGGIO POSITION GENERATOR ENGINE
// ============================================================

export interface ArpeggioPosition {
  frets: (number | -1)[]; // [lowE, A, D, G, B, highE], -1 = not played
  label: string; // e.g. "Pos 5" or "Linear A"
  startFret: number;
  type: 'static' | 'linear';
}

/**
 * Generate playable arpeggio positions on the guitar fretboard.
 * 
 * Rules:
 * - Root-first: starts on the lowest available root note
 * - Max 4-fret span per position block
 * - Max 2 notes per string (unless chromatically adjacent)
 * - 1-octave: single CAGED-style position
 * - 2-octave: static (all 6 strings) or linear (shifting)
 * - 3-octave: linear/diagonal only
 */
export function generateArpeggioPositions(
  root: NoteName,
  arpType: string,
  octaves: 1 | 2 | 3,
  tuning: number[] = STANDARD_TUNING,
  maxFret: number = 22,
): ArpeggioPosition[] {
  const formula = ARPEGGIO_FORMULAS[arpType] || CHORD_FORMULAS[arpType];
  if (!formula) return [];
  
  const rootIdx = NOTE_NAMES.indexOf(root);
  // Intervals modulo 12
  const intervals = formula.map(i => i % 12);
  
  // Build all note positions on the fretboard for this arpeggio
  const baseMidi = tuning.length === 6 
    ? [40, 45, 50, 55, 59, 64].map((m, i) => m + (tuning[i] - STANDARD_TUNING[i]))
    : [40, 45, 50, 55, 59, 64];
  
  interface FretNote { stringIndex: number; fret: number; midi: number; intervalIdx: number; }
  
  const allNotes: FretNote[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= maxFret; f++) {
      const midi = baseMidi[s] + f;
      const noteClass = midi % 12;
      const targetClass = (rootIdx) % 12;
      for (let ii = 0; ii < intervals.length; ii++) {
        if ((targetClass + intervals[ii]) % 12 === noteClass) {
          allNotes.push({ stringIndex: s, fret: f, midi, intervalIdx: ii });
        }
      }
    }
  }
  
  // Find all root positions (intervalIdx === 0)
  const rootPositions = allNotes.filter(n => n.intervalIdx === 0).sort((a, b) => a.midi - b.midi);
  
  const positions: ArpeggioPosition[] = [];
  
  if (octaves === 1) {
    // Single-octave: generate CAGED-style static positions
    for (const rootNote of rootPositions) {
      if (rootNote.fret > maxFret - 3) continue;
      const shape = buildStaticPosition(rootNote, allNotes, intervals.length, 1, maxFret);
      if (shape && isPlayable(shape)) {
        const startFret = Math.min(...shape.filter(f => f > 0));
        positions.push({
          frets: shape,
          label: `Pos ${startFret}`,
          startFret,
          type: 'static',
        });
      }
    }
  } else if (octaves === 2) {
    // 2-octave: static shapes spanning all 6 strings + linear shapes
    for (const rootNote of rootPositions) {
      if (rootNote.stringIndex > 1) continue; // Start on E or A string
      // Static: try to fit 2 octaves in a wide position
      const shape = buildStaticPosition(rootNote, allNotes, intervals.length, 2, maxFret);
      if (shape && isPlayable(shape)) {
        const playedFrets = shape.filter(f => f > 0);
        const startFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
        positions.push({
          frets: shape,
          label: `Static ${startFret}`,
          startFret,
          type: 'static',
        });
      }
      // Linear: shifting diagonal
      const linear = buildLinearPosition(rootNote, allNotes, intervals, 2, maxFret);
      if (linear && isPlayable(linear)) {
        const playedFrets = linear.filter(f => f > 0);
        const startFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
        positions.push({
          frets: linear,
          label: `Linear ${startFret}`,
          startFret,
          type: 'linear',
        });
      }
    }
  } else {
    // 3-octave: linear/diagonal only, start on E or A
    for (const rootNote of rootPositions) {
      if (rootNote.stringIndex > 1) continue;
      if (rootNote.fret > 12) continue; // Need room to go up
      const linear = buildLinearPosition(rootNote, allNotes, intervals, 3, maxFret);
      if (linear && isPlayable(linear)) {
        const playedFrets = linear.filter(f => f > 0);
        const startFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
        positions.push({
          frets: linear,
          label: `Linear ${startFret}`,
          startFret,
          type: 'linear',
        });
      }
    }
  }
  
  // Deduplicate identical shapes
  const seen = new Set<string>();
  return positions.filter(p => {
    const key = p.frets.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Build a static (single-position) arpeggio shape
function buildStaticPosition(
  rootNote: { stringIndex: number; fret: number; midi: number },
  allNotes: { stringIndex: number; fret: number; midi: number; intervalIdx: number }[],
  numIntervals: number,
  octaves: number,
  maxFret: number,
): (number | -1)[] | null {
  const targetMidiMin = rootNote.midi;
  const targetMidiMax = rootNote.midi + 12 * octaves;
  
  // For static: allow a wider span for 2-octave (up to 5 frets), otherwise 4
  const maxSpan = octaves >= 2 ? 5 : 4;
  
  // Collect candidate notes within the midi range
  const candidates = allNotes.filter(n => 
    n.midi >= targetMidiMin && n.midi <= targetMidiMax
  );
  
  // Try different position windows
  const minFret = Math.max(0, rootNote.fret - 1);
  const maxStartFret = Math.min(maxFret - maxSpan + 1, rootNote.fret + 2);
  
  let bestShape: (number | -1)[] | null = null;
  let bestScore = -1;
  
  for (let posStart = minFret; posStart <= maxStartFret; posStart++) {
    const posEnd = posStart + maxSpan - 1;
    const shape: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
    const notesPerString: number[][] = [[], [], [], [], [], []];
    
    // Root must be included
    let hasRoot = false;
    
    for (const n of candidates) {
      const inPos = (n.fret >= posStart && n.fret <= posEnd) || n.fret === 0;
      if (!inPos) continue;
      notesPerString[n.stringIndex].push(n.fret);
    }
    
    // Select best note(s) per string (max 2, prefer root string to have root)
    let score = 0;
    for (let s = 0; s < 6; s++) {
      const frets = [...new Set(notesPerString[s])].sort((a, b) => a - b);
      if (frets.length === 0) continue;
      
      // Max 2 notes per string
      const selected = frets.slice(0, 2);
      // For our format we just store the lowest fret (simplified for display)
      // Actually store lowest fret — for multi-note strings we'd need extended format
      // For now, pick the note closest to root pitch ordering
      shape[s] = selected[0];
      score += selected.length;
      
      if (selected.some(f => {
        const midi = (s === 0 ? 40 : s === 1 ? 45 : s === 2 ? 50 : s === 3 ? 55 : s === 4 ? 59 : 64) + f;
        return midi % 12 === rootNote.midi % 12;
      })) {
        hasRoot = true;
      }
    }
    
    // Must include root and start from root string or lower
    if (!hasRoot) continue;
    // Ensure root note is on the lowest played string
    let lowestPlayed = -1;
    for (let s = 0; s < 6; s++) {
      if (shape[s] >= 0) { lowestPlayed = s; break; }
    }
    if (lowestPlayed >= 0 && lowestPlayed < rootNote.stringIndex) {
      // Mute strings below root
      for (let s = 0; s < rootNote.stringIndex; s++) shape[s] = -1;
    }
    
    // Recalculate score after muting
    score = shape.filter(f => f >= 0).length;
    
    if (score > bestScore) {
      bestScore = score;
      bestShape = [...shape];
    }
  }
  
  return bestShape;
}

// Build a linear (shifting) arpeggio shape
function buildLinearPosition(
  rootNote: { stringIndex: number; fret: number; midi: number },
  allNotes: { stringIndex: number; fret: number; midi: number; intervalIdx: number }[],
  intervals: number[],
  octaves: number,
  maxFret: number,
): (number | -1)[] | null {
  const targetMidiMax = rootNote.midi + 12 * octaves;
  const shape: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
  
  // For linear: walk string by string from root, picking ascending notes
  // that maintain ~4-fret span blocks
  let currentMidi = rootNote.midi;
  shape[rootNote.stringIndex] = rootNote.fret;
  
  const usedStrings = new Set([rootNote.stringIndex]);
  
  // Go to higher strings (higher index = higher pitch)
  for (let s = rootNote.stringIndex + 1; s < 6; s++) {
    // Find the best note on this string that continues ascending
    const candidates = allNotes.filter(n => 
      n.stringIndex === s && n.midi > currentMidi && n.midi <= targetMidiMax
    ).sort((a, b) => a.midi - b.midi);
    
    if (candidates.length === 0) continue;
    
    // Pick the lowest ascending note
    const pick = candidates[0];
    shape[s] = pick.fret;
    currentMidi = pick.midi;
    usedStrings.add(s);
  }
  
  // Check we have enough range
  if (currentMidi < rootNote.midi + 12 * (octaves - 0.5)) return null;
  
  return shape;
}

// Check playability: max 2 notes per string, reasonable fret span per block
function isPlayable(shape: (number | -1)[]): boolean {
  const played = shape.filter(f => f >= 0);
  if (played.length < 3) return false;
  // Overall span check for static shapes
  const minF = Math.min(...played.filter(f => f > 0), 99);
  const maxF = Math.max(...played);
  // Allow up to 7 fret total range for linear shapes
  if (maxF - minF > 12) return false;
  return true;
}

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

export function noteAtFret(stringIndex: number, fret: number, tuning: number[] = STANDARD_TUNING): NoteName {
  const openNote = tuning[stringIndex];
  return NOTE_NAMES[(openNote + fret) % 12];
}

/** Check if a chord voicing is playable in a given tuning by verifying notes match expected chord tones */
export function isVoicingPlayableInTuning(voicing: ChordVoicing, root: NoteName, chordType: string, tuning: number[]): boolean {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return false;
  const rootIdx = NOTE_NAMES.indexOf(root);
  const chordTones = new Set(formula.map(i => (rootIdx + i) % 12));
  
  for (let s = 0; s < 6; s++) {
    const f = voicing.frets[s];
    if (f >= 0) {
      const notePC = (tuning[s] + f) % 12;
      if (!chordTones.has(notePC)) return false;
    }
  }
  return true;
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

// ============================================================
// CHORD IDENTIFICATION from fret input
// ============================================================

function formatChordSymbol(root: NoteName, chordName: string, bassNote?: NoteName): string {
  const symbols: Record<string, string> = {
    'Major': '',
    'Minor': 'm',
    'Diminished': 'dim',
    'Augmented': 'aug',
    'Sus2': 'sus2',
    'Sus4': 'sus4',
    'Major 7': 'maj7',
    'Minor 7': 'm7',
    'Dominant 7': '7',
    'Dim 7': 'dim7',
    'Half-Dim 7': 'm7♭5',
    'Min/Maj 7': 'mMaj7',
    'Aug 7': 'aug7',
    'Add9': 'add9',
    'Major 9': 'maj9',
    'Minor 9': 'm9',
    'Dominant 9': '9',
    'Major 6': '6',
    'Minor 6': 'm6',
    '7sus4': '7sus4',
    '7#9': '7#9',
    '7♭9': '7♭9',
    '7#5': '7#5',
    '7♭5': '7♭5',
    '11': '11',
    'Minor 11': 'm11',
    '13': '13',
    'Minor 13': 'm13',
    'Power (5)': '5',
  };

  const base = `${root}${symbols[chordName] ?? ` ${chordName}`}`;
  return bassNote && bassNote !== root ? `${base}/${bassNote}` : base;
}

export function identifyChord(frets: (number | -1)[]): { names: string[]; explanations: string[]; bassNote: NoteName; notes: NoteName[]; extensions: { frets: number[]; note: NoteName }[] }[] {
  const playedNotes: NoteName[] = [];
  const playedMidi: number[] = [];
  for (let i = 0; i < 6; i++) {
    if (frets[i] >= 0) {
      playedNotes.push(noteAtFret(i, frets[i]));
      playedMidi.push(getMidiNote(i, frets[i]));
    }
  }
  if (playedNotes.length < 2) return [];

  const uniquePCs = [...new Set(playedNotes.map(n => NOTE_NAMES.indexOf(n)))];
  const bassNote = playedNotes[0];
  const results: { names: string[]; explanations: string[]; bassNote: NoteName; notes: NoteName[]; extensions: { frets: number[]; note: NoteName }[] }[] = [];

  // Try each unique pitch class as potential root
  for (const rootPC of uniquePCs) {
    const root = NOTE_NAMES[rootPC];
    const intervals = new Set(uniquePCs.map(pc => (pc - rootPC + 12) % 12));
    
    // Match against chord formulas
    for (const [chordName, formula] of Object.entries(CHORD_FORMULAS)) {
      const formulaIntervals = new Set(formula.map(i => i % 12));
      // Check if played notes are a subset of (or equal to) the formula
      const allMatch = [...intervals].every(i => formulaIntervals.has(i));
      // Check that key intervals are present (at least root + one other)
      const hasEnough = intervals.size >= 2 && intervals.has(0);
      if (allMatch && hasEnough && formulaIntervals.size >= intervals.size) {
        const names = [formatChordSymbol(root, chordName, bassNote !== root ? bassNote : undefined)];
        const explanations: string[] = [];
        
        // Check for slash chord
        if (bassNote !== root) {
          explanations.push(`Bass note ${bassNote} is not the root — this is a slash chord.`);
        }
        
        // Find missing formula notes that could extend the chord
        const extensions: { frets: number[]; note: NoteName }[] = [];
        for (const fi of formulaIntervals) {
          if (!intervals.has(fi)) {
            const missingNote = NOTE_NAMES[(rootPC + fi) % 12];
            // Find where this note could be played on muted strings
            const extFrets: number[] = [];
            for (let s = 0; s < 6; s++) {
              if (frets[s] === -1) {
                // Find nearest fret for this note
                for (let f = 0; f <= 12; f++) {
                  if (noteAtFret(s, f) === missingNote) { extFrets.push(f); break; }
                }
              }
            }
            if (extFrets.length > 0) {
              extensions.push({ frets: extFrets, note: missingNote });
            }
          }
        }
        
        results.push({ names, explanations, bassNote, notes: playedNotes, extensions });
      }
    }
  }

  // Also check for enharmonic equivalents (e.g., G6 = Em7)
  // Find pairs that share the same pitch class set
  const seen = new Set<string>();
  const deduped: typeof results = [];
  for (const r of results) {
    const key = r.names[0];
    if (!seen.has(key)) {
      seen.add(key);
      // Find other names for same pitch set
      for (const r2 of results) {
        if (r2 !== r && !r.names.includes(r2.names[0])) {
          const pcs1 = new Set(r.notes.map(n => NOTE_NAMES.indexOf(n)));
          const pcs2 = new Set(r2.notes.map(n => NOTE_NAMES.indexOf(n)));
          if (pcs1.size === pcs2.size && [...pcs1].every(p => pcs2.has(p))) {
            r.names.push(r2.names[0]);
            r.explanations.push(`Also known as ${r2.names[0]} — same notes, different root.`);
            seen.add(r2.names[0]);
          }
        }
      }
      deduped.push(r);
    }
  }

  return deduped;
}

// Chord categories for NoteInfoPanel
export const CHORD_CATEGORIES: { label: string; types: string[] }[] = [
  { label: 'Triads', types: ['Major', 'Minor', 'Diminished', 'Augmented', 'Sus2', 'Sus4'] },
  { label: '7ths', types: ['Major 7', 'Minor 7', 'Dominant 7', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Aug 7', '7sus4'] },
  { label: 'Extensions', types: ['Add9', 'Major 9', 'Minor 9', 'Dominant 9', '7#9', '7♭9', '7#5', '7♭5', '11', 'Minor 11', '13', 'Minor 13'] },
  { label: '6ths', types: ['Major 6', 'Minor 6'] },
  { label: 'Power', types: ['Power (5)'] },
];

// ============================================================
// DIATONIC CHORD SYSTEM
// ============================================================

// Scale degree colors matching the theory/coloring-system
export const SCALE_DEGREE_COLORS = [
  '120, 70%, 45%',   // I   - green
  '220, 15%, 55%',   // II  - grey
  '0, 75%, 55%',     // III - red
  '330, 70%, 60%',   // IV  - pink
  '210, 85%, 55%',   // V   - blue
  '175, 65%, 45%',   // VI  - turquoise
  '30, 90%, 55%',    // VII - orange
];

export const ROMAN_NUMERALS_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const ROMAN_NUMERALS_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
export const ROMAN_NUMERALS = ROMAN_NUMERALS_MAJOR; // backward compat

// Major scale intervals for building diatonic chords
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

// Diatonic chord qualities in a major key
const DIATONIC_QUALITIES_MAJOR: { type: string; symbol: string }[] = [
  { type: 'Major', symbol: '' },
  { type: 'Minor', symbol: 'm' },
  { type: 'Minor', symbol: 'm' },
  { type: 'Major', symbol: '' },
  { type: 'Major', symbol: '' },
  { type: 'Minor', symbol: 'm' },
  { type: 'Diminished', symbol: '°' },
];

const DIATONIC_QUALITIES_MINOR: { type: string; symbol: string }[] = [
  { type: 'Minor', symbol: 'm' },
  { type: 'Diminished', symbol: '°' },
  { type: 'Major', symbol: '' },
  { type: 'Minor', symbol: 'm' },
  { type: 'Minor', symbol: 'm' },
  { type: 'Major', symbol: '' },
  { type: 'Major', symbol: '' },
];

const DIATONIC_QUALITIES = DIATONIC_QUALITIES_MAJOR; // backward compat

export type KeyMode = 'major' | 'minor';

export interface DiatonicChord {
  degree: number; // 0-6
  root: NoteName;
  type: string;
  roman: string;
  symbol: string; // e.g. "Em", "G", "F#°"
}

export function getDiatonicChords(key: NoteName, keyMode: KeyMode = 'major'): DiatonicChord[] {
  const keyIndex = NOTE_NAMES.indexOf(key);
  const scale = keyMode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const qualities = keyMode === 'minor' ? DIATONIC_QUALITIES_MINOR : DIATONIC_QUALITIES_MAJOR;
  const numerals = keyMode === 'minor' ? ROMAN_NUMERALS_MINOR : ROMAN_NUMERALS_MAJOR;
  return scale.map((interval, degree) => {
    const rootIndex = (keyIndex + interval) % 12;
    const root = NOTE_NAMES[rootIndex];
    const quality = qualities[degree];
    return {
      degree,
      root,
      type: quality.type,
      roman: numerals[degree],
      symbol: `${root}${quality.symbol}`,
    };
  });
}

export interface ChordVariation {
  root: NoteName;
  type: string;
  label: string;
  isDiatonic: boolean;
  borrowedFrom?: string; // explanation if borrowed
}

export function getChordVariations(key: NoteName, degree: number, keyMode: KeyMode = 'major'): ChordVariation[] {
  const keyIndex = NOTE_NAMES.indexOf(key);
  const scale = keyMode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const qualities = keyMode === 'minor' ? DIATONIC_QUALITIES_MINOR : DIATONIC_QUALITIES_MAJOR;
  const rootInterval = scale[degree];
  const root = NOTE_NAMES[(keyIndex + rootInterval) % 12];
  const quality = qualities[degree];
  const variations: ChordVariation[] = [];

  // Diatonic variations
  const diatonicTypes: { type: string; label: string }[] = [];

  if (quality.type === 'Major') {
    diatonicTypes.push(
      { type: 'Major', label: `${root}` },
      { type: 'Major 7', label: `${root}maj7` },
      { type: 'Add9', label: `${root}add9` },
      { type: 'Sus2', label: `${root}sus2` },
      { type: 'Sus4', label: `${root}sus4` },
      { type: 'Major 6', label: `${root}6` },
    );
    // Dominant for V
    if (degree === 4) {
      diatonicTypes.push(
        { type: 'Dominant 7', label: `${root}7` },
        { type: 'Dominant 9', label: `${root}9` },
        { type: '7sus4', label: `${root}7sus4` },
      );
    }
    if (degree === 0) {
      diatonicTypes.push({ type: 'Major 9', label: `${root}maj9` });
    }
  } else if (quality.type === 'Minor') {
    diatonicTypes.push(
      { type: 'Minor', label: `${root}m` },
      { type: 'Minor 7', label: `${root}m7` },
      { type: 'Minor 9', label: `${root}m9` },
      { type: 'Minor 6', label: `${root}m6` },
    );
  } else if (quality.type === 'Diminished') {
    diatonicTypes.push(
      { type: 'Diminished', label: `${root}°` },
      { type: 'Half-Dim 7', label: `${root}ø7` },
    );
  }

  for (const dt of diatonicTypes) {
    variations.push({ root, type: dt.type, label: dt.label, isDiatonic: true });
  }

  // Borrowed chords (modal interchange)
  const borrowed: { type: string; label: string; from: string }[] = [];

  if (quality.type === 'Major' && degree === 3) {
    // IV → iv minor (borrowed from parallel minor)
    borrowed.push({ type: 'Minor', label: `${root}m`, from: 'Parallel minor (Aeolian)' });
    borrowed.push({ type: 'Minor 7', label: `${root}m7`, from: 'Parallel minor (Aeolian)' });
  }
  if (quality.type === 'Major' && degree === 0) {
    // I → i minor is rare but possible
    borrowed.push({ type: 'Minor', label: `${root}m`, from: 'Parallel minor — dramatic tonal shift' });
  }
  if (quality.type === 'Major' && degree === 4) {
    // V → v minor (borrowed from Mixolydian/Aeolian)
    borrowed.push({ type: 'Minor', label: `${root}m`, from: 'Parallel minor (Aeolian)' });
    // V → V7#9 (Hendrix chord)
    borrowed.push({ type: '7#9', label: `${root}7#9`, from: 'Blues/Hendrix chord — dominant with minor 3rd on top' });
  }
  if (quality.type === 'Minor' && degree === 1) {
    // ii → II major (secondary dominant approach)
    borrowed.push({ type: 'Major', label: `${root}`, from: 'Secondary dominant (V/V) — used as II' });
    borrowed.push({ type: 'Dominant 7', label: `${root}7`, from: 'Secondary dominant (V7/V)' });
  }
  if (quality.type === 'Minor' && degree === 2) {
    // iii → III major (borrowed from Mixolydian)
    borrowed.push({ type: 'Major', label: `${root}`, from: 'Borrowed from Mixolydian mode' });
  }
  if (quality.type === 'Minor' && degree === 5) {
    // vi → VI major (borrowed from Lydian/parallel)
    borrowed.push({ type: 'Major', label: `${root}`, from: 'Borrowed from parallel major context' });
    borrowed.push({ type: 'Dominant 7', label: `${root}7`, from: 'Secondary dominant (V7/ii)' });
  }
  // Minor key: v → V major (borrowed from harmonic minor)
  if (keyMode === 'minor' && quality.type === 'Minor' && degree === 4) {
    borrowed.push({ type: 'Major', label: `${root}`, from: 'Harmonic minor — raised 7th creates major V' });
    borrowed.push({ type: 'Dominant 7', label: `${root}7`, from: 'Harmonic minor — V7 with leading tone' });
    borrowed.push({ type: 'Dominant 9', label: `${root}9`, from: 'Harmonic minor — V9' });
    borrowed.push({ type: '7#9', label: `${root}7#9`, from: 'Blues/Hendrix chord over minor V' });
  }
  // Minor key: III → III+ augmented (from harmonic minor)
  if (keyMode === 'minor' && quality.type === 'Major' && degree === 2) {
    borrowed.push({ type: 'Augmented', label: `${root}+`, from: 'Harmonic minor — augmented III' });
  }
  // Minor key: iv → IV major (borrowed from Dorian)
  if (keyMode === 'minor' && quality.type === 'Minor' && degree === 3) {
    borrowed.push({ type: 'Major', label: `${root}`, from: 'Dorian mode — major IV in minor key' });
    borrowed.push({ type: 'Dominant 7', label: `${root}7`, from: 'Dorian mode — IV7' });
  }
  // bVII chord (borrowed from Mixolydian)
  if (degree === 6) {
    const bVIIRoot = NOTE_NAMES[(keyIndex + 10) % 12];
    borrowed.push({ type: 'Major', label: `${bVIIRoot}`, from: 'Borrowed from Mixolydian — ♭VII' });
    borrowed.push({ type: 'Dominant 7', label: `${bVIIRoot}7`, from: 'Borrowed from Mixolydian — ♭VII7' });
  }

  for (const b of borrowed) {
    variations.push({ root: b.label.match(/^([A-G]#?)/)?.[1] as NoteName || root, type: b.type, label: b.label, isDiatonic: false, borrowedFrom: b.from });
  }

  return variations;
}

// Determine the scale degree of a chord in a given key (returns -1 if not diatonic)
export function getChordDegree(key: NoteName, chordRoot: NoteName, chordType: string, keyMode: KeyMode = 'major'): number {
  const keyIndex = NOTE_NAMES.indexOf(key);
  const rootIndex = NOTE_NAMES.indexOf(chordRoot);
  const interval = (rootIndex - keyIndex + 12) % 12;
  const scale = keyMode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const qualities = keyMode === 'minor' ? DIATONIC_QUALITIES_MINOR : DIATONIC_QUALITIES_MAJOR;
  
  for (let d = 0; d < scale.length; d++) {
    if (scale[d] === interval) {
      const expected = qualities[d];
      if (expected.type === chordType) return d;
      if (expected.type === 'Major' && ['Major 7', 'Dominant 7', 'Add9', 'Sus2', 'Sus4', 'Major 6', 'Major 9', 'Dominant 9', '7sus4'].includes(chordType)) return d;
      if (expected.type === 'Minor' && ['Minor 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'].includes(chordType)) return d;
      if (expected.type === 'Diminished' && ['Dim 7', 'Half-Dim 7'].includes(chordType)) return d;
      return d;
    }
  }
  return -1;
}

// ============================================================
// CHORD PROGRESSION ANALYSIS — explains non-diatonic chords
// ============================================================

export interface ChordAnalysis {
  chord: { root: NoteName; chordType: string };
  roman: string;
  isDiatonic: boolean;
  explanation: string;
  passingChordSuggestion?: string;
}

export function analyzeProgression(key: NoteName, keyMode: KeyMode, chords: { root: NoteName; chordType: string }[]): ChordAnalysis[] {
  const keyIndex = NOTE_NAMES.indexOf(key);
  const scale = keyMode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const qualities = keyMode === 'minor' ? DIATONIC_QUALITIES_MINOR : DIATONIC_QUALITIES_MAJOR;
  const numerals = keyMode === 'minor' ? ROMAN_NUMERALS_MINOR : ROMAN_NUMERALS_MAJOR;
  
  const formatRoman = (root: NoteName, type: string, degree: number, isDiatonic: boolean): string => {
    if (isDiatonic && degree >= 0) return numerals[degree];
    // Non-diatonic: figure out the roman numeral with accidentals
    const rootIdx = NOTE_NAMES.indexOf(root);
    const interval = (rootIdx - keyIndex + 12) % 12;
    // Find closest scale degree
    const prefixes = ['', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];
    const isMinorChord = ['Minor', 'Minor 7', 'Minor 9', 'Minor 6', 'Minor 11'].includes(type);
    const isDim = ['Diminished', 'Dim 7', 'Half-Dim 7'].includes(type);
    let numeral = prefixes[interval] || '?';
    if (isMinorChord) numeral = numeral.toLowerCase();
    if (isDim) numeral = numeral.toLowerCase() + '°';
    return numeral;
  };

  return chords.map((chord, idx) => {
    const degree = getChordDegree(key, chord.root, chord.chordType, keyMode);
    const isDiatonic = degree >= 0;
    const rootIdx = NOTE_NAMES.indexOf(chord.root);
    const interval = (rootIdx - keyIndex + 12) % 12;
    const roman = formatRoman(chord.root, chord.chordType, degree, isDiatonic);
    
    let explanation = '';
    let passingChordSuggestion: string | undefined;

    if (isDiatonic) {
      // Standard diatonic function
      const functions: Record<number, string> = keyMode === 'major' ? {
        0: 'Tonic — home base, resolution point',
        1: 'Supertonic — pre-dominant, sets up V',
        2: 'Mediant — connects I and V, ambiguous quality',
        3: 'Subdominant — creates motion away from tonic',
        4: 'Dominant — strongest pull back to tonic',
        5: 'Submediant — relative minor, deceptive resolution target',
        6: 'Leading tone — diminished, strong pull to I',
      } : {
        0: 'Tonic — minor home base, dark resolution',
        1: 'Supertonic — diminished, unstable, pre-dominant',
        2: 'Mediant — relative major, bright contrast',
        3: 'Subdominant — minor subdominant, plaintive quality',
        4: 'Dominant — minor v, weaker pull than V7',
        5: 'Submediant — major chord, bright colour in minor',
        6: 'Subtonic — whole step below tonic, modal quality',
      };
      explanation = functions[degree] || '';
    } else {
      // Non-diatonic analysis — wrap around to first chord for looping
      const nextChord = idx < chords.length - 1 ? chords[idx + 1] : (chords.length > 1 ? chords[0] : null);
      const nextDegree = nextChord ? getChordDegree(key, nextChord.root, nextChord.chordType, keyMode) : -1;
      const nextRootIdx = nextChord ? NOTE_NAMES.indexOf(nextChord.root) : -1;
      
      const isDom7 = ['Dominant 7', 'Dominant 9', '7#9', '7♭9', '7#5', '7♭5', '13', '11'].includes(chord.chordType);
      
      // Check for tritone substitution: dominant chord a tritone from the next chord's V
      if (isDom7 && nextChord) {
        const tritoneInterval = (rootIdx - nextRootIdx + 12) % 12;
        if (tritoneInterval === 1) {
          // This chord is a half step above the next — tritone sub
          explanation = `Tritone substitution — replaces V7 of ${nextChord.root}. The ♭5 of the original dominant shares the same tritone interval, creating smooth chromatic voice leading into the resolution.`;
        } else if ((rootIdx - nextRootIdx + 12) % 12 === 7) {
          // Secondary dominant (V/next)
          const nextNumeral = nextDegree >= 0 ? numerals[nextDegree] : nextChord.root;
          explanation = `Secondary dominant — V7/${nextNumeral}. Temporarily tonicizes ${nextChord.root} by acting as its dominant, creating a momentary key change.`;
        }
      }
      
      if (!explanation && isDom7) {
        // Check if it's V7/something
        for (let d = 0; d < 7; d++) {
          const targetRoot = NOTE_NAMES[(keyIndex + scale[d]) % 12];
          const targetRootIdx = NOTE_NAMES.indexOf(targetRoot);
          if ((rootIdx - targetRootIdx + 12) % 12 === 7) {
            explanation = `Secondary dominant — V7/${numerals[d]}. Borrows dominant function to temporarily tonicize ${targetRoot}.`;
            break;
          }
        }
      }
      
      if (!explanation) {
        // Check for harmonic minor V (major V chord in minor key)
        if (keyMode === 'minor' && interval === 7 && ['Major', 'Major 7', 'Dominant 7', 'Dominant 9', '7#9', '7♭9'].includes(chord.chordType)) {
          explanation = `Harmonic minor V — borrowed from harmonic minor. The raised 7th degree creates a leading tone, giving the V chord dominant function for a stronger resolution to i.`;
        }
      }
      
      if (!explanation) {
        // Check for borrowed chord (modal interchange)
        const parallelScale = keyMode === 'major' ? MINOR_SCALE : MAJOR_SCALE;
        const parallelQualities = keyMode === 'major' ? DIATONIC_QUALITIES_MINOR : DIATONIC_QUALITIES_MAJOR;
        for (let d = 0; d < parallelScale.length; d++) {
          if (parallelScale[d] === interval) {
            const pq = parallelQualities[d];
            if (pq.type === chord.chordType || 
                (pq.type === 'Major' && ['Major 7', 'Add9'].includes(chord.chordType)) ||
                (pq.type === 'Minor' && ['Minor 7', 'Minor 9'].includes(chord.chordType))) {
              const source = keyMode === 'major' ? 'parallel minor (Aeolian)' : 'parallel major (Ionian)';
              explanation = `Borrowed chord — from ${source}. Modal interchange adds colour by temporarily shifting the tonal centre.`;
              break;
            }
          }
        }
      }
      
      // Dorian IV in minor key
      if (!explanation && keyMode === 'minor' && interval === 5 && ['Major', 'Major 7', 'Dominant 7'].includes(chord.chordType)) {
        explanation = `Borrowed from Dorian mode — major IV chord in minor key. Adds brightness and is characteristic of folk, rock, and modal jazz.`;
      }
      
      if (!explanation) {
        // Chromatic approach
        if (nextChord && Math.abs(interval - ((nextRootIdx - keyIndex + 12) % 12)) === 1) {
          explanation = `Chromatic approach chord — slides by half step into ${nextChord.root}. Creates tension through chromatic voice leading.`;
        }
      }
      
      if (!explanation) {
        explanation = `Non-diatonic chord — outside the key of ${key} ${keyMode}. May function as a colour chord or chromatic passing harmony.`;
      }
      
      // Suggest passing chord between this and next
      if (nextChord && idx < chords.length - 1) {
        const gap = (nextRootIdx - rootIdx + 12) % 12;
        if (gap === 2) {
          const passingRoot = NOTE_NAMES[(rootIdx + 1) % 12];
          passingChordSuggestion = `Try ${passingRoot}dim7 as a chromatic passing chord`;
        } else if (gap > 2) {
          const vOfNext = NOTE_NAMES[(nextRootIdx + 7) % 12];
          passingChordSuggestion = `Try ${vOfNext}7 as a secondary dominant (V7/${nextChord.root})`;
        }
      }
    }

    return { chord, roman, isDiatonic, explanation, passingChordSuggestion };
  });
}

// ============================================================
// TENSION SUGGESTIONS — scales/arpeggios that work over a chord in context
// ============================================================

export interface TensionSuggestion {
  name: string;
  type: 'scale' | 'arpeggio';
  root: NoteName;
  description: string;
  tension: 'consonant' | 'mild' | 'strong';
}

export function getTensionSuggestions(key: NoteName, chordRoot: NoteName, chordType: string): TensionSuggestion[] {
  const suggestions: TensionSuggestion[] = [];
  const degree = getChordDegree(key, chordRoot, chordType);
  const root = chordRoot;

  // Chord tones arpeggio (always first)
  suggestions.push({ name: chordType, type: 'arpeggio', root, description: 'Chord tones — safest choice', tension: 'consonant' });

  // Based on chord quality and degree
  const isMajor = ['Major', 'Major 7', 'Add9', 'Major 9', 'Major 6'].includes(chordType);
  const isMinor = ['Minor', 'Minor 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'].includes(chordType);
  const isDom = ['Dominant 7', 'Dominant 9', '7sus4', '7#9', '7♭9', '7#5', '7♭5', '11', '13'].includes(chordType);
  const isDim = ['Diminished', 'Dim 7', 'Half-Dim 7'].includes(chordType);

  if (isMajor) {
    if (degree === 0) {
      suggestions.push({ name: 'Major (Ionian)', type: 'scale', root: key, description: 'Parent scale — natural fit', tension: 'consonant' });
      suggestions.push({ name: 'Lydian', type: 'scale', root, description: '#4 adds brightness and float', tension: 'mild' });
      suggestions.push({ name: 'Pentatonic Major', type: 'scale', root, description: 'No avoid notes, always safe', tension: 'consonant' });
    } else if (degree === 3) {
      suggestions.push({ name: 'Lydian', type: 'scale', root, description: '#4 avoids the avoid note — preferred over Ionian', tension: 'consonant' });
      suggestions.push({ name: 'Major (Ionian)', type: 'scale', root, description: 'Natural 4th clashes with 3rd — use carefully', tension: 'mild' });
      suggestions.push({ name: 'Mixolydian', type: 'scale', root, description: 'Adds ♭7 colour — hint of dominant', tension: 'mild' });
    } else {
      suggestions.push({ name: 'Major (Ionian)', type: 'scale', root: key, description: 'Parent scale', tension: 'consonant' });
      suggestions.push({ name: 'Pentatonic Major', type: 'scale', root, description: 'Safe pentatonic', tension: 'consonant' });
    }
  }

  if (isMinor) {
    if (degree === 1) {
      suggestions.push({ name: 'Dorian', type: 'scale', root, description: 'Natural choice for ii — bright minor with ♮6', tension: 'consonant' });
      suggestions.push({ name: 'Pentatonic Minor', type: 'scale', root, description: 'Safe minor pentatonic', tension: 'consonant' });
      suggestions.push({ name: 'Blues', type: 'scale', root, description: 'Add blue note for grit', tension: 'mild' });
    } else if (degree === 2) {
      suggestions.push({ name: 'Phrygian', type: 'scale', root, description: 'Natural iii mode — dark, Spanish flavour', tension: 'consonant' });
      suggestions.push({ name: 'Natural Minor (Aeolian)', type: 'scale', root, description: 'Standard minor sound', tension: 'mild' });
    } else if (degree === 5) {
      suggestions.push({ name: 'Natural Minor (Aeolian)', type: 'scale', root, description: 'Natural vi mode', tension: 'consonant' });
      suggestions.push({ name: 'Dorian', type: 'scale', root, description: 'Brighter minor with ♮6', tension: 'mild' });
      suggestions.push({ name: 'Pentatonic Minor', type: 'scale', root, description: 'Always works over minor', tension: 'consonant' });
    } else {
      suggestions.push({ name: 'Dorian', type: 'scale', root, description: 'Versatile minor mode', tension: 'consonant' });
      suggestions.push({ name: 'Pentatonic Minor', type: 'scale', root, description: 'Safe pentatonic', tension: 'consonant' });
      suggestions.push({ name: 'Melodic Minor', type: 'scale', root, description: 'Jazz minor — smooth ascending sound', tension: 'mild' });
    }
    // Arpeggio extensions
    suggestions.push({ name: 'Minor 7', type: 'arpeggio', root, description: 'Extend to m7 for jazz colour', tension: 'consonant' });
    suggestions.push({ name: 'Minor 9', type: 'arpeggio', root, description: 'Add 9th for smooth neo-soul flavour', tension: 'mild' });
  }

  if (isDom) {
    if (degree === 4) {
      suggestions.push({ name: 'Mixolydian', type: 'scale', root, description: 'Standard V7 choice — ♭7 matches chord', tension: 'consonant' });
      suggestions.push({ name: 'Blues', type: 'scale', root, description: 'Blues over dominant — classic sound', tension: 'mild' });
      suggestions.push({ name: 'Bebop Dominant', type: 'scale', root, description: 'Chromatic passing tone keeps chord tones on beats', tension: 'mild' });
    } else {
      suggestions.push({ name: 'Mixolydian', type: 'scale', root, description: 'Standard dominant scale', tension: 'consonant' });
    }
    if (['7#9', '7♭9', '7#5', '7♭5'].includes(chordType)) {
      suggestions.push({ name: 'Superlocrian (Altered)', type: 'scale', root, description: 'THE altered scale — all tensions altered', tension: 'strong' });
      suggestions.push({ name: 'Diminished (HW)', type: 'scale', root, description: 'Symmetric diminished — works over altered doms', tension: 'strong' });
      suggestions.push({ name: 'Whole Tone', type: 'scale', root, description: 'Dreamy, floating — all whole steps', tension: 'strong' });
    }
    suggestions.push({ name: 'Lydian Dominant', type: 'scale', root, description: '#4 over dominant — Coltrane\'s favourite', tension: 'strong' });
    suggestions.push({ name: 'Phrygian Dominant', type: 'scale', root, description: '♭2 gives Middle Eastern tension over V', tension: 'strong' });
    suggestions.push({ name: 'Dominant 7', type: 'arpeggio', root, description: 'Outline the chord tones', tension: 'consonant' });
  }

  if (isDim) {
    suggestions.push({ name: 'Locrian', type: 'scale', root, description: 'Natural mode for vii° — darkest diatonic mode', tension: 'consonant' });
    suggestions.push({ name: 'Locrian ♮2', type: 'scale', root, description: 'Half-dim with natural 2nd — smoother', tension: 'mild' });
    suggestions.push({ name: 'Diminished (HW)', type: 'scale', root, description: 'Symmetric diminished over dim7', tension: 'mild' });
    suggestions.push({ name: 'Half-Dim 7', type: 'arpeggio', root, description: 'ø7 arpeggio outlines the chord', tension: 'consonant' });
  }

  // Non-diatonic chord — general suggestions
  if (degree < 0) {
    suggestions.push({ name: 'Pentatonic Minor', type: 'scale', root, description: 'Safe choice for outside chords', tension: 'consonant' });
    suggestions.push({ name: 'Blues', type: 'scale', root, description: 'Blues always works', tension: 'mild' });
    if (isMajor) suggestions.push({ name: 'Lydian', type: 'scale', root, description: 'Bright outside colour', tension: 'mild' });
    if (isDom) suggestions.push({ name: 'Superlocrian (Altered)', type: 'scale', root, description: 'Altered scale for outside dominants', tension: 'strong' });
  }

  return suggestions;
}

// Get chord tones (note indices) for a given chord
export function getChordTones(root: NoteName, chordType: string): number[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return [];
  const rootIdx = NOTE_NAMES.indexOf(root);
  return formula.map(interval => (rootIdx + (interval % 12)) % 12);
}
