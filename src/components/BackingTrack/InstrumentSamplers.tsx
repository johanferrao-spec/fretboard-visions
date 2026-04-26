import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Music, Upload } from 'lucide-react';
import type { DrumPart, SamplerInstrument } from '@/lib/backingTrackTypes';
import { useSampleLibrary, PART_COLORS, type SlotKey } from '@/hooks/useSampleLibrary';
import type { StoredSample } from '@/lib/sampleStorage';

interface Props {
  /** Master volume so the preview button matches playback level. */
  volume: number;
}

type Selection =
  | { instrument: 'drums'; part: DrumPart }
  | { instrument: 'bass' }
  | { instrument: 'keys' };

function selectionToSlot(sel: Selection): SlotKey {
  if (sel.instrument === 'drums') return `drums:${sel.part}`;
  return sel.instrument;
}

export default function InstrumentSamplers({ volume }: Props) {
  const lib = useSampleLibrary();
  const [selection, setSelection] = useState<Selection>({ instrument: 'drums', part: 'snare' });
  const [dragOver, setDragOver] = useState<SlotKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const slot = selectionToSlot(selection);
  const slotSamples = lib.samplesForSlot(slot);
  const activeSample = lib.activeSampleFor(slot);

  // Build a map of slot -> active color so we can tint the SVG parts.
  const partTints = useMemo(() => {
    const tints: Partial<Record<DrumPart, string>> = {};
    (['kick','snare','hihat','ride','tom1','tom2','crash'] as DrumPart[]).forEach(part => {
      const a = lib.activeSampleFor(`drums:${part}` as SlotKey);
      if (a) tints[part] = a.color;
    });
    return tints;
  }, [lib]);

  const bassActive = lib.activeSampleFor('bass');
  const keysActive = lib.activeSampleFor('keys');

  const handleDrop = async (e: React.DragEvent, dropSlot: SlotKey) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/^audio\//.test(file.type) && !/\.(wav|mp3|ogg|m4a|aiff?)$/i.test(file.name)) return;
    await lib.addSample(dropSlot, file);
    // Switch the right-panel selection to where the sample landed.
    if (dropSlot.startsWith('drums:')) {
      const part = dropSlot.split(':')[1] as DrumPart;
      setSelection({ instrument: 'drums', part });
    } else {
      setSelection({ instrument: dropSlot as 'bass' | 'keys' });
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    await lib.addSample(slot, files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const previewSample = (s: StoredSample) => {
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.src = '';
    }
    const url = URL.createObjectURL(s.blob);
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, volume));
    a.play().catch(() => {});
    a.onended = () => URL.revokeObjectURL(url);
    previewRef.current = a;
  };

  useEffect(() => () => {
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current = null;
    }
  }, []);

  // Helpers for rendering a clickable + droppable kit part on the SVG.
  const partProps = (part: DrumPart) => ({
    onClick: () => setSelection({ instrument: 'drums', part }),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(`drums:${part}` as SlotKey); },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => handleDrop(e, `drums:${part}` as SlotKey),
    style: { cursor: 'pointer' as const },
  });

  const isPartSelected = (part: DrumPart) =>
    selection.instrument === 'drums' && selection.part === part;
  const isPartDragOver = (part: DrumPart) => dragOver === `drums:${part}`;

  // Default fallback fill for kit parts (when no active sample).
  const DEFAULT_FILL = 'hsl(220 12% 28%)';
  const STROKE_DEFAULT = 'hsl(220 10% 50%)';
  const partFill = (part: DrumPart) => {
    const tint = partTints[part];
    if (tint) return `hsl(${tint})`;
    return DEFAULT_FILL;
  };
  const partStroke = (part: DrumPart) =>
    isPartSelected(part) ? 'hsl(var(--primary))' :
    isPartDragOver(part) ? 'hsl(var(--beginner-yellow))' :
    STROKE_DEFAULT;
  const partStrokeWidth = (part: DrumPart) =>
    isPartSelected(part) || isPartDragOver(part) ? 2.5 : 1;

  return (
    <div className="flex h-full bg-card border-t border-border overflow-hidden">
      {/* LEFT: sample list + parameters for current selection */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {selection.instrument === 'drums' ? `Drums · ${selection.part}` : selection.instrument === 'bass' ? 'Bass sampler' : 'Keys sampler'}
          </div>
          <div className="text-[10px] font-mono text-foreground mt-0.5 truncate">
            {activeSample ? activeSample.name : 'No sample selected'}
          </div>
        </div>

        {/* Parameters (placeholders for now — gain/tune-style controls common to all samplers) */}
        <div className="px-3 py-2 border-b border-border space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase text-muted-foreground w-12">Gain</span>
            <input type="range" min={0} max={100} defaultValue={80} className="flex-1 accent-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase text-muted-foreground w-12">Tune</span>
            <input type="range" min={-12} max={12} defaultValue={0} className="flex-1 accent-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase text-muted-foreground w-12">Decay</span>
            <input type="range" min={0} max={100} defaultValue={70} className="flex-1 accent-primary" />
          </div>
        </div>

        {/* Sample list for the active slot */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-muted-foreground">Samples</span>
            <button
              onClick={handleUploadClick}
              className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-muted flex items-center gap-1"
              title="Upload audio file"
            >
              <Upload size={9} /> Add
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.ogg,.m4a,.aiff,.aif"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>
          {slotSamples.length === 0 && (
            <div className="px-3 py-3 text-[10px] font-mono text-muted-foreground italic">
              {lib.loaded ? 'Drop a .wav onto the diagram or use Add' : 'Loading library…'}
            </div>
          )}
          {slotSamples.map(s => {
            const isActive = activeSample?.id === s.id;
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 ${isActive ? 'bg-muted/70' : ''}`}
                onClick={() => lib.selectSample(slot, s.id)}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: `hsl(${s.color})` }}
                />
                <span className="text-[10px] font-mono text-foreground truncate flex-1">{s.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); previewSample(s); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  title="Preview"
                >
                  <Music size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); lib.removeSample(s.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: vector art for all three instruments */}
      <div className="flex-1 flex items-stretch justify-around gap-3 p-3 overflow-x-auto">
        {/* DRUM KIT */}
        <div className="flex flex-col items-center min-w-[280px]">
          <svg viewBox="0 0 280 180" className="w-full h-full max-h-[180px]">
            {/* Crash (left top) */}
            <g {...partProps('crash')}>
              <ellipse cx="40" cy="40" rx="28" ry="6" fill={partFill('crash')} stroke={partStroke('crash')} strokeWidth={partStrokeWidth('crash')} />
              <line x1="40" y1="40" x2="40" y2="115" stroke={STROKE_DEFAULT} strokeWidth={1.2} />
            </g>
            {/* Hi-hat (right top) */}
            <g {...partProps('hihat')}>
              <ellipse cx="240" cy="50" rx="22" ry="5" fill={partFill('hihat')} stroke={partStroke('hihat')} strokeWidth={partStrokeWidth('hihat')} />
              <ellipse cx="240" cy="56" rx="22" ry="5" fill={partFill('hihat')} stroke={partStroke('hihat')} strokeWidth={partStrokeWidth('hihat')} opacity={0.7} />
              <line x1="240" y1="56" x2="240" y2="125" stroke={STROKE_DEFAULT} strokeWidth={1.2} />
            </g>
            {/* Ride (right back) */}
            <g {...partProps('ride')}>
              <ellipse cx="210" cy="35" rx="32" ry="7" fill={partFill('ride')} stroke={partStroke('ride')} strokeWidth={partStrokeWidth('ride')} />
              <line x1="210" y1="35" x2="210" y2="100" stroke={STROKE_DEFAULT} strokeWidth={1.2} />
            </g>
            {/* Tom 1 */}
            <g {...partProps('tom1')}>
              <ellipse cx="105" cy="75" rx="22" ry="6" fill={partFill('tom1')} stroke={partStroke('tom1')} strokeWidth={partStrokeWidth('tom1')} />
              <path d={`M 83 75 L 87 110 L 123 110 L 127 75 Z`} fill={partFill('tom1')} stroke={partStroke('tom1')} strokeWidth={partStrokeWidth('tom1')} opacity={0.8} />
            </g>
            {/* Tom 2 */}
            <g {...partProps('tom2')}>
              <ellipse cx="160" cy="78" rx="24" ry="6" fill={partFill('tom2')} stroke={partStroke('tom2')} strokeWidth={partStrokeWidth('tom2')} />
              <path d={`M 136 78 L 140 115 L 180 115 L 184 78 Z`} fill={partFill('tom2')} stroke={partStroke('tom2')} strokeWidth={partStrokeWidth('tom2')} opacity={0.8} />
            </g>
            {/* Snare (front center-left) */}
            <g {...partProps('snare')}>
              <ellipse cx="70" cy="120" rx="28" ry="7" fill={partFill('snare')} stroke={partStroke('snare')} strokeWidth={partStrokeWidth('snare')} />
              <path d={`M 42 120 L 46 145 L 94 145 L 98 120 Z`} fill={partFill('snare')} stroke={partStroke('snare')} strokeWidth={partStrokeWidth('snare')} opacity={0.85} />
            </g>
            {/* Kick drum (front-center, large) */}
            <g {...partProps('kick')}>
              <ellipse cx="140" cy="135" rx="46" ry="11" fill={partFill('kick')} stroke={partStroke('kick')} strokeWidth={partStrokeWidth('kick')} />
              <path d={`M 94 135 L 100 175 L 180 175 L 186 135 Z`} fill={partFill('kick')} stroke={partStroke('kick')} strokeWidth={partStrokeWidth('kick')} opacity={0.9} />
              <circle cx="140" cy="155" r="6" fill="hsl(220 10% 15%)" stroke={STROKE_DEFAULT} strokeWidth={0.8} />
            </g>
            {/* Floor tom (right front) */}
            <g {...partProps('ride')} style={{ display: 'none' }} />
          </svg>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Drums</div>
        </div>

        {/* BASS */}
        <div
          className={`flex flex-col items-center min-w-[110px] rounded-md transition-colors ${dragOver === 'bass' ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
          onClick={() => setSelection({ instrument: 'bass' })}
          onDragOver={(e) => { e.preventDefault(); setDragOver('bass'); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, 'bass')}
          style={{ cursor: 'pointer' }}
        >
          <svg viewBox="0 0 100 180" className="h-full max-h-[180px]">
            {/* Headstock */}
            <path d="M 38 5 L 62 5 L 60 28 L 40 28 Z"
                  fill={bassActive ? `hsl(${bassActive.color})` : 'hsl(30 35% 25%)'}
                  stroke={selection.instrument === 'bass' ? 'hsl(var(--primary))' : STROKE_DEFAULT}
                  strokeWidth={selection.instrument === 'bass' ? 2.5 : 1} />
            {/* Tuning pegs */}
            {[0,1,2,3].map(i => (
              <circle key={i} cx={i % 2 === 0 ? 36 : 64} cy={10 + Math.floor(i/2)*8} r={1.8} fill={STROKE_DEFAULT} />
            ))}
            {/* Neck */}
            <rect x="44" y="28" width="12" height="80"
                  fill={bassActive ? `hsl(${bassActive.color} / 0.7)` : 'hsl(30 30% 20%)'}
                  stroke={STROKE_DEFAULT} strokeWidth={1} />
            {/* Frets */}
            {Array.from({length: 8}).map((_, i) => (
              <line key={i} x1="44" y1={36 + i*9} x2="56" y2={36 + i*9} stroke="hsl(45 30% 70%)" strokeWidth={0.5} />
            ))}
            {/* Body */}
            <path d="M 22 105 Q 8 130 22 165 Q 50 178 78 165 Q 92 130 78 105 Q 65 100 50 102 Q 35 100 22 105 Z"
                  fill={bassActive ? `hsl(${bassActive.color})` : 'hsl(30 40% 30%)'}
                  stroke={selection.instrument === 'bass' ? 'hsl(var(--primary))' : STROKE_DEFAULT}
                  strokeWidth={selection.instrument === 'bass' ? 2.5 : 1} />
            {/* Pickups */}
            <rect x="36" y="125" width="28" height="6" rx="1" fill="hsl(220 10% 15%)" />
            <rect x="36" y="142" width="28" height="6" rx="1" fill="hsl(220 10% 15%)" />
            {/* Bridge */}
            <rect x="40" y="158" width="20" height="4" fill="hsl(45 25% 60%)" />
            {/* Strings */}
            {[46, 48.5, 51, 53.5].map((x,i) => (
              <line key={i} x1={x} y1={28} x2={x} y2={160} stroke="hsl(45 50% 80%)" strokeWidth={0.6} />
            ))}
          </svg>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Bass</div>
        </div>

        {/* KEYS */}
        <div
          className={`flex flex-col items-center min-w-[180px] rounded-md transition-colors ${dragOver === 'keys' ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
          onClick={() => setSelection({ instrument: 'keys' })}
          onDragOver={(e) => { e.preventDefault(); setDragOver('keys'); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, 'keys')}
          style={{ cursor: 'pointer' }}
        >
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[180px]">
            {/* Casing */}
            <rect x="4" y="20" width="232" height="140" rx="6"
                  fill={keysActive ? `hsl(${keysActive.color})` : 'hsl(220 12% 18%)'}
                  stroke={selection.instrument === 'keys' ? 'hsl(var(--primary))' : STROKE_DEFAULT}
                  strokeWidth={selection.instrument === 'keys' ? 2.5 : 1} />
            {/* Top control strip */}
            <rect x="14" y="28" width="212" height="22" rx="3" fill="hsl(220 10% 12%)" />
            {[0,1,2,3,4].map(i => (
              <circle key={i} cx={28 + i*22} cy={39} r={3.5} fill="hsl(45 35% 60%)" />
            ))}
            <rect x="150" y="32" width="68" height="14" rx="2" fill="hsl(160 60% 35%)" opacity={0.6} />
            {/* White keys */}
            {Array.from({length: 14}).map((_, i) => (
              <rect key={`w-${i}`} x={14 + i*16} y={56} width={15} height={96} fill="hsl(45 30% 95%)" stroke="hsl(220 10% 30%)" strokeWidth={0.5} />
            ))}
            {/* Black keys (skip pattern) */}
            {[0,1,3,4,5,7,8,10,11,12].map((i, idx) => {
              const positions = [10,11,13,14,15,17,18,20,21,22];
              const w = 9;
              const x = 14 + positions[idx]*16/1.4;
              return null;
            })}
            {/* Black keys positioned by white-key index */}
            {[0,1,3,4,5,7,8,10,11,12].map(i => (
              <rect key={`b-${i}`} x={14 + i*16 + 11} y={56} width={9} height={58} fill="hsl(220 10% 10%)" stroke="hsl(220 10% 30%)" strokeWidth={0.4} />
            ))}
          </svg>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Keys</div>
        </div>
      </div>
    </div>
  );
}
