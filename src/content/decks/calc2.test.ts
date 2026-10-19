import { describe, expect, it } from 'vitest';
import { contentPackSchema } from '../../io/schema';
import { itemErrors } from '../validate';
import deck from './calc2.json';

const pack = contentPackSchema.parse(deck);

describe('curated Calculus 2 deck', () => {
  it('matches the content-pack schema', () => {
    expect(pack.deck.id).toBe('calc2-core');
    expect(pack.items.length).toBeGreaterThanOrEqual(180);
  });

  it('every topic has items and every item sits in a leaf topic', () => {
    const parents = new Set(pack.topics.map((t) => t.parentKey).filter(Boolean));
    const used = new Set(pack.items.map((i) => i.topicKey));
    for (const t of pack.topics) {
      if (parents.has(t.key)) expect(used.has(t.key), `${t.key} is a parent`).toBe(false);
      else expect(used.has(t.key), `${t.key} is empty`).toBe(true);
    }
  });

  it.each(pack.items.map((i) => [i.key, i] as const))(
    '%s renders without KaTeX errors',
    (_, item) => {
      const fields = {
        prompt: item.prompt,
        answer: item.answer,
        ...(item.explanation ? { explanation: item.explanation } : {}),
        ...(item.mnemonic ? { mnemonic: item.mnemonic } : {}),
      };
      expect(itemErrors({ type: item.type, fields })).toEqual([]);
    },
  );
});
