import * as Tone from 'tone';

export interface JazzKit {
  kick: Tone.Player;
  snare: Tone.Player;
  hihat_closed: Tone.Player;
  hihat_pedal: Tone.Player;
  hihat_open: Tone.Player;
  ride: Tone.Player;
  loaded: Promise<void>;
}

export interface EngineInstruments {
  piano: Tone.PolySynth;
  bass: Tone.MonoSynth;
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hihat: Tone.MetalSynth;
  ride: Tone.MetalSynth;
  jazzKit: JazzKit;
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
    pitchDecay: 0.04,
    octaves: 7,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.32, sustain: 0.01, release: 0.4 },
    volume: -2,
  }).connect(master);

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white', playbackRate: 3 },
    envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.08 },
    volume: -8,
  }).connect(master);

  const hihat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
    harmonicity: 8.5,
    modulationIndex: 40,
    resonance: 6000,
    octaves: 1.2,
    volume: -24,
  }).connect(master);

  const ride = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.22, release: 0.08 },
    harmonicity: 6.2,
    modulationIndex: 22,
    resonance: 5500,
    octaves: 1.1,
    volume: -18,
  }).connect(master);

  // Jazz acoustic kit — real samples (loaded async). We currently ship one
  // hi-hat wav; reuse it for closed/pedal/open with different volumes until
  // dedicated articulation samples are added.
  const jazzKick  = new Tone.Player({ url: '/samples/jazz/kick.wav',  volume: 0 }).connect(master);
  const jazzSnare = new Tone.Player({ url: '/samples/jazz/snare.wav', volume: -2 }).connect(master);
  const jazzHihatClosed = new Tone.Player({ url: '/samples/jazz/hihat.wav', volume: -8 }).connect(master);
  const jazzHihatPedal  = new Tone.Player({ url: '/samples/jazz/hihat.wav', volume: -14 }).connect(master);
  const jazzHihatOpen   = new Tone.Player({ url: '/samples/jazz/hihat.wav', volume: -4 }).connect(master);
  const jazzRide  = new Tone.Player({ url: '/samples/jazz/ride.wav',  volume: -4 }).connect(master);
  const jazzKit: JazzKit = {
    kick: jazzKick,
    snare: jazzSnare,
    hihat_closed: jazzHihatClosed,
    hihat_pedal: jazzHihatPedal,
    hihat_open: jazzHihatOpen,
    ride: jazzRide,
    loaded: Tone.loaded(),
  };

  return { piano, bass, kick, snare, hihat, ride, jazzKit, master };
}

export function disposeInstruments(inst: EngineInstruments) {
  inst.piano.dispose();
  inst.bass.dispose();
  inst.kick.dispose();
  inst.snare.dispose();
  inst.hihat.dispose();
  inst.ride.dispose();
  inst.jazzKit.kick.dispose();
  inst.jazzKit.snare.dispose();
  inst.jazzKit.hihat_closed.dispose();
  inst.jazzKit.hihat_pedal.dispose();
  inst.jazzKit.hihat_open.dispose();
  inst.jazzKit.ride.dispose();
  inst.master.dispose();
}
