import { useState } from 'react';
import { NOTE_NAMES, NoteName, CHORD_FORMULAS, CHORD_VOICINGS, SHELL_VOICINGS, STRING_NAMES } from '@/lib/music';
import type { ChordSelection } from '@/hooks/useFretboard';

interface ChordReferenceProps {
  activeChord: ChordSelection | null;
  setActiveChord: (c: ChordSelection | null) => void;
}

export default function ChordReference({ activeChord, setActiveChord }: ChordReferenceProps) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [expandedChord, setExpandedChord] = useState<string | null>(null);
  const [showShell, setShowShell] = useState(false);

  const chordNames = Object.keys(CHORD_FORMULAS);
  const regularVoicings = CHORD_VOICINGS[selectedRoot] || {};
  const shellVoicings = SHELL_VOICINGS[selectedRoot] || {};

  const handleSelectChord = (root: NoteName, chordType: string, voicingIndex: number, isShell: boolean) => {
    if (
      activeChord &&
      activeChord.root === root &&
      activeChord.chordType === chordType &&
      activeChord.voicingIndex === voicingIndex &&
      activeChord.isShell === isShell
    ) {
      setActiveChord(null);
    } else {
      setActiveChord({ root, chordType, voicingIndex, isShell });
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-display font-semibold text-foreground">Chords</h2>
        {activeChord && (
          <button
            onClick={() => setActiveChord(null)}
            className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
          >
            Clear
          </button>
        )}
      </div>

      {/* Root selector */}
      <div className="flex flex-wrap gap-1 mb-3">
        {NOTE_NAMES.map(n => (
          <button
            key={n}
            onClick={() => { setSelectedRoot(n); setExpandedChord(null); setActiveChord(null); }}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
              n === selectedRoot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Shell voicing toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowShell(false)}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            !showShell ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Full Voicings
        </button>
        <button
          onClick={() => setShowShell(true)}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            showShell ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Shell Voicings
        </button>
      </div>

      {/* Chord list */}
      <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
        {(showShell ? Object.keys(shellVoicings) : chordNames).map(chordType => {
          const isExpanded = expandedChord === chordType;
          const chordVoicings = showShell ? shellVoicings[chordType] : regularVoicings[chordType];
          const rootIdx = NOTE_NAMES.indexOf(selectedRoot);
          const formula = CHORD_FORMULAS[chordType];
          const notes = formula ? formula.map(i => NOTE_NAMES[(rootIdx + i) % 12]) : [];

          return (
            <div key={chordType} className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setExpandedChord(isExpanded ? null : chordType)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/50 transition-colors text-left"
              >
                <span className="text-xs font-mono font-semibold text-foreground">
                  {selectedRoot} {chordType}
                  {showShell && <span className="text-muted-foreground ml-1">(shell)</span>}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {notes.length > 0 ? notes.join('–') : ''}
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border bg-secondary/30">
                  {chordVoicings && chordVoicings.length > 0 ? (
                    <div className="space-y-2">
                      {chordVoicings.map((voicing, vi) => {
                        const isActive =
                          activeChord?.root === selectedRoot &&
                          activeChord?.chordType === chordType &&
                          activeChord?.voicingIndex === vi &&
                          activeChord?.isShell === showShell;
                        return (
                          <button
                            key={vi}
                            onClick={() => handleSelectChord(selectedRoot, chordType, vi, showShell)}
                            className={`w-full flex items-center gap-2 p-1.5 rounded-md transition-colors ${
                              isActive ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-secondary/80'
                            }`}
                          >
                            <ChordDiagram voicing={voicing} />
                            <div className="text-[9px] font-mono text-muted-foreground">
                              {STRING_NAMES.map((s, i) => (
                                <span key={i} className="inline-block w-5 text-center">
                                  {voicing[i] === -1 ? 'x' : voicing[i]}
                                </span>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-muted-foreground italic">
                      No voicings available for this chord type.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChordDiagram({ voicing }: { voicing: number[] }) {
  const positiveFrets = voicing.filter(f => f > 0);
  const maxFret = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 1;
  const minFret = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const startFret = minFret <= 4 ? 1 : minFret;
  const numFrets = Math.max(4, maxFret - startFret + 1);
  const w = 60;
  const h = 70;
  const stringSpacing = w / 7;
  const fretSpacing = h / (numFrets + 1);

  return (
    <svg width={w} height={h + 10} className="shrink-0">
      {startFret > 1 && (
        <text x={2} y={fretSpacing + 12} fontSize={7} fill="hsl(var(--muted-foreground))" fontFamily="monospace">
          {startFret}
        </text>
      )}
      {startFret === 1 && (
        <line x1={stringSpacing} y1={8} x2={stringSpacing * 6} y2={8} stroke="hsl(var(--fretboard-nut))" strokeWidth={3} />
      )}
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line key={i} x1={stringSpacing} y1={8 + i * fretSpacing} x2={stringSpacing * 6} y2={8 + i * fretSpacing} stroke="hsl(var(--border))" strokeWidth={1} />
      ))}
      {[1, 2, 3, 4, 5, 6].map(s => (
        <line key={s} x1={s * stringSpacing} y1={8} x2={s * stringSpacing} y2={8 + numFrets * fretSpacing} stroke="hsl(var(--fretboard-string))" strokeWidth={1} opacity={0.6} />
      ))}
      {voicing.map((fret, i) => {
        const x = (i + 1) * stringSpacing;
        if (fret === -1) {
          return <text key={i} x={x} y={5} fontSize={8} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontFamily="monospace">×</text>;
        }
        if (fret === 0) {
          return <circle key={i} cx={x} cy={5} r={2.5} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1} />;
        }
        const y = 8 + (fret - startFret + 0.5) * fretSpacing;
        return <circle key={i} cx={x} cy={y} r={3} fill="hsl(var(--primary))" />;
      })}
    </svg>
  );
}
