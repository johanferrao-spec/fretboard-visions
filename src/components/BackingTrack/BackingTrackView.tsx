import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import type { TimelineChord, Genre } from '@/hooks/useSongTimeline';
import type { TrackId } from '@/lib/backingTrackTypes';
import { useBackingTrack } from '@/hooks/useBackingTrack';
import TrackLane from './TrackLane';
import PianoRoll from './PianoRoll';

interface BackingTrackViewProps {
  chords: TimelineChord[];
  measures: number;
  bpm: number;
  genre: Genre;
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
    play: () => Promise<void>;
    stop: () => void;
  }) => void;
}

export default function BackingTrackView({
  chords, measures, bpm, genre, volume, isPlaying, currentBeat, registerHandlers,
}: BackingTrackViewProps) {
  const bt = useBackingTrack();
  const [openClip, setOpenClip] = useState<{ trackId: TrackId; clipId: string } | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Sync master volume from parent
  useEffect(() => {
    bt.setMasterVolume(volume);
  }, [volume, bt]);

  // Auto-generate first time we have chords
  useEffect(() => {
    if (chords.length > 0 && !hasGenerated) {
      bt.regenerateAll(chords, measures, genre, true);
      setHasGenerated(true);
    }
  }, [chords, measures, genre, hasGenerated, bt]);

  // Re-generate non-edited tracks when chords/measures/genre change
  useEffect(() => {
    if (hasGenerated && chords.length > 0) {
      bt.regenerateAll(chords, measures, genre, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chords, measures, genre]);

  // Re-generate a track when its intensity/complexity changes
  const trackKey = (id: TrackId) =>
    `${bt.tracks[id].intensity.toFixed(2)}-${bt.tracks[id].complexity.toFixed(2)}`;
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.piano.manuallyEdited) bt.regenerateTrack('piano', chords, measures, genre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('piano')]);
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.bass.manuallyEdited) bt.regenerateTrack('bass', chords, measures, genre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('bass')]);
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.drums.manuallyEdited) bt.regenerateTrack('drums', chords, measures, genre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('drums')]);

  // Register save/load with parent (so they appear in the chord timeline toolbar)
  useEffect(() => {
    registerHandlers?.({
      save: (name: string) => {
        bt.save(name, chords, measures, bpm, genre);
        toast.success(`Saved "${name}"`);
      },
      load: (id: string) => {
        const loaded = bt.load(id);
        if (loaded) toast.success(`Loaded "${loaded.name}"`);
      },
      remove: (id: string) => {
        bt.remove(id);
        toast('Backing track deleted');
      },
      saved: bt.savedTracks.map(t => ({ id: t.id, name: t.name })),
      regenerateAll: () => bt.regenerateAll(chords, measures, genre, true),
      play: () => bt.play(bpm, measures),
      stop: () => bt.stop(),
    });
  }, [bt, chords, measures, bpm, genre, registerHandlers]);

  const openClipNotes = openClip ? bt.tracks[openClip.trackId].clips.find(c => c.id === openClip.clipId) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Mini info bar — just a regenerate-all button (play & volume live in main timeline) */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-card shrink-0">
        <span className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Backing Track</span>
        <button
          onClick={() => bt.regenerateAll(chords, measures, genre, true)}
          className="px-2 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-1"
          title="Regenerate all tracks"
        >
          <RefreshCw size={9} />
          Regenerate All
        </button>
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
            onRegenerate={() => bt.regenerateTrack(id, chords, measures, genre)}
            onAINotes={(notes) => bt.setTrackNotes(id, notes, chords)}
            onUpdateClip={(clipId, patch) => bt.updateClip(id, clipId, patch)}
            onDeleteClip={(clipId) => bt.deleteClip(id, clipId)}
            onDuplicateClip={(clipId) => bt.duplicateClip(id, clipId)}
            onOpenClipEditor={(clipId) => setOpenClip({ trackId: id, clipId })}
          />
        ))}
        {chords.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[11px] font-mono text-muted-foreground">
            Add chords to the progression at the top to generate a backing track
          </div>
        )}
      </div>

      {/* Piano roll for selected clip */}
      {openClip && openClipNotes && (
        <PianoRoll
          trackId={openClip.trackId}
          notes={openClipNotes.notes}
          measures={Math.max(1, Math.ceil(openClipNotes.duration / 4))}
          currentBeat={Math.max(0, currentBeat - openClipNotes.startBeat)}
          isPlaying={isPlaying}
          onChange={(notes) => bt.setClipNotes(openClip.trackId, openClip.clipId, notes)}
          onClose={() => setOpenClip(null)}
        />
      )}
    </div>
  );
}
