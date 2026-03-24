import { useState, useMemo } from 'react';
import { useFretboard } from '@/hooks/useFretboard';
import type { ChordSelection } from '@/hooks/useFretboard';
import { useSongTimeline } from '@/hooks/useSongTimeline';
import { useMidiEngine } from '@/hooks/useMidiEngine';
import Fretboard from '@/components/Fretboard';
import ControlPanel from '@/components/ControlPanel';
import NoteInfoPanel from '@/components/NoteInfoPanel';
import ChordReference from '@/components/ChordReference';
import SongTimeline from '@/components/SongTimeline';
import type { NoteName } from '@/lib/music';
import { TUNING_PRESETS, NOTE_NAMES, getChordTones, type TuningPreset, type KeyMode, type ArpeggioPosition } from '@/lib/music';

const Index = () => {
  const fb = useFretboard();
  const timeline = useSongTimeline();
  const midi = useMidiEngine();
  const [showCustomTuning, setShowCustomTuning] = useState(false);
  const [customTuningName, setCustomTuningName] = useState('');
  const [customTuningNotes, setCustomTuningNotes] = useState<number[]>([4, 9, 2, 7, 11, 4]);
  const [volume, setVolume] = useState(0.7);
  const [timelineKey, setTimelineKey] = useState<NoteName>('E');
  const [keyMode, setKeyMode] = useState<KeyMode>('major');

  const handleApplyChord = (chord: ChordSelection) => {
    fb.setActiveChord(chord);
  };

  const handleApplyArpeggio = (root: NoteName, arpeggioName: string) => {
    fb.setPrimaryScale({ mode: 'arpeggio', root, scale: arpeggioName });
    fb.setActiveChord(null);
  };

  const handleApplySecondaryArpeggio = (root: NoteName, arpeggioName: string) => {
    fb.setSecondaryEnabled(true);
    fb.setSecondaryScale({ mode: 'arpeggio', root, scale: arpeggioName });
  };

  const handlePlay = () => {
    timeline.setIsPlaying(true);
    midi.setVolume(volume);
    midi.play(
      timeline.chords,
      timeline.measures,
      timeline.bpm,
      timeline.genre,
      (beat) => timeline.setCurrentBeat(beat),
      () => timeline.setIsPlaying(false),
    );
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    midi.setVolume(v);
  };

  const handleStop = () => {
    timeline.setIsPlaying(false);
    timeline.setCurrentBeat(0);
    midi.stop();
  };

  const handleSeek = (beat: number) => {
    timeline.setCurrentBeat(beat);
    if (timeline.isPlaying) {
      handleStop();
    }
  };

  const isVertical = fb.orientation === 'vertical';

  // Compute playing chord tones for reactive fretboard
  const playingChordTones = useMemo(() => {
    if (!timeline.isPlaying && timeline.currentBeat === 0) return undefined;
    const current = timeline.chords.find(c => timeline.currentBeat >= c.startBeat && timeline.currentBeat < c.startBeat + c.duration);
    if (!current) return undefined;
    return new Set(getChordTones(current.root, current.chordType));
  }, [timeline.isPlaying, timeline.currentBeat, timeline.chords]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-display font-bold text-foreground tracking-tight">
          <span className="text-primary">Maps</span> &amp; <span className="text-primary">Facts</span> for Jazz Cats
        </h1>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Guitar Fretboard Visualizer
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Side panel — controls */}
        <aside className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto">
          <div className="p-3">
            <ControlPanel
              primaryScale={fb.primaryScale}
              setPrimaryScale={fb.setPrimaryScale}
              secondaryScale={fb.secondaryScale}
              setSecondaryScale={fb.setSecondaryScale}
              secondaryEnabled={fb.secondaryEnabled}
              setSecondaryEnabled={fb.setSecondaryEnabled}
              activePrimary={fb.activePrimary}
              setActivePrimary={fb.setActivePrimary}
              secondaryOpacity={fb.secondaryOpacity}
              setSecondaryOpacity={fb.setSecondaryOpacity}
              secondaryColor={fb.secondaryColor}
              setSecondaryColor={fb.setSecondaryColor}
              primaryColor={fb.primaryColor}
              setPrimaryColor={fb.setPrimaryColor}
              condensed={fb.secondaryEnabled}
            />
          </div>
        </aside>

        {/* Main area */}
        <main className={`flex-1 flex ${isVertical ? 'flex-row' : 'flex-col'} min-w-0 overflow-auto`}>
          {/* Toolbar above fretboard */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap shrink-0">
            {/* Orientation toggle */}
            <button
              onClick={() => fb.setOrientation(fb.orientation === 'horizontal' ? 'vertical' : 'horizontal')}
              className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              {fb.orientation === 'horizontal' ? '⬇ Vertical' : '➡ Horizontal'}
            </button>

            {/* Display mode toggle */}
            <button
              onClick={() => fb.setDisplayMode(fb.displayMode === 'notes' ? 'degrees' : fb.displayMode === 'degrees' ? 'fingers' : 'notes')}
              className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              {fb.displayMode === 'notes' ? '♪ Notes' : fb.displayMode === 'degrees' ? '° Degrees' : '✋ Fingers'}
            </button>

            {/* Tuning dropdown */}
            <div className="relative">
              <select
                value={fb.tuningName}
                onChange={e => {
                  const name = e.target.value;
                  if (name === '__custom__') {
                    setShowCustomTuning(true);
                    return;
                  }
                  const allTunings = [...TUNING_PRESETS, ...fb.customTunings];
                  const preset = allTunings.find(t => t.name === name);
                  if (preset) fb.setTuning(preset);
                }}
                className="text-secondary-foreground text-[10px] font-mono uppercase tracking-wider rounded-md px-2 py-1 border appearance-none" style={{ backgroundColor: 'hsl(210, 70%, 80%, 0.2)', borderColor: 'hsl(210, 60%, 70%, 0.4)' }}
              >
                {[...TUNING_PRESETS, ...fb.customTunings].map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
                <option value="__custom__">+ Custom...</option>
              </select>
            </div>

            {/* Marker size slider */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-mono text-muted-foreground uppercase">Size:</span>
              <input
                type="range" min={12} max={32} value={fb.noteMarkerSize}
                onChange={e => fb.setNoteMarkerSize(Number(e.target.value))}
                className="w-16 accent-primary"
              />
            </div>

            {/* Fret count */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[9px] font-mono text-muted-foreground uppercase">Frets:</span>
              <input
                type="range" min={12} max={24} value={fb.maxFrets}
                onChange={e => fb.setMaxFrets(Number(e.target.value))}
                className="w-20 accent-primary"
              />
              <span className="text-[10px] font-mono text-muted-foreground w-5">{fb.maxFrets}</span>
            </div>

            {/* Reset */}
            <button
              onClick={fb.clearFretboard}
              className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Fretboard */}
          <div className={`${isVertical ? 'flex-1' : ''} p-4 flex items-center justify-center`}>
            <Fretboard
              maxFrets={fb.maxFrets}
              primaryScale={fb.primaryScale}
              secondaryScale={fb.secondaryScale}
              secondaryEnabled={fb.secondaryEnabled}
              activePrimary={fb.activePrimary}
              noteColors={fb.noteColors}
              onNoteClick={fb.identifyMode ? (note) => {} : fb.setSelectedNote}
              displayMode={fb.displayMode}
              disabledStrings={fb.disabledStrings}
              onToggleString={fb.toggleStringDisabled}
              secondaryOpacity={fb.secondaryOpacity}
              secondaryColor={fb.secondaryColor}
              primaryColor={fb.primaryColor}
              activeChord={fb.activeChord}
              orientation={fb.orientation}
              showFretBox={fb.showFretBox}
              fretBoxStart={fb.fretBoxStart}
              fretBoxSize={fb.fretBoxSize}
              setFretBoxStart={fb.setFretBoxStart}
              setFretBoxSize={fb.setFretBoxSize}
              fretBoxStringStart={fb.fretBoxStringStart}
              fretBoxStringSize={fb.fretBoxStringSize}
              setFretBoxStringStart={fb.setFretBoxStringStart}
              setFretBoxStringSize={fb.setFretBoxStringSize}
              noteMarkerSize={fb.noteMarkerSize}
              degreeColors={fb.degreeColors}
              setDegreeColors={fb.setDegreeColors}
              disabledDegrees={fb.disabledDegrees}
              toggleDegree={fb.toggleDegree}
              setShowFretBox={fb.setShowFretBox}
              identifyMode={fb.identifyMode}
              identifyFrets={fb.identifyFrets}
              setIdentifyFrets={fb.setIdentifyFrets}
              identifyRoot={fb.identifyRoot}
              tuning={fb.tuning}
              tuningLabels={fb.tuningLabels}
              playingChordTones={playingChordTones}
              arpeggioPosition={fb.arpeggioPosition}
            />
          </div>

          {/* Chords panel — below (horizontal) or right side (vertical) */}
          <div className={`border-${isVertical ? 'l' : 't'} border-border shrink-0 overflow-y-auto ${isVertical ? 'w-72' : 'max-h-[45vh]'}`}>
            <ChordReference
              activeChord={fb.activeChord}
              setActiveChord={fb.setActiveChord}
              showCAGED={fb.showCAGED}
              setShowCAGED={fb.setShowCAGED}
              cagedShape={fb.cagedShape}
              setCagedShape={fb.setCagedShape}
              cagedRoot={fb.primaryScale.root}
              identifyMode={fb.identifyMode}
              setIdentifyMode={fb.setIdentifyMode}
              identifyFrets={fb.identifyFrets}
              setIdentifyFrets={fb.setIdentifyFrets}
              degreeColors={fb.degreeColors}
              identifyRoot={fb.identifyRoot}
              setIdentifyRoot={fb.setIdentifyRoot}
              tuning={fb.tuning}
              tuningLabels={fb.tuningLabels}
              timelineChords={timeline.chords}
              currentBeat={timeline.currentBeat}
              isPlaying={timeline.isPlaying}
              timelineKey={timelineKey}
              keyMode={keyMode}
              onApplyScale={(root, scale, mode) => {
                fb.setPrimaryScale({ mode, root, scale });
                fb.setActiveChord(null);
              }}
               onSeekToChord={(beat) => handleSeek(beat)}
               onSetArpeggioPosition={fb.setArpeggioPosition}
            />
          </div>
        </main>
      </div>

      {/* Song Timeline — fixed at bottom */}
      <SongTimeline
        chords={timeline.chords}
        measures={timeline.measures}
        setMeasures={timeline.setMeasures}
        bpm={timeline.bpm}
        setBpm={timeline.setBpm}
        genre={timeline.genre}
        setGenre={timeline.setGenre}
        snap={timeline.snap}
        setSnap={timeline.setSnap}
        isPlaying={timeline.isPlaying}
        currentBeat={timeline.currentBeat}
        panelHeight={timeline.panelHeight}
        setPanelHeight={timeline.setPanelHeight}
        onPlay={handlePlay}
        onStop={handleStop}
        onAddChord={timeline.addChord}
        onMoveChord={timeline.moveChord}
        onResizeChord={timeline.resizeChord}
        onRemoveChord={timeline.removeChord}
        onClearTimeline={timeline.clearTimeline}
        onTrimOverlaps={timeline.trimOverlaps}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        timelineKey={timelineKey}
        setTimelineKey={setTimelineKey}
        keyMode={keyMode}
        setKeyMode={setKeyMode}
        onSeek={handleSeek}
      />

      <NoteInfoPanel
        note={fb.selectedNote}
        noteColors={fb.noteColors}
        onClose={() => fb.setSelectedNote(null)}
        onApplyChord={handleApplyChord}
        onApplyArpeggio={handleApplyArpeggio}
        onApplySecondaryArpeggio={handleApplySecondaryArpeggio}
        activeScale={fb.primaryScale}
      />

      {/* Custom tuning dialog */}
      {showCustomTuning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCustomTuning(false)}>
          <div className="bg-card border border-border rounded-lg p-4 shadow-xl w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-mono font-bold text-foreground mb-3">Custom Tuning</h3>
            <div className="space-y-2 mb-3">
              <input
                type="text"
                placeholder="Tuning name"
                value={customTuningName}
                onChange={e => setCustomTuningName(e.target.value)}
                className="w-full bg-muted text-foreground text-sm rounded-md px-2 py-1.5 border border-border font-mono"
              />
              <div className="grid grid-cols-6 gap-1">
                {['6th', '5th', '4th', '3rd', '2nd', '1st'].map((label, i) => (
                  <div key={i} className="text-center">
                    <div className="text-[8px] font-mono text-muted-foreground mb-0.5">{label}</div>
                    <select
                      value={customTuningNotes[i]}
                      onChange={e => {
                        const next = [...customTuningNotes];
                        next[i] = Number(e.target.value);
                        setCustomTuningNotes(next);
                      }}
                      className="w-full bg-muted text-foreground text-[10px] rounded border border-border font-mono px-0.5 py-1"
                    >
                      {NOTE_NAMES.map((n, ni) => (
                        <option key={n} value={ni}>{n}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!customTuningName.trim()) return;
                  const labels = customTuningNotes.map((n, i) => i === 5 ? NOTE_NAMES[n].toLowerCase() : NOTE_NAMES[n]);
                  const preset = { name: customTuningName.trim(), notes: [...customTuningNotes], labels };
                  fb.setCustomTunings([...fb.customTunings, preset]);
                  fb.setTuning(preset);
                  setShowCustomTuning(false);
                  setCustomTuningName('');
                }}
                className="flex-1 px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >Save & Apply</button>
              <button
                onClick={() => setShowCustomTuning(false)}
                className="px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
