/** Reactive queries: components re-render when the underlying IndexedDB data changes. */
import { useLiveQuery } from 'dexie-react-hooks';
import type { Course, Item, Settings, Topic } from '../domain/types';
import { db, repo } from './instance';

const alive = <T extends { deletedAt?: number }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === undefined);

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

export function useMeta<T>(key: string): T | undefined {
  return useLiveQuery(() => repo.getMeta<T>(key), [key]);
}
