import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourses, useCourseTabs } from '@/hooks/useCourses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2, Pencil, Play } from 'lucide-react';
import { toast } from 'sonner';
import type { CourseRow } from '@/lib/courseTypes';
import { getCourse } from '@/lib/courseStorage';

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const nav = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const { updateCourse } = useCourses();
  const { tabs, loading, createTab, deleteTab } = useCourseTabs(courseId);

  useEffect(() => {
    // Auth disabled for now — preview without sign-in.
    setAuthChecked(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
  }, []);

  useEffect(() => {
    if (!courseId) return;
    const data = getCourse(courseId);
    if (data) {
      setCourse(data as CourseRow);
      setTitleDraft(data.title);
    }
  }, [courseId]);

  const goBack = () => { setAnimateIn(false); setTimeout(() => nav('/courses'), 300); };

  const isOwner = true;

  const onAddTab = async () => {
    if (!course) return;
    const { data, error } = await createTab({
      title: `Lesson ${tabs.length + 1}`,
      key_root: course.key_root,
      key_quality: course.key_quality,
      time_signature: course.time_signature,
      tempo: course.tempo,
      phrase: { notes: [], lengthGrid: 32 },
      chord_track: [],
      key_track: [],
      tempo_track: [],
    });
    if (error || !data) { toast.error(error?.message ?? 'Failed'); return; }
    nav(`/courses/${courseId}/lessons/${data.id}/edit`);
  };

  const saveTitle = async () => {
    if (!course || titleDraft.trim() === '') { setEditingTitle(false); return; }
    await updateCourse(course.id, { title: titleDraft });
    setCourse({ ...course, title: titleDraft });
    setEditingTitle(false);
  };

  if (!authChecked) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground transition-transform duration-300 ease-out"
      style={{ transform: animateIn ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-5" /> Courses
        </button>
        <div className="flex items-center gap-2">
          {editingTitle && isOwner ? (
            <Input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              autoFocus className="h-8 text-base" />
          ) : (
            <h1 className="text-xl font-semibold flex items-center gap-2">
              {course?.title ?? 'Course'}
              {isOwner && <button onClick={() => setEditingTitle(true)} className="text-muted-foreground hover:text-foreground"><Pencil className="size-4" /></button>}
            </h1>
          )}
        </div>
        {isOwner ? (
          <Button size="sm" onClick={onAddTab}><Plus className="size-4 mr-1" /> Add lesson</Button>
        ) : (
          <span className="text-xs text-muted-foreground">View only</span>
        )}
      </header>

      <main className="p-6 overflow-auto h-[calc(100vh-65px)]">
        {course && (
          <p className="text-xs text-muted-foreground mb-4">{course.key_root} {course.key_quality} · {course.tempo} bpm · {course.time_signature}</p>
        )}
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : tabs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground">No lessons yet.</p>
            {isOwner && <Button onClick={onAddTab}><Plus className="size-4 mr-2" /> Add your first lesson</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tabs.map(t => (
              <div key={t.id} className="group relative bg-card border border-border rounded-2xl p-4 hover:border-primary transition-colors">
                <h2 className="font-semibold truncate">{t.title}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t.key_root} {t.key_quality} · {t.tempo} bpm · {t.time_signature}</p>
                <p className="text-xs text-muted-foreground mt-2">{t.phrase?.notes?.length ?? 0} notes</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="default" onClick={() => nav(`/courses/${courseId}/lessons/${t.id}`)}>
                    <Play className="size-3 mr-1" /> Play
                  </Button>
                  {isOwner && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => nav(`/courses/${courseId}/lessons/${t.id}/edit`)}>
                        <Pencil className="size-3 mr-1" /> Edit
                      </Button>
                      <button
                        onClick={async () => {
                          if (!confirm('Delete this lesson?')) return;
                          const { error } = await deleteTab(t.id);
                          if (error) toast.error(error.message); else toast.success('Deleted');
                        }}
                        className="ml-auto p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                      ><Trash2 className="size-4" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
