/**
 * Detect the fundamental pitch of an audio Blob using auto-correlation
 * (a.k.a. McLeod / NSDF-style approach, simplified).
 *
 * Designed for monophonic, sustained samples (like single bass notes) — picks
 * the strongest periodic frequency in the centre of the waveform, then
 * converts to the closest MIDI note.
 *
 * Returns `null` when no clear pitch could be found (e.g. percussive or noisy
 * samples).
 */

export interface DetectedPitch {
  /** Closest MIDI note (0-127) */
  midi: number;
  /** Detected fundamental frequency in Hz (un-rounded) */
  hz: number;
  /** Distance in semitones from the nearest equal-tempered note (-0.5..+0.5) */
  cents: number;
  /** 0..1 confidence — higher = stronger periodicity */
  confidence: number;
}

const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export function midiToName(m: number): string {
  const pc = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return `${NOTE_NAMES_SHARP[pc]}${octave}`;
}

function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/**
 * Auto-correlation pitch detector. Reads the central ~150ms of the buffer
 * (where attack transients are over) and looks for the lag with the highest
 * normalised auto-correlation. Restricted to bass-friendly range (≈30-500 Hz).
 */
function detectFromBuffer(buffer: AudioBuffer): DetectedPitch | null {
  const sr = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  if (data.length < sr * 0.05) return null;

  // Centre window of 100ms (or whatever fits)
  const winLen = Math.min(Math.floor(sr * 0.1), data.length);
  const start = Math.max(0, Math.floor(data.length / 2) - Math.floor(winLen / 2));
  const win = data.subarray(start, start + winLen);

  // RMS gate — silent buffers can't be detected
  let rms = 0;
  for (let i = 0; i < win.length; i++) rms += win[i] * win[i];
  rms = Math.sqrt(rms / win.length);
  if (rms < 0.005) return null;

  // Search range: 40 Hz (≈E1) up to 1000 Hz (B5-ish). Starting above 30 Hz
  // helps prevent the autocorrelator from locking onto a sub-harmonic of a
  // bass note (which made detected pitches read 1–2 octaves too low and the
  // sample then play back 1–2 octaves too high).
  const minHz = 40;
  const maxHz = 1000;
  const minLag = Math.floor(sr / maxHz);
  const maxLag = Math.min(Math.floor(sr / minHz), Math.floor(win.length / 2));

  let bestLag = -1;
  let bestCorr = 0;
  // Normalised square-difference function (NSDF style)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acf = 0;
    let norm = 0;
    for (let i = 0; i < win.length - lag; i++) {
      acf += win[i] * win[i + lag];
      norm += win[i] * win[i] + win[i + lag] * win[i + lag];
    }
    const corr = norm > 0 ? (2 * acf) / norm : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorr < 0.3) return null;

  // Parabolic interpolation around bestLag for sub-sample accuracy
  let lagF = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const cm = corrAtLag(win, bestLag - 1);
    const c0 = bestCorr;
    const cp = corrAtLag(win, bestLag + 1);
    const denom = cm - 2 * c0 + cp;
    if (Math.abs(denom) > 1e-9) {
      lagF = bestLag + 0.5 * (cm - cp) / denom;
    }
  }

  const hz = sr / lagF;
  const midiF = hzToMidi(hz);
  const midi = Math.round(midiF);
  const cents = midiF - midi;

  return { midi, hz, cents, confidence: bestCorr };
}

function corrAtLag(win: Float32Array, lag: number): number {
  let acf = 0;
  let norm = 0;
  for (let i = 0; i < win.length - lag; i++) {
    acf += win[i] * win[i + lag];
    norm += win[i] * win[i] + win[i + lag] * win[i + lag];
  }
  return norm > 0 ? (2 * acf) / norm : 0;
}

/** Decode an audio Blob and run pitch detection. Returns null on failure. */
export async function detectPitchFromBlob(blob: Blob): Promise<DetectedPitch | null> {
  try {
    const arrayBuf = await blob.arrayBuffer();
    // Use OfflineAudioContext when available for faster, gesture-free decode.
    const Ctor: typeof AudioContext =
      (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    const ctx = new Ctor();
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(arrayBuf.slice(0));
    } finally {
      try { ctx.close(); } catch {}
    }
    return detectFromBuffer(buffer);
  } catch {
    return null;
  }
}
