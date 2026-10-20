import { useState } from 'react';
import { Link } from 'react-router';
import { BUNDLED_DECKS, type BundledDeck } from '../../content/decks';
import { Button, buttonClass } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Panel } from '../../ui/misc';
import { InstallDeckDialog } from '../decks/InstallDeckDialog';

const STEPS = [
  ['Recall', 'Try to answer from memory before you look. The effort is what makes it stick.'],
  ['Check', 'Reveal the answer and compare it with what you remembered.'],
  ['Rate', 'Say how it went. FSRS schedules the card for just before you’d forget it.'],
];

/** First-run screen, shown until the first course exists. */
export function Welcome() {
  const [deck, setDeck] = useState<BundledDeck | null>(null);
  return (
    <div className="mx-auto max-w-2xl md:py-4">
      <img src="/favicon.svg" alt="" className="size-14 animate-pop" />
      <h1 className="mt-6 text-4xl font-bold">Welcome to Spaced</h1>
      <p className="mt-3 text-lg text-muted">
        A few minutes a day keeps a whole course in memory. Here is how a review works:
      </p>
      <ol className="mt-8 space-y-5">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-extrabold text-accent-text">
              {i + 1}
            </span>
            <p className="pt-1 text-[15px] text-muted">
              <strong className="font-bold text-fg">{title}.</strong> {body}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Panel className="flex flex-col">
          <h2 className="text-lg font-bold">Start with a curated deck</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Each has 150–250 cards written from the course material. Pick the topics your course has
            covered so far.
          </p>
          <ul className="mt-auto space-y-2">
            {BUNDLED_DECKS.map((d) => (
              <li key={d.id}>
                <Button
                  variant={d === BUNDLED_DECKS[0] ? 'primary' : 'secondary'}
                  className="w-full justify-between"
                  aria-label={`Install ${d.title}`}
                  onClick={() => setDeck(d)}
                >
                  <span className="truncate">{d.title}</span>
                  <Icon name="download" size={16} className="shrink-0" />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="flex flex-col">
          <h2 className="text-lg font-bold">Build your own</h2>
          <p className="mt-1 mb-6 text-sm text-muted">
            Create a course, organise it into topics, and write your own cards.
          </p>
          <Link to="/library?new=course" className={buttonClass('secondary', 'md', 'mt-auto')}>
            Create a course
          </Link>
        </Panel>
      </div>
      <InstallDeckDialog
        key={deck?.id}
        deck={deck ?? undefined}
        open={deck !== null}
        onClose={() => setDeck(null)}
      />
    </div>
  );
}
