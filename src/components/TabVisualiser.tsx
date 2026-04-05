import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import Tesseract from 'tesseract.js';

export interface TabNote {
  string: number; // 0-5 (high E to low E)
  fret: number;
  position: number; // sequential position in the tab
}

export interface TabData {
  notes: TabNote[][];  // grouped by position (simultaneous notes)
  fileName: string;
}

interface TabVisualiserProps {
  tuning: number[];
  tuningLabels: string[];
  onTabNotes?: (current: TabNote[], upcoming: TabNote[][]) => void;
}

export default function TabVisualiser({ tuning, tuningLabels, onTabNotes }: TabVisualiserProps) {
  const [tabData, setTabData] = useState<TabData | null>(null);
  const [playheadPos, setPlayheadPos] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Emit current + upcoming notes to parent for fretboard display
  useEffect(() => {
    if (!tabData || !onTabNotes) return;
    const current = tabData.notes[playheadPos] || [];
    const upcoming: TabNote[][] = [];
    for (let i = 1; i <= 3; i++) {
      if (playheadPos + i < tabData.notes.length) {
        upcoming.push(tabData.notes[playheadPos + i]);
      }
    }
    onTabNotes(current, upcoming);
  }, [tabData, playheadPos, onTabNotes]);

  const parseTabFromText = useCallback((text: string): TabNote[][] => {
    const lines = text.split('\n');
    // Find groups of 6 consecutive lines that look like tab lines
    // Tab lines typically start with a letter and | or - pattern, e.g. e|---0---2---|
    const tabLinePattern = /^[eEbBgGdDaA]\|?[\s]*[-\d|hpbsrx\/\\~\s]+$/i;
    const numberPattern = /\d+/g;

    const tabGroups: string[][] = [];
    let currentGroup: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 3) {
        if (currentGroup.length >= 4) tabGroups.push([...currentGroup]);
        currentGroup = [];
        continue;
      }
      // Check if line has dashes and numbers (tab-like)
      const dashCount = (trimmed.match(/-/g) || []).length;
      const hasNumbers = /\d/.test(trimmed);
      if (dashCount >= 3 || (hasNumbers && trimmed.includes('-'))) {
        currentGroup.push(trimmed);
      } else {
        if (currentGroup.length >= 4) tabGroups.push([...currentGroup]);
        currentGroup = [];
      }
    }
    if (currentGroup.length >= 4) tabGroups.push([...currentGroup]);

    const allPositions: TabNote[][] = [];

    for (const group of tabGroups) {
      // Take the last 6 lines if more (or fewer if less)
      const tabLines = group.slice(-6);
      while (tabLines.length < 6) tabLines.unshift('');

      // For each column position, collect notes
      const maxLen = Math.max(...tabLines.map(l => l.length));

      let col = 0;
      while (col < maxLen) {
        const notesAtPos: TabNote[] = [];
        let maxDigitLen = 1;

        for (let si = 0; si < tabLines.length; si++) {
          const line = tabLines[si];
          if (col >= line.length) continue;
          const ch = line[col];
          if (/\d/.test(ch)) {
            // Check for double-digit fret numbers
            let numStr = ch;
            if (col + 1 < line.length && /\d/.test(line[col + 1])) {
              numStr += line[col + 1];
              maxDigitLen = Math.max(maxDigitLen, 2);
            }
            notesAtPos.push({
              string: si, // 0 = top line (high E), 5 = bottom line (low E)
              fret: parseInt(numStr, 10),
              position: allPositions.length,
            });
          }
        }

        if (notesAtPos.length > 0) {
          // Update position index
          const posIdx = allPositions.length;
          notesAtPos.forEach(n => n.position = posIdx);
          allPositions.push(notesAtPos);
        }

        col += maxDigitLen;
      }
    }

    return allPositions;
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
      if (file.type === 'application/pdf') {
        setError('PDF support requires converting to image first. Please upload an image (PNG, JPG) of the tablature.');
        setIsLoading(false);
        return;
      }

      // Use Tesseract.js OCR to extract text from image
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setLoadingProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text = result.data.text;
      console.log('OCR Result:', text);

      const positions = parseTabFromText(text);

      if (positions.length === 0) {
        setError('Could not detect any tablature in this image. Try a clearer image with visible tab lines and numbers.');
        setIsLoading(false);
        return;
      }

      setTabData({
        notes: positions,
        fileName: file.name,
      });
      setPlayheadPos(0);
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to process image. Please try a different file.');
    } finally {
      setIsLoading(false);
    }
  }, [parseTabFromText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleNext = () => {
    if (tabData && playheadPos < tabData.notes.length - 1) {
      setPlayheadPos(p => p + 1);
    }
  };

  const handlePrev = () => {
    if (playheadPos > 0) {
      setPlayheadPos(p => p - 1);
    }
  };

  // Playhead drag on timeline
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    if (!tabData || !timelineRef.current) return;
    setIsDraggingPlayhead(true);
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = Math.round((x / rect.width) * (tabData.notes.length - 1));
    setPlayheadPos(Math.max(0, Math.min(pos, tabData.notes.length - 1)));
  }, [tabData]);

  useEffect(() => {
    if (!isDraggingPlayhead) return;
    const onMove = (e: MouseEvent) => {
      if (!tabData || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pos = Math.round((x / rect.width) * (tabData.notes.length - 1));
      setPlayheadPos(Math.max(0, Math.min(pos, tabData.notes.length - 1)));
    };
    const onUp = () => setIsDraggingPlayhead(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDraggingPlayhead, tabData]);

  // Reversed labels for display (low E at bottom)
  const displayLabels = useMemo(() => [...tuningLabels].reverse(), [tuningLabels]);

  // Timeline visible window
  const visibleWindow = 40; // show ~40 positions at a time
  const windowStart = Math.max(0, playheadPos - Math.floor(visibleWindow / 4));
  const windowEnd = tabData ? Math.min(tabData.notes.length, windowStart + visibleWindow) : 0;

  if (!tabData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-primary/40 rounded-xl p-10 cursor-pointer hover:border-primary/70 hover:bg-primary/5 transition-all flex flex-col items-center gap-4 max-w-md w-full"
        >
          <Upload className="w-12 h-12 text-primary/60" />
          <div className="text-center">
            <p className="text-sm font-mono text-foreground font-bold mb-1">Upload Guitar Tablature</p>
            <p className="text-[10px] font-mono text-muted-foreground">
              Drag & drop an image (PNG, JPG) of guitar tab, or click to browse.
            </p>
          </div>
          {isLoading && (
            <div className="w-full">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${loadingProgress}%` }} />
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mt-1 text-center">
                Scanning tablature... {loadingProgress}%
              </p>
            </div>
          )}
          {error && (
            <p className="text-[10px] font-mono text-destructive text-center">{error}</p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* File info bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <span className="text-[9px] font-mono text-muted-foreground truncate flex-1">
          📄 {tabData.fileName} — {tabData.notes.length} positions
        </span>
        <button
          onClick={() => { setTabData(null); setPlayheadPos(0); setError(null); }}
          className="text-[9px] font-mono text-destructive hover:text-destructive/80 uppercase tracking-wider"
        >
          Clear
        </button>
      </div>

      {/* Digital Tab Timeline */}
      <div className="flex-1 px-3 py-2 overflow-hidden">
        {/* String labels + tab grid */}
        <div className="flex gap-1 h-full">
          {/* String labels column */}
          <div className="flex flex-col justify-between py-1 pr-1 shrink-0">
            {displayLabels.map((label, i) => (
              <div key={i} className="text-[9px] font-mono text-muted-foreground w-4 text-right leading-none">
                {label}
              </div>
            ))}
          </div>

          {/* Timeline grid */}
          <div
            ref={timelineRef}
            className="flex-1 relative cursor-pointer select-none"
            onMouseDown={handleTimelineMouseDown}
          >
            {/* String lines */}
            {[0, 1, 2, 3, 4, 5].map(si => {
              const y = `${(si / 5) * 100}%`;
              return (
                <div
                  key={si}
                  className="absolute left-0 right-0 border-t border-muted-foreground/20"
                  style={{ top: y }}
                />
              );
            })}

            {/* Notes in visible window */}
            {tabData.notes.slice(windowStart, windowEnd).map((posNotes, wi) => {
              const posIdx = windowStart + wi;
              const x = ((wi) / (visibleWindow - 1)) * 100;
              const isCurrent = posIdx === playheadPos;
              const isUpcoming = posIdx > playheadPos && posIdx <= playheadPos + 3;

              return posNotes.map((note, ni) => {
                // Reverse string index for display (0=high E at top → 5=low E at bottom)
                const displaySi = 5 - note.string;
                const y = (displaySi / 5) * 100;

                return (
                  <div
                    key={`${posIdx}-${ni}`}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      opacity: isCurrent ? 1 : isUpcoming ? 0.6 : 0.3,
                      zIndex: isCurrent ? 10 : isUpcoming ? 5 : 1,
                    }}
                  >
                    <span
                      className={`text-[11px] font-mono font-bold leading-none ${
                        isCurrent ? 'text-primary' : isUpcoming ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                      style={{
                        textShadow: isCurrent
                          ? '0 0 8px hsl(var(--primary)), 0 0 16px hsl(var(--primary) / 0.5)'
                          : 'none',
                      }}
                    >
                      {note.fret}
                    </span>
                  </div>
                );
              });
            })}

            {/* Playhead line */}
            {tabData.notes.length > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
                style={{
                  left: `${((playheadPos - windowStart) / (visibleWindow - 1)) * 100}%`,
                  boxShadow: '0 0 6px hsl(var(--primary)), 0 0 12px hsl(var(--primary) / 0.4)',
                }}
              >
                {/* Playhead triangle */}
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
                  style={{
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '6px solid hsl(var(--primary))',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-center gap-6 py-3 border-t border-border">
        <button
          onClick={handlePrev}
          disabled={playheadPos <= 0}
          className="w-16 h-16 flex items-center justify-center rounded-xl bg-primary/10 hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-10 h-10 text-primary" />
        </button>

        <div className="text-center min-w-[80px]">
          <div className="text-lg font-mono font-bold text-foreground">
            {playheadPos + 1} / {tabData.notes.length}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Position</div>
        </div>

        <button
          onClick={handleNext}
          disabled={!tabData || playheadPos >= tabData.notes.length - 1}
          className="w-16 h-16 flex items-center justify-center rounded-xl bg-primary/10 hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-10 h-10 text-primary" />
        </button>
      </div>
    </div>
  );
}
