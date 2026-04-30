import * as Tone from 'tone';
import type { MidiNote, TrackId, DrumPart } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import type { EngineInstruments } from './instruments';
import type { Genre } from '@/hooks/useSongTimeline';
import { midiToNote, velocityToGain } from './humanize';
import { playUserSample } from './userSamples';
import type { StoredSample } from '@/lib/sampleStorage';
import type { BuiltInKitSample } from '@/lib/builtInKits';

/** A resolved sample for a slot — may be a user-uploaded blob OR a built-in kit choice. */
export type SampleResolution =
  | { kind: 'user'; sample: StoredSample }
  | { kind: 'builtin'; sample: BuiltInKitSample };

/**
 * Resolver: given a slot key (e.g. 'drums:snare', 'bass', 'keys') and the
 * target MIDI pitch (when known) return the active resolution or null. The
 * pitch hint lets multi-sample slots (such as the 4 bass slots) pick the
 * sample with the closest natural pitch for best fidelity.
 */
export type UserSampleResolver = (slot: string, targetPitch?: number) => SampleResolution | null;

let sampleResolverLogCount = 0;
const logSampleResolver = (...args: unknown[]) => {
  if (sampleResolverLogCount >= 24) return;
  sampleResolverLogCount += 1;
  // eslint-disable-next-line no-console
  console.log('[backing] sample resolver', ...args);
};

/** Map MIDI drum pitch -> our DrumPart slot key. */
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
    case DRUM_PITCHES.crash:        return 'crash';
    default: return null;
  }
}

/** Trigger a synthesised drum voice for a given pitch. */
function playSynthDrum(inst: EngineInstruments, pitch: number, dur: number, t: number, gain: number) {
  switch (pitch) {
    case DRUM_PITCHES.kick:
      inst.kick.triggerAttackRelease('C1', dur, t, gain);
      break;
    case DRUM_PITCHES.snare:
      // Snare is a one-shot — never truncate it to the MIDI note duration,
      // otherwise short notes cut the natural decay mid-crack.
      inst.snare.triggerAttackRelease(0.35, t, gain);
      break;
    case DRUM_PITCHES.hihat_closed:
      inst.hihat.triggerAttackRelease('C5', dur * 0.4, t, gain);
      break;
    case DRUM_PITCHES.hihat_pedal:
      inst.hihat.triggerAttackRelease('A4', dur * 0.35, t, gain * 0.7);
      break;
    case DRUM_PITCHES.hihat_open:
      // Longer decay so the open hat sustains audibly
      inst.hihat.triggerAttackRelease('C5', Math.max(0.4, dur * 1.4), t, gain);
      break;
    case DRUM_PITCHES.ride:
      inst.ride.triggerAttackRelease('C5', dur, t, gain);
      break;
    case DRUM_PITCHES.tom1:
      inst.kick.triggerAttackRelease('G2', dur, t, gain * 0.9);
      break;
    case DRUM_PITCHES.tom2:
      inst.kick.triggerAttackRelease('D2', dur, t, gain * 0.9);
      break;
    case DRUM_PITCHES.crash:
      inst.ride.triggerAttackRelease('G5', dur * 1.2, t, gain);
      break;
    default:
      inst.snare.triggerAttackRelease(0.35, t, gain);
  }
}

/** Trigger a Jazz acoustic kit Tone.Player for a given pitch. */
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
    } catch {
      return false;
    }
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

/**
 * Schedule a single track's notes on the Transport.
 * Returns no value — caller is expected to call Transport.cancel() before re-scheduling.
 */
export function scheduleTrack(
  trackId: TrackId,
  notes: MidiNote[],
  inst: EngineInstruments,
  isMutedRef: { current: boolean },
  genre: Genre = 'Rock',
  resolveUserSample?: UserSampleResolver,
) {
  for (const n of notes) {
    const beats = n.startBeat;
    const bars = Math.floor(beats / 4);
    const beatInt = Math.floor(beats % 4);
    const sixteenthFloat = (beats % 1) * 4;
    const sixteenth = Math.floor(sixteenthFloat);
    const remainder = sixteenthFloat - sixteenth;
    const baseTime = `${bars}:${beatInt}:${sixteenth}`;
    const microOffset = remainder * (60 / Tone.getTransport().bpm.value) / 4;
    const dur = (n.duration * 60) / Tone.getTransport().bpm.value;
    const gain = velocityToGain(n.velocity);

    Tone.getTransport().schedule((time) => {
      if (isMutedRef.current) return;
      const t = time + microOffset;

      if (trackId === 'drums') {
        const part = pitchToDrumPart(n.pitch);
        const resolution = part && resolveUserSample ? resolveUserSample(`drums:${part}`) : null;
        if (part) logSampleResolver(`drums:${part}`, resolution?.kind ?? 'none', resolution?.kind === 'builtin' ? resolution.sample.id : resolution?.kind === 'user' ? resolution.sample.name : null);

        // 1) User-uploaded sample takes top priority.
        if (resolution?.kind === 'user') {
          if (playUserSample(resolution.sample, inst.master, { time: t, rate: 1, gain })) return;
        }

        // 2) Built-in kit selection — honour the user's chosen kit. Do NOT
        //    override with jazz samples just because the song genre is Jazz;
        //    if the user explicitly selected the Rock kit, play Rock sounds.
        if (resolution?.kind === 'builtin') {
          if (resolution.sample.source === 'jazz-sample') {
            const ok = playJazzKitSample(inst, n.pitch, t, gain);
            if (ok) return;
          }
          // synth (or jazz-sample miss) → synthesised voice for the chosen kit
          playSynthDrum(inst, n.pitch, dur, t, gain);
          return;
        }

        // 3) No selection at all → default by genre (jazz uses jazz kit, others synth).
        if (genre === 'Jazz' && playJazzKitSample(inst, n.pitch, t, gain)) return;
        playSynthDrum(inst, n.pitch, dur, t, gain);
      } else if (trackId === 'bass') {
        // Bass slots are pinned to a specific kit (Rock/Jazz/Funk/Latin).
        // Pop falls back to Rock — same mapping used in the UI.
        const bassKit = genre === 'Pop' ? 'Rock' : genre;
        const res = resolveUserSample?.('bass', n.pitch)
          ?? resolveUserSample?.(`bass:${bassKit}`, n.pitch);
        if (res?.kind === 'user') {
          // Use the sample's detected natural pitch as the base when
          // available; fall back to E2 (40) for legacy samples (typical bass).
          const basePitch = typeof res.sample.pitch === 'number' ? res.sample.pitch : 40;
          const rate = Math.pow(2, (n.pitch - basePitch) / 12);
          if (playUserSample(res.sample, inst.master, { time: t, rate, gain, durationSec: dur })) return;
        }
        // Bass is sample-only: if no user bass sample is available/decoded yet,
        // stay silent rather than falling back to the synth bass.
      } else if (trackId === 'piano') {
        const res = resolveUserSample?.('keys', n.pitch);
        if (res?.kind === 'user') {
          const basePitch = typeof res.sample.pitch === 'number' ? res.sample.pitch : 60;
          const rate = Math.pow(2, (n.pitch - basePitch) / 12);
          if (playUserSample(res.sample, inst.master, { time: t, rate, gain, durationSec: dur })) return;
        }
        inst.piano.triggerAttackRelease(midiToNote(n.pitch), dur, t, gain);
      }
    }, baseTime);
  }
}

export function clearSchedule() {
  Tone.getTransport().cancel();
}

export function setupLoop(measures: number) {
  Tone.getTransport().loop = true;
  Tone.getTransport().loopStart = 0;
  Tone.getTransport().loopEnd = `${measures}:0:0`;
}

export function schedulePlayhead(onBeat: (beat: number) => void) {
  return Tone.getTransport().scheduleRepeat((time) => {
    const pos = Tone.getTransport().position;
    if (typeof pos === 'string') {
      const parts = pos.split(':').map(Number);
      const beat = parts[0] * 4 + parts[1] + parts[2] / 4;
      Tone.getDraw().schedule(() => onBeat(beat), time);
    }
  }, '16n');
}
