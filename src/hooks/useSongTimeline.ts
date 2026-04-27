import { useState, useCallback, useRef } from 'react';
import type { NoteName } from '@/lib/music';

export type SnapValue = '1/4' | '1/8' | '1/16';
export type Genre = 'Jazz' | 'Rock' | 'Pop' | 'Funk' | 'Latin';
/** Groove preset id (1-based). Currently only Funk has a real groove template. */
export type GrooveId = 1;

export interface TimelineChord {
  id: string;
  root: NoteName;
  chordType: string;
  /** Beat position (0-based, e.g. 0 = beat 1 of measure 1, 4 = beat 1 of measure 2) */
  startBeat: number;
  /** Duration in beats */
  duration: number;
  /** Altered bass note (e.g. for C/E slash chord) */
  bassNote?: NoteName;
}

export interface SongTimelineState {
  chords: TimelineChord[];
  measures: number;
  bpm: number;
  genre: Genre;
  snap: SnapValue;
  isPlaying: boolean;
  currentBeat: number;
}

let nextId = 1;

export function useSongTimeline() {
  const [chords, setChords] = useState<TimelineChord[]>([]);
  const [measures, setMeasures] = useState(2);
  const [bpm, setBpm] = useState(120);
  const [genre, setGenre] = useState<Genre>('Rock');
  const [groove, setGroove] = useState<GrooveId>(1);
  const [snap, setSnap] = useState<SnapValue>('1/4');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [panelHeight, setPanelHeight] = useState(220);

  const snapToBeat = useCallback((rawBeat: number): number => {
    const grid = snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25;
    return Math.round(rawBeat / grid) * grid;
  }, [snap]);

  const addChord = useCallback((root: NoteName, chordType: string, startBeat: number, duration?: number) => {
    const snapped = snapToBeat(startBeat);
    const dur = duration || (snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25);
    const id = `chord-${nextId++}`;
    setChords(prev => [...prev, { id, root, chordType, startBeat: snapped, duration: dur }]);
    return id;
  }, [snapToBeat, snap]);

  const moveChord = useCallback((id: string, newStartBeat: number) => {
    const totalBeats = measures * 4;
    setChords(prev => {
      const moving = prev.find(c => c.id === id);
      if (!moving) return prev;
      const nextStart = Math.max(0, Math.min(totalBeats - moving.duration, snapToBeat(newStartBeat)));
      // Pure move — do NOT mutate neighbours during drag. Overlap resolution
      // happens on drop via commitMove() so the user can drag freely without
      // losing chords until they release the mouse.
      return prev.map(chord => chord.id === id ? { ...chord, startBeat: nextStart } : chord);
    });
  }, [snapToBeat, measures]);

  /**
   * Commit a move: resolve any overlaps caused by the moved chord by
   * trimming or removing neighbours it sits on top of. Call this on mouseup.
   */
  const commitMove = useCallback((id: string) => {
    const grid = snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25;
    setChords(prev => {
      const moved = prev.find(c => c.id === id);
      if (!moved) return prev;
      const ms = moved.startBeat;
      const me = moved.startBeat + moved.duration;
      return prev.flatMap(chord => {
        if (chord.id === id) return [chord];
        const cs = chord.startBeat;
        const ce = chord.startBeat + chord.duration;
        if (ce <= ms || cs >= me) return [chord];
        if (cs >= ms && ce <= me) return [];
        if (cs < ms && ce > ms && ce <= me) {
          const duration = ms - cs;
          return duration >= grid ? [{ ...chord, duration }] : [];
        }
        if (cs >= ms && cs < me && ce > me) {
          const duration = ce - me;
          return duration >= grid ? [{ ...chord, startBeat: me, duration }] : [];
        }
        if (cs < ms && ce > me) {
          const duration = ms - cs;
          return duration >= grid ? [{ ...chord, duration }] : [];
        }
        return [chord];
      });
    });
  }, [snap]);

  const resizeChord = useCallback((id: string, newDuration: number) => {
    const grid = snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25;
    const snapped = Math.max(grid, Math.round(newDuration / grid) * grid);
    setChords(prev => prev.map(c => c.id === id ? { ...c, duration: snapped } : c));
  }, [snap]);

  const resizeChordRange = useCallback((id: string, newStartBeat: number, newDuration: number) => {
    const grid = snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25;
    const totalBeats = measures * 4;
    const nextStart = Math.max(0, Math.round(newStartBeat / grid) * grid);
    const nextEnd = Math.min(totalBeats, Math.max(nextStart + grid, Math.round((newStartBeat + newDuration) / grid) * grid));
    const nextDuration = Math.max(grid, nextEnd - nextStart);

    setChords(prev => prev.flatMap(chord => {
      if (chord.id === id) return [{ ...chord, startBeat: nextStart, duration: nextDuration }];

      const chordStart = chord.startBeat;
      const chordEnd = chord.startBeat + chord.duration;
      if (chordEnd <= nextStart || chordStart >= nextEnd) return [chord];

      if (chordStart < nextStart && chordEnd > nextStart && chordEnd <= nextEnd) {
        const duration = nextStart - chordStart;
        return duration >= grid ? [{ ...chord, duration }] : [];
      }

      if (chordStart >= nextStart && chordStart < nextEnd && chordEnd > nextEnd) {
        const duration = chordEnd - nextEnd;
        return duration >= grid ? [{ ...chord, startBeat: nextEnd, duration }] : [];
      }

      return [];
    }));
  }, [measures, snap]);

  const removeChord = useCallback((id: string) => {
    setChords(prev => prev.filter(c => c.id !== id));
  }, []);

  const setChordBass = useCallback((id: string, bassNote: NoteName | undefined) => {
    setChords(prev => prev.map(c => c.id === id ? { ...c, bassNote } : c));
  }, []);

  const clearTimeline = useCallback(() => {
    setChords([]);
    setCurrentBeat(0);
  }, []);

  // Trim overlapping chords: if one extends over another, trim its duration
  const trimOverlaps = useCallback(() => {
    setChords(prev => {
      const sorted = [...prev].sort((a, b) => a.startBeat - b.startBeat);
      const result: typeof prev = [];
      for (const chord of sorted) {
        const trimmed = { ...chord };
        // Check if any earlier chord overlaps with this one — trim the earlier one
        for (const existing of result) {
          const existingEnd = existing.startBeat + existing.duration;
          if (existingEnd > trimmed.startBeat) {
            existing.duration = trimmed.startBeat - existing.startBeat;
            if (existing.duration <= 0) existing.duration = 0.25; // minimum
          }
        }
        result.push(trimmed);
      }
      return result.filter(c => c.duration > 0);
    });
  }, []);

  return {
    chords, setChords,
    measures, setMeasures,
    bpm, setBpm,
    genre, setGenre,
    groove, setGroove,
    snap, setSnap,
    isPlaying, setIsPlaying,
    currentBeat, setCurrentBeat,
    panelHeight, setPanelHeight,
    addChord, moveChord, commitMove, resizeChord, resizeChordRange, removeChord, setChordBass, clearTimeline, trimOverlaps,
    snapToBeat,
  };
}
