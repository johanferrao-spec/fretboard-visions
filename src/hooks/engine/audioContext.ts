import * as Tone from 'tone';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

let gesturePrimedContext: AudioContext | null = null;

/**
 * Safari can create Tone's global AudioContext too early because Transport is
 * touched during module/component setup. Rebuild it once inside the user's
 * first click/keypress, then start/resume that gesture-created context.
 */
export async function ensureToneAudioContext(label: string): Promise<AudioContext> {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Web Audio is not supported in this browser');

  let raw = Tone.getContext().rawContext as AudioContext;

  if (!gesturePrimedContext) {
    const fresh = new AudioContextCtor({ latencyHint: 'interactive' });
    Tone.setContext(fresh);
    raw = fresh;
    gesturePrimedContext = fresh;
    // eslint-disable-next-line no-console
    console.log(`[audio] created gesture AudioContext for ${label}`, raw.state);
  }

  await Tone.start();
  if (raw.state !== 'running') await raw.resume();

  // eslint-disable-next-line no-console
  console.log(`[audio] ${label} context`, raw.state, 'sampleRate=', raw.sampleRate);
  return raw;
}
