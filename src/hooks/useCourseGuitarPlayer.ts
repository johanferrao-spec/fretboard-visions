import { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import type { CourseNote } from '@/lib/courseTypes';
import { STANDARD_TUNING } from '@/lib/music';

/**
 * Lightweight Tone.js player for tab phrases.
 * Plays each note at its grid position with a guitar-like patch.
 *
 * - 16th-note grid → seconds via bpm
 * - Computes MIDI from string + fret using STANDARD_TUNING semitone offsets
 *   (low E2 = 40 → +12 per pair of strings rising, matches our string indexing convention).
 */

function noteToFreqName(stringIndex: number, fret: number): string {
  // STANDARD_TUNING gives semitone offsets; build absolute MIDI.
  // String 0 (low E) → MIDI 40, String 5 (high e) → MIDI 64.
  const baseMidis = [40, 45, 50, 55, 59, 64];
  const midi = baseMidis[stringIndex] + fret;
  return Tone.Frequency(midi, 'midi').toNote();
}

export function useCourseGuitarPlayer() {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);
  const initRef = useRef(false);
  const onBeatRef = useRef<((beatIndex: number) => void) | null>(null);
  const onEndRef = useRef<(() => void) | null>(null);

  const init = useCallback(async () => {
    if (initRef.current) return;
    await Tone.start();
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.25, release: 0.6 },
      volume: -10,
    }).toDestination();
    initRef.current = true;
  }, []);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().position = 0;
    Tone.getTransport().loop = false;
    partRef.current?.dispose();
    partRef.current = null;
  }, []);

  const play = useCallback(async (
    notes: CourseNote[],
    lengthGrid: number,
    bpm: number,
    onBeat: (beatIndex: number) => void,
    onEnd: () => void,
  ) => {
    await init();
    stop();
    onBeatRef.current = onBeat;
    onEndRef.current = onEnd;

    Tone.getTransport().bpm.value = bpm;

    // Group by beatIndex (chord)
    const groups = new Map<number, CourseNote[]>();
    notes.forEach(n => {
      const arr = groups.get(n.beatIndex) ?? [];
      arr.push(n);
      groups.set(n.beatIndex, arr);
    });

    const sixteenthSec = 60 / bpm / 4;

    groups.forEach((g, beatIdx) => {
      const time = beatIdx * sixteenthSec;
      const dur = Math.max(...g.map(n => n.durationGrid)) * sixteenthSec;
      const freqs = g.map(n => noteToFreqName(n.stringIndex, n.fret));
      Tone.getTransport().schedule((t) => {
        synthRef.current?.triggerAttackRelease(freqs, dur * 0.95, t);
      }, time);
    });

    // Playhead updates every 16th
    const repeatId = Tone.getTransport().scheduleRepeat((t) => {
      const seconds = Tone.getTransport().seconds;
      const idx = Math.floor(seconds / sixteenthSec);
      Tone.getDraw().schedule(() => onBeatRef.current?.(idx), t);
      if (idx >= lengthGrid) {
        Tone.getDraw().schedule(() => { onEndRef.current?.(); }, t);
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
    initRef.current = false;
  }, [stop]);

  return { play, stop };
}
