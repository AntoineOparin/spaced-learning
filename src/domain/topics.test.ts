import { describe, expect, it } from 'vitest';
import { makeCard, makeCourse, makeItem, makeTopic } from '../test/factories';
import {
  buildNewRank,
  curriculumOrder,
  effectiveActiveTopicIds,
  subtreeIds,
  topicPath,
} from './topics';

const course = makeCourse({ id: 'c1' });
const t1 = makeTopic({ id: 't1', courseId: 'c1', order: 1, name: 'Integration' });
const t2 = makeTopic({ id: 't2', courseId: 'c1', order: 2, name: 'Series', active: false });
const s11 = makeTopic({ id: 's11', courseId: 'c1', parentId: 't1', order: 2, name: 'Parts' });
const s12 = makeTopic({ id: 's12', courseId: 'c1', parentId: 't1', order: 1, name: 'u-sub' });
const s21 = makeTopic({ id: 's21', courseId: 'c1', parentId: 't2', order: 1, name: 'Tests' });
const gone = makeTopic({ id: 'gone', courseId: 'c1', order: 0, deletedAt: 1 });
const topics = [t2, s11, t1, s21, s12, gone];

describe('topic tree helpers', () => {
  it('orders topics depth-first by order', () => {
    expect(curriculumOrder(topics, 'c1').map((t) => t.id)).toEqual([
      't1',
      's12',
      's11',
      't2',
      's21',
    ]);
  });

  it('inherits inactivity from ancestors', () => {
    expect([...effectiveActiveTopicIds(topics)].sort()).toEqual(['s11', 's12', 't1']);
  });

  it('computes subtrees and paths', () => {
    expect([...subtreeIds(topics, 't1')].sort()).toEqual(['s11', 's12', 't1']);
    expect(topicPath(topics, 's11').map((t) => t.id)).toEqual(['t1', 's11']);
  });

  it('ranks new cards by topic curriculum order, then item order, then card key', () => {
    const iParts = makeItem({ id: 'iParts', courseId: 'c1', topicId: 's11', order: 0 });
    const iUsub2 = makeItem({ id: 'iUsub2', courseId: 'c1', topicId: 's12', order: 5 });
    const iUsub1 = makeItem({ id: 'iUsub1', courseId: 'c1', topicId: 's12', order: 1 });
    const rank = buildNewRank([course], topics, [iParts, iUsub2, iUsub1]);
    const cards = [
      makeCard({ itemId: 'iParts', topicId: 's11', key: 'fwd' }),
      makeCard({ itemId: 'iUsub2', topicId: 's12', key: 'c2' }),
      makeCard({ itemId: 'iUsub2', topicId: 's12', key: 'c1' }),
      makeCard({ itemId: 'iUsub1', topicId: 's12', key: 'rev' }),
      makeCard({ itemId: 'iUsub1', topicId: 's12', key: 'fwd' }),
    ];
    const sorted = [...cards].sort((a, b) => rank(a) - rank(b));
    expect(sorted.map((c) => `${c.itemId}/${c.key}`)).toEqual([
      'iUsub1/fwd',
      'iUsub1/rev',
      'iUsub2/c1',
      'iUsub2/c2',
      'iParts/fwd',
    ]);
  });
});
