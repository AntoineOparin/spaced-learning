/** Search, filter and paging over a course's items, with the per-item lookups the list needs. */
import { useMemo, useState } from 'react';
import { compareCardKeys } from '../../domain/cardgen';
import { stripCloze } from '../../domain/cloze';
import { isLeech } from '../../domain/stats';
import { curriculumOrder, subtreeIds } from '../../domain/topics';
import { type Card, CardState, type Course, type Item, type Topic } from '../../domain/types';

export type Filter = 'all' | 'new' | 'due' | 'suspended' | 'leech';
export const PAGE = 50;

export interface FilterInput {
  items: Item[];
  cards: Card[];
  topics: Topic[];
  leechThreshold: number;
}

export function useItemFilter(
  data: FilterInput | undefined,
  course: Course | null,
  selectedTopic: Topic | null,
  dayEnd: number,
  initialQuery: string,
) {
  const [query, setQueryState] = useState(initialQuery);
  const [filter, setFilterState] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const resetPage = () => setLimit(PAGE);
  const setQuery = (q: string) => {
    setQueryState(q);
    resetPage();
  };
  const setFilter = (f: Filter) => {
    setFilterState(f);
    resetPage();
  };
  const showMore = () => setLimit((l) => l + PAGE);

  const itemCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of data?.items ?? []) m.set(it.topicId, (m.get(it.topicId) ?? 0) + 1);
    return m;
  }, [data]);

  const cardsByItem = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const c of data?.cards ?? []) {
      const list = m.get(c.itemId) ?? [];
      list.push(c);
      m.set(c.itemId, list);
    }
    for (const list of m.values()) list.sort((a, b) => compareCardKeys(a.key, b.key));
    return m;
  }, [data]);

  // Lower-cased text per item, built once per data change rather than on every keystroke.
  const searchText = useMemo(
    () =>
      new Map(
        (data?.items ?? []).map((it) => [
          it.id,
          [
            it.fields.prompt,
            stripCloze(it.fields.prompt),
            it.fields.answer,
            it.fields.explanation,
            it.fields.mnemonic,
            it.tags.join(' '),
          ]
            .join('\n')
            .toLowerCase(),
        ]),
      ),
    [data],
  );

  const visibleItems = useMemo(() => {
    if (!data || !course) return [];
    const q = query.trim().toLowerCase();
    const inScope = selectedTopic
      ? subtreeIds(data.topics, selectedTopic.id)
      : new Set(data.topics.filter((t) => t.courseId === course.id).map((t) => t.id));
    const order = new Map(curriculumOrder(data.topics, course.id).map((t, i) => [t.id, i]));
    return (
      data.items
        // A search with no topic selected looks across every course.
        .filter((it) => (q && !selectedTopic) || inScope.has(it.topicId))
        .filter((it) => !q || searchText.get(it.id)?.includes(q))
        .filter((it) => {
          if (filter === 'all') return true;
          const cards = cardsByItem.get(it.id) ?? [];
          switch (filter) {
            case 'new':
              return cards.some((c) => c.state === CardState.New && !c.suspended);
            case 'due':
              return cards.some((c) => c.state !== CardState.New && !c.suspended && c.due < dayEnd);
            case 'suspended':
              return cards.some((c) => c.suspended);
            case 'leech':
              return cards.some((c) => isLeech(c, data.leechThreshold));
            default:
              return true;
          }
        })
        .sort(
          (a, b) =>
            (order.get(a.topicId) ?? 999) - (order.get(b.topicId) ?? 999) || a.order - b.order,
        )
    );
  }, [data, course, selectedTopic, query, filter, cardsByItem, dayEnd, searchText]);

  return {
    query,
    setQuery,
    filter,
    setFilter,
    limit,
    showMore,
    resetPage,
    itemCounts,
    cardsByItem,
    visibleItems,
  };
}
