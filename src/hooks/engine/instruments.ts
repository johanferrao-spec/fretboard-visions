import * as Tone from 'tone';

export interface EngineInstruments {
  piano: Tone.PolySynth;
  bass: Tone.MonoSynth;
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hihat: Tone.MetalSynth;
  ride: Tone.MetalSynth;
  master: Tone.Gain;
}

export function createInstruments(): EngineInstruments {
  const master = new Tone.Gain(0.8).toDestination();

  const piano = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle8' },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 1.4 },
    volume: -10,
  }).connect(master);

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.3 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.4, baseFrequency: 200, octaves: 2.5 },
    volume: -8,
  }).connect(master);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
    volume: -4,
  }).connect(master);

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.1 },
    volume: -10,
  }).connect(master);

  const hihat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
    volume: -22,
  }).connect(master);

  const ride = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.18, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 16,
    resonance: 5200,
    octaves: 1,
    volume: -20,
  }).connect(master);

  return { piano, bass, kick, snare, hihat, ride, master };
}

export function disposeInstruments(inst: EngineInstruments) {
  inst.piano.dispose();
  inst.bass.dispose();
  inst.kick.dispose();
  inst.snare.dispose();
  inst.hihat.dispose();
  inst.ride.dispose();
  inst.master.dispose();
}
