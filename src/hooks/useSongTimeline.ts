import { useState, useCallback, useRef } from 'react';
import type { NoteName } from '@/lib/music';

export type SnapValue = '1/4' | '1/8' | '1/16';
export type Genre = 'Jazz' | 'Rock' | 'Pop';

export interface TimelineChord {
  id: string;
  root: NoteName;
  chordType: string;
  /** Beat position (0-based, e.g. 0 = beat 1 of measure 1, 4 = beat 1 of measure 2) */
  startBeat: number;
  /** Duration in beats */
  duration: number;
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
    const snapped = snapToBeat(newStartBeat);
    setChords(prev => prev.map(c => c.id === id ? { ...c, startBeat: Math.max(0, snapped) } : c));
  }, [snapToBeat]);

  const resizeChord = useCallback((id: string, newDuration: number) => {
    const grid = snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25;
    const snapped = Math.max(grid, Math.round(newDuration / grid) * grid);
    setChords(prev => prev.map(c => c.id === id ? { ...c, duration: snapped } : c));
  }, [snap]);

  const removeChord = useCallback((id: string) => {
    setChords(prev => prev.filter(c => c.id !== id));
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
    snap, setSnap,
    isPlaying, setIsPlaying,
    currentBeat, setCurrentBeat,
    panelHeight, setPanelHeight,
    addChord, moveChord, resizeChord, removeChord, clearTimeline, trimOverlaps,
    snapToBeat,
  };
}
