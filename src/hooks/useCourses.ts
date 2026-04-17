import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CourseRow, CourseTabRow, KeyQuality } from '@/lib/courseTypes';
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
    description?: string;
    key_root: NoteName;
    key_quality: KeyQuality;
    time_signature: string;
    tempo: number;
  }) => {
    if (!session) return { error: new Error('Not signed in') };
    const { data, error } = await supabase
      .from('courses')
      .insert({ ...input, description: input.description ?? '', user_id: session.user.id })
      .select()
      .single();
    if (!error && data) await fetchCourses();
    return { data: data as unknown as CourseRow | null, error };
  }, [session, fetchCourses]);

  const updateCourse = useCallback(async (id: string, patch: Partial<Omit<CourseRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    const { error } = await supabase.from('courses').update(patch).eq('id', id);
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

/** Hook for managing tabs (lessons) inside a single course. */
export function useCourseTabs(courseId: string | undefined) {
  const [tabs, setTabs] = useState<CourseTabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchTabs = useCallback(async () => {
    if (!courseId) { setTabs([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('course_tabs')
      .select('*')
      .eq('course_id', courseId)
      .order('position', { ascending: true });
    if (!error && data) setTabs(data as unknown as CourseTabRow[]);
    setLoading(false);
  }, [courseId]);

  useEffect(() => { fetchTabs(); }, [fetchTabs]);

  const createTab = useCallback(async (input: Omit<CourseTabRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'course_id' | 'position'> & { position?: number }) => {
    if (!session || !courseId) return { error: new Error('Not signed in or no course') };
    const position = input.position ?? tabs.length;
    const payload: Record<string, unknown> = {
      course_id: courseId,
      user_id: session.user.id,
      title: input.title,
      position,
      key_root: input.key_root,
      key_quality: input.key_quality,
      time_signature: input.time_signature,
      tempo: input.tempo,
      phrase: input.phrase as unknown as never,
      chord_track: input.chord_track as unknown as never,
      key_track: input.key_track as unknown as never,
      tempo_track: input.tempo_track as unknown as never,
    };
    const { data, error } = await supabase.from('course_tabs').insert(payload as never).select().single();
    if (!error && data) await fetchTabs();
    return { data: data as unknown as CourseTabRow | null, error };
  }, [session, courseId, tabs.length, fetchTabs]);

  const updateTab = useCallback(async (id: string, patch: Partial<Omit<CourseTabRow, 'id' | 'user_id' | 'course_id' | 'created_at' | 'updated_at'>>) => {
    const safe: Record<string, unknown> = { ...patch };
    if (patch.phrase) safe.phrase = patch.phrase as unknown as never;
    if (patch.chord_track) safe.chord_track = patch.chord_track as unknown as never;
    if (patch.key_track) safe.key_track = patch.key_track as unknown as never;
    if (patch.tempo_track) safe.tempo_track = patch.tempo_track as unknown as never;
    const { error } = await supabase.from('course_tabs').update(safe as never).eq('id', id);
    if (!error) await fetchTabs();
    return { error };
  }, [fetchTabs]);

  const deleteTab = useCallback(async (id: string) => {
    const { error } = await supabase.from('course_tabs').delete().eq('id', id);
    if (!error) await fetchTabs();
    return { error };
  }, [fetchTabs]);

  return { tabs, loading, session, fetchTabs, createTab, updateTab, deleteTab };
}
