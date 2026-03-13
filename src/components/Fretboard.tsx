import { useState } from 'react';
import { noteAtFret, isNoteInScale, getArpeggiosForNote, NoteName, STRING_NAMES } from '@/lib/music';
import type { ScaleSelection, NoteColors } from '@/hooks/useFretboard';

interface FretboardProps {
  maxFrets: number;
  primaryScale: ScaleSelection;
  secondaryScale: ScaleSelection;
  secondaryEnabled: boolean;
  activePrimary: boolean;
  noteColors: NoteColors;
  onNoteClick: (note: NoteName) => void;
}

const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21];
const DOUBLE_INLAY = [12];

function fretWidths(count: number): number[] {
  const widths: number[] = [];
  for (let i = 0; i <= count; i++) {
    if (i === 0) {
      widths.push(0.4);
    } else {
      widths.push(1 / Math.pow(2, (i - 1) / 12));
    }
  }
  const total = widths.reduce((a, b) => a + b, 0);
  return widths.map(w => (w / total) * 100);
}

interface HoverInfo {
  note: NoteName;
  x: number;
  y: number;
}

export default function Fretboard({
  maxFrets, primaryScale, secondaryScale, secondaryEnabled,
  activePrimary, noteColors, onNoteClick,
}: FretboardProps) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, i) => i);
  const widths = fretWidths(maxFrets);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const cumLeft: number[] = [];
  let acc = 0;
  for (const w of widths) {
    cumLeft.push(acc);
    acc += w;
  }

  function getNoteStyle(note: NoteName) {
    const inPrimary = isNoteInScale(note, primaryScale.root, primaryScale.scale);
    const inSecondary = secondaryEnabled && isNoteInScale(note, secondaryScale.root, secondaryScale.scale);
    if (!inPrimary && !inSecondary) return null;

    const customColor = noteColors[note];
    const baseColor = customColor || 'hsl(var(--primary))';

    let opacity = 1;
    if (inPrimary && inSecondary) {
      opacity = 1;
    } else if (inPrimary && !activePrimary) {
      opacity = 0.3;
    } else if (inSecondary && activePrimary) {
      opacity = 0.3;
    }
    return { backgroundColor: baseColor, opacity };
  }

  const arpeggios = hover ? getArpeggiosForNote(hover.note) : [];

  return (
    <div className="w-full overflow-x-auto pb-4 relative">
      <div className="min-w-[600px]">
        {/* Fret numbers */}
        <div className="flex items-center mb-1">
          {frets.map(f => (
            <div key={f} className="text-center text-[9px] font-mono text-muted-foreground" style={{ width: `${widths[f]}%` }}>
              {f === 0 ? '' : f}
            </div>
          ))}
        </div>

        {/* Fretboard */}
        <div className="relative rounded-lg overflow-hidden border border-border bg-fretboard-wood">
          {/* Inlays */}
          <div className="absolute inset-0 pointer-events-none">
            {frets.filter(f => f > 0 && f <= maxFrets && INLAY_FRETS.includes(f)).map(f => {
              const centerPct = cumLeft[f] + widths[f] / 2;
              const isDouble = DOUBLE_INLAY.includes(f);
              return isDouble ? (
                <div key={f}>
                  <div className="absolute w-2 h-2 rounded-full bg-fretboard-inlay" style={{ left: `${centerPct}%`, top: '25%', transform: 'translate(-50%, -50%)' }} />
                  <div className="absolute w-2 h-2 rounded-full bg-fretboard-inlay" style={{ left: `${centerPct}%`, top: '75%', transform: 'translate(-50%, -50%)' }} />
                </div>
              ) : (
                <div key={f} className="absolute w-2 h-2 rounded-full bg-fretboard-inlay" style={{ left: `${centerPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }} />
              );
            })}
          </div>

          {/* Strings */}
          {[0, 1, 2, 3, 4, 5].map(stringIdx => (
            <div key={stringIdx} className="flex items-center relative" style={{ height: 32 }}>
              <div className="absolute left-0 right-0 bg-fretboard-string" style={{ height: Math.max(1, 3 - stringIdx * 0.4), top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />

              {frets.map(fret => {
                const note = noteAtFret(stringIdx, fret);
                const style = getNoteStyle(note);

                return (
                  <div key={fret} className="flex items-center justify-center relative" style={{ width: `${widths[fret]}%`, height: 32 }}>
                    {fret > 0 && <div className="absolute left-0 top-0 bottom-0 bg-fretboard-fret" style={{ width: 2, opacity: 0.6 }} />}
                    {fret === 0 && <div className="absolute right-0 top-0 bottom-0 w-1 bg-fretboard-nut" />}

                    {style && (
                      <button
                        onClick={() => onNoteClick(note)}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHover({ note, x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => setHover(null)}
                        className="relative z-10 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-mono font-bold transition-all duration-150 hover:scale-125 active:scale-95 shadow cursor-pointer"
                        style={{ backgroundColor: style.backgroundColor, opacity: style.opacity, color: 'hsl(220, 20%, 8%)' }}
                      >
                        {note}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {hover && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg shadow-xl p-3 pointer-events-none"
          style={{
            left: Math.min(hover.x, window.innerWidth - 200),
            top: hover.y - 8,
            transform: 'translate(-50%, -100%)',
            minWidth: 160,
          }}
        >
          <div className="text-xs font-mono font-bold text-foreground mb-1.5">{hover.note} Arpeggios</div>
          <div className="space-y-1">
            {arpeggios.map(arp => (
              <div key={arp.name} className="flex justify-between gap-3">
                <span className="text-[10px] font-mono text-secondary-foreground">{arp.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{arp.notes.join('–')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
