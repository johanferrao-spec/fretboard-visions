import * as Tone from 'tone';
import type { StoredSample } from '@/lib/sampleStorage';

/**
 * Cache of decoded Tone.ToneAudioBuffers keyed by stored-sample id. We do NOT
 * reuse Tone.Player for playback — Player is monophonic (each `start()` stops
 * the previous note). Instead we spawn a fresh `ToneBufferSource` per voice
 * so multiple notes (e.g. a piano chord, or a bass line that overlaps) can
 * sound simultaneously.
 */
interface BufferEntry {
  buffer: Tone.ToneAudioBuffer;
  objectUrl: string;
  /** Resolves once the buffer is decoded (or rejects on error). */
  ready: Promise<void>;
  loaded: boolean;
}

const bufferCache = new Map<string, BufferEntry>();

function ensureBuffer(sample: StoredSample): BufferEntry | null {
  const cached = bufferCache.get(sample.id);
  if (cached) return cached;
  try {
    const objectUrl = URL.createObjectURL(sample.blob);
    const entry: Partial<BufferEntry> = { objectUrl, loaded: false };
    entry.ready = new Promise<void>((resolve, reject) => {
      const buf = new Tone.ToneAudioBuffer(
        objectUrl,
        () => { entry.loaded = true; resolve(); },
        (err) => reject(err),
      );
      entry.buffer = buf;
    });
    bufferCache.set(sample.id, entry as BufferEntry);
    return entry as BufferEntry;
  } catch {
    return null;
  }
}

/**
 * Polyphonic playback: spawn a fresh BufferSource per call so notes can
 * overlap. Returns true if scheduled, false if not yet decoded (caller may
 * fall back to a synth voice). The pitch is shifted via playbackRate.
 */
export function playUserSample(
  sample: StoredSample,
  destination: Tone.ToneAudioNode,
  opts: { time: number; rate?: number; gain?: number; durationSec?: number },
): boolean {
  const entry = ensureBuffer(sample);
  if (!entry || !entry.loaded || !entry.buffer) return false;
  try {
    const src = new Tone.ToneBufferSource(entry.buffer);
    src.playbackRate.value = opts.rate ?? 1;
    const gainNode = new Tone.Gain(opts.gain ?? 1).connect(destination);
    src.connect(gainNode);
    src.onended = () => {
      try { src.dispose(); } catch {}
      try { gainNode.dispose(); } catch {}
    };
    src.start(opts.time);
    if (typeof opts.durationSec === 'number' && opts.durationSec > 0) {
      // Apply a short fade-out so cutting the source doesn't click.
      const stopAt = opts.time + opts.durationSec;
      gainNode.gain.setValueAtTime(opts.gain ?? 1, Math.max(0, stopAt - 0.02));
      gainNode.gain.linearRampToValueAtTime(0, stopAt);
      try { src.stop(stopAt + 0.01); } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

/** Legacy single-Player accessor kept for callers that haven't migrated yet.
 *  Internally still spawns a ToneBufferSource — returns null if the buffer
 *  isn't decoded yet so callers can fall back to a synth. */
export function getUserPlayer(sample: StoredSample, _destination: Tone.ToneAudioNode): null {
  // Force buffer to start decoding so subsequent playUserSample() calls
  // can succeed promptly. Returning null pushes callers to the new path.
  ensureBuffer(sample);
  return null;
}

export function disposeUserPlayers() {
  bufferCache.forEach(({ buffer, objectUrl }) => {
    try { buffer.dispose(); } catch {}
    try { URL.revokeObjectURL(objectUrl); } catch {}
  });
  bufferCache.clear();
}

/**
 * Look up an active user sample for a slot key from the active map + sample list.
 */
export function resolveActiveSample(
  slot: string,
  active: Record<string, string>,
  samples: StoredSample[],
): StoredSample | null {
  const id = active[slot];
  if (!id) return null;
  return samples.find(s => s.id === id) || null;
}
