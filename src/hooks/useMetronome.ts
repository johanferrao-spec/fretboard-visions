import { useCallback, useEffect, useRef } from 'react';

/**
 * Standalone Web-Audio metronome. Completely independent of any timeline / playback.
 * When `enabled` is true it ticks on its own internal interval at `bpm` BPM.
 * First beat of every bar gets a higher pitch (accent).
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
  const ctxRef = useRef<AudioContext | null>(null);
  const beatCountRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  /**
   * Synchronously create AND resume the AudioContext. MUST be called from
   * inside a real user-gesture handler (click/keydown) — otherwise the browser
   * will leave the context suspended and no sound will be heard.
   */
  const primeAudio = useCallback(() => {
    if (!ctxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        ctxRef.current = new Ctx();
      } catch {
        return;
      }
    }
    if (ctxRef.current && ctxRef.current.state !== 'running') {
      ctxRef.current.resume().catch(() => {});
    }
  }, []);

  // Fallback: if context wasn't primed, try (may fail silently in Safari).
  useEffect(() => {
    if (!enabled) return;
    primeAudio();
  }, [enabled, primeAudio]);

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

    // Lazily create the AudioContext inside the effect so it never hits a null ref.
    if (!ctxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        ctxRef.current = new Ctx();
      } catch {
        return;
      }
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD_S = 0.1;
    const safeBpm = Math.max(20, Math.min(400, bpm));
    const secondsPerBeat = 60 / safeBpm;

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
      // Browsers may suspend the context; always try to resume so sound returns.
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => {});
      }
      while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        scheduleBeat(nextBeatTime, beatCountRef.current);
        nextBeatTime += secondsPerBeat;
        beatCountRef.current += 1;
      }
    };

    tick();
    intervalRef.current = window.setInterval(tick, LOOKAHEAD_MS);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, bpm, beatsPerBar]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  return { primeAudio };
}
