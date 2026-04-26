import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Music, Upload } from 'lucide-react';
import type { DrumPart } from '@/lib/backingTrackTypes';
import { useSampleLibrary, type SlotKey, type SampleListEntry } from '@/hooks/useSampleLibrary';
import { KIT_COLORS, KIT_PARTS, type DrumKitGenre } from '@/lib/builtInKits';

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

const PART_LABEL: Record<DrumPart, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  ride: 'Ride',
  tom1: 'Tom 1',
  tom2: 'Tom 2',
  crash: 'Crash',
};

/** Tiny inline icon glyphs for each drum part — drawn as simple SVGs. */
function PartIcon({ part, color, size = 18 }: { part: DrumPart; color: string; size?: number }) {
  const s = size;
  const fill = `hsl(${color})`;
  const stroke = 'hsl(var(--border))';
  if (part === 'kick') {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill={fill} stroke={stroke} strokeWidth="1" />
        <circle cx="10" cy="10" r="2.5" fill="hsl(220 10% 12%)" />
      </svg>
    );
  }
  if (part === 'snare') {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" fill={fill} stroke={stroke} strokeWidth="1" />
        <line x1="3" y1="10" x2="17" y2="10" stroke="hsl(220 10% 25%)" strokeWidth="0.8" />
      </svg>
    );
  }
  if (part === 'hihat' || part === 'ride' || part === 'crash') {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill={fill} stroke={stroke} strokeWidth="1" />
        <circle cx="10" cy="10" r="5" fill="none" stroke="hsl(220 10% 25%)" strokeWidth="0.6" />
        <circle cx="10" cy="10" r="3" fill="none" stroke="hsl(220 10% 25%)" strokeWidth="0.6" />
        <circle cx="10" cy="10" r="1.2" fill="hsl(220 10% 12%)" />
      </svg>
    );
  }
  // toms
  return (
    <svg width={s} height={s} viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7" fill={fill} stroke={stroke} strokeWidth="1" />
      <circle cx="10" cy="10" r="4" fill="none" stroke="hsl(220 10% 25%)" strokeWidth="0.6" />
    </svg>
  );
}

export default function InstrumentSamplers({ volume }: Props) {
  const lib = useSampleLibrary();
  const [selection, setSelection] = useState<Selection>({ instrument: 'drums', part: 'snare' });
  const [dragOver, setDragOver] = useState<SlotKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const slot = selectionToSlot(selection);
  const slotSamples = lib.samplesForSlot(slot);
  const activeEntry = lib.activeEntryFor(slot);

  // Map each drum part -> its currently active kit color for tinting the SVG.
  const partTints = useMemo(() => {
    const tints: Partial<Record<DrumPart, string>> = {};
    KIT_PARTS.forEach(part => {
      const a = lib.activeEntryFor(`drums:${part}` as SlotKey);
      if (a) tints[part] = a.color;
    });
    return tints;
  }, [lib]);

  const bassActive = lib.activeEntryFor('bass');
  const keysActive = lib.activeEntryFor('keys');

  const handleDrop = async (e: React.DragEvent, dropSlot: SlotKey) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/^audio\//.test(file.type) && !/\.(wav|mp3|ogg|m4a|aiff?)$/i.test(file.name)) return;
    await lib.addSample(dropSlot, file);
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

  const previewSample = (entry: SampleListEntry) => {
    if (entry.kind !== 'user' || !entry.userSample) return; // built-ins don't have a previewable blob
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.src = '';
    }
    const url = URL.createObjectURL(entry.userSample.blob);
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

  // ── Drum SVG helpers (top-down view) ──────────────────────────────
  const STROKE_DEFAULT = 'hsl(220 10% 50%)';
  const DEFAULT_FILL = 'hsl(220 12% 28%)';
  const partFill = (part: DrumPart) => {
    const tint = partTints[part];
    return tint ? `hsl(${tint})` : DEFAULT_FILL;
  };
  const isPartSelected = (part: DrumPart) =>
    selection.instrument === 'drums' && selection.part === part;
  const isPartDragOver = (part: DrumPart) => dragOver === `drums:${part}`;
  const partStroke = (part: DrumPart) =>
    isPartSelected(part) ? 'hsl(var(--primary))' :
    isPartDragOver(part) ? 'hsl(var(--beginner-yellow))' :
    STROKE_DEFAULT;
  const partStrokeWidth = (part: DrumPart) =>
    isPartSelected(part) || isPartDragOver(part) ? 2.5 : 1;

  const partProps = (part: DrumPart) => ({
    onClick: () => setSelection({ instrument: 'drums', part }),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(`drums:${part}` as SlotKey); },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => handleDrop(e, `drums:${part}` as SlotKey),
    style: { cursor: 'pointer' as const },
  });

  return (
    <div className="flex h-full bg-card border-t border-border overflow-hidden">
      {/* LEFT COLUMN: drum-part icons + sample list */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {selection.instrument === 'drums' ? `Drums · ${PART_LABEL[selection.part]}` : selection.instrument === 'bass' ? 'Bass sampler' : 'Keys sampler'}
          </div>
          <div className="text-[10px] font-mono text-foreground mt-0.5 truncate">
            {activeEntry ? activeEntry.name : 'No sample selected'}
          </div>
        </div>

        {/* Drum-part icon picker (only when drums selected) */}
        {selection.instrument === 'drums' && (
          <div className="px-2 py-2 border-b border-border grid grid-cols-4 gap-1">
            {KIT_PARTS.map(part => {
              const tint = partTints[part];
              const sel = isPartSelected(part);
              return (
                <button
                  key={part}
                  onClick={() => setSelection({ instrument: 'drums', part })}
                  className={`flex flex-col items-center gap-0.5 py-1.5 rounded border transition-colors ${
                    sel ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'
                  }`}
                  title={PART_LABEL[part]}
                >
                  <PartIcon part={part} color={tint || '220 10% 40%'} />
                  <span className="text-[8px] font-mono uppercase text-muted-foreground">{PART_LABEL[part]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sample list for the active slot */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-muted-foreground">
              {selection.instrument === 'drums' ? 'Samples (all kits)' : 'Samples'}
            </span>
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
            const isActive = activeEntry?.id === s.id;
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
                <span className="text-[10px] font-mono text-foreground truncate flex-1">
                  {s.kind === 'builtin' ? <span className="opacity-70">{s.kit}</span> : s.name}
                  {s.kind === 'builtin' && <span className="ml-1">{s.part}</span>}
                </span>
                {s.kind === 'user' && (
                  <>
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
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick "apply whole kit" buttons */}
        {selection.instrument === 'drums' && (
          <div className="px-2 py-2 border-t border-border">
            <div className="text-[9px] font-mono uppercase text-muted-foreground mb-1">Apply kit</div>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(KIT_COLORS) as DrumKitGenre[]).map(kit => (
                <button
                  key={kit}
                  onClick={() => lib.applyKitForAllParts(kit)}
                  className="text-[9px] font-mono uppercase rounded py-1 border border-border hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: `hsl(${KIT_COLORS[kit]} / 0.3)`, color: 'hsl(var(--foreground))' }}
                  title={`Set every drum to the ${kit} kit`}
                >
                  {kit}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CENTER + RIGHT: vector art for all three instruments */}
      <div className="flex-1 flex items-stretch justify-around gap-3 p-3 overflow-x-auto">
        {/* DRUM KIT — top-down view */}
        <div className="flex flex-col items-center min-w-[320px] flex-1">
          <svg viewBox="0 0 320 220" className="w-full h-full max-h-[200px]">
            {/* Crash (top-left, large cymbal) */}
            <g {...partProps('crash')}>
              <circle cx="60" cy="55" r="38" fill={partFill('crash')} stroke={partStroke('crash')} strokeWidth={partStrokeWidth('crash')} />
              <circle cx="60" cy="55" r="28" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.8" />
              <circle cx="60" cy="55" r="20" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.8" />
              <circle cx="60" cy="55" r="12" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.8" />
              <circle cx="60" cy="55" r="2" fill="hsl(220 10% 12%)" />
            </g>

            {/* Ride (top-right, large cymbal) */}
            <g {...partProps('ride')}>
              <circle cx="260" cy="55" r="42" fill={partFill('ride')} stroke={partStroke('ride')} strokeWidth={partStrokeWidth('ride')} />
              <circle cx="260" cy="55" r="32" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.8" />
              <circle cx="260" cy="55" r="22" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.8" />
              <circle cx="260" cy="55" r="12" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.8" />
              <circle cx="260" cy="55" r="2" fill="hsl(220 10% 12%)" />
            </g>

            {/* Hi-hat (far left, smaller stacked cymbals) */}
            <g {...partProps('hihat')}>
              <circle cx="30" cy="155" r="22" fill={partFill('hihat')} stroke={partStroke('hihat')} strokeWidth={partStrokeWidth('hihat')} />
              <circle cx="30" cy="155" r="15" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.6" />
              <circle cx="30" cy="155" r="8" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.6" />
              <circle cx="30" cy="155" r="1.5" fill="hsl(220 10% 12%)" />
            </g>

            {/* Tom 1 (centre-back-left) */}
            <g {...partProps('tom1')}>
              <circle cx="125" cy="100" r="26" fill={partFill('tom1')} stroke={partStroke('tom1')} strokeWidth={partStrokeWidth('tom1')} />
              <circle cx="125" cy="100" r="20" fill="none" stroke="hsl(220 10% 25% / 0.4)" strokeWidth="0.6" />
              {/* lugs */}
              {[0,1,2,3,4,5].map(i => {
                const ang = (i * Math.PI) / 3;
                const x = 125 + Math.cos(ang) * 26;
                const y = 100 + Math.sin(ang) * 26;
                return <rect key={i} x={x-2} y={y-1.5} width="4" height="3" fill="hsl(220 10% 30%)" />;
              })}
            </g>

            {/* Tom 2 (centre-back-right) */}
            <g {...partProps('tom2')}>
              <circle cx="195" cy="100" r="28" fill={partFill('tom2')} stroke={partStroke('tom2')} strokeWidth={partStrokeWidth('tom2')} />
              <circle cx="195" cy="100" r="22" fill="none" stroke="hsl(220 10% 25% / 0.4)" strokeWidth="0.6" />
              {[0,1,2,3,4,5].map(i => {
                const ang = (i * Math.PI) / 3;
                const x = 195 + Math.cos(ang) * 28;
                const y = 100 + Math.sin(ang) * 28;
                return <rect key={i} x={x-2} y={y-1.5} width="4" height="3" fill="hsl(220 10% 30%)" />;
              })}
            </g>

            {/* Snare (front-left) */}
            <g {...partProps('snare')}>
              <circle cx="100" cy="170" r="32" fill={partFill('snare')} stroke={partStroke('snare')} strokeWidth={partStrokeWidth('snare')} />
              <circle cx="100" cy="170" r="25" fill="none" stroke="hsl(220 10% 25% / 0.5)" strokeWidth="0.7" />
              {/* snare wires across the centre */}
              <line x1="72" y1="170" x2="128" y2="170" stroke="hsl(45 25% 75%)" strokeWidth="0.8" opacity="0.7" />
              {[0,1,2,3,4,5,6,7].map(i => {
                const ang = (i * Math.PI) / 4;
                const x = 100 + Math.cos(ang) * 32;
                const y = 170 + Math.sin(ang) * 32;
                return <rect key={i} x={x-2} y={y-1.5} width="4" height="3" fill="hsl(220 10% 30%)" />;
              })}
            </g>

            {/* Kick (front-centre, largest circle — viewed from above as a wide drum) */}
            <g {...partProps('kick')}>
              <circle cx="220" cy="170" r="44" fill={partFill('kick')} stroke={partStroke('kick')} strokeWidth={partStrokeWidth('kick')} />
              <circle cx="220" cy="170" r="34" fill="none" stroke="hsl(220 10% 25% / 0.4)" strokeWidth="0.7" />
              <circle cx="220" cy="170" r="6" fill="hsl(220 10% 12%)" />
              {[0,1,2,3,4,5,6,7].map(i => {
                const ang = (i * Math.PI) / 4;
                const x = 220 + Math.cos(ang) * 44;
                const y = 170 + Math.sin(ang) * 44;
                return <rect key={i} x={x-2.5} y={y-2} width="5" height="4" fill="hsl(220 10% 30%)" />;
              })}
            </g>
          </svg>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Drums (top view)</div>
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
          <svg viewBox="0 0 100 200" className="h-full max-h-[200px]">
            <path d="M 38 5 L 62 5 L 60 28 L 40 28 Z"
                  fill={bassActive ? `hsl(${bassActive.color})` : 'hsl(30 35% 25%)'}
                  stroke={selection.instrument === 'bass' ? 'hsl(var(--primary))' : STROKE_DEFAULT}
                  strokeWidth={selection.instrument === 'bass' ? 2.5 : 1} />
            {[0,1,2,3].map(i => (
              <circle key={i} cx={i % 2 === 0 ? 36 : 64} cy={10 + Math.floor(i/2)*8} r={1.8} fill={STROKE_DEFAULT} />
            ))}
            <rect x="44" y="28" width="12" height="80"
                  fill={bassActive ? `hsl(${bassActive.color} / 0.7)` : 'hsl(30 30% 20%)'}
                  stroke={STROKE_DEFAULT} strokeWidth={1} />
            {Array.from({length: 8}).map((_, i) => (
              <line key={i} x1="44" y1={36 + i*9} x2="56" y2={36 + i*9} stroke="hsl(45 30% 70%)" strokeWidth={0.5} />
            ))}
            <path d="M 22 105 Q 8 130 22 165 Q 50 178 78 165 Q 92 130 78 105 Q 65 100 50 102 Q 35 100 22 105 Z"
                  fill={bassActive ? `hsl(${bassActive.color})` : 'hsl(30 40% 30%)'}
                  stroke={selection.instrument === 'bass' ? 'hsl(var(--primary))' : STROKE_DEFAULT}
                  strokeWidth={selection.instrument === 'bass' ? 2.5 : 1} />
            <rect x="36" y="125" width="28" height="6" rx="1" fill="hsl(220 10% 15%)" />
            <rect x="36" y="142" width="28" height="6" rx="1" fill="hsl(220 10% 15%)" />
            <rect x="40" y="158" width="20" height="4" fill="hsl(45 25% 60%)" />
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
            <rect x="4" y="20" width="232" height="140" rx="6"
                  fill={keysActive ? `hsl(${keysActive.color})` : 'hsl(220 12% 18%)'}
                  stroke={selection.instrument === 'keys' ? 'hsl(var(--primary))' : STROKE_DEFAULT}
                  strokeWidth={selection.instrument === 'keys' ? 2.5 : 1} />
            <rect x="14" y="28" width="212" height="22" rx="3" fill="hsl(220 10% 12%)" />
            {[0,1,2,3,4].map(i => (
              <circle key={i} cx={28 + i*22} cy={39} r={3.5} fill="hsl(45 35% 60%)" />
            ))}
            <rect x="150" y="32" width="68" height="14" rx="2" fill="hsl(160 60% 35%)" opacity={0.6} />
            {Array.from({length: 14}).map((_, i) => (
              <rect key={`w-${i}`} x={14 + i*16} y={56} width={15} height={96} fill="hsl(45 30% 95%)" stroke="hsl(220 10% 30%)" strokeWidth={0.5} />
            ))}
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
