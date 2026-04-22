import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  getDiatonicChords, generate7thInversions, generateDrop3Inversions, scaleToKeyMode, get7thChordType, get7thChordSymbol,
  STRING_GROUP_CONFIG, SCALE_DEGREE_COLORS, MAJOR_MODE_NAMES, MINOR_MODE_NAMES,
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
  identifyBarre: { from: number; to: number; fret: number } | null;
  setIdentifyBarre: (b: { from: number; to: number; fret: number } | null) => void;
  degreeColors: boolean;
  setDegreeColors: (v: boolean) => void;
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
  inversionStringGroup: StringGroup | null;
  setInversionStringGroup: (g: StringGroup | null) => void;
  onSetInversionVoicing?: (v: InversionVoicing | null) => void;
  ghostNoteOpacity: number;
  setGhostNoteOpacity: (v: number) => void;
  dropMode: 'drop2' | 'drop3' | null;
  setDropMode: (m: 'drop2' | 'drop3' | null) => void;
  threeNpsMode: boolean;
  setThreeNpsMode: (v: boolean) => void;
  voiceLeadingMode: boolean;
  setVoiceLeadingMode: (v: boolean) => void;
  voiceLeadingMelody: { stringIndex: number; fret: number } | null;
  setVoiceLeadingMelody: (m: { stringIndex: number; fret: number } | null) => void;
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
  onChordAddStateChange?: (rootNote: NoteName | null, hasNotes: boolean) => void;
  chordOctaveShift: number;
  setChordOctaveShift: (v: number) => void;
  setArpAddReferenceNotes?: (notes: { stringIndex: number; fret: number }[]) => void;
}

type VoicingTab = 'full' | 'shell' | 'drop2' | 'drop3' | 'triads';
type MainTab = 'beginner' | 'scaleview' | 'chords' | 'arpeggios' | 'caged' | 'identify' | 'changes' | 'backing' | 'tabvis' | null;
type OctaveRange = 1 | 2 | 3;

const DEFAULT_ARPEGGIO_COLUMNS: { label: string; types: string[] }[] = [
  { label: 'Major', types: ['Major', 'Major 7', 'Major 7♭5', 'Dominant 7', 'Augmented', 'Aug 7', 'Add9', 'Major 9', 'Dominant 9', 'Major 6', '7#9', '7♭9', '11', '13'] },
  { label: 'Minor', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'] },
  { label: 'Sus', types: ['Sus2', 'Sus4', '7sus4', '7sus4♭9'] },
];

// Colors for static/transit categories
const STATIC_COLOR = '210, 70%, 55%'; // blue
const TRANSIT_COLOR = '35, 85%, 55%'; // amber/orange

const CHORD_COLUMNS: { label: string; types: string[] }[] = [
  { label: 'Major', types: ['Major', 'Major 7', 'Major 7♭5', 'Major 7#5', 'Add9', '6add9', 'Major 9', 'Major 6', 'Maj11', 'Maj13', 'Maj9#11', 'Maj13#11'] },
  { label: 'Dominant', types: ['Dominant 7', 'Dominant 9', '7#9', '7♭9', '7#5', '7♭5', '9♭5', '9#5', '11', '13', '13#11', '13♭9', '11♭9', '7(♭5,♭9)', '7(♭5,#9)', '7(#5,♭9)', '7(#5,#9)'] },
  { label: 'Minor', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13', 'Madd9', 'm6add9', 'mMaj9', 'm7#5'] },
  { label: 'Other', types: ['Augmented', 'Aug 7', 'Sus2', 'Sus4', '7sus4', '7sus4♭9', 'Sus2Sus4', 'Power (5)', 'Dim5'] },
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
    if (acc === 'sharp' && (baseNote === 'E' || baseNote === 'B')) return;
    if (acc === 'flat' && (baseNote === 'F' || baseNote === 'C')) return;
    const newAcc = accidental === acc ? 'natural' : acc;
    setAccidental(newAcc);
    setSelectedRoot(resolveNote(baseNote, newAcc));
  };

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-0.5 items-end">
        {NATURAL_NOTES.map(n => {
          const isBase = n === baseNote;
          const showFlat = isBase && n !== 'F' && n !== 'C';
          const showSharp = isBase && n !== 'E' && n !== 'B';
          return (
            <div key={n} className="flex flex-col items-center">
              <button
                onClick={() => handleNoteClick(n)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                  isBase ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >{n}</button>
              {isBase && (showFlat || showSharp) && (
                <div className="mt-0.5 flex gap-px">
                  {showFlat && (
                    <button
                      onClick={() => handleAccidental('flat')}
                      className={`w-5 h-4 ${showSharp ? 'rounded-l' : 'rounded'} border text-[9px] font-mono font-bold transition-colors ${
                        accidental === 'flat'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                      }`}
                    >♭</button>
                  )}
                  {showSharp && (
                    <button
                      onClick={() => handleAccidental('sharp')}
                      className={`w-5 h-4 ${showFlat ? 'rounded-r border-l-0' : 'rounded'} border text-[9px] font-mono font-bold transition-colors ${
                        accidental === 'sharp'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                      }`}
                    >♯</button>
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
export default function ChordReference({
  activeChord, setActiveChord, showCAGED, setShowCAGED,
  cagedShape, setCagedShape, cagedRoot,
  identifyMode, setIdentifyMode, identifyFrets, setIdentifyFrets, identifyBarre, setIdentifyBarre,
  degreeColors, setDegreeColors, identifyRoot, setIdentifyRoot,
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
  dropMode, setDropMode,
  threeNpsMode, setThreeNpsMode,
  onApplyBeginnerPreset, onApplyOpenChord, onTabNotes,
  tabVisData, setTabVisData, tabVisPlayhead, setTabVisPlayhead,
  setShowFretBox, setFretBoxStart, setFretBoxSize,
  onChordAddStateChange,
  chordOctaveShift, setChordOctaveShift,
  setArpAddReferenceNotes,
}: ChordReferenceProps) {
  const navigate = useNavigate();
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
    const filtered = isStandard ? all : all.filter(v => isVoicingPlayableInTuning(v, selectedRoot, selectedChord, tuning));
    // Normalize: if all fretted notes are past fret 12, shift down an octave
    return filtered.map(v => {
      const frettedNotes = v.frets.filter(f => f > 0);
      if (frettedNotes.length === 0) return v;
      const minFret = Math.min(...frettedNotes);
      if (minFret > 12) {
        const shift = Math.floor(minFret / 12) * 12;
        const newFrets = v.frets.map(f => f <= 0 ? f : f - shift);
        return { ...v, frets: newFrets };
      }
      return v;
    });
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
    // Compute effective frets: fill in barre for intermediate strings
    const effectiveFrets = [...identifyFrets];
    if (identifyBarre) {
      for (let s = identifyBarre.from; s <= identifyBarre.to; s++) {
        if (effectiveFrets[s] === -1) effectiveFrets[s] = identifyBarre.fret;
      }
    }
    const hasInput = effectiveFrets.some(f => f >= 0);
    if (!hasInput) return [];
    return identifyChord(effectiveFrets);
  }, [identifyFrets, identifyBarre]);

  const handleTabSwitch = (tab: MainTab) => {
    // Toggle off if clicking the already-active tab
    if (tab === activeTab) {
      setActiveTab(null);
      onApplyBeginnerPreset?.(null);
      setIdentifyMode(false);
      onSetArpeggioPosition?.(null);
      setScaleViewDegreeFilter(null);
      setActiveChord(null);
      setShowFretBox?.(false);
      return;
    }
    setActiveTab(tab);
    if (tab !== 'beginner') onApplyBeginnerPreset?.(null);
    if (tab === 'caged') setShowCAGED(true);
    if (tab === 'identify') {
      setIdentifyMode(true);
      setActiveChord(null);
      setIdentifyFrets([-1, -1, -1, -1, -1, -1]);
      setIdentifyBarre(null);
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
      setDegreeColors(false);
    }
    if (tab === 'chords') {
      setActiveChord(null);
      onSetArpeggioPosition?.(null);
      setDegreeColors(true);
    }
    if (tab === 'arpeggios') {
      setActiveChord(null);
      setDegreeColors(true);
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
          { key: 'scaleview' as MainTab, label: 'Diatonic Harmony' },
          { key: 'chords' as MainTab, label: 'Chord Library' },
          { key: 'arpeggios' as MainTab, label: 'Arpeggio Positions' },
          { key: 'caged' as MainTab, label: 'CAGED' },
          { key: 'identify' as MainTab, label: "What's This?" },
          { key: 'changes' as MainTab, label: 'Progression Analyser' },
          { key: 'backing' as MainTab, label: '🎹 Backing Track' },
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
        <button
          onClick={() => navigate('/courses')}
          className="px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors flex items-center gap-0.5 bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
        >
          🎓 Courses
        </button>
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
          inversionStringGroup={inversionStringGroup}
          setInversionStringGroup={setInversionStringGroup}
          tuning={tuning}
          onSetArpeggioPosition={onSetArpeggioPosition}
          degreeColors={degreeColors}
          onSetInversionVoicing={onSetInversionVoicing}
          dropMode={dropMode}
          setDropMode={setDropMode}
          threeNpsMode={threeNpsMode}
          setThreeNpsMode={setThreeNpsMode}
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
          setArpAddReferenceNotes={setArpAddReferenceNotes}
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
            setIdentifyBarre(null);
            setIdentifyRoot(null);
            setIdentifyViewName(null);
            onSetArpeggioPosition?.(null);
            setShowFretBox?.(false);
          }}
        />
      ) : activeTab === 'chords' ? (
          <ChordLibraryPanel
          selectedRoot={selectedRoot}
          setSelectedRoot={(n) => { setSelectedRoot(n); setVoicingPage(0); onSetArpeggioPosition?.(null); }}
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
          onChordAddStateChange={onChordAddStateChange}
          chordOctaveShift={chordOctaveShift}
          setChordOctaveShift={setChordOctaveShift}
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
// DIATONIC HARMONY PANEL
// ============================================================

// Mini chord diagram for inversion voicings — always shows all 6 strings, uniform sizing
function MiniChordDiagram({ voicing, stringGroup, isActive, color, onClick }: {
  voicing: InversionVoicing;
  stringGroup: StringGroup;
  isActive: boolean;
  color: string;
  onClick: () => void;
}) {
  const config = STRING_GROUP_CONFIG[stringGroup];
  const activeStrings = new Set(config.strings);
  const activeFrets = voicing.frets.filter(f => f > 0);
  if (activeFrets.length === 0 && !voicing.frets.some(f => f === 0)) return null;
  const frettedNotes = voicing.frets.filter(f => f > 0);
  const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes) : 1;
  const startFret = Math.max(1, minFret - 1);
  const numFrets = 5; // Fixed number of frets for uniform sizing
  const cellW = 16;
  const cellH = 22;
  const numStrings = 6;
  const leftPad = 18;
  const topPad = 16;
  const w = leftPad + (numStrings - 1) * cellW + 14;
  const h = topPad + numFrets * cellH + 14;

  // Only show primary name (no alternate)
  const displayName = voicing.slashName?.split('=')[0]?.trim() || voicing.slashName;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center transition-all rounded-lg"
      style={{
        border: isActive ? `3px solid hsl(${color})` : '2px solid hsla(var(--border), 0.3)',
        backgroundColor: isActive ? `hsla(${color}, 0.15)` : 'hsla(var(--secondary), 0.5)',
        padding: 4,
        width: 100,
        minWidth: 100,
      }}
    >
      <div className="text-[10px] font-mono font-bold mb-0.5 leading-tight" style={{ color: `hsl(${color})` }}>
        {displayName}
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-1">
        <text x={4} y={topPad + 10} fontSize={9} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
        {/* Draw all 6 strings */}
        {Array.from({ length: numStrings }, (_, si) => (
          <line key={`s${si}`} x1={leftPad + si * cellW} y1={topPad} x2={leftPad + si * cellW} y2={topPad + numFrets * cellH}
            stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} strokeOpacity={activeStrings.has(si) ? 0.5 : 0.15} />
        ))}
        {Array.from({ length: numFrets + 1 }, (_, i) => (
          <line key={`f${i}`} x1={leftPad} y1={topPad + i * cellH} x2={leftPad + (numStrings - 1) * cellW} y2={topPad + i * cellH}
            stroke="hsl(var(--muted-foreground))" strokeWidth={i === 0 ? 2 : 0.5} strokeOpacity={0.5} />
        ))}
        {/* Muted string indicators */}
        {Array.from({ length: numStrings }, (_, si) => {
          if (voicing.frets[si] === -1) {
            return (
              <text key={`m${si}`} x={leftPad + si * cellW} y={topPad - 4} fontSize={9} fill="hsl(var(--muted-foreground))" textAnchor="middle" fontFamily="monospace" opacity={0.5}>✕</text>
            );
          }
          // Open string ring
          if (voicing.frets[si] === 0) {
            return (
              <circle key={`o${si}`} cx={leftPad + si * cellW} cy={topPad - 6} r={4} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.5} />
            );
          }
          return null;
        })}
        {/* Note dots on actual string positions */}
        {voicing.frets.map((fret, si) => {
          if (fret <= 0) return null;
          const fretPos = fret - startFret;
          if (fretPos < 0 || fretPos >= numFrets) return null;
          return (
            <circle key={`n${si}`}
              cx={leftPad + si * cellW}
              cy={topPad + fretPos * cellH + cellH / 2}
              r={6}
              fill={`hsl(${color})`}
              opacity={0.9}
            />
          );
        })}
      </svg>
      <div className="text-[8px] font-mono mt-0.5 leading-tight text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {voicing.degreeOrder}
      </div>
    </button>
  );
}

function ScaleViewPanel({
  primaryScale, degreeFilter, setDegreeFilter,
  inversionStringGroup, setInversionStringGroup,
  tuning, onSetArpeggioPosition, degreeColors,
  onSetInversionVoicing,
  dropMode, setDropMode,
  threeNpsMode, setThreeNpsMode,
}: {
  primaryScale: { mode: 'scale' | 'arpeggio'; root: NoteName; scale: string };
  degreeFilter: number | null;
  setDegreeFilter: (d: number | null) => void;
  inversionStringGroup: StringGroup | null;
  setInversionStringGroup: (g: StringGroup | null) => void;
  tuning: number[];
  onSetArpeggioPosition?: (pos: ArpeggioPosition | null) => void;
  degreeColors: boolean;
  onSetInversionVoicing?: (v: InversionVoicing | null) => void;
  dropMode: 'drop2' | 'drop3' | null;
  setDropMode: (m: 'drop2' | 'drop3' | null) => void;
  threeNpsMode: boolean;
  setThreeNpsMode: (v: boolean) => void;
}) {
  const keyMode = scaleToKeyMode(primaryScale.scale);
  const diatonicChords = useMemo(() => getDiatonicChords(primaryScale.root, keyMode), [primaryScale.root, keyMode]);

  const [currentInvIdx, setCurrentInvIdx] = useState(0);

  // Persisted descriptions for drop voicings
  const [dropDescriptions, setDropDescriptions] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('mf-drop-descriptions') || '{}'); } catch { return {}; }
  });

  const handleDropDescChange = (key: string, value: string) => {
    const updated = { ...dropDescriptions, [key]: value };
    setDropDescriptions(updated);
    localStorage.setItem('mf-drop-descriptions', JSON.stringify(updated));
  };

  // Build 7th chord labels for each diatonic chord
  const diatonicLabels = useMemo(() => diatonicChords.map((chord, i) => {
    const chordType7 = get7thChordType(chord.type, i + 1, keyMode);
    const suffix = get7thChordSymbol(chord.type, i + 1, keyMode);
    return { ...chord, label7: `${chord.root}${suffix}`, chordType7 };
  }), [diatonicChords]);

  // Mode names per scale degree (rotation of the parent scale)
  const modeNames = useMemo(() => {
    // Use minor mode-rotation if the parent scale is minor/aeolian
    if (keyMode === 'minor' || keyMode === 'aeolian') return MINOR_MODE_NAMES;
    return MAJOR_MODE_NAMES;
  }, [keyMode]);

  // Generate inversions when in drop mode with a string group and degree selected
  const inversions = useMemo(() => {
    if (inversionStringGroup === null || degreeFilter === null) return [];
    const chord = diatonicLabels[degreeFilter];
    if (!chord) return [];
    if (dropMode === 'drop2') {
      return generate7thInversions(chord.root, chord.chordType7, inversionStringGroup, tuning);
    }
    if (dropMode === 'drop3' && (inversionStringGroup === 'lower' || inversionStringGroup === 'mid')) {
      return generateDrop3Inversions(chord.root, chord.chordType7, inversionStringGroup, tuning);
    }
    return [];
  }, [dropMode, inversionStringGroup, degreeFilter, diatonicLabels, tuning]);

  useEffect(() => {
    setCurrentInvIdx(0);
  }, [inversions]);

  // Octave shift for inversions
  const [octaveShift, setOctaveShift] = useState(0);

  // Apply octave shift to inversion voicing
  useEffect(() => {
    if (dropMode && inversionStringGroup !== null && inversions.length > 0) {
      const idx = Math.min(currentInvIdx, inversions.length - 1);
      const baseInv = inversions[idx];
      if (octaveShift === 0) {
        onSetInversionVoicing?.(baseInv);
      } else {
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
  }, [dropMode, inversionStringGroup, inversions, currentInvIdx, onSetInversionVoicing, octaveShift]);

  useEffect(() => {
    setOctaveShift(0);
  }, [inversions]);

  const activeColor = degreeFilter !== null ? SCALE_DEGREE_COLORS[degreeFilter] : null;

  return (
    <div className="space-y-2">
      {/* Degree buttons - BIG and colourful. In 3-NPS mode they show mode names. */}
      <div className="grid grid-cols-7 gap-1">
        {diatonicLabels.map((chord, i) => {
          const isActive = degreeFilter === i;
          const color = SCALE_DEGREE_COLORS[i];
          const modeName = modeNames[i] ?? '';
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
              <span className="text-[9px] font-mono opacity-80 truncate w-full text-center">
                {threeNpsMode ? modeName : chord.label7}
              </span>
            </button>
          );
        })}
      </div>

      {/* Drop 2 / Drop 3 / 3-NPS — bigger vertical buttons with content to the right */}
      <div className="flex gap-2">
        {/* Left column: mode buttons stacked vertically */}
        <div className="flex flex-col gap-1.5 shrink-0" style={{ width: 110 }}>
          {(['drop2', 'drop3'] as const).map(dm => (
            <button
              key={dm}
              onClick={() => {
                setDropMode(dropMode === dm ? null : dm);
                setInversionStringGroup(null);
                onSetInversionVoicing?.(null);
                if (threeNpsMode) setThreeNpsMode(false);
              }}
              className="py-5 rounded-xl text-base font-mono font-black uppercase tracking-wider transition-all border-2"
              style={{
                backgroundColor: dropMode === dm ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.12)',
                borderColor: dropMode === dm ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.4)',
                color: dropMode === dm ? 'hsl(var(--primary-foreground))' : 'hsl(var(--primary))',
                boxShadow: dropMode === dm ? '0 0 12px hsl(var(--primary) / 0.4)' : 'none',
              }}
            >{dm === 'drop2' ? 'Drop 2' : 'Drop 3'}</button>
          ))}
          <button
            onClick={() => {
              const next = !threeNpsMode;
              setThreeNpsMode(next);
              if (next) {
                // Switching INTO 3-NPS turns off drop modes & inversion display
                setDropMode(null);
                setInversionStringGroup(null);
                onSetInversionVoicing?.(null);
              }
            }}
            className="py-3 rounded-xl text-[11px] font-mono font-black uppercase tracking-wider transition-all border-2 leading-tight"
            style={{
              backgroundColor: threeNpsMode ? 'hsl(var(--accent))' : 'hsl(var(--accent) / 0.12)',
              borderColor: threeNpsMode ? 'hsl(var(--accent))' : 'hsl(var(--accent) / 0.4)',
              color: threeNpsMode ? 'hsl(var(--accent-foreground))' : 'hsl(var(--accent))',
              boxShadow: threeNpsMode ? '0 0 12px hsl(var(--accent) / 0.4)' : 'none',
            }}
            title="Show 3-notes-per-string mode patterns. Click a degree above to display its mode."
          >3 Notes<br/>Per String</button>
        </div>

        {/* Right: drop mode content panel */}
        {dropMode && (
          <div className="flex gap-2 flex-1 min-w-0">
            {/* Description + string groups */}
            <div className="w-32 shrink-0 space-y-2">
              <textarea
                value={dropDescriptions[dropMode] || ''}
                onChange={(e) => handleDropDescChange(dropMode, e.target.value)}
                placeholder={`Describe ${dropMode === 'drop2' ? 'Drop 2' : 'Drop 3'} voicings...`}
                className="w-full h-20 rounded-lg border border-border bg-muted/40 text-[10px] font-mono text-foreground p-2 resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="space-y-1">
                {(dropMode === 'drop3' ? (['lower', 'mid'] as StringGroup[]) : (['upper', 'mid', 'lower'] as StringGroup[])).map(sg => (
                  <button
                    key={sg}
                    onClick={() => setInversionStringGroup(inversionStringGroup === sg ? null : sg)}
                    className="w-full px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border"
                    style={{
                      backgroundColor: inversionStringGroup === sg ? 'hsl(var(--accent))' : 'hsl(var(--secondary))',
                      borderColor: inversionStringGroup === sg ? 'hsl(var(--accent))' : 'hsl(var(--border))',
                      color: inversionStringGroup === sg ? 'hsl(var(--accent-foreground))' : 'hsl(var(--secondary-foreground))',
                    }}
                  >{STRING_GROUP_CONFIG[sg].label}</button>
                ))}
              </div>
            </div>

            {/* Voicings panel */}
            {inversionStringGroup && (
              <div className="flex-1 min-w-0">
                {degreeFilter !== null && inversions.length > 0 ? (
                  <div className="flex gap-0.5 items-stretch">
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
                              {activeInv.slashName?.split('=')[0]?.trim() || activeInv.slashName}
                            </div>
                            <div className="text-[12px] font-mono text-muted-foreground mt-1">{activeInv.inversionLabel}</div>
                            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{activeInv.bottomDegree}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">{activeInv.topDegree}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-mono mt-1 opacity-60">{activeInv.degreeOrder}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <div className="text-[14px] font-mono font-bold" style={{ color: activeColor ? `hsl(${activeColor})` : undefined }}>
                                {activeInv.tab}
                              </div>
                              <div className="flex gap-1 ml-auto">
                                <button
                                  onClick={() => setOctaveShift(prev => {
                                    const next = prev - 1;
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
                ) : degreeFilter !== null ? (
                  <div className="text-[10px] font-mono text-muted-foreground italic p-2">No voicings available for this chord type</div>
                ) : (
                  <div className="text-[10px] font-mono text-muted-foreground italic p-2">👆 Select a degree above to view voicings</div>
                )}
              </div>
            )}
          </div>
        )}

        {threeNpsMode && !dropMode && (
          <div className="flex-1 rounded-xl p-3 border-2 self-stretch flex items-center" style={{ borderColor: 'hsl(var(--accent) / 0.4)', backgroundColor: 'hsl(var(--accent) / 0.08)' }}>
            <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
              <span className="text-accent font-bold">3-Notes-Per-String mode active.</span> Click a degree above to highlight its full mode pattern on the fretboard. Each degree shows its parent rotation (I → Ionian, ii → Dorian, etc.) coloured to match.
            </div>
          </div>
        )}
      </div>

      {!dropMode && !threeNpsMode && degreeFilter === null && (
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
  setActiveChord, onSetArpeggioPosition, onChordAddStateChange, chordOctaveShift, setChordOctaveShift,
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
  onChordAddStateChange?: (rootNote: NoteName | null, hasNotes: boolean) => void;
  chordOctaveShift: number;
  setChordOctaveShift: (v: number) => void;
}) {
  const VOICINGS_PER_PAGE = 8;
  const [libCopied, setLibCopied] = useState(false);
  const [addingBarre, setAddingBarre] = useState<{ from: number; to: number; fret: number } | null>(null);

  // Custom chord voicing state
  const [customChordVoicings, setCustomChordVoicings] = useState<Record<string, {frets: number[], refRoot: NoteName, barreFrom?: number, barreTo?: number, barreFret?: number}[]>>(() => {
    try { return JSON.parse(localStorage.getItem('mf-custom-chord-voicings') || '{}'); } catch { return {}; }
  });
  const [chordAddMode, setChordAddMode] = useState(false);
  const [addingFrets, setAddingFrets] = useState<(number | -1)[]>([-1,-1,-1,-1,-1,-1]);

  // Hidden curated voicings (persisted to localStorage)
  const [hiddenVoicings, setHiddenVoicings] = useState<Record<string, number[]>>(() => {
    try { return JSON.parse(localStorage.getItem('mf-hidden-voicings') || '{}'); } catch { return {}; }
  });
  const [chordNameOverrides, setChordNameOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('mf-chord-name-overrides') || '{}'); } catch { return {}; }
  });

  const defaultChordLabels = useMemo<Record<string, string>>(() => ({
    'Dominant 7': '7',
    'Dominant 9': '9',
  }), []);

  const getChordCellLabel = useCallback((chordType: string) => {
    return chordNameOverrides[chordType]?.trim() || defaultChordLabels[chordType] || chordType;
  }, [chordNameOverrides, defaultChordLabels]);

  const handleRenameChord = useCallback((chordType: string) => {
    const currentLabel = getChordCellLabel(chordType);
    const nextLabel = window.prompt('Rename chord', currentLabel);
    if (nextLabel === null) return;

    const trimmed = nextLabel.trim();
    const defaultLabel = defaultChordLabels[chordType] || chordType;
    const updated = { ...chordNameOverrides };

    if (!trimmed || trimmed === defaultLabel) delete updated[chordType];
    else updated[chordType] = trimmed;

    setChordNameOverrides(updated);
    localStorage.setItem('mf-chord-name-overrides', JSON.stringify(updated));
  }, [chordNameOverrides, defaultChordLabels, getChordCellLabel]);

  const handleHideCurated = (origIdx: number) => {
    if (!selectedChord) return;
    const key = `${selectedRoot}::${selectedChord}::${voicingTab}`;
    const existing = hiddenVoicings[key] || [];
    const updated = { ...hiddenVoicings, [key]: [...existing, origIdx] };
    setHiddenVoicings(updated);
    localStorage.setItem('mf-hidden-voicings', JSON.stringify(updated));
    // Clear active chord if the hidden voicing was the active one
    if (activeChord?.voicingIndex === origIdx && activeChord?.voicingSource === voicingTab) setActiveChord(null);
  };

  // Transpose custom voicings for current root — keyed by voicingTab so
  // a voicing saved under "Standard" won't appear in shell / drop2 / drop3.
  const customDisplayEntries = useMemo(() => {
    if (!selectedChord) return [];
    const tabKey = `${selectedChord}::${voicingTab}`;
    const legacyCustoms = voicingTab === 'full' ? (customChordVoicings[selectedChord] || []) : [];
    const tabCustoms = customChordVoicings[tabKey] || [];
    return [
      ...legacyCustoms.map((cv, sourceIndex) => ({ cv, sourceIndex, sourceKey: selectedChord })),
      ...tabCustoms.map((cv, sourceIndex) => ({ cv, sourceIndex, sourceKey: tabKey })),
    ].map(({ cv, sourceIndex, sourceKey }) => {
      const refIdx = NOTE_NAMES.indexOf(cv.refRoot);
      const targetIdx = NOTE_NAMES.indexOf(selectedRoot);
      const delta = (targetIdx - refIdx + 12) % 12;
      const transposed = cv.frets.map(f => f < 0 ? -1 : f + delta);
      return {
        voicing: {
          frets: transposed.map(f => f < 0 ? -1 : f > 24 ? f - 12 : f),
          fingers: null,
          barreFrom: cv.barreFrom,
          barreTo: cv.barreTo,
          barreFret: cv.barreFret != null ? cv.barreFret + delta : undefined,
        } as ChordVoicing,
        sourceIndex,
        sourceKey,
      };
    });
  }, [selectedChord, selectedRoot, customChordVoicings, voicingTab]);

  // Track original indices so delete/hide targets the correct voicing
  const filteredCuratedMap = useMemo(() => {
    if (!selectedChord) return currentVoicings.map((v, i) => ({ v, origIdx: i }));
    const key = `${selectedRoot}::${selectedChord}::${voicingTab}`;
    const hidden = new Set(hiddenVoicings[key] || []);
    if (hidden.size === 0) return currentVoicings.map((v, i) => ({ v, origIdx: i }));
    return currentVoicings.map((v, i) => ({ v, origIdx: i })).filter(({ origIdx }) => !hidden.has(origIdx));
  }, [currentVoicings, selectedRoot, selectedChord, voicingTab, hiddenVoicings]);

  const mergedEntries = useMemo(() => [
    ...filteredCuratedMap.map(({ v, origIdx }) => ({ kind: 'curated' as const, voicing: v, origIdx })),
    ...customDisplayEntries.map(({ voicing, sourceIndex, sourceKey }) => ({ kind: 'custom' as const, voicing, sourceIndex, sourceKey })),
  ], [filteredCuratedMap, customDisplayEntries]);

  const mergedTotalPages = Math.ceil(mergedEntries.length / VOICINGS_PER_PAGE);
  const mergedPagedEntries = mergedEntries.slice(voicingPage * VOICINGS_PER_PAGE, (voicingPage + 1) * VOICINGS_PER_PAGE);

  const buildStaticVoicingPosition = useCallback((frets: (number | -1)[], label: string, barre: { from: number; to: number; fret: number } | null) => {
    // Fill in barre for intermediate strings
    const effectiveFrets = [...frets];
    if (barre) {
      for (let s = barre.from; s <= barre.to; s++) {
        if (effectiveFrets[s] === -1) effectiveFrets[s] = barre.fret;
      }
    }
    const notes = effectiveFrets.map((f, si) => f >= 0 ? { stringIndex: si, fret: f } : null).filter(Boolean) as { stringIndex: number; fret: number }[];
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
      setAddingBarre(prevBarre => {
        setAddingFrets(prev => {
          const next = [...prev];
          if (prevBarre && prevBarre.fret === fret) {
            for (let s = prevBarre.from; s <= prevBarre.to; s += 1) {
              if (next[s] === fret) next[s] = -1;
            }
          }
          for (let s = from; s <= to; s += 1) next[s] = fret;
          return next;
        });

        return { from, to, fret };
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
      const hasNotes = addingFrets.some(f => f >= 0);
      onChordAddStateChange?.(selectedRoot, hasNotes);
      const preview = buildStaticVoicingPosition(addingFrets, 'Adding...', addingBarre);
      if (preview) {
        onSetArpeggioPosition?.(preview);
      } else {
        onSetArpeggioPosition?.(null);
      }
    }
  }, [addingFrets, addingBarre, buildStaticVoicingPosition, chordAddMode, onSetArpeggioPosition, onChordAddStateChange, selectedRoot]);

  const handleStartAddMode = () => {
    if (chordAddMode) {
      setChordAddMode(false);
      setAddingFrets([-1,-1,-1,-1,-1,-1]);
      setAddingBarre(null);
      setArpAddMode?.(false);
      onSetArpeggioPosition?.(null);
      onChordAddStateChange?.(null, false);
      return;
    }
    setChordAddMode(true);
    setAddingFrets([-1,-1,-1,-1,-1,-1]);
    setAddingBarre(null);
    setArpAddMode?.(true);
    setActiveChord(null);
    onSetArpeggioPosition?.(null);
    onChordAddStateChange?.(selectedRoot, false);
  };

  const handleSaveVoicing = () => {
    if (!selectedChord) return;
    const hasNotes = addingFrets.some(f => f >= 0);
    if (!hasNotes) return;
    const barre = addingBarre;
    // Fill in barre for intermediate strings before saving
    const saveFrets = [...addingFrets];
    if (barre) {
      for (let s = barre.from; s <= barre.to; s++) {
        if (saveFrets[s] === -1) saveFrets[s] = barre.fret;
      }
    }
    const key = `${selectedChord}::${voicingTab}`;
    const existing = customChordVoicings[key] || [];
    const newVoicing = {
      frets: saveFrets,
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

  const handleDeleteCustom = (sourceKey: string, sourceIndex: number) => {
    const custom = [...(customChordVoicings[sourceKey] || [])];
    if (!custom[sourceIndex]) return;
    custom.splice(sourceIndex, 1);
    const updated = { ...customChordVoicings, [sourceKey]: custom };
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
  const handleSelectCustomVoicing = (voicing: ChordVoicing) => {
    setChordAddMode(false);
    setAddingFrets([-1,-1,-1,-1,-1,-1]);
    setAddingBarre(null);
    setArpAddMode?.(false);
    setActiveChord(null);
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

  useEffect(() => {
    const lastPage = Math.max(0, mergedTotalPages - 1);
    if (voicingPage > lastPage) setVoicingPage(lastPage);
  }, [mergedTotalPages, voicingPage, setVoicingPage]);

  const prevSelectionRef = useRef({ root: selectedRoot, chord: selectedChord, tab: voicingTab });
  useEffect(() => {
    const prev = prevSelectionRef.current;
    const selectionChanged = prev.root !== selectedRoot || prev.chord !== selectedChord || prev.tab !== voicingTab;
    prevSelectionRef.current = { root: selectedRoot, chord: selectedChord, tab: voicingTab };
    if (!selectionChanged || !selectedChord || chordAddMode) return;

    const firstCurated = filteredCuratedMap[0];
    if (firstCurated) {
      onSetArpeggioPosition?.(null);
      setActiveChord({ root: selectedRoot, chordType: selectedChord, voicingIndex: firstCurated.origIdx, voicingSource: voicingTab });
      return;
    }

    const firstCustom = customDisplayEntries[0]?.voicing;
    setActiveChord(null);
    if (!firstCustom) {
      onSetArpeggioPosition?.(null);
      return;
    }

    const position = buildStaticVoicingPosition(
      firstCustom.frets.map(f => f) as (number | -1)[],
      'Custom',
      firstCustom.barreFrom != null && firstCustom.barreTo != null && firstCustom.barreFret != null
        ? { from: firstCustom.barreFrom, to: firstCustom.barreTo, fret: firstCustom.barreFret }
        : null,
    );
    if (position) onSetArpeggioPosition?.(position);
  }, [selectedRoot, selectedChord, voicingTab, chordAddMode, filteredCuratedMap, customDisplayEntries, buildStaticVoicingPosition, onSetArpeggioPosition, setActiveChord]);

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
      <div className="flex gap-1.5" style={{ minHeight: 0 }}>
        <div className="flex gap-px shrink-0" style={{ width: '48%' }}>
          {CHORD_COLUMNS.map((col, ci) => {
            const isOther = col.label === 'Other';
            const [col1, col2] = isOther ? [col.types, []] : splitIntoColumns(col.types);
            return (
              <div key={col.label} className={`min-w-0 ${ci < CHORD_COLUMNS.length - 1 ? 'border-r border-border/40' : ''} px-0.5 flex flex-col`} style={{ flex: isOther ? 0.6 : 1 }}>
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center mb-1 font-bold">{col.label}</div>
                <div className={`flex gap-px ${isOther ? 'justify-center' : ''} overflow-y-auto flex-1`} style={{ maxHeight: '35vh' }}>
                  {[col1, ...(col2.length > 0 ? [col2] : [])].map((types, sci) => (
                    <div key={sci} className={`${isOther ? 'w-full' : 'flex-1'} space-y-px`}>
                      {types.map(ct => {
                        if (!CHORD_FORMULAS[ct]) return null;
                        const isSelected = selectedChord === ct;
                        return (
                          <button
                            key={ct}
                            onClick={() => handleSelectChord(ct)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleRenameChord(ct);
                            }}
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
                            title={`${getChordCellLabel(ct)} — drag to timeline`}
                          >{getChordCellLabel(ct)}</button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="w-14 shrink-0 flex flex-col">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center mb-1 font-bold">Type</div>
          <div className="space-y-0.5">
            {(['full', 'shell'] as VoicingTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => handleVoicingTabChange(tab)}
                className={`w-full px-1 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider transition-colors leading-tight ${
                  voicingTab === tab ? 'bg-accent text-accent-foreground font-bold border-accent' : 'text-muted-foreground border-border/40 hover:bg-muted/30'
                }`}
              >{tab === 'full' ? 'Standard' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
            ))}
          </div>
          <div className="text-[7px] font-mono text-muted-foreground mt-1.5 text-center leading-tight">
            {voicingTab === 'full' && 'Curated shapes'}
            {voicingTab === 'shell' && 'R, 3, 7'}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {selectedChord ? (
            <div className="bg-secondary/20 rounded p-1.5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-mono font-bold text-foreground truncate">{selectedRoot} {getChordCellLabel(selectedChord)}</div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleStartAddMode}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-colors font-bold ${
                      chordAddMode
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent text-accent-foreground hover:bg-accent/80'
                    }`}
                  >{chordAddMode ? '✕ Cancel' : '＋ Add Shape'}</button>
                  {!chordAddMode && (
                    <button
                      onClick={() => setChordOctaveShift(chordOctaveShift + 1)}
                      disabled={(() => {
                        if (!activeChord) return true;
                        const voicings = getVoicingsForChord(activeChord.root, activeChord.chordType, activeChord.voicingSource);
                        const v = voicings[activeChord.voicingIndex];
                        if (!v) return true;
                        const playedFrets = v.frets.filter(f => f > 0);
                        if (playedFrets.length === 0) return true;
                        const minFret = Math.min(...playedFrets);
                        const autoShift = -Math.floor(minFret / 12) * 12;
                        const maxFret = Math.max(...playedFrets);
                        return maxFret + autoShift + (chordOctaveShift + 1) * 12 > 24;
                      })()}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors font-bold"
                      title="Move shape up 12 frets"
                    >+12</button>
                  )}
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
              {mergedEntries.length > 0 ? (
                <div className="grid grid-cols-4 gap-1">
                  {mergedPagedEntries.map((entry, i) => {
                    const v = entry.voicing;
                    const isCurated = entry.kind === 'curated';
                    const origIdx = isCurated ? entry.origIdx : undefined;
                    const isActive = isCurated
                      ? (activeChord?.voicingIndex === origIdx && activeChord?.voicingSource === voicingTab)
                      : false;
                    return (
                      <div key={i} className="relative">
                        <button
                          onClick={() => {
                            if (isCurated && origIdx != null && selectedChord) {
                              setActiveChord({ root: selectedRoot, chordType: selectedChord, voicingIndex: origIdx, voicingSource: voicingTab });
                              onSetArpeggioPosition?.(null);
                            } else if (entry.kind === 'custom') {
                              handleSelectCustomVoicing(v);
                            }
                          }}
                          className={`w-full rounded p-1 transition-all border flex flex-col items-center justify-center ${
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
                        {(
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCurated && origIdx != null) {
                                handleHideCurated(origIdx);
                              } else if (entry.kind === 'custom') {
                                handleDeleteCustom(entry.sourceKey, entry.sourceIndex);
                              }
                            }}
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
  arpOverlayOpacity, setArpOverlayOpacity, onClearFretboard,
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
  arpOverlayOpacity: number;
  setArpOverlayOpacity: (v: number) => void;
  onClearFretboard?: () => void;
}) {
  const [hoveredChord, setHoveredChord] = useState<string | null>(null);

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
            {/* Clear fretboard button */}
            <button
              onClick={onClearFretboard}
              className="text-[8px] font-mono text-destructive hover:text-destructive/80 uppercase tracking-wider transition-colors"
            >Clear</button>
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
                      <div className="flex gap-px mt-1">
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
  const w = 90;
  const h = 110;
  const stringSpacing = w / 7;
  const fretSpacing = h / (numFrets + 1);

  return (
    <div className="flex justify-center">
      <svg width={w} height={h + 6} className="shrink-0">
        {startFret > 1 && (
          <text x={2} y={fretSpacing + 7} fontSize={8} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
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
          return <circle key={i} cx={x} cy={y} r={5.5} fill={fillColor} />;
        })}
      </svg>
    </div>
  );
}

// ============================================================
// ARPEGGIO POSITIONS PANEL
// ============================================================

function ArpeggioPositionsPanel({
  onApplyScale, tuning, onSetArpeggioPosition,
  arpOverlayOpacity, setArpOverlayOpacity,
  arpPathVisible, setArpPathVisible,
  arpAddMode, setArpAddMode, arpAddClickRef, setArpAddReferenceNotes,
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
  setArpAddReferenceNotes?: (notes: { stringIndex: number; fret: number }[]) => void;
}) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('E');
  const [selectedArp, setSelectedArp] = useState<string | null>('Major');
  const [octaveRange, setOctaveRange] = useState<OctaveRange>(1);
  const [selectedPosIdx, setSelectedPosIdx] = useState(0);
  const [arpPage, setArpPage] = useState(0);
  const ARP_PER_PAGE = 8;

  // Root-independent storage (v2) — shapes transpose across all keys
  const [customArpPositions, setCustomArpPositions] = useState<Record<string, (ArpeggioPosition & { refRoot: NoteName })[]>>(() => {
    try { return JSON.parse(localStorage.getItem('mf-custom-arp-positions-v2') || '{}'); } catch { return {}; }
  });
  const [hiddenArpPositions, setHiddenArpPositions] = useState<Record<string, number[]>>(() => {
    try { return JSON.parse(localStorage.getItem('mf-hidden-arp-positions-v2') || '{}'); } catch { return {}; }
  });
  const [arpCategories, setArpCategories] = useState<Record<string, 'static' | 'transit'>>(() => {
    try { return JSON.parse(localStorage.getItem('mf-arp-categories-v2') || '{}'); } catch { return {}; }
  });
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'static' | 'transit'>('all');
  const [dragOverCategory, setDragOverCategory] = useState<'static' | 'transit' | null>(null);
  const [hiddenArpTypes, setHiddenArpTypes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mf-hidden-arp-types') || '[]'); } catch { return []; }
  });
  const [showRestoreArpTypes, setShowRestoreArpTypes] = useState(false);

  const saveCustom = useCallback((data: Record<string, (ArpeggioPosition & { refRoot: NoteName })[]>) => {
    setCustomArpPositions(data);
    localStorage.setItem('mf-custom-arp-positions-v2', JSON.stringify(data));
  }, []);

  const [addingMode, setAddingMode] = useState(false);
  const [addingNotes, setAddingNotes] = useState<{ stringIndex: number; fret: number }[]>([]);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [detectedRoot, setDetectedRoot] = useState<NoteName | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ kind: 'generated' | 'custom'; origIdx: number } | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ stringIndex: number; fret: number }[]>([]);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Chord tone overlay for add/edit mode
  const allChordTonePositions = useMemo(() => {
    if (!selectedArp) return [];
    const formula = ARPEGGIO_FORMULAS[selectedArp];
    if (!formula) return [];
    const rootIdx = NOTE_NAMES.indexOf(selectedRoot);
    const toneNames = formula.map((i: number) => NOTE_NAMES[(rootIdx + (i % 12)) % 12]);
    const positions: { stringIndex: number; fret: number }[] = [];
    for (let si = 0; si < 6; si++) {
      for (let f = 0; f <= 24; f++) {
        if (toneNames.includes(noteAtFret(si, f, tuning))) positions.push({ stringIndex: si, fret: f });
      }
    }
    return positions;
  }, [selectedRoot, selectedArp, tuning]);

  // Open string rule: if any note is open, first (lowest MIDI) must be open
  const passesOpenStringRule = useCallback((pos: ArpeggioPosition): boolean => {
    const hasOpen = pos.notes.some(n => n.fret === 0);
    if (!hasOpen) return true;
    const sorted = [...pos.notes].sort((a, b) => {
      const aMidi = ([40, 45, 50, 55, 59, 64][a.stringIndex] || 40) + a.fret;
      const bMidi = ([40, 45, 50, 55, 59, 64][b.stringIndex] || 40) + b.fret;
      return aMidi - bMidi;
    });
    return sorted[0].fret === 0;
  }, []);

  // Transpose an arp position from one root to another
  const transposeArp = useCallback((pos: ArpeggioPosition, fromRoot: NoteName, toRoot: NoteName): ArpeggioPosition | null => {
    const delta = (NOTE_NAMES.indexOf(toRoot) - NOTE_NAMES.indexOf(fromRoot) + 12) % 12;
    if (delta === 0) return pos;
    let newNotes = pos.notes.map(n => ({ ...n, fret: n.fret + delta }));
    const minFret = Math.min(...newNotes.map(n => n.fret));
    if (minFret >= 12) newNotes = newNotes.map(n => ({ ...n, fret: n.fret - 12 }));
    if (newNotes.some(n => n.fret < 0 || n.fret > 24)) return null;
    const playedFrets = newNotes.filter(n => n.fret > 0).map(n => n.fret);
    const frets: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
    for (const n of newNotes) { if (frets[n.stringIndex] === -1 || n.fret < frets[n.stringIndex]) frets[n.stringIndex] = n.fret; }
    return { ...pos, notes: newNotes, startFret: playedFrets.length > 0 ? Math.min(...playedFrets) : 0, frets };
  }, []);

  // Raw generated positions for current root
  const rawGenerated = useMemo(() => {
    if (!selectedArp) return [];
    return generateArpeggioPositions(selectedRoot, selectedArp, octaveRange, tuning);
  }, [selectedRoot, selectedArp, octaveRange, tuning]);

  // Build position entries with tracking
  const positionEntries = useMemo(() => {
    if (!selectedArp) return [];
    const hiddenKey = `${selectedArp}-${octaveRange}`;
    const hidden = new Set(hiddenArpPositions[hiddenKey] || []);
    const entries: Array<{ pos: ArpeggioPosition; kind: 'generated' | 'custom'; origIdx: number; catKey: string }> = [];
    rawGenerated.forEach((pos, i) => {
      if (!hidden.has(i) && passesOpenStringRule(pos)) {
        entries.push({ pos, kind: 'generated', origIdx: i, catKey: `${selectedArp}-${octaveRange}-gen-${i}` });
      }
    });
    const customKey = `${selectedArp}-${octaveRange}`;
    const customs = customArpPositions[customKey] || [];
    customs.forEach((cp, i) => {
      const transposed = transposeArp(cp, cp.refRoot, selectedRoot);
      if (transposed && passesOpenStringRule(transposed)) {
        entries.push({ pos: transposed, kind: 'custom', origIdx: i, catKey: `${selectedArp}-${octaveRange}-cust-${i}` });
      }
    });
    return entries;
  }, [selectedArp, octaveRange, rawGenerated, hiddenArpPositions, customArpPositions, selectedRoot, passesOpenStringRule, transposeArp]);

  // Filter by category
  const filteredEntries = useMemo(() => {
    if (categoryFilter === 'all') return positionEntries;
    return positionEntries.filter(entry => arpCategories[entry.catKey] === categoryFilter);
  }, [positionEntries, categoryFilter, arpCategories]);

  // Initial load
  useEffect(() => {
    if (selectedArp) {
      onApplyScale(selectedRoot, selectedArp, 'arpeggio');
      if (positionEntries.length > 0) onSetArpeggioPosition?.(positionEntries[0].pos);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect arp name when adding
  useEffect(() => {
    if (!addingMode || addingNotes.length < 2) { setDetectedName(null); setDetectedRoot(null); return; }
    const result = identifyArpeggioFromNotes(addingNotes, tuning);
    if (result) { setDetectedName(result.name); setDetectedRoot(result.root); }
    else { setDetectedName(null); setDetectedRoot(addingNotes.length > 0 ? noteAtFret(addingNotes[0].stringIndex, addingNotes[0].fret, tuning) as NoteName : null); }
  }, [addingNotes, addingMode, tuning]);

  // Show adding preview on fretboard
  useEffect(() => {
    if (addingMode && addingNotes.length > 0) {
      const pos: ArpeggioPosition = {
        notes: addingNotes, label: 'Adding...',
        startFret: Math.min(...addingNotes.filter(n => n.fret > 0).map(n => n.fret), 99),
        type: 'static',
        frets: (() => { const f: (number | -1)[] = [-1, -1, -1, -1, -1, -1]; for (const n of addingNotes) { if (f[n.stringIndex] === -1 || n.fret < f[n.stringIndex]) f[n.stringIndex] = n.fret; } return f; })(),
      };
      onSetArpeggioPosition?.(pos);
    }
  }, [addingNotes, addingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show editing preview on fretboard
  useEffect(() => {
    if (editingTarget !== null && editingNotes.length > 0) {
      const pos: ArpeggioPosition = {
        notes: editingNotes, label: 'Editing...',
        startFret: Math.min(...editingNotes.filter(n => n.fret > 0).map(n => n.fret), 99),
        type: 'static',
        frets: (() => { const f: (number | -1)[] = [-1, -1, -1, -1, -1, -1]; for (const n of editingNotes) { if (f[n.stringIndex] === -1 || n.fret < f[n.stringIndex]) f[n.stringIndex] = n.fret; } return f; })(),
      };
      onSetArpeggioPosition?.(pos);
    }
  }, [editingNotes, editingTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click handler routing for add/edit
  useEffect(() => {
    if (!arpAddClickRef) return;
    if (addingMode) {
      arpAddClickRef.current = (si, fret) => {
        setAddingNotes(prev => { const exists = prev.findIndex(n => n.stringIndex === si && n.fret === fret); return exists >= 0 ? prev.filter((_, i) => i !== exists) : [...prev, { stringIndex: si, fret }]; });
      };
    } else if (editingTarget !== null) {
      arpAddClickRef.current = (si, fret) => {
        setEditingNotes(prev => { const exists = prev.findIndex(n => n.stringIndex === si && n.fret === fret); return exists >= 0 ? prev.filter((_, i) => i !== exists) : [...prev, { stringIndex: si, fret }]; });
      };
    } else { arpAddClickRef.current = null; }
    return () => { if (arpAddClickRef) arpAddClickRef.current = null; };
  }, [addingMode, editingTarget, arpAddClickRef]);

  // Set arp add mode
  useEffect(() => {
    if (editingTarget !== null) setArpAddMode?.(true);
    else if (!addingMode) setArpAddMode?.(false);
  }, [editingTarget, addingMode, setArpAddMode]);

  // Set reference notes for overlay
  useEffect(() => {
    if (addingMode || editingTarget !== null) setArpAddReferenceNotes?.(allChordTonePositions);
    else setArpAddReferenceNotes?.([]);
  }, [addingMode, editingTarget, allChordTonePositions, setArpAddReferenceNotes]);

  const handleSelectArp = (arpType: string) => {
    if (selectedArp === arpType) { setSelectedArp(null); onSetArpeggioPosition?.(null); return; }
    setSelectedArp(arpType); setSelectedPosIdx(0); setArpPage(0);
    onApplyScale(selectedRoot, arpType, 'arpeggio');
    const positions = generateArpeggioPositions(selectedRoot, arpType, octaveRange, tuning);
    if (positions.length > 0) onSetArpeggioPosition?.(positions[0]);
  };

  const handleRootChange = (n: NoteName) => {
    setSelectedRoot(n); setSelectedPosIdx(0); setArpPage(0);
    if (selectedArp) {
      onApplyScale(n, selectedArp, 'arpeggio');
      // Positions will recalculate via positionEntries memo
    }
  };

  const handleOctaveChange = (oct: OctaveRange) => {
    setOctaveRange(oct); setSelectedPosIdx(0); setArpPage(0);
  };

  const handleSelectPosition = (idx: number) => {
    const entry = filteredEntries[idx];
    if (!entry) return;
    const globalIdx = positionEntries.indexOf(entry);
    setSelectedPosIdx(globalIdx >= 0 ? globalIdx : idx);
    onSetArpeggioPosition?.(entry.pos);
  };

  const handlePrevPosition = () => {
    const currentEntry = positionEntries[selectedPosIdx];
    const ci = currentEntry ? filteredEntries.indexOf(currentEntry) : -1;
    const newIdx = ci <= 0 ? filteredEntries.length - 1 : ci - 1;
    handleSelectPosition(newIdx);
    setArpPage(Math.floor(newIdx / ARP_PER_PAGE));
  };

  const handleNextPosition = () => {
    const currentEntry = positionEntries[selectedPosIdx];
    const ci = currentEntry ? filteredEntries.indexOf(currentEntry) : -1;
    const newIdx = ci >= filteredEntries.length - 1 ? 0 : ci + 1;
    handleSelectPosition(newIdx);
    setArpPage(Math.floor(newIdx / ARP_PER_PAGE));
  };

  const handleDeletePosition = (entry: { kind: 'generated' | 'custom'; origIdx: number }) => {
    if (!selectedArp) return;
    const storageKey = `${selectedArp}-${octaveRange}`;
    if (entry.kind === 'generated') {
      const prev = hiddenArpPositions[storageKey] || [];
      const next = { ...hiddenArpPositions, [storageKey]: [...prev, entry.origIdx] };
      setHiddenArpPositions(next);
      localStorage.setItem('mf-hidden-arp-positions-v2', JSON.stringify(next));
    } else {
      const custom = [...(customArpPositions[storageKey] || [])];
      custom.splice(entry.origIdx, 1);
      saveCustom({ ...customArpPositions, [storageKey]: custom });
    }
    setSelectedPosIdx(0);
  };

  const handleStartAdding = () => {
    if (addingMode) {
      setAddingMode(false); setAddingNotes([]); setDetectedName(null); setDetectedRoot(null);
      setArpAddMode?.(false); setArpAddReferenceNotes?.([]);
      const entry = positionEntries[selectedPosIdx];
      if (entry) onSetArpeggioPosition?.(entry.pos);
      return;
    }
    setAddingMode(true); setAddingNotes([]); setDetectedName(null); setDetectedRoot(null); setArpAddMode?.(true);
  };

  const handleSaveCustomPosition = () => {
    if (addingNotes.length < 2 || !selectedArp) return;
    const sortedNotes = [...addingNotes].sort((a, b) => (([40, 45, 50, 55, 59, 64][a.stringIndex] || 40) + a.fret) - (([40, 45, 50, 55, 59, 64][b.stringIndex] || 40) + b.fret));
    const playedFrets = sortedNotes.filter(n => n.fret > 0).map(n => n.fret);
    const startFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
    const frets: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
    for (const n of sortedNotes) { if (frets[n.stringIndex] === -1 || n.fret < frets[n.stringIndex]) frets[n.stringIndex] = n.fret; }
    const newPos: ArpeggioPosition & { refRoot: NoteName } = { notes: sortedNotes, label: `Custom ${startFret}`, startFret, type: 'static', frets, refRoot: selectedRoot };
    const storageKey = `${selectedArp}-${octaveRange}`;
    const existing = customArpPositions[storageKey] || [];
    saveCustom({ ...customArpPositions, [storageKey]: [...existing, newPos] });
    setAddingMode(false); setAddingNotes([]); setDetectedName(null); setDetectedRoot(null);
  };

  const handleStartEditing = (entryIdx: number) => {
    const entry = positionEntries[entryIdx];
    if (!entry) return;
    setEditingTarget({ kind: entry.kind, origIdx: entry.origIdx });
    setEditingNotes([...entry.pos.notes]);
    setArpAddMode?.(true);
  };

  const handleSaveEditing = () => {
    if (editingTarget === null || !selectedArp || editingNotes.length < 2) return;
    const storageKey = `${selectedArp}-${octaveRange}`;
    const sortedNotes = [...editingNotes].sort((a, b) => (([40, 45, 50, 55, 59, 64][a.stringIndex] || 40) + a.fret) - (([40, 45, 50, 55, 59, 64][b.stringIndex] || 40) + b.fret));
    const playedFrets = sortedNotes.filter(n => n.fret > 0).map(n => n.fret);
    const startFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
    const frets: (number | -1)[] = [-1, -1, -1, -1, -1, -1];
    for (const n of sortedNotes) { if (frets[n.stringIndex] === -1 || n.fret < frets[n.stringIndex]) frets[n.stringIndex] = n.fret; }
    const newPos: ArpeggioPosition & { refRoot: NoteName } = { notes: sortedNotes, label: `Custom ${startFret}`, startFret, type: 'static', frets, refRoot: selectedRoot };

    if (editingTarget.kind === 'generated') {
      // Hide the generated position and save as custom replacement
      const prev = hiddenArpPositions[storageKey] || [];
      const nextHidden = { ...hiddenArpPositions, [storageKey]: [...prev, editingTarget.origIdx] };
      setHiddenArpPositions(nextHidden);
      localStorage.setItem('mf-hidden-arp-positions-v2', JSON.stringify(nextHidden));
      const existing = customArpPositions[storageKey] || [];
      saveCustom({ ...customArpPositions, [storageKey]: [...existing, newPos] });
    } else {
      // Replace custom in-place
      const custom = [...(customArpPositions[storageKey] || [])];
      if (editingTarget.origIdx < custom.length) custom[editingTarget.origIdx] = newPos;
      else custom.push(newPos);
      saveCustom({ ...customArpPositions, [storageKey]: custom });
    }
    setEditingTarget(null); setEditingNotes([]);
  };

  const handleCancelEditing = () => {
    setEditingTarget(null); setEditingNotes([]); setArpAddReferenceNotes?.([]);
    const entry = positionEntries[selectedPosIdx];
    if (entry) onSetArpeggioPosition?.(entry.pos);
  };

  const handleRenameSubmit = (entryIdx: number) => {
    const entry = positionEntries[entryIdx];
    if (!entry || entry.kind !== 'custom' || !selectedArp || !renameValue.trim()) { setRenamingIdx(null); return; }
    const storageKey = `${selectedArp}-${octaveRange}`;
    const custom = [...(customArpPositions[storageKey] || [])];
    if (custom[entry.origIdx]) { custom[entry.origIdx] = { ...custom[entry.origIdx], label: renameValue.trim() }; saveCustom({ ...customArpPositions, [storageKey]: custom }); }
    setRenamingIdx(null);
  };

  const splitIntoColumns = (types: string[]) => { const mid = Math.ceil(types.length / 2); return [types.slice(0, mid), types.slice(mid)]; };

  const handleHideArpType = (type: string) => {
    const next = [...hiddenArpTypes, type];
    setHiddenArpTypes(next);
    localStorage.setItem('mf-hidden-arp-types', JSON.stringify(next));
    if (selectedArp === type) { setSelectedArp(null); onSetArpeggioPosition?.(null); }
  };

  const handleRestoreArpType = (type: string) => {
    const next = hiddenArpTypes.filter(t => t !== type);
    setHiddenArpTypes(next);
    localStorage.setItem('mf-hidden-arp-types', JSON.stringify(next));
  };

  const ARPEGGIO_COLUMNS = useMemo(() => {
    return DEFAULT_ARPEGGIO_COLUMNS.map(col => ({
      ...col,
      types: col.types.filter(t => !hiddenArpTypes.includes(t)),
    }));
  }, [hiddenArpTypes]);

  const handleDragStartCat = (e: React.DragEvent, catKey: string) => { e.dataTransfer.setData('text/plain', catKey); };
  const handleDropOnCategory = (cat: 'static' | 'transit', e: React.DragEvent) => {
    e.preventDefault(); setDragOverCategory(null);
    const catKey = e.dataTransfer.getData('text/plain');
    if (!catKey) return;
    const updated = { ...arpCategories, [catKey]: cat };
    setArpCategories(updated);
    localStorage.setItem('mf-arp-categories-v2', JSON.stringify(updated));
  };

  // Update fretboard when positionEntries change and current selection is valid
  useEffect(() => {
    if (positionEntries.length > 0 && !addingMode && editingTarget === null) {
      const idx = Math.min(selectedPosIdx, positionEntries.length - 1);
      onSetArpeggioPosition?.(positionEntries[idx].pos);
      if (idx !== selectedPosIdx) setSelectedPosIdx(idx);
    } else if (positionEntries.length === 0 && !addingMode && editingTarget === null) {
      onSetArpeggioPosition?.(null);
    }
  }, [positionEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  const arpTotalPages = Math.ceil(filteredEntries.length / ARP_PER_PAGE);
  const pagedEntries = filteredEntries.slice(arpPage * ARP_PER_PAGE, (arpPage + 1) * ARP_PER_PAGE);

  return (
    <>
      {/* Root selector + controls in one horizontal row */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <RootSelector selectedRoot={selectedRoot} setSelectedRoot={handleRootChange} />
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 mr-1">
            <span className="text-[8px] font-mono text-muted-foreground uppercase font-bold">Oct</span>
            {([1, 2, 3] as OctaveRange[]).map(oct => (
              <button key={oct} onClick={() => handleOctaveChange(oct)}
                className={`px-1.5 py-1 rounded text-[9px] font-mono font-bold transition-colors ${
                  octaveRange === oct ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >{oct}</button>
            ))}
          </div>
          <button onClick={() => handleStartEditing(selectedPosIdx)}
            disabled={editingTarget !== null || addingMode || positionEntries.length === 0}
            className="px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider font-bold transition-colors bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-30">Edit</button>
          <button onClick={handleStartAdding}
            className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider font-bold transition-colors ${addingMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Add</button>
          <button onClick={() => setArpPathVisible(!arpPathVisible)}
            className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider font-bold transition-colors ${arpPathVisible ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Path</button>
          <button onClick={handlePrevPosition} disabled={filteredEntries.length === 0}
            className="px-2 py-1 rounded text-[9px] font-mono font-bold transition-colors bg-secondary text-secondary-foreground hover:bg-muted disabled:opacity-30">◀ Prev</button>
          <button onClick={handleNextPosition} disabled={filteredEntries.length === 0}
            className="px-2 py-1 rounded text-[9px] font-mono font-bold transition-colors bg-secondary text-secondary-foreground hover:bg-muted disabled:opacity-30">Next ▶</button>
        </div>
      </div>

      {/* Adding mode UI */}
      {addingMode && (
        <div className="bg-accent/10 border border-accent/30 rounded p-1.5 mb-1">
          <div className="text-[9px] font-mono text-foreground font-bold mb-0.5">🎸 Click chord tones to build shape</div>
          <div className="text-[8px] font-mono text-muted-foreground mb-1">Applies to ALL keys via transposition.</div>
          {detectedName && <div className="text-[9px] font-mono text-primary mb-1">Detected: <strong>{detectedRoot} {detectedName}</strong></div>}
          <div className="flex gap-1">
            <button onClick={handleSaveCustomPosition} disabled={addingNotes.length < 2}
              className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-30 transition-colors">Save</button>
            <button onClick={handleStartAdding}
              className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Editing mode UI */}
      {editingTarget !== null && (
        <div className="bg-accent/10 border border-accent/30 rounded p-1.5 mb-1">
          <div className="text-[9px] font-mono text-foreground font-bold mb-0.5">✏️ Click to add/remove notes — replaces for ALL keys</div>
          <div className="flex gap-1">
            <button onClick={handleSaveEditing} disabled={editingNotes.length < 2}
              className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-30 transition-colors">Save</button>
            <button onClick={handleCancelEditing}
              className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-1">
        {/* Arpeggio type columns */}
        <div className="flex gap-px shrink-0" style={{ width: '35%' }}>
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
                          <div key={ct} className="relative group">
                            <button onClick={() => handleSelectArp(ct)}
                              className={`w-full text-left px-1 py-0.5 rounded border text-[9px] font-mono transition-all truncate leading-tight ${
                                isSelected ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]' : 'bg-muted/60 border-border/30 text-foreground/80 hover:bg-muted hover:border-border/60'
                              }`}
                            >{ct}</button>
                            <button onClick={(e) => { e.stopPropagation(); handleHideArpType(ct); }}
                              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-destructive text-destructive-foreground text-[7px] items-center justify-center hover:brightness-110 z-10 hidden group-hover:flex">×</button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {hiddenArpTypes.length > 0 && (
            <div className="mt-0.5">
              <button onClick={() => setShowRestoreArpTypes(!showRestoreArpTypes)}
                className="text-[7px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                {showRestoreArpTypes ? '▾' : '▸'} {hiddenArpTypes.length} hidden
              </button>
              {showRestoreArpTypes && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {hiddenArpTypes.map(t => (
                    <button key={t} onClick={() => handleRestoreArpType(t)}
                      className="px-1 py-0.5 rounded text-[7px] font-mono bg-muted/40 text-muted-foreground hover:bg-muted border border-border/30 transition-colors">
                      + {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>


        <div className="flex-1 min-w-0">
          {selectedArp ? (
            <div className="bg-secondary/20 rounded p-1">

              {filteredEntries.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="text-[8px] font-mono text-muted-foreground">{filteredEntries.length} pos</div>
                    {arpTotalPages > 1 && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setArpPage(Math.max(0, arpPage - 1))} disabled={arpPage === 0}
                          className="px-1 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors">◀</button>
                        <span className="text-[7px] font-mono text-muted-foreground">{arpPage + 1}/{arpTotalPages}</span>
                        <button onClick={() => setArpPage(Math.min(arpTotalPages - 1, arpPage + 1))} disabled={arpPage >= arpTotalPages - 1}
                          className="px-1 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors">▶</button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-0.5 mb-1">
                    <button
                      onClick={() => setCategoryFilter(categoryFilter === 'static' ? 'all' : 'static')}
                      onDragOver={(e) => { e.preventDefault(); setDragOverCategory('static'); }}
                      onDragLeave={() => setDragOverCategory(null)}
                      onDrop={(e) => handleDropOnCategory('static', e)}
                      style={{
                        backgroundColor: categoryFilter === 'static' ? `hsl(${STATIC_COLOR})` : `hsl(${STATIC_COLOR} / 0.15)`,
                        color: categoryFilter === 'static' ? '#fff' : `hsl(${STATIC_COLOR})`,
                        borderColor: categoryFilter === 'static' ? `hsl(${STATIC_COLOR})` : `hsl(${STATIC_COLOR} / 0.4)`,
                      }}
                      className="flex-1 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all border-2 hover:brightness-110">▪ Static</button>
                    <button
                      onClick={() => setCategoryFilter(categoryFilter === 'transit' ? 'all' : 'transit')}
                      onDragOver={(e) => { e.preventDefault(); setDragOverCategory('transit'); }}
                      onDragLeave={() => setDragOverCategory(null)}
                      onDrop={(e) => handleDropOnCategory('transit', e)}
                      style={{
                        backgroundColor: categoryFilter === 'transit' ? `hsl(${TRANSIT_COLOR})` : `hsl(${TRANSIT_COLOR} / 0.15)`,
                        color: categoryFilter === 'transit' ? '#fff' : `hsl(${TRANSIT_COLOR})`,
                        borderColor: categoryFilter === 'transit' ? `hsl(${TRANSIT_COLOR})` : `hsl(${TRANSIT_COLOR} / 0.4)`,
                      }}
                      className="flex-1 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all border-2 hover:brightness-110">↗ Transit</button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {pagedEntries.map((entry, i) => {
                      const globalIdx = positionEntries.indexOf(entry);
                      const isActive = selectedPosIdx === globalIdx;
                      const isRenaming = renamingIdx === globalIdx;
                      const posCat = arpCategories[entry.catKey];
                      return (
                        <div key={i} className="relative">
                          <button
                            draggable
                            onDragStart={(e) => handleDragStartCat(e, entry.catKey)}
                            onClick={() => handleSelectPosition(filteredEntries.indexOf(entry))}
                            onDoubleClick={(e) => { e.stopPropagation(); handleStartEditing(globalIdx); }}
                            className={`w-full rounded p-1 transition-all border flex flex-col items-center justify-center ${
                              isActive ? 'shadow-[0_0_6px_hsl(var(--primary)/0.3)]' : 'hover:bg-muted/50'
                            }`}
                            style={{
                              borderColor: isActive ? 'hsl(var(--primary))' : posCat === 'static' ? `hsl(${STATIC_COLOR} / 0.5)` : posCat === 'transit' ? `hsl(${TRANSIT_COLOR} / 0.5)` : 'hsl(var(--border) / 0.3)',
                              backgroundColor: isActive
                                ? (posCat === 'static' ? `hsl(${STATIC_COLOR} / 0.3)` : posCat === 'transit' ? `hsl(${TRANSIT_COLOR} / 0.3)` : 'hsl(var(--primary) / 0.1)')
                                : (posCat === 'static' ? `hsl(${STATIC_COLOR} / 0.2)` : posCat === 'transit' ? `hsl(${TRANSIT_COLOR} / 0.2)` : undefined),
                            }}
                          >
                            <MiniArpDiagram position={entry.pos} root={selectedRoot} large />
                            <div className="flex items-center justify-center gap-0.5">
                              {isRenaming ? (
                                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={() => handleRenameSubmit(globalIdx)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(globalIdx); if (e.key === 'Escape') setRenamingIdx(null); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 text-[7px] font-mono text-center bg-muted border border-border rounded px-0.5" />
                              ) : (
                                <>
                                  <span className="text-[7px] font-mono text-muted-foreground">{entry.pos.label}</span>
                                  {posCat && <span className="text-[6px] font-mono font-bold" style={{ color: posCat === 'static' ? `hsl(${STATIC_COLOR})` : `hsl(${TRANSIT_COLOR})` }}>{posCat === 'static' ? '▪' : '↗'}</span>}
                                </>
                              )}
                            </div>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeletePosition(entry); }}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center hover:brightness-110 z-10">×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-[8px] font-mono text-muted-foreground text-center py-2">
                  No positions{categoryFilter !== 'all' ? ` (${categoryFilter})` : ''}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[9px] font-mono text-muted-foreground text-center py-2">Select an arpeggio type.</div>
          )}
        </div>
      </div>
    </>
  );
}

function MiniArpDiagram({ position, root, large }: { position: ArpeggioPosition; root: NoteName; large?: boolean }) {
  if (!position.notes || position.notes.length === 0) return null;
  const playedFrets = position.notes.filter(n => n.fret > 0).map(n => n.fret);
  const allFrets = position.notes.map(n => n.fret);
  const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
  const maxFret = Math.max(...allFrets, minFret + 4);
  const startFret = Math.max(0, minFret);
  const numFrets = Math.max(4, maxFret - startFret + 1);
  const w = large ? 70 : 50;
  const h = large ? 80 : 40;
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
      <svg width={w} height={h + 6} className="shrink-0">
        {Array.from({ length: numFrets + 1 }, (_, i) => (
          <line key={i} x1={stringSpacing} y1={5 + i * fretSpacing} x2={stringSpacing * 6} y2={5 + i * fretSpacing} stroke="hsl(var(--border))" strokeWidth={0.5} />
        ))}
        {[1, 2, 3, 4, 5, 6].map(s => (
          <line key={s} x1={s * stringSpacing} y1={5} x2={s * stringSpacing} y2={5 + numFrets * fretSpacing} stroke="hsl(var(--fretboard-string))" strokeWidth={0.5} opacity={0.5} />
        ))}
        {startFret > 0 && (
          <text x={1} y={5 + fretSpacing * 0.6} fontSize={large ? 8 : 4} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
        )}
        {startFret <= 1 && large && (
          <line x1={stringSpacing} y1={5} x2={stringSpacing * 6} y2={5} stroke="hsl(var(--fretboard-nut))" strokeWidth={2} />
        )}
        {/* Muted strings */}
        {[0, 1, 2, 3, 4, 5].map(s => {
          if (notesByString.has(s)) return null;
          const x = (s + 1) * stringSpacing;
          return <text key={`m${s}`} x={x} y={large ? 4 : 3} fontSize={large ? 7 : 5} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="monospace">×</text>;
        })}
        {/* Notes */}
        {position.notes.map((n, i) => {
          const x = (n.stringIndex + 1) * stringSpacing;
          if (n.fret === 0) return <circle key={i} cx={x} cy={large ? 4 : 3} r={large ? 2.5 : 1.5} fill="none" stroke="hsl(var(--foreground))" strokeWidth={large ? 1 : 0.5} />;
          const y = 5 + (n.fret - startFret + 0.5) * fretSpacing;
          const note = noteAtFret(n.stringIndex, n.fret);
          const interval = getIntervalName(root, note);
          const degColor = DEGREE_COLORS[interval];
          const fillColor = degColor ? `hsl(${degColor})` : 'hsl(var(--primary))';
          return <circle key={i} cx={x} cy={y} r={large ? 5.5 : 2.5} fill={fillColor} />;
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
