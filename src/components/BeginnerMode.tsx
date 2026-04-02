import { useState } from 'react';
import { noteAtFret, getIntervalName, DEGREE_COLORS, NOTE_NAMES, type NoteName } from '@/lib/music';

type BeginnerPage = 'menu' | 'open' | 'barre';

interface BeginnerModeProps {
  onApplyPreset: (preset: {
    root: NoteName;
    scale: string;
    fretBoxStart: number;
    fretBoxSize: number;
  }) => void;
  onApplyOpenChord: (frets: (number | -1)[], fingers: string[]) => void;
}

// Open chord definitions: [frets, fingers, name]
const OPEN_CHORDS: { name: string; frets: (number | -1)[]; fingers: string[]; color: string }[] = [
  { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: ['', '2', '3', '', '', ''], color: '160, 70%, 50%' },
  { name: 'E',  frets: [0, 2, 2, 1, 0, 0], fingers: ['', '2', '3', '1', '', ''], color: '200, 70%, 55%' },
  { name: 'G',  frets: [3, 2, 0, 0, 0, 3], fingers: ['2', '1', '', '', '', '3'], color: '280, 65%, 55%' },
  { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: ['', '', '2', '3', '1', ''], color: '350, 70%, 55%' },
  { name: 'A',  frets: [-1, 0, 2, 2, 2, 0], fingers: ['', '', '1', '2', '3', ''], color: '30, 75%, 55%' },
  { name: 'C',  frets: [-1, 3, 2, 0, 1, 0], fingers: ['', '3', '2', '', '1', ''], color: '50, 75%, 50%' },
  { name: 'D',  frets: [-1, -1, 0, 2, 3, 2], fingers: ['', '', '', '1', '3', '2'], color: '120, 60%, 45%' },
];

// Bar chord shapes (generic, shown as diagrams only)
const BAR_CHORDS: { name: string; description: string; frets: number[]; barre: { fret: number; from: number; to: number }; color: string }[] = [
  {
    name: 'Major (E shape)',
    description: 'Root on low E string',
    frets: [0, 2, 2, 1, 0, 0], // relative to barre
    barre: { fret: 0, from: 0, to: 5 },
    color: '200, 70%, 55%',
  },
  {
    name: 'Minor (E shape)',
    description: 'Root on low E string',
    frets: [0, 2, 2, 0, 0, 0],
    barre: { fret: 0, from: 0, to: 5 },
    color: '350, 70%, 55%',
  },
  {
    name: 'Major (A shape)',
    description: 'Root on A string',
    frets: [-1, 0, 2, 2, 2, -1],
    barre: { fret: 0, from: 1, to: 5 },
    color: '30, 75%, 55%',
  },
  {
    name: 'Minor (A shape)',
    description: 'Root on A string',
    frets: [-1, 0, 2, 2, 1, 0],
    barre: { fret: 0, from: 1, to: 5 },
    color: '280, 65%, 55%',
  },
];

const SCALE_PRESETS = [
  {
    name: 'Minor Pentatonic',
    emoji: '🎸',
    desc: 'The most popular scale for rock & blues',
    root: 'A' as NoteName,
    scale: 'Pentatonic Minor',
    fretBoxStart: 5,
    fretBoxSize: 4,
    gradient: 'from-[hsl(350,70%,45%)] to-[hsl(20,80%,50%)]',
    bg: 'hsl(350, 70%, 45%)',
  },
  {
    name: 'Major Pentatonic',
    emoji: '☀️',
    desc: 'Bright & happy — great for country & pop',
    root: 'C' as NoteName,
    scale: 'Pentatonic Major',
    fretBoxStart: 7,
    fretBoxSize: 4,
    gradient: 'from-[hsl(45,80%,50%)] to-[hsl(30,85%,55%)]',
    bg: 'hsl(45, 80%, 50%)',
  },
  {
    name: 'Minor Scale',
    emoji: '🌙',
    desc: 'The natural minor — dark & emotional',
    root: 'A' as NoteName,
    scale: 'Natural Minor (Aeolian)',
    fretBoxStart: 4,
    fretBoxSize: 5,
    gradient: 'from-[hsl(240,60%,50%)] to-[hsl(270,65%,55%)]',
    bg: 'hsl(240, 60%, 50%)',
  },
  {
    name: 'Major Scale',
    emoji: '🌟',
    desc: 'The foundation of Western music',
    root: 'C' as NoteName,
    scale: 'Major (Ionian)',
    fretBoxStart: 7,
    fretBoxSize: 4,
    gradient: 'from-[hsl(140,60%,40%)] to-[hsl(160,65%,50%)]',
    bg: 'hsl(140, 60%, 40%)',
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
        {/* Nut */}
        <line x1={leftPad} y1={topPad} x2={leftPad + 5 * cellSize} y2={topPad} stroke="hsl(var(--foreground))" strokeWidth={4} />
        {/* Fret lines */}
        {Array.from({ length: numFrets }, (_, i) => (
          <line key={i} x1={leftPad} y1={topPad + (i + 1) * cellSize}
            x2={leftPad + 5 * cellSize} y2={topPad + (i + 1) * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} strokeOpacity={0.5} />
        ))}
        {/* Strings */}
        {[0,1,2,3,4,5].map(s => (
          <line key={s} x1={leftPad + s * cellSize} y1={topPad}
            x2={leftPad + s * cellSize} y2={topPad + numFrets * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={s === 0 ? 1.5 : 0.8} strokeOpacity={0.6} />
        ))}
        {/* Notes + fingers */}
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
  const cellSize = 32;
  const numFrets = 4;
  const leftPad = 12;
  const topPad = 18;
  const w = leftPad + 5 * cellSize + 12;
  const h = topPad + numFrets * cellSize + 12;

  return (
    <div
      className="flex flex-col items-center rounded-2xl p-3"
      style={{
        border: `2px solid hsl(${chord.color})`,
        backgroundColor: `hsla(${chord.color}, 0.08)`,
      }}
    >
      <div className="text-sm font-bold mb-0.5" style={{ color: `hsl(${chord.color})` }}>{chord.name}</div>
      <div className="text-[10px] font-mono text-muted-foreground mb-2">{chord.description}</div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* Fret lines */}
        {Array.from({ length: numFrets + 1 }, (_, i) => (
          <line key={i} x1={leftPad} y1={topPad + i * cellSize}
            x2={leftPad + 5 * cellSize} y2={topPad + i * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={i === 0 ? 3 : 0.8} strokeOpacity={i === 0 ? 1 : 0.5} />
        ))}
        {/* Strings */}
        {[0,1,2,3,4,5].map(s => (
          <line key={s} x1={leftPad + s * cellSize} y1={topPad}
            x2={leftPad + s * cellSize} y2={topPad + numFrets * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} strokeOpacity={0.6} />
        ))}
        {/* Barre */}
        {(() => {
          const { from, to } = chord.barre;
          const x1 = leftPad + from * cellSize;
          const x2 = leftPad + to * cellSize;
          const y = topPad + 0.5 * cellSize;
          return (
            <>
              <line x1={x1} y1={y} x2={x2} y2={y}
                stroke="hsl(var(--muted-foreground))" strokeWidth={14} strokeLinecap="round" opacity={0.35} />
              <circle cx={x1} cy={y} r={10} fill={`hsl(${chord.color})`} opacity={0.9} />
              <circle cx={x2} cy={y} r={10} fill={`hsl(${chord.color})`} opacity={0.9} />
            </>
          );
        })()}
        {/* Fretted notes above barre */}
        {chord.frets.map((fret, si) => {
          if (fret === -1) {
            const x = leftPad + si * cellSize;
            return <text key={si} x={x} y={topPad - 4} fontSize={14} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="sans-serif" fontWeight="bold">×</text>;
          }
          if (fret <= 0) return null; // barre handles fret 0
          const x = leftPad + si * cellSize;
          const y = topPad + (fret + 0.5) * cellSize;
          return <circle key={si} cx={x} cy={y} r={10} fill={`hsl(${chord.color})`} />;
        })}
        {/* Muted string markers for strings not in barre range */}
        {chord.frets.map((fret, si) => {
          if (fret !== -1) return null;
          return null; // already handled above
        })}
      </svg>
    </div>
  );
}

export default function BeginnerMode({ onApplyPreset, onApplyOpenChord }: BeginnerModeProps) {
  const [page, setPage] = useState<BeginnerPage>('menu');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [activeOpenChord, setActiveOpenChord] = useState<string | null>(null);

  const handlePresetClick = (preset: typeof SCALE_PRESETS[0]) => {
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
          className="text-[11px] font-mono text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 transition-colors"
        >
          ← Back to menu
        </button>
        <div className="text-sm font-bold text-foreground mb-1">🤘 Barre Chords</div>
        <div className="text-[10px] font-mono text-muted-foreground mb-3">
          These shapes can be moved up and down the neck. The grey bar shows where to lay your index finger flat.
        </div>
        <div className="grid grid-cols-2 gap-3">
          {BAR_CHORDS.map(chord => (
            <BarreChordDiagram key={chord.name} chord={chord} />
          ))}
        </div>
        <div className="mt-3 p-2 rounded-xl bg-muted/30 border border-border/40">
          <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
            <strong className="text-foreground">How to use:</strong> Move the entire shape up or down the fretboard. The root note determines the chord name.
            E.g., the E-shape major at fret 3 = <strong>G major</strong>, at fret 5 = <strong>A major</strong>.
          </div>
        </div>
      </div>
    );
  }

  // Menu page
  return (
    <div className="animate-fade-in">
      <div className="text-sm font-bold text-foreground mb-1">🎓 Beginner Mode</div>
      <div className="text-[10px] font-mono text-muted-foreground mb-3">
        Start here! Learn essential scales, chords and shapes.
      </div>

      {/* Scale presets */}
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Scales</div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {SCALE_PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset)}
            className="relative overflow-hidden rounded-2xl p-3 text-left transition-all duration-300 border-2"
            style={{
              borderColor: activePreset === preset.name ? preset.bg : 'hsla(var(--border), 0.3)',
              backgroundColor: activePreset === preset.name ? `${preset.bg.replace(')', ', 0.15)')}` : 'hsla(var(--secondary), 0.5)',
              boxShadow: activePreset === preset.name ? `0 0 20px ${preset.bg.replace(')', ', 0.3)')}` : 'none',
            }}
          >
            <div className="text-2xl mb-1">{preset.emoji}</div>
            <div className="text-xs font-bold text-foreground">{preset.name}</div>
            <div className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-tight">{preset.desc}</div>
            {activePreset === preset.name && (
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full" style={{ backgroundColor: preset.bg }} />
            )}
          </button>
        ))}
      </div>

      {/* Chord sections */}
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Chords</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setPage('open')}
          className="rounded-2xl p-3 text-left transition-all duration-300 border-2 border-border/30 hover:border-primary/50 bg-secondary/50 hover:bg-secondary/70"
        >
          <div className="text-2xl mb-1">🎶</div>
          <div className="text-xs font-bold text-foreground">Open Chords</div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-tight">Em, E, G, Am, A, C, D — with finger guides</div>
        </button>
        <button
          onClick={() => setPage('barre')}
          className="rounded-2xl p-3 text-left transition-all duration-300 border-2 border-border/30 hover:border-primary/50 bg-secondary/50 hover:bg-secondary/70"
        >
          <div className="text-2xl mb-1">🤘</div>
          <div className="text-xs font-bold text-foreground">Barre Chords</div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-tight">Major & minor shapes from E and A strings</div>
        </button>
      </div>
    </div>
  );
}
