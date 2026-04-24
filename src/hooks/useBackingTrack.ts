import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { TimelineChord, Genre } from './useSongTimeline';
import type { BackingTrack, MidiClip, MidiNote, TrackId, TrackState } from '@/lib/backingTrackTypes';
import { TRACK_LABELS, flattenClips } from '@/lib/backingTrackTypes';
import { generateAllTracks } from './engine/generators';
import { createInstruments, disposeInstruments, type EngineInstruments } from './engine/instruments';
import { clearSchedule, scheduleTrack, schedulePlayhead, setupLoop } from './engine/scheduler';

const STORAGE_KEY = 'mf-backing-tracks';

let nextClipId = 1;
const newClipId = () => `clip-${Date.now()}-${nextClipId++}`;

function defaultTrack(id: TrackId): TrackState {
  return {
    id,
    name: TRACK_LABELS[id],
    clips: [],
    intensity: 0.6,
    complexity: 0.4,
    muted: false,
    solo: false,
    manuallyEdited: false,
  };
}

/**
 * Build clips per chord region from absolute-beat notes.
 * Each chord region becomes one clip; notes are stored in clip-local beats.
 */
function buildClipsFromNotes(chords: TimelineChord[], notes: MidiNote[]): MidiClip[] {
  return chords.map(chord => {
    const localNotes = notes
      .filter(n => n.startBeat >= chord.startBeat && n.startBeat < chord.startBeat + chord.duration)
      .map(n => ({
        ...n,
        startBeat: n.startBeat - chord.startBeat,
      }));
    return {
      id: newClipId(),
      startBeat: chord.startBeat,
      duration: chord.duration,
      notes: localNotes,
      sourceChordId: chord.id,
      label: `${chord.root}${chord.chordType === 'Major' ? '' : chord.chordType === 'Minor' ? 'm' : ' ' + chord.chordType}${chord.bassNote ? '/' + chord.bassNote : ''}`,
    };
  });
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
  const initPromiseRef = useRef<Promise<void> | null>(null);
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

  const ensureInstruments = useCallback(() => {
    if (!instRef.current) {
      instRef.current = createInstruments();
    }
  }, []);

  const init = useCallback(async () => {
    ensureInstruments();
    if (isInitRef.current) return;
    if (!initPromiseRef.current) {
      initPromiseRef.current = (async () => {
        await Tone.start();
        try {
          const context = Tone.getContext() as Tone.Context & { updateInterval?: number };
          context.lookAhead = 0.005;
          if (typeof context.updateInterval === 'number') {
            context.updateInterval = 0.01;
          }
        } catch {}
        isInitRef.current = true;
      })().finally(() => {
        initPromiseRef.current = null;
      });
    }
    await initPromiseRef.current;
  }, [ensureInstruments]);

  /**
   * Pre-warm the audio engine so the FIRST press of play has no delay.
   * Safe to call from any user gesture; subsequent calls are no-ops.
   */
  const prewarm = useCallback(async () => {
    ensureInstruments();
    if (isInitRef.current) return;
    try {
      await init();
    } catch {}
  }, [ensureInstruments, init]);

  useEffect(() => {
    ensureInstruments();
  }, [ensureInstruments]);

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
        [trackId]: {
          ...prev[trackId],
          clips: buildClipsFromNotes(chords, generated[trackId]),
          manuallyEdited: false,
        },
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
          next[id] = {
            ...prev[id],
            clips: buildClipsFromNotes(chords, generated[id]),
            manuallyEdited: false,
          };
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

  /** Replace all clips for a track. Marks track as manually edited. */
  const setTrackClips = useCallback((trackId: TrackId, clips: MidiClip[]) => {
    setTracks(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], clips, manuallyEdited: true },
    }));
  }, []);

  /** Update a specific clip's properties (drag/resize). */
  const updateClip = useCallback((trackId: TrackId, clipId: string, patch: Partial<MidiClip>) => {
    setTracks(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        clips: prev[trackId].clips.map(c => c.id === clipId ? { ...c, ...patch } : c),
        manuallyEdited: true,
      },
    }));
  }, []);

  /** Delete a clip. */
  const deleteClip = useCallback((trackId: TrackId, clipId: string) => {
    setTracks(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        clips: prev[trackId].clips.filter(c => c.id !== clipId),
        manuallyEdited: true,
      },
    }));
  }, []);

  /** Duplicate a clip — places copy directly after the original. */
  const duplicateClip = useCallback((trackId: TrackId, clipId: string) => {
    setTracks(prev => {
      const clips = prev[trackId].clips;
      const orig = clips.find(c => c.id === clipId);
      if (!orig) return prev;
      const copy: MidiClip = {
        ...orig,
        id: newClipId(),
        startBeat: orig.startBeat + orig.duration,
        notes: orig.notes.map((n, i) => ({ ...n, id: `${n.id}-c${i}` })),
      };
      return {
        ...prev,
        [trackId]: { ...prev[trackId], clips: [...clips, copy], manuallyEdited: true },
      };
    });
  }, []);

  /** Update notes inside a single clip (used by piano roll). */
  const setClipNotes = useCallback((trackId: TrackId, clipId: string, notes: MidiNote[]) => {
    setTracks(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        clips: prev[trackId].clips.map(c => c.id === clipId ? { ...c, notes } : c),
        manuallyEdited: true,
      },
    }));
  }, []);

  /** Replace all notes from a flat list (used by AI generation per-track). */
  const setTrackNotes = useCallback((trackId: TrackId, notes: MidiNote[], chords: TimelineChord[]) => {
    setTracks(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        clips: buildClipsFromNotes(chords, notes),
        manuallyEdited: true,
      },
    }));
  }, []);

  const play = useCallback(async (
    bpm: number,
    measures: number,
  ): Promise<{ startAudioTime: number; startPerfTime: number }> => {
    await init();
    const inst = instRef.current!;
    Tone.getTransport().bpm.value = bpm;
    clearSchedule();

    (Object.keys(tracks) as TrackId[]).forEach(id => {
      const flat = flattenClips(tracks[id].clips);
      scheduleTrack(id, flat, inst, muteRefs.current[id]);
    });

    schedulePlayhead((b) => setCurrentBeat(b));
    setupLoop(measures);
    Tone.getTransport().position = 0;
    const startDelay = Math.max(0.005, Math.min(0.01, Tone.getContext().lookAhead || 0.005));
    const startAudioTime = Tone.now() + startDelay;
    Tone.getTransport().start(startAudioTime);
    setIsPlaying(true);
    return { startAudioTime, startPerfTime: performance.now() + startDelay * 1000 };
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
    // Backwards compat: if loaded track lacks clips, fall back gracefully.
    const next: Record<TrackId, TrackState> = { ...tracks };
    (Object.keys(bt.tracks) as TrackId[]).forEach(tid => {
      const t = bt.tracks[tid] as any;
      next[tid] = {
        ...defaultTrack(tid),
        ...t,
        clips: Array.isArray(t.clips) ? t.clips : (Array.isArray(t.notes) ? buildClipsFromNotes(bt.chords, t.notes) : []),
      };
    });
    setTracks(next);
    return bt;
  }, [savedTracks, tracks]);

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
    setTrackClips,
    setTrackNotes,
    setClipNotes,
    updateClip,
    deleteClip,
    duplicateClip,
    regenerateTrack,
    regenerateAll,
    isPlaying,
    currentBeat,
    play,
    stop,
    prewarm,
    setMasterVolume,
    savedTracks,
    save,
    load,
    remove,
    reset,
  };
}
