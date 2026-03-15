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

// ============================================================
// VOICING GENERATORS
// ============================================================

/**
 * Generate playable chord voicings algorithmically.
 * Constraint: no two fretted notes more than 4 frets apart.
 * Returns up to `limit` unique voicings sorted by position.
 */
export function generatePlayableVoicings(
  root: NoteName,
  chordType: string,
  maxFretSearch: number = 14,
  limit: number = 24,
): number[][] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return [];

  const rootIdx = NOTE_NAMES.indexOf(root);
  const chordTones = [...new Set(formula.map(i => (rootIdx + i) % 12))];
  const chordTonesSet = new Set(chordTones);
  const minRequired = Math.min(chordTones.length, 4); // need at least this many unique tones

  const results: number[][] = [];
  const seen = new Set<string>();

  for (let baseFret = 0; baseFret <= maxFretSearch && results.length < limit * 3; baseFret++) {
    const lo = baseFret;
    const hi = baseFret + 4;

    // Per-string options in this window
    const perString: number[][] = [];
    for (let s = 0; s < 6; s++) {
      const opts: number[] = [-1];
      for (let f = lo; f <= Math.min(hi, 24); f++) {
        if (chordTonesSet.has((STANDARD_TUNING[s] + f) % 12)) {
          opts.push(f);
        }
      }
      // Also allow open strings when base is low
      if (lo > 0 && lo <= 4) {
        if (chordTonesSet.has(STANDARD_TUNING[s] % 12) && !opts.includes(0)) {
          opts.push(0);
        }
      }
      perString.push(opts);
    }

    const search = (s: number, current: number[]) => {
      if (results.length >= limit * 3) return;
      if (s === 6) {
        const played = current.filter(f => f >= 0);
        if (played.length < Math.max(3, minRequired)) return;

        // All required tones present?
        const present = new Set<number>();
        current.forEach((f, i) => { if (f >= 0) present.add((STANDARD_TUNING[i] + f) % 12); });
        let count = 0;
        for (const t of chordTones) { if (present.has(t)) count++; }
        if (count < minRequired) return;

        // Span check
        const fretted = played.filter(f => f > 0);
        if (fretted.length > 1 && Math.max(...fretted) - Math.min(...fretted) > 4) return;

        // No muted middle strings
        let first = -1, last = -1;
        for (let i = 0; i < 6; i++) {
          if (current[i] >= 0) { if (first === -1) first = i; last = i; }
        }
        for (let i = first + 1; i < last; i++) {
          if (current[i] === -1) return;
        }

        const key = current.join(',');
        if (!seen.has(key)) {
          seen.add(key);
          results.push([...current]);
        }
        return;
      }
      for (const fret of perString[s]) {
        current.push(fret);
        search(s + 1, current);
        current.pop();
      }
    };

    search(0, []);
  }

  // Sort: prefer root in bass, then by position
  results.sort((a, b) => {
    const aFirst = a.findIndex(f => f >= 0);
    const bFirst = b.findIndex(f => f >= 0);
    const aHasRoot = aFirst >= 0 && (STANDARD_TUNING[aFirst] + a[aFirst]) % 12 === rootIdx % 12;
    const bHasRoot = bFirst >= 0 && (STANDARD_TUNING[bFirst] + b[bFirst]) % 12 === rootIdx % 12;
    if (aHasRoot !== bHasRoot) return aHasRoot ? -1 : 1;
    const aMin = Math.min(...a.filter(f => f > 0).concat([99]));
    const bMin = Math.min(...b.filter(f => f > 0).concat([99]));
    return aMin - bMin;
  });

  return results.slice(0, limit);
}

/**
 * Drop 2 voicings: Take a close-position 4-note chord, drop the 2nd voice
 * from the top down an octave. Placed on 4 adjacent strings.
 *
 * Close position (bottom to top): R 3 5 7
 * Drop 2 of root pos: 5 R 3 7 (drop the 5 down)
 * Applied to each inversion on adjacent string groups.
 */
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
    // Drop 2nd from top (index 2) to bottom
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
            if ((STANDARD_TUNING[s] + f) % 12 === target) {
              voicing[s] = f;
              frets.push(f);
              found = true;
              break;
            }
          }
          if (!found) { valid = false; break; }
        }

        if (!valid) continue;
        const playedFrets = frets.filter(f => f > 0);
        if (playedFrets.length > 1 && Math.max(...playedFrets) - Math.min(...playedFrets) > 4) continue;

        const key = voicing.join(',');
        if (!seen.has(key)) {
          seen.add(key);
          results.push([...voicing]);
        }
      }
    }
  }

  return results.slice(0, 20);
}

/**
 * Drop 3 voicings: Drop the 3rd voice from the top down an octave.
 * These skip a string, creating wider interval spacing.
 *
 * String groups: {6,5,3,2}, {5,4,2,1} (skipping one string)
 */
export function generateDrop3Voicings(root: NoteName, chordType: string): number[][] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula || formula.length < 4) return [];

  const rootIdx = NOTE_NAMES.indexOf(root);
  const tones = formula.slice(0, 4).map(i => (rootIdx + i) % 12);
  const results: number[][] = [];
  const seen = new Set<string>();
  // Drop 3 typically skips a string
  const stringGroups = [[0,1,3,4], [1,2,4,5], [0,1,4,5]];

  for (let inv = 0; inv < 4; inv++) {
    const invTones = [...tones.slice(inv), ...tones.slice(0, inv)];
    // Drop 3rd from top (index 1) to bottom
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
            if ((STANDARD_TUNING[s] + f) % 12 === target) {
              voicing[s] = f;
              frets.push(f);
              found = true;
              break;
            }
          }
          if (!found) { valid = false; break; }
        }

        if (!valid) continue;
        const playedFrets = frets.filter(f => f > 0);
        if (playedFrets.length > 1 && Math.max(...playedFrets) - Math.min(...playedFrets) > 4) continue;

        const key = voicing.join(',');
        if (!seen.has(key)) {
          seen.add(key);
          results.push([...voicing]);
        }
      }
    }
  }

  return results.slice(0, 20);
}

/**
 * Generate shell voicings for a chord type.
 * Shell voicings use Root + 3rd (or guide tone) + 7th.
 * Placed on string sets rooted on E and A strings.
 */
export function generateShellVoicings(root: NoteName, chordType: string): number[][] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return [];

  const rootIdx = NOTE_NAMES.indexOf(root);
  // For shells we want: root, 3rd (or substitute), 7th (or substitute)
  // Pick root + 2nd interval + last interval for 4-note chords
  // For triads: root + 2nd + 3rd interval
  let shellTones: number[];
  if (formula.length >= 4) {
    shellTones = [formula[0], formula[1], formula[3]].map(i => (rootIdx + i) % 12);
  } else if (formula.length === 3) {
    shellTones = formula.map(i => (rootIdx + i) % 12);
  } else {
    shellTones = formula.map(i => (rootIdx + i) % 12);
  }

  const shellSet = new Set(shellTones);
  const results: number[][] = [];
  const seen = new Set<string>();
  // Root strings: 0 (low E), 1 (A), 2 (D)
  const rootStrings = [0, 1, 2];

  for (const rootStr of rootStrings) {
    for (let baseFret = 0; baseFret <= 14; baseFret++) {
      // Find root on root string
      if ((STANDARD_TUNING[rootStr] + baseFret) % 12 !== shellTones[0]) continue;

      // Find other tones on adjacent higher strings
      const voicing: number[] = [-1, -1, -1, -1, -1, -1];
      voicing[rootStr] = baseFret;
      const usedTones = new Set([shellTones[0]]);

      for (let s = rootStr + 1; s < Math.min(rootStr + 4, 6); s++) {
        for (let f = Math.max(0, baseFret - 2); f <= baseFret + 4; f++) {
          const n = (STANDARD_TUNING[s] + f) % 12;
          if (shellSet.has(n) && !usedTones.has(n)) {
            voicing[s] = f;
            usedTones.add(n);
            break;
          }
        }
      }

      // Check we got all shell tones
      if (usedTones.size < shellTones.length) continue;

      const playedFrets = voicing.filter(f => f > 0);
      if (playedFrets.length > 1 && Math.max(...playedFrets) - Math.min(...playedFrets) > 4) continue;

      const key = voicing.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        results.push([...voicing]);
      }
    }
  }

  return results.slice(0, 16);
}

// Legacy exports for backward compat
export const CHORD_VOICINGS: Record<string, Record<string, number[][]>> = {};
export const SHELL_VOICINGS: Record<string, Record<string, number[][]>> = {};

// Get diatonic chord (stacked thirds) for a note within a scale
export function getDiatonicChord(root: NoteName, scaleName: string, degree: NoteName): { notes: NoteName[]; name: string } {
  const scaleNotes = getScaleNotes(root, scaleName);
  if (scaleNotes.length < 7) return { notes: [], name: '' };
  const degreeIndex = scaleNotes.indexOf(degree);
  if (degreeIndex === -1) return { notes: [], name: '' };

  const chordTones: NoteName[] = [];
  for (let i = 0; i < 4; i++) {
    chordTones.push(scaleNotes[(degreeIndex + i * 2) % scaleNotes.length]);
  }

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

// Degree color map for arpeggios
export const DEGREE_COLORS: Record<string, string> = {
  'R': '0 85% 60%',
  '♭2': '20 75% 50%',
  '2': '45 90% 55%',
  '♭3': '80 70% 45%',
  '3': '120 70% 45%',
  '4': '160 75% 45%',
  '♭5': '185 80% 50%',
  '5': '210 85% 55%',
  '♭6': '240 75% 60%',
  '6': '270 80% 60%',
  '♭7': '310 80% 55%',
  '7': '340 85% 58%',
};
