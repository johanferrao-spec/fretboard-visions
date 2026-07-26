import { useMemo } from 'react';
import { buildBars, splitSymbol, LETTERS, CHART_BARS_PER_ROW, type ChartPdfData } from '@/lib/chartPdf';

/**
 * In-app HTML rendering of the iReal-style chart. Used for preview because
 * embedded PDF viewers are blocked inside sandboxed preview iframes.
 */
export default function ChartPreview({ data }: { data: ChartPdfData }) {
  const bars = useMemo(() => buildBars(data), [data]);

  const rows = useMemo(() => {
    const out: (typeof bars)[] = [];
    let cur: typeof bars = [];
    bars.forEach(bar => {
      const prev = cur[cur.length - 1];
      if (
        ((bar.sectionStart || (prev && prev.ending !== bar.ending)) && cur.length) ||
        cur.length === CHART_BARS_PER_ROW
      ) {
        out.push(cur);
        cur = [];
      }
      cur.push(bar);
    });
    if (cur.length) out.push(cur);
    return out;
  }, [bars]);

  const letterFor = useMemo(() => {
    const m = new Map<string, string>();
    data.sections.forEach((s, i) => m.set(s.id, LETTERS[i] ?? String(i + 1)));
    return m;
  }, [data.sections]);

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

  return (
    <div className="bg-white text-black w-full h-full overflow-auto">
      <div className="mx-auto" style={{ maxWidth: 760, padding: '32px 28px' }}>
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
        {rows.map((row, ri) => (
          <div key={ri} className="mb-7">
            <div className="flex h-4">
              {row.map(bar => (
                <div key={`h${bar.chords[0]?.label ?? ''}${Math.random()}`} className="flex-1">
                  {bar.ending && (
                    <span className="block border-t-2 border-l-2 border-black h-[10px] text-[9px] leading-none pl-[2px]">
                      {row[0] === bar || bar.sectionStart ? `${bar.ending}.` : ''}
                    </span>
                  )}
                  {bar.sectionStart && bar.sectionLetter && (
                    <span className="inline-flex items-center justify-center w-[15px] h-[15px] bg-black text-white text-[10px] font-bold">
                      {bar.sectionLetter}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex border-l-2 border-black">
              {row.map((bar, bi) => (
                <div
                  key={bi}
                  className="flex-1 h-[46px] flex items-center relative border-r border-black"
                  style={{
                    borderLeftWidth: bar.sectionStart ? 3 : 0,
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
              ))}
            </div>
            <div className="flex">
              {row.map((bar, bi) => (
                <div key={bi} className="flex-1 text-[10px] text-neutral-700 pt-1 pl-1">
                  {bar.sectionStart ? bar.sectionName : ''}
                </div>
              ))}
            </div>
          </div>
        ))}

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
