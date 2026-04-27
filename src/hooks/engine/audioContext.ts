import * as Tone from 'tone';

declare global {
  type AudioSessionType = 'auto' | 'ambient' | 'playback' | 'transient' | 'transient-solo' | 'play-and-record';

  interface Navigator {
    audioSession?: {
      type: AudioSessionType;
    };
  }

  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

let gesturePrimedContext: AudioContext | null = null;
let recentUserGestureUntil = 0;

if (typeof window !== 'undefined') {
  const markGesture = () => {
    recentUserGestureUntil = performance.now() + 1200;
  };
  window.addEventListener('pointerdown', markGesture, { capture: true, passive: true });
  window.addEventListener('mousedown', markGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', markGesture, { capture: true, passive: true });
  window.addEventListener('keydown', markGesture, { capture: true, passive: true });
}

function hasActiveUserGesture() {
  return Boolean(navigator.userActivation?.isActive) || performance.now() < recentUserGestureUntil;
}

/**
 * Safari can create Tone's global AudioContext too early because Transport is
 * touched during module/component setup. Rebuild it once inside the user's
 * first click/keypress, then start/resume that gesture-created context.
 */
export async function ensureToneAudioContext(label: string): Promise<AudioContext> {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Web Audio is not supported in this browser');

  try {
    if (navigator.audioSession) {
      navigator.audioSession.type = 'playback';
      // eslint-disable-next-line no-console
      console.log(`[audio] ${label} audioSession=`, navigator.audioSession.type);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[audio] ${label} audioSession playback failed`, error);
  }

  let raw = Tone.getContext().rawContext as AudioContext;

  if (!gesturePrimedContext && hasActiveUserGesture()) {
    const fresh = new AudioContextCtor({ latencyHint: 'interactive' });
    Tone.setContext(fresh);
    raw = fresh;
    gesturePrimedContext = fresh;
    // eslint-disable-next-line no-console
    console.log(`[audio] created gesture AudioContext for ${label}`, raw.state);
  } else if (!gesturePrimedContext) {
    // eslint-disable-next-line no-console
    console.warn(`[audio] ${label} requested outside user gesture; deferring fresh AudioContext creation`);
  }

  await Tone.start();
  if (raw.state !== 'running') await raw.resume();

  // eslint-disable-next-line no-console
  console.log(`[audio] ${label} context`, raw.state, 'sampleRate=', raw.sampleRate);
  return raw;
}
