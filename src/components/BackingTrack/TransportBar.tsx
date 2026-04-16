import { useState } from 'react';
import { Play, Square, Save, FolderOpen, Trash2, RefreshCw } from 'lucide-react';

interface TransportBarProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRegenerateAll: () => void;
  onSave: (name: string) => void;
  savedTracks: { id: string; name: string }[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}

export default function TransportBar({
  isPlaying, onPlay, onStop, onRegenerateAll,
  onSave, savedTracks, onLoad, onDelete, volume, onVolumeChange,
}: TransportBarProps) {
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [name, setName] = useState('');

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card shrink-0 flex-wrap">
      <button
        onClick={isPlaying ? onStop : onPlay}
        className={`p-1.5 rounded-md transition-colors ${
          isPlaying ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' : 'bg-primary/20 text-primary hover:bg-primary/30'
        }`}
        title={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? <Square size={14} /> : <Play size={14} />}
      </button>

      <button
        onClick={onRegenerateAll}
        className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-1"
        title="Regenerate all tracks based on current chord progression and slider settings"
      >
        <RefreshCw size={10} />
        Regenerate All
      </button>

      <div className="flex items-center gap-1" title={`Master volume: ${Math.round(volume * 100)}%`}>
        <span className="text-[9px] font-mono text-muted-foreground">🔊</span>
        <input
          type="range" min={0} max={100} value={volume * 100}
          onChange={e => onVolumeChange(Number(e.target.value) / 100)}
          className="w-20 accent-primary"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 relative">
        <button
          onClick={() => { setShowSave(!showSave); setShowLoad(false); }}
          className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
        >
          <Save size={10} /> Save
        </button>
        <button
          onClick={() => { setShowLoad(!showLoad); setShowSave(false); }}
          className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-1"
        >
          <FolderOpen size={10} /> Load
          {savedTracks.length > 0 && (
            <span className="text-[8px] bg-muted rounded px-1 ml-0.5">{savedTracks.length}</span>
          )}
        </button>

        {showSave && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-xl p-2 w-56 animate-fade-in">
            <div className="text-[9px] font-mono uppercase text-muted-foreground mb-1.5">Save Backing Track</div>
            <input
              type="text" placeholder="Track name…" value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && name.trim()) {
                  onSave(name.trim()); setName(''); setShowSave(false);
                } else if (e.key === 'Escape') {
                  setShowSave(false);
                }
              }}
              className="w-full bg-muted text-foreground text-[11px] font-mono rounded px-2 py-1 border border-border mb-1.5"
            />
            <div className="flex gap-1">
              <button
                onClick={() => { if (name.trim()) { onSave(name.trim()); setName(''); setShowSave(false); } }}
                className="flex-1 px-2 py-1 rounded text-[9px] font-mono uppercase bg-primary text-primary-foreground hover:bg-primary/90"
              >Save</button>
              <button
                onClick={() => setShowSave(false)}
                className="px-2 py-1 rounded text-[9px] font-mono uppercase bg-secondary text-secondary-foreground hover:bg-muted"
              >Cancel</button>
            </div>
          </div>
        )}

        {showLoad && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-xl p-2 w-64 max-h-64 overflow-y-auto animate-fade-in">
            <div className="text-[9px] font-mono uppercase text-muted-foreground mb-1.5">Saved Backing Tracks</div>
            {savedTracks.length === 0 ? (
              <div className="text-[10px] font-mono text-muted-foreground py-2 text-center">No saved tracks yet</div>
            ) : (
              savedTracks.map(t => (
                <div key={t.id} className="flex items-center gap-1 mb-1">
                  <button
                    onClick={() => { onLoad(t.id); setShowLoad(false); }}
                    className="flex-1 text-left px-2 py-1 rounded text-[10px] font-mono bg-muted/40 text-foreground hover:bg-muted transition-colors truncate"
                  >{t.name}</button>
                  <button
                    onClick={() => { if (confirm(`Delete "${t.name}"?`)) onDelete(t.id); }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
