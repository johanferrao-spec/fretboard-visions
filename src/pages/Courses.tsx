import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourses } from '@/hooks/useCourses';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Courses() {
  const nav = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const { courses, loading, deleteCourse, createCourse } = useCourses();

  useEffect(() => {
    // Auth disabled for now — preview without sign-in.
    setAuthChecked(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
  }, []);

  const goBack = () => {
    setAnimateIn(false);
    setTimeout(() => nav('/'), 300);
  };

  const onNewCourse = async () => {
    const title = prompt('New course title?', 'Untitled course');
    if (!title) return;
    const { data, error } = await createCourse({
      title,
      description: '',
      key_root: 'A',
      key_quality: 'Minor',
      time_signature: '4/4',
      tempo: 100,
    });
    if (error || !data) { toast.error(error?.message ?? 'Failed'); return; }
    nav(`/courses/${data.id}`);
  };

  if (!authChecked) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground transition-transform duration-300 ease-out"
      style={{ transform: animateIn ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-5" /> Back
        </button>
        <h1 className="text-xl font-semibold">Courses</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onNewCourse}><Plus className="size-4 mr-1" /> New course</Button>
        </div>
      </header>

      <main className="p-6 overflow-auto h-[calc(100vh-65px)]">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : courses.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <p className="text-lg text-muted-foreground">No courses yet.</p>
            <Button onClick={onNewCourse}><Plus className="size-4 mr-2" /> Create your first course</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {courses.map(c => (
              <div key={c.id} className="group relative bg-card border border-border rounded-2xl p-4 hover:border-primary transition-colors cursor-pointer"
                   onClick={() => nav(`/courses/${c.id}`)}>
                <h2 className="font-semibold truncate">{c.title}</h2>
                <p className="text-xs text-muted-foreground mt-1">{c.key_root} {c.key_quality} · {c.tempo} bpm · {c.time_signature}</p>
                {c.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{c.description}</p>}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm('Delete this course and all its lessons?')) return;
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
