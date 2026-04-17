import { useMemo, useState } from 'react';
import { getDiatonicChords, SCALE_DEGREE_COLORS, type KeyMode, type NoteName } from '@/lib/music';
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

/** Harmonic function name per scale degree (0-indexed) for major and minor keys.
 * These are the standard Western tonal functions taught in theory class. */
const FUNCTION_MAJOR = ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Leading'];
const FUNCTION_MINOR = ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Subtonic'];

interface Props {
  keyRoot: NoteName;
  keyQuality: KeyQuality;
}

/** Vertical list of diatonic chords with their harmonic function. Drag onto the chord lane. */
export function DiatonicChordPalette({ keyRoot, keyQuality }: Props) {
  const mode: KeyMode = keyQuality === 'Major' ? 'major' : 'minor';
  const chords = useMemo(() => getDiatonicChords(keyRoot, mode), [keyRoot, mode]);
  const functionLabels = keyQuality === 'Major' ? FUNCTION_MAJOR : FUNCTION_MINOR;
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Diatonic chords (drag → chord lane)</p>
      <div className="flex flex-col gap-1">
        {chords.map((c, i) => {
          const color = SCALE_DEGREE_COLORS[i];
          const exts = extensionsFor(c.type);
          return (
            <div key={i} className="relative">
              <button
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('text/chord-symbol', c.symbol);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={() => setOpenMenu(openMenu === i ? null : i)}
                className="w-full grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-mono cursor-grab active:cursor-grabbing transition-all hover:brightness-110 select-none"
                style={{
                  background: `hsl(${color})`,
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  border: 'none',
                }}
              >
                <span className="font-bold opacity-90">{c.roman}</span>
                <span className="font-bold">{c.symbol}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-90">{functionLabels[i]}</span>
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
                          title={`Drag ${symbol} onto the chord lane`}
                        >{symbol}</button>
                      );
                    })}
                  </div>
                  <button onClick={() => setOpenMenu(null)} className="mt-1 text-[9px] text-muted-foreground hover:text-foreground w-full text-center">close</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
