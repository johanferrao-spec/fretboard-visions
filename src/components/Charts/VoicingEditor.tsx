import { useMemo } from 'react';

/**
 * A chord voicing attached to a chart cell.
 * Six entries, low-E → high-e. Value = absolute fret (0 = open string, -1 = muted).
 */
export type Voicing = number[];

export const EMPTY_VOICING: Voicing = [-1, -1, -1, -1, -1, -1];

export const isVoicingEmpty = (v?: Voicing) => !v || v.every(f => f < 0);

/** Lowest fretted fret in the voicing (ignores open/muted), or 1. */
export function voicingBaseFret(v: Voicing, windowSize = 5): number {
  const fretted = v.filter(f => f > 0);
  if (!fretted.length) return 1;
  const min = Math.min(...fretted);
  const max = Math.max(...fretted);
  if (max <= windowSize) return 1;
  return Math.max(1, Math.min(min, max - windowSize + 1));
}

interface DiagramProps {
  voicing: Voicing;
  /** Pixel width of the diagram. */
  width?: number;
  /** Called with the string index (0 = low E) and absolute fret when a cell is clicked. */
  onToggle?: (stringIndex: number, fret: number) => void;
  windowSize?: number;
  /** Force the top fret of the visible window (editor position stepper). */
  baseFret?: number;
}

/**
 * Vertical chord-box diagram. Strings run vertically (low E on the left),
 * frets horizontally. Interactive when `onToggle` is supplied.
 */
export function VoicingDiagram({ voicing, width = 150, onToggle, windowSize = 5, baseFret }: DiagramProps) {
  const auto = useMemo(() => voicingBaseFret(voicing, windowSize), [voicing, windowSize]);
  const base = baseFret ?? auto;
  const stringGap = width / 7;
  const padX = stringGap;
  const headerH = 18;
  const fretH = Math.round(width / 4.2);
  const height = headerH + fretH * windowSize + 10;
  const interactive = !!onToggle;

  const xOf = (s: number) => padX + s * stringGap;
  const yOfFret = (f: number) => headerH + (f - base + 1) * fretH - fretH / 2;

  return (
    <svg width={width} height={height} className="select-none">
      {/* Nut or base-fret label */}
      {base === 1 ? (
        <rect x={padX} y={headerH - 4} width={stringGap * 5} height={4} fill="hsl(38 70% 60%)" rx={1} />
      ) : (
        <text x={2} y={headerH + fretH / 2} fontSize={9} fill="hsl(var(--muted-foreground))" fontFamily="monospace">
          {base}
        </text>
      )}

      {/* Frets */}
      {Array.from({ length: windowSize + 1 }).map((_, i) => (
        <line
          key={`f${i}`}
          x1={padX}
          x2={padX + stringGap * 5}
          y1={headerH + i * fretH}
          y2={headerH + i * fretH}
          stroke="hsl(0 0% 100% / 0.5)"
          strokeWidth={1}
        />
      ))}
      {/* Strings */}
      {Array.from({ length: 6 }).map((_, s) => (
        <line
          key={`s${s}`}
          x1={xOf(s)}
          x2={xOf(s)}
          y1={headerH}
          y2={headerH + windowSize * fretH}
          stroke="hsl(0 0% 100% / 0.85)"
          strokeWidth={1}
        />
      ))}

      {/* Open / muted markers above the nut */}
      {voicing.map((f, s) => (
        <g key={`o${s}`}>
          {f === 0 && <circle cx={xOf(s)} cy={headerH - 9} r={3.5} fill="none" stroke="hsl(0 0% 100% / 0.9)" strokeWidth={1.2} />}
          {f < 0 && (
            <text x={xOf(s)} y={headerH - 5} fontSize={9} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="monospace">✕</text>
          )}
        </g>
      ))}

      {/* Dots */}
      {voicing.map((f, s) =>
        f > 0 && f >= base && f < base + windowSize ? (
          <circle key={`d${s}`} cx={xOf(s)} cy={yOfFret(f)} r={stringGap * 0.42} fill="hsl(var(--primary))" />
        ) : null,
      )}

      {/* Interaction layer */}
      {interactive &&
        Array.from({ length: 6 }).flatMap((_, s) =>
          Array.from({ length: windowSize + 1 }).map((__, row) => {
            const fret = row === 0 ? 0 : base + row - 1;
            const y = row === 0 ? headerH - 14 : headerH + (row - 1) * fretH;
            return (
              <rect
                key={`h${s}-${row}`}
                x={xOf(s) - stringGap / 2}
                y={y}
                width={stringGap}
                height={row === 0 ? 14 : fretH}
                fill="transparent"
                className="cursor-pointer hover:fill-primary/20"
                onClick={() => onToggle!(s, fret)}
              />
            );
          }),
        )}
    </svg>
  );
}
