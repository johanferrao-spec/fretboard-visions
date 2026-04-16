import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { TimelineChord, Genre } from './useSongTimeline';
import type { BackingTrack, MidiNote, TrackId, TrackState } from '@/lib/backingTrackTypes';
import { TRACK_LABELS } from '@/lib/backingTrackTypes';
import { generateAllTracks } from './engine/generators';
import { createInstruments, disposeInstruments, type EngineInstruments } from './engine/instruments';
import { clearSchedule, scheduleTrack, schedulePlayhead, setupLoop } from './engine/scheduler';

const STORAGE_KEY = 'mf-backing-tracks';

function defaultTrack(id: TrackId): TrackState {
  return {
    id,
    name: TRACK_LABELS[id],
    notes: [],
    intensity: 0.6,
    complexity: 0.4,
    muted: false,
    solo: false,
    manuallyEdited: false,
  };
}

export function useBackingTrack() {
  const [tracks, setTracks] = useState<Record<TrackId, TrackState>>({
    piano: defaultTrack('piano'),
    bass: defaultTrack('bass'),
    drums: defaultTrack('drums'),
  });
  const [savedTracks, setSavedTracks] = useState<BackingTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  const instRef = useRef<EngineInstruments | null>(null);
  const isInitRef = useRef(false);
  const muteRefs = useRef<Record<TrackId, { current: boolean }>>({
    piano: { current: false },
    bass: { current: false },
    drums: { current: false },
  });

  // Load saved
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedTracks(JSON.parse(raw));
    } catch {}
  }, []);

  const persistSaved = (next: BackingTrack[]) => {
    setSavedTracks(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  // Sync mute refs with state for the scheduler
  useEffect(() => {
    const anySolo = (Object.values(tracks) as TrackState[]).some(t => t.solo);
    (Object.keys(tracks) as TrackId[]).forEach(id => {
      const t = tracks[id];
      muteRefs.current[id].current = t.muted || (anySolo && !t.solo);
    });
  }, [tracks]);

  const init = useCallback(async () => {
    if (isInitRef.current) return;
    await Tone.start();
    instRef.current = createInstruments();
    isInitRef.current = true;
  }, []);

  const regenerateTrack = useCallback((
    trackId: TrackId,
    chords: TimelineChord[],
    measures: number,
    genre: Genre,
  ) => {
    setTracks(prev => {
      const intensities = { piano: prev.piano.intensity, bass: prev.bass.intensity, drums: prev.drums.intensity };
      const complexities = { piano: prev.piano.complexity, bass: prev.bass.complexity, drums: prev.drums.complexity };
      const generated = generateAllTracks(chords, measures, genre, intensities, complexities);
      return {
        ...prev,
        [trackId]: { ...prev[trackId], notes: generated[trackId], manuallyEdited: false },
      };
    });
  }, []);

  const regenerateAll = useCallback((
    chords: TimelineChord[],
    measures: number,
    genre: Genre,
    force: boolean = false,
  ) => {
    setTracks(prev => {
      const intensities = { piano: prev.piano.intensity, bass: prev.bass.intensity, drums: prev.drums.intensity };
      const complexities = { piano: prev.piano.complexity, bass: prev.bass.complexity, drums: prev.drums.complexity };
      const generated = generateAllTracks(chords, measures, genre, intensities, complexities);
      const next: Record<TrackId, TrackState> = { ...prev };
      (Object.keys(prev) as TrackId[]).forEach(id => {
        if (force || !prev[id].manuallyEdited) {
          next[id] = { ...prev[id], notes: generated[id], manuallyEdited: false };
        }
      });
      return next;
    });
  }, []);

  const setTrackParam = useCallback(<K extends keyof TrackState>(
    trackId: TrackId,
    key: K,
    value: TrackState[K],
  ) => {
    setTracks(prev => ({ ...prev, [trackId]: { ...prev[trackId], [key]: value } }));
  }, []);

  const setTrackNotes = useCallback((trackId: TrackId, notes: MidiNote[]) => {
    setTracks(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], notes, manuallyEdited: true },
    }));
  }, []);

  const play = useCallback(async (
    bpm: number,
    measures: number,
  ) => {
    await init();
    const inst = instRef.current!;
    Tone.getTransport().bpm.value = bpm;
    clearSchedule();

    (Object.keys(tracks) as TrackId[]).forEach(id => {
      scheduleTrack(id, tracks[id].notes, inst, muteRefs.current[id]);
    });

    schedulePlayhead((b) => setCurrentBeat(b));
    setupLoop(measures);
    Tone.getTransport().position = 0;
    Tone.getTransport().start();
    setIsPlaying(true);
  }, [init, tracks]);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().position = 0;
    Tone.getTransport().loop = false;
    setIsPlaying(false);
    setCurrentBeat(0);
  }, []);

  const setMasterVolume = useCallback((vol: number) => {
    if (instRef.current) instRef.current.master.gain.rampTo(vol, 0.05);
  }, []);

  // Save / load
  const save = useCallback((name: string, chords: TimelineChord[], measures: number, bpm: number, genre: Genre) => {
    const bt: BackingTrack = {
      id: `bt-${Date.now()}`,
      name,
      createdAt: Date.now(),
      bpm,
      measures,
      genre,
      chords,
      tracks,
    };
    persistSaved([...savedTracks, bt]);
    return bt.id;
  }, [tracks, savedTracks]);

  const load = useCallback((id: string): BackingTrack | null => {
    const bt = savedTracks.find(s => s.id === id);
    if (!bt) return null;
    setTracks(bt.tracks);
    return bt;
  }, [savedTracks]);

  const remove = useCallback((id: string) => {
    persistSaved(savedTracks.filter(s => s.id !== id));
  }, [savedTracks]);

  const reset = useCallback(() => {
    setTracks({
      piano: defaultTrack('piano'),
      bass: defaultTrack('bass'),
      drums: defaultTrack('drums'),
    });
  }, []);

  // Cleanup
  useEffect(() => () => {
    if (instRef.current) {
      try { Tone.getTransport().stop(); Tone.getTransport().cancel(); } catch {}
      disposeInstruments(instRef.current);
      instRef.current = null;
      isInitRef.current = false;
    }
  }, []);

  return {
    tracks,
    setTrackParam,
    setTrackNotes,
    regenerateTrack,
    regenerateAll,
    isPlaying,
    currentBeat,
    play,
    stop,
    setMasterVolume,
    savedTracks,
    save,
    load,
    remove,
    reset,
  };
}
