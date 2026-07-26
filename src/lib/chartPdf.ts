import { jsPDF } from 'jspdf';

export interface PdfChord { root: string; chordType: string }
export interface PdfSlot { id: string; bars: number; chord?: PdfChord }
export interface PdfSection { id: string; name: string; startIdx: number; endIdx: number }

export interface ChartPdfData {
  title: string;
  composer: string;
  style: string;
  tempo: number;
  timeSig: string;
  slots: PdfSlot[];
  sections: PdfSection[];
  /** Section ids in playback order (arrangement). */
  arrangement: string[];
  /** Renders a chord into an iReal-style symbol, e.g. "E♭7", "F-7", "E♭Δ". */
  label: (c: PdfChord) => string;
}

const UNITS_PER_BAR = 8;
const BARS_PER_ROW = 4;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface Bar {
  chords: { label: string; unit: number }[];
  sectionId?: string;
  /** true when the bar repeats the previous bar of the same section. */
  repeat: boolean;
  /** first bar of a section → gets the letter box + open repeat */
  sectionStart: boolean;
  sectionEnd: boolean;
  sectionName?: string;
  sectionLetter?: string;
}

export type ChartBar = Bar;

/** Group the 1/8-unit slots into bars, tagging section membership. */
export function buildBars(data: ChartPdfData): Bar[] {
  const sectionOf = (slotIdx: number) =>
    data.sections.find(s => slotIdx >= s.startIdx && slotIdx <= s.endIdx);

  const letterFor = new Map<string, string>();
  data.sections.forEach((s, i) => letterFor.set(s.id, LETTERS[i] ?? String(i + 1)));

  const bars: Bar[] = [];
  let unit = 0;
  data.slots.forEach((slot, idx) => {
    const sec = sectionOf(idx);
    if (slot.chord) {
      const barIdx = Math.floor(unit / UNITS_PER_BAR);
      while (bars.length <= barIdx) {
        bars.push({ chords: [], repeat: false, sectionStart: false, sectionEnd: false });
      }
      const bar = bars[barIdx];
      bar.sectionId = bar.sectionId ?? sec?.id;
      bar.sectionName = bar.sectionName ?? sec?.name;
      bar.sectionLetter = bar.sectionLetter ?? (sec ? letterFor.get(sec.id) : undefined);
      bar.chords.push({ label: data.label(slot.chord), unit: unit % UNITS_PER_BAR });
    }
    unit += Math.max(1, slot.bars);
  });

  // Drop trailing empty bars.
  while (bars.length && bars[bars.length - 1].chords.length === 0) bars.pop();

  // Mark section boundaries and repeated bars.
  bars.forEach((bar, i) => {
    const prev = bars[i - 1];
    const next = bars[i + 1];
    bar.sectionStart = !!bar.sectionId && prev?.sectionId !== bar.sectionId;
    bar.sectionEnd = !!bar.sectionId && next?.sectionId !== bar.sectionId;
    if (
      prev &&
      !bar.sectionStart &&
      prev.chords.length === 1 &&
      bar.chords.length === 1 &&
      prev.chords[0].label === bar.chords[0].label
    ) {
      bar.repeat = true;
    }
  });

  return bars;
}

/** Split a chord symbol into base text and the superscript/quality tail. */
function splitSymbol(sym: string): { base: string; accidental: string; tail: string } {
  const m = sym.match(/^([A-G])([♭♯#b]?)(.*)$/);
  if (!m) return { base: sym, accidental: '', tail: '' };
  const acc = m[2] === '♭' ? 'b' : m[2] === '♯' ? '#' : m[2];
  return { base: m[1], accidental: acc, tail: m[3] };
}

export function buildChartPdf(data: ChartPdfData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const M = 40;
  const gridW = PW - M * 2;
  const barW = gridW / BARS_PER_ROW;

  // ---- Header ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(data.title || 'Untitled', PW / 2, M + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const styleLine = `(${data.style || 'Medium Swing'})`;
  doc.text(styleLine, M, M + 4);
  if (data.composer) doc.text(data.composer, PW - M, M + 4, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`${data.timeSig}   Tempo ${data.tempo}`, M, M + 17);
  doc.setTextColor(0, 0, 0);

  // ---- Grid ----
  const bars = buildBars(data);
  const rowH = 74;
  let y = M + 42;
  let x = M;
  let col = 0;
  let lastSectionId: string | undefined;

  const drawBarLine = (px: number, thick = false) => {
    doc.setLineWidth(thick ? 1.6 : 0.8);
    doc.setDrawColor(0, 0, 0);
    doc.line(px, y, px, y + 34);
  };

  const drawRepeatDots = (px: number, side: 'open' | 'close') => {
    const dx = side === 'open' ? px + 5 : px - 5;
    doc.setFillColor(0, 0, 0);
    doc.circle(dx, y + 12, 1.6, 'F');
    doc.circle(dx, y + 22, 1.6, 'F');
  };

  bars.forEach((bar, i) => {
    // Force a new row when a section starts mid-row.
    if (bar.sectionStart && col !== 0) {
      col = 0;
      x = M;
      y += rowH;
    }
    if (col === 0) x = M;

    if (bar.sectionId !== lastSectionId) lastSectionId = bar.sectionId;

    // Section letter box above the bar.
    if (bar.sectionStart && bar.sectionLetter) {
      doc.setFillColor(0, 0, 0);
      doc.rect(x, y - 16, 13, 13, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(bar.sectionLetter, x + 6.5, y - 6.5, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }

    // Bar lines
    drawBarLine(x, bar.sectionStart);
    if (bar.sectionStart) drawRepeatDots(x, 'open');

    // Chords
    const drawChord = (label: string, cx: number) => {
      const { base, accidental, tail } = splitSymbol(label);
      // 'Δ' has no glyph in the core PDF fonts — draw it as a small triangle.
      const hasTriangle = tail.startsWith('Δ');
      const tailText = (hasTriangle ? tail.slice(1) : tail).replace(/Δ/g, '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      const bw = doc.getTextWidth(base);
      doc.setFontSize(11);
      const aw = accidental ? doc.getTextWidth(accidental) : 0;
      const triW = hasTriangle ? 8 : 0;
      const tw = tailText ? doc.getTextWidth(tailText) : 0;
      const total = bw + aw + triW + tw;
      let cursor = cx - total / 2;
      doc.setFontSize(20);
      doc.text(base, cursor, y + 26);
      cursor += bw;
      if (accidental) {
        doc.setFontSize(11);
        doc.text(accidental, cursor, y + 17);
        cursor += aw;
      }
      if (hasTriangle) {
        const tx = cursor + 1;
        const ty = y + 20;
        doc.setLineWidth(0.9);
        doc.setDrawColor(0, 0, 0);
        doc.lines([[3, -7], [3, 7], [-6, 0]], tx, ty);
        cursor += triW;
      }
      if (tailText) {
        doc.setFontSize(11);
        doc.text(tailText, cursor + 0.5, y + 19);
      }
    };

    if (bar.repeat) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('%', x + barW / 2, y + 25, { align: 'center' });
    } else if (bar.chords.length === 1) {
      drawChord(bar.chords[0].label, x + barW * 0.34);
    } else {
      bar.chords.slice(0, 2).forEach((c, ci) => {
        drawChord(c.label, x + barW * (ci === 0 ? 0.28 : 0.72));
      });
    }

    // Section name under the first bar of a section.
    if (bar.sectionStart && bar.sectionName) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(bar.sectionName, x + 3, y + 47);
      doc.setTextColor(0, 0, 0);
    }

    col++;
    x += barW;

    const isLast = i === bars.length - 1;
    if (bar.sectionEnd || isLast || col === BARS_PER_ROW) {
      drawBarLine(x, bar.sectionEnd || isLast);
      if (bar.sectionEnd) drawRepeatDots(x, 'close');
    }

    if (col === BARS_PER_ROW) {
      col = 0;
      y += rowH;
      if (y > doc.internal.pageSize.getHeight() - 120) {
        doc.addPage();
        y = M + 20;
      }
    }
  });

  if (col !== 0) y += rowH;

  // ---- Arrangement strip ----
  if (data.arrangement.length) {
    const letterFor = new Map<string, string>();
    data.sections.forEach((s, i) => letterFor.set(s.id, LETTERS[i] ?? String(i + 1)));
    let ax = M;
    const ay = Math.min(y + 30, doc.internal.pageSize.getHeight() - 60);
    data.arrangement.forEach(secId => {
      const letter = letterFor.get(secId) ?? '?';
      doc.setFillColor(0, 0, 0);
      doc.rect(ax, ay, 13, 13, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(letter, ax + 6.5, ay + 9.5, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      ax += 19;
      if (ax > PW - M - 20) { ax = M; }
    });
  }

  return doc;
}
