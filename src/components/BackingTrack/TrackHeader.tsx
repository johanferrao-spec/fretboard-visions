import { Volume2, VolumeX, Sparkles, Loader2 } from 'lucide-react';
import type { TrackId, TrackState } from '@/lib/backingTrackTypes';
import { TRACK_COLORS, TRACK_LABELS } from '@/lib/backingTrackTypes';

interface TrackHeaderProps {
  track: TrackState;
  onChange: <K extends keyof TrackState>(key: K, value: TrackState[K]) => void;
  onRegenerate: () => void;
  onAIRegenerate: () => void;
  isAILoading: boolean;
}

export default function TrackHeader({ track, onChange, onRegenerate, onAIRegenerate, isAILoading }: TrackHeaderProps) {
  const color = TRACK_COLORS[track.id];

  return (
    <div
      className="flex flex-col gap-1.5 p-2 border-r border-border h-full"
      style={{
        backgroundColor: `hsl(${color} / 0.08)`,
        width: 200,
        minWidth: 200,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground">
            {TRACK_LABELS[track.id]}
          </span>
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={() => onChange('muted', !track.muted)}
            className={`w-5 h-5 rounded text-[8px] font-mono font-bold flex items-center justify-center transition-colors ${
              track.muted ? 'bg-destructive/30 text-destructive' : 'bg-secondary text-muted-foreground hover:bg-muted'
            }`}
            title="Mute"
          >
            {track.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
          </button>
          <button
            onClick={() => onChange('solo', !track.solo)}
            className={`w-5 h-5 rounded text-[8px] font-mono font-bold flex items-center justify-center transition-colors ${
              track.solo ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'
            }`}
            title="Solo"
          >
            S
          </button>
        </div>
      </div>

      {/* Intensity */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-mono uppercase text-muted-foreground tracking-wider">Intensity</span>
          <span className="text-[8px] font-mono text-foreground">{Math.round(track.intensity * 100)}</span>
        </div>
        <input
          type="range" min={0} max={100} value={track.intensity * 100}
          onChange={e => onChange('intensity', Number(e.target.value) / 100)}
          className="w-full h-1 accent-primary cursor-pointer"
        />
      </div>

      {/* Complexity */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-mono uppercase text-muted-foreground tracking-wider">Complexity</span>
          <span className="text-[8px] font-mono text-foreground">{Math.round(track.complexity * 100)}</span>
        </div>
        <input
          type="range" min={0} max={100} value={track.complexity * 100}
          onChange={e => onChange('complexity', Number(e.target.value) / 100)}
          className="w-full h-1 accent-primary cursor-pointer"
        />
      </div>

      <div className="flex gap-1 mt-auto">
        <button
          onClick={onRegenerate}
          className="flex-1 px-1.5 py-1 rounded text-[8px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
          title="Regenerate using rule-based engine"
        >
          ↻ Pattern
        </button>
        <button
          onClick={onAIRegenerate}
          disabled={isAILoading}
          className="flex-1 px-1.5 py-1 rounded text-[8px] font-mono uppercase tracking-wider bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center justify-center gap-0.5 disabled:opacity-50"
          title="Regenerate with AI"
        >
          {isAILoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          AI
        </button>
      </div>

      {track.manuallyEdited && (
        <div className="text-[7px] font-mono text-amber-500 uppercase tracking-wider">● edited</div>
      )}
    </div>
  );
}
