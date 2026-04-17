import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TabEditor } from '@/components/Courses/TabEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { useCourses } from '@/hooks/useCourses';
import type { CoursePhrase, KeyQuality } from '@/lib/courseTypes';
import { GRID_PER_BEAT } from '@/lib/courseTypes';
import { NOTE_NAMES, STANDARD_TUNING, type NoteName } from '@/lib/music';
import { toast } from 'sonner';

const KEY_QUALITIES: KeyQuality[] = ['Major', 'Minor'];
const TIME_SIGS = ['4/4', '3/4', '6/8', '2/4'];

export default function CourseCreator() {
  const nav = useNavigate();
  const { createCourse, session } = useCourses();
  const [authChecked, setAuthChecked] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [title, setTitle] = useState('Untitled course');
  const [keyRoot, setKeyRoot] = useState<NoteName>('A');
  const [keyQuality, setKeyQuality] = useState<KeyQuality>('Minor');
  const [timeSig, setTimeSig] = useState('4/4');
  const [tempo, setTempo] = useState(100);
  const [phrase, setPhrase] = useState<CoursePhrase>({ notes: [], lengthGrid: GRID_PER_BEAT * 4 * 2 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthChecked(true);
      if (!data.session) nav('/auth');
    });
    requestAnimationFrame(() => setAnimateIn(true));
  }, [nav]);

  const beatsPerBar = useMemo(() => parseInt(timeSig.split('/')[0], 10) || 4, [timeSig]);

  const goBack = () => { setAnimateIn(false); setTimeout(() => nav('/courses'), 300); };

  const onSave = async () => {
    if (!session) return nav('/auth');
    if (phrase.notes.length === 0) { toast.error('Add at least one note before saving'); return; }
    setSaving(true);
    const { error } = await createCourse({ title, key_root: keyRoot, key_quality: keyQuality, time_signature: timeSig, tempo, phrase });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Course saved'); goBack(); }
  };

  if (!authChecked) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground transition-transform duration-300 ease-out overflow-y-auto"
      style={{ transform: animateIn ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" /> Back
        </button>
        <h1 className="text-xl font-semibold">Creator mode</h1>
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save course'}</Button>
      </header>

      <main className="p-6 space-y-4 max-w-6xl mx-auto">
        {/* Top controls */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Key</Label>
            <div className="flex gap-1">
              <select value={keyRoot} onChange={e => setKeyRoot(e.target.value as NoteName)}
                className="bg-background border border-border rounded px-2 py-2 text-sm flex-1">
                {NOTE_NAMES.map(n => <option key={n}>{n}</option>)}
              </select>
              <select value={keyQuality} onChange={e => setKeyQuality(e.target.value as KeyQuality)}
                className="bg-background border border-border rounded px-2 py-2 text-sm flex-1">
                {KEY_QUALITIES.map(q => <option key={q}>{q}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Time sig</Label>
            <select value={timeSig} onChange={e => setTimeSig(e.target.value)}
              className="bg-background border border-border rounded px-2 py-2 text-sm w-full">
              {TIME_SIGS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Tempo (bpm)</Label>
            <Input type="number" min={40} max={240} value={tempo} onChange={e => setTempo(parseInt(e.target.value, 10) || 100)} />
          </div>
          <div className="flex items-end">
            <p className="text-xs text-muted-foreground">Click any tab cell to add a note. Double-click a note to edit its fret. Drag the right edge of a duration bar to resize.</p>
          </div>
        </div>

        {/* Tab + duration bars */}
        <TabEditor
          phrase={phrase}
          setPhrase={setPhrase}
          tuning={STANDARD_TUNING}
          keyRoot={keyRoot}
          keyQuality={keyQuality}
          beatsPerBar={beatsPerBar}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
        />

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(140, 60%, 45%)' }} /> Diatonic</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(210, 80%, 55%)' }} /> Chord</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(28, 90%, 55%)' }} /> Non-diatonic</span>
        </div>
      </main>
    </div>
  );
}
