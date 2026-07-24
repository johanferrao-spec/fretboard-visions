import { useEffect } from 'react';
import { usePitchDetector } from '@/hooks/usePitchDetector';
import { X, Mic, MicOff } from 'lucide-react';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
// Standard tuning reference (E2 A2 D3 G3 B3 E4)
const STANDARD_MIDI = [40, 45, 50, 55, 59, 64];
const STRING_LABELS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

interface Props {
  onClose: () => void;
}

export default function ChromaticTuner({ onClose }: Props) {
  const {
    enabled, midi, cents, rms, error,
    start, stop, devices, selectedDeviceId, selectDevice,
  } = usePitchDetector();

  useEffect(() => {
    // auto-start on open
    start(selectedDeviceId ?? undefined);
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noteName = midi != null ? NOTE_NAMES[((midi % 12) + 12) % 12] : '—';
  const octave = midi != null ? Math.floor(midi / 12) - 1 : null;

  // nearest standard-tuning string
  let nearestStringIdx: number | null = null;
  if (midi != null) {
    let best = Infinity;
    STANDARD_MIDI.forEach((m, i) => {
      const d = Math.abs(m - midi);
      if (d < best) { best = d; nearestStringIdx = i; }
    });
  }

  const inTune = midi != null && Math.abs(cents) <= 5 && rms > 0.01;
  const needleAngle = Math.max(-50, Math.min(50, cents));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-[440px] max-w-[92vw]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Close tuner"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Chromatic Tuner</div>
          {enabled ? <Mic size={14} className="text-green-500" /> : <MicOff size={14} className="text-red-500" />}
        </div>

        {error && (
          <div className="mb-3 text-xs text-red-400 font-mono bg-red-500/10 rounded px-2 py-1">
            {error}
          </div>
        )}

        {/* Note display */}
        <div className="flex flex-col items-center py-4">
          <div
            className="text-7xl font-bold font-mono tabular-nums transition-colors"
            style={{ color: inTune ? 'hsl(140, 70%, 55%)' : 'hsl(var(--foreground))' }}
          >
            {noteName}
            {octave != null && <span className="text-3xl text-muted-foreground ml-1">{octave}</span>}
          </div>
          <div className="text-xs font-mono text-muted-foreground mt-1">
            {midi != null ? `${cents > 0 ? '+' : ''}${cents} cents` : 'Play a note…'}
          </div>
        </div>

        {/* Needle meter */}
        <div className="relative h-24 mb-4">
          <div className="absolute inset-x-4 top-1/2 h-px bg-border" />
          {/* tick marks */}
          {[-50, -25, 0, 25, 50].map(t => (
            <div
              key={t}
              className="absolute top-1/2 w-px bg-muted-foreground/50"
              style={{
                left: `${50 + t}%`,
                height: t === 0 ? 20 : 10,
                transform: `translate(-50%, ${t === 0 ? '-50%' : '-25%'})`,
              }}
            />
          ))}
          <div
            className="absolute left-1/2 top-2 bottom-2 origin-bottom transition-transform duration-100"
            style={{
              transform: `translateX(-50%) rotate(${needleAngle * 0.9}deg)`,
              width: 2,
              background: inTune ? 'hsl(140, 70%, 55%)' : 'hsl(var(--accent))',
              opacity: midi != null && rms > 0.005 ? 1 : 0.25,
              boxShadow: `0 0 8px ${inTune ? 'hsl(140, 70%, 55%)' : 'hsl(var(--accent))'}`,
            }}
          />
          <div className="absolute left-1/2 bottom-1 w-3 h-3 rounded-full -translate-x-1/2 bg-foreground" />
          <div className="absolute inset-x-0 bottom-0 flex justify-between px-2 text-[9px] font-mono text-muted-foreground">
            <span>-50¢</span><span>0</span><span>+50¢</span>
          </div>
        </div>

        {/* Standard tuning strings */}
        <div className="grid grid-cols-6 gap-1 mb-4">
          {STRING_LABELS.map((label, i) => {
            const active = nearestStringIdx === i && midi != null;
            const stringInTune = active && Math.abs(midi! - STANDARD_MIDI[i]) === 0 && Math.abs(cents) <= 5;
            return (
              <div
                key={label}
                className="rounded-md py-2 text-center text-xs font-mono font-bold border transition-all"
                style={{
                  background: stringInTune
                    ? 'hsl(140, 70%, 55%, 0.25)'
                    : active
                      ? 'hsl(var(--accent) / 0.2)'
                      : 'hsl(var(--secondary))',
                  borderColor: stringInTune
                    ? 'hsl(140, 70%, 55%)'
                    : active
                      ? 'hsl(var(--accent))'
                      : 'hsl(var(--border))',
                  color: stringInTune ? 'hsl(140, 70%, 55%)' : 'hsl(var(--foreground))',
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* Input device selector */}
        {devices.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Input:</span>
            <select
              value={selectedDeviceId ?? ''}
              onChange={e => selectDevice(e.target.value)}
              className="flex-1 bg-secondary text-foreground text-xs font-mono rounded px-2 py-1 border border-border"
            >
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
