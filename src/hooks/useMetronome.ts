import { useCallback, useEffect, useRef } from 'react';

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
      // Fire-and-forget; resume() returns a promise but the gesture is what matters.
      ctxRef.current.resume().catch(() => {});
    }
  }, []);

  // Fallback: if context wasn't primed, try (may fail silently in Safari).
  useEffect(() => {
    if (!enabled) return;
    primeAudio();
  }, [enabled, primeAudio]);

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
      // Browsers may suspend the context; always try to resume so sound returns.
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => {});
      }
      const isAccent = beatCountRef.current % beatsPerBar === 0;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = isAccent ? 1600 : 1000;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(isAccent ? 0.45 : 0.3, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      onTickRef.current?.(beatCountRef.current);
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

  return { primeAudio };
}
