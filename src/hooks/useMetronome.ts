import { useEffect, useRef } from 'react';

/**
 * Lightweight Web-Audio metronome. Ticks once per beat while `enabled && isPlaying`.
 * Uses a short oscillator burst — no Tone.js scheduler so it stays in sync with whatever
 * beat counter the rest of the app is using.
 *
 * The first beat of every bar gets a higher pitch (accent).
 */
export function useMetronome(opts: {
  enabled: boolean;
  isPlaying: boolean;
  bpm: number;
  /** Current playhead beat (float, e.g. 0..measures*4) */
  currentBeat: number;
  /** Beats per bar (default 4) */
  beatsPerBar?: number;
}) {
  const { enabled, isPlaying, bpm, currentBeat, beatsPerBar = 4 } = opts;
  const ctxRef = useRef<AudioContext | null>(null);
  const lastTickedBeatRef = useRef<number>(-1);

  // (Re)create context lazily when first enabled
  useEffect(() => {
    if (!enabled) return;
    if (!ctxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        ctxRef.current = new Ctx();
      } catch {
        /* no audio support */
      }
    }
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
  }, [enabled]);

  // Reset last-ticked-beat when stopping so we tick beat 0 again on next start
  useEffect(() => {
    if (!isPlaying || !enabled) {
      lastTickedBeatRef.current = -1;
    }
  }, [isPlaying, enabled]);

  // Trigger a click whenever currentBeat crosses an integer beat
  useEffect(() => {
    if (!enabled || !isPlaying) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const beatIdx = Math.floor(currentBeat);
    if (beatIdx === lastTickedBeatRef.current) return;
    lastTickedBeatRef.current = beatIdx;

    const isAccent = beatIdx % beatsPerBar === 0;
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
  }, [currentBeat, enabled, isPlaying, beatsPerBar]);

  // Cleanup
  useEffect(() => () => {
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  // bpm referenced so React re-evaluates if it changes mid-play (no direct effect needed)
  void bpm;
}
