import { useState } from 'react';
import { toast } from 'sonner';
import type { TrackId, TrackState } from '@/lib/backingTrackTypes';
import type { TimelineChord, Genre } from '@/hooks/useSongTimeline';
import TrackHeader from './TrackHeader';
import ClipPreview from './ClipPreview';
import { supabase } from '@/integrations/supabase/client';

interface TrackLaneProps {
  track: TrackState;
  measures: number;
  currentBeat: number;
  isPlaying: boolean;
  bpm: number;
  genre: Genre;
  chords: TimelineChord[];
  onParamChange: <K extends keyof TrackState>(key: K, value: TrackState[K]) => void;
  onRegenerate: () => void;
  onAINotes: (notes: TrackState['notes']) => void;
  onOpenEditor: () => void;
}

export default function TrackLane({
  track, measures, currentBeat, isPlaying, bpm, genre, chords,
  onParamChange, onRegenerate, onAINotes, onOpenEditor,
}: TrackLaneProps) {
  const [aiLoading, setAiLoading] = useState(false);

  const handleAIRegen = async () => {
    if (chords.length === 0) {
      toast.error('Add chords to the progression first');
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-backing-midi', {
        body: {
          trackType: track.id,
          chords,
          measures,
          bpm,
          genre,
          intensity: track.intensity,
          complexity: track.complexity,
        },
      });
      if (error) {
        if ((error as any).status === 429) toast.error('Rate limit exceeded — try again shortly');
        else if ((error as any).status === 402) toast.error('AI credits exhausted — add credits to your workspace');
        else toast.error((error as any).message || 'AI generation failed');
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const notes = (data?.notes || []).map((n: any, i: number) => ({
        id: `ai-${track.id}-${Date.now()}-${i}`,
        startBeat: n.startBeat,
        duration: n.duration,
        pitch: n.pitch,
        velocity: n.velocity,
      }));
      onAINotes(notes);
      toast.success(`AI generated ${notes.length} ${track.id} notes`);
    } catch (e) {
      console.error(e);
      toast.error('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex border-b border-border" style={{ height: 96 }}>
      <TrackHeader
        track={track}
        onChange={onParamChange}
        onRegenerate={onRegenerate}
        onAIRegenerate={handleAIRegen}
        isAILoading={aiLoading}
      />
      <div className="flex-1 p-1.5 min-w-0">
        <ClipPreview
          trackId={track.id}
          notes={track.notes}
          measures={measures}
          currentBeat={currentBeat}
          isPlaying={isPlaying}
          onOpenEditor={onOpenEditor}
        />
      </div>
    </div>
  );
}
