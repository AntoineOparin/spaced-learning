/**
 * Every bundled deck: schema-valid, well-structured, and every formula renders in KaTeX.
 * Run one deck with `npx vitest run src/content/decks -t comp352`.
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../../io/schema';
import { itemErrors, qualityWarnings } from '../validate';
import { BUNDLED_DECKS } from './index';

/** Minimum item counts, so a deck can't silently shrink. */
const MIN_ITEMS: Record<string, number> = {
  'calc2-core': 180,
  'comp352-core': 200,
  'comp232-core': 200,
  'econ203-core': 180,
};

const packs = await Promise.all(
  BUNDLED_DECKS.map(async (deck) => ({ deck, pack: await deck.load() })),
);

describe.each(packs)('bundled deck $deck.id', ({ deck, pack }) => {
  it('matches the content-pack schema and is big enough', () => {
    expect(pack.deck.id).toBe(deck.id);
    expect(pack.items.length).toBeGreaterThanOrEqual(MIN_ITEMS[deck.id] ?? 50);
  });

  it('every topic has items and every item sits in a leaf topic', () => {
    const parents = new Set(pack.topics.map((t) => t.parentKey).filter(Boolean));
    const used = new Set(pack.items.map((i) => i.topicKey));
    for (const t of pack.topics) {
      if (parents.has(t.key)) expect(used.has(t.key), `${t.key} is a parent`).toBe(false);
      else expect(used.has(t.key), `${t.key} is empty`).toBe(true);
    }
  });

  it('keeps every leaf topic to a reviewable size', () => {
    const counts = new Map<string, number>();
    for (const i of pack.items) counts.set(i.topicKey, (counts.get(i.topicKey) ?? 0) + 1);
    for (const [key, n] of counts) {
      expect(n, `${key} has ${n} items`).toBeGreaterThanOrEqual(3);
      expect(n, `${key} has ${n} items`).toBeLessThanOrEqual(40);
    }
  });

  it.each(pack.items.map((i) => [i.key, i] as const))(
    '%s renders without KaTeX errors',
    (_, item) => {
      expect(itemErrors({ type: item.type, fields: fieldsOf(item) })).toEqual([]);
    },
  );

  it('has no item that the editor would warn about', () => {
    const warned = pack.items
      .map((i) => [i.key, qualityWarnings({ type: i.type, fields: fieldsOf(i) })] as const)
      .filter(([, w]) => w.length);
    expect(warned).toEqual([]);
  });
});

function fieldsOf(item: ContentPack['items'][number]) {
  return {
    prompt: item.prompt,
    answer: item.answer,
    ...(item.explanation ? { explanation: item.explanation } : {}),
    ...(item.mnemonic ? { mnemonic: item.mnemonic } : {}),
  };
}
