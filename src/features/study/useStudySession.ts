/**
 * Study session state machine: question → (reveal) → answer → (rate) → next question.
 * Data is loaded once per session; the queue is recomputed after every answer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildQueueInput,
  loadStudyData,
  type Scope,
  type SessionState,
  type StudyData,
} from '../../app/studyData';
import { db, repo } from '../../db/instance';
import type { ReviewResult } from '../../db/repo';
import { MINUTE } from '../../domain/day';
import { pickNext, type QueueKind, queueCounts } from '../../domain/queue';
import { type ReviewOutcome, schedulerForCourse } from '../../domain/scheduler';
import { sessionStats } from '../../domain/stats';
import { type AnswerMode, alive, type Card, type Item, type RatingValue } from '../../domain/types';
import { syncManager } from '../../sync/manager';

/** Long pauses (walked away) shouldn't distort recorded answer times. */
const MAX_DURATION_MS = MINUTE;

export interface Current {
  card: Card;
  item: Item;
  kind: QueueKind;
}

interface UndoEntry {
  result: ReviewResult;
  kind: QueueKind;
  session: SessionState;
}

export type Phase = 'loading' | 'question' | 'answer' | 'done';

export function useStudySession(scope: Scope) {
  const [data, setData] = useState<StudyData | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [revealed, setRevealed] = useState(false);
  // Counts the questions shown: a card that comes straight back (after Again) is a new one.
  const [turn, setTurn] = useState(0);
  const [session, setSession] = useState<SessionState>(() => ({
    reviewsSinceNew: 0,
    lastTopicId: null,
    seed: Math.floor(Math.random() * 2 ** 31),
  }));
  const [history, setHistory] = useState<UndoEntry[]>([]);
  // This session's reviews are the day's logs from this index on (undo removes them again).
  const [firstLog, setFirstLog] = useState(0);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());
  const initialSession = useRef(session);

  const phase: Phase = !data ? 'loading' : !current ? 'done' : revealed ? 'answer' : 'question';

  // For callbacks that run later (a toast's Undo), after more answers may have been given.
  const latest = useRef({ data, current, session });
  useEffect(() => {
    latest.current = { data, current, session };
  });

  /** Shows a card's question (or the end of the session for null). */
  const show = useCallback((next: Current | null) => {
    setCurrent(next);
    setRevealed(false);
    setTurn((t) => t + 1);
    shownAt.current = Date.now();
  }, []);

  const choose = useCallback(
    (d: StudyData, s: SessionState) => {
      const pick = pickNext(buildQueueInput(d, scope, s, Date.now()));
      const item = pick && d.items.find((i) => i.id === pick.card.itemId);
      show(pick && item ? { card: pick.card, item, kind: pick.kind } : null);
    },
    [scope, show],
  );

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await repo.getSettings();
      const loaded = await loadStudyData(db, settings, Date.now());
      if (cancelled) return;
      setData(loaded);
      setFirstLog(loaded.todayLogs.length);
      choose(loaded, initialSession.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [choose]);

  // Push progress to the server when leaving the session.
  useEffect(() => () => void syncManager.sync(), []);

  const reveal = useCallback(() => setRevealed(true), []);

  const preview = useCallback((): Record<RatingValue, ReviewOutcome> | null => {
    if (!data || !current) return null;
    const course = data.courses.find((c) => c.id === current.card.courseId);
    return schedulerForCourse(data.settings, course).preview(current.card.fsrs, Date.now());
  }, [data, current]);

  const rate = useCallback(
    async (rating: RatingValue, mode: AnswerMode) => {
      if (!data || !current || busy || phase !== 'answer') return;
      setBusy(true);
      try {
        const durationMs = Math.min(Date.now() - shownAt.current, MAX_DURATION_MS);
        const result = await repo.recordReview({
          cardId: current.card.id,
          rating,
          durationMs,
          mode,
        });
        const nextData: StudyData = {
          ...data,
          cards: data.cards.map((c) => (c.id === result.card.id ? result.card : c)),
          todayLogs: [...data.todayLogs, result.log],
        };
        const nextSession: SessionState = {
          ...session,
          reviewsSinceNew: current.kind === 'new' ? 0 : session.reviewsSinceNew + 1,
          lastTopicId: current.card.topicId,
        };
        setHistory((h) => [...h.slice(-49), { result, kind: current.kind, session }]);
        setData(nextData);
        setSession(nextSession);
        choose(nextData, nextSession);
      } finally {
        setBusy(false);
      }
    },
    [data, current, busy, phase, session, choose],
  );

  const undo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!data || !last || busy) return false;
    setBusy(true);
    try {
      await repo.undoReview(last.result);
      const restored = last.result.previous;
      const nextData: StudyData = {
        ...data,
        cards: data.cards.map((c) => (c.id === restored.id ? restored : c)),
        todayLogs: data.todayLogs.filter((l) => l.id !== last.result.log.id),
      };
      const item = nextData.items.find((i) => i.id === restored.itemId);
      setHistory((h) => h.slice(0, -1));
      setData(nextData);
      setSession(last.session);
      if (item) show({ card: restored, item, kind: last.kind });
      return true;
    } finally {
      setBusy(false);
    }
  }, [data, history, busy, show]);

  /** Suspends the current card and moves on. Returns a function that reverses it. */
  const suspend = useCallback(async () => {
    if (!data || !current) return null;
    const card = current.card;
    await repo.setSuspended([card.id], true);
    const nextData = {
      ...data,
      cards: data.cards.map((c) => (c.id === card.id ? { ...c, suspended: true } : c)),
    };
    setData(nextData);
    choose(nextData, session);
    return async () => {
      await repo.setSuspended([card.id], false);
      const { data: d, current: c, session: s } = latest.current;
      if (!d) return;
      const restored = {
        ...d,
        cards: d.cards.map((x) => (x.id === card.id ? { ...x, suspended: false } : x)),
      };
      setData(restored);
      // Suspending the last card ended the session: undoing it carries on with that card.
      if (!c) choose(restored, s);
    };
  }, [data, current, session, choose]);

  /** Reloads an item (and its cards) after it was edited during the session. */
  const reloadItem = useCallback(
    async (itemId: string) => {
      if (!data) return;
      const [item, cards] = await Promise.all([
        db.items.get(itemId),
        db.cards.where('itemId').equals(itemId).toArray(),
      ]);
      const fresh = item && !item.deletedAt ? item : null;
      const nextData: StudyData = {
        ...data,
        items: [...data.items.filter((i) => i.id !== itemId), ...(fresh ? [fresh] : [])],
        cards: [...data.cards.filter((c) => c.itemId !== itemId), ...(fresh ? alive(cards) : [])],
      };
      setData(nextData);
      if (current?.item.id === itemId) {
        const card = fresh && nextData.cards.find((c) => c.id === current.card.id);
        if (fresh && card) setCurrent({ ...current, card, item: fresh });
        else choose(nextData, session);
      }
    },
    [data, current, session, choose],
  );

  // Recomputed after each answer. (A learning card entering the learn-ahead window between
  // answers shows up in the count with the next one.)
  const counts = useMemo(
    () => (data ? queueCounts(buildQueueInput(data, scope, session, Date.now())) : null),
    [data, scope, session],
  );

  const stats = useMemo(
    () => sessionStats(data?.todayLogs.slice(firstLog) ?? [], data?.items ?? []),
    [data, firstLog],
  );

  return {
    data,
    phase,
    current,
    turn,
    counts,
    stats,
    busy,
    canUndo: history.length > 0,
    reveal,
    rate,
    undo,
    suspend,
    reloadItem,
    preview,
  };
}
