/**
 * Here I Stand — war-helpers.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  areAtWar, getWarsOf, addWar, removeWar,
  areAllied, getAlliesOf, addAlliance, removeAlliance,
  isMinorPower, getMinorAlly, isMinorActive,
  canAttack, isEnemyControlled
} from './war-helpers.js';
import { createTestState } from '../test-helpers.js';

function makeState(wars = [], alliances = []) {
  const state = createTestState();
  state.wars = wars.map(([a, b]) => ({ a, b }));
  state.alliances = alliances.map(([a, b]) => ({ a, b }));
  return state;
}

// ── areAtWar ──────────────────────────────────────────────────

describe('areAtWar', () => {
  it('returns true for powers at war (a,b order)', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    expect(areAtWar(state, 'ottoman', 'hapsburg')).toBe(true);
  });

  it('returns true for powers at war (reverse order)', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    expect(areAtWar(state, 'hapsburg', 'ottoman')).toBe(true);
  });

  it('returns false for powers not at war', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    expect(areAtWar(state, 'ottoman', 'france')).toBe(false);
  });

  it('returns false with empty wars', () => {
    const state = makeState();
    expect(areAtWar(state, 'ottoman', 'hapsburg')).toBe(false);
  });
});

// ── getWarsOf ─────────────────────────────────────────────────

describe('getWarsOf', () => {
  it('returns all enemies', () => {
    const state = makeState([
      ['france', 'hapsburg'],
      ['france', 'papacy']
    ]);
    const enemies = getWarsOf(state, 'france');
    expect(enemies).toContain('hapsburg');
    expect(enemies).toContain('papacy');
    expect(enemies).toHaveLength(2);
  });

  it('returns empty for power with no wars', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    expect(getWarsOf(state, 'england')).toHaveLength(0);
  });
});

// ── addWar / removeWar ────────────────────────────────────────

describe('addWar', () => {
  it('adds a war', () => {
    const state = makeState();
    addWar(state, 'ottoman', 'england');
    expect(areAtWar(state, 'ottoman', 'england')).toBe(true);
  });

  it('no-op if already at war', () => {
    const state = makeState([['ottoman', 'england']]);
    addWar(state, 'ottoman', 'england');
    expect(state.wars).toHaveLength(1);
  });
});

describe('removeWar', () => {
  it('removes a war', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    removeWar(state, 'ottoman', 'hapsburg');
    expect(areAtWar(state, 'ottoman', 'hapsburg')).toBe(false);
    expect(state.wars).toHaveLength(0);
  });

  it('removes war regardless of order', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    removeWar(state, 'hapsburg', 'ottoman');
    expect(state.wars).toHaveLength(0);
  });

  it('no-op if not at war', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    removeWar(state, 'ottoman', 'france');
    expect(state.wars).toHaveLength(1);
  });
});

// ── areAllied / getAlliesOf ──────────────────────────────────

describe('areAllied', () => {
  it('returns true for allied powers', () => {
    const state = makeState([], [['england', 'france']]);
    expect(areAllied(state, 'england', 'france')).toBe(true);
    expect(areAllied(state, 'france', 'england')).toBe(true);
  });

  it('returns false for non-allied powers', () => {
    const state = makeState([], [['england', 'france']]);
    expect(areAllied(state, 'england', 'ottoman')).toBe(false);
  });
});

describe('getAlliesOf', () => {
  it('returns all allies', () => {
    const state = makeState([], [
      ['england', 'france'],
      ['england', 'hapsburg']
    ]);
    const allies = getAlliesOf(state, 'england');
    expect(allies).toContain('france');
    expect(allies).toContain('hapsburg');
    expect(allies).toHaveLength(2);
  });
});

// ── addAlliance / removeAlliance ────────────────────────────

describe('addAlliance', () => {
  it('adds an alliance', () => {
    const state = makeState();
    addAlliance(state, 'england', 'france');
    expect(areAllied(state, 'england', 'france')).toBe(true);
  });

  it('no-op if already allied', () => {
    const state = makeState([], [['england', 'france']]);
    addAlliance(state, 'england', 'france');
    expect(state.alliances).toHaveLength(1);
  });
});

describe('removeAlliance', () => {
  it('removes an alliance', () => {
    const state = makeState([], [['england', 'france']]);
    removeAlliance(state, 'england', 'france');
    expect(state.alliances).toHaveLength(0);
  });
});

// ── Minor Power Queries ─────────────────────────────────────

describe('isMinorPower', () => {
  it('identifies minor powers', () => {
    expect(isMinorPower('scotland')).toBe(true);
    expect(isMinorPower('venice')).toBe(true);
    expect(isMinorPower('genoa')).toBe(true);
    expect(isMinorPower('hungary_bohemia')).toBe(true);
  });

  it('returns false for major powers', () => {
    expect(isMinorPower('ottoman')).toBe(false);
    expect(isMinorPower('france')).toBe(false);
  });
});

describe('getMinorAlly', () => {
  it('returns major ally of active minor', () => {
    const state = makeState([], [['scotland', 'france']]);
    expect(getMinorAlly(state, 'scotland')).toBe('france');
  });

  it('returns null for inactive minor', () => {
    const state = makeState();
    expect(getMinorAlly(state, 'scotland')).toBeNull();
  });
});

describe('isMinorActive', () => {
  it('true when minor has major ally', () => {
    const state = makeState([], [['venice', 'papacy']]);
    expect(isMinorActive(state, 'venice')).toBe(true);
  });

  it('false when minor has no ally', () => {
    const state = makeState();
    expect(isMinorActive(state, 'venice')).toBe(false);
  });
});

// ── canAttack ───────────────────────────────────────────────

describe('canAttack', () => {
  it('true for direct war', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    expect(canAttack(state, 'ottoman', 'hapsburg')).toBe(true);
  });

  it('false for no war', () => {
    const state = makeState();
    expect(canAttack(state, 'ottoman', 'hapsburg')).toBe(false);
  });

  it('true for attacking active minor of enemy major', () => {
    const state = makeState(
      [['ottoman', 'hapsburg']],
      [['hungary_bohemia', 'hapsburg']]
    );
    expect(canAttack(state, 'ottoman', 'hungary_bohemia')).toBe(true);
  });

  it('true for active minor attacking enemy major of its ally', () => {
    const state = makeState(
      [['ottoman', 'hapsburg']],
      [['venice', 'hapsburg']]
    );
    expect(canAttack(state, 'venice', 'ottoman')).toBe(true);
  });

  it('true for active minor attacking active minor of enemy major', () => {
    const state = makeState(
      [['france', 'hapsburg']],
      [['scotland', 'france'], ['hungary_bohemia', 'hapsburg']]
    );
    expect(canAttack(state, 'scotland', 'hungary_bohemia')).toBe(true);
  });

  it('false for attacking minor with no war on ally', () => {
    const state = makeState([], [['scotland', 'france']]);
    expect(canAttack(state, 'hapsburg', 'scotland')).toBe(false);
  });
});

// ── isEnemyControlled ───────────────────────────────────────

describe('isEnemyControlled', () => {
  it('true for space controlled by enemy', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    state.spaces['Vienna'] = { controller: 'hapsburg', units: [] };
    expect(isEnemyControlled(state, 'Vienna', 'ottoman')).toBe(true);
  });

  it('false for space controlled by self', () => {
    const state = makeState();
    state.spaces['Istanbul'] = { controller: 'ottoman', units: [] };
    expect(isEnemyControlled(state, 'Istanbul', 'ottoman')).toBe(false);
  });

  it('false for space controlled by ally', () => {
    const state = makeState([], [['ottoman', 'france']]);
    state.spaces['Paris'] = { controller: 'france', units: [] };
    expect(isEnemyControlled(state, 'Paris', 'ottoman')).toBe(false);
  });

  it('false for space with no controller', () => {
    const state = makeState([['ottoman', 'hapsburg']]);
    state.spaces['TestSpace'] = { controller: null, units: [] };
    expect(isEnemyControlled(state, 'TestSpace', 'ottoman')).toBe(false);
  });
});
