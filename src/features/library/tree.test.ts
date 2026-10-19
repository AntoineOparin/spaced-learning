import { describe, expect, it } from 'vitest';
import { makeCourse, makeTopic } from '../../test/factories';
import { courseKey, revealKeys, topicKey, treeKey, visibleRows } from './tree';

const calc = makeCourse({ id: 'calc', name: 'Calculus', order: 0 });
const disc = makeCourse({ id: 'disc', name: 'Discrete', order: 1 });
const integration = makeTopic({ id: 'int', courseId: 'calc', name: 'Integration', order: 0 });
const parts = makeTopic({ id: 'parts', courseId: 'calc', parentId: 'int', name: 'By parts' });
const series = makeTopic({ id: 'ser', courseId: 'calc', name: 'Series', order: 1, active: false });
const logic = makeTopic({ id: 'logic', courseId: 'disc', name: 'Logic' });
const courses = [calc, disc];
const topics = [integration, parts, series, logic];
const counts = new Map([
  ['int', 2],
  ['parts', 3],
  ['ser', 4],
  ['logic', 1],
]);

const keysOf = (expanded: string[]) =>
  visibleRows(courses, topics, counts, new Set(expanded)).map((r) => r.key);

describe('visibleRows', () => {
  it('shows only courses when everything is collapsed', () => {
    expect(keysOf([])).toEqual([courseKey('calc'), courseKey('disc')]);
  });

  it('shows the children of expanded branches only', () => {
    expect(keysOf([courseKey('calc')])).toEqual([
      courseKey('calc'),
      topicKey('int'),
      topicKey('ser'),
      courseKey('disc'),
    ]);
    expect(keysOf([courseKey('calc'), topicKey('int')])).toContain(topicKey('parts'));
    // A topic's own expansion doesn't matter while its course is collapsed.
    expect(keysOf([topicKey('int')])).toEqual([courseKey('calc'), courseKey('disc')]);
  });

  it('describes each row: level, siblings, counts including subtopics, state', () => {
    const rows = visibleRows(
      courses,
      topics,
      counts,
      new Set([courseKey('calc'), topicKey('int')]),
    );
    const byKey = new Map(rows.map((r) => [r.key, r]));
    expect(byKey.get(courseKey('calc'))).toMatchObject({ level: 1, count: 9, expanded: true });
    expect(byKey.get(topicKey('int'))).toMatchObject({
      level: 2,
      count: 5,
      hasChildren: true,
      pos: 1,
      siblings: 2,
      parentKey: courseKey('calc'),
    });
    expect(byKey.get(topicKey('parts'))).toMatchObject({ level: 3, hasChildren: false });
    expect(byKey.get(topicKey('ser'))).toMatchObject({ paused: true, pos: 2 });
    expect(byKey.get(courseKey('disc'))).toMatchObject({ count: 1, expanded: false });
  });
});

describe('revealKeys', () => {
  it('expands the course and every ancestor of a topic', () => {
    expect(revealKeys(topics, parts)).toEqual([courseKey('calc'), topicKey('int')]);
    expect(revealKeys(topics, logic)).toEqual([courseKey('disc')]);
  });
});

describe('treeKey', () => {
  const rows = visibleRows(courses, topics, counts, new Set([courseKey('calc')]));

  it('moves with the arrow keys, Home and End', () => {
    expect(treeKey(rows, courseKey('calc'), 'ArrowDown')).toEqual({ focus: topicKey('int') });
    expect(treeKey(rows, topicKey('int'), 'ArrowUp')).toEqual({ focus: courseKey('calc') });
    expect(treeKey(rows, topicKey('ser'), 'End')).toEqual({ focus: courseKey('disc') });
    expect(treeKey(rows, courseKey('disc'), 'Home')).toEqual({ focus: courseKey('calc') });
    expect(treeKey(rows, courseKey('disc'), 'ArrowDown')).toEqual({ none: true });
  });

  it('opens and enters with →, closes and climbs with ←, like VS Code', () => {
    expect(treeKey(rows, topicKey('int'), 'ArrowRight')).toEqual({ expand: topicKey('int') });
    expect(treeKey(rows, courseKey('calc'), 'ArrowRight')).toEqual({ focus: topicKey('int') });
    expect(treeKey(rows, topicKey('ser'), 'ArrowRight')).toEqual({ none: true }); // a leaf
    expect(treeKey(rows, courseKey('calc'), 'ArrowLeft')).toEqual({ collapse: courseKey('calc') });
    expect(treeKey(rows, topicKey('ser'), 'ArrowLeft')).toEqual({ focus: courseKey('calc') });
  });

  it('selects with Enter or Space and ignores other keys', () => {
    expect(treeKey(rows, topicKey('ser'), 'Enter')).toEqual({ select: topicKey('ser') });
    expect(treeKey(rows, topicKey('ser'), ' ')).toEqual({ select: topicKey('ser') });
    expect(treeKey(rows, topicKey('ser'), 'a')).toBeNull();
  });
});
