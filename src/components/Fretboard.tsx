import { useState } from 'react';
import {
  noteAtFret, isNoteInSelection, getArpeggiosForNote, getIntervalName,
  NoteName, STRING_NAMES, STANDARD_TUNING, CHORD_VOICINGS, getChordVoicingNotes,
} from '@/lib/music';
import type { ScaleSelection, ChordSelection, DisplayMode } from '@/hooks/useFretboard';

interface FretboardProps {
  maxFrets: number;
  primaryScale: ScaleSelection;
  secondaryScale: ScaleSelection;
  secondaryEnabled: boolean;
  activePrimary: boolean;
  noteColors: Record<string, string>;
  onNoteClick: (note: NoteName) => void;
  displayMode: DisplayMode;
  disabledStrings: Set<number>;
  onToggleString: (idx: number) => void;
  secondaryOpacity: number;
  secondaryColor: string;
  primaryColor: string;
  activeChord: ChordSelection | null;
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
  activePrimary, noteColors, onNoteClick, displayMode,
  disabledStrings, onToggleString, secondaryOpacity,
  secondaryColor, primaryColor, activeChord,
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

  // Chord mode: get the voicing notes
  const chordNotes = activeChord
    ? (() => {
        const voicings = CHORD_VOICINGS[activeChord.root]?.[activeChord.chordType];
        if (!voicings || !voicings[activeChord.voicingIndex]) return null;
        return getChordVoicingNotes(voicings[activeChord.voicingIndex]);
      })()
    : null;

  function isChordNote(stringIndex: number, fret: number): boolean {
    if (!chordNotes) return false;
    return chordNotes.some(cn => cn.stringIndex === stringIndex && cn.fret === fret);
  }

  const pColor = primaryColor || 'hsl(var(--primary))';
  const sColor = secondaryColor || 'hsl(200, 80%, 60%)';

  function getNoteStyle(note: NoteName, stringIndex: number, fret: number) {
    // In chord mode, only show chord notes
    if (activeChord) {
      if (!isChordNote(stringIndex, fret)) return null;
      return { backgroundColor: pColor, opacity: 1, ring: false, ringColor: '' };
    }

    const inPrimary = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
    const inSecondary = secondaryEnabled && isNoteInSelection(note, secondaryScale.root, secondaryScale.scale, secondaryScale.mode);
    if (!inPrimary && !inSecondary) return null;

    let bg = pColor;
    let opacity = 1;
    let ring = false;
    const ringColor = sColor;

    if (inPrimary && inSecondary) {
      // Show primary color with a ring in secondary color
      bg = activePrimary ? pColor : sColor;
      opacity = 1;
      ring = true;
    } else if (inPrimary && !inSecondary) {
      bg = pColor;
      opacity = activePrimary ? 1 : secondaryOpacity;
    } else if (inSecondary && !inPrimary) {
      bg = sColor;
      opacity = activePrimary ? secondaryOpacity : 1;
    }

    return { backgroundColor: bg, opacity, ring, ringColor };
  }

  const arpeggios = hover ? getArpeggiosForNote(hover.note) : [];

  // Render strings bottom-to-top: index 0 (low E) at bottom, index 5 (high e) at top
  const stringOrder = [5, 4, 3, 2, 1, 0]; // render top-to-bottom: high e first, low E last

  return (
    <div className="w-full overflow-x-auto pb-4 relative">
      <div className="min-w-[600px]">
        {/* Fret numbers */}
        <div className="flex items-center mb-1">
          <div style={{ width: 28 }} /> {/* space for string labels */}
          {frets.map(f => (
            <div key={f} className="text-center text-[9px] font-mono text-muted-foreground" style={{ width: `calc((100% - 28px) * ${widths[f]} / 100)` }}>
              {f === 0 ? '' : f}
            </div>
          ))}
        </div>

        {/* Fretboard */}
        <div className="relative rounded-lg overflow-hidden border border-border bg-fretboard-wood">
          {/* Inlays */}
          <div className="absolute inset-0 pointer-events-none" style={{ left: 28 }}>
            {frets.filter(f => f > 0 && f <= maxFrets && INLAY_FRETS.includes(f)).map(f => {
              const leftPctBase = cumLeft[f];
              const widthPctBase = widths[f];
              const centerPct = leftPctBase + widthPctBase / 2;
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

          {/* Strings - rendered top to bottom: high e, B, G, D, A, E */}
          {stringOrder.map(stringIdx => {
            const isDisabled = disabledStrings.has(stringIdx);
            // String thickness: low E (idx 0) thickest, high e (idx 5) thinnest
            const thickness = Math.max(1, 3.5 - stringIdx * 0.5);

            return (
              <div key={stringIdx} className="flex items-center relative" style={{ height: 30 }}>
                {/* String label / open string (double-click to disable) */}
                <button
                  onDoubleClick={() => onToggleString(stringIdx)}
                  className={`shrink-0 w-7 h-full flex items-center justify-center text-[9px] font-mono font-bold transition-colors z-10 ${
                    isDisabled ? 'text-muted-foreground/30 line-through' : 'text-muted-foreground'
                  }`}
                  title="Double-click to toggle string"
                >
                  {STRING_NAMES[stringIdx]}
                </button>

                {/* String line */}
                {!isDisabled && (
                  <div className="absolute bg-fretboard-string" style={{ height: thickness, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, left: 28, right: 0 }} />
                )}

                {/* Fret cells */}
                <div className="flex items-center flex-1">
                  {frets.map(fret => {
                    const note = noteAtFret(stringIdx, fret);
                    const style = isDisabled ? null : getNoteStyle(note, stringIdx, fret);
                    const activeRoot = activePrimary ? primaryScale.root : secondaryScale.root;
                    const label = displayMode === 'degrees' ? getIntervalName(activeRoot, note) : note;

                    return (
                      <div key={fret} className="flex items-center justify-center relative" style={{ width: `${widths[fret]}%`, height: 30 }}>
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
                            className={`relative z-10 w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-mono font-bold transition-all duration-150 hover:scale-125 active:scale-95 shadow cursor-pointer ${
                              style.ring ? 'ring-2' : ''
                            }`}
                            style={{
                              backgroundColor: style.backgroundColor,
                              opacity: style.opacity,
                              color: 'hsl(220, 20%, 8%)',
                              ...(style.ring ? { boxShadow: `0 0 0 2px ${style.ringColor}` } : {}),
                            }}
                          >
                            {label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover tooltip */}
      {hover && !activeChord && (
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
