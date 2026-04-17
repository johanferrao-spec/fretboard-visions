import type { NoteName } from './music';

export type NoteKind = 'diatonic' | 'chord' | 'non-diatonic';

/**
 * A single fretted note (or chord = grouped by same beatIndex) inside a phrase.
 * stringIndex follows the project convention: 0 = low E … 5 = high e.
 */
export interface CourseNote {
  id: string;
  stringIndex: number;
  fret: number;
  /** Index into the 16th-note grid, 0-based. 16ths-per-beat × beat = beatIndex. */
  beatIndex: number;
  /** Duration in 16th-note grid units. */
  durationGrid: number;
}

export interface CoursePhrase {
  notes: CourseNote[];
  /** Total length of the phrase in 16th grid units. Auto-grown as notes are added. */
  lengthGrid: number;
}

export type KeyQuality = 'Major' | 'Minor';

export interface CourseRow {
  id: string;
  user_id: string;
  title: string;
  key_root: NoteName;
  key_quality: KeyQuality;
  time_signature: string;
  tempo: number;
  phrase: CoursePhrase;
  created_at: string;
  updated_at: string;
}

export const KEY_QUALITY_SCALE: Record<KeyQuality, string> = {
  Major: 'Major (Ionian)',
  Minor: 'Natural Minor (Aeolian)',
};

export const NOTE_KIND_COLOR: Record<NoteKind, string> = {
  diatonic: 'hsl(140, 60%, 45%)', // green
  chord: 'hsl(210, 80%, 55%)', // blue
  'non-diatonic': 'hsl(28, 90%, 55%)', // orange
};

export const GRID_PER_BEAT = 4; // 16th-note resolution
