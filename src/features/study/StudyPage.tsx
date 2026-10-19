import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { Scope } from '../../app/studyData';
import { RichText } from '../../content/RichText';
import { stripCloze } from '../../domain/cloze';
import { describeInterval, formatInterval, RATINGS } from '../../domain/scheduler';
import { topicPath } from '../../domain/topics';
import type { AnswerMode, RatingValue } from '../../domain/types';
import { Button, IconButton } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Dialog } from '../../ui/Dialog';
import { Textarea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Badge, Dot, Kbd, ProgressBar, Skeleton } from '../../ui/misc';
import { useToast } from '../../ui/Toast';
import { ItemEditor } from '../editor/ItemEditor';
import { cardFaces, isExactMatch } from './answer';
import { type SessionStats, useStudySession } from './useStudySession';

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

const TYPED_KEY = 'answerMode';
const EXPLAIN_KEY = 'showExplanations';
const HINT_KEY = 'ratingHintSeen';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

const SHORTCUTS: [string[], string][] = [
  [['Space', 'Enter'], 'Show answer, then rate Good'],
  [['1', '2', '3', '4'], 'Again · Hard · Good · Easy'],
  [['U', '⌘Z'], 'Undo last rating'],
  [['E'], 'Edit this item'],
  [['S'], 'Suspend this card'],
  [['I'], 'Show / hide explanation'],
  [['T'], 'Toggle typing answers'],
  [['Esc'], 'End session'],
  [['?'], 'This help'],
];

function Summary({ stats, onExit }: { stats: SessionStats; onExit: () => void }) {
  const mins = Math.max(1, Math.round(stats.timeMs / 60_000));
  const tiles = [
    { label: 'Reviewed', value: stats.reviewed, tone: 'text-accent-text' },
    { label: 'Minutes', value: mins, tone: 'text-xp-text' },
    { label: 'Forgotten', value: stats.again, tone: 'text-danger-text' },
  ];
  return (
    <div className="mx-auto w-full max-w-[480px] px-5 pt-12 pb-16 text-center">
      <div
        className={cn(
          'mx-auto flex size-20 animate-pop items-center justify-center rounded-full',
          stats.reviewed ? 'bg-accent-soft text-accent-text' : 'bg-surface text-muted',
        )}
      >
        <Icon name={stats.reviewed ? 'check' : 'today'} size={40} strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-3xl font-bold">
        {stats.reviewed ? 'Session complete' : 'Nothing due right now'}
      </h1>
      <p className="mt-2 text-muted">
        {!stats.reviewed
          ? 'New cards and reviews will appear here when they’re ready.'
          : stats.again === 0
            ? 'Every card recalled. Nicely done.'
            : `${stats.again} forgotten (${Math.round((stats.again / stats.reviewed) * 100)}%) — they’ll come back soon.`}
      </p>

      {stats.reviewed > 0 && (
        <dl className="mt-8 grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="animate-rise rounded-xl border border-line bg-bg-alt px-2 py-4"
            >
              <dt className={cn('text-xs font-bold', t.tone)}>{t.label}</dt>
              <dd className="mt-1 text-3xl font-extrabold tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {stats.forgotten.length > 0 && (
        <div className="mt-10 text-left">
          <h2 className="text-[15px] font-bold">Forgotten this session</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            If a card keeps failing, rewrite it: make it smaller, add a cue, or explain why.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-bg-alt">
            {stats.forgotten.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <RichText
                  source={stripCloze(item.fields.prompt)}
                  className="line-clamp-2 min-w-0 flex-1 text-sm"
                />
                <Link
                  to={`/items/${item.id}`}
                  className="shrink-0 text-sm font-bold text-accent-text hover:underline"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button variant="primary" size="lg" className="mt-10 w-full" onClick={onExit} autoFocus>
        Back to Today
      </Button>
    </div>
  );
}

export default function StudyPage() {
  const [params] = useSearchParams();
  const courseId = params.get('course') ?? undefined;
  const topicId = params.get('topic') ?? undefined;
  const scope = useMemo<Scope>(() => ({ courseId, topicId }), [courseId, topicId]);
  const navigate = useNavigate();
  const toast = useToast();
  const s = useStudySession(scope);

  const [typedMode, setTypedMode] = useState(() => readLocal(TYPED_KEY) === 'typed');
  const [typed, setTyped] = useState('');
  const [showWhy, setShowWhy] = useState(() => readLocal(EXPLAIN_KEY) === '1');
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState(false);
  const [hintSeen, setHintSeen] = useState(() => readLocal(HINT_KEY) === '1');
  const answerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { current, phase } = s;
  const item = current?.item;
  const faces = current && item ? cardFaces(item, current.card) : null;
  const mode: AnswerMode = typedMode || item?.options.answerMode === 'typed' ? 'typed' : 'reveal';
  const previews = phase === 'answer' ? s.preview() : null;
  const exit = useCallback(() => navigate('/'), [navigate]);

  // New card → clear the typed answer and focus the input in typed mode.
  const cardId = current?.card.id;
  useEffect(() => {
    if (!cardId) return;
    setTyped('');
    if (mode === 'typed') requestAnimationFrame(() => inputRef.current?.focus());
  }, [cardId, mode]);

  // Move focus to the answer for screen readers and keyboard users.
  useEffect(() => {
    if (phase === 'answer') answerRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const rate = useCallback(
    (r: RatingValue) => {
      if (!hintSeen) {
        setHintSeen(true);
        writeLocal(HINT_KEY, '1');
      }
      void s.rate(r, mode);
    },
    [s, mode, hintSeen],
  );

  const undo = useCallback(async () => {
    if (await s.undo()) toast({ message: 'Rating undone' });
  }, [s, toast]);

  const suspend = useCallback(async () => {
    const restore = await s.suspend();
    if (restore)
      toast({
        message: 'Card suspended',
        action: { label: 'Undo', onClick: () => void restore() },
      });
  }, [s, toast]);

  const toggleTyped = useCallback(() => {
    setTypedMode((v) => {
      writeLocal(TYPED_KEY, v ? 'reveal' : 'typed');
      return !v;
    });
  }, []);

  const toggleWhy = useCallback(() => {
    setShowWhy((v) => {
      writeLocal(EXPLAIN_KEY, v ? '0' : '1');
      return !v;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || help || e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const inField = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
      const mod = e.metaKey || e.ctrlKey;

      if (inField) {
        if (e.key === 'Enter' && !e.shiftKey && phase === 'question') {
          e.preventDefault();
          s.reveal();
        } else if (e.key === 'Escape') {
          (target as HTMLTextAreaElement).blur();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void undo();
        return;
      }
      if (mod || e.altKey) return;

      switch (e.key) {
        case ' ':
        case 'Enter':
          if (phase === 'question') {
            e.preventDefault();
            s.reveal();
          } else if (phase === 'answer') {
            e.preventDefault();
            rate(3);
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          if (phase === 'answer') rate(Number(e.key) as RatingValue);
          break;
        case 'u':
        case 'U':
          void undo();
          break;
        case 'e':
        case 'E':
          if (current) setEditing(true);
          break;
        case 's':
        case 'S':
          if (current) void suspend();
          break;
        case 'i':
        case 'I':
          if (phase === 'answer') toggleWhy();
          break;
        case 't':
        case 'T':
          if (phase === 'question') toggleTyped();
          break;
        case '?':
          setHelp(true);
          break;
        case 'Escape':
          exit();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, help, phase, s, rate, undo, suspend, toggleWhy, toggleTyped, exit, current]);

  const breadcrumb = useMemo(() => {
    if (!s.data || !current) return '';
    const course = s.data.courses.find((c) => c.id === current.card.courseId);
    const path = topicPath(s.data.topics, current.card.topicId).map((t) => t.name);
    return [course?.name, ...path].filter(Boolean).join(' › ');
  }, [s.data, current]);

  const counts = s.counts;
  const remaining = counts ? counts.learning + counts.review + counts.new : 0;
  const progress =
    phase === 'done' ? 1 : s.stats.reviewed / Math.max(1, s.stats.reviewed + remaining);
  const hasWhy = !!(item?.fields.explanation || item?.fields.mnemonic);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="pt-safe sticky top-0 z-20 bg-bg">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <IconButton label="End session (Esc)" onClick={exit}>
            <Icon name="x" size={22} />
          </IconButton>
          <ProgressBar value={progress} label="Session progress" className="mx-1 flex-1" />
          <div className="flex">
            <IconButton
              label="Undo (U)"
              onClick={() => void undo()}
              disabled={!s.canUndo || s.busy}
            >
              <Icon name="undo" />
            </IconButton>
            <IconButton label="Edit item (E)" onClick={() => setEditing(true)} disabled={!current}>
              <Icon name="edit" />
            </IconButton>
            <IconButton label="Suspend card (S)" onClick={() => void suspend()} disabled={!current}>
              <Icon name="pause" />
            </IconButton>
            <span className="hidden sm:inline-flex">
              <IconButton label="Keyboard shortcuts (?)" onClick={() => setHelp(true)}>
                <Icon name="keyboard" />
              </IconButton>
            </span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {phase === 'loading' && (
          <div className="mx-auto w-full max-w-[720px] space-y-5 px-5 pt-10" role="status">
            <span className="sr-only">Loading…</span>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        )}

        {phase === 'done' && <Summary stats={s.stats} onExit={exit} />}

        {current && item && faces && (phase === 'question' || phase === 'answer') && (
          // biome-ignore lint/a11y/useKeyWithClickEvents: Space/Enter reveal is handled globally
          // biome-ignore lint/a11y/noStaticElementInteractions: tap anywhere on the card to reveal
          <div
            className={cn(
              'mx-auto flex w-full max-w-[720px] flex-1 flex-col px-5 pt-4 pb-52 sm:pt-8',
              phase === 'question' && mode === 'reveal' && 'cursor-pointer',
            )}
            onClick={(e) => {
              if (
                phase === 'question' &&
                mode === 'reveal' &&
                !(e.target as HTMLElement).closest('a,button,textarea')
              )
                s.reveal();
            }}
          >
            {/* Keyed by card: each new card slides in from the direction of travel. */}
            <div key={current.card.id} className="animate-card">
              <div className="mb-8 flex items-center justify-between gap-4 text-[13px]">
                <p className="min-w-0 truncate text-muted">
                  <span className="hidden sm:inline">{breadcrumb}</span>
                  <span className="sm:hidden">{breadcrumb.split(' › ').pop()}</span>
                </p>
                {counts && (
                  <p className="flex shrink-0 gap-3 font-bold tabular-nums">
                    <span className="sr-only">Remaining:</span>
                    <span className="flex items-center gap-1.5" title="Learning">
                      <Dot className="bg-streak" />
                      {counts.learning}
                      <span className="sr-only"> learning,</span>
                    </span>
                    <span className="flex items-center gap-1.5" title="Reviews">
                      <Dot className="bg-accent" />
                      {counts.review}
                      <span className="sr-only"> reviews,</span>
                    </span>
                    <span className="flex items-center gap-1.5" title="New">
                      <Dot className="bg-xp" />
                      {counts.new}
                      <span className="sr-only"> new</span>
                    </span>
                  </p>
                )}
              </div>

              {(current.kind !== 'review' ||
                faces.isReverse ||
                faces.clozeOrdinal !== undefined) && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {current.kind === 'new' && <Badge tone="xp">New card</Badge>}
                  {current.kind === 'learning' && <Badge tone="streak">Learning</Badge>}
                  {faces.isReverse && <Badge>Reverse</Badge>}
                  {faces.clozeOrdinal !== undefined && <Badge>Fill in the blank</Badge>}
                </div>
              )}

              <article
                aria-label="Question"
                className="text-[22px] leading-normal font-medium sm:text-[26px]"
              >
                {faces.clozeOrdinal !== undefined ? (
                  <RichText
                    source={faces.prompt}
                    cloze={{ ordinal: faces.clozeOrdinal, reveal: phase === 'answer' }}
                  />
                ) : (
                  <RichText source={faces.prompt} />
                )}
              </article>

              {mode === 'typed' && phase === 'question' && (
                <div className="mt-8 space-y-3">
                  <Textarea
                    mono
                    ref={inputRef}
                    aria-label="Your answer"
                    placeholder="Type your answer — $…$ for math. Enter to check."
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    rows={2}
                  />
                  {typed.includes('$') && (
                    <div className="rounded-xl border border-line bg-bg-alt px-4 py-3 text-lg">
                      <RichText source={typed} />
                    </div>
                  )}
                </div>
              )}

              {phase === 'answer' && (
                <div
                  ref={answerRef}
                  tabIndex={-1}
                  aria-live="polite"
                  className="mt-8 animate-rise outline-none"
                >
                  <hr className="mb-8 border-line" />
                  {mode === 'typed' && (
                    <div className="mb-8 rounded-xl border border-line bg-bg-alt px-4 py-3">
                      <div className="mb-1 flex items-center justify-between text-[13px] text-muted">
                        <span className="font-semibold">Your answer</span>
                        {typed.trim() && isExactMatch(typed, faces.expected) && (
                          <span className="flex items-center gap-1 font-bold text-accent-text">
                            <Icon name="checkCircle" size={16} /> Matches the key
                          </span>
                        )}
                      </div>
                      {typed.trim() ? (
                        <RichText source={typed} className="text-lg" />
                      ) : (
                        <p className="text-sm text-muted">(no answer)</p>
                      )}
                    </div>
                  )}
                  {faces.clozeOrdinal === undefined ? (
                    <section
                      aria-label="Answer"
                      className="text-[22px] leading-normal font-medium sm:text-[26px]"
                    >
                      <RichText source={faces.answer} />
                    </section>
                  ) : (
                    faces.answer.trim() && (
                      <section aria-label="Extra" className="text-lg text-muted">
                        <RichText source={faces.answer} />
                      </section>
                    )
                  )}

                  {hasWhy && (
                    <div className="mt-10">
                      <button
                        type="button"
                        onClick={toggleWhy}
                        aria-expanded={showWhy}
                        className="-ml-1 flex items-center gap-1 rounded-lg px-1 py-0.5 text-[15px] font-bold text-accent-text"
                      >
                        <Icon
                          name="chevronRight"
                          size={18}
                          className={cn(
                            'transition-transform duration-(--spring-fast) ease-spring',
                            showWhy && 'rotate-90',
                          )}
                        />
                        Why?
                        <span className="ml-1.5 hidden sm:inline-flex">
                          <Kbd>I</Kbd>
                        </span>
                      </button>
                      {showWhy && (
                        <div className="mt-3 animate-rise space-y-4 rounded-xl border border-line bg-bg-alt px-5 py-4">
                          {item.fields.explanation && <RichText source={item.fields.explanation} />}
                          {item.fields.mnemonic && (
                            <div>
                              <div className="text-[13px] font-bold text-muted">Mnemonic</div>
                              <RichText source={item.fields.mnemonic} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {current && (phase === 'question' || phase === 'answer') && (
        <footer className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg">
          <div className="mx-auto max-w-[720px] px-4 pt-4">
            {phase === 'question' ? (
              <div className="flex items-center gap-3">
                <Button variant="primary" size="lg" className="flex-1" onClick={s.reveal}>
                  {mode === 'typed' ? 'Check answer' : 'Show answer'}
                  <span className="ml-2 hidden sm:inline-flex">
                    <Kbd onAccent>{mode === 'typed' ? 'Enter' : 'Space'}</Kbd>
                  </span>
                </Button>
                <Button
                  size="lg"
                  onClick={toggleTyped}
                  aria-pressed={typedMode}
                  title="Type answers before revealing (T)"
                  className={cn(
                    'px-4 sm:px-5',
                    typedMode &&
                      'border-accent bg-accent-soft text-accent-text [--lip-color:var(--accent-deep)] hover:bg-accent-soft',
                  )}
                >
                  <Icon name="keyboard" />
                  <span className="hidden sm:inline">{typedMode ? 'Typing on' : 'Type'}</span>
                </Button>
              </div>
            ) : (
              <>
                {!hintSeen && (
                  <p className="mb-3 text-center text-[13px] text-muted">
                    Be honest: <strong className="text-fg">Hard</strong> = recalled with effort.
                    Didn’t recall it? Choose <strong className="text-fg">Again</strong>.
                  </p>
                )}
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
                        disabled={s.busy}
                        onClick={() => rate(r)}
                        aria-label={`${meta.label} — ${meta.hint}; next review in ${describeInterval(ivl)}`}
                        className={cn(
                          'tactile flex h-[4.25rem] select-none flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-line-strong bg-bg [--lip-color:var(--line-strong)] disabled:opacity-50',
                          meta.tint,
                        )}
                      >
                        <span className={cn('text-[15px] font-extrabold', meta.text)}>
                          {meta.label}
                        </span>
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
              </>
            )}
          </div>
        </footer>
      )}

      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit item" size="xl">
        {editing && current && (
          <ItemEditor
            itemId={current.item.id}
            compact
            onDone={(_saved, action) => {
              setEditing(false);
              if (action !== 'cancelled') void s.reloadItem(current.item.id);
            }}
          />
        )}
      </Dialog>

      <Dialog open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts" size="sm">
        <dl className="divide-y divide-line text-sm">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={action} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dt>
              <dd className="text-right">{action}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}
