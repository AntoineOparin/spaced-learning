import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { Scope } from '../../db/queries';
import { topicTrail } from '../../domain/topics';
import type { AnswerMode, RatingValue } from '../../domain/types';
import { IconButton } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { LoadingStatus, ProgressBar, Skeleton } from '../../ui/misc';
import { useToast } from '../../ui/Toast';
import { ItemEditor } from '../editor/ItemEditor';
import { cardFaces } from './answer';
import { CardView } from './CardView';
import { SessionFooter } from './SessionFooter';
import { ShortcutsDialog } from './ShortcutsDialog';
import { Summary } from './Summary';
import type { Stroke } from './sketch';
import { useStudyPrefs } from './useStudyPrefs';
import { useStudySession } from './useStudySession';
import { useStudyShortcuts } from './useStudyShortcuts';

export default function StudyPage() {
  const [params] = useSearchParams();
  const courseId = params.get('course') ?? undefined;
  const topicId = params.get('topic') ?? undefined;
  const scope = useMemo<Scope>(() => ({ courseId, topicId }), [courseId, topicId]);
  const navigate = useNavigate();
  const toast = useToast();
  const s = useStudySession(scope);
  const prefs = useStudyPrefs();

  const [typed, setTyped] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { current, phase } = s;
  const item = current?.item;
  const faces = current && item ? cardFaces(item, current.card) : null;
  // Your own choice wins; otherwise an item can suggest typing.
  const mode: AnswerMode =
    prefs.inputMode !== 'reveal'
      ? prefs.inputMode
      : item?.options.answerMode === 'typed'
        ? 'typed'
        : 'reveal';
  const previews = phase === 'answer' ? s.preview() : null;
  const exit = useCallback(() => navigate('/'), [navigate]);

  // Each question (even the same card coming straight back) starts blank, and typed mode
  // puts the cursor in the input.
  const { turn } = s;
  useEffect(() => {
    if (!turn) return;
    setTyped('');
    setStrokes((s) => (s.length ? [] : s)); // a fresh [] would re-render for nothing
    if (mode === 'typed') requestAnimationFrame(() => inputRef.current?.focus());
  }, [turn, mode]);

  // Move focus to the answer for screen readers and keyboard users.
  useEffect(() => {
    if (phase === 'answer') answerRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const { hintSeen, markHintSeen } = prefs;
  const rate = useCallback(
    (r: RatingValue) => {
      if (!hintSeen) markHintSeen();
      void s.rate(r, mode);
    },
    [s, mode, hintSeen, markHintSeen],
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

  const edit = useCallback(() => setEditing(true), []);
  const openHelp = useCallback(() => setHelp(true), []);
  const undoNow = useCallback(() => void undo(), [undo]);
  const suspendNow = useCallback(() => void suspend(), [suspend]);
  useStudyShortcuts({
    paused: editing || help,
    phase,
    hasCard: !!current,
    reveal: s.reveal,
    rate,
    undo: undoNow,
    edit,
    suspend: suspendNow,
    toggleWhy: prefs.toggleWhy,
    toggleMode: prefs.toggleMode,
    help: openHelp,
    exit,
  });

  const trail = useMemo(() => {
    if (!s.data || !current) return [];
    const course = s.data.courses.find((c) => c.id === current.card.courseId);
    return topicTrail(s.data.topics, current.card.topicId, course);
  }, [s.data, current]);

  const counts = s.counts;
  const remaining = counts ? counts.learning + counts.review + counts.new : 0;
  const progress =
    phase === 'done' ? 1 : s.stats.reviewed / Math.max(1, s.stats.reviewed + remaining);
  const inSession = phase === 'question' || phase === 'answer';

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
            <IconButton label="Edit item (E)" onClick={edit} disabled={!current}>
              <Icon name="edit" />
            </IconButton>
            <IconButton label="Suspend card (S)" onClick={() => void suspend()} disabled={!current}>
              <Icon name="pause" />
            </IconButton>
            <span className="hidden sm:inline-flex">
              <IconButton label="Keyboard shortcuts (?)" onClick={openHelp}>
                <Icon name="keyboard" />
              </IconButton>
            </span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {phase === 'loading' && (
          <LoadingStatus className="mx-auto w-full max-w-[720px] space-y-5 px-5 pt-10">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-3/4" />
          </LoadingStatus>
        )}

        {phase === 'done' && <Summary stats={s.stats} onExit={exit} />}

        {current && faces && inSession && (
          <CardView
            current={current}
            faces={faces}
            phase={phase}
            mode={mode}
            trail={trail}
            counts={counts}
            typed={typed}
            setTyped={setTyped}
            strokes={strokes}
            setStrokes={setStrokes}
            showWhy={prefs.showWhy}
            toggleWhy={prefs.toggleWhy}
            inputRef={inputRef}
            answerRef={answerRef}
            onReveal={s.reveal}
          />
        )}
      </main>

      {current && inSession && (
        <SessionFooter
          phase={phase}
          mode={mode}
          inputMode={prefs.inputMode}
          hintSeen={hintSeen}
          previews={previews}
          busy={s.busy}
          onReveal={s.reveal}
          onRate={rate}
          onToggleMode={prefs.toggleMode}
        />
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

      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
