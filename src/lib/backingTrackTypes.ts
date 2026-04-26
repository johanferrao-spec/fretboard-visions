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

/**
 * A MIDI region/clip on a track lane. Holds its own notes (in clip-local beat coords).
 */
export interface MidiClip {
  id: string;
  /** Lane start position, in beats */
  startBeat: number;
  /** Length in beats */
  duration: number;
  /** Notes in clip-local beat coordinates (0..duration) */
  notes: MidiNote[];
  /** Source chord id for tooltip / regen */
  sourceChordId?: string;
  /** Optional chord label cached for display */
  label?: string;
}

export interface TrackState {
  id: TrackId;
  name: string;
  /** Region/clip-based content (Logic-style) */
  clips: MidiClip[];
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
  tom1: 45,
  tom2: 47,
  crash: 49,
} as const;

export type DrumPart = 'kick' | 'snare' | 'hihat' | 'ride' | 'tom1' | 'tom2' | 'crash';
export type SamplerInstrument = 'drums' | 'bass' | 'keys';

/** A drummer fill scheduled at a bar position on the drums lane. */
export interface DrumFill {
  id: string;
  /** 0-based bar index where the fill begins */
  startBar: number;
  /** Fill length in bars (1..4). The fill occupies [startBar, startBar+lengthBars). */
  lengthBars: number;
}

export const TRACK_COLORS: Record<TrackId, string> = {
  piano: '210 80% 60%',
  bass: '30 80% 55%',
  drums: '340 70% 60%',
};

export const TRACK_LABELS: Record<TrackId, string> = {
  piano: 'Piano',
  bass: 'Bass',
  drums: 'Drums',
};

/** Flatten clips back to absolute-beat MidiNote list (for scheduling/preview). */
export function flattenClips(clips: MidiClip[]): MidiNote[] {
  const out: MidiNote[] = [];
  for (const clip of clips) {
    for (const n of clip.notes) {
      // Skip notes that fall outside clip duration (e.g. after resize)
      if (n.startBeat >= clip.duration) continue;
      const dur = Math.min(n.duration, clip.duration - n.startBeat);
      out.push({
        ...n,
        startBeat: clip.startBeat + n.startBeat,
        duration: dur,
      });
    }
  }
  return out;
}
