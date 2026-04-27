import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { TimelineChord, Genre, GrooveId } from './useSongTimeline';
import type { BackingTrack, MidiClip, MidiNote, TrackId, TrackState, DrumFill } from '@/lib/backingTrackTypes';
import { TRACK_LABELS, flattenClips } from '@/lib/backingTrackTypes';
import { generateAllTracks } from './engine/generators';
import { createInstruments, disposeInstruments, type EngineInstruments } from './engine/instruments';
import { scheduleTrack, schedulePlayhead, setupLoop } from './engine/scheduler';
import { disposeUserPlayers } from './engine/userSamples';
import { ensureToneAudioContext } from './engine/audioContext';

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

/** Build one continuous generated region from absolute-beat notes. */
function buildGeneratedClipFromNotes(measures: number, notes: MidiNote[], label: string): MidiClip[] {
  const duration = Math.max(4, measures * 4);
  return [{
    id: newClipId(),
    startBeat: 0,
    duration,
    notes: notes
      .filter(n => n.startBeat < duration)
      .map(n => ({ ...n, startBeat: Math.max(0, n.startBeat) })),
    label,
  }];
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
  const [drumFills, setDrumFills] = useState<DrumFill[]>([]);
  const drumFillsRef = useRef<DrumFill[]>([]);
  drumFillsRef.current = drumFills;

  const instRef = useRef<EngineInstruments | null>(null);
  const isInitRef = useRef(false);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const pendingMasterVolRef = useRef<number | null>(null);
  const muteRefs = useRef<Record<TrackId, { current: boolean }>>({
    piano: { current: false },
    bass: { current: false },
    drums: { current: false },
  });
  // Always-current snapshot of tracks so play() reads the latest clips even when
  // it was scheduled before the most recent regenerateAll has flushed to state.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

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

  const startToneAudio = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log('[backing] startToneAudio before tone=', Tone.getContext().state);
    const rawContext = await ensureToneAudioContext('backing');
    if (rawContext.state !== 'running') {
      throw new Error(`AudioContext did not start: ${rawContext.state}`);
    }
    // eslint-disable-next-line no-console
    console.log('[backing] startToneAudio complete raw=', rawContext.state, 'tone=', Tone.getContext().state);
  }, []);

  const init = useCallback(async () => {
    if (isInitRef.current && Tone.getContext().state === 'running') return;
    if (!initPromiseRef.current) {
      initPromiseRef.current = (async () => {
        await startToneAudio();
        ensureInstruments();
        // Apply any volume that was set before instruments existed.
        if (pendingMasterVolRef.current !== null && instRef.current) {
          instRef.current.master.gain.value = pendingMasterVolRef.current;
          // eslint-disable-next-line no-console
          console.log('[backing] applied deferred master volume', pendingMasterVolRef.current);
          pendingMasterVolRef.current = null;
        }
        // Wait for sample buffers (jazz kit) to finish loading before first play.
        try { await Tone.loaded(); } catch {}
        // Only mark as initialized AFTER Tone.start() resolves successfully,
        // so a failed init can be retried on the next user gesture.
        isInitRef.current = true;
      })().catch((error) => {
        isInitRef.current = false;
        throw error;
      }).finally(() => {
        initPromiseRef.current = null;
      });
    }
    await initPromiseRef.current;
  }, [ensureInstruments, startToneAudio]);

  /**
   * Pre-warm the audio engine so the FIRST press of play has no delay.
   * Safe to call from any user gesture; subsequent calls are no-ops.
   */
  const prewarm = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log('[backing] prewarm called, isInit=', isInitRef.current);
    if (isInitRef.current) return;
    try {
      await init();
      // eslint-disable-next-line no-console
      console.log('[backing] prewarm complete, master gain=', instRef.current?.master.gain.value);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[backing] prewarm failed', e);
    }
  }, [init]);

  const regenerateTrack = useCallback((
    trackId: TrackId,
    chords: TimelineChord[],
    measures: number,
    genre: Genre,
    groove?: GrooveId,
  ) => {
    setTracks(prev => {
      const intensities = { piano: prev.piano.intensity, bass: prev.bass.intensity, drums: prev.drums.intensity };
      const complexities = { piano: prev.piano.complexity, bass: prev.bass.complexity, drums: prev.drums.complexity };
      const generated = generateAllTracks(chords, measures, genre, intensities, complexities, groove, drumFillsRef.current);
      return {
        ...prev,
        [trackId]: {
          ...prev[trackId],
          clips: buildGeneratedClipFromNotes(measures, generated[trackId], TRACK_LABELS[trackId]),
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
    groove?: GrooveId,
  ) => {
    setTracks(prev => {
      const intensities = { piano: prev.piano.intensity, bass: prev.bass.intensity, drums: prev.drums.intensity };
      const complexities = { piano: prev.piano.complexity, bass: prev.bass.complexity, drums: prev.drums.complexity };
      const generated = generateAllTracks(chords, measures, genre, intensities, complexities, groove, drumFillsRef.current);
      const next: Record<TrackId, TrackState> = { ...prev };
      (Object.keys(prev) as TrackId[]).forEach(id => {
        if (force || !prev[id].manuallyEdited) {
          next[id] = {
            ...prev[id],
            clips: buildGeneratedClipFromNotes(measures, generated[id], TRACK_LABELS[id]),
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
  const setTrackNotes = useCallback((trackId: TrackId, notes: MidiNote[], measures: number) => {
    setTracks(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        clips: buildGeneratedClipFromNotes(measures, notes, TRACK_LABELS[trackId]),
        manuallyEdited: true,
      },
    }));
  }, []);

  const play = useCallback(async (
    bpm: number,
    measures: number,
    genre: Genre = 'Rock',
    resolveUserSample?: import('./engine/scheduler').UserSampleResolver,
    fallbackContext?: { chords: TimelineChord[]; groove?: GrooveId },
  ): Promise<{ startAudioTime: number; startPerfTime: number }> => {
    // eslint-disable-next-line no-console
    console.log('[backing] play() called bpm=', bpm, 'measures=', measures, 'hasResolver=', !!resolveUserSample);
    await init();
    await startToneAudio();
    const inst = instRef.current!;
    // eslint-disable-next-line no-console
    console.log('[backing] master gain at play=', inst.master.gain.value, 'destination volume(dB)=', Tone.getDestination().volume.value, 'destination mute=', Tone.getDestination().mute, 'context state=', Tone.getContext().state);
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    Tone.getTransport().bpm.value = bpm;

    let liveTracks = tracksRef.current;
    // If state hasn't flushed yet (e.g. user clicked play immediately after adding chords),
    // generate notes ad-hoc from the fallback context so the first press still produces sound.
    const allEmpty = (Object.keys(liveTracks) as TrackId[]).every(
      id => liveTracks[id].clips.length === 0 && !liveTracks[id].manuallyEdited,
    );
    if (allEmpty && fallbackContext && fallbackContext.chords.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[backing] play() found empty clips — generating ad-hoc from fallback context');
      const intensities = { piano: liveTracks.piano.intensity, bass: liveTracks.bass.intensity, drums: liveTracks.drums.intensity };
      const complexities = { piano: liveTracks.piano.complexity, bass: liveTracks.bass.complexity, drums: liveTracks.drums.complexity };
      const generated = generateAllTracks(
        fallbackContext.chords, measures, genre, intensities, complexities, fallbackContext.groove, drumFillsRef.current,
      );
      const next: Record<TrackId, TrackState> = { ...liveTracks };
      (Object.keys(liveTracks) as TrackId[]).forEach(id => {
        next[id] = {
          ...liveTracks[id],
          clips: buildGeneratedClipFromNotes(measures, generated[id], TRACK_LABELS[id]),
          manuallyEdited: false,
        };
      });
      liveTracks = next;
      tracksRef.current = next;
      setTracks(next);
    }

    (Object.keys(liveTracks) as TrackId[]).forEach(id => {
      const flat = flattenClips(liveTracks[id].clips);
      // eslint-disable-next-line no-console
      console.log(`[backing] schedule ${id}: ${flat.length} notes from ${liveTracks[id].clips.length} clip(s) muted=${muteRefs.current[id].current}`);
      scheduleTrack(id, flat, inst, muteRefs.current[id], genre, resolveUserSample);
    });

    schedulePlayhead((b) => setCurrentBeat(b));
    setupLoop(measures);
    Tone.getTransport().position = 0;
    const startAudioTime = Tone.now() + 0.05;
    // eslint-disable-next-line no-console
    console.log('[backing] AudioContext state:', Tone.getContext().state, 'startAudioTime=', startAudioTime);
    transport.start('+0.05', 0);
    setIsPlaying(true);
    return { startAudioTime, startPerfTime: performance.now() + 50 };
  }, [init, startToneAudio]);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().position = 0;
    Tone.getTransport().loop = false;
    setIsPlaying(false);
    setCurrentBeat(0);
  }, []);

  
  const setMasterVolume = useCallback((vol: number) => {
    // eslint-disable-next-line no-console
    console.log('[backing] setMasterVolume', vol, 'instReady=', !!instRef.current);
    if (instRef.current) {
      instRef.current.master.gain.value = vol;
    } else {
      // Defer until instruments exist so the very first volume sync isn't dropped.
      pendingMasterVolRef.current = vol;
    }
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
        clips: Array.isArray(t.clips) ? t.clips : (Array.isArray(t.notes) ? buildGeneratedClipFromNotes(bt.measures, t.notes, TRACK_LABELS[tid]) : []),
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
    try { disposeUserPlayers(); } catch {}
  }, []);

  const addDrumFill = useCallback((startBar: number, lengthBars: number = 1) => {
    setDrumFills(prev => [...prev, {
      id: `fill-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      startBar: Math.max(0, Math.floor(startBar)),
      lengthBars: Math.max(1, Math.min(4, Math.floor(lengthBars))),
    }]);
  }, []);
  const updateDrumFill = useCallback((id: string, patch: Partial<DrumFill>) => {
    setDrumFills(prev => prev.map(f => {
      if (f.id !== id) return f;
      const next = { ...f, ...patch };
      next.startBar = Math.max(0, Math.floor(next.startBar));
      next.lengthBars = Math.max(1, Math.min(4, Math.floor(next.lengthBars)));
      return next;
    }));
  }, []);
  const removeDrumFill = useCallback((id: string) => {
    setDrumFills(prev => prev.filter(f => f.id !== id));
  }, []);

  return {
    tracks, setTrackParam, setTrackClips, setTrackNotes, setClipNotes,
    updateClip, deleteClip, duplicateClip,
    regenerateTrack, regenerateAll,
    isPlaying, currentBeat,
    play, stop, prewarm, setMasterVolume,
    savedTracks, save, load, remove, reset,
    drumFills, addDrumFill, updateDrumFill, removeDrumFill,
  };
}
