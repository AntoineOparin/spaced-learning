/** Reactive queries: components re-render when the underlying IndexedDB data changes. */
import { useLiveQuery } from 'dexie-react-hooks';
import { alive, type Course, type Item, type Settings, type Topic } from '../domain/types';
import { db, repo } from './instance';
import {
  type DashboardData,
  type LibraryData,
  loadDashboardData,
  loadLibraryData,
} from './queries';

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => repo.getSettings(), []);
}

export function useCourses(): Course[] | undefined {
  return useLiveQuery(
    async () => alive(await db.courses.toArray()).sort((a, b) => a.order - b.order),
    [],
  );
}

export function useTopics(): Topic[] | undefined {
  return useLiveQuery(async () => alive(await db.topics.toArray()), []);
}

export function useItem(id: string | undefined): Item | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.items.get(id)) ?? null) : null), [id]);
}

/** `fallback` is returned once loading finished and the key is absent; undefined = loading. */
export function useMeta<T>(key: string, fallback?: T): T | undefined {
  return useLiveQuery(async () => (await repo.getMeta<T>(key)) ?? fallback, [key, fallback]);
}

export function useLibraryData(): (LibraryData & { settings: Settings }) | undefined {
  return useLiveQuery(async () => {
    const [data, settings] = await Promise.all([loadLibraryData(db), repo.getSettings()]);
    return { ...data, settings };
  }, []);
}

/** `refresh` re-reads the data (and the clock) when it changes. */
export function useDashboardData(refresh: number): DashboardData | undefined {
  return useLiveQuery(async () => {
    const now = Date.now();
    return loadDashboardData(db, await repo.getSettings(), now);
  }, [refresh]);
}
