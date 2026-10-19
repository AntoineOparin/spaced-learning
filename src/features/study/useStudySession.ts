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
import type { AnswerMode, Card, Item, RatingValue } from '../../domain/types';
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

export interface SessionStats {
  reviewed: number;
  again: number;
  timeMs: number;
  /** Items forgotten (Again) during this session. */
  forgotten: Item[];
}

export type Phase = 'loading' | 'question' | 'answer' | 'done';

export function useStudySession(scope: Scope) {
  const [data, setData] = useState<StudyData | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<SessionState>(() => ({
    reviewsSinceNew: 0,
    lastTopicId: null,
    seed: Math.floor(Math.random() * 2 ** 31),
  }));
  const [history, setHistory] = useState<UndoEntry[]>([]);
  const [stats, setStats] = useState<SessionStats>({
    reviewed: 0,
    again: 0,
    timeMs: 0,
    forgotten: [],
  });
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());
  const initialSession = useRef(session);

  const choose = useCallback(
    (d: StudyData, s: SessionState) => {
      const pick = pickNext(buildQueueInput(d, scope, s, Date.now()));
      const item = pick && d.items.find((i) => i.id === pick.card.itemId);
      if (!pick || !item) {
        setCurrent(null);
        setPhase('done');
        return;
      }
      setCurrent({ card: pick.card, item, kind: pick.kind });
      setPhase('question');
      shownAt.current = Date.now();
    },
    [scope],
  );

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await repo.getSettings();
      const loaded = await loadStudyData(db, settings, Date.now());
      if (cancelled) return;
      setData(loaded);
      choose(loaded, initialSession.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [choose]);

  // Push progress to the server when leaving the session.
  useEffect(() => () => void syncManager.sync(), []);

  const reveal = useCallback(() => {
    if (phase === 'question') setPhase('answer');
  }, [phase]);

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
        setStats((s) => ({
          reviewed: s.reviewed + 1,
          again: s.again + (rating === 1 ? 1 : 0),
          timeMs: s.timeMs + durationMs,
          forgotten:
            rating === 1 && !s.forgotten.some((i) => i.id === current.item.id)
              ? [...s.forgotten, current.item]
              : s.forgotten,
        }));
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
      setStats((s) => ({
        ...s,
        reviewed: Math.max(0, s.reviewed - 1),
        again: s.again - (last.result.log.rating === 1 ? 1 : 0),
        timeMs: Math.max(0, s.timeMs - last.result.log.durationMs),
      }));
      setData(nextData);
      setSession(last.session);
      if (item) {
        setCurrent({ card: restored, item, kind: last.kind });
        setPhase('question');
        shownAt.current = Date.now();
      }
      return true;
    } finally {
      setBusy(false);
    }
  }, [data, history, busy]);

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
      setData((d) =>
        d
          ? { ...d, cards: d.cards.map((c) => (c.id === card.id ? { ...c, suspended: false } : c)) }
          : d,
      );
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
      const aliveCards = cards.filter((c) => c.deletedAt === undefined);
      const nextData: StudyData = {
        ...data,
        items: [
          ...data.items.filter((i) => i.id !== itemId),
          ...(item && !item.deletedAt ? [item] : []),
        ],
        cards: [
          ...data.cards.filter((c) => c.itemId !== itemId),
          ...(item && !item.deletedAt ? aliveCards : []),
        ],
      };
      setData(nextData);
      if (current?.item.id === itemId) {
        const card = nextData.cards.find((c) => c.id === current.card.id);
        const fresh = nextData.items.find((i) => i.id === itemId);
        if (card && fresh) setCurrent({ ...current, card, item: fresh });
        else choose(nextData, session);
      }
    },
    [data, current, session, choose],
  );

  // Counts don't depend on the clock within a study day (learning cards count whether due now or
  // later today), so they only need recomputing when the data or session changes.
  const counts = useMemo(
    () => (data ? queueCounts(buildQueueInput(data, scope, session, Date.now())) : null),
    [data, scope, session],
  );

  return {
    data,
    phase,
    current,
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
