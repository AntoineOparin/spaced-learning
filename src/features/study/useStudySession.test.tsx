// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDB } from '../../db/db';
import { Repo } from '../../db/repo';
import { MINUTE } from '../../domain/day';
import { T0 } from '../../test/factories';
import { type SessionDeps, useStudySession } from './useStudySession';

let db: AppDB;
let repo: Repo;
let deps: SessionDeps;
let n = 0;
const clock = { now: T0 };
// Stable like the page's memoised scope; a fresh object each render would restart the session.
const SCOPE = {};

beforeEach(async () => {
  db = new AppDB(`session-test-${++n}`);
  clock.now = T0;
  repo = new Repo(db, () => clock.now);
  deps = { db, repo, onLeave: vi.fn(), now: () => clock.now };
  await repo.updateSettings({ enableFuzz: false });
  const course = await repo.createCourse({ name: 'Calc' });
  const topic = await repo.createTopic({ courseId: course.id, parentId: null, name: 'Series' });
  for (const prompt of ['first', 'second']) {
    await repo.saveItem({ topicId: topic.id, type: 'basic', fields: { prompt, answer: 'a' } });
  }
});

afterEach(async () => {
  cleanup();
  db.close();
  await db.delete();
});

async function start() {
  const hook = renderHook(() => useStudySession(SCOPE, deps));
  await waitFor(() => expect(hook.result.current.phase).toBe('question'));
  return hook;
}

describe('useStudySession', () => {
  it('loads the queue and shows the first new card', async () => {
    const { result } = await start();
    expect(result.current.current?.item.fields.prompt).toBe('first');
    expect(result.current.current?.kind).toBe('new');
    expect(result.current.counts).toMatchObject({ new: 2, review: 0, learning: 0 });
    expect(result.current.turn).toBe(1);
  });

  it('ignores a rating before the answer is revealed', async () => {
    const { result } = await start();
    await act(() => result.current.rate(3, 'reveal'));
    expect(await db.reviewLogs.count()).toBe(0);
    expect(result.current.phase).toBe('question');
  });

  it('records a review with the time taken, then moves to the next card', async () => {
    const { result } = await start();
    act(() => result.current.reveal());
    expect(result.current.phase).toBe('answer');
    expect(result.current.preview()?.[3].card.reps).toBe(1);

    clock.now = T0 + 7_000;
    await act(() => result.current.rate(3, 'typed'));
    const logs = await db.reviewLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      rating: 3,
      durationMs: 7_000,
      mode: 'typed',
      review: T0 + 7_000,
    });
    expect(result.current.current?.item.fields.prompt).toBe('second');
    expect(result.current.turn).toBe(2);
    expect(result.current.stats.reviewed).toBe(1);
    expect(result.current.canUndo).toBe(true);
  });

  it('caps a recorded answer time at one minute', async () => {
    const { result } = await start();
    act(() => result.current.reveal());
    clock.now = T0 + 10 * MINUTE;
    await act(() => result.current.rate(3, 'reveal'));
    expect((await db.reviewLogs.toArray())[0]?.durationMs).toBe(MINUTE);
  });

  it('undo restores the previous card, the session counters and today’s log', async () => {
    const { result } = await start();
    const before = result.current.current;
    act(() => result.current.reveal());
    await act(() => result.current.rate(1, 'reveal'));
    expect(result.current.stats.reviewed).toBe(1);

    let undone = false;
    await act(async () => {
      undone = await result.current.undo();
    });
    expect(undone).toBe(true);
    expect(result.current.current?.card.id).toBe(before?.card.id);
    expect(result.current.current?.card.fsrs).toEqual(before?.card.fsrs);
    expect(result.current.phase).toBe('question');
    expect(result.current.stats.reviewed).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect((await db.reviewLogs.toArray())[0]?.deletedAt).toBeDefined();
  });

  it('ends the session when every card is done, and reports it on leaving', async () => {
    const { result, unmount } = await start();
    for (let i = 0; i < 2; i++) {
      act(() => result.current.reveal());
      await act(() => result.current.rate(4, 'reveal')); // Easy graduates straight to review
    }
    expect(result.current.phase).toBe('done');
    expect(result.current.current).toBeNull();
    expect(result.current.stats.reviewed).toBe(2);
    unmount();
    expect(deps.onLeave).toHaveBeenCalledTimes(1);
  });

  it('suspend skips the card; its reverser brings it back, even after the session ended', async () => {
    const { result } = await start();
    const first = result.current.current;
    let restore: (() => Promise<void>) | null = null;
    await act(async () => {
      restore = await result.current.suspend();
    });
    expect(result.current.current?.item.fields.prompt).toBe('second');
    expect((await db.cards.get(first?.card.id ?? ''))?.suspended).toBe(true);

    await act(async () => {
      await result.current.suspend(); // nothing left: the session ends
    });
    expect(result.current.phase).toBe('done');

    await act(async () => {
      if (restore) await restore();
    });
    expect((await db.cards.get(first?.card.id ?? ''))?.suspended).toBe(false);
    expect(result.current.phase).toBe('question');
    expect(result.current.current?.item.fields.prompt).toBe('first');
  });

  it('reloadItem swaps in an edited item and drops a deleted one', async () => {
    const { result } = await start();
    const current = result.current.current;
    if (!current) throw new Error('no card');
    await repo.saveItem({ ...current.item, fields: { prompt: 'first (edited)', answer: 'a' } });
    await act(() => result.current.reloadItem(current.item.id));
    expect(result.current.current?.item.fields.prompt).toBe('first (edited)');
    expect(result.current.current?.card.id).toBe(current.card.id);

    await repo.deleteItem(current.item.id);
    await act(() => result.current.reloadItem(current.item.id));
    expect(result.current.current?.item.fields.prompt).toBe('second');
    expect(result.current.counts?.new).toBe(1);
  });
});
