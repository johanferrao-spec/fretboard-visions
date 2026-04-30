// @refresh reset
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { TimelineChord, Genre, GrooveId } from '@/hooks/useSongTimeline';
import type { TrackId } from '@/lib/backingTrackTypes';
import { useBackingTrack } from '@/hooks/useBackingTrack';
import { useSharedSampleLibrary } from '@/hooks/SampleLibraryContext';
import TrackLane from './TrackLane';
import PianoRoll from './PianoRoll';

interface BackingTrackViewProps {
  chords: TimelineChord[];
  measures: number;
  bpm: number;
  genre: Genre;
  groove: GrooveId;
  /** Volume from main timeline */
  volume: number;
  /** External play state (driven by main timeline play button now) */
  isPlaying: boolean;
  /** Current playhead beat (driven by main timeline) */
  currentBeat: number;
  /** Register save/load + play/stop handlers with parent */
  registerHandlers?: (api: {
    save: (name: string) => void;
    load: (id: string) => void;
    remove: (id: string) => void;
    saved: { id: string; name: string }[];
    regenerateAll: () => void;
    play: (bpm: number, measures: number, genre: import('@/hooks/useSongTimeline').Genre, resolveUserSample?: import('@/hooks/engine/scheduler').UserSampleResolver) => Promise<{ startAudioTime: number; startPerfTime: number }>;
    stop: () => void;
    prewarm: () => Promise<void>;
  }) => void;
}

export default function BackingTrackView({
  chords, measures, bpm, genre, groove, volume, isPlaying, currentBeat, registerHandlers,
}: BackingTrackViewProps) {
  const bt = useBackingTrack();
  const { resolveSlot: resolveUserSample } = useSharedSampleLibrary();
  const [openClip, setOpenClip] = useState<{ trackId: TrackId; clipId: string } | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const latestBtRef = useRef(bt);
  const latestTimelineRef = useRef({ chords, measures, bpm, genre, groove });

  latestBtRef.current = bt;

  useEffect(() => {
    latestTimelineRef.current = { chords, measures, bpm, genre, groove };
  }, [chords, measures, bpm, genre, groove]);

  const savedItems = useMemo(
    () => bt.savedTracks.map(t => ({ id: t.id, name: t.name })),
    [bt.savedTracks],
  );

  const registeredApi = useMemo(() => ({
    save: (name: string) => {
      const { chords, measures, bpm, genre } = latestTimelineRef.current;
      latestBtRef.current.save(name, chords, measures, bpm, genre);
      toast.success(`Saved "${name}"`);
    },
    load: (id: string) => {
      const loaded = latestBtRef.current.load(id);
      if (loaded) toast.success(`Loaded "${loaded.name}"`);
    },
    remove: (id: string) => {
      latestBtRef.current.remove(id);
      toast('Backing track deleted');
    },
    saved: savedItems,
    regenerateAll: () => {
      const { chords, measures, genre, groove } = latestTimelineRef.current;
      latestBtRef.current.regenerateAll(chords, measures, genre, true, groove);
    },
    play: (bpm: number, measures: number, genre: import('@/hooks/useSongTimeline').Genre, providedResolver?: import('@/hooks/engine/scheduler').UserSampleResolver) => {
      const { chords, groove } = latestTimelineRef.current;
      return latestBtRef.current.play(bpm, measures, genre, providedResolver ?? resolveUserSample, { chords, groove });
    },
    stop: () => latestBtRef.current.stop(),
    prewarm: () => latestBtRef.current.prewarm(),
  }), [savedItems, resolveUserSample]);

  // Sync master volume from parent
  useEffect(() => {
    bt.setMasterVolume(volume);
  }, [volume, bt.setMasterVolume]);

  // NOTE: do NOT prewarm on mount — Tone.start() will hang indefinitely if
  // called outside a user gesture, which then deadlocks all subsequent
  // play() attempts. Prewarm only happens inside the play handler, which
  // is invoked from a real user click/keypress.

  // Drive engine play/stop from external isPlaying prop. Guarded by the
  // engine's own isPlaying flag so we don't double-trigger when the parent
  // also calls play() directly via the registered API.
  useEffect(() => {
    let cancelled = false;

    if (isPlaying) {
      if (latestBtRef.current.isPlaying) return;
      const { chords, groove } = latestTimelineRef.current;
      if (chords.length === 0) return;
      (async () => {
        try {
          await latestBtRef.current.play(bpm, measures, genre, resolveUserSample, { chords, groove });
          if (cancelled) latestBtRef.current.stop();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[BackingTrackView] play failed', err);
        }
      })();
    } else {
      if (latestBtRef.current.isPlaying) {
        latestBtRef.current.stop();
      }
    }
    return () => {
      cancelled = true;
    };
    // Only react to isPlaying transitions; bpm/measures/genre changes mid-play
    // are handled elsewhere via regenerate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Auto-generate first time we have chords
  useEffect(() => {
    if (chords.length > 0 && !hasGenerated) {
      bt.regenerateAll(chords, measures, genre, true, groove);
      setHasGenerated(true);
    }
  }, [chords, measures, genre, groove, hasGenerated, bt.regenerateAll]);

  // Re-generate non-edited tracks when chords/measures/genre/groove change
  useEffect(() => {
    if (hasGenerated && chords.length > 0) {
      bt.regenerateAll(chords, measures, genre, false, groove);
    }
  }, [chords, measures, genre, groove, hasGenerated, bt.regenerateAll]);

  // Re-generate a track when its intensity/complexity changes
  const trackKey = (id: TrackId) =>
    `${bt.tracks[id].intensity.toFixed(2)}-${bt.tracks[id].complexity.toFixed(2)}`;
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.piano.manuallyEdited) bt.regenerateTrack('piano', chords, measures, genre, groove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('piano')]);
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.bass.manuallyEdited) bt.regenerateTrack('bass', chords, measures, genre, groove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('bass')]);
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.drums.manuallyEdited) bt.regenerateTrack('drums', chords, measures, genre, groove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('drums')]);

  // Re-generate drums whenever fills change (fills are baked into note generation)
  useEffect(() => {
    if (chords.length === 0) return;
    bt.regenerateTrack('drums', chords, measures, genre, groove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bt.drumFills]);

  /* ── Continuous regeneration: every time the playhead wraps back to the
        top of the loop, regenerate fresh midi for piano/bass/drums and
        reschedule it onto the running Transport so each cycle is uniquely
        improvised. We detect the wrap (currentBeat dropping near 0) and
        rebuild the schedule for the cycle that's just begun. */
  const lastBeatRef = useRef(0);
  useEffect(() => {
    if (!isPlaying || chords.length === 0) return;
    const total = Math.max(4, measures * 4);
    const prev = lastBeatRef.current;
    const wrapped = prev > total - 0.5 && currentBeat < 0.5;
    lastBeatRef.current = currentBeat;
    if (!wrapped) return;
    // Off the render path so we don't block the playhead callback.
    requestAnimationFrame(() => {
      const ctx = latestTimelineRef.current;
      latestBtRef.current.regenerateAll(ctx.chords, ctx.measures, ctx.genre, false, ctx.groove);
      // Defer the reschedule a tick so the freshly-generated clips are in
      // tracksRef before scheduleTrack reads from it.
      requestAnimationFrame(() => {
        latestBtRef.current.rescheduleAll(ctx.measures, ctx.genre, resolveUserSample);
      });
    });
  }, [currentBeat, isPlaying, chords.length, measures, resolveUserSample]);

  // Register save/load with parent (so they appear in the chord timeline toolbar)
  useEffect(() => {
    registerHandlers?.(registeredApi);
  }, [registerHandlers, registeredApi]);

  const openClipNotes = openClip ? bt.tracks[openClip.trackId].clips.find(c => c.id === openClip.clipId) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Mini info bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-card shrink-0">
        <span className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Backing Track</span>
        <span className="text-[9px] font-mono text-muted-foreground ml-auto">
          Drag clips to move • Edges to resize • Del to remove • ⌘D to duplicate
        </span>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto">
        {(['piano', 'bass', 'drums'] as TrackId[]).map(id => (
          <TrackLane
            key={id}
            track={bt.tracks[id]}
            measures={measures}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
            bpm={bpm}
            genre={genre}
            chords={chords}
            onParamChange={(k, v) => bt.setTrackParam(id, k, v)}
            onRegenerate={() => bt.regenerateTrack(id, chords, measures, genre, groove)}
            onAINotes={(notes) => bt.setTrackNotes(id, notes, measures)}
            onUpdateClip={(clipId, patch) => bt.updateClip(id, clipId, patch)}
            onDeleteClip={(clipId) => bt.deleteClip(id, clipId)}
            onDuplicateClip={(clipId) => bt.duplicateClip(id, clipId)}
            onOpenClipEditor={(clipId) => setOpenClip({ trackId: id, clipId })}
            drumFills={id === 'drums' ? bt.drumFills : undefined}
            onAddDrumFill={id === 'drums' ? bt.addDrumFill : undefined}
            onUpdateDrumFill={id === 'drums' ? bt.updateDrumFill : undefined}
            onRemoveDrumFill={id === 'drums' ? bt.removeDrumFill : undefined}
          />
        ))}
        {chords.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[11px] font-mono text-muted-foreground">
            Add chords to the progression at the top to generate a backing track
          </div>
        )}
      </div>

      {/* Keyboard shortcuts key — sits in the empty space below the lanes */}
      <div className="px-2 pt-1.5 pb-1 shrink-0">
        <div className="inline-block rounded border border-border bg-card/40 px-2 py-1">
          <div className="text-[7px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
            Keyboard Shortcuts
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0 text-[8px] font-mono leading-tight">
            {[
              ['Z', 'Extend selected chord(s) to next chord'],
              ['X', 'Convert selected chord(s) to dominant 7'],
              ['A', 'Convert selected chord(s) to triads'],
              ['Del / ⌫', 'Remove selected chord or clip'],
              ['⌘D / Ctrl+D', 'Duplicate selected clip'],
              ['⌘ / Ctrl + click', 'Delete chord on click'],
              ['Shift + click', 'Add to selection'],
              ['Esc', 'Close piano roll / cancel'],
              ['Enter', 'Confirm name / save'],
            ].map(([k, desc]) => (
              <div key={k} className="contents">
                <kbd className="justify-self-start rounded border border-border bg-muted/60 px-1 py-0 text-[7px] text-foreground">
                  {k}
                </kbd>
                <span className="text-muted-foreground self-center">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>


      {openClip && openClipNotes && (
        <PianoRoll
          trackId={openClip.trackId}
          notes={openClipNotes.notes}
          measures={Math.max(1, Math.ceil(openClipNotes.duration / 4))}
          currentBeat={Math.max(0, currentBeat - openClipNotes.startBeat)}
          isPlaying={isPlaying}
          onChange={(notes) => bt.setClipNotes(openClip.trackId, openClip.clipId, notes)}
          onClose={() => setOpenClip(null)}
          onPreviewNote={(tid, pitch, velocity) => bt.previewNote(tid, pitch, velocity, genre, resolveUserSample)}
        />
      )}
    </div>
  );
}
