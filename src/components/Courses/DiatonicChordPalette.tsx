import { useMemo, useState } from 'react';
import { getDiatonicChords, SCALE_DEGREE_COLORS, NOTE_NAMES, type KeyMode, type NoteName } from '@/lib/music';
import type { KeyQuality } from '@/lib/courseTypes';

const EXTENSIONS_MAJOR = ['', 'maj7', 'maj9', '6', 'add9', 'sus2', 'sus4'];
const EXTENSIONS_MINOR = ['m', 'm7', 'm9', 'm6', 'madd9', 'msus4'];
const EXTENSIONS_DOM = ['7', '9', '11', '13', 'sus4', '7sus4'];
const EXTENSIONS_DIM = ['°', 'm7♭5', '°7'];

function extensionsFor(type: string): string[] {
  if (type === 'Major') return EXTENSIONS_MAJOR;
  if (type === 'Minor') return EXTENSIONS_MINOR;
  if (type === 'Dominant 7') return EXTENSIONS_DOM;
  if (type === 'Diminished') return EXTENSIONS_DIM;
  return [''];
}

interface Props {
  keyRoot: NoteName;
  keyQuality: KeyQuality;
}

/**
 * Two-column palette: [Chord row | Bass cell] per scale degree.
 * Chord rows drag a `text/chord-symbol` payload onto the chord lane (creates a chord region).
 * Bass cells drag a `text/bass-note` payload onto an existing chord region (sets slash bass: e.g. Am/G).
 * Both columns share the SCALE_DEGREE_COLORS palette so the harmonic relationship is visually obvious.
 */
export function DiatonicChordPalette({ keyRoot, keyQuality }: Props) {
  const mode: KeyMode = keyQuality === 'Major' ? 'major' : 'minor';
  const chords = useMemo(() => getDiatonicChords(keyRoot, mode), [keyRoot, mode]);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Diatonic chords / bass
      </p>
      <div className="grid grid-cols-[1fr_auto] gap-1">
        {chords.map((c, i) => {
          const color = SCALE_DEGREE_COLORS[i];
          const exts = extensionsFor(c.type);
          // Bass note for this scale degree — same letter as the chord root
          const bassNote = c.root as NoteName;
          return (
            <div key={`row-${i}`} className="contents">
              {/* Chord cell — narrower now, drags chord-symbol */}
              <div className="relative">
                <button
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('text/chord-symbol', c.symbol);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDoubleClick={() => setOpenMenu(openMenu === i ? null : i)}
                  className="w-full grid grid-cols-[1.4rem_1fr] items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-[11px] font-mono cursor-grab active:cursor-grabbing transition-all hover:brightness-110 select-none"
                  style={{
                    background: `hsl(${color})`,
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    border: 'none',
                  }}
                  title="Drag onto chord lane"
                >
                  <span className="font-bold opacity-90 text-[10px]">{c.roman}</span>
                  <span className="font-bold truncate">{c.symbol}</span>
                </button>
                {openMenu === i && (
                  <div className="absolute left-full top-0 ml-2 z-40 bg-popover border border-border rounded-lg shadow-lg p-2 min-w-[140px]">
                    <p className="text-[9px] font-mono uppercase text-muted-foreground mb-1">Extensions</p>
                    <div className="grid grid-cols-2 gap-1">
                      {exts.map(ext => {
                        const symbol = `${c.root}${ext}`;
                        return (
                          <button
                            key={ext}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('text/chord-symbol', symbol);
                              e.dataTransfer.effectAllowed = 'copy';
                              setOpenMenu(null);
                            }}
                            className="px-1.5 py-1 rounded text-[10px] font-mono bg-muted/50 hover:bg-muted text-foreground cursor-grab active:cursor-grabbing"
                            title={`Drag ${symbol} onto chord lane`}
                          >{symbol}</button>
                        );
                      })}
                    </div>
                    <button onClick={() => setOpenMenu(null)} className="mt-1 text-[9px] text-muted-foreground hover:text-foreground w-full text-center">close</button>
                  </div>
                )}
              </div>
              {/* Bass cell — square, same colour, drags bass-note (drop on chord region for slash) */}
              <button
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('text/bass-note', bassNote);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="rounded-md font-mono cursor-grab active:cursor-grabbing transition-all hover:brightness-110 select-none flex items-center justify-center w-9 text-[11px] font-bold"
                style={{
                  background: `hsl(${color})`,
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  border: 'none',
                }}
                title={`Drag onto a chord region for slash bass /${bassNote}`}
              >/{bassNote}</button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/80 pt-1">
        <span>Chord</span>
        <span>Bass →</span>
      </div>
    </div>
  );
}
