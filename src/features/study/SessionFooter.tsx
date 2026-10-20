/** The sticky bottom bar: reveal + mode toggles on the question, the four ratings on the answer. */

import type { ReviewOutcome } from '../../domain/scheduler';
import { describeInterval, formatInterval, RATINGS } from '../../domain/scheduler';
import type { AnswerMode, RatingValue } from '../../domain/types';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { Kbd } from '../../ui/misc';
import type { Phase } from './useStudySession';

/** Each rating owns one signal hue; tiles stay neutral until touched, so no answer is nudged. */
const RATING_META: Record<
  RatingValue,
  { label: string; hint: string; text: string; tint: string }
> = {
  1: {
    label: 'Again',
    hint: 'Forgot',
    text: 'text-danger-text',
    tint: 'hover:border-danger hover:bg-danger-soft hover:[--lip-color:var(--danger)] active:border-danger active:bg-danger-soft active:[--lip-color:var(--danger)]',
  },
  2: {
    label: 'Hard',
    hint: 'Recalled with effort',
    text: 'text-streak-text',
    tint: 'hover:border-streak hover:bg-streak-soft hover:[--lip-color:var(--streak)] active:border-streak active:bg-streak-soft active:[--lip-color:var(--streak)]',
  },
  3: {
    label: 'Good',
    hint: 'Recalled',
    text: 'text-accent-text',
    tint: 'hover:border-accent hover:bg-accent-soft hover:[--lip-color:var(--accent)] active:border-accent active:bg-accent-soft active:[--lip-color:var(--accent)]',
  },
  4: {
    label: 'Easy',
    hint: 'Instant',
    text: 'text-xp-text',
    tint: 'hover:border-xp hover:bg-xp-soft hover:[--lip-color:var(--xp)] active:border-xp active:bg-xp-soft active:[--lip-color:var(--xp)]',
  },
};

/** Footer toggle for an answer mode. The label stays constant; aria-pressed carries state. */
function ModeToggle({
  on,
  onClick,
  icon,
  label,
  shortcut,
}: {
  on: boolean;
  onClick: () => void;
  icon: IconName;
  label: string;
  shortcut: string;
}) {
  return (
    <Button
      size="lg"
      onClick={onClick}
      aria-pressed={on}
      title={`${label} answers before revealing (${shortcut})`}
      className={cn(
        'px-4 sm:px-5',
        on &&
          'border-accent bg-accent-soft text-accent-text [--lip-color:var(--accent-deep)] hover:bg-accent-soft',
      )}
    >
      <Icon name={icon} />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

export function RatingBar({
  previews,
  busy,
  onRate,
}: {
  previews: Record<RatingValue, ReviewOutcome> | null;
  busy: boolean;
  onRate: (r: RatingValue) => void;
}) {
  return (
    <fieldset className="grid grid-cols-4 gap-2 sm:gap-3">
      <legend className="sr-only">How well did you recall it?</legend>
      {RATINGS.map((r) => {
        const meta = RATING_META[r];
        const outcome = previews?.[r];
        const ivl = outcome ? outcome.card.due - Date.now() : 0;
        return (
          <button
            key={r}
            type="button"
            disabled={busy}
            onClick={() => onRate(r)}
            aria-label={`${meta.label} — ${meta.hint}; next review in ${describeInterval(ivl)}`}
            className={cn(
              'tactile flex h-[4.25rem] select-none flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-line-strong bg-bg [--lip-color:var(--line-strong)] disabled:opacity-50',
              meta.tint,
            )}
          >
            <span className={cn('text-[15px] font-extrabold', meta.text)}>{meta.label}</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted tabular-nums">
              {outcome ? formatInterval(ivl) : ''}
              <span className="hidden sm:inline-flex">
                <Kbd small>{r}</Kbd>
              </span>
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

export function SessionFooter({
  phase,
  mode,
  inputMode,
  hintSeen,
  previews,
  busy,
  onReveal,
  onRate,
  onToggleMode,
}: {
  phase: Phase;
  /** The effective mode (your choice, or the item's suggestion). */
  mode: AnswerMode;
  /** Your own per-device choice, shown pressed on the toggles. */
  inputMode: AnswerMode;
  hintSeen: boolean;
  previews: Record<RatingValue, ReviewOutcome> | null;
  busy: boolean;
  onReveal: () => void;
  onRate: (r: RatingValue) => void;
  onToggleMode: (m: Exclude<AnswerMode, 'reveal'>) => void;
}) {
  return (
    // In flow and sticky: it stays at the bottom of the screen, and the content above
    // always ends clear of it, whatever its height.
    <footer className="pb-safe sticky bottom-0 z-20 border-t border-line bg-bg">
      <div className="mx-auto max-w-[720px] px-4 pt-4">
        {phase === 'question' ? (
          <div className="flex items-center gap-3">
            <Button variant="primary" size="lg" className="flex-1" onClick={onReveal}>
              {mode === 'reveal' ? 'Show answer' : 'Check answer'}
              <span className="ml-2 hidden sm:inline-flex">
                <Kbd onAccent>{mode === 'typed' ? 'Enter' : 'Space'}</Kbd>
              </span>
            </Button>
            <ModeToggle
              on={inputMode === 'drawn'}
              onClick={() => onToggleMode('drawn')}
              icon="scribble"
              label="Draw"
              shortcut="D"
            />
            <ModeToggle
              on={inputMode === 'typed'}
              onClick={() => onToggleMode('typed')}
              icon="keyboard"
              label="Type"
              shortcut="T"
            />
          </div>
        ) : (
          <>
            {!hintSeen && (
              <p className="mb-3 text-center text-[13px] text-muted">
                Be honest: <strong className="text-fg">Hard</strong> = recalled with effort. Didn’t
                recall it? Choose <strong className="text-fg">Again</strong>.
              </p>
            )}
            <RatingBar previews={previews} busy={busy} onRate={onRate} />
          </>
        )}
      </div>
    </footer>
  );
}
