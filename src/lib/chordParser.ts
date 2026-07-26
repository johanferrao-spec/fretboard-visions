import type { NoteName } from './music';
import { NOTE_NAMES } from './music';

export interface ParsedChord {
  root: NoteName;
  quality: string; // matches values used in CHORD_QUALITIES (Major / Minor / Dominant 7 / Major 7 / Minor 7 / Diminished / Augmented / Sus2 / Sus4 …)
  /** Slash-chord bass note, e.g. "C/E" → bass "E". */
  bass?: NoteName;
  raw: string;
}

const ROOT_REGEX = /^([A-Ga-g])(#|b|♯|♭)?/;


const SUFFIX_MAP: { test: RegExp; quality: string }[] = [
  { test: /^maj13/i, quality: 'Maj13' },
  { test: /^maj11/i, quality: 'Maj11' },
  { test: /^maj9/i, quality: 'Major 9' },
  { test: /^maj7|^M7|^Δ7?/, quality: 'Major 7' },
  { test: /^m7b5|^ø/i, quality: 'Half-Dim 7' },
  { test: /^m7|^min7/i, quality: 'Minor 7' },
  { test: /^m9|^min9/i, quality: 'Minor 9' },
  { test: /^m11|^min11/i, quality: 'Minor 11' },
  { test: /^m6|^min6/i, quality: 'Minor 6' },
  { test: /^madd9|^minadd9/i, quality: 'Madd9' },
  { test: /^msus4|^minsus4/i, quality: 'Sus4' },
  { test: /^m\b|^min\b|^m$|^min$/i, quality: 'Minor' },
  { test: /^dim7|^°7|^o7/i, quality: 'Dim 7' },
  { test: /^dim|^°|^o\b/i, quality: 'Diminished' },
  { test: /^aug7|^\+7/i, quality: 'Aug 7' },
  { test: /^aug|^\+/i, quality: 'Augmented' },
  { test: /^13/, quality: '13' },
  { test: /^11/, quality: '11' },
  { test: /^9/, quality: 'Dominant 9' },
  { test: /^7sus4/i, quality: '7sus4' },
  { test: /^7/, quality: 'Dominant 7' },
  { test: /^6add9/i, quality: '6add9' },
  { test: /^6/, quality: 'Major 6' },
  { test: /^add9/i, quality: 'Add9' },
  { test: /^sus2/i, quality: 'Sus2' },
  { test: /^sus4|^sus/i, quality: 'Sus4' },
  { test: /^5/, quality: 'Power (5)' },
];

const noteToSharp = (letter: string, acc: string): NoteName | null => {
  const L = letter.toUpperCase();
  let s = L;
  if (acc === '#' || acc === '♯') s = `${L}#`;
  else if (acc === 'b' || acc === '♭') {
    const flatToSharp: Record<string, NoteName> = {
      'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B', 'Fb': 'E',
    };
    s = flatToSharp[`${L}b`] ?? L;
  }
  return NOTE_NAMES.includes(s as NoteName) ? (s as NoteName) : null;
};

export function parseChordSymbol(input: string): ParsedChord | null {
  let trimmed = input.trim();
  if (!trimmed) return null;

  // Slash chord: only a trailing "/<note>" counts (so "6/9" stays an extension).
  let bass: NoteName | undefined;
  const slash = trimmed.match(/\/([A-Ga-g])(#|b|♯|♭)?\s*$/);
  if (slash) {
    const b = noteToSharp(slash[1], slash[2] ?? '');
    if (b) {
      bass = b;
      trimmed = trimmed.slice(0, slash.index).trim();
    }
  }

  const m = trimmed.match(ROOT_REGEX);
  if (!m) return null;
  const root = noteToSharp(m[1], m[2] ?? '');
  if (!root) return null;
  const rest = trimmed.slice(m[0].length);
  const raw = input.trim();
  if (rest.length === 0) return { root, quality: 'Major', bass, raw };
  for (const s of SUFFIX_MAP) {
    if (s.test.test(rest)) return { root, quality: s.quality, bass, raw };
  }
  // Unknown suffix → assume Major
  return { root, quality: 'Major', bass, raw };
}


export function chordToShortLabel(root: NoteName, quality: string): string {
  const map: Record<string, string> = {
    'Major': '',
    'Minor': 'm',
    'Dominant 7': '7',
    'Major 7': 'maj7',
    'Minor 7': 'm7',
    'Major 9': 'maj9',
    'Dominant 9': '9',
    'Minor 9': 'm9',
    'Diminished': '°',
    'Dim 7': '°7',
    'Half-Dim 7': 'm7♭5',
    'Augmented': '+',
    'Aug 7': '+7',
    'Sus2': 'sus2',
    'Sus4': 'sus4',
    '7sus4': '7sus4',
    'Add9': 'add9',
    'Major 6': '6',
    'Minor 6': 'm6',
    '6add9': '6add9',
    'Madd9': 'madd9',
    '11': '11',
    '13': '13',
    'Maj11': 'maj11',
    'Maj13': 'maj13',
    'Power (5)': '5',
    'Minor 11': 'm11',
    'Minor 13': 'm13',
  };
  return `${root}${map[quality] ?? quality}`;
}
