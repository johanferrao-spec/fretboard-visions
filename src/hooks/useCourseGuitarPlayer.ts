import { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import type { CourseNote } from '@/lib/courseTypes';

/**
 * Lightweight Tone.js player for tab phrases.
 * Plays each note at its grid position with a guitar-like patch.
 *
 * Adds an optional `onActiveNotes` callback that fires each time the active set
 * of sounding notes changes — used to highlight notes on the fretboard / tab in real time.
 *
 * Adds an optional metronome that plays a wood-block click on every beat.
 */

function noteToFreqName(stringIndex: number, fret: number): string {
  const baseMidis = [40, 45, 50, 55, 59, 64];
  const midi = baseMidis[stringIndex] + fret;
  return Tone.Frequency(midi, 'midi').toNote();
}

interface PlayOptions {
  notes: CourseNote[];
  lengthGrid: number;
  bpm: number;
  beatsPerBar: number;
  metronome: boolean;
  onBeat: (beatIndex: number) => void;
  onEnd: () => void;
  onActiveNotes?: (ids: string[]) => void;
}

export function useCourseGuitarPlayer() {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const clickRef = useRef<Tone.MetalSynth | null>(null);
  const initRef = useRef(false);
  const onBeatRef = useRef<((beatIndex: number) => void) | null>(null);
  const onEndRef = useRef<(() => void) | null>(null);
  const onActiveRef = useRef<((ids: string[]) => void) | null>(null);
  const lastActiveKey = useRef<string>('');

  const init = useCallback(async () => {
    if (initRef.current) return;
    await Tone.start();
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.25, release: 0.6 },
      volume: -10,
    }).toDestination();
    clickRef.current = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.08, release: 0.05 },
      harmonicity: 8,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -18,
    }).toDestination();
    initRef.current = true;
  }, []);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().position = 0;
    Tone.getTransport().loop = false;
    onActiveRef.current?.([]);
    lastActiveKey.current = '';
  }, []);

  const play = useCallback(async (opts: PlayOptions) => {
    const { notes, lengthGrid, bpm, beatsPerBar, metronome, onBeat, onEnd, onActiveNotes } = opts;
    await init();
    stop();
    onBeatRef.current = onBeat;
    onEndRef.current = onEnd;
    onActiveRef.current = onActiveNotes ?? null;

    Tone.getTransport().bpm.value = bpm;

    const sixteenthSec = 60 / bpm / 4;

    // Group notes by start beatIndex (chord)
    const groups = new Map<number, CourseNote[]>();
    notes.forEach(n => {
      const arr = groups.get(n.beatIndex) ?? [];
      arr.push(n);
      groups.set(n.beatIndex, arr);
    });

    groups.forEach((g, beatIdx) => {
      const time = beatIdx * sixteenthSec;
      const dur = Math.max(...g.map(n => n.durationGrid)) * sixteenthSec;
      const freqs = g.map(n => noteToFreqName(n.stringIndex, n.fret));
      Tone.getTransport().schedule((t) => {
        synthRef.current?.triggerAttackRelease(freqs, dur * 0.95, t);
      }, time);
    });

    // Metronome — one click per beat (1/4 note)
    if (metronome) {
      const beatSec = 60 / bpm;
      const totalBeats = Math.ceil(lengthGrid / 4);
      for (let b = 0; b < totalBeats; b++) {
        const isDownbeat = b % beatsPerBar === 0;
        Tone.getTransport().schedule((t) => {
          clickRef.current?.triggerAttackRelease(isDownbeat ? 'C6' : 'A5', 0.03, t);
        }, b * beatSec);
      }
    }

    // Playhead + active-note tracker
    const repeatId = Tone.getTransport().scheduleRepeat((t) => {
      const seconds = Tone.getTransport().seconds;
      const pos = seconds / sixteenthSec; // floating grid position
      const idx = Math.floor(pos);
      Tone.getDraw().schedule(() => {
        onBeatRef.current?.(idx);
        // Compute currently-sounding notes (any note where beatIndex <= pos < beatIndex+dur)
        if (onActiveRef.current) {
          const active = notes.filter(n => n.beatIndex <= pos && pos < n.beatIndex + n.durationGrid).map(n => n.id);
          const key = active.join(',');
          if (key !== lastActiveKey.current) {
            lastActiveKey.current = key;
            onActiveRef.current(active);
          }
        }
      }, t);
      if (idx >= lengthGrid) {
        Tone.getDraw().schedule(() => { onEndRef.current?.(); onActiveRef.current?.([]); }, t);
        Tone.getTransport().clear(repeatId);
        stop();
      }
    }, '16n');

    Tone.getTransport().position = 0;
    Tone.getTransport().start();
  }, [init, stop]);

  useEffect(() => () => {
    stop();
    synthRef.current?.dispose();
    clickRef.current?.dispose();
    initRef.current = false;
  }, [stop]);

  return { play, stop };
}
