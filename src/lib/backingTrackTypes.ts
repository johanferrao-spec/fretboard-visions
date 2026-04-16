import type { TimelineChord, Genre } from '@/hooks/useSongTimeline';

export type TrackId = 'piano' | 'bass' | 'drums';

export interface MidiNote {
  /** unique id within a track */
  id: string;
  /** start time in beats from track origin */
  startBeat: number;
  /** duration in beats */
  duration: number;
  /** MIDI pitch number (0-127). For drums: 36=kick, 38=snare, 42=hh, 51=ride */
  pitch: number;
  /** velocity 0-127 */
  velocity: number;
}

export interface TrackState {
  id: TrackId;
  name: string;
  notes: MidiNote[];
  intensity: number; // 0..1
  complexity: number; // 0..1
  muted: boolean;
  solo: boolean;
  /** auto-regen on chord change unless user has manually edited */
  manuallyEdited: boolean;
}

export interface BackingTrack {
  id: string;
  name: string;
  createdAt: number;
  bpm: number;
  measures: number;
  genre: Genre;
  chords: TimelineChord[];
  tracks: Record<TrackId, TrackState>;
}

export const DRUM_PITCHES = {
  kick: 36,
  snare: 38,
  hihat: 42,
  ride: 51,
  tom: 45,
} as const;

export const TRACK_COLORS: Record<TrackId, string> = {
  piano: '210, 80%, 60%',
  bass: '30, 80%, 55%',
  drums: '340, 70%, 60%',
};

export const TRACK_LABELS: Record<TrackId, string> = {
  piano: 'Piano',
  bass: 'Bass',
  drums: 'Drums',
};
