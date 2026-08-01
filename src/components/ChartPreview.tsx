import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildBars, splitSymbol, LETTERS, CHART_BARS_PER_ROW, type ChartPdfData, type ChartBar } from '@/lib/chartPdf';

interface Row { bars: ChartBar[]; offset: number }

/**
 * In-app HTML rendering of the iReal-style chart. Used for preview because
 * embedded PDF viewers are blocked inside sandboxed preview iframes.
 * The whole sheet is scaled down to fit its container so it never scrolls.
 */
export default function ChartPreview({ data }: { data: ChartPdfData }) {
  const bars = useMemo(() => buildBars(data), [data]);

  // Rows: volta (2nd/3rd ending) runs start a new row, indented so they sit
  // directly beneath the 1st-ending bars they replace.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let cur: ChartBar[] = [];
    let offset = 0;
    let ending1Col: number | null = null;
    let prevEnding = 0;

    const flush = () => {
      if (cur.length) out.push({ bars: cur, offset });
      cur = [];
      offset = 0;
    };

    bars.forEach(bar => {
      const e = bar.ending ?? 0;

      if (bar.sectionStart) {
        flush();
        ending1Col = null;
      } else if (e >= 2 && prevEnding >= 1) {
        const anchor = ending1Col ?? 0;
        flush();
        offset = anchor;
      } else if (e === 0 && prevEnding >= 1) {
        flush();
        ending1Col = null;
      } else if (offset + cur.length >= CHART_BARS_PER_ROW) {
        flush();
        if (e >= 1) ending1Col = 0;
      }

      if (e === 1 && prevEnding !== 1) ending1Col = offset + cur.length;
      cur.push(bar);
      prevEnding = e;
    });
    flush();
    return out;
  }, [bars]);

  const letterFor = useMemo(() => {
    const m = new Map<string, string>();
    data.sections.forEach((s, i) => m.set(s.id, LETTERS[i] ?? String(i + 1)));
    return m;
  }, [data.sections]);

  // ---- Fit-to-container scaling (no scrolling) ----
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current;
      const sheet = sheetRef.current;
      if (!wrap || !sheet) return;
      const h = sheet.scrollHeight;
      const w = sheet.scrollWidth;
      if (!h || !w) return;
      const s = Math.min(1, wrap.clientHeight / h, wrap.clientWidth / w);
      setScale(s > 0 ? s : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (sheetRef.current) ro.observe(sheetRef.current);
    return () => ro.disconnect();
  }, [rows, data]);

  const Chord = ({ label }: { label: string }) => {
    const { base, accidental, tail } = splitSymbol(label);
    return (
      <span className="inline-flex items-start leading-none">
        <span className="text-[26px] font-bold">{base}</span>
        {accidental && <span className="text-[14px] font-bold mt-[2px]">{accidental}</span>}
        {tail && <span className="text-[14px] font-bold mt-[3px]">{tail}</span>}
      </span>
    );
  };

  const Cell = ({ bar, first }: { bar: ChartBar; first: boolean }) => (
    <div
      className="flex-1 h-[46px] flex items-center relative border-r border-black"
      style={{
        borderLeftWidth: bar.sectionStart ? 3 : first ? 2 : 0,
        borderRightWidth: bar.sectionEnd ? 3 : 1,
        borderColor: '#000',
        borderLeftStyle: 'solid',
      }}
    >
      {bar.sectionStart && (
        <span className="absolute left-[4px] top-1/2 -translate-y-1/2 flex flex-col gap-[6px]">
          <span className="w-[3px] h-[3px] rounded-full bg-black" />
          <span className="w-[3px] h-[3px] rounded-full bg-black" />
        </span>
      )}
      {bar.sectionEnd && (
        <span className="absolute right-[4px] top-1/2 -translate-y-1/2 flex flex-col gap-[6px]">
          <span className="w-[3px] h-[3px] rounded-full bg-black" />
          <span className="w-[3px] h-[3px] rounded-full bg-black" />
        </span>
      )}
      {bar.repeat ? (
        <span className="w-full text-center text-[20px] font-bold">%</span>
      ) : bar.chords.length === 1 ? (
        <span className="pl-[18%]"><Chord label={bar.chords[0].label} /></span>
      ) : (
        <span className="w-full flex justify-around px-2">
          {bar.chords.slice(0, 2).map((c, ci) => <Chord key={ci} label={c.label} />)}
        </span>
      )}
    </div>
  );

  return (
    <div ref={wrapRef} className="bg-white text-black w-full h-full overflow-hidden flex justify-center">
      <div
        ref={sheetRef}
        style={{
          width: 760,
          padding: '28px 28px',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {/* Header */}
        <div className="relative mb-5">
          <div className="text-center text-[20px] font-bold">{data.title || 'Untitled'}</div>
          <div className="absolute left-0 top-0 text-[12px]">({data.style || 'Medium Swing'})</div>
          {data.composer && (
            <div className="absolute right-0 top-0 text-[12px]">{data.composer}</div>
          )}
          <div className="text-[10px] text-neutral-500 mt-1">
            {data.timeSig}&nbsp;&nbsp;&nbsp;Tempo {data.tempo}
          </div>
        </div>

        {/* Grid */}
        {rows.length === 0 && (
          <div className="text-[12px] text-neutral-500 py-8 text-center">
            No chords in this chart yet.
          </div>
        )}
        {rows.map((row, ri) => {
          const pad = Array.from({ length: row.offset });
          return (
            <div key={ri} className="mb-6">
              {/* Volta brackets + section letters */}
              <div className="flex h-4">
                {pad.map((_, i) => <div key={`p${i}`} className="flex-1" />)}
                {row.bars.map((bar, bi) => {
                  const prev = row.bars[bi - 1];
                  const runStart = !!bar.ending && prev?.ending !== bar.ending;
                  return (
                    <div key={`h${bi}`} className="flex-1">
                      {bar.ending ? (
                        <span
                          className="block h-[11px] text-[9px] leading-none pl-[3px] border-t-2 border-black"
                          style={{ borderLeftWidth: runStart ? 2 : 0, borderLeftStyle: 'solid', borderColor: '#000' }}
                        >
                          {runStart ? `${bar.ending}.` : ''}
                        </span>
                      ) : bar.sectionStart && bar.sectionLetter ? (
                        <span className="inline-flex items-center justify-center w-[15px] h-[15px] bg-black text-white text-[10px] font-bold">
                          {bar.sectionLetter}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="flex">
                {pad.map((_, i) => <div key={`pb${i}`} className="flex-1" />)}
                {row.bars.map((bar, bi) => <Cell key={bi} bar={bar} first={bi === 0} />)}
              </div>
              <div className="flex">
                {pad.map((_, i) => <div key={`pn${i}`} className="flex-1" />)}
                {row.bars.map((bar, bi) => (
                  <div key={bi} className="flex-1 text-[10px] text-neutral-700 pt-1 pl-1">
                    {bar.sectionStart ? bar.sectionName : ''}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Arrangement */}
        {data.arrangement.length > 0 && (
          <div className="flex flex-wrap gap-[6px] mt-6">
            {data.arrangement.map((secId, i) => (
              <span
                key={i}
                className="inline-flex items-center justify-center w-[15px] h-[15px] bg-black text-white text-[10px] font-bold"
              >
                {letterFor.get(secId) ?? '?'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
