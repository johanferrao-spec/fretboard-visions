import type { CourseRow, CourseTabRow, KeyQuality } from '@/lib/courseTypes';
import type { NoteName } from '@/lib/music';

const STORAGE_KEY = 'guest-course-storage-v1';
const GUEST_USER_ID = 'guest-local';

type StoreShape = {
  courses: CourseRow[];
  tabs: CourseTabRow[];
};

type CourseInput = {
  title: string;
  description?: string;
  key_root: NoteName;
  key_quality: KeyQuality;
  time_signature: string;
  tempo: number;
};

type TabInput = Omit<CourseTabRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'course_id' | 'position'> & {
  position?: number;
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

function readStore(): StoreShape {
  if (typeof window === 'undefined') return { courses: [], tabs: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { courses: [], tabs: [] };
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      tabs: Array.isArray(parsed.tabs) ? parsed.tabs : [],
    };
  } catch {
    return { courses: [], tabs: [] };
  }
}

function writeStore(store: StoreShape) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listCourses() {
  return readStore().courses.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getCourse(courseId: string) {
  return readStore().courses.find(course => course.id === courseId) ?? null;
}

export function createCourse(input: CourseInput) {
  const store = readStore();
  const timestamp = now();
  const course: CourseRow = {
    id: createId('course'),
    user_id: GUEST_USER_ID,
    title: input.title,
    description: input.description ?? '',
    key_root: input.key_root,
    key_quality: input.key_quality,
    time_signature: input.time_signature,
    tempo: input.tempo,
    created_at: timestamp,
    updated_at: timestamp,
  };
  store.courses = [course, ...store.courses];
  writeStore(store);
  return course;
}

export function updateCourse(courseId: string, patch: Partial<Omit<CourseRow, 'id' | 'user_id' | 'created_at'>>) {
  const store = readStore();
  let updated: CourseRow | null = null;
  store.courses = store.courses.map(course => {
    if (course.id !== courseId) return course;
    updated = { ...course, ...patch, updated_at: now() };
    return updated;
  });
  writeStore(store);
  return updated;
}

export function deleteCourse(courseId: string) {
  const store = readStore();
  store.courses = store.courses.filter(course => course.id !== courseId);
  store.tabs = store.tabs.filter(tab => tab.course_id !== courseId);
  writeStore(store);
}

export function listTabs(courseId: string) {
  return readStore().tabs
    .filter(tab => tab.course_id === courseId)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

export function getTab(tabId: string) {
  return readStore().tabs.find(tab => tab.id === tabId) ?? null;
}

export function createTab(courseId: string, input: TabInput) {
  const store = readStore();
  const timestamp = now();
  const nextPosition = input.position ?? store.tabs.filter(tab => tab.course_id === courseId).length;
  const tab: CourseTabRow = {
    id: createId('tab'),
    course_id: courseId,
    user_id: GUEST_USER_ID,
    title: input.title,
    position: nextPosition,
    key_root: input.key_root,
    key_quality: input.key_quality,
    time_signature: input.time_signature,
    tempo: input.tempo,
    phrase: input.phrase,
    chord_track: input.chord_track,
    key_track: input.key_track,
    tempo_track: input.tempo_track,
    created_at: timestamp,
    updated_at: timestamp,
  };
  store.tabs.push(tab);
  writeStore(store);
  return tab;
}

export function updateTab(tabId: string, patch: Partial<Omit<CourseTabRow, 'id' | 'user_id' | 'course_id' | 'created_at'>>) {
  const store = readStore();
  let updated: CourseTabRow | null = null;
  store.tabs = store.tabs.map(tab => {
    if (tab.id !== tabId) return tab;
    updated = { ...tab, ...patch, updated_at: now() };
    return updated;
  });
  writeStore(store);
  return updated;
}

export function deleteTab(tabId: string) {
  const store = readStore();
  store.tabs = store.tabs.filter(tab => tab.id !== tabId);
  writeStore(store);
}