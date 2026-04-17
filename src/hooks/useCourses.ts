import { useCallback, useEffect, useState } from 'react';
import type { CourseRow, CourseTabRow, KeyQuality } from '@/lib/courseTypes';
import type { NoteName } from '@/lib/music';
import {
  createCourse as createStoredCourse,
  createTab as createStoredTab,
  deleteCourse as deleteStoredCourse,
  deleteTab as deleteStoredTab,
  listCourses,
  listTabs,
  updateCourse as updateStoredCourse,
  updateTab as updateStoredTab,
} from '@/lib/courseStorage';

export function useCourses() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setCourses(listCourses());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const createCourse = useCallback(async (input: {
    title: string;
    description?: string;
    key_root: NoteName;
    key_quality: KeyQuality;
    time_signature: string;
    tempo: number;
  }) => {
    try {
      const data = createStoredCourse(input);
      await fetchCourses();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Failed to create course') };
    }
  }, [fetchCourses]);

  const updateCourse = useCallback(async (id: string, patch: Partial<Omit<CourseRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      updateStoredCourse(id, patch);
      await fetchCourses();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Failed to update course') };
    }
  }, [fetchCourses]);

  const deleteCourse = useCallback(async (id: string) => {
    try {
      deleteStoredCourse(id);
      await fetchCourses();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Failed to delete course') };
    }
  }, [fetchCourses]);

  return { courses, loading, session: null, fetchCourses, createCourse, updateCourse, deleteCourse };
}

/** Hook for managing tabs (lessons) inside a single course. */
export function useCourseTabs(courseId: string | undefined) {
  const [tabs, setTabs] = useState<CourseTabRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTabs = useCallback(async () => {
    if (!courseId) { setTabs([]); setLoading(false); return; }
    setLoading(true);
    setTabs(listTabs(courseId));
    setLoading(false);
  }, [courseId]);

  useEffect(() => { fetchTabs(); }, [fetchTabs]);

  const createTab = useCallback(async (input: Omit<CourseTabRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'course_id' | 'position'> & { position?: number }) => {
    if (!courseId) return { data: null, error: new Error('No course selected') };
    try {
      const data = createStoredTab(courseId, { ...input, position: input.position ?? tabs.length });
      await fetchTabs();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Failed to create lesson') };
    }
  }, [courseId, tabs.length, fetchTabs]);

  const updateTab = useCallback(async (id: string, patch: Partial<Omit<CourseTabRow, 'id' | 'user_id' | 'course_id' | 'created_at' | 'updated_at'>>) => {
    try {
      updateStoredTab(id, patch);
      await fetchTabs();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Failed to update lesson') };
    }
  }, [fetchTabs]);

  const deleteTab = useCallback(async (id: string) => {
    try {
      deleteStoredTab(id);
      await fetchTabs();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Failed to delete lesson') };
    }
  }, [fetchTabs]);

  return { tabs, loading, session: null, fetchTabs, createTab, updateTab, deleteTab };
}
