import { noteAtFret, isNoteInScale, NOTE_CSS_KEYS, NoteName, STRING_NAMES } from '@/lib/music';
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

export default function Fretboard({
  maxFrets, primaryScale, secondaryScale, secondaryEnabled,
  activePrimary, noteColors, onNoteClick,
}: FretboardProps) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, i) => i);

  function getNoteStyle(note: NoteName, stringIdx: number, fret: number) {
    const inPrimary = isNoteInScale(note, primaryScale.root, primaryScale.scale);
    const inSecondary = secondaryEnabled && isNoteInScale(note, secondaryScale.root, secondaryScale.scale);

    if (!inPrimary && !inSecondary) return null;

    const customColor = noteColors[note];
    const cssVar = NOTE_CSS_KEYS[note];
    const baseColor = customColor || `hsl(var(${cssVar}))`;

    // Determine opacity based on active scale
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

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[600px]">
        {/* Fret numbers */}
        <div className="flex items-center mb-1">
          <div className="w-8 shrink-0" />
          {frets.map(f => (
            <div
              key={f}
              className="flex-1 text-center text-xs font-mono text-muted-foreground"
            >
              {f === 0 ? '' : f}
            </div>
          ))}
        </div>

        {/* Fretboard body */}
        <div className="relative rounded-lg overflow-hidden border border-border bg-fretboard-wood">
          {/* Inlay dots */}
          <div className="absolute inset-0 pointer-events-none">
            {frets.filter(f => f > 0 && f <= maxFrets && INLAY_FRETS.includes(f)).map(f => {
              const leftPercent = ((f - 0.5) / (maxFrets + 1)) * 100;
              const isDouble = DOUBLE_INLAY.includes(f);
              return isDouble ? (
                <div key={f}>
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-fretboard-inlay"
                    style={{ left: `${leftPercent}%`, top: '25%', transform: 'translate(-50%, -50%)' }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-fretboard-inlay"
                    style={{ left: `${leftPercent}%`, top: '75%', transform: 'translate(-50%, -50%)' }}
                  />
                </div>
              ) : (
                <div
                  key={f}
                  className="absolute w-2.5 h-2.5 rounded-full bg-fretboard-inlay"
                  style={{ left: `${leftPercent}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                />
              );
            })}
          </div>

          {/* Strings */}
          {[0, 1, 2, 3, 4, 5].map(stringIdx => (
            <div key={stringIdx} className="flex items-center relative" style={{ height: 40 }}>
              {/* String label */}
              <div className="w-8 shrink-0 text-center text-xs font-mono text-muted-foreground font-bold z-10">
                {STRING_NAMES[stringIdx]}
              </div>

              {/* String line */}
              <div
                className="absolute left-8 right-0 bg-fretboard-string"
                style={{
                  height: Math.max(1, 3 - stringIdx * 0.3),
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0.6,
                }}
              />

              {/* Frets and notes */}
              {frets.map(fret => {
                const note = noteAtFret(stringIdx, fret);
                const style = getNoteStyle(note, stringIdx, fret);

                return (
                  <div
                    key={fret}
                    className="flex-1 flex items-center justify-center relative"
                    style={{ height: 40 }}
                  >
                    {/* Fret wire */}
                    {fret > 0 && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-fretboard-fret"
                        style={{
                          width: fret === 0 ? 4 : 2,
                          opacity: fret === 0 ? 1 : 0.6,
                        }}
                      />
                    )}

                    {/* Nut */}
                    {fret === 0 && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-fretboard-nut" />
                    )}

                    {/* Note dot */}
                    {style && (
                      <button
                        onClick={() => onNoteClick(note)}
                        className="relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-150 hover:scale-110 active:scale-95 shadow-lg cursor-pointer"
                        style={{
                          backgroundColor: style.backgroundColor,
                          opacity: style.opacity,
                          color: 'hsl(220, 20%, 8%)',
                          textShadow: '0 1px 2px rgba(255,255,255,0.2)',
                        }}
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
    </div>
  );
}
