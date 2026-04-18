import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Autocorrelation-based pitch detector (similar to audio.js / Wikipedia ACF).
 * Returns the dominant detected MIDI pitch (or null).
 * Also exposes the latest FFT magnitude buffer for crude chord-tone presence checks.
 */
export interface PitchDetectorState {
  enabled: boolean;
  midi: number | null;
  cents: number;
  rms: number;
  /** Pitch classes (0-11) currently detected as strong peaks. */
  activeChordTones: Set<number>;
  error: string | null;
}

const SAMPLE_RATE_FFT_SIZE = 2048;
const MIN_RMS = 0.005;
const GOOD_ENOUGH_CORRELATION = 0.85;

function autoCorrelate(buf: Float32Array, sampleRate: number): { freq: number; rms: number } {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < MIN_RMS) return { freq: -1, rms };

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  const trimmed = buf.slice(r1, r2);
  const TS = trimmed.length;

  const c = new Array(TS).fill(0);
  for (let i = 0; i < TS; i++)
    for (let j = 0; j < TS - i; j++)
      c[i] = c[i] + trimmed[j] * trimmed[j + i];

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < TS; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let T0 = maxpos;
  if (T0 <= 0 || c[0] === 0) return { freq: -1, rms };
  const correlation = maxval / c[0];
  if (correlation < GOOD_ENOUGH_CORRELATION) return { freq: -1, rms };

  const x1 = c[T0 - 1] || 0, x2 = c[T0] || 0, x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return { freq: sampleRate / T0, rms };
}

function freqToMidi(freq: number) {
  return 69 + 12 * Math.log2(freq / 440);
}

export interface AudioInputDevice { deviceId: string; label: string; }

export function usePitchDetector() {
  const [state, setState] = useState<PitchDetectorState>({
    enabled: false, midi: null, cents: 0, rms: 0, activeChordTones: new Set(), error: null,
  });
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  /** Enumerate audio input devices. Note: labels are only available after permission is granted. */
  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter(d => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      setDevices(inputs);
      if (!selectedDeviceId && inputs.length > 0) setSelectedDeviceId(inputs[0].deviceId);
    } catch (e) {
      // ignore
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
    const handler = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
  }, [refreshDevices]);

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setState(s => ({ ...s, enabled: false, midi: null, rms: 0, activeChordTones: new Set() }));
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    try {
      // Stop any existing stream first to avoid orphaned tracks.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        await audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          : { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      // Refresh device list now that we have permission (so labels populate).
      refreshDevices();
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = ctx;
      // Some browsers start the AudioContext suspended until a user gesture.
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = SAMPLE_RATE_FFT_SIZE;
      src.connect(analyser);
      analyserRef.current = analyser;

      const timeBuf = new Float32Array(analyser.fftSize);
      const freqBuf = new Uint8Array(analyser.frequencyBinCount);
      const sr = ctx.sampleRate;

      setState(s => ({ ...s, enabled: true, error: null }));

      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getFloatTimeDomainData(timeBuf);
        analyser.getByteFrequencyData(freqBuf);
        const { freq, rms } = autoCorrelate(timeBuf, sr);

        // Chord-tone heuristic: find strong FFT peaks in 60-1200 Hz range, map to pitch classes.
        const chordTones = new Set<number>();
        const binHz = sr / analyser.fftSize;
        const peaks: { bin: number; mag: number }[] = [];
        const startBin = Math.max(1, Math.floor(60 / binHz));
        const endBin = Math.min(freqBuf.length - 1, Math.floor(1200 / binHz));
        for (let i = startBin + 1; i < endBin - 1; i++) {
          if (freqBuf[i] > 140 && freqBuf[i] > freqBuf[i - 1] && freqBuf[i] > freqBuf[i + 1]) {
            peaks.push({ bin: i, mag: freqBuf[i] });
          }
        }
        peaks.sort((a, b) => b.mag - a.mag).slice(0, 6).forEach(p => {
          const f = p.bin * binHz;
          if (f > 50) chordTones.add(Math.round(freqToMidi(f)) % 12);
        });

        if (freq > 0) {
          const midi = freqToMidi(freq);
          const rounded = Math.round(midi);
          const cents = Math.round((midi - rounded) * 100);
          setState({ enabled: true, midi: rounded, cents, rms, activeChordTones: chordTones, error: null });
        } else {
          setState(s => ({ ...s, enabled: true, midi: null, rms, activeChordTones: chordTones, error: null }));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setState(s => ({ ...s, enabled: false, error: e instanceof Error ? e.message : 'Mic blocked' }));
    }
  }, [refreshDevices]);

  /** Hot-swap input device. Restarts the stream if currently enabled. */
  const selectDevice = useCallback(async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (state.enabled) {
      await start(deviceId);
    }
  }, [state.enabled, start]);

  useEffect(() => () => stop(), [stop]);

  return { ...state, start, stop, devices, selectedDeviceId, selectDevice, refreshDevices };
}
