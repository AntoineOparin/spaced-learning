/** Curated decks bundled with the app (loaded on demand to keep the initial bundle small). */
import type { ContentPack } from '../../io/schema';

export interface BundledDeck {
  id: string;
  title: string;
  description: string;
  load: () => Promise<ContentPack>;
}

async function loadPack(load: () => Promise<{ default: unknown }>): Promise<ContentPack> {
  const [{ contentPackSchema }, deck] = await Promise.all([import('../../io/schema'), load()]);
  return contentPackSchema.parse(deck.default);
}

export const BUNDLED_DECKS: BundledDeck[] = [
  {
    id: 'calc2-core',
    title: 'Calculus 2',
    description:
      'Trig identities, integration techniques, improper integrals, applications, parametric & polar, sequences & series, Taylor series.',
    load: () => loadPack(() => import('./calc2.json')),
  },
  {
    id: 'comp352-core',
    title: 'COMP 352 · Data Structures & Algorithms',
    description:
      'Asymptotic analysis, recursion, arrays and linked structures, ADTs, stacks/queues, trees, heaps, hashing, graphs and sorting.',
    load: () => loadPack(() => import('./comp352.json')),
  },
  {
    id: 'comp232-core',
    title: 'COMP 232 · Mathematics for Computer Science',
    description:
      'Propositional and predicate logic, rules of inference, proof techniques, sets, functions, number theory, induction, relations and orderings.',
    load: () => loadPack(() => import('./comp232.json')),
  },
  {
    id: 'econ203-core',
    title: 'ECON 203 · Introduction to Macroeconomics',
    description:
      'Measuring GDP, the short-run model and multipliers, AD/AS, the long run and growth, money and banking, monetary and fiscal policy, debt and the open economy.',
    load: () => loadPack(() => import('./econ203.json')),
  },
];
