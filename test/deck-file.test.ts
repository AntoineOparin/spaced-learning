/**
 * Validates one content-pack JSON file the way the bundled-deck tests do, without needing the
 * other decks to exist:
 *   DECK=src/content/decks/comp352.json npx vitest run test/deck-file.test.ts
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { itemErrors, qualityWarnings } from '../src/content/validate';
import { contentPackSchema, parseJson } from '../src/io/schema';

const file = process.env.DECK;

describe.skipIf(!file)(`deck file ${file}`, () => {
  const parsed = file
    ? parseJson(readFileSync(file, 'utf8'), contentPackSchema, 50)
    : ({ ok: false, errors: ['DECK is not set'] } as const);

  it('matches the content-pack schema', () => {
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
  });

  if (!parsed.ok) return;
  const pack = parsed.data;
  const parents = new Set(pack.topics.map((t) => t.parentKey).filter(Boolean));
  const counts = new Map<string, number>();
  for (const i of pack.items) counts.set(i.topicKey, (counts.get(i.topicKey) ?? 0) + 1);

  it('has a sound topic tree with 3–40 items per leaf topic', () => {
    const problems: string[] = [];
    for (const t of pack.topics) {
      const n = counts.get(t.key) ?? 0;
      if (parents.has(t.key) && n) problems.push(`${t.key} is a parent but has ${n} items`);
      if (!parents.has(t.key) && n < 3) problems.push(`${t.key} has only ${n} items`);
      if (n > 40) problems.push(`${t.key} has ${n} items (split it)`);
    }
    expect(problems).toEqual([]);
  });

  it('every item renders in KaTeX without editor warnings', () => {
    const problems: string[] = [];
    for (const item of pack.items) {
      const fields = {
        prompt: item.prompt,
        answer: item.answer,
        ...(item.explanation ? { explanation: item.explanation } : {}),
        ...(item.mnemonic ? { mnemonic: item.mnemonic } : {}),
      };
      for (const e of itemErrors({ type: item.type, fields }))
        problems.push(`${item.key} [${e.field}]: ${e.message}`);
      for (const w of qualityWarnings({ type: item.type, fields }))
        problems.push(`${item.key}: ${w}`);
    }
    expect(problems).toEqual([]);
  });

  it('summary', () => {
    const leaves = pack.topics.filter((t) => !parents.has(t.key)).length;
    const cloze = pack.items.filter((i) => i.type === 'cloze').length;
    console.log(
      `${file}: ${pack.items.length} items, ${pack.topics.length} topics (${leaves} leaves), ${cloze} cloze, ${pack.items.filter((i) => i.explanation).length} with explanations`,
    );
  });
});
