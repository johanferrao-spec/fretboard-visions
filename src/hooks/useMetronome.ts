import { useEffect, useRef } from 'react';

/**
 * Standalone Web-Audio metronome. Completely independent of any timeline / playback.
 * When `enabled` is true it ticks on its own internal interval at `bpm` BPM.
 * First beat of every bar gets a higher pitch (accent).
 */
export function useMetronome(opts: {
  enabled: boolean;
  bpm: number;
  /** Beats per bar (default 4) */
  beatsPerBar?: number;
}) {
  const { enabled, bpm, beatsPerBar = 4 } = opts;
  const ctxRef = useRef<AudioContext | null>(null);
  const beatCountRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  // Create / resume audio context when enabled
  useEffect(() => {
    if (!enabled) return;
    if (!ctxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        ctxRef.current = new Ctx();
      } catch {
        return;
      }
    }
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
  }, [enabled]);

  // Drive the tick loop
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      beatCountRef.current = 0;
      return;
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    const tick = () => {
      const isAccent = beatCountRef.current % beatsPerBar === 0;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = isAccent ? 1600 : 1000;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(isAccent ? 0.35 : 0.22, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
      beatCountRef.current += 1;
    };

    // Tick immediately on enable, then on interval
    tick();
    const intervalMs = 60000 / Math.max(20, Math.min(400, bpm));
    intervalRef.current = window.setInterval(tick, intervalMs);
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
}
