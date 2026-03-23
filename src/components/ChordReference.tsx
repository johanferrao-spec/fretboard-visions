import { useState, useMemo } from 'react';
import {
  NOTE_NAMES, NoteName, CHORD_FORMULAS, STRING_NAMES, STANDARD_TUNING,
  getVoicingsForChord, noteAtFret, getExtendedIntervalName, DEGREE_COLORS,
  getCAGEDPositions, getIntervalName, CHORD_GROUPS, identifyChord,
  type ChordVoicing,
} from '@/lib/music';
import type { ChordSelection } from '@/hooks/useFretboard';

interface ChordReferenceProps {
  activeChord: ChordSelection | null;
  setActiveChord: (c: ChordSelection | null) => void;
  showCAGED: boolean;
  setShowCAGED: (v: boolean) => void;
  cagedShape: string;
  setCagedShape: (v: string) => void;
  cagedRoot: NoteName;
  identifyMode: boolean;
  setIdentifyMode: (v: boolean) => void;
  identifyFrets: (number | -1)[];
  setIdentifyFrets: (f: (number | -1)[]) => void;
  degreeColors: boolean;
  identifyRoot: NoteName | null;
  setIdentifyRoot: (v: NoteName | null) => void;
}

type VoicingTab = 'full' | 'shell' | 'drop2' | 'drop3' | 'triads';
type MainTab = 'chords' | 'caged' | 'identify';

const CHORD_COLUMNS: { label: string; types: string[] }[] = [
  { label: 'Major', types: ['Major', 'Major 7', 'Dominant 7', 'Augmented', 'Aug 7', 'Add9', 'Major 9', 'Dominant 9', 'Major 6', '7#9', '7♭9', '7#5', '7♭5', '11', '13'] },
  { label: 'Minor', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'] },
  { label: 'Sus', types: ['Sus2', 'Sus4', '7sus4', 'Power (5)'] },
];

export default function ChordReference({
  activeChord, setActiveChord, showCAGED, setShowCAGED,
  cagedShape, setCagedShape, cagedRoot,
  identifyMode, setIdentifyMode, identifyFrets, setIdentifyFrets,
  degreeColors, identifyRoot, setIdentifyRoot,
}: ChordReferenceProps) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [voicingTab, setVoicingTab] = useState<VoicingTab>('full');
  const [activeTab, setActiveTab] = useState<MainTab>('chords');
  const [voicingPage, setVoicingPage] = useState(0);
  const [identifyViewRoot, setIdentifyViewRoot] = useState<string | null>(null);

  const VOICINGS_PER_PAGE = 4;

  const currentVoicings = useMemo(() => {
    if (!selectedChord) return [];
    return getVoicingsForChord(selectedRoot, selectedChord, voicingTab);
  }, [selectedRoot, selectedChord, voicingTab]);

  const totalPages = Math.ceil(currentVoicings.length / VOICINGS_PER_PAGE);
  const pagedVoicings = currentVoicings.slice(voicingPage * VOICINGS_PER_PAGE, (voicingPage + 1) * VOICINGS_PER_PAGE);

  const handleSelectChord = (chordType: string) => {
    if (selectedChord === chordType) {
      setSelectedChord(null);
      setActiveChord(null);
    } else {
      setSelectedChord(chordType);
      setVoicingPage(0);
      const voicings = getVoicingsForChord(selectedRoot, chordType, voicingTab);
      if (voicings.length > 0) {
        setActiveChord({ root: selectedRoot, chordType, voicingIndex: 0, voicingSource: voicingTab });
      }
    }
  };

  const handleSelectVoicing = (idx: number) => {
    const globalIdx = voicingPage * VOICINGS_PER_PAGE + idx;
    if (selectedChord) {
      setActiveChord({ root: selectedRoot, chordType: selectedChord, voicingIndex: globalIdx, voicingSource: voicingTab });
    }
  };

  const handleVoicingTabChange = (tab: VoicingTab) => {
    setVoicingTab(tab);
    setVoicingPage(0);
    if (selectedChord) {
      const voicings = getVoicingsForChord(selectedRoot, selectedChord, tab);
      if (voicings.length > 0) {
        setActiveChord({ root: selectedRoot, chordType: selectedChord, voicingIndex: 0, voicingSource: tab });
      }
    }
  };

  const cagedPositions = useMemo(() => getCAGEDPositions(cagedRoot), [cagedRoot]);

  // Chord identification from fretboard clicks
  const identifiedChords = useMemo(() => {
    const hasInput = identifyFrets.some(f => f >= 0);
    if (!hasInput) return [];
    return identifyChord(identifyFrets);
  }, [identifyFrets]);

  const handleTabSwitch = (tab: MainTab) => {
    setActiveTab(tab);
    if (tab === 'caged') setShowCAGED(true);
    if (tab === 'identify') {
      setIdentifyMode(true);
      // Clear fretboard when entering What's This mode
      setActiveChord(null);
      setIdentifyFrets([-1, -1, -1, -1, -1, -1]);
      setIdentifyViewRoot(null);
    } else {
      setIdentifyMode(false);
    }
  };

  // Get the selected interpretation root for scale degree display
  const currentIdentifyRoot = useMemo(() => {
    if (!identifyViewRoot || identifiedChords.length === 0) return null;
    // Parse root from name like "C Major" or "Em7/G"
    const match = identifyViewRoot.match(/^([A-G]#?)/);
    return match ? match[1] as NoteName : null;
  }, [identifyViewRoot, identifiedChords]);

  return (
    <div className="p-2">
      {/* Tab switcher */}
      <div className="flex gap-1 mb-2">
        {([
          { key: 'chords' as MainTab, label: 'Chord Library' },
          { key: 'caged' as MainTab, label: 'CAGED' },
          { key: 'identify' as MainTab, label: "What's This" },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabSwitch(tab.key)}
            className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
              activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {activeChord && (
          <button
            onClick={() => { setActiveChord(null); setSelectedChord(null); }}
            className="ml-auto text-[9px] font-mono text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
          >Clear</button>
        )}
      </div>

      {activeTab === 'caged' ? (
        <CAGEDPanel positions={cagedPositions} cagedShape={cagedShape} setCagedShape={setCagedShape} root={cagedRoot} />
      ) : activeTab === 'identify' ? (
        <IdentifyPanel
          frets={identifyFrets}
          setFrets={setIdentifyFrets}
          results={identifiedChords}
          degreeColors={degreeColors}
          viewRoot={identifyViewRoot}
          setViewRoot={setIdentifyViewRoot}
          currentRoot={currentIdentifyRoot}
        />
      ) : (
        <ChordLibraryPanel
          selectedRoot={selectedRoot}
          setSelectedRoot={(n) => { setSelectedRoot(n); setSelectedChord(null); setActiveChord(null); setVoicingPage(0); }}
          selectedChord={selectedChord}
          handleSelectChord={handleSelectChord}
          voicingTab={voicingTab}
          handleVoicingTabChange={handleVoicingTabChange}
          currentVoicings={currentVoicings}
          pagedVoicings={pagedVoicings}
          voicingPage={voicingPage}
          setVoicingPage={setVoicingPage}
          totalPages={totalPages}
          activeChord={activeChord}
          handleSelectVoicing={handleSelectVoicing}
          degreeColors={degreeColors}
        />
      )}
    </div>
  );
}

// ============================================================
// CHORD LIBRARY PANEL — compact 3-column layout with inline diagrams
// ============================================================

function ChordLibraryPanel({
  selectedRoot, setSelectedRoot, selectedChord, handleSelectChord,
  voicingTab, handleVoicingTabChange, currentVoicings, pagedVoicings,
  voicingPage, setVoicingPage, totalPages, activeChord, handleSelectVoicing,
  degreeColors,
}: {
  selectedRoot: NoteName;
  setSelectedRoot: (n: NoteName) => void;
  selectedChord: string | null;
  handleSelectChord: (ct: string) => void;
  voicingTab: VoicingTab;
  handleVoicingTabChange: (tab: VoicingTab) => void;
  currentVoicings: ChordVoicing[];
  pagedVoicings: ChordVoicing[];
  voicingPage: number;
  setVoicingPage: (p: number) => void;
  totalPages: number;
  activeChord: ChordSelection | null;
  handleSelectVoicing: (idx: number) => void;
  degreeColors: boolean;
}) {
  const VOICINGS_PER_PAGE = 4;

  // Split types into 2 sub-columns
  const splitIntoColumns = (types: string[]) => {
    const mid = Math.ceil(types.length / 2);
    return [types.slice(0, mid), types.slice(mid)];
  };

  return (
    <>
      {/* Root selector */}
      <div className="flex flex-wrap gap-0.5 mb-2">
        {NOTE_NAMES.map(n => (
          <button
            key={n}
            onClick={() => setSelectedRoot(n)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
              n === selectedRoot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >{n}</button>
        ))}
      </div>

      {/* Main layout: chord columns + type + diagrams */}
      <div className="flex gap-1.5">
        {/* Chord quality columns with cell boxes — 2 sub-columns each for major/minor */}
        <div className="flex gap-px shrink-0" style={{ width: '48%' }}>
          {CHORD_COLUMNS.map((col, ci) => {
            const isSus = col.label === 'Sus';
            const [col1, col2] = isSus ? [col.types, []] : splitIntoColumns(col.types);
            return (
              <div key={col.label} className={`flex-1 min-w-0 ${ci < CHORD_COLUMNS.length - 1 ? 'border-r border-border/40' : ''} px-0.5`}>
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center mb-1 font-bold">{col.label}</div>
                <div className={`flex gap-px ${isSus ? 'justify-center' : ''}`}>
                  {[col1, ...(col2.length > 0 ? [col2] : [])].map((types, sci) => (
                    <div key={sci} className={`${isSus ? 'w-full' : 'flex-1'} space-y-px`}>
                      {types.map(ct => {
                        if (!CHORD_FORMULAS[ct]) return null;
                        const isSelected = selectedChord === ct;
                        return (
                          <button
                            key={ct}
                            onClick={() => handleSelectChord(ct)}
                            className={`w-full text-left px-1 py-0.5 rounded border text-[9px] font-mono transition-all truncate leading-tight ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]'
                                : 'bg-muted/60 border-border/30 text-foreground/80 hover:bg-muted hover:border-border/60'
                            }`}
                            title={ct}
                          >{ct}</button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Voicing type selector — bigger */}
        <div className="w-14 shrink-0">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center mb-1 font-bold">Type</div>
          <div className="space-y-0.5">
            {(['full', 'shell', 'drop2', 'drop3', 'triads'] as VoicingTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => handleVoicingTabChange(tab)}
                className={`w-full px-1 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider transition-colors leading-tight ${
                  voicingTab === tab ? 'bg-accent text-accent-foreground font-bold border-accent' : 'text-muted-foreground border-border/40 hover:bg-muted/30'
                }`}
              >{tab === 'drop2' ? 'Drop 2' : tab === 'drop3' ? 'Drop 3' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
            ))}
          </div>
          <div className="text-[7px] font-mono text-muted-foreground mt-1.5 text-center leading-tight">
            {voicingTab === 'shell' && 'R, 3, 7'}
            {voicingTab === 'drop2' && '2nd voice ↓8va'}
            {voicingTab === 'drop3' && '3rd voice ↓8va'}
            {voicingTab === 'triads' && '3 adjacent strings'}
          </div>
        </div>

        {/* Diagrams panel */}
        <div className="flex-1 min-w-0">
          {selectedChord ? (
            <div className="bg-secondary/20 rounded p-1.5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-mono font-bold text-foreground truncate">{selectedRoot} {selectedChord}</div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setVoicingPage(Math.max(0, voicingPage - 1))} disabled={voicingPage === 0}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors">◀</button>
                    <span className="text-[8px] font-mono text-muted-foreground">{voicingPage + 1}/{totalPages}</span>
                    <button onClick={() => setVoicingPage(Math.min(totalPages - 1, voicingPage + 1))} disabled={voicingPage >= totalPages - 1}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors">▶</button>
                  </div>
                )}
              </div>
              {currentVoicings.length > 0 ? (
                <div className="grid grid-cols-2 gap-1">
                  {pagedVoicings.map((v, i) => {
                    const globalIdx = voicingPage * VOICINGS_PER_PAGE + i;
                    const isActive = activeChord?.voicingIndex === globalIdx && activeChord?.voicingSource === voicingTab;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSelectVoicing(i)}
                        className={`rounded p-0.5 transition-all border ${
                          isActive ? 'border-primary bg-primary/10 shadow-[0_0_6px_hsl(var(--primary)/0.3)]' : 'border-border/30 hover:bg-muted/50'
                        }`}
                      >
                        <MiniChordDiagram voicing={v} root={selectedRoot} showDegrees={degreeColors} />
                        <div className="text-[7px] font-mono text-muted-foreground text-center">
                          {v.frets.map(f => f === -1 ? 'x' : f).join('')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[8px] font-mono text-muted-foreground text-center py-2">No voicings</div>
              )}
              <div className="text-[8px] font-mono text-muted-foreground mt-1 text-center">
                {getChordStructureDescription(selectedChord, voicingTab)}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[9px] font-mono text-muted-foreground">
              ← Select a chord
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// WHAT'S THIS PANEL — fretboard-click based identification
// ============================================================

function IdentifyPanel({
  frets, setFrets, results, degreeColors, viewRoot, setViewRoot, currentRoot,
}: {
  frets: (number | -1)[];
  setFrets: (f: (number | -1)[]) => void;
  results: ReturnType<typeof identifyChord>;
  degreeColors: boolean;
  viewRoot: string | null;
  setViewRoot: (v: string | null) => void;
  currentRoot: NoteName | null;
}) {
  return (
    <div>
      <div className="text-[9px] font-mono text-muted-foreground mb-2">
        Click notes on the fretboard to build a chord. One note per string.
      </div>

      {/* Current selection display */}
      <div className="flex gap-1 mb-2">
        {STRING_NAMES.map((name, i) => {
          const fret = frets[i];
          const note = fret >= 0 ? noteAtFret(i, fret) : null;
          return (
            <div key={i} className="flex-1 text-center">
              <div className="text-[7px] font-mono text-muted-foreground mb-0.5">{name}</div>
              <button
                onClick={() => { const nf = [...frets]; nf[i] = -1; setFrets(nf); }}
                className={`w-full rounded text-[9px] font-mono py-0.5 transition-colors ${
                  fret >= 0
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/30 text-muted-foreground border border-transparent'
                }`}
              >
                {fret === -1 ? '×' : `${note} (${fret})`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Clear button */}
      <button
        onClick={() => setFrets([-1, -1, -1, -1, -1, -1])}
        className="w-full py-0.5 rounded text-[8px] font-mono text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors mb-2"
      >Clear Selection</button>

      {/* Results */}
      {results.length > 0 ? (
        <div className="space-y-1.5">
          {results.map((r, i) => {
            // All possible root interpretations
            const allNames = r.names;
            const isSelected = viewRoot && allNames.includes(viewRoot);
            
            return (
              <div key={i} className="bg-secondary/50 rounded-lg p-2">
                <div className="flex flex-wrap gap-1 mb-1">
                  {allNames.map((name, ni) => {
                    const rootMatch = name.match(/^([A-G]#?)/);
                    const root = rootMatch ? rootMatch[1] as NoteName : null;
                    const isActive = viewRoot === name;
                    return (
                      <button
                        key={ni}
                        onClick={() => setViewRoot(isActive ? null : name)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-[0_0_6px_hsl(var(--primary))]'
                            : 'bg-muted text-foreground hover:bg-muted/80'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>

                {/* Show scale degrees relative to selected root */}
                {currentRoot && isSelected && (
                  <div className="flex gap-1 mb-1">
                    {STRING_NAMES.map((_, si) => {
                      if (frets[si] < 0) return <div key={si} className="flex-1" />;
                      const note = noteAtFret(si, frets[si]);
                      const interval = getExtendedIntervalName(currentRoot, note);
                      const degColor = DEGREE_COLORS[interval];
                      return (
                        <div key={si} className="flex-1 text-center">
                          <div
                            className="w-5 h-5 rounded-full mx-auto flex items-center justify-center text-[7px] font-mono font-bold"
                            style={{
                              backgroundColor: degColor ? `hsl(${degColor})` : 'hsl(var(--muted))',
                              color: 'hsl(220, 20%, 8%)',
                            }}
                          >{interval}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {r.explanations.map((exp, j) => (
                  <div key={j} className="text-[7px] font-mono text-muted-foreground mt-0.5">{exp}</div>
                ))}
                <div className="text-[7px] font-mono text-muted-foreground mt-1">
                  Notes: {[...new Set(r.notes)].join(' – ')}
                </div>
              </div>
            );
          })}
        </div>
      ) : frets.some(f => f >= 0) ? (
        <div className="text-[8px] font-mono text-muted-foreground text-center py-2">
          No matching chord found. Try adding more notes.
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getChordStructureDescription(chordType: string, source: string): string {
  const descriptions: Record<string, string> = {
    'Major': 'R-3-5',
    'Minor': 'R-♭3-5',
    'Diminished': 'R-♭3-♭5',
    'Augmented': 'R-3-#5',
    'Sus2': 'R-2-5',
    'Sus4': 'R-4-5',
    'Major 7': 'R-3-5-7',
    'Minor 7': 'R-♭3-5-♭7',
    'Dominant 7': 'R-3-5-♭7',
    'Dim 7': 'R-♭3-♭5-♭♭7',
    'Half-Dim 7': 'R-♭3-♭5-♭7',
    'Min/Maj 7': 'R-♭3-5-7',
    'Aug 7': 'R-3-#5-♭7',
    'Add9': 'R-3-5-9',
    'Major 9': 'R-3-5-7-9',
    'Minor 9': 'R-♭3-5-♭7-9',
    'Dominant 9': 'R-3-5-♭7-9',
    '7sus4': 'R-4-5-♭7',
    '7#9': 'R-3-5-♭7-#9',
    '7♭9': 'R-3-5-♭7-♭9',
    'Power (5)': 'R-5',
  };
  return descriptions[chordType] || chordType;
}

function MiniChordDiagram({ voicing, root, showDegrees = false }: { voicing: ChordVoicing; root: NoteName; showDegrees?: boolean }) {
  const positiveFrets = voicing.frets.filter(f => f > 0);
  const maxFret = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 1;
  const minFret = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const startFret = minFret <= 4 ? 1 : minFret;
  const numFrets = Math.max(4, maxFret - startFret + 1);
  const w = 44;
  const h = 52;
  const stringSpacing = w / 7;
  const fretSpacing = h / (numFrets + 1);

  return (
    <div className="flex justify-center">
      <svg width={w} height={h + 6} className="shrink-0">
        {startFret > 1 && (
          <text x={2} y={fretSpacing + 6} fontSize={5} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
        )}
        {startFret === 1 && (
          <line x1={stringSpacing} y1={5} x2={stringSpacing * 6} y2={5} stroke="hsl(var(--fretboard-nut))" strokeWidth={2} />
        )}
        {Array.from({ length: numFrets + 1 }, (_, i) => (
          <line key={i} x1={stringSpacing} y1={5 + i * fretSpacing} x2={stringSpacing * 6} y2={5 + i * fretSpacing} stroke="hsl(var(--border))" strokeWidth={0.5} />
        ))}
        {[1, 2, 3, 4, 5, 6].map(s => (
          <line key={s} x1={s * stringSpacing} y1={5} x2={s * stringSpacing} y2={5 + numFrets * fretSpacing} stroke="hsl(var(--fretboard-string))" strokeWidth={0.5} opacity={0.5} />
        ))}
        {voicing.barreFrom != null && voicing.barreTo != null && voicing.barreFret != null && (
          <rect
            x={(voicing.barreFrom + 1) * stringSpacing - 2}
            y={5 + (voicing.barreFret - startFret + 0.3) * fretSpacing}
            width={(voicing.barreTo - voicing.barreFrom) * stringSpacing + 4}
            height={fretSpacing * 0.4}
            rx={fretSpacing * 0.2}
            fill="hsl(var(--foreground))"
            opacity={0.5}
          />
        )}
        {voicing.frets.map((fret, i) => {
          const x = (i + 1) * stringSpacing;
          if (fret === -1) return <text key={i} x={x} y={3} fontSize={5} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="monospace">×</text>;
          if (fret === 0) return <circle key={i} cx={x} cy={3} r={1.5} fill="none" stroke="hsl(var(--foreground))" strokeWidth={0.5} />;
          const y = 5 + (fret - startFret + 0.5) * fretSpacing;
          const note = noteAtFret(i, fret);
          const interval = getExtendedIntervalName(root, note);
          const degColor = DEGREE_COLORS[interval];
          const fillColor = showDegrees && degColor ? `hsl(${degColor})` : 'hsl(var(--primary))';
          return <circle key={i} cx={x} cy={y} r={2.5} fill={fillColor} />;
        })}
      </svg>
    </div>
  );
}

function CAGEDPanel({
  positions, cagedShape, setCagedShape, root,
}: {
  positions: ReturnType<typeof getCAGEDPositions>;
  cagedShape: string;
  setCagedShape: (v: string) => void;
  root: NoteName;
}) {
  const shapes = ['C', 'A', 'G', 'E', 'D'];
  const currentPos = positions.find(p => p.shape === cagedShape);

  return (
    <div>
      <div className="text-[9px] font-mono text-muted-foreground mb-2 leading-relaxed">
        The <strong className="text-foreground">CAGED system</strong> divides the fretboard into 5 overlapping positions.
      </div>
      <div className="flex gap-1 mb-3">
        {shapes.map(s => (
          <button
            key={s}
            onClick={() => setCagedShape(s)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-mono font-bold transition-colors ${
              s === cagedShape ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >{s}</button>
        ))}
      </div>
      {currentPos && (
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="text-xs font-mono font-bold text-foreground mb-1">{cagedShape} Shape — Frets {currentPos.startFret}–{currentPos.endFret}</div>
          <div className="text-[9px] font-mono text-muted-foreground mb-2">
            {cagedShape === 'E' && 'Root on the low E string. The most common barre chord position.'}
            {cagedShape === 'D' && 'Root on the D string. Higher register, great for melodies.'}
            {cagedShape === 'C' && 'Root on the A string (higher position). Connects A and G shapes.'}
            {cagedShape === 'A' && 'Root on the A string. Second most common barre chord position.'}
            {cagedShape === 'G' && 'Root on the low E string (lower). Connects E and A shapes.'}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground">
            Navigate: {shapes.map((s, i) => (
              <span key={s}>
                {i > 0 && ' → '}
                <span className={s === cagedShape ? 'text-primary font-bold' : ''}>{s}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
