import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:...;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const imageBase64 = await fileToBase64(file);

      const { data, error: fnError } = await supabase.functions.invoke('parse-tab-image', {
        body: { imageBase64, mimeType: file.type || 'image/png' },
      });

      if (fnError) {
        setError(fnError.message || 'Failed to process image.');
        setIsLoading(false);
        return;
      }

      if (!data?.success || !data?.positions) {
        setError(data?.error || 'Could not detect tablature in this image.');
        setIsLoading(false);
        return;
      }

      // Convert AI response to TabNote format
      const positions: TabNote[][] = data.positions.map((pos: Array<{string: number; fret: number}>, posIdx: number) => 
        pos.map(n => ({
          string: n.string,
          fret: n.fret,
          position: posIdx,
        }))
      );

      if (positions.length === 0) {
        setError('No tablature positions found in the image.');
        setIsLoading(false);
        return;
      }

      setTabData({ notes: positions, fileName: file.name });
      setPlayheadPos(0);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to process image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  const visibleWindow = 40;
  const windowStart = Math.max(0, playheadPos - Math.floor(visibleWindow / 4));
  const windowEnd = tabData ? Math.min(tabData.notes.length, windowStart + visibleWindow) : 0;

  if (!tabData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`border-2 border-dashed border-primary/40 rounded-xl p-10 cursor-pointer hover:border-primary/70 hover:bg-primary/5 transition-all flex flex-col items-center gap-4 max-w-md w-full ${isLoading ? 'pointer-events-none opacity-70' : ''}`}
        >
          <Upload className="w-12 h-12 text-primary/60" />
          <div className="text-center">
            <p className="text-sm font-mono text-foreground font-bold mb-1">Upload Guitar Tablature</p>
            <p className="text-[10px] font-mono text-muted-foreground">
              Drag & drop an image (PNG, JPG) of guitar tab, or click to browse.
            </p>
          </div>
          {isLoading && (
            <div className="w-full flex flex-col items-center gap-2">
              <div className="h-2 bg-secondary rounded-full overflow-hidden w-full">
                <div className="h-full bg-primary animate-pulse" style={{ width: '100%' }} />
              </div>
              <p className="text-[9px] font-mono text-muted-foreground text-center">
                AI is reading the tablature...
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
      <div className="flex-1 px-3 py-3 overflow-hidden">
        <div className="rounded-2xl p-4 h-full" style={{
          background: 'linear-gradient(180deg, hsl(215, 50%, 12%) 0%, hsl(218, 55%, 15%) 100%)',
          border: '1px solid hsl(215, 40%, 22%)',
          boxShadow: '0 4px 20px hsl(215, 50%, 5% / 0.5), inset 0 1px 0 hsl(215, 40%, 25% / 0.3)',
        }}>
          <div className="flex gap-3 h-full">
            {/* String labels column */}
            <div className="flex flex-col justify-between py-1 pr-1 shrink-0">
              {displayLabels.map((label, i) => (
                <div key={i} className="text-[11px] font-mono font-semibold w-5 text-right leading-none" style={{ color: 'hsl(215, 30%, 50%)' }}>
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
              {/* String lines — more spaced, subtle teal tint */}
              {[0, 1, 2, 3, 4, 5].map(si => {
                const y = `${(si / 5) * 100}%`;
                return (
                  <div
                    key={si}
                    className="absolute left-0 right-0"
                    style={{
                      top: y,
                      height: '1px',
                      background: 'hsl(200, 50%, 30% / 0.5)',
                    }}
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
                        className="font-mono font-bold leading-none"
                        style={{
                          fontSize: '14px',
                          color: isCurrent
                            ? 'hsl(var(--primary))'
                            : isUpcoming
                              ? 'hsl(200, 60%, 75%)'
                              : 'hsl(215, 30%, 45%)',
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
                  className="absolute top-0 bottom-0 w-0.5 z-20 rounded-full"
                  style={{
                    left: `${((playheadPos - windowStart) / (visibleWindow - 1)) * 100}%`,
                    background: 'hsl(var(--primary))',
                    boxShadow: '0 0 6px hsl(var(--primary)), 0 0 12px hsl(var(--primary) / 0.4)',
                  }}
                >
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-0 h-0"
                    style={{
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '7px solid hsl(var(--primary))',
                    }}
                  />
                </div>
              )}
            </div>
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
