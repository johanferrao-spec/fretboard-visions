// Import helpers for turning `analyze-song-audio` output into ChartsView state.
import type { NoteName } from './music';
import { parseChordSymbol } from './chordParser';

export interface AnalyzedSection {
  label: string;
  /** mm:ss */
  startTime: string;
}

export interface AnalyzedSong {
  tempo?: number;
  key?: string;
  keyRoot?: string;
  keyQuality?: 'Major' | 'Minor';
  barText?: string;
  structure?: AnalyzedSection[];
}

export interface ImportedSlot {
  /** eighth-bar units (8 = one full bar) */
  units: number;
  chord?: { root: NoteName; chordType: string };
  /** the bar index this slot starts on (0-based) */
  barIndex: number;
}

const UNITS_PER_BAR = 8;

/** "Cmaj7 | A7 | Dm7 G7" -> ordered slots with fractional bar splits. */
export function slotsFromBarText(barText: string): ImportedSlot[] {
  const out: ImportedSlot[] = [];
  const bars = barText.split('|').map(b => b.trim()).filter(Boolean);
  let barIndex = 0;
  for (const bar of bars) {
    const tokens = bar.split(/\s+/).filter(Boolean);
    const n = Math.max(1, tokens.length);
    // Distribute UNITS_PER_BAR across n tokens as evenly as possible.
    const base = Math.floor(UNITS_PER_BAR / n);
    let leftover = UNITS_PER_BAR - base * n;
    for (const tok of tokens) {
      const units = base + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover -= 1;
      const parsed = parseChordSymbol(tok);
      out.push({
        units: Math.max(1, units),
        chord: parsed ? { root: parsed.root as NoteName, chordType: parsed.quality } : undefined,
        barIndex,
      });
    }
    barIndex += 1;
  }
  return out;
}

/** "mm:ss" or "m:ss" -> seconds. Returns 0 on bad input. */
export function parseMmSs(s: string): number {
  if (!s) return 0;
  const m = s.trim().match(/^(\d+):(\d{1,2})(?:\.(\d+))?$/);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const mins = Number(m[1]);
  const secs = Number(m[2]);
  return mins * 60 + secs;
}

/** Convert seconds → bar index using tempo (assumes 4/4). */
export function secondsToBarIndex(seconds: number, bpm: number): number {
  if (!bpm || bpm <= 0) return 0;
  const beats = seconds * bpm / 60;
  return Math.max(0, Math.round(beats / 4));
}
