import { describe, expect, it } from 'vitest';
import { type UpgradeMap, upgradeRecord } from './upgrades';

describe('upgradeRecord', () => {
  const upgrades: UpgradeMap = {
    2: { items: (d) => ({ ...d, tags: d.tags ?? [] }) },
    3: { items: (d) => ({ ...d, v3: true }), cards: (d) => ({ ...d, suspended: false }) },
  };

  it('applies each step in order, only for the record’s table', () => {
    expect(upgradeRecord('items', { id: 'a' }, 1, upgrades, 3)).toEqual({
      id: 'a',
      tags: [],
      v3: true,
    });
    expect(upgradeRecord('cards', { id: 'c' }, 1, upgrades, 3)).toEqual({
      id: 'c',
      suspended: false,
    });
    expect(upgradeRecord('courses', { id: 'k' }, 1, upgrades, 3)).toEqual({ id: 'k' });
  });

  it('starts after the record’s own version and is a no-op when current', () => {
    expect(upgradeRecord('items', { id: 'a' }, 2, upgrades, 3)).toEqual({ id: 'a', v3: true });
    const data = { id: 'a' };
    expect(upgradeRecord('items', data, 3, upgrades, 3)).toBe(data);
  });
});
