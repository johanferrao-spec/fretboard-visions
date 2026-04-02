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
    name: 'Minor\npentatonic',
    root: 'A' as NoteName,
    scale: 'Pentatonic Minor',
    fretBoxStart: 5,
    fretBoxSize: 4,
    bg: 'hsl(20, 70%, 55%)',
    emoji: '🔥',
  },
  {
    name: 'Major\npentatonic',
    root: 'C' as NoteName,
    scale: 'Pentatonic Major',
    fretBoxStart: 7,
    fretBoxSize: 4,
    bg: 'hsl(120, 55%, 55%)',
    emoji: '🌿',
  },
  {
    name: 'Minor\nscale',
    root: 'A' as NoteName,
    scale: 'Natural Minor (Aeolian)',
    fretBoxStart: 4,
    fretBoxSize: 5,
    bg: 'hsl(0, 70%, 55%)',
    emoji: '🌙',
  },
  {
    name: 'Major\nscale',
    root: 'C' as NoteName,
    scale: 'Major (Ionian)',
    fretBoxStart: 7,
    fretBoxSize: 4,
    bg: 'hsl(55, 65%, 50%)',
    emoji: '☀️',
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
      <div className="text-base font-bold mb-1" style={{ color: `hsl(${chord.color})`, fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive' }}>
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
  const cellSize = 32;
  const numFrets = 4;
  const leftPad = 12;
  const topPad = 18;
  const w = leftPad + 5 * cellSize + 12;
  const h = topPad + numFrets * cellSize + 12;
  const markerR = 12;

  return (
    <div
      className="flex flex-col items-center rounded-2xl p-2"
      style={{
        backgroundColor: `hsla(${chord.color}, 0.08)`,
      }}
    >
      <div className="text-xs font-bold mb-0.5" style={{ color: `hsl(${chord.color})`, fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive' }}>{chord.name}</div>
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
        {/* Barre bar - only endpoint markers */}
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
        {/* Fretted notes above barre */}
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

export default function BeginnerMode({ onApplyPreset, onApplyOpenChord }: BeginnerModeProps) {
  const [page, setPage] = useState<BeginnerPage>('menu');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [activeOpenChord, setActiveOpenChord] = useState<string | null>(null);

  const handlePresetClick = (preset: typeof SCALE_PRESETS[0]) => {
    if (activePreset === preset.name) {
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
        <div className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive' }}>🎶 Open Chords</div>
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
        <div className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive' }}>🤘 Barre Chords</div>
        <div className="text-[10px] font-mono text-muted-foreground mb-2">
          These shapes can be moved up and down the neck. The grey bar shows where to lay your index finger flat.
        </div>
        <div className="flex gap-1.5">
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

  // Menu page — symmetrical grid of big colorful bubbles
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-4">
        <div className="text-lg font-bold text-foreground" style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive' }}>
          🎸 Guitar Basics!
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">Pick something to learn</div>
      </div>

      {/* Symmetrical 3x2 grid of big bubbles */}
      <div className="grid grid-cols-3 gap-3 px-2">
        {SCALE_PRESETS.map((preset, i) => {
          const isActive = activePreset === preset.name;
          return (
            <button
              key={preset.name}
              onClick={() => handlePresetClick(preset)}
              className="transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                aspectRatio: '1',
                borderRadius: '50%',
                backgroundColor: isActive ? preset.bg : preset.bg,
                opacity: isActive ? 1 : 0.8,
                boxShadow: isActive
                  ? `0 0 24px ${preset.bg}, 0 0 48px ${preset.bg}40`
                  : `0 0 12px ${preset.bg}30`,
                border: isActive ? '3px solid rgba(255,255,255,0.4)' : '2px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                transform: isActive ? 'scale(1.08)' : undefined,
              }}
            >
              <span className="text-xl mb-1">{preset.emoji}</span>
              <span
                className="text-white font-bold text-center leading-tight"
                style={{
                  fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
                  fontSize: 13,
                  textShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  whiteSpace: 'pre-line',
                }}
              >
                {preset.name}
              </span>
            </button>
          );
        })}

        {/* Open chords bubble */}
        <button
          onClick={() => setPage('open')}
          className="transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            aspectRatio: '1',
            borderRadius: '50%',
            backgroundColor: 'hsl(290, 55%, 60%)',
            opacity: 0.85,
            boxShadow: '0 0 12px hsla(290, 55%, 60%, 0.3)',
            border: '2px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <span className="text-xl mb-1">🎶</span>
          <span
            className="text-white font-bold text-center leading-tight"
            style={{
              fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
              fontSize: 13,
              textShadow: '0 2px 6px rgba(0,0,0,0.4)',
              whiteSpace: 'pre-line',
            }}
          >
            {'Open\nchords'}
          </span>
        </button>

        {/* Barre chords bubble */}
        <button
          onClick={() => setPage('barre')}
          className="transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            aspectRatio: '1',
            borderRadius: '50%',
            backgroundColor: 'hsl(270, 60%, 40%)',
            opacity: 0.85,
            boxShadow: '0 0 12px hsla(270, 60%, 40%, 0.3)',
            border: '2px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <span className="text-xl mb-1">🤘</span>
          <span
            className="text-white font-bold text-center leading-tight"
            style={{
              fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
              fontSize: 13,
              textShadow: '0 2px 6px rgba(0,0,0,0.4)',
              whiteSpace: 'pre-line',
            }}
          >
            {'Barre\nchords'}
          </span>
        </button>
      </div>
    </div>
  );
}
