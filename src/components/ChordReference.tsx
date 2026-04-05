import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import BeginnerModePanel from './BeginnerMode';
import TabVisualiser from './TabVisualiser';
import type { TabNote } from './TabVisualiser';
import {
  NOTE_NAMES, NoteName, CHORD_FORMULAS, STANDARD_TUNING,
  getVoicingsForChord, noteAtFret, getExtendedIntervalName, DEGREE_COLORS,
  getCAGEDPositions, getIntervalName, CHORD_GROUPS, identifyChord,
  isVoicingPlayableInTuning, getTensionSuggestions, getChordTones,
  analyzeProgression, identifyArpeggioFromNotes,
  SCALE_FORMULAS, ARPEGGIO_FORMULAS, generateArpeggioPositions,
  getDiatonicChords, generate7thInversions, scaleToKeyMode, get7thChordType, get7thChordSymbol,
  STRING_GROUP_CONFIG, SCALE_DEGREE_COLORS,
  type ChordVoicing, type TensionSuggestion, type KeyMode, type ChordAnalysis,
  type ArpeggioPosition, type StringGroup, type InversionVoicing,
} from '@/lib/music';
import type { ChordSelection } from '@/hooks/useFretboard';
import type { TimelineChord } from '@/hooks/useSongTimeline';

// Natural notes starting from E
const NATURAL_NOTES: NoteName[] = ['E', 'F', 'G', 'A', 'B', 'C', 'D'];

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
  arpOverlayOpacity: number;
  setArpOverlayOpacity: (v: number) => void;
  arpPathVisible: boolean;
  setArpPathVisible: (v: boolean) => void;
  // Arpeggio add mode callback — fretboard click routing
  onArpAddClick?: (stringIndex: number, fret: number) => void;
  arpAddMode?: boolean;
  setArpAddMode?: (v: boolean) => void;
  arpAddClickRef?: React.MutableRefObject<((si: number, fret: number) => void) | null>;
  arpBarreDragRef?: React.MutableRefObject<((fromSi: number, toSi: number, fret: number) => void) | null>;
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  primaryScale: { mode: 'scale' | 'arpeggio'; root: NoteName; scale: string };
  scaleViewDegreeFilter: number | null;
  setScaleViewDegreeFilter: (d: number | null) => void;
  scaleViewMode: 'basic' | 'inversion';
  setScaleViewMode: (m: 'basic' | 'inversion') => void;
  inversionStringGroup: StringGroup;
  setInversionStringGroup: (g: StringGroup) => void;
  onSetInversionVoicing?: (v: InversionVoicing | null) => void;
  ghostNoteOpacity: number;
  setGhostNoteOpacity: (v: number) => void;
  onApplyBeginnerPreset?: (preset: { root: NoteName; scale: string; fretBoxStart: number; fretBoxSize: number } | null) => void;
  onApplyOpenChord?: (frets: (number | -1)[], fingers: string[]) => void;
  onTabNotes?: (current: TabNote[], upcoming: TabNote[][]) => void;
  tabVisData: import('./TabVisualiser').TabData | null;
  setTabVisData: (d: import('./TabVisualiser').TabData | null) => void;
  tabVisPlayhead: number;
  setTabVisPlayhead: (p: number | ((prev: number) => number)) => void;
  setShowFretBox?: (v: boolean) => void;
  setFretBoxStart?: (v: number) => void;
  setFretBoxSize?: (v: number) => void;
}

type VoicingTab = 'full' | 'shell' | 'drop2' | 'drop3' | 'triads';
type MainTab = 'beginner' | 'scaleview' | 'chords' | 'arpeggios' | 'caged' | 'identify' | 'changes' | 'tabvis';
type OctaveRange = 1 | 2 | 3;

const ARPEGGIO_COLUMNS: { label: string; types: string[] }[] = [
  { label: 'Major', types: ['Major', 'Major 7', 'Major 7♭5', 'Dominant 7', 'Augmented', 'Aug 7', 'Add9', 'Major 9', 'Dominant 9', 'Major 6', '7#9', '7♭9', '11', '13'] },
  { label: 'Minor', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'] },
  { label: 'Sus', types: ['Sus2', 'Sus4', '7sus4', '7sus4♭9'] },
];

const CHORD_COLUMNS: { label: string; types: string[] }[] = [
  { label: 'Major', types: ['Major', 'Major 7', 'Major 7♭5', 'Dominant 7', 'Augmented', 'Aug 7', 'Add9', 'Major 9', 'Dominant 9', 'Major 6', '7#9', '7♭9', '7#5', '7♭5', '11', '13'] },
  { label: 'Minor', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'] },
  { label: 'Sus', types: ['Sus2', 'Sus4', '7sus4', '7sus4♭9', 'Power (5)'] },
];

// ============================================================
// ROOT SELECTOR with clickable ♭/♯ buttons
// ============================================================

function RootSelector({ selectedRoot, setSelectedRoot }: { selectedRoot: NoteName; setSelectedRoot: (n: NoteName) => void }) {
  const [baseNote, setBaseNote] = useState<NoteName>(() => {
    if (NATURAL_NOTES.includes(selectedRoot)) return selectedRoot;
    const idx = NOTE_NAMES.indexOf(selectedRoot);
    const flatBase = NOTE_NAMES[(idx + 1) % 12];
    if (NATURAL_NOTES.includes(flatBase as NoteName)) return flatBase as NoteName;
    return 'E';
  });
  const [accidental, setAccidental] = useState<'natural' | 'sharp' | 'flat'>(() => {
    if (NATURAL_NOTES.includes(selectedRoot)) return 'natural';
    const idx = NOTE_NAMES.indexOf(selectedRoot);
    for (const n of NATURAL_NOTES) {
      const ni = NOTE_NAMES.indexOf(n);
      if ((ni + 1) % 12 === idx) return 'sharp';
    }
    return 'flat';
  });

  const resolveNote = useCallback((base: NoteName, acc: 'natural' | 'sharp' | 'flat'): NoteName => {
    const idx = NOTE_NAMES.indexOf(base);
    if (acc === 'sharp') return NOTE_NAMES[(idx + 1) % 12];
    if (acc === 'flat') return NOTE_NAMES[(idx + 11) % 12];
    return base;
  }, []);

  const handleNoteClick = (n: NoteName) => {
    setBaseNote(n);
    setAccidental('natural');
    setSelectedRoot(n);
  };

  const handleAccidental = (acc: 'sharp' | 'flat') => {
    const newAcc = accidental === acc ? 'natural' : acc;
    setAccidental(newAcc);
    setSelectedRoot(resolveNote(baseNote, newAcc));
  };

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-0.5 items-end">
        {NATURAL_NOTES.map(n => {
          const isBase = n === baseNote;
          return (
            <div key={n} className="flex flex-col items-center">
              <button
                onClick={() => handleNoteClick(n)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                  isBase ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >{n}</button>
              {isBase && (
                <div className="mt-0.5 flex gap-px">
                  <button
                    onClick={() => handleAccidental('flat')}
                    className={`w-5 h-4 rounded-l border text-[9px] font-mono font-bold transition-colors ${
                      accidental === 'flat'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >♭</button>
                  <button
                    onClick={() => handleAccidental('sharp')}
                    className={`w-5 h-4 rounded-r border border-l-0 text-[9px] font-mono font-bold transition-colors ${
                      accidental === 'sharp'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >♯</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default function ChordReference({
  activeChord, setActiveChord, showCAGED, setShowCAGED,
  cagedShape, setCagedShape, cagedRoot,
  identifyMode, setIdentifyMode, identifyFrets, setIdentifyFrets,
  degreeColors, identifyRoot, setIdentifyRoot,
  tuning, tuningLabels,
  timelineChords, currentBeat, isPlaying, timelineKey, onApplyScale, keyMode,
  onSeekToChord, onSetArpeggioPosition,
  arpOverlayOpacity, setArpOverlayOpacity, arpPathVisible, setArpPathVisible,
  onArpAddClick, arpAddMode, setArpAddMode, arpAddClickRef, arpBarreDragRef,
  activeTab, setActiveTab,
  primaryScale, scaleViewDegreeFilter, setScaleViewDegreeFilter,
  scaleViewMode, setScaleViewMode, inversionStringGroup, setInversionStringGroup,
  onSetInversionVoicing,
  ghostNoteOpacity, setGhostNoteOpacity,
  onApplyBeginnerPreset, onApplyOpenChord, onTabNotes,
  tabVisData, setTabVisData, tabVisPlayhead, setTabVisPlayhead,
  setShowFretBox, setFretBoxStart, setFretBoxSize,
}: ChordReferenceProps) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('E');
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [voicingTab, setVoicingTab] = useState<VoicingTab>('full');
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
    onSetArpeggioPosition?.(null);
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
    onSetArpeggioPosition?.(null);
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
    if (tab !== 'beginner') onApplyBeginnerPreset?.(null);
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
    if (tab !== 'arpeggios' && tab !== 'scaleview') {
      onSetArpeggioPosition?.(null);
    }
    if (tab !== 'scaleview') {
      setScaleViewDegreeFilter(null);
    }
    if (tab === 'scaleview') {
      setActiveChord(null);
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
          { key: 'beginner' as MainTab, label: '🎓 Beginner' },
          { key: 'scaleview' as MainTab, label: 'Scale View' },
          { key: 'chords' as MainTab, label: 'Chord Library' },
          { key: 'arpeggios' as MainTab, label: 'Arpeggio Positions' },
          { key: 'caged' as MainTab, label: 'CAGED' },
          { key: 'identify' as MainTab, label: "What's This?" },
          { key: 'changes' as MainTab, label: 'Progression Analyser' },
          { key: 'tabvis' as MainTab, label: 'Tab Visualiser' },
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

      {activeTab === 'beginner' ? (
        <BeginnerModePanel
          onApplyPreset={onApplyBeginnerPreset}
          onApplyOpenChord={onApplyOpenChord}
        />
      ) : activeTab === 'scaleview' ? (
        <ScaleViewPanel
          primaryScale={primaryScale}
          degreeFilter={scaleViewDegreeFilter}
          setDegreeFilter={setScaleViewDegreeFilter}
          scaleViewMode={scaleViewMode}
          setScaleViewMode={setScaleViewMode}
          inversionStringGroup={inversionStringGroup}
          setInversionStringGroup={setInversionStringGroup}
          tuning={tuning}
          onSetArpeggioPosition={onSetArpeggioPosition}
          degreeColors={degreeColors}
          onSetInversionVoicing={onSetInversionVoicing}
          ghostNoteOpacity={ghostNoteOpacity}
          setGhostNoteOpacity={setGhostNoteOpacity}
        />
      ) : activeTab === 'changes' ? (
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
        <ArpeggioPositionsPanel
          onApplyScale={onApplyScale}
          tuning={tuning}
          onSetArpeggioPosition={onSetArpeggioPosition}
          arpOverlayOpacity={arpOverlayOpacity}
          setArpOverlayOpacity={setArpOverlayOpacity}
          arpPathVisible={arpPathVisible}
          setArpPathVisible={setArpPathVisible}
          arpAddMode={arpAddMode}
          setArpAddMode={setArpAddMode}
          arpAddClickRef={arpAddClickRef}
        />
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
          onSetArpeggioPosition={onSetArpeggioPosition}
          setShowFretBox={setShowFretBox}
          setFretBoxStart={setFretBoxStart}
          setFretBoxSize={setFretBoxSize}
          arpOverlayOpacity={arpOverlayOpacity}
          setArpOverlayOpacity={setArpOverlayOpacity}
          onClearFretboard={() => {
            setIdentifyFrets([-1, -1, -1, -1, -1, -1]);
            setIdentifyRoot(null);
            setIdentifyViewName(null);
            onSetArpeggioPosition?.(null);
            setShowFretBox?.(false);
          }}
        />
      ) : activeTab === 'chords' ? (
        <ChordLibraryPanel
          selectedRoot={selectedRoot}
          setSelectedRoot={(n) => { setSelectedRoot(n); setVoicingPage(0); onSetArpeggioPosition?.(null); if (selectedChord) { const voicings = getVoicingsForChord(n, selectedChord, voicingTab); if (voicings.length > 0) { setActiveChord({ root: n, chordType: selectedChord, voicingIndex: 0, voicingSource: voicingTab }); } else { setActiveChord(null); } } }}
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
          arpAddClickRef={arpAddClickRef}
          arpBarreDragRef={arpBarreDragRef}
          setArpAddMode={setArpAddMode}
          arpAddMode={arpAddMode}
          setActiveChord={setActiveChord}
          onSetArpeggioPosition={onSetArpeggioPosition}
        />
      ) : activeTab === 'tabvis' ? (
        <TabVisualiser
          tuning={tuning}
          tuningLabels={tuningLabels}
          onTabNotes={onTabNotes}
          tabData={tabVisData}
          setTabData={setTabVisData}
          playheadPos={tabVisPlayhead}
          setPlayheadPos={setTabVisPlayhead}
        />
      ) : null}
    </div>
  );
}

// ============================================================
// SCALE VIEW PANEL
// ============================================================

// Mini chord diagram for inversion voicings
function MiniChordDiagram({ voicing, stringGroup, isActive, color, onClick }: {
  voicing: InversionVoicing;
  stringGroup: StringGroup;
  isActive: boolean;
  color: string;
  onClick: () => void;
}) {
  const config = STRING_GROUP_CONFIG[stringGroup];
  const activeStrings = config.strings;
  const activeFrets = activeStrings.map(s => voicing.frets[s]).filter(f => f >= 0);
  if (activeFrets.length === 0) return null;
  const minFret = Math.min(...activeFrets);
  const maxFret = Math.max(...activeFrets);
  const startFret = Math.max(1, minFret - 1);
  const endFret = Math.max(startFret + 3, maxFret + 1);
  const numFrets = endFret - startFret + 1;
  const cellSize = 22;
  const w = 4 * cellSize + 30;
  const h = numFrets * cellSize + 40;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center transition-all rounded-lg"
      style={{
        border: isActive ? `3px solid hsl(${color})` : '2px solid hsla(var(--border), 0.3)',
        backgroundColor: isActive ? `hsla(${color}, 0.15)` : 'hsla(var(--secondary), 0.5)',
        padding: 4,
        aspectRatio: '1',
        width: 110,
        minWidth: 110,
        minHeight: 110,
      }}
    >
      <div className="text-[11px] font-mono font-bold mb-0.5 leading-tight" style={{ color: `hsl(${color})` }}>
        {voicing.slashName}
      </div>
      {voicing.alternateName && (
        <div className="text-[9px] font-mono opacity-70 mb-0.5" style={{ color: `hsl(${color})` }}>
          {voicing.alternateName}
        </div>
      )}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-1">
        <text x={4} y={20} fontSize={10} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
        {[0, 1, 2, 3].map(si => (
          <line key={`s${si}`} x1={22 + si * cellSize} y1={16} x2={22 + si * cellSize} y2={16 + numFrets * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} strokeOpacity={0.5} />
        ))}
        {Array.from({ length: numFrets + 1 }, (_, i) => (
          <line key={`f${i}`} x1={22} y1={16 + i * cellSize} x2={22 + 3 * cellSize} y2={16 + i * cellSize}
            stroke="hsl(var(--muted-foreground))" strokeWidth={i === 0 ? 2 : 0.5} strokeOpacity={0.5} />
        ))}
        {activeStrings.map((si, idx) => {
          const fret = voicing.frets[si];
          if (fret < 0) return null;
          const fretPos = fret - startFret;
          return (
            <circle key={`n${idx}`}
              cx={22 + idx * cellSize}
              cy={16 + fretPos * cellSize + cellSize / 2}
              r={8}
              fill={`hsl(${color})`}
              opacity={0.9}
            />
          );
        })}
      </svg>
      <div className="text-[9px] font-mono mt-0.5 leading-tight text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {voicing.degreeOrder}
      </div>
    </button>
  );
}

function ScaleViewPanel({
  primaryScale, degreeFilter, setDegreeFilter,
  scaleViewMode, setScaleViewMode,
  inversionStringGroup, setInversionStringGroup,
  tuning, onSetArpeggioPosition, degreeColors,
  onSetInversionVoicing,
  ghostNoteOpacity, setGhostNoteOpacity,
}: {
  primaryScale: { mode: 'scale' | 'arpeggio'; root: NoteName; scale: string };
  degreeFilter: number | null;
  setDegreeFilter: (d: number | null) => void;
  scaleViewMode: 'basic' | 'inversion';
  setScaleViewMode: (m: 'basic' | 'inversion') => void;
  inversionStringGroup: StringGroup;
  setInversionStringGroup: (g: StringGroup) => void;
  tuning: number[];
  onSetArpeggioPosition?: (pos: ArpeggioPosition | null) => void;
  degreeColors: boolean;
  onSetInversionVoicing?: (v: InversionVoicing | null) => void;
  ghostNoteOpacity: number;
  setGhostNoteOpacity: (v: number) => void;
}) {
  const keyMode = scaleToKeyMode(primaryScale.scale);
  const diatonicChords = useMemo(() => getDiatonicChords(primaryScale.root, keyMode), [primaryScale.root, keyMode]);

  const [currentInvIdx, setCurrentInvIdx] = useState(0);

  // Build 7th chord labels for each diatonic chord
  const diatonicLabels = useMemo(() => diatonicChords.map((chord, i) => {
    const chordType7 = get7thChordType(chord.type, i + 1, keyMode);
    const suffix = get7thChordSymbol(chord.type, i + 1, keyMode);
    return { ...chord, label7: `${chord.root}${suffix}`, chordType7 };
  }), [diatonicChords]);

  const inversions = useMemo(() => {
    if (scaleViewMode !== 'inversion' || degreeFilter === null) return [];
    const chord = diatonicLabels[degreeFilter];
    if (!chord) return [];
    return generate7thInversions(chord.root, chord.chordType7, inversionStringGroup, tuning);
  }, [scaleViewMode, degreeFilter, diatonicLabels, inversionStringGroup, tuning]);

  useEffect(() => {
    setCurrentInvIdx(0);
  }, [inversions]);




  // Octave shift for inversions
  const [octaveShift, setOctaveShift] = useState(0);

  // Apply octave shift to inversion voicing
  useEffect(() => {
    if (scaleViewMode === 'inversion' && inversions.length > 0) {
      const idx = Math.min(currentInvIdx, inversions.length - 1);
      const baseInv = inversions[idx];
      if (octaveShift === 0) {
        onSetInversionVoicing?.(baseInv);
      } else {
        // Shift all frets by 12 * octaveShift
        const shifted = {
          ...baseInv,
          frets: baseInv.frets.map(f => f < 0 ? f : Math.max(0, Math.min(24, f + octaveShift * 12))),
          notes: baseInv.notes.map(n => ({ ...n, fret: Math.max(0, Math.min(24, n.fret + octaveShift * 12)) })),
        };
        onSetInversionVoicing?.(shifted);
      }
    } else {
      onSetInversionVoicing?.(null);
    }
  }, [scaleViewMode, inversions, currentInvIdx, onSetInversionVoicing, octaveShift]);

  // Reset octave shift when inversions change
  useEffect(() => {
    setOctaveShift(0);
  }, [inversions]);

  const activeColor = degreeFilter !== null ? SCALE_DEGREE_COLORS[degreeFilter] : null;

  return (
    <div className="space-y-2">
      {/* Mode buttons + Ghost slider */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => { setScaleViewMode('basic'); onSetInversionVoicing?.(null); }}
          className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
            scaleViewMode === 'basic' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary text-secondary-foreground'
          }`}
        >🎵 Basic</button>
        <button
          onClick={() => setScaleViewMode('inversion')}
          className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
            scaleViewMode === 'inversion' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary text-secondary-foreground'
          }`}
        >🎹 Inversions</button>

        {/* Ghost note slider - always visible, compact */}
        <div className="flex items-center gap-0.5 ml-1">
          <span className="text-[7px] font-mono text-muted-foreground">👻</span>
          <input
            type="range" min={0} max={100} step={1}
            value={Math.round(ghostNoteOpacity * 100)}
            onChange={e => setGhostNoteOpacity(Number(e.target.value) / 100)}
            className="w-12 accent-primary h-0.5"
          />
          <span className="text-[7px] font-mono text-muted-foreground w-5">{Math.round(ghostNoteOpacity * 100)}%</span>
        </div>
      </div>

      {/* Degree buttons - BIG and colourful */}
      <div className="grid grid-cols-7 gap-1">
        {diatonicLabels.map((chord, i) => {
          const isActive = degreeFilter === i;
          const color = SCALE_DEGREE_COLORS[i];
          return (
            <button
              key={i}
              onClick={() => setDegreeFilter(isActive ? null : i)}
              className="rounded-xl font-bold transition-all flex flex-col items-center justify-center py-3 px-1"
              style={{
                backgroundColor: isActive ? `hsla(${color}, 0.15)` : `hsl(${color})`,
                border: isActive ? `3px solid hsl(${color})` : `2px solid hsl(${color})`,
                color: isActive ? `hsl(${color})` : '#000',
                boxShadow: isActive ? `0 0 14px hsla(${color}, 0.6), inset 0 0 8px hsla(${color}, 0.2)` : 'none',
                minHeight: 60,
              }}
            >
              <span className="text-[14px] font-black">{chord.roman}</span>
              <span className="text-[9px] font-mono opacity-80">{chord.label7}</span>
            </button>
          );
        })}
      </div>

      {/* Inversion mode content */}
      {scaleViewMode === 'inversion' && (
        <div>
          {/* String group buttons - below degree buttons */}
          <div className="flex items-center gap-1 mb-2">
            {(['upper', 'mid', 'lower'] as StringGroup[]).map(sg => (
              <button
                key={sg}
                onClick={() => setInversionStringGroup(sg)}
                className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${
                  inversionStringGroup === sg
                    ? 'bg-accent text-accent-foreground shadow-md'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >{STRING_GROUP_CONFIG[sg].label}</button>
            ))}
          </div>

          {degreeFilter !== null && inversions.length > 0 && (
            <div className="flex gap-0.5 items-stretch">
              {/* Voicing diagrams - 5 across, tight */}
              <div
                className="flex gap-0.5 shrink-0"
                style={{
                  backgroundColor: activeColor ? `hsla(${activeColor}, 0.08)` : 'hsla(var(--secondary), 0.3)',
                  border: activeColor ? `1px solid hsla(${activeColor}, 0.3)` : undefined,
                  borderRadius: 12,
                  padding: 4,
                }}
              >
                {inversions.map((inv, idx) => (
                  <MiniChordDiagram
                    key={idx}
                    voicing={inv}
                    stringGroup={inversionStringGroup}
                    isActive={currentInvIdx === idx}
                    color={activeColor || '0, 0%, 60%'}
                    onClick={() => setCurrentInvIdx(idx)}
                  />
                ))}
              </div>

              {/* Active inversion info - fills remaining space */}
              {inversions[Math.min(currentInvIdx, inversions.length - 1)] && (() => {
                const activeInv = inversions[Math.min(currentInvIdx, inversions.length - 1)];
                return (
                  <div
                    className="rounded-xl p-3 flex-1 min-w-0 transition-all flex flex-col justify-between"
                    style={{
                      backgroundColor: activeColor ? `hsla(${activeColor}, 0.12)` : 'hsla(var(--secondary), 0.3)',
                      border: activeColor ? `2px solid hsla(${activeColor}, 0.4)` : undefined,
                    }}
                  >
                    <div>
                      <div className="text-[16px] font-bold leading-tight" style={{ color: activeColor ? `hsl(${activeColor})` : undefined }}>
                        {activeInv.slashName}
                        {activeInv.alternateName && <span className="ml-2 opacity-70 font-normal text-[12px]">{activeInv.alternateName}</span>}
                      </div>
                      <div className="text-[12px] font-mono text-muted-foreground mt-1">
                        {activeInv.inversionLabel}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {activeInv.bottomDegree}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {activeInv.topDegree}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono mt-1 opacity-60">
                        {activeInv.degreeOrder}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="text-[14px] font-mono font-bold" style={{ color: activeColor ? `hsl(${activeColor})` : undefined }}>
                          {activeInv.tab}
                        </div>
                        {/* Octave up/down buttons */}
                        <div className="flex gap-1 ml-auto">
                          <button
                            onClick={() => setOctaveShift(prev => {
                              const next = prev - 1;
                              // Check if shifting down would put any note below fret 0
                              const idx = Math.min(currentInvIdx, inversions.length - 1);
                              const baseInv = inversions[idx];
                              if (baseInv) {
                                const minFret = Math.min(...baseInv.frets.filter(f => f >= 0));
                                if (minFret + next * 12 < 0) return prev;
                              }
                              return next;
                            })}
                            disabled={(() => {
                              const idx = Math.min(currentInvIdx, inversions.length - 1);
                              const baseInv = inversions[idx];
                              if (!baseInv) return true;
                              const minFret = Math.min(...baseInv.frets.filter(f => f >= 0));
                              return minFret + (octaveShift - 1) * 12 < 0;
                            })()}
                            className="w-7 h-7 rounded flex items-center justify-center text-[16px] font-bold bg-secondary text-secondary-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                            title="Octave down"
                          >−</button>
                          <button
                            onClick={() => setOctaveShift(prev => {
                              const next = prev + 1;
                              const idx = Math.min(currentInvIdx, inversions.length - 1);
                              const baseInv = inversions[idx];
                              if (baseInv) {
                                const maxFret = Math.max(...baseInv.frets.filter(f => f >= 0));
                                if (maxFret + next * 12 > 24) return prev;
                              }
                              return next;
                            })}
                            disabled={(() => {
                              const idx = Math.min(currentInvIdx, inversions.length - 1);
                              const baseInv = inversions[idx];
                              if (!baseInv) return true;
                              const maxFret = Math.max(...baseInv.frets.filter(f => f >= 0));
                              return maxFret + (octaveShift + 1) * 12 > 24;
                            })()}
                            className="w-7 h-7 rounded flex items-center justify-center text-[16px] font-bold bg-secondary text-secondary-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                            title="Octave up"
                          >+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {degreeFilter !== null && inversions.length === 0 && (
            <div className="text-[10px] font-mono text-muted-foreground italic p-2">No inversions available for this chord type</div>
          )}
          {degreeFilter === null && (
            <div className="text-[10px] font-mono text-muted-foreground italic p-2">👆 Select a degree above to view inversions</div>
          )}
        </div>
      )}

      {scaleViewMode === 'basic' && degreeFilter === null && (
        <div className="text-[10px] font-mono text-muted-foreground italic p-2">👆 Select a degree to highlight its chord tones on the fretboard</div>
      )}
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
  tuning,
  arpAddClickRef, arpBarreDragRef, setArpAddMode, arpAddMode,
  setActiveChord, onSetArpeggioPosition,
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
  arpAddClickRef?: React.MutableRefObject<((si: number, fret: number) => void) | null>;
  arpBarreDragRef?: React.MutableRefObject<((fromSi: number, toSi: number, fret: number) => void) | null>;
  setArpAddMode?: (v: boolean) => void;
  arpAddMode?: boolean;
  setActiveChord: (c: ChordSelection | null) => void;
  onSetArpeggioPosition?: (pos: ArpeggioPosition | null) => void;
}) {
  const VOICINGS_PER_PAGE = 4;
  const [libCopied, setLibCopied] = useState(false);
  const [addingBarre, setAddingBarre] = useState<{ from: number; to: number; fret: number } | null>(null);

  // Custom chord voicing state
  const [customChordVoicings, setCustomChordVoicings] = useState<Record<string, {frets: number[], refRoot: NoteName, barreFrom?: number, barreTo?: number, barreFret?: number}[]>>(() => {
    try { return JSON.parse(localStorage.getItem('mf-custom-chord-voicings') || '{}'); } catch { return {}; }
  });
  const [chordAddMode, setChordAddMode] = useState(false);
  const [addingFrets, setAddingFrets] = useState<(number | -1)[]>([-1,-1,-1,-1,-1,-1]);

  // Transpose custom voicings for current root
  const customForRoot = useMemo((): ChordVoicing[] => {
    if (!selectedChord) return [];
    const customs = customChordVoicings[selectedChord] || [];
    return customs.map(cv => {
      const refIdx = NOTE_NAMES.indexOf(cv.refRoot);
      const targetIdx = NOTE_NAMES.indexOf(selectedRoot);
      const delta = (targetIdx - refIdx + 12) % 12;
      const transposed = cv.frets.map(f => f < 0 ? -1 : f + delta);
      return {
        frets: transposed.map(f => f < 0 ? -1 : f > 24 ? f - 12 : f),
        fingers: null,
        barreFrom: cv.barreFrom,
        barreTo: cv.barreTo,
        barreFret: cv.barreFret != null ? cv.barreFret + delta : undefined,
      } as ChordVoicing;
    });
  }, [selectedChord, selectedRoot, customChordVoicings]);

  const mergedVoicings = useMemo(() => [...currentVoicings, ...customForRoot], [currentVoicings, customForRoot]);
  const mergedTotalPages = Math.ceil(mergedVoicings.length / VOICINGS_PER_PAGE);
  const mergedPagedVoicings = mergedVoicings.slice(voicingPage * VOICINGS_PER_PAGE, (voicingPage + 1) * VOICINGS_PER_PAGE);

  const detectFallbackBarre = useCallback((frets: (number | -1)[]) => {
    let best: { from: number; to: number; fret: number } | null = null;
    for (let start = 0; start < frets.length; start += 1) {
      const fret = frets[start];
      if (fret < 1) continue;
      let end = start;
      while (end + 1 < frets.length && frets[end + 1] === fret) end += 1;
      if (end > start) {
        const candidate = { from: start, to: end, fret };
        if (!best || candidate.to - candidate.from > best.to - best.from) best = candidate;
      }
    }
    return best;
  }, []);

  const buildStaticVoicingPosition = useCallback((frets: (number | -1)[], label: string, barre: { from: number; to: number; fret: number } | null) => {
    const notes = frets.map((f, si) => f >= 0 ? { stringIndex: si, fret: f } : null).filter(Boolean) as { stringIndex: number; fret: number }[];
    if (notes.length === 0) return null;
    const playedFrets = notes.filter(n => n.fret > 0).map(n => n.fret);
    if (barre && barre.fret > 0) playedFrets.push(barre.fret);
    return {
      notes,
      label,
      startFret: playedFrets.length > 0 ? Math.min(...playedFrets) : 0,
      type: 'static' as const,
      showPath: false,
      frets: [...frets] as (number | -1)[],
      ...(barre ? { barreFrom: barre.from, barreTo: barre.to, barreFret: barre.fret } : {}),
    };
  }, []);

  // Register click handler for add mode
  useEffect(() => {
    if (!arpAddClickRef || !chordAddMode) return;
    arpAddClickRef.current = (si: number, fret: number) => {
      setAddingFrets(prev => {
        const next = [...prev];
        if (next[si] === fret) next[si] = -1;
        else next[si] = fret;
        return next;
      });
    };
    return () => { if (arpAddClickRef) arpAddClickRef.current = null; };
  }, [chordAddMode, arpAddClickRef]);

  useEffect(() => {
    if (!arpBarreDragRef || !chordAddMode) return;
    arpBarreDragRef.current = (fromSi: number, toSi: number, fret: number) => {
      const from = Math.min(fromSi, toSi);
      const to = Math.max(fromSi, toSi);
      setAddingBarre({ from, to, fret });
      setAddingFrets(prev => {
        const next = [...prev];
        for (let s = from; s <= to; s += 1) {
          if (next[s] === -1 || next[s] < fret) next[s] = fret;
        }
        return next;
      });
    };
    return () => { if (arpBarreDragRef) arpBarreDragRef.current = null; };
  }, [chordAddMode, arpBarreDragRef]);

  useEffect(() => {
    if (!addingBarre) return;
    const coveredStrings: number[] = [];
    for (let s = addingBarre.from; s <= addingBarre.to; s += 1) {
      if (addingFrets[s] >= addingBarre.fret) coveredStrings.push(s);
    }
    if (coveredStrings.length < 2) {
      setAddingBarre(null);
      return;
    }
    const nextFrom = coveredStrings[0];
    const nextTo = coveredStrings[coveredStrings.length - 1];
    if (nextFrom !== addingBarre.from || nextTo !== addingBarre.to) {
      setAddingBarre({ ...addingBarre, from: nextFrom, to: nextTo });
    }
  }, [addingBarre, addingFrets]);

  // Show adding notes on fretboard via ArpeggioPosition
  useEffect(() => {
    if (chordAddMode) {
      const preview = buildStaticVoicingPosition(addingFrets, 'Adding...', addingBarre ?? detectFallbackBarre(addingFrets));
      if (preview) {
        onSetArpeggioPosition?.(preview);
      } else {
        onSetArpeggioPosition?.(null);
      }
    }
  }, [addingFrets, addingBarre, buildStaticVoicingPosition, chordAddMode, detectFallbackBarre, onSetArpeggioPosition]);

  const handleStartAddMode = () => {
    if (chordAddMode) {
      setChordAddMode(false);
      setAddingFrets([-1,-1,-1,-1,-1,-1]);
      setAddingBarre(null);
      setArpAddMode?.(false);
      onSetArpeggioPosition?.(null);
      return;
    }
    setChordAddMode(true);
    setAddingFrets([-1,-1,-1,-1,-1,-1]);
    setAddingBarre(null);
    setArpAddMode?.(true);
    setActiveChord(null);
    onSetArpeggioPosition?.(null);
  };

  const handleSaveVoicing = () => {
    if (!selectedChord) return;
    const hasNotes = addingFrets.some(f => f >= 0);
    if (!hasNotes) return;
    const barre = addingBarre ?? detectFallbackBarre(addingFrets);
    const key = selectedChord;
    const existing = customChordVoicings[key] || [];
    const newVoicing = {
      frets: [...addingFrets],
      refRoot: selectedRoot,
      ...(barre ? { barreFrom: barre.from, barreTo: barre.to, barreFret: barre.fret } : {}),
    };
    const updated = { ...customChordVoicings, [key]: [...existing, newVoicing] };
    setCustomChordVoicings(updated);
    localStorage.setItem('mf-custom-chord-voicings', JSON.stringify(updated));
    setChordAddMode(false);
    setAddingFrets([-1,-1,-1,-1,-1,-1]);
    setAddingBarre(null);
    setArpAddMode?.(false);
    onSetArpeggioPosition?.(null);
  };

  const handleDeleteCustom = (globalIdx: number) => {
    if (!selectedChord) return;
    const customIdx = globalIdx - currentVoicings.length;
    if (customIdx < 0) return;
    const key = selectedChord;
    const custom = [...(customChordVoicings[key] || [])];
    custom.splice(customIdx, 1);
    const updated = { ...customChordVoicings, [key]: custom };
    setCustomChordVoicings(updated);
    localStorage.setItem('mf-custom-chord-voicings', JSON.stringify(updated));
  };

  const handleLibCopy = (v: ChordVoicing) => {
    navigator.clipboard.writeText(formatCompactTab(v.frets));
    setLibCopied(true);
    setTimeout(() => setLibCopied(false), 1500);
  };

  const splitIntoColumns = (types: string[]) => {
    const mid = Math.ceil(types.length / 2);
    return [types.slice(0, mid), types.slice(mid)];
  };

  // Handle clicking a custom voicing (display via ArpeggioPosition)
  const handleSelectCustomVoicing = (globalIdx: number) => {
    setChordAddMode(false);
    setAddingFrets([-1,-1,-1,-1,-1,-1]);
    setAddingBarre(null);
    setArpAddMode?.(false);
    setActiveChord(null);
    const voicing = mergedVoicings[globalIdx];
    if (!voicing) return;
    const position = buildStaticVoicingPosition(
      voicing.frets.map(f => f) as (number | -1)[],
      'Custom',
      voicing.barreFrom != null && voicing.barreTo != null && voicing.barreFret != null
        ? { from: voicing.barreFrom, to: voicing.barreTo, fret: voicing.barreFret }
        : null,
    );
    if (position) {
      onSetArpeggioPosition?.(position);
    }
  };

  return (
    <>
      <RootSelector selectedRoot={selectedRoot} setSelectedRoot={setSelectedRoot} />

      {/* Add mode UI */}
      {chordAddMode && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-2 mb-2">
          <div className="text-[10px] font-mono font-bold text-foreground mb-1">
            🎸 Click frets to build a {selectedRoot} {selectedChord} voicing
          </div>
          <div className="text-[8px] font-mono text-muted-foreground mb-1.5">
            Click to add notes. Drag across strings for barres. Click again to remove.
          </div>
          <div className="flex gap-0.5 mb-1.5 items-center">
            <span className="text-[8px] font-mono text-muted-foreground shrink-0">Frets:</span>
            {[0,1,2,3,4,5].map(si => (
              <input
                key={si}
                type="text"
                value={addingFrets[si] === -1 ? 'X' : addingFrets[si].toString()}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setAddingFrets(prev => {
                    const next = [...prev];
                    if (val === '' || val.toLowerCase() === 'x') next[si] = -1;
                    else if (!isNaN(Number(val))) next[si] = Math.max(0, Math.min(24, Number(val)));
                    return next;
                  });
                }}
                className="w-7 h-6 text-center text-[10px] font-mono rounded border border-border bg-muted text-foreground"
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={handleSaveVoicing} disabled={!addingFrets.some(f => f >= 0)}
              className="px-3 py-1 rounded text-[9px] font-mono uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-30 transition-colors font-bold"
            >Save Voicing</button>
            <button onClick={handleStartAddMode}
              className="px-3 py-1 rounded text-[9px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground transition-colors"
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex gap-1.5">
        <div className="flex gap-px shrink-0" style={{ width: '44%' }}>
          {CHORD_COLUMNS.map((col, ci) => {
            const isSus = col.label === 'Sus';
            const [col1, col2] = isSus ? [col.types, []] : splitIntoColumns(col.types);
            return (
              <div key={col.label} className={`min-w-0 ${ci < CHORD_COLUMNS.length - 1 ? 'border-r border-border/40' : ''} px-0.5`} style={{ flex: isSus ? 0.5 : 1 }}>
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
            {(['full', 'shell', 'drop2', 'drop3'] as VoicingTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => handleVoicingTabChange(tab)}
                className={`w-full px-1 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider transition-colors leading-tight ${
                  voicingTab === tab ? 'bg-accent text-accent-foreground font-bold border-accent' : 'text-muted-foreground border-border/40 hover:bg-muted/30'
                }`}
              >{tab === 'full' ? 'Standard' : tab === 'drop2' ? 'Drop 2' : tab === 'drop3' ? 'Drop 3' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
            ))}
          </div>
          <div className="text-[7px] font-mono text-muted-foreground mt-1.5 text-center leading-tight">
            {voicingTab === 'full' && 'Curated shapes'}
            {voicingTab === 'shell' && 'R, 3, 7'}
            {voicingTab === 'drop2' && '2nd voice ↓8va'}
            {voicingTab === 'drop3' && '3rd voice ↓8va'}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {selectedChord ? (
            <div className="bg-secondary/20 rounded p-1.5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-mono font-bold text-foreground truncate">{selectedRoot} {selectedChord}</div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleStartAddMode}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-colors font-bold ${
                      chordAddMode
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent text-accent-foreground hover:bg-accent/80'
                    }`}
                  >{chordAddMode ? '✕ Cancel' : '＋ Add Shape'}</button>
                  {mergedTotalPages > 1 && (
                    <>
                      <button onClick={() => setVoicingPage(Math.max(0, voicingPage - 1))} disabled={voicingPage === 0}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors">◀</button>
                      <span className="text-[8px] font-mono text-muted-foreground">{voicingPage + 1}/{mergedTotalPages}</span>
                      <button onClick={() => setVoicingPage(Math.min(mergedTotalPages - 1, voicingPage + 1))} disabled={voicingPage >= mergedTotalPages - 1}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors">▶</button>
                    </>
                  )}
                </div>
              </div>
              {mergedVoicings.length > 0 ? (
                <div className="grid grid-cols-2 gap-1">
                  {mergedPagedVoicings.map((v, i) => {
                    const globalIdx = voicingPage * VOICINGS_PER_PAGE + i;
                    const isCurated = globalIdx < currentVoicings.length;
                    const isActive = isCurated
                      ? (activeChord?.voicingIndex === globalIdx && activeChord?.voicingSource === voicingTab)
                      : false;
                    return (
                      <div key={i} className="relative">
                        <button
                          onClick={() => {
                            if (isCurated) {
                              handleSelectVoicing(i);
                              onSetArpeggioPosition?.(null);
                            } else {
                              handleSelectCustomVoicing(globalIdx);
                            }
                          }}
                          className={`w-full rounded p-0.5 transition-all border ${
                            isActive ? 'border-primary bg-primary/10 shadow-[0_0_6px_hsl(var(--primary)/0.3)]' : 'border-border/30 hover:bg-muted/50'
                          }`}
                        >
                          <MiniChordVoicingDiagram voicing={v} root={selectedRoot} showDegrees={degreeColors} />
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
                        {!isCurated && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteCustom(globalIdx); }}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center hover:brightness-110 z-10"
                          >×</button>
                        )}
                      </div>
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
  onSetArpeggioPosition, setShowFretBox, setFretBoxStart, setFretBoxSize,
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
  onSetArpeggioPosition?: (pos: ArpeggioPosition | null) => void;
  setShowFretBox?: (v: boolean) => void;
  setFretBoxStart?: (v: number) => void;
  setFretBoxSize?: (v: number) => void;
}) {
  const [hoveredChord, setHoveredChord] = useState<string | null>(null);
  const [chordOpacity, setChordOpacity] = useState(0.7);

  // Get the parent/foundation chord for hover display
  const getParentChordInfo = useCallback((chordName: string) => {
    const match = chordName.match(/^([A-G]#?)(.*)/);
    if (!match) return null;
    const root = match[1] as NoteName;
    const suffix = match[2];

    const parentMap: Record<string, string> = {
      '9': 'Dominant 7', 'maj9': 'Major 7', 'm9': 'Minor 7',
      '7♭9': 'Dominant 7', '7#9': 'Dominant 7', '11': 'Dominant 7',
      'm11': 'Minor 7', '13': 'Dominant 7', 'm13': 'Minor 7', 'add9': 'Major',
    };

    const suffixToType: Record<string, string> = {
      '': 'Major', 'm': 'Minor', 'dim': 'Diminished', 'aug': 'Augmented',
      'sus2': 'Sus2', 'sus4': 'Sus4', 'maj7': 'Major 7', 'm7': 'Minor 7',
      '7': 'Dominant 7', 'dim7': 'Dim 7', 'm7♭5': 'Half-Dim 7',
      'mMaj7': 'Min/Maj 7', 'aug7': 'Aug 7', '9': 'Dominant 9',
      'maj9': 'Major 9', 'm9': 'Minor 9', '7#9': '7#9', '7♭9': '7♭9',
      'add9': 'Add9', '6': 'Major 6', 'm6': 'Minor 6', '7sus4': '7sus4',
      '11': '11', 'm11': 'Minor 11', '13': '13', 'm13': 'Minor 13',
    };

    const chordType = suffixToType[suffix] || null;
    if (!chordType) return null;

    const parentType = parentMap[suffix];
    if (!parentType) return null;

    const voicings = getVoicingsForChord(root, parentType, 'full');
    if (voicings.length === 0) return null;

    const playedFretAvg = frets.filter(f => f >= 0).reduce((s, f) => s + f, 0) / Math.max(1, frets.filter(f => f >= 0).length);
    let bestVoicing = voicings[0];
    let bestDist = 999;
    for (const v of voicings) {
      const vAvg = v.frets.filter(f => f >= 0).reduce((s, f) => s + f, 0) / Math.max(1, v.frets.filter(f => f >= 0).length);
      const dist = Math.abs(vAvg - playedFretAvg);
      if (dist < bestDist) { bestDist = dist; bestVoicing = v; }
    }

    return { root, parentType, voicing: bestVoicing };
  }, [frets]);

  // Build arpeggio overlay when a chord is clicked
  const handleChordClick = useCallback((chordName: string, chordRoot: NoteName) => {
    if (viewRoot === chordName) {
      // Deselect
      setViewRoot(null);
      onSetArpeggioPosition?.(null);
      setShowFretBox?.(false);
      return;
    }
    setViewRoot(chordName);

    // Extract chord type suffix
    const match = chordName.match(/^([A-G]#?)(.*)/);
    if (!match) return;
    // Strip slash bass note (e.g. "9/G" → "9")
    const suffix = match[2].replace(/\/[A-G]#?$/, '');

    const suffixToArp: Record<string, string> = {
      '': 'Major', 'm': 'Minor', 'dim': 'Diminished', 'aug': 'Augmented',
      'sus2': 'Sus2', 'sus4': 'Sus4', 'maj7': 'Major 7', 'm7': 'Minor 7',
      '7': 'Dominant 7', 'dim7': 'Dim 7', 'm7♭5': 'Half-Dim 7',
      'mMaj7': 'Min/Maj 7', 'aug7': 'Aug 7', '9': 'Dominant 9',
      'maj9': 'Major 9', 'm9': 'Minor 9', '7#9': '7#9', '7♭9': '7♭9',
      'add9': 'Add9', '6': 'Major 6', 'm6': 'Minor 6', '7sus4': '7sus4',
      '11': '11', 'm11': 'Minor 11', '13': '13', 'm13': 'Minor 13',
    };

    const arpType = suffixToArp[suffix];
    if (!arpType) return;

    // Get formula for this chord to find all notes across the fretboard
    const formula = CHORD_FORMULAS[arpType] || ARPEGGIO_FORMULAS[arpType];
    if (!formula) return;

    const rootIdx = NOTE_NAMES.indexOf(chordRoot);
    const chordNotesPCs = new Set(formula.map(i => (rootIdx + (i % 12)) % 12));

    // Build arpeggio position with all matching notes across the entire fretboard
    const notes: { stringIndex: number; fret: number }[] = [];
    for (let si = 0; si < 6; si++) {
      for (let f = 0; f <= 22; f++) {
        const note = noteAtFret(si, f, tuning);
        const pc = NOTE_NAMES.indexOf(note);
        if (chordNotesPCs.has(pc)) {
          notes.push({ stringIndex: si, fret: f });
        }
      }
    }

    // Set arpeggio overlay
    const playedFretsList = frets.filter(f => f > 0);
    const minPlayedFret = playedFretsList.length > 0 ? Math.min(...playedFretsList) : 0;
    onSetArpeggioPosition?.({
      notes,
      showPath: false,
      label: chordName,
      startFret: minPlayedFret,
      type: 'static' as const,
      frets: [...frets] as (number | -1)[],
    });

    // Compute position box from played frets
    const playedFrets = frets.filter(f => f > 0);
    if (playedFrets.length > 0) {
      const minFret = Math.max(1, Math.min(...playedFrets) - 1);
      const maxFret = Math.max(...playedFrets) + 1;
      const size = Math.max(3, maxFret - minFret + 1);
      setFretBoxStart?.(minFret);
      setFretBoxSize?.(Math.min(12, size));
      setShowFretBox?.(true);
    }
  }, [viewRoot, frets, tuning, onSetArpeggioPosition, setShowFretBox, setFretBoxStart, setFretBoxSize, setViewRoot]);

  // Flatten all results into individual chord entries
  const allChords = useMemo(() => {
    const chords: { name: string; explanation: string; notes: NoteName[]; root: NoteName; altNames: string[] }[] = [];
    for (const r of results) {
      for (let ni = 0; ni < r.names.length; ni++) {
        const name = r.names[ni];
        const match = name.match(/^([A-G]#?)/);
        const root = match ? match[1] as NoteName : r.notes[0];
        const explanation = ni === 0 ? (r.explanations[0] || '') : (r.explanations.find(e => e.startsWith(name)) || r.explanations[0] || '');
        chords.push({ name, explanation, notes: r.notes, root, altNames: [] });
      }
    }
    return chords;
  }, [results]);

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
      {/* Results as individual chord cells — 3 per row */}
      {allChords.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              {allChords.length} interpretation{allChords.length !== 1 ? 's' : ''}
            </div>
            {/* Opacity slider — left side, before tab boxes */}
            <div className="flex items-center gap-1">
              <span className="text-[7px] font-mono text-muted-foreground">Opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                value={chordOpacity * 100}
                onChange={(e) => setChordOpacity(Number(e.target.value) / 100)}
                className="w-12 h-2 accent-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {allChords.map((chord, i) => {
              const isViewed = viewRoot === chord.name;
              const isHovered = hoveredChord === chord.name;
              const parentInfo = isHovered ? getParentChordInfo(chord.name) : null;

              const rootIdx = NOTE_NAMES.indexOf(chord.root);

              return (
                <div
                  key={`${chord.name}-${i}`}
                  className="relative"
                  onMouseEnter={() => setHoveredChord(chord.name)}
                  onMouseLeave={() => setHoveredChord(null)}
                >
                  <button
                    onClick={() => handleChordClick(chord.name, chord.root)}
                    draggable
                    onDragStart={(e) => {
                      const match = chord.name.match(/^([A-G]#?)\s*(.*)/);
                      if (match) {
                        e.dataTransfer.setData('application/chord', JSON.stringify({ root: match[1], chordType: match[2] || 'Major' }));
                        e.dataTransfer.effectAllowed = 'copy';
                      }
                    }}
                    className={`w-full text-left rounded-lg transition-all border ${
                      isViewed
                        ? 'border-primary/50 shadow-[0_0_8px_hsl(var(--primary)/0.2)]'
                        : 'border-border/40 hover:border-border/60'
                    }`}
                    style={{
                      background: isViewed
                        ? 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.06))'
                        : 'hsl(var(--muted) / 0.3)',
                    }}
                  >
                    <div className="px-2 py-1.5">
                      {/* Chord name */}
                      <div className="text-xs font-mono font-bold text-foreground truncate">{chord.name}</div>
                      {/* Mini tab display */}
                      <div className="flex gap-px mt-1" style={{ opacity: chordOpacity }}>
                        {frets.map((f, si) => {
                          const note = f >= 0 ? noteAtFret(si, f, tuning) : null;
                          const intervalName = note ? getIntervalName(chord.root, note) : '';
                          const degColor = intervalName ? DEGREE_COLORS[intervalName] : null;
                          return (
                            <div
                              key={si}
                              className="w-3 h-3 rounded-sm flex items-center justify-center text-[6px] font-mono font-bold"
                              style={{
                                backgroundColor: f === -1 ? 'transparent' : degColor ? `hsl(${degColor} / 0.25)` : 'hsl(var(--primary) / 0.15)',
                                color: f === -1 ? 'hsl(var(--muted-foreground) / 0.4)' : degColor ? `hsl(${degColor})` : 'hsl(var(--primary))',
                                border: f === -1 ? 'none' : `1px solid ${degColor ? `hsl(${degColor} / 0.4)` : 'hsl(var(--primary) / 0.3)'}`,
                              }}
                            >
                              {f === -1 ? '×' : f}
                            </div>
                          );
                        })}
                      </div>
                      {chord.explanation && (
                        <div className="text-[7px] font-mono text-muted-foreground mt-0.5 leading-tight truncate">
                          {chord.explanation}
                        </div>
                      )}
                    </div>

                    {/* Hover: show parent chord */}
                    {isHovered && parentInfo && (
                      <div className="border-t border-border/30 px-2 py-1 bg-muted/20 rounded-b-lg">
                        <div className="text-[7px] font-mono text-muted-foreground mb-0.5">
                          From: <span className="text-foreground font-bold">{parentInfo.root} {parentInfo.parentType}</span>
                        </div>
                        <div className="flex gap-px">
                          {parentInfo.voicing.frets.map((f, si) => {
                            const note = f >= 0 ? noteAtFret(si, f, tuning) : null;
                            const intervalName = note ? getIntervalName(parentInfo.root, note) : '';
                            const degColor = intervalName ? DEGREE_COLORS[intervalName] : null;
                            return (
                              <div
                                key={si}
                                className="w-3 h-3 rounded-sm flex items-center justify-center text-[6px] font-mono font-bold"
                                style={{
                                  backgroundColor: f === -1 ? 'transparent' : degColor ? `hsl(${degColor} / 0.2)` : 'hsl(var(--muted) / 0.5)',
                                  color: f === -1 ? 'hsl(var(--muted-foreground) / 0.3)' : degColor ? `hsl(${degColor})` : 'hsl(var(--muted-foreground))',
                                }}
                              >
                                {f === -1 ? '×' : f}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
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

  // Arrow key navigation through chords
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sorted.length === 0 || !onSeekToChord) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % sorted.length;
        onSeekToChord(sorted[nextIdx].startBeat);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = currentIdx <= 0 ? sorted.length - 1 : currentIdx - 1;
        onSeekToChord(sorted[prevIdx].startBeat);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sorted, currentIdx, onSeekToChord]);

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

function MiniChordVoicingDiagram({ voicing, root, showDegrees = false }: { voicing: ChordVoicing; root: NoteName; showDegrees?: boolean }) {
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
  tuning,
  onSetArpeggioPosition,
  arpOverlayOpacity,
  setArpOverlayOpacity,
  arpPathVisible,
  setArpPathVisible,
  arpAddMode,
  setArpAddMode,
  arpAddClickRef,
}: {
  onApplyScale: (root: NoteName, scale: string, mode: 'scale' | 'arpeggio') => void;
  tuning: number[];
  onSetArpeggioPosition?: (pos: ArpeggioPosition | null) => void;
  arpOverlayOpacity: number;
  setArpOverlayOpacity: (v: number) => void;
  arpPathVisible: boolean;
  setArpPathVisible: (v: boolean) => void;
  arpAddMode?: boolean;
  setArpAddMode?: (v: boolean) => void;
  arpAddClickRef?: React.MutableRefObject<((si: number, fret: number) => void) | null>;
}) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('E');
  const [selectedArp, setSelectedArp] = useState<string | null>('Major');
  const [octaveRange, setOctaveRange] = useState<OctaveRange>(1);
  const [selectedPosIdx, setSelectedPosIdx] = useState(0);
  const [arpPage, setArpPage] = useState(0);
  const ARP_PER_PAGE = 6;

  // Custom voicings from localStorage
  const [customArpPositions, setCustomArpPositions] = useState<Record<string, ArpeggioPosition[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mf-custom-arp-positions') || '{}');
    } catch { return {}; }
  });

  const saveCustomArpPositions = useCallback((data: Record<string, ArpeggioPosition[]>) => {
    setCustomArpPositions(data);
    localStorage.setItem('mf-custom-arp-positions', JSON.stringify(data));
  }, []);

  // Adding mode state
  const [addingMode, setAddingMode] = useState(false);
  const [addingNotes, setAddingNotes] = useState<{ stringIndex: number; fret: number }[]>([]);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [detectedRoot, setDetectedRoot] = useState<NoteName | null>(null);

  // Editing mode state (double-click on diagram)
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ stringIndex: number; fret: number }[]>([]);

  // Renaming state (double-click on saved custom name)
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const generatedPositions = useMemo(() => {
    if (!selectedArp) return [];
    const generated = generateArpeggioPositions(selectedRoot, selectedArp, octaveRange, tuning);
    const customKey = `${selectedRoot}-${selectedArp}-${octaveRange}`;
    const custom = customArpPositions[customKey] || [];
    return [...generated, ...custom];
  }, [selectedRoot, selectedArp, octaveRange, tuning, customArpPositions]);

  // On mount, apply default arpeggio
  useEffect(() => {
    if (selectedArp) {
      onApplyScale(selectedRoot, selectedArp, 'arpeggio');
      const positions = generateArpeggioPositions(selectedRoot, selectedArp, octaveRange, tuning);
      if (positions.length > 0) onSetArpeggioPosition?.(positions[0]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect arpeggio name when adding notes
  useEffect(() => {
    if (!addingMode || addingNotes.length < 2) {
      setDetectedName(null);
      setDetectedRoot(null);
      return;
    }
    const result = identifyArpeggioFromNotes(addingNotes, tuning);
    if (result) {
      setDetectedName(result.name);
      setDetectedRoot(result.root);
    } else {
      setDetectedName(null);
      setDetectedRoot(addingNotes.length > 0 ? noteAtFret(addingNotes[0].stringIndex, addingNotes[0].fret, tuning) as NoteName : null);
    }
  }, [addingNotes, addingMode, tuning]);

  // When in adding mode, show the adding notes as an arpeggio position on the fretboard
  useEffect(() => {
    if (addingMode && addingNotes.length > 0) {
      const pos: ArpeggioPosition = {
        notes: addingNotes,
        label: 'Adding...',
        startFret: Math.min(...addingNotes.filter(n => n.fret > 0).map(n => n.fret), 99),
        type: 'static',
        frets: (() => {
          const f: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
          for (const n of addingNotes) { if (f[n.stringIndex] === -1 || n.fret < f[n.stringIndex]) f[n.stringIndex] = n.fret; }
          return f;
        })(),
      };
      onSetArpeggioPosition?.(pos);
    }
  }, [addingNotes, addingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // When editing, show editing notes on fretboard
  useEffect(() => {
    if (editingIdx !== null && editingNotes.length > 0) {
      const pos: ArpeggioPosition = {
        notes: editingNotes,
        label: 'Editing...',
        startFret: Math.min(...editingNotes.filter(n => n.fret > 0).map(n => n.fret), 99),
        type: 'static',
        frets: (() => {
          const f: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
          for (const n of editingNotes) { if (f[n.stringIndex] === -1 || n.fret < f[n.stringIndex]) f[n.stringIndex] = n.fret; }
          return f;
        })(),
      };
      onSetArpeggioPosition?.(pos);
    }
  }, [editingNotes, editingIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register click handler on the ref so fretboard clicks route here
  useEffect(() => {
    if (!arpAddClickRef) return;
    if (addingMode) {
      arpAddClickRef.current = (si: number, fret: number) => {
        setAddingNotes(prev => {
          const exists = prev.findIndex(n => n.stringIndex === si && n.fret === fret);
          if (exists >= 0) return prev.filter((_, i) => i !== exists);
          return [...prev, { stringIndex: si, fret }];
        });
      };
    } else if (editingIdx !== null) {
      arpAddClickRef.current = (si: number, fret: number) => {
        setEditingNotes(prev => {
          const exists = prev.findIndex(n => n.stringIndex === si && n.fret === fret);
          if (exists >= 0) return prev.filter((_, i) => i !== exists);
          return [...prev, { stringIndex: si, fret }];
        });
      };
    } else {
      arpAddClickRef.current = null;
    }
    return () => { if (arpAddClickRef) arpAddClickRef.current = null; };
  }, [addingMode, editingIdx, arpAddClickRef]);

  // Also set arpAddMode when editing
  useEffect(() => {
    if (editingIdx !== null) setArpAddMode?.(true);
    else if (!addingMode) setArpAddMode?.(false);
  }, [editingIdx, addingMode, setArpAddMode]);

  const handleSelectArp = (arpType: string) => {
    if (selectedArp === arpType) {
      setSelectedArp(null);
      onSetArpeggioPosition?.(null);
    } else {
      setSelectedArp(arpType);
      setSelectedPosIdx(0);
      setArpPage(0);
      onApplyScale(selectedRoot, arpType, 'arpeggio');
      const positions = generateArpeggioPositions(selectedRoot, arpType, octaveRange, tuning);
      if (positions.length > 0) onSetArpeggioPosition?.(positions[0]);
    }
  };

  const handleRootChange = (n: NoteName) => {
    setSelectedRoot(n);
    setSelectedPosIdx(0);
    setArpPage(0);
    if (selectedArp) {
      onApplyScale(n, selectedArp, 'arpeggio');
      const positions = generateArpeggioPositions(n, selectedArp, octaveRange, tuning);
      onSetArpeggioPosition?.(positions.length > 0 ? positions[0] : null);
    }
  };

  const handleOctaveChange = (oct: OctaveRange) => {
    setOctaveRange(oct);
    setSelectedPosIdx(0);
    setArpPage(0);
    if (selectedArp) {
      const positions = generateArpeggioPositions(selectedRoot, selectedArp, oct, tuning);
      onSetArpeggioPosition?.(positions.length > 0 ? positions[0] : null);
    }
  };

  const handleSelectPosition = (idx: number) => {
    setSelectedPosIdx(idx);
    if (generatedPositions[idx]) onSetArpeggioPosition?.(generatedPositions[idx]);
  };

  const handlePrevPosition = () => {
    const newIdx = selectedPosIdx <= 0 ? generatedPositions.length - 1 : selectedPosIdx - 1;
    handleSelectPosition(newIdx);
    setArpPage(Math.floor(newIdx / ARP_PER_PAGE));
  };

  const handleNextPosition = () => {
    const newIdx = selectedPosIdx >= generatedPositions.length - 1 ? 0 : selectedPosIdx + 1;
    handleSelectPosition(newIdx);
    setArpPage(Math.floor(newIdx / ARP_PER_PAGE));
  };

  const handleDeletePosition = (idx: number) => {
    if (!selectedArp) return;
    const customKey = `${selectedRoot}-${selectedArp}-${octaveRange}`;
    const generated = generateArpeggioPositions(selectedRoot, selectedArp, octaveRange, tuning);
    const customIdx = idx - generated.length;
    if (customIdx < 0) return;
    const custom = [...(customArpPositions[customKey] || [])];
    custom.splice(customIdx, 1);
    const newData = { ...customArpPositions, [customKey]: custom };
    saveCustomArpPositions(newData);
  };

  // Start adding mode — clears fretboard
  const handleStartAdding = () => {
    if (addingMode) {
      // Cancel
      setAddingMode(false);
      setAddingNotes([]);
      setDetectedName(null);
      setDetectedRoot(null);
      setArpAddMode?.(false);
      // Re-apply current position
      if (generatedPositions[selectedPosIdx]) onSetArpeggioPosition?.(generatedPositions[selectedPosIdx]);
      return;
    }
    setAddingMode(true);
    setAddingNotes([]);
    setDetectedName(null);
    setDetectedRoot(null);
    setArpAddMode?.(true);
    onSetArpeggioPosition?.(null);
  };

  // Toggle a note in adding mode (click on fretboard note)
  const handleAddingNoteToggle = (stringIndex: number, fret: number) => {
    setAddingNotes(prev => {
      const exists = prev.findIndex(n => n.stringIndex === stringIndex && n.fret === fret);
      if (exists >= 0) {
        return prev.filter((_, i) => i !== exists);
      }
      return [...prev, { stringIndex, fret }];
    });
  };

  // Save the custom arpeggio
  const handleSaveCustomPosition = () => {
    if (addingNotes.length < 2) return;
    
    const arpName = detectedName || selectedArp || 'Custom';
    const root = detectedRoot || selectedRoot;
    const customKey = `${root}-${arpName}-${octaveRange}`;
    
    const sortedNotes = [...addingNotes].sort((a, b) => {
      const aMidi = ([40, 45, 50, 55, 59, 64][a.stringIndex] || 40) + a.fret;
      const bMidi = ([40, 45, 50, 55, 59, 64][b.stringIndex] || 40) + b.fret;
      return aMidi - bMidi;
    });
    
    const playedFrets = sortedNotes.filter(n => n.fret > 0).map(n => n.fret);
    const startFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
    const frets: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
    for (const n of sortedNotes) {
      if (frets[n.stringIndex] === -1 || n.fret < frets[n.stringIndex]) frets[n.stringIndex] = n.fret;
    }
    
    const newPos: ArpeggioPosition = {
      notes: sortedNotes,
      label: `Custom ${startFret}`,
      startFret,
      type: 'static',
      frets,
    };
    
    const existing = customArpPositions[customKey] || [];
    saveCustomArpPositions({ ...customArpPositions, [customKey]: [...existing, newPos] });
    
    // Switch to the saved arpeggio type if different
    if (arpName !== selectedArp) {
      setSelectedArp(arpName);
    }
    if (root !== selectedRoot) {
      setSelectedRoot(root);
    }
    
    setAddingMode(false);
    setAddingNotes([]);
    setDetectedName(null);
    setDetectedRoot(null);
  };

  // Edit existing position (double-click on diagram)
  const handleStartEditing = (idx: number) => {
    const pos = generatedPositions[idx];
    if (!pos) return;
    setEditingIdx(idx);
    setEditingNotes([...pos.notes]);
  };

  // Toggle note while editing
  const handleEditingNoteToggle = (stringIndex: number, fret: number) => {
    setEditingNotes(prev => {
      const exists = prev.findIndex(n => n.stringIndex === stringIndex && n.fret === fret);
      if (exists >= 0) return prev.filter((_, i) => i !== exists);
      return [...prev, { stringIndex, fret }];
    });
  };

  // Save edited position
  const handleSaveEditing = () => {
    if (editingIdx === null || !selectedArp || editingNotes.length < 2) return;
    const customKey = `${selectedRoot}-${selectedArp}-${octaveRange}`;
    const generated = generateArpeggioPositions(selectedRoot, selectedArp, octaveRange, tuning);
    
    const sortedNotes = [...editingNotes].sort((a, b) => {
      const aMidi = ([40, 45, 50, 55, 59, 64][a.stringIndex] || 40) + a.fret;
      const bMidi = ([40, 45, 50, 55, 59, 64][b.stringIndex] || 40) + b.fret;
      return aMidi - bMidi;
    });
    
    const playedFrets = sortedNotes.filter(n => n.fret > 0).map(n => n.fret);
    const startFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
    const frets: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
    for (const n of sortedNotes) {
      if (frets[n.stringIndex] === -1 || n.fret < frets[n.stringIndex]) frets[n.stringIndex] = n.fret;
    }
    
    const newPos: ArpeggioPosition = {
      notes: sortedNotes,
      label: `Custom ${startFret}`,
      startFret,
      type: 'static',
      frets,
    };
    
    // If editing a generated position, save as new custom. If editing custom, replace.
    const customIdx = editingIdx - generated.length;
    const custom = [...(customArpPositions[customKey] || [])];
    if (customIdx >= 0 && customIdx < custom.length) {
      custom[customIdx] = newPos;
    } else {
      custom.push(newPos);
    }
    saveCustomArpPositions({ ...customArpPositions, [customKey]: custom });
    
    setEditingIdx(null);
    setEditingNotes([]);
  };

  const handleCancelEditing = () => {
    setEditingIdx(null);
    setEditingNotes([]);
    if (generatedPositions[selectedPosIdx]) onSetArpeggioPosition?.(generatedPositions[selectedPosIdx]);
  };

  // Rename custom position via double-click
  const handleRenameSubmit = (idx: number) => {
    if (!selectedArp || !renameValue.trim()) {
      setRenamingIdx(null);
      return;
    }
    const customKey = `${selectedRoot}-${selectedArp}-${octaveRange}`;
    const generated = generateArpeggioPositions(selectedRoot, selectedArp, octaveRange, tuning);
    const customIdx = idx - generated.length;
    if (customIdx < 0) { setRenamingIdx(null); return; }
    const custom = [...(customArpPositions[customKey] || [])];
    if (custom[customIdx]) {
      custom[customIdx] = { ...custom[customIdx], label: renameValue.trim() };
      saveCustomArpPositions({ ...customArpPositions, [customKey]: custom });
    }
    setRenamingIdx(null);
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

  const arpTotalPages = Math.ceil(generatedPositions.length / ARP_PER_PAGE);
  const pagedPositions = generatedPositions.slice(arpPage * ARP_PER_PAGE, (arpPage + 1) * ARP_PER_PAGE);

  // Expose adding/editing click handler to the fretboard via the arpeggio position mechanism
  // The parent can check if addingMode is active and route clicks accordingly
  // For now we use the fret input boxes as a fallback, but the main interaction is via onSetArpeggioPosition

  return (
    <>
      <div className="mb-2">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0">
            <RootSelector selectedRoot={selectedRoot} setSelectedRoot={(n) => handleRootChange(n)} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="range"
              min={0}
              max={100}
              value={arpOverlayOpacity * 100}
              onChange={(e) => setArpOverlayOpacity(Number(e.target.value) / 100)}
              className="w-14 h-1.5 accent-primary"
              title={`All notes: ${Math.round(arpOverlayOpacity * 100)}%`}
            />
            <button
              onClick={() => setArpPathVisible(!arpPathVisible)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
                arpPathVisible
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              title="Toggle path visibility"
            >Path</button>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-1.5">
        {/* Arpeggio columns */}
        <div className="flex gap-px shrink-0" style={{ width: '40%' }}>
          {ARPEGGIO_COLUMNS.map((col, ci) => {
            const isSus = col.label === 'Sus';
            const [col1, col2] = isSus ? [col.types, []] : splitIntoColumns(col.types);
            return (
              <div key={col.label} className={`min-w-0 ${ci < ARPEGGIO_COLUMNS.length - 1 ? 'border-r border-border/40' : ''} px-0.5`} style={{ flex: isSus ? 0.5 : 1 }}>
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
                onClick={() => handleOctaveChange(oct)}
                className={`w-full px-1 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider transition-colors leading-tight ${
                  octaveRange === oct ? 'bg-accent text-accent-foreground font-bold border-accent' : 'text-muted-foreground border-border/40 hover:bg-muted/30'
                }`}
              >{oct === 1 ? 'Single' : oct === 2 ? 'Double' : 'Triple'}</button>
            ))}
          </div>
          <div className="text-[7px] font-mono text-muted-foreground mt-1.5 text-center leading-tight">
            {octaveRange === 1 && '4-fret span'}
            {octaveRange === 2 && 'Static + Linear'}
            {octaveRange === 3 && 'Full neck'}
          </div>
        </div>

        {/* Info + positions panel */}
        <div className="flex-1 min-w-0">
          {/* Adding mode UI */}
          {addingMode && (
            <div className="bg-accent/10 border border-accent/30 rounded p-2 mb-2">
              <div className="text-[9px] font-mono text-foreground font-bold mb-1">
                🎸 Click notes on the fretboard to define your arpeggio
              </div>
              <div className="text-[8px] font-mono text-muted-foreground mb-1.5">
                First note = root. Click to add, click again to remove.
              </div>
              {/* Show fret input as fallback */}
              <div className="flex gap-0.5 mb-1.5 items-center">
                <span className="text-[8px] font-mono text-muted-foreground shrink-0">Frets:</span>
                {[0,1,2,3,4,5].map(si => {
                  const note = addingNotes.find(n => n.stringIndex === si);
                  return (
                    <input
                      key={si}
                      type="text"
                      value={note ? note.fret.toString() : 'X'}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (val === '' || val.toLowerCase() === 'x') {
                          setAddingNotes(prev => prev.filter(n => n.stringIndex !== si));
                        } else if (!isNaN(Number(val))) {
                          const fret = Math.max(1, Math.min(24, Number(val)));
                          setAddingNotes(prev => {
                            const filtered = prev.filter(n => n.stringIndex !== si);
                            return [...filtered, { stringIndex: si, fret }].sort((a, b) => a.stringIndex - b.stringIndex);
                          });
                        }
                      }}
                      className="w-6 h-5 text-center text-[9px] font-mono rounded border border-border bg-muted text-foreground"
                    />
                  );
                })}
              </div>
              {detectedName && (
                <div className="text-[9px] font-mono text-primary mb-1">
                  Detected: <strong>{detectedRoot} {detectedName}</strong>
                </div>
              )}
              <div className="flex gap-1">
                <button
                  onClick={handleSaveCustomPosition}
                  disabled={addingNotes.length < 2}
                  className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-30 transition-colors"
                >Save</button>
                <button
                  onClick={handleStartAdding}
                  className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground transition-colors"
                >Cancel</button>
              </div>
            </div>
          )}

          {/* Editing mode UI */}
          {editingIdx !== null && (
            <div className="bg-accent/10 border border-accent/30 rounded p-2 mb-2">
              <div className="text-[9px] font-mono text-foreground font-bold mb-1">
                ✏️ Editing position — click notes to remove, click frets to add
              </div>
              <div className="flex gap-0.5 mb-1.5 items-center">
                <span className="text-[8px] font-mono text-muted-foreground shrink-0">Frets:</span>
                {[0,1,2,3,4,5].map(si => {
                  const note = editingNotes.find(n => n.stringIndex === si);
                  return (
                    <input
                      key={si}
                      type="text"
                      value={note ? note.fret.toString() : 'X'}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (val === '' || val.toLowerCase() === 'x') {
                          setEditingNotes(prev => prev.filter(n => n.stringIndex !== si));
                        } else if (!isNaN(Number(val))) {
                          const fret = Math.max(1, Math.min(24, Number(val)));
                          setEditingNotes(prev => {
                            const filtered = prev.filter(n => n.stringIndex !== si);
                            return [...filtered, { stringIndex: si, fret }].sort((a, b) => a.stringIndex - b.stringIndex);
                          });
                        }
                      }}
                      className="w-6 h-5 text-center text-[9px] font-mono rounded border border-border bg-muted text-foreground"
                    />
                  );
                })}
              </div>
              <div className="flex gap-1">
                <button onClick={handleSaveEditing} disabled={editingNotes.length < 2}
                  className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-30 transition-colors"
                >Save</button>
                <button onClick={handleCancelEditing}
                  className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground transition-colors"
                >Cancel</button>
              </div>
            </div>
          )}

          {selectedArp ? (
            <div className="bg-secondary/20 rounded p-1.5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-mono font-bold text-foreground">{selectedRoot} {selectedArp}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleStartAdding}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider transition-colors ${
                      addingMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >Add</button>
                </div>
              </div>

              <div className="text-[9px] font-mono text-muted-foreground leading-relaxed mb-2">
                {getArpDescription(selectedArp)}
              </div>
              
              {generatedPositions.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">
                      {generatedPositions.length} Position{generatedPositions.length !== 1 ? 's' : ''}
                    </div>
                    {arpTotalPages > 1 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setArpPage(Math.max(0, arpPage - 1))} disabled={arpPage === 0}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors">◀</button>
                        <span className="text-[8px] font-mono text-muted-foreground">{arpPage + 1}/{arpTotalPages}</span>
                        <button onClick={() => setArpPage(Math.min(arpTotalPages - 1, arpPage + 1))} disabled={arpPage >= arpTotalPages - 1}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors">▶</button>
                      </div>
                    )}
                  </div>
                  {/* Large prev/next cycling buttons */}
                  <div className="flex gap-1 mb-2">
                    <button
                      onClick={handlePrevPosition}
                      className="flex-1 py-1.5 rounded bg-secondary text-secondary-foreground hover:bg-muted text-[11px] font-mono font-bold transition-colors"
                    >◀ Prev</button>
                    <button
                      onClick={handleNextPosition}
                      className="flex-1 py-1.5 rounded bg-secondary text-secondary-foreground hover:bg-muted text-[11px] font-mono font-bold transition-colors"
                    >Next ▶</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {pagedPositions.map((pos, i) => {
                      const globalIdx = arpPage * ARP_PER_PAGE + i;
                      const isActive = selectedPosIdx === globalIdx;
                      const generated = generateArpeggioPositions(selectedRoot, selectedArp, octaveRange, tuning);
                      const isCustom = globalIdx >= generated.length;
                      const isRenaming = renamingIdx === globalIdx;
                      return (
                        <div key={globalIdx} className="relative">
                          <button
                            onClick={() => handleSelectPosition(globalIdx)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (isCustom) {
                                // Double-click custom: rename
                                setRenamingIdx(globalIdx);
                                setRenameValue(pos.label);
                              } else {
                                // Double-click generated: edit
                                handleStartEditing(globalIdx);
                              }
                            }}
                            className={`w-full rounded p-0.5 transition-all border ${
                              isActive ? 'border-primary bg-primary/10 shadow-[0_0_6px_hsl(var(--primary)/0.3)]' : 'border-border/30 hover:bg-muted/50'
                            }`}
                          >
                            <MiniArpDiagram position={pos} root={selectedRoot} large />
                            <div className="flex items-center justify-center gap-0.5">
                              {isRenaming ? (
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={() => handleRenameSubmit(globalIdx)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(globalIdx); if (e.key === 'Escape') setRenamingIdx(null); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 text-[7px] font-mono text-center bg-muted border border-border rounded px-0.5"
                                />
                              ) : (
                                <>
                                  <span className="text-[7px] font-mono text-muted-foreground">{pos.label}</span>
                                  <span className="text-[6px] font-mono text-muted-foreground/60">{pos.type === 'linear' ? '↗' : '▪'}</span>
                                </>
                              )}
                            </div>
                          </button>
                          {isCustom && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeletePosition(globalIdx); }}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center hover:brightness-110"
                            >×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-[8px] font-mono text-muted-foreground text-center py-2">
                  No positions found for this range
                </div>
              )}

              <div className="text-[7px] font-mono text-muted-foreground mt-1.5 leading-tight">
                {octaveRange === 1 && '4-fret span • Root-first • Single position'}
                {octaveRange === 2 && 'Static (all strings) + Linear (shifting)'}
                {octaveRange === 3 && 'Diagonal shapes • E/A string start'}
              </div>
            </div>
          ) : (
            <div className="text-[9px] font-mono text-muted-foreground text-center py-4 leading-relaxed">
              Select an arpeggio to generate playable positions.
              <br /><br />
              <span className="text-[8px]">• Root-first voicings<br />• Max 4-fret span<br />• Human-playable shapes</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Mini arpeggio position diagram
function MiniArpDiagram({ position, root, large }: { position: ArpeggioPosition; root: NoteName; large?: boolean }) {
  if (!position.notes || position.notes.length === 0) return null;
  const playedFrets = position.notes.filter(n => n.fret > 0).map(n => n.fret);
  const allFrets = position.notes.map(n => n.fret);
  const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
  const maxFret = Math.max(...allFrets, minFret + 4);
  const startFret = Math.max(0, minFret);
  const numFrets = Math.max(4, maxFret - startFret + 1);
  const w = large ? 70 : 50;
  const h = large ? 56 : 40;
  const stringSpacing = w / 7;
  const fretSpacing = (h - 5) / numFrets;

  // Build set of notes per string
  const notesByString: Map<number, number[]> = new Map();
  for (const n of position.notes) {
    if (!notesByString.has(n.stringIndex)) notesByString.set(n.stringIndex, []);
    notesByString.get(n.stringIndex)!.push(n.fret);
  }

  return (
    <div className="flex justify-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {Array.from({ length: numFrets + 1 }, (_, i) => (
          <line key={i} x1={stringSpacing} y1={5 + i * fretSpacing} x2={stringSpacing * 6} y2={5 + i * fretSpacing} stroke="hsl(var(--border))" strokeWidth={0.5} />
        ))}
        {[1, 2, 3, 4, 5, 6].map(s => (
          <line key={s} x1={s * stringSpacing} y1={5} x2={s * stringSpacing} y2={5 + numFrets * fretSpacing} stroke="hsl(var(--fretboard-string))" strokeWidth={0.5} opacity={0.5} />
        ))}
        {startFret > 0 && (
          <text x={1} y={5 + fretSpacing * 0.6} fontSize={4} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
        )}
        {/* Muted strings */}
        {[0, 1, 2, 3, 4, 5].map(s => {
          if (notesByString.has(s)) return null;
          const x = (s + 1) * stringSpacing;
          return <text key={`m${s}`} x={x} y={3} fontSize={5} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="monospace">×</text>;
        })}
        {/* Notes */}
        {position.notes.map((n, i) => {
          const x = (n.stringIndex + 1) * stringSpacing;
          if (n.fret === 0) return <circle key={i} cx={x} cy={3} r={1.5} fill="none" stroke="hsl(var(--foreground))" strokeWidth={0.5} />;
          const y = 5 + (n.fret - startFret + 0.5) * fretSpacing;
          const note = noteAtFret(n.stringIndex, n.fret);
          const interval = getIntervalName(root, note);
          const degColor = DEGREE_COLORS[interval];
          const fillColor = degColor ? `hsl(${degColor})` : 'hsl(var(--primary))';
          return <circle key={i} cx={x} cy={y} r={2.5} fill={fillColor} />;
        })}
        {/* Path lines */}
        {(() => {
          const sorted = [...position.notes].sort((a, b) => {
            const aMidi = ([40, 45, 50, 55, 59, 64][a.stringIndex] || 40) + a.fret;
            const bMidi = ([40, 45, 50, 55, 59, 64][b.stringIndex] || 40) + b.fret;
            return aMidi - bMidi;
          });
          return sorted.map((n, i) => {
            if (i === 0) return null;
            const prev = sorted[i - 1];
            const x1 = (prev.stringIndex + 1) * stringSpacing;
            const y1 = prev.fret === 0 ? 3 : 5 + (prev.fret - startFret + 0.5) * fretSpacing;
            const x2 = (n.stringIndex + 1) * stringSpacing;
            const y2 = n.fret === 0 ? 3 : 5 + (n.fret - startFret + 0.5) * fretSpacing;
            return <line key={`l${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--primary))" strokeWidth={1} opacity={0.4} />;
          });
        })()}
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
