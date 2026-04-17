import type { NoteName } from './music';

export type NoteKind = 'diatonic' | 'chord' | 'non-diatonic';

export interface CourseNote {
  id: string;
  stringIndex: number; // 0 = low E, 5 = high e
  fret: number;
  beatIndex: number;
  durationGrid: number;
}

export interface CoursePhrase {
  notes: CourseNote[];
  lengthGrid: number;
}

export type KeyQuality = 'Major' | 'Minor';

/** Chord lane entry — a chord symbol that lives on the global track. */
export interface ChordTrackEntry {
  id: string;
  beatIndex: number;       // 16th-grid index
  durationGrid: number;
  root: NoteName;
  quality: string;         // e.g. "Major", "Minor 7", "Dominant 7"
}

/** Key change marker — Logic-style global track. */
export interface KeyChangeEntry {
  id: string;
  beatIndex: number;
  root: NoteName;
  quality: KeyQuality;
}

/** Tempo change marker. */
export interface TempoChangeEntry {
  id: string;
  beatIndex: number;
  bpm: number;
}

/** A single tab/lesson within a course. */
export interface CourseTabRow {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  position: number;
  key_root: NoteName;
  key_quality: KeyQuality;
  time_signature: string;
  tempo: number;
  phrase: CoursePhrase;
  chord_track: ChordTrackEntry[];
  key_track: KeyChangeEntry[];
  tempo_track: TempoChangeEntry[];
  created_at: string;
  updated_at: string;
}

/** A course — a collection of tabs/lessons. */
export interface CourseRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  // Course-level defaults (used when creating new tabs):
  key_root: NoteName;
  key_quality: KeyQuality;
  time_signature: string;
  tempo: number;
  created_at: string;
  updated_at: string;
}

export const KEY_QUALITY_SCALE: Record<KeyQuality, string> = {
  Major: 'Major (Ionian)',
  Minor: 'Natural Minor (Aeolian)',
};

export const NOTE_KIND_COLOR: Record<NoteKind, string> = {
  diatonic: 'hsl(140, 60%, 45%)',
  chord: 'hsl(210, 80%, 55%)',
  'non-diatonic': 'hsl(28, 90%, 55%)',
};

export const GRID_PER_BEAT = 4; // 16th-note resolution
