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

// Extended interval name (for chords with 9th, 11th, 13th)
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
    if (fret >= 0) {
      result.push({ stringIndex, fret, note: noteAtFret(stringIndex, fret) });
    }
  });
  return result;
}

// ============================================================
// VOICING GENERATORS
// ============================================================

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
        if (chordTonesSet.has((STANDARD_TUNING[s] + f) % 12)) {
          opts.push(f);
        }
      }
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

        const present = new Set<number>();
        current.forEach((f, i) => { if (f >= 0) present.add((STANDARD_TUNING[i] + f) % 12); });
        let count = 0;
        for (const t of chordTones) { if (present.has(t)) count++; }
        if (count < minRequired) return;

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

  // Sort: prefer root in bass, fewer muted strings, lower position
  results.sort((a, b) => {
    const aFirst = a.findIndex(f => f >= 0);
    const bFirst = b.findIndex(f => f >= 0);
    const aHasRoot = aFirst >= 0 && (STANDARD_TUNING[aFirst] + a[aFirst]) % 12 === rootIdx % 12;
    const bHasRoot = bFirst >= 0 && (STANDARD_TUNING[bFirst] + b[bFirst]) % 12 === rootIdx % 12;
    if (aHasRoot !== bHasRoot) return aHasRoot ? -1 : 1;
    // Prefer more strings played
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

export function generateShellVoicings(root: NoteName, chordType: string): number[][] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return [];

  const rootIdx = NOTE_NAMES.indexOf(root);
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
  const rootStrings = [0, 1, 2];

  for (const rootStr of rootStrings) {
    for (let baseFret = 0; baseFret <= 14; baseFret++) {
      if ((STANDARD_TUNING[rootStr] + baseFret) % 12 !== shellTones[0]) continue;

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

export const CHORD_VOICINGS: Record<string, Record<string, number[][]>> = {};
export const SHELL_VOICINGS: Record<string, Record<string, number[][]>> = {};

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

// Degree color map — fixed colors per user spec
// Root=green, 3rd=red, 5th=blue, 7th=orange, 9th=light grey, 11th=pink, 13th=turquoise
export const DEGREE_COLORS: Record<string, string> = {
  'R':  '130 70% 45%',     // green
  '♭2': '20 60% 50%',
  '2':  '0 0% 65%',        // light grey (same as 9th)
  '♭3': '350 70% 50%',
  '3':  '0 85% 55%',       // red
  '4':  '330 75% 60%',     // pink (same as 11th)
  '♭5': '200 60% 50%',
  '5':  '215 85% 55%',     // blue
  '♭6': '175 60% 45%',
  '6':  '175 75% 50%',     // turquoise (same as 13th)
  '♭7': '25 85% 55%',      // orange-ish
  '7':  '30 90% 55%',      // orange
  '9':  '0 0% 65%',        // light grey
  '♭9': '20 60% 50%',
  '11': '330 75% 60%',     // pink
  '♭13':'175 60% 45%',
  '13': '175 75% 50%',     // turquoise
};

// Degree legend entries for display (ordered)
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