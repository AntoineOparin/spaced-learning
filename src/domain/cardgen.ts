/**
 * Item → Card generation. An item produces cards identified by stable keys:
 *   basic: 'fwd' (+ 'rev' when options.reverse)    cloze: 'c1', 'c2', …
 * Editing an item reconciles by key so existing cards keep their scheduling history.
 */
import { clozeOrdinals } from './cloze';
import { newId } from './ids';
import { newFsrsCard } from './scheduler';
import type { Card, Item } from './types';

export function cardKeysForItem(item: Pick<Item, 'type' | 'fields' | 'options'>): string[] {
  if (item.type === 'cloze') {
    return clozeOrdinals(item.fields.prompt).map((n) => `c${n}`);
  }
  return item.options.reverse ? ['fwd', 'rev'] : ['fwd'];
}

/** Ordinal of a cloze card key ('c3' → 3), or null for basic keys. */
export function clozeOrdinalFromKey(key: string): number | null {
  const m = /^c(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}

/** Order of an item's cards: fwd before rev, c1 before c2 (capped at 999 for ranking). */
export function cardKeyRank(key: string): number {
  if (key === 'fwd') return 0;
  if (key === 'rev') return 1;
  return Math.min(clozeOrdinalFromKey(key) ?? 0, 999);
}

export const compareCardKeys = (a: string, b: string) => cardKeyRank(a) - cardKeyRank(b);

export function newCard(item: Item, key: string, now: number): Card {
  const fsrs = newFsrsCard(now);
  return {
    id: newId(),
    itemId: item.id,
    courseId: item.courseId,
    topicId: item.topicId,
    key,
    suspended: false,
    fsrs,
    due: fsrs.due,
    state: fsrs.state,
    updatedAt: now,
    dirty: 1,
  };
}

export interface CardReconciliation {
  /** Brand-new cards to insert. */
  create: Card[];
  /** Existing cards to write back (revived, moved to another topic, or tombstoned). */
  update: Card[];
}

/**
 * Reconciles an item's cards after an edit. `existing` must contain ALL cards of the item,
 * including tombstoned ones (a re-added cloze revives its old card and history).
 */
export function reconcileCards(item: Item, existing: Card[], now: number): CardReconciliation {
  const wanted = new Set(item.deletedAt === undefined ? cardKeysForItem(item) : []);
  const byKey = new Map(existing.map((c) => [c.key, c]));
  const create: Card[] = [];
  const update: Card[] = [];

  for (const key of wanted) {
    if (!byKey.has(key)) create.push(newCard(item, key, now));
  }

  for (const card of existing) {
    const shouldLive = wanted.has(card.key);
    const isLive = card.deletedAt === undefined;
    const moved = card.courseId !== item.courseId || card.topicId !== item.topicId;
    if (!shouldLive && !isLive) continue;
    if (shouldLive && isLive && !moved) continue;

    const next: Card = {
      ...card,
      courseId: item.courseId,
      topicId: item.topicId,
      updatedAt: now,
      dirty: 1,
    };
    if (shouldLive) delete next.deletedAt;
    else if (isLive) next.deletedAt = now;
    update.push(next);
  }

  return { create, update };
}
