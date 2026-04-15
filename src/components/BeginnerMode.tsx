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

const BEGINNER_FONT = 'Fredoka, "Comic Sans MS", "Chalkboard SE", cursive';

// Helper to load/save editable barre chord fingers from localStorage
const BARRE_FINGERS_KEY = 'mf-barre-fingers';

// Open chord definitions
const OPEN_CHORDS: { name: string; frets: (number | -1)[]; fingers: string[]; colorVar: string }[] = [
  { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: ['', '2', '3', '', '', ''], colorVar: '--beginner-green' },
  { name: 'E',  frets: [0, 2, 2, 1, 0, 0], fingers: ['', '2', '3', '1', '', ''], colorVar: '--beginner-blue' },
  { name: 'G',  frets: [3, 2, 0, 0, 0, 3], fingers: ['2', '1', '', '', '', '3'], colorVar: '--beginner-purple' },
  { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: ['', '', '2', '3', '1', ''], colorVar: '--beginner-red' },
  { name: 'A',  frets: [-1, 0, 2, 2, 2, 0], fingers: ['', '', '1', '2', '3', ''], colorVar: '--beginner-orange' },
  { name: 'C',  frets: [-1, 3, 2, 0, 1, 0], fingers: ['', '3', '2', '', '1', ''], colorVar: '--beginner-pink' },
  { name: 'D',  frets: [-1, -1, 0, 2, 3, 2], fingers: ['', '', '', '1', '3', '2'], colorVar: '--beginner-yellow' },
];

// Bar chord shapes
const BAR_CHORDS: { name: string; description: string; frets: number[]; barre: { fret: number; from: number; to: number }; fingers: string[]; colorVar: string }[] = [
  {
    name: 'Minor (1st string)',
    description: 'Root on low E string',
    frets: [0, 2, 2, 0, 0, 0],
    barre: { fret: 0, from: 0, to: 5 },
    fingers: ['1', '3', '4', '1', '1', '1'],
    colorVar: '--beginner-purple',
  },
  {
    name: 'Major (1st string)',
    description: 'Root on low E string',
    frets: [0, 2, 2, 1, 0, 0],
    barre: { fret: 0, from: 0, to: 5 },
    fingers: ['1', '3', '4', '2', '1', '1'],
    colorVar: '--beginner-blue',
  },
  {
    name: 'Minor (2nd string)',
    description: 'Root on A string',
    frets: [-1, 0, 2, 2, 1, 0],
    barre: { fret: 0, from: 1, to: 5 },
    fingers: ['', '1', '3', '4', '2', '1'],
    colorVar: '--beginner-red',
  },
  {
    name: 'Major (2nd string)',
    description: 'Root on A string',
    frets: [-1, 0, 2, 2, 2, -1],
    barre: { fret: 0, from: 2, to: 4 },
    fingers: ['', '1', '2', '3', '4', ''],
    colorVar: '--beginner-yellow',
  },
];

const SCALE_PRESETS = [
  {
    name: 'Minor\npentatonic',
    root: 'A' as NoteName,
    scale: 'Pentatonic Minor',
    fretBoxStart: 5,
    fretBoxSize: 4,
    bubbleVar: '--beginner-orange',
  },
  {
    name: 'Major\npentatonic',
    root: 'C' as NoteName,
    scale: 'Pentatonic Major',
    fretBoxStart: 7,
    fretBoxSize: 4,
    bubbleVar: '--beginner-green',
  },
  {
    name: 'Minor\nscale',
    root: 'A' as NoteName,
    scale: 'Natural Minor (Aeolian)',
    fretBoxStart: 4,
    fretBoxSize: 5,
    bubbleVar: '--beginner-red',
  },
  {
    name: 'Major\nscale',
    root: 'C' as NoteName,
    scale: 'Major (Ionian)',
    fretBoxStart: 7,
    fretBoxSize: 4,
    bubbleVar: '--beginner-yellow',
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
        border: isActive ? `3px solid hsl(var(${chord.colorVar}))` : '2px solid hsl(var(--border) / 0.3)',
        backgroundColor: isActive ? `hsl(var(${chord.colorVar}) / 0.12)` : 'hsl(var(--secondary) / 0.5)',
        padding: 8,
        boxShadow: isActive ? `0 0 20px hsl(var(${chord.colorVar}) / 0.3)` : 'none',
      }}
    >
      <div className="text-base font-bold mb-1" style={{ color: `hsl(var(${chord.colorVar}))`, fontFamily: BEGINNER_FONT }}>
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
              <circle cx={x} cy={y} r={11} fill={`hsl(var(${chord.colorVar}))`} />
              {chord.fingers[si] && (
                <text x={x} y={y + 4.5} fontSize={13} textAnchor="middle" fill="hsl(var(--beginner-bubble-foreground))" fontFamily="sans-serif" fontWeight="bold">
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
        backgroundColor: `hsl(var(${chord.colorVar}) / 0.08)`,
      }}
    >
      <div className="text-xs font-bold mb-0.5" style={{ color: `hsl(var(${chord.colorVar}))`, fontFamily: BEGINNER_FONT }}>{chord.name}</div>
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
                <circle cx={x1} cy={y} r={markerR} fill={`hsl(var(${chord.colorVar}))`} opacity={0.9} />
                <circle cx={x2} cy={y} r={markerR} fill={`hsl(var(${chord.colorVar}))`} opacity={0.9} />
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
          return <circle key={si} cx={x} cy={y} r={markerR} fill={`hsl(var(${chord.colorVar}))`} />;
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
    setActivePreset(null);
    onApplyPreset(null);
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
        <div className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: BEGINNER_FONT }}>🎶 Open Chords</div>
        <div className="text-[10px] font-mono text-muted-foreground mb-3">
          Click a chord to see it on the fretboard. Numbers show which fingers to use.
        </div>
        <div className="grid grid-cols-7 gap-2">
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
        <div className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: BEGINNER_FONT }}>🤘 Barre Chords</div>
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

  const bubbleStyle = (colorVar: string, active = false) => ({
    minHeight: 72,
    borderRadius: 999,
    backgroundColor: `hsl(var(${colorVar}))`,
    color: 'hsl(var(--beginner-bubble-foreground))',
    boxShadow: active
      ? `0 0 0 4px hsl(var(--card)), 0 0 22px hsl(var(${colorVar}) / 0.45)`
      : `0 0 12px hsl(var(${colorVar}) / 0.25)`,
    transform: active ? 'translateY(-2px) scale(1.02)' : undefined,
  });

  // Menu page — symmetrical bubble layout like the reference
  return (
    <div className="animate-fade-in flex flex-col h-full">
      <div className="text-center mb-2">
        <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Beginner mode</div>
      </div>

      <div className="mx-auto grid grid-cols-3 items-stretch gap-3 px-4 flex-1">
        {SCALE_PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset)}
            className="px-4 py-4 text-center transition-transform duration-200 hover:scale-[1.02] flex items-center justify-center"
            style={bubbleStyle(preset.bubbleVar, activePreset === preset.name)}
          >
            <span className="block text-[1.4rem] font-semibold leading-tight" style={{ fontFamily: BEGINNER_FONT, whiteSpace: 'pre-line' }}>{preset.name}</span>
          </button>
        ))}
        <button
          onClick={() => { setActivePreset(null); onApplyPreset(null); setPage('open'); }}
          className="px-4 py-4 text-center transition-transform duration-200 hover:scale-[1.02] flex items-center justify-center"
          style={bubbleStyle('--beginner-pink')}
        >
          <span className="block text-[1.4rem] font-semibold leading-tight" style={{ fontFamily: BEGINNER_FONT }}>Open chords</span>
        </button>
        <button
          onClick={() => { setActivePreset(null); onApplyPreset(null); setPage('barre'); }}
          className="px-4 py-4 text-center transition-transform duration-200 hover:scale-[1.02] flex items-center justify-center"
          style={bubbleStyle('--beginner-purple')}
        >
          <span className="block text-[1.4rem] font-semibold leading-tight" style={{ fontFamily: BEGINNER_FONT }}>Bar chords</span>
        </button>
      </div>
    </div>
  );
}
