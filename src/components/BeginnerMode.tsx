import { useState } from 'react';
import { type NoteName } from '@/lib/music';

type BeginnerPage = 'menu' | 'open' | 'barre';

interface BeginnerModeProps {
  onApplyPreset: (preset: {
    root: NoteName;
    scale: string;
    fretBoxStart: number;
    fretBoxSize: number;
  } | null) => void;
  onApplyOpenChord: (frets: (number | -1)[], fingers: string[]) => void;
}

// Open chord definitions
const OPEN_CHORDS: { name: string; frets: (number | -1)[]; fingers: string[]; color: string }[] = [
  { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: ['', '2', '3', '', '', ''], color: '160, 70%, 50%' },
  { name: 'E',  frets: [0, 2, 2, 1, 0, 0], fingers: ['', '2', '3', '1', '', ''], color: '200, 70%, 55%' },
  { name: 'G',  frets: [3, 2, 0, 0, 0, 3], fingers: ['2', '1', '', '', '', '3'], color: '280, 65%, 55%' },
  { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: ['', '', '2', '3', '1', ''], color: '350, 70%, 55%' },
  { name: 'A',  frets: [-1, 0, 2, 2, 2, 0], fingers: ['', '', '1', '2', '3', ''], color: '30, 75%, 55%' },
  { name: 'C',  frets: [-1, 3, 2, 0, 1, 0], fingers: ['', '3', '2', '', '1', ''], color: '50, 75%, 50%' },
  { name: 'D',  frets: [-1, -1, 0, 2, 3, 2], fingers: ['', '', '', '1', '3', '2'], color: '120, 60%, 45%' },
];

// Bar chord shapes
const BAR_CHORDS: { name: string; description: string; frets: number[]; barre: { fret: number; from: number; to: number }; color: string }[] = [
  {
    name: 'Minor (1st string)',
    description: 'Root on low E string',
    frets: [0, 2, 2, 0, 0, 0],
    barre: { fret: 0, from: 0, to: 5 },
    color: '350, 70%, 55%',
  },
  {
    name: 'Major (1st string)',
    description: 'Root on low E string',
    frets: [0, 2, 2, 1, 0, 0],
    barre: { fret: 0, from: 0, to: 5 },
    color: '200, 70%, 55%',
  },
  {
    name: 'Minor (2nd string)',
    description: 'Root on A string',
    frets: [-1, 0, 2, 2, 1, 0],
    barre: { fret: 0, from: 1, to: 5 },
    color: '280, 65%, 55%',
  },
  {
    name: 'Major (2nd string)',
    description: 'Root on A string',
    frets: [-1, 0, 2, 2, 2, -1],
    barre: { fret: 0, from: 1, to: 4 },
    color: '30, 75%, 55%',
  },
];

const SCALE_PRESETS = [
  {
    name: 'Minor pentatonic',
    root: 'A' as NoteName,
    scale: 'Pentatonic Minor',
    fretBoxStart: 5,
    fretBoxSize: 4,
    bg: 'hsl(20, 70%, 55%)',
  },
  {
    name: 'Major pentatonic',
    root: 'C' as NoteName,
    scale: 'Pentatonic Major',
    fretBoxStart: 7,
    fretBoxSize: 4,
    bg: 'hsl(120, 55%, 55%)',
  },
  {
    name: 'Minor',
    root: 'A' as NoteName,
    scale: 'Natural Minor (Aeolian)',
    fretBoxStart: 4,
    fretBoxSize: 5,
    bg: 'hsl(0, 70%, 55%)',
  },
  {
    name: 'Major',
    root: 'C' as NoteName,
    scale: 'Major (Ionian)',
    fretBoxStart: 7,
    fretBoxSize: 4,
    bg: 'hsl(55, 65%, 50%)',
  },
];

function OpenChordDiagram({ chord, isActive, onClick }: {
  chord: typeof OPEN_CHORDS[0];
  isActive: boolean;
  onClick: () => void;
}) {
  const cellSize = 28;
  const numFrets = 4;
  const leftPad = 16;
  const topPad = 22;
  const w = leftPad + 5 * cellSize + 10;
  const h = topPad + numFrets * cellSize + 30;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center transition-all duration-300 rounded-2xl"
      style={{
        border: isActive ? `3px solid hsl(${chord.color})` : '2px solid hsla(var(--border), 0.3)',
        backgroundColor: isActive ? `hsla(${chord.color}, 0.12)` : 'hsla(var(--secondary), 0.5)',
        padding: 8,
        boxShadow: isActive ? `0 0 20px hsla(${chord.color}, 0.3)` : 'none',
      }}
    >
      <div className="text-base font-bold mb-1" style={{ color: `hsl(${chord.color})` }}>
        {chord.name}
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <line x1={leftPad} y1={topPad} x2={leftPad + 5 * cellSize} y2={topPad} stroke="hsl(var(--foreground))" strokeWidth={4} />
        {Array.from({ length: numFrets }, (_, i) => (
          <line key={i} x1={leftPad} y1={topPad + (i + 1) * cellSize}
            x2={leftPad + 5 * cellSize} y2={topPad + (i + 1) * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} strokeOpacity={0.5} />
        ))}
        {[0,1,2,3,4,5].map(s => (
          <line key={s} x1={leftPad + s * cellSize} y1={topPad}
            x2={leftPad + s * cellSize} y2={topPad + numFrets * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={s === 0 ? 1.5 : 0.8} strokeOpacity={0.6} />
        ))}
        {chord.frets.map((fret, si) => {
          const x = leftPad + si * cellSize;
          if (fret === -1) {
            return <text key={si} x={x} y={topPad - 6} fontSize={14} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="sans-serif" fontWeight="bold">×</text>;
          }
          if (fret === 0) {
            return (
              <g key={si}>
                <circle cx={x} cy={topPad - 8} r={6} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.5} />
              </g>
            );
          }
          const y = topPad + (fret - 0.5) * cellSize;
          return (
            <g key={si}>
              <circle cx={x} cy={y} r={11} fill={`hsl(${chord.color})`} />
              {chord.fingers[si] && (
                <text x={x} y={y + 4.5} fontSize={13} textAnchor="middle" fill="white" fontFamily="sans-serif" fontWeight="bold">
                  {chord.fingers[si]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </button>
  );
}

function BarreChordDiagram({ chord }: { chord: typeof BAR_CHORDS[0] }) {
  const cellSize = 28;
  const numFrets = 4;
  const leftPad = 12;
  const topPad = 18;
  const w = leftPad + 5 * cellSize + 12;
  const h = topPad + numFrets * cellSize + 12;
  const markerR = 10;

  return (
    <div
      className="flex flex-col items-center rounded-2xl p-2"
      style={{
        backgroundColor: `hsla(${chord.color}, 0.08)`,
      }}
    >
      <div className="text-xs font-bold mb-0.5" style={{ color: `hsl(${chord.color})` }}>{chord.name}</div>
      <div className="text-[9px] font-mono text-muted-foreground mb-1">{chord.description}</div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {Array.from({ length: numFrets + 1 }, (_, i) => (
          <line key={i} x1={leftPad} y1={topPad + i * cellSize}
            x2={leftPad + 5 * cellSize} y2={topPad + i * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={i === 0 ? 3 : 0.8} strokeOpacity={i === 0 ? 1 : 0.5} />
        ))}
        {[0,1,2,3,4,5].map(s => (
          <line key={s} x1={leftPad + s * cellSize} y1={topPad}
            x2={leftPad + s * cellSize} y2={topPad + numFrets * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} strokeOpacity={0.6} />
        ))}
        {/* Barre bar - only endpoint markers, no middle markers */}
        {(() => {
          const { from, to } = chord.barre;
          const x1 = leftPad + from * cellSize;
          const x2 = leftPad + to * cellSize;
          const y = topPad + 0.5 * cellSize;
          const barThickness = markerR * 1.8;
          return (
            <>
              <line x1={x1} y1={y} x2={x2} y2={y}
                stroke="hsl(var(--muted-foreground))" strokeWidth={barThickness} strokeLinecap="round" opacity={0.5} />
              <circle cx={x1} cy={y} r={markerR} fill={`hsl(${chord.color})`} opacity={0.9} />
              <circle cx={x2} cy={y} r={markerR} fill={`hsl(${chord.color})`} opacity={0.9} />
            </>
          );
        })()}
        {/* Fretted notes above barre - skip strings inside barre range */}
        {chord.frets.map((fret, si) => {
          if (fret === -1) {
            const x = leftPad + si * cellSize;
            return <text key={si} x={x} y={topPad - 4} fontSize={14} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="sans-serif" fontWeight="bold">×</text>;
          }
          if (fret <= 0) return null;
          const x = leftPad + si * cellSize;
          const y = topPad + (fret + 0.5) * cellSize;
          return <circle key={si} cx={x} cy={y} r={markerR} fill={`hsl(${chord.color})`} />;
        })}
      </svg>
    </div>
  );
}

// Hand-drawn wobble for circle paths
function wobblyCirclePath(cx: number, cy: number, r: number, seed: number): string {
  const points = 24;
  const parts: string[] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 3 + seed) * 0.03 + Math.cos(angle * 5 + seed * 2) * 0.02;
    const x = cx + r * wobble * Math.cos(angle);
    const y = cy + r * wobble * Math.sin(angle);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(' ') + ' Z';
}

export default function BeginnerMode({ onApplyPreset, onApplyOpenChord }: BeginnerModeProps) {
  const [page, setPage] = useState<BeginnerPage>('menu');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [activeOpenChord, setActiveOpenChord] = useState<string | null>(null);

  const handlePresetClick = (preset: typeof SCALE_PRESETS[0]) => {
    if (activePreset === preset.name) {
      // Deselect
      setActivePreset(null);
      onApplyPreset(null);
      return;
    }
    setActivePreset(preset.name);
    onApplyPreset({
      root: preset.root,
      scale: preset.scale,
      fretBoxStart: preset.fretBoxStart,
      fretBoxSize: preset.fretBoxSize,
    });
  };

  const handleOpenChordClick = (chord: typeof OPEN_CHORDS[0]) => {
    setActiveOpenChord(activeOpenChord === chord.name ? null : chord.name);
    onApplyOpenChord(chord.frets, chord.fingers);
  };

  if (page === 'open') {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => { setPage('menu'); setActiveOpenChord(null); }}
          className="text-[11px] font-mono text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 transition-colors"
        >
          ← Back to menu
        </button>
        <div className="text-sm font-bold text-foreground mb-1">🎶 Open Chords</div>
        <div className="text-[10px] font-mono text-muted-foreground mb-3">
          Click a chord to see it on the fretboard. Numbers show which fingers to use.
        </div>
        <div className="grid grid-cols-4 gap-2">
          {OPEN_CHORDS.map(chord => (
            <OpenChordDiagram
              key={chord.name}
              chord={chord}
              isActive={activeOpenChord === chord.name}
              onClick={() => handleOpenChordClick(chord)}
            />
          ))}
        </div>
        <div className="mt-3 p-2 rounded-xl bg-muted/30 border border-border/40">
          <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Finger guide:</strong> 1 = Index, 2 = Middle, 3 = Ring, 4 = Pinky.
            <span className="text-destructive font-bold"> ×</span> = Don't play this string.
            <span className="font-bold"> ○</span> = Play open (no fingers).
          </div>
        </div>
      </div>
    );
  }

  if (page === 'barre') {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setPage('menu')}
          className="text-[11px] font-mono text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 transition-colors"
        >
          ← Back to menu
        </button>
        <div className="text-sm font-bold text-foreground mb-1">🤘 Barre Chords</div>
        <div className="text-[10px] font-mono text-muted-foreground mb-2">
          These shapes can be moved up and down the neck. The grey bar shows where to lay your index finger flat.
        </div>
        <div className="flex gap-2">
          {BAR_CHORDS.map(chord => (
            <div key={chord.name} className="flex-1 min-w-0">
              <BarreChordDiagram chord={chord} />
            </div>
          ))}
        </div>
        <div className="mt-2 p-2 rounded-xl bg-muted/30 border border-border/40">
          <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
            <strong className="text-foreground">How to use:</strong> Move the entire shape up or down the fretboard. The root note determines the chord name.
            E.g., the E-shape major at fret 3 = <strong>G major</strong>, at fret 5 = <strong>A major</strong>.
          </div>
        </div>
      </div>
    );
  }

  // Bubble layout like the reference image
  const bubbles = [
    ...SCALE_PRESETS.map(p => ({ type: 'scale' as const, name: p.name, bg: p.bg, preset: p })),
    { type: 'nav' as const, name: 'Open chords', bg: 'hsl(290, 55%, 60%)', target: 'open' as BeginnerPage },
    { type: 'nav' as const, name: 'Bar chords', bg: 'hsl(270, 60%, 40%)', target: 'barre' as BeginnerPage },
  ];

  // Positions around a central circle (relative % coords within a container)
  const positions = [
    { x: 12, y: 8, size: 80 },   // Minor pentatonic - top left
    { x: 42, y: 2, size: 75 },   // Major pentatonic - top center
    { x: 78, y: 10, size: 72 },  // Minor - top right (was Major)
    { x: 72, y: 52, size: 78 },  // Major - mid right (was Minor)
    { x: 8, y: 55, size: 76 },   // Open chords - bottom left
    { x: 40, y: 65, size: 68 },  // Bar chords - bottom center
  ];

  return (
    <div className="animate-fade-in">
      <div className="relative" style={{ height: 280, width: '100%' }}>
        {/* Central circle */}
        <div className="absolute" style={{
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 120, height: 120,
        }}>
          <svg width="100%" height="100%" viewBox="0 0 120 120">
            <defs>
              <filter id="glow-center">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path
              d={wobblyCirclePath(60, 60, 56, 42)}
              fill="hsl(200, 40%, 30%)"
              filter="url(#glow-center)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <span className="text-white font-bold text-sm leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              Guitar<br/>basics!
            </span>
          </div>
        </div>

        {/* Orbiting bubbles */}
        {bubbles.map((bubble, i) => {
          const pos = positions[i];
          const isActive = bubble.type === 'scale' && activePreset === bubble.name;
          const filterId = `glow-${i}`;
          return (
            <button
              key={bubble.name}
              onClick={() => {
                if (bubble.type === 'scale') {
                  handlePresetClick(bubble.preset!);
                } else {
                  setPage(bubble.target!);
                }
              }}
              className="absolute transition-all duration-300 hover:scale-110"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: pos.size,
                height: pos.size,
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${pos.size} ${pos.size}`}>
                <defs>
                  <filter id={filterId}>
                    <feGaussianBlur stdDeviation={isActive ? '6' : '3'} result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <path
                  d={wobblyCirclePath(pos.size / 2, pos.size / 2, pos.size / 2 - 4, i * 7 + 3)}
                  fill={bubble.bg}
                  filter={`url(#${filterId})`}
                  opacity={isActive ? 1 : 0.85}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center px-2">
                <span className="text-white font-bold text-xs leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  {bubble.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
