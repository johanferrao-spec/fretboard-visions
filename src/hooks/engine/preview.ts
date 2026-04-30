import * as Tone from 'tone';
import type { MidiNote, TrackId, DrumPart } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import type { EngineInstruments } from './instruments';
import type { Genre } from '@/hooks/useSongTimeline';
import type { UserSampleResolver } from './scheduler';
import { midiToNote, velocityToGain } from './humanize';
import { playUserSample } from './userSamples';

function pitchToDrumPart(pitch: number): DrumPart | null {
  switch (pitch) {
    case DRUM_PITCHES.kick:         return 'kick';
    case DRUM_PITCHES.snare:        return 'snare';
    case DRUM_PITCHES.hihat_closed: return 'hihat_closed';
    case DRUM_PITCHES.hihat_pedal:  return 'hihat_pedal';
    case DRUM_PITCHES.hihat_open:   return 'hihat_open';
    case DRUM_PITCHES.ride:         return 'ride';
    case DRUM_PITCHES.tom1:         return 'tom1';
    case DRUM_PITCHES.tom2:         return 'tom2';
    case DRUM_PITCHES.tom3:         return 'tom3';
    case DRUM_PITCHES.crash:        return 'crash';
    default: return null;
  }
}

function playSynthDrum(inst: EngineInstruments, pitch: number, dur: number, t: number, gain: number) {
  switch (pitch) {
    case DRUM_PITCHES.kick:         inst.kick.triggerAttackRelease('C1', dur, t, gain); break;
    case DRUM_PITCHES.snare:        inst.snare.triggerAttackRelease(0.35, t, gain); break;
    case DRUM_PITCHES.hihat_closed: inst.hihat.triggerAttackRelease('C5', dur * 0.4, t, gain); break;
    case DRUM_PITCHES.hihat_pedal:  inst.hihat.triggerAttackRelease('A4', dur * 0.35, t, gain * 0.7); break;
    case DRUM_PITCHES.hihat_open:   inst.hihat.triggerAttackRelease('C5', Math.max(0.4, dur * 1.4), t, gain); break;
    case DRUM_PITCHES.ride:         inst.ride.triggerAttackRelease('C5', dur, t, gain); break;
    case DRUM_PITCHES.tom1:         inst.kick.triggerAttackRelease('G2', dur, t, gain * 0.9); break;
    case DRUM_PITCHES.tom2:         inst.kick.triggerAttackRelease('D2', dur, t, gain * 0.9); break;
    case DRUM_PITCHES.tom3:         inst.kick.triggerAttackRelease('A2', dur, t, gain * 0.9); break;
    case DRUM_PITCHES.crash:        inst.ride.triggerAttackRelease('G5', dur * 1.2, t, gain); break;
    default:                        inst.snare.triggerAttackRelease(0.35, t, gain);
  }
}

function playJazzKitSample(inst: EngineInstruments, pitch: number, t: number, gain: number) {
  const playSample = (pl: Tone.Player) => {
    if (!pl.loaded) return false;
    try {
      const src = new Tone.ToneBufferSource(pl.buffer);
      const gainNode = new Tone.Gain(gain).connect(inst.master);
      src.connect(gainNode);
      src.onended = () => {
        try { src.dispose(); } catch { /* ignore disposal races */ }
        try { gainNode.dispose(); } catch { /* ignore disposal races */ }
      };
      src.start(t);
      return true;
    } catch { return false; }
  };
  switch (pitch) {
    case DRUM_PITCHES.kick:         return playSample(inst.jazzKit.kick);
    case DRUM_PITCHES.snare:        return playSample(inst.jazzKit.snare);
    case DRUM_PITCHES.hihat_closed: return playSample(inst.jazzKit.hihat_closed);
    case DRUM_PITCHES.hihat_pedal:  return playSample(inst.jazzKit.hihat_pedal);
    case DRUM_PITCHES.hihat_open:   return playSample(inst.jazzKit.hihat_open);
    case DRUM_PITCHES.ride:         return playSample(inst.jazzKit.ride);
    default: return false;
  }
}

/** Trigger a single MIDI note immediately (used for piano-roll click previews). */
export function previewTrackNote(
  trackId: TrackId,
  n: MidiNote,
  inst: EngineInstruments,
  genre: Genre = 'Rock',
  resolveUserSample?: UserSampleResolver,
) {
  const t = Tone.now() + 0.01;
  const dur = Math.max(0.15, n.duration * 0.5); // seconds-ish for preview
  const gain = velocityToGain(n.velocity);

  if (trackId === 'drums') {
    const part = pitchToDrumPart(n.pitch);
    const resolution = part && resolveUserSample ? resolveUserSample(`drums:${part}`) : null;
    if (resolution?.kind === 'user') {
      if (playUserSample(resolution.sample, inst.master, { time: t, rate: 1, gain })) return;
    }
    if (resolution?.kind === 'builtin') {
      if (resolution.sample.source === 'jazz-sample' && playJazzKitSample(inst, n.pitch, t, gain)) return;
      if (genre === 'Jazz' && playJazzKitSample(inst, n.pitch, t, gain)) return;
      playSynthDrum(inst, n.pitch, dur, t, gain);
      return;
    }
    if (genre === 'Jazz' && playJazzKitSample(inst, n.pitch, t, gain)) return;
    playSynthDrum(inst, n.pitch, dur, t, gain);
    return;
  }

  if (trackId === 'bass') {
    const bassKit = genre === 'Pop' ? 'Rock' : genre;
    const res = resolveUserSample?.('bass', n.pitch) ?? resolveUserSample?.(`bass:${bassKit}`, n.pitch);
    if (res?.kind === 'user') {
      const basePitch = typeof res.sample.pitch === 'number' ? res.sample.pitch : 40;
      const rate = Math.pow(2, (n.pitch - basePitch) / 12);
      if (playUserSample(res.sample, inst.master, { time: t, rate, gain })) return;
    }
    return;
  }

  if (trackId === 'piano') {
    const res = resolveUserSample?.('keys', n.pitch);
    if (res?.kind === 'user') {
      const basePitch = typeof res.sample.pitch === 'number' ? res.sample.pitch : 60;
      const rate = Math.pow(2, (n.pitch - basePitch) / 12);
      if (playUserSample(res.sample, inst.master, { time: t, rate, gain })) return;
    }
    inst.piano.triggerAttackRelease(midiToNote(n.pitch), dur, t, gain);
  }
}
