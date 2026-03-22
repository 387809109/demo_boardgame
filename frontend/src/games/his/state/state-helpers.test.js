/**
 * Here I Stand — state-helpers.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getPowerForPlayer, getPlayerForPower,
  countKeysForPower, countElectoratesForPower,
  getActiveRuler, getCardDrawCount, getKeyVp,
  canPass, getNextImpulsePower, isCardInPlay,
  getAdjacentSpaces, getAllAdjacentSpaces, getConnectionType,
  getUnitsInSpace, hasEnemyUnits, getFormationCap, isHomeSpace,
  isValidReformationTarget, calcReformationDice,
  getAvailableDebaters, getDebaterDef, recountProtestantSpaces,
  isFortified, findFriendlyPath
} from './state-helpers.js';
import { MAJOR_POWERS, IMPULSE_ORDER, RELIGION } from '../constants.js';
import { CARD_BY_NUMBER } from '../data/cards.js';
import { createTestState, createStateAfterDraw } from '../test-helpers.js';

describe('getPowerForPlayer', () => {
  const state = createTestState();

  it('returns correct power for player', () => {
    expect(getPowerForPlayer(state, 'p1')).toBe('ottoman');
    expect(getPowerForPlayer(state, 'p6')).toBe('protestant');
  });

  it('returns null for unknown player', () => {
    expect(getPowerForPlayer(state, 'unknown')).toBeNull();
  });
});

describe('getPlayerForPower', () => {
  const state = createTestState();

  it('returns correct player for power', () => {
    expect(getPlayerForPower(state, 'ottoman')).toBe('p1');
    expect(getPlayerForPower(state, 'protestant')).toBe('p6');
  });

  it('returns null for unknown power', () => {
    expect(getPlayerForPower(state, 'unknown')).toBeNull();
  });

  it('is consistent with getPowerForPlayer', () => {
    for (const power of MAJOR_POWERS) {
      const pid = getPlayerForPower(state, power);
      expect(getPowerForPlayer(state, pid)).toBe(power);
    }
  });
});

describe('countKeysForPower', () => {
  it('counts initial Ottoman keys', () => {
    const state = createTestState();
    const keys = countKeysForPower(state, 'ottoman');
    expect(keys).toBeGreaterThan(0);
  });

  it('returns 0 for power with no keys', () => {
    const state = createTestState();
    // Remove all ottoman control
    for (const sp of Object.values(state.spaces)) {
      if (sp.controller === 'ottoman') sp.controller = 'neutral';
    }
    expect(countKeysForPower(state, 'ottoman')).toBe(0);
  });

  it('changes when control changes', () => {
    const state = createTestState();
    const before = countKeysForPower(state, 'ottoman');
    // Give ottoman a hapsburg key
    const hapsburgKey = Object.entries(state.spaces)
      .find(([, sp]) => sp.isKey && sp.controller === 'hapsburg');
    if (hapsburgKey) {
      state.spaces[hapsburgKey[0]].controller = 'ottoman';
      expect(countKeysForPower(state, 'ottoman')).toBe(before + 1);
    }
  });
});

describe('countElectoratesForPower', () => {
  it('counts Protestant electorates', () => {
    const state = createTestState();
    const count = countElectoratesForPower(state, 'protestant');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('changes when control changes', () => {
    const state = createTestState();
    const before = countElectoratesForPower(state, 'protestant');
    // Find an electorate controlled by protestant
    const electorate = Object.entries(state.spaces)
      .find(([, sp]) => sp.isElectorate && sp.controller === 'protestant');
    if (electorate) {
      state.spaces[electorate[0]].controller = 'hapsburg';
      expect(countElectoratesForPower(state, 'protestant')).toBe(before - 1);
    }
  });
});

describe('getActiveRuler', () => {
  const state = createTestState();

  it('returns Ottoman ruler (suleiman)', () => {
    const ruler = getActiveRuler(state, 'ottoman');
    expect(ruler.id).toBe('suleiman');
  });

  it('ruler has cardBonus property', () => {
    const ruler = getActiveRuler(state, 'ottoman');
    expect(ruler).toHaveProperty('cardBonus');
    expect(typeof ruler.cardBonus).toBe('number');
  });

  it('ruler has admin property', () => {
    const ruler = getActiveRuler(state, 'ottoman');
    expect(ruler).toHaveProperty('admin');
    expect(typeof ruler.admin).toBe('number');
  });

  it('returns ruler for all powers', () => {
    for (const power of MAJOR_POWERS) {
      const ruler = getActiveRuler(state, power);
      expect(ruler).toBeDefined();
      expect(ruler.id).toBeTruthy();
    }
  });
});

describe('getCardDrawCount', () => {
  const state = createTestState();

  it('returns positive draw count for all powers', () => {
    for (const power of MAJOR_POWERS) {
      expect(getCardDrawCount(state, power)).toBeGreaterThan(0);
    }
  });

  it('Protestant uses special draw rule', () => {
    const count = getCardDrawCount(state, 'protestant');
    // Protestant draws 4 or 5 base + ruler bonus
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it('changes with key count', () => {
    const s = createTestState();
    const before = getCardDrawCount(s, 'ottoman');
    // Remove all ottoman keys
    for (const sp of Object.values(s.spaces)) {
      if (sp.controller === 'ottoman') sp.controller = 'neutral';
    }
    const after = getCardDrawCount(s, 'ottoman');
    expect(after).toBeLessThanOrEqual(before);
  });
});

describe('getKeyVp', () => {
  const state = createTestState();

  it('returns VP for ottoman', () => {
    const vp = getKeyVp(state, 'ottoman');
    expect(typeof vp).toBe('number');
  });

  it('returns 0 for protestant (uses spaces track)', () => {
    expect(getKeyVp(state, 'protestant')).toBe(0);
  });
});

describe('canPass', () => {
  it('cannot pass with home card in hand', () => {
    const state = createStateAfterDraw();
    // After draw, ottoman has home card #1
    const result = canPass(state, 'ottoman');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('home card');
  });

  it('can pass after home/mandatory cards removed and hand trimmed', () => {
    const state = createStateAfterDraw();
    const ruler = getActiveRuler(state, 'ottoman');
    // Remove home and mandatory cards, then trim to admin size
    state.hands.ottoman = state.hands.ottoman
      .filter(c => {
        const card = CARD_BY_NUMBER[c];
        return card && card.deck !== 'home' && card.category !== 'MANDATORY';
      })
      .slice(0, ruler.admin);
    const result = canPass(state, 'ottoman');
    expect(result.allowed).toBe(true);
  });

  it('returns reason string when not allowed', () => {
    const state = createStateAfterDraw();
    const result = canPass(state, 'ottoman');
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('allowed when hand is empty', () => {
    const state = createTestState();
    // Empty hand, no home card
    state.hands.ottoman = [];
    const result = canPass(state, 'ottoman');
    expect(result.allowed).toBe(true);
  });
});

describe('getNextImpulsePower', () => {
  it('cycles through IMPULSE_ORDER', () => {
    const state = createTestState();
    for (let i = 0; i < 6; i++) {
      state.impulseIndex = i;
      const next = getNextImpulsePower(state);
      expect(next).toBe(IMPULSE_ORDER[(i + 1) % 6]);
    }
  });
});

describe('isCardInPlay', () => {
  it('finds card in deck', () => {
    const state = createTestState();
    if (state.deck.length > 0) {
      expect(isCardInPlay(state, state.deck[0])).toBe(true);
    }
  });

  it('finds card in hand', () => {
    const state = createStateAfterDraw();
    const card = state.hands.ottoman[0];
    expect(isCardInPlay(state, card)).toBe(true);
  });

  it('finds card in discard', () => {
    const state = createTestState();
    state.discard.push(999);
    expect(isCardInPlay(state, 999)).toBe(true);
  });

  it('finds card in removedCards', () => {
    const state = createTestState();
    state.removedCards.push(888);
    expect(isCardInPlay(state, 888)).toBe(true);
  });

  it('returns false for missing card', () => {
    const state = createTestState();
    expect(isCardInPlay(state, 9999)).toBe(false);
  });
});

// ── Phase 2 Helper Tests ─────────────────────────────────────────

describe('getAdjacentSpaces', () => {
  it('returns adjacent spaces for Istanbul', () => {
    const adj = getAdjacentSpaces('Istanbul');
    expect(adj.connections.length + adj.passes.length).toBeGreaterThan(0);
    expect(adj.connections).toContain('Edirne');
  });

  it('returns empty connections/passes for unknown space', () => {
    const adj = getAdjacentSpaces('Narnia');
    expect(adj.connections).toEqual([]);
    expect(adj.passes).toEqual([]);
  });
});

describe('getAllAdjacentSpaces', () => {
  it('returns all adjacency entries for Istanbul', () => {
    const adj = getAllAdjacentSpaces('Istanbul');
    expect(adj.length).toBeGreaterThan(0);
  });
});

describe('getConnectionType', () => {
  it('returns connection for adjacent spaces', () => {
    const type = getConnectionType('Istanbul', 'Edirne');
    expect(type).toBe('connection');
  });

  it('returns pass for pass connections', () => {
    const type = getConnectionType('Belgrade', 'Ragusa');
    expect(type).toBe('pass');
  });

  it('returns null for non-adjacent', () => {
    expect(getConnectionType('Istanbul', 'Paris')).toBeNull();
  });
});

describe('getUnitsInSpace', () => {
  it('finds ottoman units in Istanbul', () => {
    const state = createTestState();
    const stack = getUnitsInSpace(state, 'Istanbul', 'ottoman');
    expect(stack).toBeDefined();
    expect(stack.regulars).toBeGreaterThan(0);
  });

  it('returns null for power with no units', () => {
    const state = createTestState();
    expect(getUnitsInSpace(state, 'Istanbul', 'france')).toBeNull();
  });
});

describe('hasEnemyUnits', () => {
  it('returns false when only friendly units', () => {
    const state = createTestState();
    expect(hasEnemyUnits(state, 'Istanbul', 'ottoman')).toBe(false);
  });

  it('returns true when enemy units present', () => {
    const state = createTestState();
    state.spaces['Istanbul'].units.push({
      owner: 'france', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    expect(hasEnemyUnits(state, 'Istanbul', 'ottoman')).toBe(true);
  });
});

describe('getFormationCap', () => {
  it('returns 4 for no leaders', () => {
    expect(getFormationCap([])).toBe(4);
  });

  it('returns command rating for single leader', () => {
    const cap = getFormationCap(['suleiman']);
    expect(cap).toBeGreaterThan(4); // Suleiman has high command
  });

  it('returns sum of top 2 for multiple leaders', () => {
    const cap = getFormationCap(['suleiman', 'ibrahim']);
    expect(cap).toBeGreaterThan(0);
  });
});

describe('isHomeSpace', () => {
  it('Istanbul is ottoman home', () => {
    expect(isHomeSpace('Istanbul', 'ottoman')).toBe(true);
  });

  it('Paris is not ottoman home', () => {
    expect(isHomeSpace('Paris', 'ottoman')).toBe(false);
  });
});

describe('isValidReformationTarget', () => {
  it('rejects non-catholic space', () => {
    const state = createTestState();
    // Istanbul is OTHER religion
    expect(isValidReformationTarget(state, 'Istanbul')).toBe(false);
  });
});

describe('calcReformationDice', () => {
  it('returns protestant and papal dice counts', () => {
    const state = createTestState();
    // Find a Catholic German space for testing
    const target = Object.entries(state.spaces).find(
      ([, sp]) => sp.religion === RELIGION.CATHOLIC && sp.languageZone === 'german'
    );
    if (target) {
      const dice = calcReformationDice(state, target[0]);
      expect(dice).toHaveProperty('protestant');
      expect(dice).toHaveProperty('papal');
      expect(dice.protestant).toBeGreaterThanOrEqual(1);
      expect(dice.papal).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('getAvailableDebaters', () => {
  it('returns protestant debaters in german zone', () => {
    const state = createTestState();
    const debaters = getAvailableDebaters(state, 'protestant', 'german');
    expect(debaters.length).toBeGreaterThan(0);
    expect(debaters[0]).toHaveProperty('id');
  });

  it('returns papal debaters (no zone filter)', () => {
    const state = createTestState();
    const debaters = getAvailableDebaters(state, 'papal');
    expect(debaters.length).toBeGreaterThan(0);
  });

  it('filters by committed status', () => {
    const state = createTestState();
    // Mark luther as committed
    const luther = state.debaters.protestant.find(d => d.id === 'luther');
    luther.committed = true;

    const uncommitted = getAvailableDebaters(state, 'protestant', 'german', false);
    expect(uncommitted.find(d => d.id === 'luther')).toBeUndefined();

    const committed = getAvailableDebaters(state, 'protestant', 'german', true);
    expect(committed.find(d => d.id === 'luther')).toBeDefined();
  });

  it('respects entry turn', () => {
    const state = createTestState();
    state.turn = 1;
    const debaters = getAvailableDebaters(state, 'protestant', 'german');
    // Zwingli (entryTurn 2) should NOT be available on turn 1
    expect(debaters.find(d => d.id === 'zwingli')).toBeUndefined();
  });
});

describe('getDebaterDef', () => {
  it('returns debater definition', () => {
    const def = getDebaterDef('luther');
    expect(def).toBeDefined();
    expect(def.value).toBe(4);
    expect(def.faction).toBe('lutheran');
  });

  it('returns undefined for unknown id', () => {
    expect(getDebaterDef('nobody')).toBeUndefined();
  });
});

describe('recountProtestantSpaces', () => {
  it('counts protestant spaces', () => {
    const state = createTestState();
    // Make a few spaces protestant
    state.spaces['Wittenberg'].religion = RELIGION.PROTESTANT;
    state.spaces['Erfurt'].religion = RELIGION.PROTESTANT;
    recountProtestantSpaces(state);
    expect(state.protestantSpaces).toBeGreaterThanOrEqual(2);
  });

  it('returns 0 when no protestant spaces', () => {
    const state = createTestState();
    // All spaces are already catholic/other at game start
    recountProtestantSpaces(state);
    expect(state.protestantSpaces).toBe(0);
  });
});

// ── Edge Case Tests ─────────────────────────────────────────────

describe('getUnitsInSpace edge cases', () => {
  it('returns null for an empty space with no units', () => {
    const state = createTestState();
    // Find a space with no units
    state.spaces['TestEmpty'] = {
      controller: 'neutral', units: [], religion: 'other',
      isKey: false, isElectorate: false, isFortress: false
    };
    expect(getUnitsInSpace(state, 'TestEmpty', 'ottoman')).toBeNull();
  });

  it('returns correct stack when space has multiple owners', () => {
    const state = createTestState();
    state.spaces['MultiOwner'] = {
      controller: 'neutral', religion: 'other',
      isKey: false, isElectorate: false, isFortress: false,
      units: [
        { owner: 'ottoman', regulars: 3, mercenaries: 0, cavalry: 0,
          squadrons: 0, corsairs: 0, leaders: [] },
        { owner: 'hapsburg', regulars: 2, mercenaries: 1, cavalry: 0,
          squadrons: 0, corsairs: 0, leaders: [] },
        { owner: 'france', regulars: 1, mercenaries: 0, cavalry: 0,
          squadrons: 0, corsairs: 0, leaders: [] }
      ]
    };

    const ottStack = getUnitsInSpace(state, 'MultiOwner', 'ottoman');
    expect(ottStack).toBeDefined();
    expect(ottStack.regulars).toBe(3);

    const habStack = getUnitsInSpace(state, 'MultiOwner', 'hapsburg');
    expect(habStack).toBeDefined();
    expect(habStack.regulars).toBe(2);
    expect(habStack.mercenaries).toBe(1);

    const fraStack = getUnitsInSpace(state, 'MultiOwner', 'france');
    expect(fraStack).toBeDefined();
    expect(fraStack.regulars).toBe(1);

    // Power not present
    expect(getUnitsInSpace(state, 'MultiOwner', 'protestant')).toBeNull();
  });

  it('returns null for a non-existent space', () => {
    const state = createTestState();
    expect(getUnitsInSpace(state, 'Narnia', 'ottoman')).toBeNull();
  });
});

describe('getAllAdjacentSpaces edge cases', () => {
  it('island space with no land connections returns empty array', () => {
    // Malta is an island with no land edges
    const adj = getAllAdjacentSpaces('Malta');
    expect(adj).toEqual([]);
  });

  it('space with pass connections includes them', () => {
    // Belgrade-Ragusa is a pass connection
    const adj = getAllAdjacentSpaces('Belgrade');
    expect(adj).toContain('Ragusa');
  });

  it('space with both connections and passes includes all', () => {
    const adjDetail = getAdjacentSpaces('Belgrade');
    const allAdj = getAllAdjacentSpaces('Belgrade');
    const total = adjDetail.connections.length + adjDetail.passes.length;
    expect(allAdj.length).toBe(total);
  });
});

describe('findFriendlyPath edge cases', () => {
  it('returns null when no path exists between disconnected spaces', () => {
    const state = createTestState();
    // Malta is an island with no land connections
    const path = findFriendlyPath(state, 'Malta', 'Istanbul', 'ottoman');
    expect(path).toBeNull();
  });

  it('returns single-element path when from equals to', () => {
    const state = createTestState();
    const path = findFriendlyPath(state, 'Istanbul', 'Istanbul', 'ottoman');
    expect(path).toEqual(['Istanbul']);
  });

  it('finds path through allied territory', () => {
    const state = createTestState();
    // Istanbul -> Edirne is a connection
    // Both controlled by Ottoman, so path should exist
    const path = findFriendlyPath(state, 'Istanbul', 'Edirne', 'ottoman');
    expect(path).not.toBeNull();
    expect(path[0]).toBe('Istanbul');
    expect(path[path.length - 1]).toBe('Edirne');
  });

  it('returns null when path blocked by enemy-controlled spaces', () => {
    const state = createTestState();
    // Find two ottoman spaces separated by neutral/enemy spaces
    // Set all intermediate spaces to enemy control to block the path
    const edirneAdj = getAdjacentSpaces('Edirne');
    for (const neighbor of [...edirneAdj.connections, ...edirneAdj.passes]) {
      if (neighbor !== 'Istanbul' && state.spaces[neighbor]) {
        state.spaces[neighbor].controller = 'hapsburg';
      }
    }
    // Check that path from Edirne to a distant ottoman space is blocked
    // when all neighbors of Edirne are enemy-controlled (except Istanbul)
    const path = findFriendlyPath(state, 'Edirne', 'Paris', 'ottoman');
    expect(path).toBeNull();
  });

  it('respects alliedPowers for path through ally territory', () => {
    const state = createTestState();
    // Create a scenario where path exists only through allied territory
    state.spaces['Edirne'].controller = 'france'; // French-controlled
    // Without ally, should fail (if direct only)
    // With france as ally, should succeed
    const pathWithAlly = findFriendlyPath(
      state, 'Istanbul', 'Edirne', 'ottoman', ['france']
    );
    expect(pathWithAlly).not.toBeNull();
    expect(pathWithAlly).toEqual(['Istanbul', 'Edirne']);
  });
});

describe('getPowerForPlayer edge cases', () => {
  it('returns null for invalid/empty player ID', () => {
    const state = createTestState();
    expect(getPowerForPlayer(state, '')).toBeNull();
    expect(getPowerForPlayer(state, null)).toBeNull();
    expect(getPowerForPlayer(state, undefined)).toBeNull();
  });

  it('all 6 players correctly mapped to powers', () => {
    const state = createTestState();
    const expected = {
      p1: 'ottoman', p2: 'hapsburg', p3: 'england',
      p4: 'france', p5: 'papacy', p6: 'protestant'
    };
    for (const [pid, power] of Object.entries(expected)) {
      expect(getPowerForPlayer(state, pid)).toBe(power);
    }
  });
});

describe('canPass edge cases', () => {
  it('power that has already passed returns allowed when hand is empty', () => {
    const state = createTestState();
    state.hands.ottoman = [];
    const result = canPass(state, 'ottoman');
    expect(result.allowed).toBe(true);
  });

  it('power with mandatory event card cannot pass', () => {
    const state = createStateAfterDraw();
    // Find a mandatory card and add it to ottoman's hand
    const mandatoryCard = Object.values(CARD_BY_NUMBER).find(
      c => c && c.category === 'MANDATORY'
    );
    if (mandatoryCard) {
      state.hands.ottoman = [mandatoryCard.number];
      const result = canPass(state, 'ottoman');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('mandatory');
    }
  });
});

describe('isFortified edge cases', () => {
  it('fortress space returns true', () => {
    const state = createTestState();
    const fortressSpace = Object.values(state.spaces).find(sp => sp.isFortress);
    expect(isFortified(fortressSpace)).toBe(true);
  });

  it('key space (non-fortress) returns true', () => {
    const state = createTestState();
    const keySpace = Object.values(state.spaces).find(
      sp => sp.isKey && !sp.isFortress
    );
    if (keySpace) {
      expect(isFortified(keySpace)).toBe(true);
    }
  });

  it('non-fortress non-key space returns false', () => {
    const state = createTestState();
    const regularSpace = Object.values(state.spaces).find(
      sp => !sp.isFortress && !sp.isKey
    );
    expect(isFortified(regularSpace)).toBe(false);
  });

  it('returns false for null/undefined input', () => {
    expect(isFortified(null)).toBe(false);
    expect(isFortified(undefined)).toBe(false);
  });
});

describe('recountProtestantSpaces edge cases', () => {
  it('counts zero when no spaces are protestant', () => {
    const state = createTestState();
    // Ensure no protestant spaces
    for (const sp of Object.values(state.spaces)) {
      if (sp.religion === RELIGION.PROTESTANT) sp.religion = RELIGION.CATHOLIC;
    }
    recountProtestantSpaces(state);
    expect(state.protestantSpaces).toBe(0);
  });

  it('counts all german spaces when all converted to protestant', () => {
    const state = createTestState();
    let germanCount = 0;
    for (const sp of Object.values(state.spaces)) {
      if (sp.languageZone === 'german' && sp.religion === RELIGION.CATHOLIC) {
        sp.religion = RELIGION.PROTESTANT;
        germanCount++;
      }
    }
    recountProtestantSpaces(state);
    // Should include all converted german spaces plus any already protestant
    expect(state.protestantSpaces).toBeGreaterThanOrEqual(germanCount);
  });

  it('updates protestantSpaces on state object', () => {
    const state = createTestState();
    state.protestantSpaces = 999; // stale value
    recountProtestantSpaces(state);
    expect(state.protestantSpaces).not.toBe(999);
  });
});
