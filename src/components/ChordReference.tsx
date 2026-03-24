import { useState, useMemo } from 'react';
import {
  NOTE_NAMES, NoteName, CHORD_FORMULAS, STANDARD_TUNING,
  getVoicingsForChord, noteAtFret, getExtendedIntervalName, DEGREE_COLORS,
  getCAGEDPositions, getIntervalName, CHORD_GROUPS, identifyChord,
  isVoicingPlayableInTuning, getTensionSuggestions, getChordTones,
  analyzeProgression,
  SCALE_FORMULAS, ARPEGGIO_FORMULAS, generateArpeggioPositions,
  type ChordVoicing, type TensionSuggestion, type KeyMode, type ChordAnalysis,
  type ArpeggioPosition,
} from '@/lib/music';
import type { ChordSelection } from '@/hooks/useFretboard';
import type { TimelineChord } from '@/hooks/useSongTimeline';

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
  tuning: number[];
  tuningLabels: string[];
  // Playing Changes props
  timelineChords: TimelineChord[];
  currentBeat: number;
  isPlaying: boolean;
  timelineKey: NoteName;
  onApplyScale: (root: NoteName, scale: string, mode: 'scale' | 'arpeggio') => void;
  keyMode: KeyMode;
  onSeekToChord?: (beat: number) => void;
  onSetArpeggioPosition?: (pos: ArpeggioPosition | null) => void;
}

type VoicingTab = 'full' | 'shell' | 'drop2' | 'drop3' | 'triads';
type MainTab = 'chords' | 'arpeggios' | 'caged' | 'identify' | 'changes';
type OctaveRange = 1 | 2 | 3;

const ARPEGGIO_COLUMNS: { label: string; types: string[] }[] = [
  { label: 'Major', types: ['Major', 'Major 7', 'Dominant 7', 'Augmented', 'Aug 7', 'Add9', 'Major 9', 'Dominant 9', 'Major 6', '7#9', '7♭9', '11', '13'] },
  { label: 'Minor', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'] },
  { label: 'Sus', types: ['Sus2', 'Sus4', '7sus4'] },
];

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
  tuning, tuningLabels,
  timelineChords, currentBeat, isPlaying, timelineKey, onApplyScale, keyMode,
  onSeekToChord, onSetArpeggioPosition,
}: ChordReferenceProps) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [voicingTab, setVoicingTab] = useState<VoicingTab>('full');
  const [activeTab, setActiveTab] = useState<MainTab>('chords');
  const [voicingPage, setVoicingPage] = useState(0);
  const [identifyViewName, setIdentifyViewName] = useState<string | null>(null);

  const VOICINGS_PER_PAGE = 4;

  const currentVoicings = useMemo(() => {
    if (!selectedChord) return [];
    const all = getVoicingsForChord(selectedRoot, selectedChord, voicingTab);
    const isStandard = tuning.every((n, i) => n === STANDARD_TUNING[i]);
    if (isStandard) return all;
    return all.filter(v => isVoicingPlayableInTuning(v, selectedRoot, selectedChord, tuning));
  }, [selectedRoot, selectedChord, voicingTab, tuning]);

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
      setActiveChord(null);
      setIdentifyFrets([-1, -1, -1, -1, -1, -1]);
      setIdentifyRoot(null);
      setIdentifyViewName(null);
    } else {
      setIdentifyMode(false);
    }
  };

  const currentIdentifyRoot = useMemo(() => {
    if (!identifyViewName || identifiedChords.length === 0) return null;
    const match = identifyViewName.match(/^([A-G]#?)/);
    return match ? match[1] as NoteName : null;
  }, [identifyViewName, identifiedChords]);

  return (
    <div className="p-2">
      {/* Tab switcher */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {([
          { key: 'chords' as MainTab, label: 'Chord Library' },
          { key: 'arpeggios' as MainTab, label: 'Arpeggio Positions' },
          { key: 'caged' as MainTab, label: 'CAGED' },
          { key: 'identify' as MainTab, label: "What's This?" },
          { key: 'changes' as MainTab, label: 'Playing Changes' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabSwitch(tab.key)}
            className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors flex items-center gap-0.5 ${
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

      {activeTab === 'changes' ? (
        <PlayingChangesPanel
          chords={timelineChords}
          currentBeat={currentBeat}
          isPlaying={isPlaying}
          timelineKey={timelineKey}
          keyMode={keyMode}
          onApplyScale={onApplyScale}
          onSeekToChord={onSeekToChord}
        />
      ) : activeTab === 'arpeggios' ? (
        <ArpeggioPositionsPanel onApplyScale={onApplyScale} tuning={tuning} onSetArpeggioPosition={onSetArpeggioPosition} />
      ) : activeTab === 'caged' ? (
        <CAGEDPanel positions={cagedPositions} cagedShape={cagedShape} setCagedShape={setCagedShape} root={cagedRoot} />
      ) : activeTab === 'identify' ? (
        <IdentifyPanel
          frets={identifyFrets}
          setFrets={setIdentifyFrets}
          results={identifiedChords}
          degreeColors={degreeColors}
          viewRoot={identifyViewName}
          setViewRoot={(name) => {
            setIdentifyViewName(name);
            if (name) {
              const match = name.match(/^([A-G]#?)/);
              if (match) setIdentifyRoot(match[1] as NoteName);
            } else {
              setIdentifyRoot(null);
            }
          }}
          currentRoot={currentIdentifyRoot}
          tuningLabels={tuningLabels}
          tuning={tuning}
        />
      ) : activeTab === 'chords' ? (
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
          tuning={tuning}
        />
      ) : null}
    </div>
  );
}

function formatCompactTab(frets: number[]): string {
  return frets.map(fret => {
    if (fret === -1) return 'X';
    if (fret === 0) return '0';
    return fret.toString(36).toUpperCase();
  }).join('').slice(0, 6);
}

// ============================================================
// CHORD LIBRARY PANEL
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
  tuning: number[];
}) {
  const VOICINGS_PER_PAGE = 4;

  const [libCopied, setLibCopied] = useState(false);

  const handleLibCopy = (v: ChordVoicing) => {
    navigator.clipboard.writeText(formatCompactTab(v.frets));
    setLibCopied(true);
    setTimeout(() => setLibCopied(false), 1500);
  };

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

      {/* Main layout */}
      <div className="flex gap-1.5">
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
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/chord', JSON.stringify({ root: selectedRoot, chordType: ct }));
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className={`w-full text-left px-1 py-0.5 rounded border text-[9px] font-mono transition-all truncate leading-tight ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]'
                                : 'bg-muted/60 border-border/30 text-foreground/80 hover:bg-muted hover:border-border/60'
                            }`}
                            title={`${ct} — drag to timeline`}
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
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="text-[7px] font-mono text-muted-foreground">
                            {formatCompactTab(v.frets)}
                          </span>
                          {isActive && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleLibCopy(v); }}
                              className="text-[7px] font-mono text-primary hover:text-primary/80 transition-colors"
                              title="Copy tab"
                            >{libCopied ? '✓' : '⎘'}</button>
                          )}
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
            <div className="text-[9px] font-mono text-muted-foreground text-center py-4 leading-relaxed">
              Select a chord type to see voicing diagrams. Drag any chord to the timeline.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// IDENTIFY PANEL
// ============================================================

function IdentifyPanel({
  frets, setFrets, results, degreeColors, viewRoot, setViewRoot, currentRoot, tuningLabels, tuning,
}: {
  frets: (number | -1)[];
  setFrets: (f: (number | -1)[]) => void;
  results: ReturnType<typeof identifyChord>;
  degreeColors: boolean;
  viewRoot: string | null;
  setViewRoot: (name: string | null) => void;
  currentRoot: NoteName | null;
  tuningLabels: string[];
  tuning: number[];
}) {
  return (
    <div>
      <div className="text-[9px] font-mono text-muted-foreground mb-2 leading-relaxed">
        Click notes on the fretboard to identify a chord. Drag across a fret for barre chords.
      </div>
      {/* Manual fret input */}
      <div className="flex gap-1 mb-2">
        {frets.map((f, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-mono text-muted-foreground">{tuningLabels[i]}</span>
            <input
              type="text"
              value={f === -1 ? 'X' : f.toString()}
              onChange={(e) => {
                const val = e.target.value.trim();
                const newFrets = [...frets];
                if (val === '' || val.toLowerCase() === 'x') newFrets[i] = -1;
                else if (!isNaN(Number(val))) newFrets[i] = Math.max(0, Math.min(24, Number(val)));
                setFrets(newFrets);
              }}
              className="w-7 h-6 text-center text-[10px] font-mono rounded border border-border bg-muted text-foreground"
            />
          </div>
        ))}
      </div>
      {/* Results */}
      {results.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Possible chords:</div>
          {results.map((r, i) => {
              const displayName = r.names?.[0] || '?';
              const isViewed = viewRoot === displayName;
            return (
              <button
                key={i}
                onClick={() => setViewRoot(isViewed ? null : displayName)}
                draggable
                onDragStart={(e) => {
                  const match = displayName.match(/^([A-G]#?)\s*(.*)/);
                  if (match) {
                    e.dataTransfer.setData('application/chord', JSON.stringify({ root: match[1], chordType: match[2] || 'Major' }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }
                }}
                className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-mono transition-all border ${
                  isViewed
                    ? 'bg-primary/15 border-primary/40 text-foreground'
                    : 'bg-muted/40 border-border/30 text-foreground/80 hover:bg-muted/60'
                }`}
              >
                <div className="font-bold">{displayName}</div>
                {r.notes && <div className="text-[8px] text-muted-foreground">{r.notes.join(' — ')}</div>}
              </button>
            );
          })}
        </div>
      ) : frets.some(f => f >= 0) ? (
        <div className="text-[10px] font-mono text-muted-foreground text-center py-2">
          No matching chord found. Try adding more notes.
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// PLAYING CHANGES PANEL
// ============================================================

function PlayingChangesPanel({
  chords, currentBeat, isPlaying, timelineKey, keyMode, onApplyScale, onSeekToChord,
}: {
  chords: TimelineChord[];
  currentBeat: number;
  isPlaying: boolean;
  timelineKey: NoteName;
  keyMode: KeyMode;
  onApplyScale: (root: NoteName, scale: string, mode: 'scale' | 'arpeggio') => void;
  onSeekToChord?: (beat: number) => void;
}) {
  const sorted = useMemo(() => [...chords].sort((a, b) => a.startBeat - b.startBeat), [chords]);

  const currentChord = useMemo(() => {
    return sorted.find(c => currentBeat >= c.startBeat && currentBeat < c.startBeat + c.duration) || null;
  }, [sorted, currentBeat]);

  const currentIdx = useMemo(() => {
    if (!currentChord) return -1;
    return sorted.findIndex(c => c.id === currentChord.id);
  }, [sorted, currentChord]);

  // Next chord wraps around to first chord
  const nextChord = useMemo(() => {
    if (sorted.length === 0) return null;
    if (currentIdx < 0) return sorted[0] || null;
    return sorted[(currentIdx + 1) % sorted.length] || null;
  }, [sorted, currentIdx]);

  const analysis = useMemo(() => {
    if (sorted.length === 0) return [];
    return analyzeProgression(timelineKey, keyMode, sorted.map(c => ({ root: c.root, chordType: c.chordType })));
  }, [sorted, timelineKey, keyMode]);

  const suggestions = useMemo(() => {
    if (!currentChord) return [];
    return getTensionSuggestions(timelineKey, currentChord.root, currentChord.chordType);
  }, [currentChord, timelineKey]);

  const chordTones = useMemo(() => {
    if (!currentChord) return [];
    return getChordTones(currentChord.root, currentChord.chordType);
  }, [currentChord]);

  const tensionColors: Record<string, string> = {
    consonant: '120, 70%, 40%',
    mild: '45, 80%, 50%',
    strong: '0, 75%, 55%',
  };

  const formatChordLabel = (c: TimelineChord) => {
    const suffix = c.chordType === 'Major' ? '' : c.chordType === 'Minor' ? 'm' : ` ${c.chordType}`;
    return `${c.root}${suffix}`;
  };

  if (chords.length === 0) {
    return (
      <div className="text-[10px] font-mono text-muted-foreground text-center py-6">
        Add chords to the timeline to see playing changes.
      </div>
    );
  }

  return (
    <div className="flex gap-2" style={{ minHeight: 0 }}>
      {/* Left: chord list with roman numerals */}
      <div className="w-20 shrink-0 space-y-0.5 overflow-y-auto max-h-[300px]">
        <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Progression</div>
        {sorted.map((chord, i) => {
          const a = analysis[i];
          const isCurrent = currentIdx === i;
          const borrowed = a && !a.isDiatonic;
          return (
            <button
              key={chord.id}
              onClick={() => onSeekToChord?.(chord.startBeat)}
              className={`w-full text-left px-1.5 py-1 rounded text-[10px] font-mono transition-all border cursor-pointer ${
                isCurrent
                  ? 'bg-primary/20 border-primary/50 text-foreground font-bold'
                  : 'border-transparent text-muted-foreground hover:bg-muted/30'
              }`}
              style={borrowed ? {
                backgroundColor: isCurrent ? 'hsl(50, 90%, 55%, 0.2)' : 'hsl(50, 90%, 55%, 0.08)',
                borderColor: isCurrent ? 'hsl(50, 90%, 55%, 0.5)' : 'transparent',
                boxShadow: isCurrent ? '0 0 6px hsl(50, 90%, 55%, 0.3)' : 'none',
              } : {}}
            >
              <div className="flex items-center gap-1">
                <span className={`font-bold ${borrowed ? 'text-yellow-400' : ''}`}>
                  {a?.roman || '?'}
                </span>
                <span className="text-[8px] truncate">{formatChordLabel(chord)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right: detail for current chord */}
      <div className="flex-1 min-w-0 overflow-y-auto max-h-[300px]">
        {currentChord && currentIdx >= 0 ? (
          <>
            <div className="text-lg font-mono font-bold text-foreground mb-1">
              {formatChordLabel(currentChord)}
              <span className="text-[10px] text-muted-foreground ml-2 font-normal">
                {analysis[currentIdx]?.roman} in {timelineKey} {keyMode}
              </span>
              {nextChord && (
                <span className="text-[9px] text-muted-foreground ml-2 font-normal">
                  → {formatChordLabel(nextChord)}
                </span>
              )}
            </div>

            {/* Analysis explanation */}
            {analysis[currentIdx] && (
              <div className={`text-[10px] font-mono leading-relaxed p-2 rounded mb-2 border ${
                analysis[currentIdx].isDiatonic
                  ? 'bg-muted/30 border-border/30 text-foreground/80'
                  : ''
              }`}
                style={!analysis[currentIdx].isDiatonic ? {
                  backgroundColor: 'hsl(50, 90%, 55%, 0.08)',
                  borderColor: 'hsl(50, 90%, 55%, 0.3)',
                  color: 'hsl(var(--foreground) / 0.8)',
                } : {}}
              >
                {!analysis[currentIdx].isDiatonic && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-bold mr-1"
                    style={{ backgroundColor: 'hsl(50, 90%, 55%, 0.3)', color: 'hsl(50, 70%, 35%)' }}>
                    NON-DIATONIC
                  </span>
                )}
                {analysis[currentIdx].explanation}
                {analysis[currentIdx].passingChordSuggestion && (
                  <div className="mt-1 text-[9px] text-primary italic">
                    💡 {analysis[currentIdx].passingChordSuggestion}
                  </div>
                )}
              </div>
            )}

            {/* Chord tones */}
            <div className="mb-2">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Chord Tones</div>
              <div className="flex gap-1">
                {chordTones.map((noteIdx, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-mono font-bold"
                    style={{
                      backgroundColor: 'hsl(var(--primary) / 0.2)',
                      color: 'hsl(var(--primary))',
                      border: '1px solid hsl(var(--primary) / 0.4)',
                    }}
                  >
                    {NOTE_NAMES[noteIdx]}
                  </div>
                ))}
              </div>
            </div>

            {/* Tension suggestions */}
            {suggestions.length > 0 && (
              <div>
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
                  Scales & Arpeggios
                </div>
                <div className="space-y-0.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onApplyScale(s.root, s.name, s.type)}
                      className="w-full text-left px-2 py-1 rounded text-[10px] font-mono transition-all border hover:brightness-110"
                      style={{
                        backgroundColor: `hsl(${tensionColors[s.tension]} / 0.1)`,
                        borderColor: `hsl(${tensionColors[s.tension]} / 0.3)`,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(${tensionColors[s.tension]})` }} />
                        <span className="font-bold text-foreground">{s.root} {s.name}</span>
                        <span className="text-[8px] px-1 py-0.5 rounded ml-auto shrink-0" style={{
                          backgroundColor: `hsl(${tensionColors[s.tension]} / 0.2)`,
                          color: `hsl(${tensionColors[s.tension]})`,
                        }}>
                          {s.type === 'arpeggio' ? 'ARP' : 'SCALE'}
                        </span>
                      </div>
                      <div className="text-[8px] text-muted-foreground mt-0.5 leading-tight pl-3">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-[10px] font-mono text-muted-foreground italic py-4">
            {isPlaying ? 'Rest — no chord playing' : 'Press play or click a chord to see analysis'}
          </div>
        )}
      </div>
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

function getChordTypeDescription(suffix: string): string {
  const descriptions: Record<string, string> = {
    '': 'Major triad — the bright, stable foundation of Western harmony. Built from root, major 3rd, and perfect 5th.',
    'm': 'Minor triad — darker, more melancholic than major. Uses a flatted 3rd for a sad or introspective quality.',
    'dim': 'Diminished triad — tense and unstable, with a flatted 3rd and flatted 5th. Wants to resolve.',
    'aug': 'Augmented triad — mysterious and unresolved, with a raised 5th creating a symmetrical structure.',
    'sus2': 'Suspended 2nd — the 3rd is replaced by a 2nd, creating an open, ambiguous sound. Neither major nor minor.',
    'sus4': 'Suspended 4th — the 3rd is replaced by a 4th, creating tension that wants to resolve to major or minor.',
    'maj7': 'Major 7th — lush and jazzy, adding the major 7th to a major triad. Common in jazz, R&B, and bossa nova.',
    'm7': 'Minor 7th — smooth and mellow, combining minor triad with a flatted 7th. Essential jazz voicing.',
    '7': 'Dominant 7th — bluesy tension from the flatted 7th over a major triad. Drives resolution to the tonic.',
    'dim7': 'Diminished 7th — maximally tense with stacked minor 3rds. Symmetrical — only 3 unique transpositions exist.',
    'm7♭5': 'Half-diminished 7th — a diminished triad with a minor 7th. The ii chord in minor key ii-V-i progressions.',
    'mMaj7': 'Minor-major 7th — haunting combination of minor triad with major 7th. Used in film noir and dramatic passages.',
    'aug7': 'Augmented 7th — dominant 7th with raised 5th. Creates strong altered dominant tension.',
    'add9': 'Add 9 — a triad with an added 9th (no 7th). Bright, shimmering sound popular in pop and rock.',
    'maj9': 'Major 9th — extends major 7th with the 9th. Very lush, sophisticated jazz harmony.',
    'm9': 'Minor 9th — minor 7th extended with the 9th. Smooth, neo-soul quality.',
    '9': 'Dominant 9th — dominant 7th with added 9th. Funky, soulful sound essential in R&B and funk.',
    '6': 'Major 6th — major triad with added 6th. Warm, vintage sound used in swing jazz and country.',
    'm6': 'Minor 6th — minor triad with major 6th. Bittersweet quality, used in jazz and bossa nova.',
    '7sus4': 'Dominant 7th sus4 — suspended 4th with a flatted 7th. Creates floating, unresolved tension.',
    '7#9': 'The "Hendrix chord" — dominant 7th with a sharp 9th. Gritty, bluesy, psychedelic rock staple.',
    '7♭9': 'Dominant 7th flat 9 — dark altered dominant used in jazz. Strong pull toward minor resolution.',
    '7#5': 'Dominant 7th sharp 5 — altered dominant with augmented 5th. Tense, wants to resolve.',
    '7♭5': 'Dominant 7th flat 5 — tritone substitution chord. The ♭5 creates maximum harmonic tension.',
    '11': 'Dominant 11th — stacked extensions creating a thick, modern sound. Often voiced without the 3rd.',
    'm11': 'Minor 11th — rich minor extension. The 11th adds openness to the minor 7th foundation.',
    '13': 'Dominant 13th — full extended dominant. The 13th adds color while maintaining dominant function.',
    'm13': 'Minor 13th — lush minor extension with the major 6th/13th on top. Complex, sophisticated.',
    '5': 'Power chord — just root and 5th. Neither major nor minor. The backbone of rock and metal.',
  };
  return descriptions[suffix] || '';
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
          const interval = showDegrees ? getIntervalName(root, note) : getExtendedIntervalName(root, note);
          const degColor = DEGREE_COLORS[interval];
          const fillColor = showDegrees && degColor ? `hsl(${degColor})` : 'hsl(var(--primary))';
          return <circle key={i} cx={x} cy={y} r={2.5} fill={fillColor} />;
        })}
      </svg>
    </div>
  );
}

// ============================================================
// ARPEGGIO POSITIONS PANEL
// ============================================================

function ArpeggioPositionsPanel({
  onApplyScale,
}: {
  onApplyScale: (root: NoteName, scale: string, mode: 'scale' | 'arpeggio') => void;
}) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [selectedArp, setSelectedArp] = useState<string | null>(null);
  const [octaveRange, setOctaveRange] = useState<OctaveRange>(1);

  const handleSelectArp = (arpType: string) => {
    if (selectedArp === arpType) {
      setSelectedArp(null);
    } else {
      setSelectedArp(arpType);
      onApplyScale(selectedRoot, arpType, 'arpeggio');
    }
  };

  const handleRootChange = (n: NoteName) => {
    setSelectedRoot(n);
    if (selectedArp) {
      onApplyScale(n, selectedArp, 'arpeggio');
    }
  };

  const splitIntoColumns = (types: string[]) => {
    const mid = Math.ceil(types.length / 2);
    return [types.slice(0, mid), types.slice(mid)];
  };

  const getArpDescription = (arpType: string): string => {
    const descs: Record<string, string> = {
      'Major': 'R-3-5 — bright, stable triad',
      'Minor': 'R-♭3-5 — dark, melancholic triad',
      'Diminished': 'R-♭3-♭5 — tense, unstable',
      'Augmented': 'R-3-#5 — symmetric, unresolved',
      'Sus2': 'R-2-5 — open, ambiguous',
      'Sus4': 'R-4-5 — suspended tension',
      'Major 7': 'R-3-5-7 — lush, jazzy',
      'Minor 7': 'R-♭3-5-♭7 — smooth, mellow',
      'Dominant 7': 'R-3-5-♭7 — bluesy tension',
      'Dim 7': 'R-♭3-♭5-♭♭7 — maximally tense',
      'Half-Dim 7': 'R-♭3-♭5-♭7 — minor ii-V-i',
      'Min/Maj 7': 'R-♭3-5-7 — haunting, dramatic',
      'Aug 7': 'R-3-#5-♭7 — altered dominant',
      'Major 9': 'R-3-5-7-9 — sophisticated jazz',
      'Minor 9': 'R-♭3-5-♭7-9 — neo-soul smooth',
      'Dominant 9': 'R-3-5-♭7-9 — funky, soulful',
      'Major 6': 'R-3-5-6 — warm, vintage',
      'Minor 6': 'R-♭3-5-6 — bittersweet',
      '7sus4': 'R-4-5-♭7 — floating, unresolved',
      'Add9': 'R-3-5-9 — bright shimmer',
      '7#9': 'R-3-5-♭7-#9 — Hendrix chord',
      '7♭9': 'R-3-5-♭7-♭9 — dark altered dom',
      '11': 'R-3-5-♭7-11 — thick, modern',
      'Minor 11': 'R-♭3-5-♭7-11 — open minor',
      '13': 'R-3-5-♭7-13 — full dominant',
      'Minor 13': 'R-♭3-5-♭7-13 — lush minor',
    };
    return descs[arpType] || arpType;
  };

  return (
    <>
      {/* Root selector */}
      <div className="flex flex-wrap gap-0.5 mb-2">
        {NOTE_NAMES.map(n => (
          <button
            key={n}
            onClick={() => handleRootChange(n)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
              n === selectedRoot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >{n}</button>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex gap-1.5">
        {/* Arpeggio columns */}
        <div className="flex gap-px shrink-0" style={{ width: '52%' }}>
          {ARPEGGIO_COLUMNS.map((col, ci) => {
            const isSus = col.label === 'Sus';
            const [col1, col2] = isSus ? [col.types, []] : splitIntoColumns(col.types);
            return (
              <div key={col.label} className={`flex-1 min-w-0 ${ci < ARPEGGIO_COLUMNS.length - 1 ? 'border-r border-border/40' : ''} px-0.5`}>
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center mb-1 font-bold">{col.label}</div>
                <div className={`flex gap-px ${isSus ? 'justify-center' : ''}`}>
                  {[col1, ...(col2.length > 0 ? [col2] : [])].map((types, sci) => (
                    <div key={sci} className={`${isSus ? 'w-full' : 'flex-1'} space-y-px`}>
                      {types.map(ct => {
                        if (!ARPEGGIO_FORMULAS[ct]) return null;
                        const isSelected = selectedArp === ct;
                        return (
                          <button
                            key={ct}
                            onClick={() => handleSelectArp(ct)}
                            className={`w-full text-left px-1 py-0.5 rounded border text-[9px] font-mono transition-all truncate leading-tight ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]'
                                : 'bg-muted/60 border-border/30 text-foreground/80 hover:bg-muted hover:border-border/60'
                            }`}
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

        {/* Octave range selector */}
        <div className="w-14 shrink-0">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center mb-1 font-bold">Octaves</div>
          <div className="space-y-0.5">
            {([1, 2, 3] as OctaveRange[]).map(oct => (
              <button
                key={oct}
                onClick={() => setOctaveRange(oct)}
                className={`w-full px-1 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider transition-colors leading-tight ${
                  octaveRange === oct ? 'bg-accent text-accent-foreground font-bold border-accent' : 'text-muted-foreground border-border/40 hover:bg-muted/30'
                }`}
              >{oct === 1 ? 'Single' : oct === 2 ? 'Double' : 'Triple'}</button>
            ))}
          </div>
          <div className="text-[7px] font-mono text-muted-foreground mt-1.5 text-center leading-tight">
            {octaveRange === 1 && '1 octave span'}
            {octaveRange === 2 && '2 octave span'}
            {octaveRange === 3 && '3 octave span'}
          </div>
        </div>

        {/* Info panel */}
        <div className="flex-1 min-w-0">
          {selectedArp ? (
            <div className="bg-secondary/20 rounded p-1.5">
              <div className="text-[10px] font-mono font-bold text-foreground mb-1">{selectedRoot} {selectedArp}</div>
              <div className="text-[9px] font-mono text-muted-foreground leading-relaxed mb-2">
                {getArpDescription(selectedArp)}
              </div>
              {/* Show arpeggio notes */}
              <div className="mb-1">
                <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Notes</div>
                <div className="flex gap-1 flex-wrap">
                  {(() => {
                    const formula = ARPEGGIO_FORMULAS[selectedArp];
                    if (!formula) return null;
                    const rootIdx = NOTE_NAMES.indexOf(selectedRoot);
                    const notes = formula.map(interval => NOTE_NAMES[(rootIdx + (interval % 12)) % 12]);
                    // For multi-octave, repeat
                    const displayed: string[] = [];
                    for (let oct = 0; oct < octaveRange; oct++) {
                      for (const n of notes) {
                        if (oct === 0 || n !== notes[0] || oct < octaveRange) {
                          displayed.push(oct > 0 ? `${n}′${'′'.repeat(oct - 1)}` : n);
                        }
                      }
                    }
                    // Add final root
                    if (octaveRange > 0) {
                      displayed.push(`${notes[0]}${'′'.repeat(octaveRange)}`);
                    }
                    return displayed.map((n, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-mono font-bold"
                        style={{
                          backgroundColor: 'hsl(var(--primary) / 0.2)',
                          color: 'hsl(var(--primary))',
                          border: '1px solid hsl(var(--primary) / 0.4)',
                        }}
                      >{n}</div>
                    ));
                  })()}
                </div>
              </div>
              <div className="text-[8px] font-mono text-muted-foreground mt-1">
                {octaveRange === 1 ? 'Single octave — 1 position' : octaveRange === 2 ? 'Double octave — spans 2 positions' : 'Triple octave — full neck coverage'}
              </div>
            </div>
          ) : (
            <div className="text-[9px] font-mono text-muted-foreground text-center py-4 leading-relaxed">
              Select an arpeggio type to see its notes and apply it to the fretboard.
            </div>
          )}
        </div>
      </div>
    </>
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
