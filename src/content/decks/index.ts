/** Curated decks bundled with the app (loaded on demand to keep the initial bundle small). */
import type { ContentPack } from '../../io/schema';

export interface BundledDeck {
  id: string;
  title: string;
  description: string;
  load: () => Promise<ContentPack>;
}

export const BUNDLED_DECKS: BundledDeck[] = [
  {
    id: 'calc2-core',
    title: 'Calculus 2',
    description:
      'Trig identities, integration techniques, improper integrals, applications, parametric & polar, sequences & series, Taylor series.',
    load: async () => {
      const [{ contentPackSchema }, deck] = await Promise.all([
        import('../../io/schema'),
        import('./calc2.json'),
      ]);
      return contentPackSchema.parse(deck.default);
    },
  },
];
