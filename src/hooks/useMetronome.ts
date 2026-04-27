import { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { ensureToneAudioContext } from './engine/audioContext';

/**
 * Standalone metronome built on top of Tone.js's shared AudioContext, so it
 * doesn't conflict with the backing track / MIDI engine which also use Tone.
 *
 * Uses a Web Audio lookahead scheduler for sample-accurate timing — beats are
 * scheduled ahead of time against ctx.currentTime, with a short setInterval
 * loop driving the scheduling (not the actual audio playback).
 */
export function useMetronome(opts: {
  enabled: boolean;
  bpm: number;
  /** Beats per bar (default 4) */
  beatsPerBar?: number;
  /** Called on every tick (for visual flashing) */
  onTick?: (beatIndex: number) => void;
}) {
  const { enabled, bpm, beatsPerBar = 4, onTick } = opts;
  const beatCountRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  /**
   * Start (and resume) the shared Tone.js AudioContext. MUST be called from
   * inside a real user-gesture handler (click/keydown) — otherwise the browser
   * will leave the context suspended and no sound will be heard.
   */
  const primeAudio = useCallback(async () => {
    try {
      // eslint-disable-next-line no-console
      console.log('[metronome] primeAudio called, tone=', Tone.getContext().state);
      const ctx = await ensureToneAudioContext('metronome');
      // eslint-disable-next-line no-console
      console.log('[metronome] primeAudio complete, raw=', ctx?.state, 'tone=', Tone.getContext().state);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[metronome] primeAudio failed', error);
    }
  }, []);

  // Drive the tick loop with a Web Audio lookahead scheduler
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      beatCountRef.current = 0;
      return;
    }

    let cancelled = false;
    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD_S = 0.1;
    const safeBpm = Math.max(20, Math.min(400, bpm));
    const secondsPerBeat = 60 / safeBpm;

    (async () => {
      await primeAudio();
      if (cancelled) return;

      // Use the shared Tone.js raw AudioContext so we don't create a second
      // context that fights with Tone for the audio output device.
      const ctx = Tone.getContext().rawContext as AudioContext;
      if (!ctx) return;
      if (ctx.state !== 'running') {
        try {
          await ctx.resume();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('[metronome] scheduler could not resume AudioContext', error);
          return;
        }
      }
      if (cancelled || ctx.state !== 'running') return;
      // eslint-disable-next-line no-console
      console.log('[metronome] scheduler enabled bpm=', bpm, 'raw=', ctx.state);

      // Schedule a single beat at an absolute AudioContext time.
      const scheduleBeat = (time: number, beatIndex: number) => {
        const isAccent = beatIndex % beatsPerBar === 0;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = isAccent ? 1600 : 1000;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(isAccent ? 0.45 : 0.3, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
        osc.connect(gain).connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.07);

        // Fire visual tick callback at (approximately) the audible moment.
        const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
        window.setTimeout(() => onTickRef.current?.(beatIndex), delayMs);
      };

      // Start scheduling slightly in the future so the first beat is clean.
      let nextBeatTime = ctx.currentTime + 0.05;

      const tick = () => {
        if (ctx.state !== 'running') return;
        while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
          scheduleBeat(nextBeatTime, beatCountRef.current);
          nextBeatTime += secondsPerBeat;
          beatCountRef.current += 1;
        }
      };

      tick();
      if (!cancelled) intervalRef.current = window.setInterval(tick, LOOKAHEAD_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // eslint-disable-next-line no-console
      console.log('[metronome] scheduler stopped');
    };
  }, [enabled, bpm, beatsPerBar, primeAudio]);

  // Cleanup on unmount — don't close the shared Tone context, just stop scheduling.
  useEffect(() => () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
  }, []);

  return { primeAudio };
}
