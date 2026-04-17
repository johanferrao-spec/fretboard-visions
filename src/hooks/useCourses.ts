import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CoursePhrase, CourseRow, KeyQuality } from '@/lib/courseTypes';
import type { NoteName } from '@/lib/music';
import type { Session } from '@supabase/supabase-js';

export function useCourses() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCourses(data as unknown as CourseRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchCourses();
    else { setCourses([]); setLoading(false); }
  }, [session, fetchCourses]);

  const createCourse = useCallback(async (input: {
    title: string;
    key_root: NoteName;
    key_quality: KeyQuality;
    time_signature: string;
    tempo: number;
    phrase: CoursePhrase;
  }) => {
    if (!session) return { error: new Error('Not signed in') };
    const { data, error } = await supabase
      .from('courses')
      .insert({ ...input, phrase: input.phrase as unknown as never, user_id: session.user.id })
      .select()
      .single();
    if (!error && data) await fetchCourses();
    return { data: data as unknown as CourseRow | null, error };
  }, [session, fetchCourses]);

  const updateCourse = useCallback(async (id: string, patch: Partial<Omit<CourseRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    const safe: Record<string, unknown> = { ...patch };
    if (patch.phrase) safe.phrase = patch.phrase as unknown as never;
    const { error } = await supabase.from('courses').update(safe).eq('id', id);
    if (!error) await fetchCourses();
    return { error };
  }, [fetchCourses]);

  const deleteCourse = useCallback(async (id: string) => {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (!error) await fetchCourses();
    return { error };
  }, [fetchCourses]);

  return { courses, loading, session, fetchCourses, createCourse, updateCourse, deleteCourse };
}
