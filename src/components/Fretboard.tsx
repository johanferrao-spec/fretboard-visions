import { useState } from 'react';
import {
  noteAtFret, isNoteInSelection, getIntervalName, getDiatonicChord,
  NoteName, STRING_NAMES, STANDARD_TUNING, CHORD_VOICINGS, SHELL_VOICINGS, getChordVoicingNotes,
} from '@/lib/music';
import type { ScaleSelection, ChordSelection, DisplayMode, Orientation } from '@/hooks/useFretboard';

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
  orientation: Orientation;
  showFretBox: boolean;
  fretBoxStart: number;
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

export default function Fretboard({
  maxFrets, primaryScale, secondaryScale, secondaryEnabled,
  activePrimary, noteColors, onNoteClick, displayMode,
  disabledStrings, onToggleString, secondaryOpacity,
  secondaryColor, primaryColor, activeChord, orientation,
  showFretBox, fretBoxStart,
}: FretboardProps) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, i) => i);
  const widths = fretWidths(maxFrets);
  const [hoveredDiatonic, setHoveredDiatonic] = useState<{ notes: NoteName[]; name: string } | null>(null);

  const cumLeft: number[] = [];
  let acc = 0;
  for (const w of widths) {
    cumLeft.push(acc);
    acc += w;
  }

  // Chord mode: get the voicing notes
  const chordNotes = activeChord
    ? (() => {
        const source = activeChord.isShell ? SHELL_VOICINGS : CHORD_VOICINGS;
        const voicings = source[activeChord.root]?.[activeChord.chordType];
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
      return { backgroundColor: pColor, opacity: 1, ring: false, ringColor: '', greyed: false };
    }

    const inPrimary = isNoteInSelection(note, primaryScale.root, primaryScale.scale, primaryScale.mode);
    const inSecondary = secondaryEnabled && isNoteInSelection(note, secondaryScale.root, secondaryScale.scale, secondaryScale.mode);
    if (!inPrimary && !inSecondary) return null;

    let bg = pColor;
    let opacity = 1;
    let ring = false;
    const ringColor = sColor;
    let greyed = false;

    if (inPrimary && inSecondary) {
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

    // Diatonic hover: grey out notes not in the hovered chord
    if (hoveredDiatonic && hoveredDiatonic.notes.length > 0) {
      if (!hoveredDiatonic.notes.includes(note)) {
        greyed = true;
        opacity = 0.2;
      } else {
        opacity = 1;
      }
    }

    return { backgroundColor: bg, opacity, ring, ringColor, greyed };
  }

  const handleNoteHover = (note: NoteName) => {
    if (activeChord) return;
    const activeScale = activePrimary ? primaryScale : secondaryScale;
    const inScale = isNoteInSelection(note, activeScale.root, activeScale.scale, activeScale.mode);
    if (inScale && activeScale.mode === 'scale') {
      const diatonic = getDiatonicChord(activeScale.root, activeScale.scale, note);
      if (diatonic.notes.length > 0) {
        setHoveredDiatonic(diatonic);
        return;
      }
    }
    setHoveredDiatonic(null);
  };

  // Render strings bottom-to-top: index 0 (low E) at bottom, index 5 (high e) at top
  const stringOrder = [5, 4, 3, 2, 1, 0];

  const isVertical = orientation === 'vertical';

  // Fret box boundaries
  const fretBoxEnd = fretBoxStart + 4;

  return (
    <div className={`w-full relative ${isVertical ? 'flex justify-center' : ''}`}>
      <div
        className={isVertical ? 'origin-center' : ''}
        style={isVertical ? { transform: 'rotate(-90deg)', width: '70vh', maxWidth: 800 } : {}}
      >
        {/* Guitar headstock silhouette */}
        <div className="flex items-end mb-0">
          <div style={{ width: 28 }} />
          <svg viewBox="0 0 200 20" className="w-full h-5 opacity-40" preserveAspectRatio="none">
            <path
              d="M0 10 Q10 0, 30 2 L50 0 L200 0 L200 20 L50 20 L30 18 Q10 20, 0 10Z"
              fill="hsl(var(--fretboard-wood))"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />
          </svg>
        </div>

        {/* Fret numbers */}
        <div className="flex items-center mb-1">
          <div style={{ width: 28 }} />
          {frets.map(f => (
            <div
              key={f}
              className={`text-center font-mono text-muted-foreground ${isVertical ? 'rotate-90' : ''}`}
              style={{ width: `calc((100% - 28px) * ${widths[f]} / 100)`, fontSize: 9 }}
            >
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

          {/* 5-fret box overlay */}
          {showFretBox && (
            <div
              className="absolute top-0 bottom-0 border-2 border-yellow-400/70 bg-yellow-400/10 rounded-md pointer-events-none z-20 transition-all duration-500 ease-in-out"
              style={{
                left: `calc(28px + (100% - 28px) * ${cumLeft[fretBoxStart] || 0} / 100)`,
                width: `calc((100% - 28px) * ${(cumLeft[fretBoxEnd + 1] || cumLeft[maxFrets] || 100) - (cumLeft[fretBoxStart] || 0)} / 100)`,
              }}
            />
          )}

          {/* Strings */}
          {stringOrder.map(stringIdx => {
            const isDisabled = disabledStrings.has(stringIdx);
            const thickness = Math.max(1, 3.5 - stringIdx * 0.5);

            return (
              <div key={stringIdx} className="flex items-center relative" style={{ height: 30 }}>
                {/* String label */}
                <button
                  onDoubleClick={() => onToggleString(stringIdx)}
                  className={`shrink-0 w-7 h-full flex items-center justify-center font-mono font-bold transition-colors z-10 ${
                    isDisabled ? 'text-muted-foreground/30 line-through' : 'text-muted-foreground'
                  } ${isVertical ? 'rotate-90' : ''}`}
                  style={{ fontSize: 9 }}
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
                            onMouseEnter={() => handleNoteHover(note)}
                            onMouseLeave={() => setHoveredDiatonic(null)}
                            className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold transition-all duration-150 hover:scale-125 active:scale-95 shadow cursor-pointer ${
                              style.ring ? 'ring-2' : ''
                            } ${isVertical ? 'rotate-90' : ''}`}
                            style={{
                              backgroundColor: style.greyed ? 'hsl(var(--muted))' : style.backgroundColor,
                              opacity: style.opacity,
                              color: style.greyed ? 'hsl(var(--muted-foreground))' : 'hsl(220, 20%, 8%)',
                              fontSize: 7,
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

        {/* Guitar body silhouette */}
        <div className="flex items-start mt-0">
          <div style={{ width: 28 }} />
          <svg viewBox="0 0 200 30" className="w-full h-6 opacity-30" preserveAspectRatio="none">
            <path
              d="M0 0 L200 0 L200 5 Q180 8, 170 15 Q160 25, 140 28 L60 28 Q40 25, 30 15 Q20 8, 0 5Z"
              fill="hsl(var(--fretboard-wood))"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      </div>

      {/* Diatonic hover tooltip */}
      {hoveredDiatonic && hoveredDiatonic.name && !activeChord && (
        <div className={`absolute z-50 bg-card border border-border rounded-lg shadow-xl px-3 py-2 pointer-events-none ${
          isVertical ? 'top-2 right-2' : 'top-0 right-0'
        }`}>
          <div className="text-xs font-mono font-bold text-foreground">{hoveredDiatonic.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {hoveredDiatonic.notes.join(' – ')}
          </div>
        </div>
      )}
    </div>
  );
}
