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
import { Kbd } from '../../ui/misc';
import { useToast } from '../../ui/Toast';
import { ItemEditor } from '../editor/ItemEditor';
import { cardFaces, isExactMatch } from './answer';
import { type SessionStats, useStudySession } from './useStudySession';

const RATING_META: Record<RatingValue, { label: string; hint: string; className: string }> = {
  1: {
    label: 'Again',
    hint: 'Forgot',
    className: 'text-again hover:bg-again-soft border-again/30',
  },
  2: {
    label: 'Hard',
    hint: 'Recalled with effort',
    className: 'text-hard hover:bg-hard-soft border-hard/30',
  },
  3: { label: 'Good', hint: 'Recalled', className: 'text-good hover:bg-good-soft border-good/30' },
  4: { label: 'Easy', hint: 'Instant', className: 'text-easy hover:bg-easy-soft border-easy/30' },
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

const SHORTCUTS: [string, string][] = [
  ['Space / Enter', 'Show answer, then rate Good'],
  ['1 2 3 4', 'Again · Hard · Good · Easy'],
  ['U  or  ⌘/Ctrl+Z', 'Undo last rating'],
  ['E', 'Edit this item'],
  ['S', 'Suspend this card'],
  ['I', 'Show / hide explanation'],
  ['T', 'Toggle typing answers'],
  ['Esc', 'End session'],
  ['?', 'This help'],
];

function Summary({ stats, onExit }: { stats: SessionStats; onExit: () => void }) {
  const mins = Math.max(1, Math.round(stats.timeMs / 60_000));
  return (
    <div className="mx-auto w-full max-w-lg py-10 text-center">
      <p className="text-sm text-muted">Session complete</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {stats.reviewed ? `${stats.reviewed} cards in ${mins} min` : 'Nothing due right now'}
      </h1>
      {stats.reviewed > 0 && (
        <p className="mt-2 text-muted">
          {stats.again === 0
            ? 'No forgotten cards.'
            : `${stats.again} forgotten (${Math.round((stats.again / stats.reviewed) * 100)}%) — they will come back soon.`}
        </p>
      )}
      {stats.forgotten.length > 0 && (
        <div className="mt-8 text-left">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
            Forgotten this session
          </h2>
          <p className="mt-1 text-xs text-muted">
            If a card keeps failing, rewrite it: make it smaller, add a cue, or explain why.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {stats.forgotten.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <RichText
                  source={stripCloze(item.fields.prompt)}
                  className="line-clamp-2 min-w-0 flex-1 text-sm"
                />
                <Link
                  to={`/items/${item.id}`}
                  className="shrink-0 text-sm text-accent hover:underline"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button variant="primary" size="lg" className="mt-10" onClick={onExit} autoFocus>
        Back to dashboard
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
  const hasWhy = !!(item?.fields.explanation || item?.fields.mnemonic);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
          <IconButton label="End session (Esc)" onClick={exit}>
            <Icon name="x" />
          </IconButton>
          <p className="min-w-0 flex-1 truncate text-xs text-muted">
            <span className="hidden sm:inline">{breadcrumb}</span>
            <span className="sm:hidden">{breadcrumb.split(' › ').pop()}</span>
          </p>
          {counts && phase !== 'done' && (
            <p className="flex gap-3 text-sm font-medium tabular-nums">
              <span className="sr-only">Remaining:</span>
              <span className="text-hard" title="Learning">
                {counts.learning}
                <span className="sr-only"> learning,</span>
              </span>
              <span className="text-good" title="Reviews">
                {counts.review}
                <span className="sr-only"> reviews,</span>
              </span>
              <span className="text-easy" title="New">
                {counts.new}
                <span className="sr-only"> new</span>
              </span>
            </p>
          )}
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
        {phase === 'loading' && <p className="m-auto text-sm text-muted">Loading…</p>}

        {phase === 'done' && <Summary stats={s.stats} onExit={exit} />}

        {current && item && faces && (phase === 'question' || phase === 'answer') && (
          // biome-ignore lint/a11y/useKeyWithClickEvents: Space/Enter reveal is handled globally
          // biome-ignore lint/a11y/noStaticElementInteractions: tap anywhere on the card to reveal
          <div
            className={cn(
              'mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-8 pb-40 sm:pt-14',
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
            <div className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              {current.kind === 'new' && <span className="text-easy">New</span>}
              {current.kind === 'learning' && <span className="text-hard">Learning</span>}
              {faces.isReverse && <span>Reverse</span>}
              {faces.clozeOrdinal !== undefined && <span>Fill in the blank</span>}
            </div>

            <article aria-label="Question" className="text-xl leading-relaxed sm:text-2xl">
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
              <div className="mt-8 space-y-2">
                <Textarea
                  ref={inputRef}
                  aria-label="Your answer"
                  placeholder="Type your answer — use $…$ for math. Enter to check."
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  rows={2}
                />
                {typed.includes('$') && (
                  <div className="rounded-lg bg-surface-2 px-3 py-2 text-lg">
                    <RichText source={typed} />
                  </div>
                )}
              </div>
            )}

            {phase === 'answer' && (
              <div ref={answerRef} tabIndex={-1} aria-live="polite" className="mt-8 outline-none">
                <hr className="mb-8 border-line" />
                {mode === 'typed' && (
                  <div className="mb-6 rounded-xl border border-line bg-surface px-4 py-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted">
                      <span>Your answer</span>
                      {typed.trim() && isExactMatch(typed, faces.expected) && (
                        <span className="flex items-center gap-1 font-medium text-good">
                          <Icon name="check" size={14} /> Matches the key
                        </span>
                      )}
                    </div>
                    {typed.trim() ? (
                      <RichText source={typed} className="text-lg" />
                    ) : (
                      <p className="text-sm text-faint">(no answer)</p>
                    )}
                  </div>
                )}
                {faces.clozeOrdinal === undefined ? (
                  <section aria-label="Answer" className="text-xl leading-relaxed sm:text-2xl">
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
                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={toggleWhy}
                      aria-expanded={showWhy}
                      className="flex items-center gap-1.5 text-sm font-medium text-accent"
                    >
                      <Icon name={showWhy ? 'chevronDown' : 'chevronRight'} size={16} />
                      Why?
                      <span className="ml-1 hidden sm:inline-flex">
                        <Kbd>I</Kbd>
                      </span>
                    </button>
                    {showWhy && (
                      <div className="mt-3 space-y-4 rounded-xl bg-surface-2 px-4 py-3 text-base">
                        {item.fields.explanation && <RichText source={item.fields.explanation} />}
                        {item.fields.mnemonic && (
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-wide text-faint">
                              Mnemonic
                            </div>
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
        )}
      </main>

      {current && (phase === 'question' || phase === 'answer') && (
        <footer className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto max-w-3xl px-3 pt-3">
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
                  variant="ghost"
                  onClick={toggleTyped}
                  aria-pressed={typedMode}
                  title="Type answers before revealing (T)"
                >
                  <Icon name="keyboard" />
                  <span className="hidden sm:inline">{typedMode ? 'Typing on' : 'Type'}</span>
                </Button>
              </div>
            ) : (
              <>
                {!hintSeen && (
                  <p className="mb-2 text-center text-xs text-muted">
                    Be honest: <strong>Hard</strong> = recalled with effort. If you didn't recall
                    it, choose <strong>Again</strong>.
                  </p>
                )}
                <fieldset className="grid grid-cols-4 gap-2">
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
                          'flex h-16 flex-col items-center justify-center rounded-xl border bg-surface transition-colors disabled:opacity-50',
                          meta.className,
                        )}
                      >
                        <span className="text-sm font-semibold">{meta.label}</span>
                        <span className="text-xs tabular-nums text-muted">
                          {outcome ? formatInterval(ivl) : ''}
                          <span className="ml-1 hidden text-faint sm:inline">· {r}</span>
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
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="font-mono text-xs text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}
