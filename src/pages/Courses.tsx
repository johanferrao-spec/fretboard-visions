import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCourses } from '@/hooks/useCourses';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Courses() {
  const nav = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const { courses, loading, deleteCourse } = useCourses();
  const enterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthChecked(true);
      if (!data.session) nav('/auth');
    });
    // trigger slide-in
    requestAnimationFrame(() => setAnimateIn(true));
  }, [nav]);

  const onLogout = async () => { await supabase.auth.signOut(); nav('/'); };

  const goBack = () => {
    setAnimateIn(false);
    setTimeout(() => nav('/'), 300);
  };

  if (!authChecked) return null;

  return (
    <div
      ref={enterRef}
      className="fixed inset-0 z-50 bg-background text-foreground transition-transform duration-300 ease-out"
      style={{ transform: animateIn ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-5" /> Back
        </button>
        <h1 className="text-xl font-semibold">Courses</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onLogout}><LogOut className="size-4 mr-1" /> Sign out</Button>
          <Button size="sm" onClick={() => nav('/courses/new')}><Plus className="size-4 mr-1" /> New course</Button>
        </div>
      </header>

      <main className="p-6 overflow-auto h-[calc(100vh-65px)]">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : courses.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <p className="text-lg text-muted-foreground">No courses yet.</p>
            <Button onClick={() => nav('/courses/new')}><Plus className="size-4 mr-2" /> Create your first course</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {courses.map(c => (
              <div key={c.id} className="group relative bg-card border border-border rounded-2xl p-4 hover:border-primary transition-colors cursor-pointer"
                   onClick={() => nav(`/courses/${c.id}`)}>
                <h2 className="font-semibold truncate">{c.title}</h2>
                <p className="text-xs text-muted-foreground mt-1">{c.key_root} {c.key_quality} · {c.tempo} bpm · {c.time_signature}</p>
                <p className="text-xs text-muted-foreground mt-2">{c.phrase?.notes?.length ?? 0} notes</p>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm('Delete this course?')) return;
                    const { error } = await deleteCourse(c.id);
                    if (error) toast.error(error.message); else toast.success('Deleted');
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-opacity"
                  aria-label="Delete course"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
