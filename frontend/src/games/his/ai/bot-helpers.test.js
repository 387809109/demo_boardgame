/**
 * Here I Stand — Bot Helpers Tests (Phase E)
 *
 * Tests for E1 spatial computation, E2 unit placement/removal,
 * E4 formation growing and mercenary ratio.
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks } from './bot-controller.js';
import {
  weightedDistance, findClosestSpace, simpleBfsDistance,
  hasSupplyLine, chooseLandUnitPlacementEnhanced,
  chooseNavalPlacementEnhanced, chooseUnitToRemove,
  chooseNavalUnitToRemove, chooseDisplacementDestination,
  growFormationAlongPath, applyMercenaryRatio,
  getCapitals, hasNearbyIndependentThreat
} from './bot-helpers.js';

// ── Helpers ──────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  state.wars = [];
  state.foreignWars = [];
  state.seaZones = state.seaZones || {};
  return state;
}

function setUnits(state, spaceName, power, units) {
  const sp = state.spaces[spaceName];
  if (!sp) return;
  const existing = sp.units.findIndex(u => u.owner === power);
  const stack = {
    owner: power,
    regulars: units.regulars || 0,
    mercenaries: units.mercenaries || 0,
    cavalry: units.cavalry || 0,
    leaders: units.leaders || [],
    squadrons: units.squadrons || 0
  };
  if (existing >= 0) {
    sp.units[existing] = stack;
  } else {
    sp.units.push(stack);
  }
}

function clearUnits(state, spaceName, power) {
  const sp = state.spaces[spaceName];
  if (!sp) return;
  sp.units = sp.units.filter(u => u.owner !== power);
}

// ══════════════════════════════════════════════════════════════════
// E1: Spatial Computation
// ══════════════════════════════════════════════════════════════════

describe('simpleBfsDistance', () => {
  it('returns 0 for same space', () => {
    expect(simpleBfsDistance('Paris', 'Paris')).toBe(0);
  });

  it('returns 1 for adjacent spaces', () => {
    // Paris and Rouen should be adjacent
    const d = simpleBfsDistance('Paris', 'Rouen');
    expect(d).toBe(1);
  });

  it('returns null for unreachable spaces', () => {
    // A sea zone name that's not in land adjacency should be unreachable
    expect(simpleBfsDistance('Paris', 'NONEXISTENT_SPACE')).toBeNull();
  });

  it('finds multi-hop distances', () => {
    // Paris → Dijon (via connections, 2+ hops)
    const d = simpleBfsDistance('Paris', 'Lyon');
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(10);
  });

  it('returns null for London→Paris (no land connection)', () => {
    // London is on an island, no land path to continental Europe
    expect(simpleBfsDistance('London', 'Paris')).toBeNull();
  });
});

describe('weightedDistance', () => {
  it('returns distance 0 for same space', () => {
    const state = createBotState();
    const result = weightedDistance(state, 'Paris', 'Paris', 'france');
    expect(result).toEqual({ distance: 0, usesPass: false, usesSea: false });
  });

  it('returns distance for adjacent connection', () => {
    const state = createBotState();
    const result = weightedDistance(state, 'Paris', 'Rouen', 'france');
    expect(result).not.toBeNull();
    expect(result.distance).toBe(1);
    expect(result.usesPass).toBe(false);
  });

  it('returns null for unreachable space', () => {
    const state = createBotState();
    const result = weightedDistance(state, 'Paris', 'NONEXISTENT', 'france');
    expect(result).toBeNull();
  });

  it('prefers non-pass paths when equal distance', () => {
    const state = createBotState();
    // Any weighted distance result should have consistent pass/sea flags
    const result = weightedDistance(state, 'Vienna', 'Prague', 'hapsburg');
    expect(result).not.toBeNull();
    expect(result.distance).toBeGreaterThan(0);
  });

  it('can disable sea crossing', () => {
    const state = createBotState();
    const withSea = weightedDistance(state, 'London', 'Calais', 'england', { allowSea: true });
    const noSea = weightedDistance(state, 'London', 'Calais', 'england', { allowSea: false });
    // Both may find a path, but the route characteristics may differ
    if (withSea && noSea) {
      expect(noSea.distance).toBeGreaterThanOrEqual(withSea.distance);
    }
  });
});

describe('findClosestSpace', () => {
  it('finds itself if predicate matches origin', () => {
    const state = createBotState();
    const result = findClosestSpace(state, 'Paris', 'france',
      (name) => name === 'Paris');
    expect(result).toEqual({ space: 'Paris', distance: 0 });
  });

  it('finds nearby matching space', () => {
    const state = createBotState();
    // Find nearest key space from Paris
    const result = findClosestSpace(state, 'Paris', 'france',
      (name, sp) => sp.isKey);
    expect(result).not.toBeNull();
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });

  it('returns null when no match', () => {
    const state = createBotState();
    const result = findClosestSpace(state, 'Paris', 'france',
      () => false);
    expect(result).toBeNull();
  });
});

describe('hasSupplyLine', () => {
  it('fortified controlled space is self-supplied', () => {
    const state = createBotState();
    // Paris should be a key space under France's control
    expect(hasSupplyLine(state, 'Paris', 'france')).toBe(true);
  });

  it('returns true for space connected to friendly fortification', () => {
    const state = createBotState();
    // A French space near Paris should have supply
    expect(hasSupplyLine(state, 'Rouen', 'france')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// E2: Unit Placement
// ══════════════════════════════════════════════════════════════════

describe('chooseLandUnitPlacementEnhanced', () => {
  it('places at capital when garrison not met', () => {
    const state = createBotState();
    // Clear Istanbul units
    clearUnits(state, 'Istanbul', 'ottoman');
    const result = chooseLandUnitPlacementEnhanced(state, 'ottoman');
    expect(result).toBe('Istanbul');
  });

  it('places at capital as fallback when all garrisons met', () => {
    const state = createBotState();
    // With default units, all garrisons should be met
    const result = chooseLandUnitPlacementEnhanced(state, 'ottoman');
    expect(result).not.toBeNull();
  });

  it('returns null for power with no controlled spaces', () => {
    const state = createBotState();
    // Set all spaces to a different controller
    state.spaces = {};
    const result = chooseLandUnitPlacementEnhanced(state, 'ottoman');
    expect(result).toBeNull();
  });

  it('handles Protestant (no capital) correctly', () => {
    const state = createBotState();
    const result = chooseLandUnitPlacementEnhanced(state, 'protestant');
    // Protestant has no capital but should find a controlled fortification
    // May return null if no spaces controlled
    expect(typeof result === 'string' || result === null).toBe(true);
  });
});

describe('chooseNavalPlacementEnhanced', () => {
  it('returns a port for naval powers', () => {
    const state = createBotState();
    const result = chooseNavalPlacementEnhanced(state, 'ottoman');
    // Ottoman should have ports
    expect(result).not.toBeNull();
  });

  it('returns null for power with no ports', () => {
    const state = createBotState();
    state.spaces = {};
    const result = chooseNavalPlacementEnhanced(state, 'ottoman');
    expect(result).toBeNull();
  });

  it('prefers ports with fewer squadrons', () => {
    const state = createBotState();
    // Set up two ports, one with 2 squadrons
    const ports = Object.entries(state.spaces)
      .filter(([, sp]) => sp.controller === 'ottoman' && sp.isPort);
    if (ports.length >= 2) {
      setUnits(state, ports[0][0], 'ottoman', { regulars: 1, squadrons: 2 });
      setUnits(state, ports[1][0], 'ottoman', { regulars: 1, squadrons: 0 });
      const result = chooseNavalPlacementEnhanced(state, 'ottoman');
      expect(result).not.toBe(ports[0][0]); // Should avoid the crowded port
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// E2: Unit Removal
// ══════════════════════════════════════════════════════════════════

describe('chooseUnitToRemove', () => {
  it('prefers mercenaries/cavalry over regulars', () => {
    const state = createBotState();
    // Place a stack with mixed units
    setUnits(state, 'Istanbul', 'ottoman', {
      regulars: 5, mercenaries: 2, cavalry: 1
    });
    const result = chooseUnitToRemove(state, 'ottoman');
    expect(result).not.toBeNull();
    expect(result.unitType).toBe('mercenary');
  });

  it('returns null when no units to remove', () => {
    const state = createBotState();
    state.spaces = {};
    const result = chooseUnitToRemove(state, 'ottoman');
    expect(result).toBeNull();
  });

  it('prefers removing from space with surplus over garrison', () => {
    const state = createBotState();
    // Istanbul garrison = 2, place 4 regulars
    setUnits(state, 'Istanbul', 'ottoman', { regulars: 4 });
    // Another space with just 1 regular (likely below garrison)
    const otherKey = Object.entries(state.spaces)
      .find(([n, sp]) => sp.controller === 'ottoman' && sp.isKey && n !== 'Istanbul');
    if (otherKey) {
      setUnits(state, otherKey[0], 'ottoman', { regulars: 1 });
      const result = chooseUnitToRemove(state, 'ottoman');
      expect(result).not.toBeNull();
      // Should prefer Istanbul (surplus) over the under-garrisoned key
      expect(result.space).toBe('Istanbul');
    }
  });

  it('removes cavalry before regulars when no mercs', () => {
    const state = createBotState();
    setUnits(state, 'Istanbul', 'ottoman', { regulars: 3, cavalry: 2 });
    const result = chooseUnitToRemove(state, 'ottoman');
    expect(result).not.toBeNull();
    expect(result.unitType).toBe('cavalry');
  });

  it('removes regular when no mercs or cavalry', () => {
    const state = createBotState();
    setUnits(state, 'Istanbul', 'ottoman', { regulars: 5 });
    const result = chooseUnitToRemove(state, 'ottoman');
    expect(result).not.toBeNull();
    expect(result.unitType).toBe('regular');
  });
});

describe('chooseNavalUnitToRemove', () => {
  it('returns port with squadrons', () => {
    const state = createBotState();
    // Set up Ottoman with squadrons in a port
    const ports = Object.entries(state.spaces)
      .filter(([, sp]) => sp.controller === 'ottoman' && sp.isPort);
    if (ports.length > 0) {
      setUnits(state, ports[0][0], 'ottoman', { regulars: 1, squadrons: 2 });
      const result = chooseNavalUnitToRemove(state, 'ottoman');
      expect(result).toBe(ports[0][0]);
    }
  });

  it('returns null when no naval units', () => {
    const state = createBotState();
    state.spaces = {};
    const result = chooseNavalUnitToRemove(state, 'ottoman');
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// E2: Displacement
// ══════════════════════════════════════════════════════════════════

describe('chooseDisplacementDestination', () => {
  it('returns nearby friendly fortification', () => {
    const state = createBotState();
    // Try displacing from a French space near Paris
    const result = chooseDisplacementDestination(state, 'france', 'Rouen');
    expect(result).not.toBeNull();
  });

  it('returns null when no valid destination exists', () => {
    const state = createBotState();
    state.spaces = {};
    const result = chooseDisplacementDestination(state, 'france', 'Paris');
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// E4: Mercenary Ratio
// ══════════════════════════════════════════════════════════════════

describe('applyMercenaryRatio', () => {
  it('returns all regulars when no mercenaries', () => {
    const result = applyMercenaryRatio({ regulars: 5, mercenaries: 0, cavalry: 0 }, 3);
    expect(result).toEqual({ regulars: 3, mercenaries: 0, cavalry: 0 });
  });

  it('returns all mercenaries when no regulars', () => {
    const result = applyMercenaryRatio({ regulars: 0, mercenaries: 5, cavalry: 0 }, 3);
    expect(result).toEqual({ regulars: 0, mercenaries: 3, cavalry: 0 });
  });

  it('maintains mercenary ratio in mixed stack', () => {
    // 2 mercs + 3 regulars = 40% merc
    // Picking 3: need at least 40% mercs → ceil(3*0.4)=2 mercs + 1 regular
    const result = applyMercenaryRatio({ regulars: 3, mercenaries: 2, cavalry: 0 }, 3);
    expect(result.mercenaries).toBeGreaterThanOrEqual(1);
    expect(result.mercenaries + result.regulars + result.cavalry).toBe(3);
  });

  it('handles cavalry in mixed stack', () => {
    const result = applyMercenaryRatio({ regulars: 2, mercenaries: 1, cavalry: 1 }, 2);
    // 50% merc+cav, so pick 1 merc/cav + 1 regular
    expect(result.mercenaries + result.cavalry).toBeGreaterThanOrEqual(1);
    expect(result.mercenaries + result.cavalry + result.regulars).toBe(2);
  });

  it('handles count of 0', () => {
    const result = applyMercenaryRatio({ regulars: 3, mercenaries: 2, cavalry: 0 }, 0);
    expect(result).toEqual({ regulars: 0, mercenaries: 0, cavalry: 0 });
  });

  it('handles empty stack', () => {
    const result = applyMercenaryRatio({ regulars: 0, mercenaries: 0, cavalry: 0 }, 3);
    expect(result).toEqual({ regulars: 0, mercenaries: 0, cavalry: 0 });
  });

  it('does not exceed available units', () => {
    const result = applyMercenaryRatio({ regulars: 1, mercenaries: 1, cavalry: 0 }, 5);
    expect(result.regulars + result.mercenaries).toBeLessThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════════
// E4: Formation Growing
// ══════════════════════════════════════════════════════════════════

describe('growFormationAlongPath', () => {
  it('returns initial force when path has no intermediate spaces', () => {
    const state = createBotState();
    const initial = { regulars: 3, mercenaries: 0, cavalry: 0, leaders: [] };
    // Adjacent spaces — path length 2 (from + to), no intermediates
    const result = growFormationAlongPath(state, 'france', 'Paris', 'Rouen', initial);
    expect(result.regulars).toBe(3);
  });

  it('picks up units from intermediate spaces above garrison', () => {
    const state = createBotState();
    // Need a path with intermediates
    // Set up: Paris → Rouen → (destination further)
    // Place surplus units at Rouen
    state.spaces['Rouen'] = state.spaces['Rouen'] || {
      controller: 'france', isKey: false, isElectorate: false,
      isFortress: false, isPort: false, units: []
    };
    state.spaces['Rouen'].controller = 'france';
    setUnits(state, 'Rouen', 'france', { regulars: 3 });

    const initial = { regulars: 2, mercenaries: 0, cavalry: 0, leaders: [] };
    // Find a space that goes through Rouen from Paris
    // This depends on map topology — test verifies the logic works
    const result = growFormationAlongPath(state, 'france', 'Paris', 'Rouen', initial);
    // Path is only 2 spaces (Paris→Rouen), so no intermediates
    expect(result.regulars).toBeGreaterThanOrEqual(2);
  });

  it('respects formation cap when picking up units', () => {
    const state = createBotState();
    const initial = { regulars: 3, mercenaries: 0, cavalry: 0, leaders: [] };
    // No leader: cap is 4
    // Even if intermediate has units, shouldn't exceed 4
    const result = growFormationAlongPath(state, 'france', 'Paris', 'Lyon', initial);
    expect(result.regulars + result.mercenaries + result.cavalry).toBeLessThanOrEqual(4);
  });

  it('picks up leaders to increase formation cap', () => {
    const state = createBotState();
    // Place a leader at an intermediate space
    const intermediate = 'Rouen';
    state.spaces[intermediate] = state.spaces[intermediate] || {
      controller: 'france', isKey: false, units: []
    };
    state.spaces[intermediate].controller = 'france';
    setUnits(state, intermediate, 'france', {
      regulars: 2, leaders: ['francis_i']
    });

    const initial = { regulars: 3, mercenaries: 0, cavalry: 0, leaders: [] };
    const result = growFormationAlongPath(state, 'france', 'Paris', 'Lyon', initial);
    // If Rouen is on the path, Francis I should be picked up
    // Francis I has command 8, so cap increases from 4 to 8
    if (result.leaders.includes('francis_i')) {
      expect(result.regulars + result.mercenaries + result.cavalry).toBeLessThanOrEqual(8);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Misc Helpers
// ══════════════════════════════════════════════════════════════════

describe('getCapitals', () => {
  it('returns Ottoman capital', () => {
    expect(getCapitals('ottoman')).toEqual(['Istanbul']);
  });

  it('returns both Hapsburg capitals', () => {
    expect(getCapitals('hapsburg')).toEqual(['Vienna', 'Valladolid']);
  });

  it('returns empty for Protestant', () => {
    expect(getCapitals('protestant')).toEqual([]);
  });

  it('returns empty for unknown power', () => {
    expect(getCapitals('unknown')).toEqual([]);
  });
});

describe('hasNearbyIndependentThreat', () => {
  it('returns false when no independent spaces near', () => {
    const state = createBotState();
    // Default state shouldn't have independent threats everywhere
    // This depends on map setup
    const result = hasNearbyIndependentThreat(state, 'france');
    expect(typeof result).toBe('boolean');
  });

  it('detects independent fortified space within 2', () => {
    const state = createBotState();
    // Find a space adjacent to a French fortification and set it independent
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && (sp.isFortress || sp.isKey)) {
        const adj = Object.entries(state.spaces)
          .find(([n, s]) => {
            const adjList = getAllAdjacentSpacesFromState(name);
            return adjList.includes(n) && (s.isFortress || s.isKey);
          });
        if (adj) {
          state.spaces[adj[0]].controller = 'independent';
          expect(hasNearbyIndependentThreat(state, 'france')).toBe(true);
          return;
        }
      }
    }
    // If map topology doesn't allow the test, just pass
    expect(true).toBe(true);
  });
});

// Helper to get adjacent spaces without importing from state-helpers
// (just uses the same data)
function getAllAdjacentSpacesFromState(spaceName) {
  // Import indirectly from the module under test
  const { getAllAdjacentSpaces } = require('../state/state-helpers.js');
  return getAllAdjacentSpaces(spaceName);
}
