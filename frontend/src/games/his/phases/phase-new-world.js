/**
 * Here I Stand — New World Phase
 *
 * Resolves underway explorations and conquests placed during the Action Phase.
 * Order: explorations first (best explorer first), then conquests (Hapsburg first).
 *
 * Rules (§20.2, 20.3):
 * - Exploration: random explorer assigned, roll 2d6 + exploration modifier
 * - Conquest: random conquistador (Hapsburg) or conquest marker, roll 2d6 + conquest modifier
 * - Colonies: move from crossing atlantic to active colony slots
 */

import {
  getExplorationResult, getCircumnavigationResult, getConquestResult,
  EXPLORATION_RESULTS, CONQUEST_RESULTS,
  DISCOVERIES, AMAZON, PACIFIC_STRAIT, CIRCUMNAVIGATION,
  CONQUESTS
} from '../constants.js';
import { rollDice } from '../actions/religious-actions.js';
import { getAvailableExplorers, getAvailableConquistadors } from '../actions/new-world-actions.js';

/**
 * Resolve all New World activities for this turn.
 * @param {Object} state
 * @param {Object} helpers
 */
export function resolveNewWorld(state, helpers) {
  helpers.logEvent(state, 'new_world_phase_start', {});

  // 1. Move underway colonies to active
  resolveColonies(state, helpers);

  // 2. Resolve explorations (best explorer first)
  resolveExplorations(state, helpers);

  // 3. Resolve conquests (Hapsburg first, then England, then France)
  resolveConquests(state, helpers);

  // 4. Reset turn tracking
  state.newWorld.exploredThisTurn = {};
  state.newWorld.colonizedThisTurn = {};
  state.newWorld.conqueredThisTurn = {};

  helpers.logEvent(state, 'new_world_phase_end', {});
}

// ── Colonies ────────────────────────────────────────────────────────

function resolveColonies(state, helpers) {
  for (const colony of state.newWorld.underwayColonies) {
    state.newWorld.colonies.push({ power: colony.power });
    helpers.logEvent(state, 'colony_placed', { power: colony.power });
  }
  state.newWorld.underwayColonies = [];
}

// ── Explorations ────────────────────────────────────────────────────

function resolveExplorations(state, helpers) {
  const voyages = [...state.newWorld.underwayExplorations];
  state.newWorld.underwayExplorations = [];

  // Assign random explorers and sort by exploration value (highest first)
  const assigned = [];
  for (const v of voyages) {
    const pool = getAvailableExplorers(state, v.power);
    if (pool.length === 0) continue;
    // Random selection
    const idx = Math.floor(Math.random() * pool.length);
    const explorer = pool[idx];
    assigned.push({ power: v.power, explorer });
  }

  // Sort: highest exploration first; ties: england > france > hapsburg
  const powerOrder = { england: 0, france: 1, hapsburg: 2 };
  assigned.sort((a, b) => {
    if (b.explorer.exploration !== a.explorer.exploration) {
      return b.explorer.exploration - a.explorer.exploration;
    }
    return powerOrder[a.power] - powerOrder[b.power];
  });

  for (const { power, explorer } of assigned) {
    resolveSingleExploration(state, power, explorer, helpers);
  }
}

/**
 * Resolve a single exploration voyage.
 */
function resolveSingleExploration(state, power, explorer, helpers) {
  const dice = rollDice(2);
  const roll = dice[0] + dice[1] + explorer.exploration;
  const result = getExplorationResult(roll);

  if (result === EXPLORATION_RESULTS.LOST) {
    state.newWorld.deadExplorers.push(explorer.id);
    helpers.logEvent(state, 'explorer_lost', {
      power, explorer: explorer.id, dice, roll
    });
    return;
  }

  if (result === EXPLORATION_RESULTS.NO_DISCOVERY) {
    // Explorer returned to pool (no action needed)
    helpers.logEvent(state, 'no_discovery', {
      power, explorer: explorer.id, dice, roll
    });
    return;
  }

  if (result === EXPLORATION_RESULTS.DISCOVERY) {
    // Claim discovery matching roll, or next available below
    const discovery = claimDiscovery(state, roll);
    if (discovery) {
      state.newWorld.placedExplorers.push({
        explorerId: explorer.id, discoveryId: discovery.id, power
      });
      state.bonusVp[power] = (state.bonusVp[power] || 0) + discovery.vp;
      helpers.logEvent(state, 'discovery_made', {
        power, explorer: explorer.id, discovery: discovery.id,
        vp: discovery.vp, dice, roll
      });
    } else {
      // No discoveries left
      helpers.logEvent(state, 'no_discovery', {
        power, explorer: explorer.id, dice, roll, reason: 'all_claimed'
      });
    }
    return;
  }

  // DEEP penetration (10+) — simplified: try circumnavigation first,
  // then Amazon, then any 1VP discovery
  resolveDeepPenetration(state, power, explorer, dice, roll, helpers);
}

function resolveDeepPenetration(state, power, explorer, dice, roll, helpers) {
  // Try Pacific Strait + circumnavigation
  const pacificClaimed = state.newWorld.claimedDiscoveries.includes('pacific_strait');

  if (!pacificClaimed) {
    // Claim Pacific Strait VP
    state.newWorld.claimedDiscoveries.push('pacific_strait');
    state.bonusVp[power] = (state.bonusVp[power] || 0) + PACIFIC_STRAIT.vp;

    // Attempt circumnavigation
    const circumDice = rollDice(2);
    const circumRoll = circumDice[0] + circumDice[1] + explorer.exploration;
    const circumResult = getCircumnavigationResult(circumRoll);

    if (circumResult === 'failure') {
      state.newWorld.deadExplorers.push(explorer.id);
      state.newWorld.placedExplorers.push({
        explorerId: explorer.id, discoveryId: 'pacific_strait', power
      });
      helpers.logEvent(state, 'circumnavigation_failed', {
        power, explorer: explorer.id, dice: circumDice, roll: circumRoll,
        pacificStraitVp: PACIFIC_STRAIT.vp
      });
      return;
    }

    // Circumnavigation success
    const circumClaimed = state.newWorld.claimedDiscoveries.includes('circumnavigation');
    if (!circumClaimed) {
      state.newWorld.claimedDiscoveries.push('circumnavigation');
      state.bonusVp[power] = (state.bonusVp[power] || 0) + CIRCUMNAVIGATION.vp;
    }
    state.newWorld.placedExplorers.push({
      explorerId: explorer.id, discoveryId: 'circumnavigation', power
    });

    const bonusCard = circumResult === 'success_card';
    helpers.logEvent(state, 'circumnavigation_success', {
      power, explorer: explorer.id, dice: circumDice, roll: circumRoll,
      vp: CIRCUMNAVIGATION.vp, bonusCard
    });
    return;
  }

  // Pacific already claimed — try Amazon
  const amazonClaimed = state.newWorld.claimedDiscoveries.includes('amazon');
  if (!amazonClaimed) {
    state.newWorld.claimedDiscoveries.push('amazon');
    state.bonusVp[power] = (state.bonusVp[power] || 0) + AMAZON.vp;
    state.newWorld.placedExplorers.push({
      explorerId: explorer.id, discoveryId: 'amazon', power
    });
    helpers.logEvent(state, 'discovery_made', {
      power, explorer: explorer.id, discovery: 'amazon',
      vp: AMAZON.vp, dice, roll
    });
    return;
  }

  // Fall back to any 1VP discovery
  const discovery = claimDiscovery(state, 9);
  if (discovery) {
    state.newWorld.placedExplorers.push({
      explorerId: explorer.id, discoveryId: discovery.id, power
    });
    state.bonusVp[power] = (state.bonusVp[power] || 0) + discovery.vp;
    helpers.logEvent(state, 'discovery_made', {
      power, explorer: explorer.id, discovery: discovery.id,
      vp: discovery.vp, dice, roll
    });
  } else {
    helpers.logEvent(state, 'no_discovery', {
      power, explorer: explorer.id, dice, roll, reason: 'all_claimed'
    });
  }
}

/**
 * Claim the discovery at the given roll index, or the next available below.
 * @returns {Object|null} The discovery object, or null if all claimed.
 */
function claimDiscovery(state, roll) {
  const claimedSet = new Set(state.newWorld.claimedDiscoveries);
  // Try from roll down to 7
  for (let i = Math.min(roll, 9); i >= 7; i--) {
    const disc = DISCOVERIES[i];
    if (disc && !claimedSet.has(disc.id)) {
      state.newWorld.claimedDiscoveries.push(disc.id);
      return disc;
    }
  }
  return null;
}

// ── Conquests ───────────────────────────────────────────────────────

function resolveConquests(state, helpers) {
  const voyages = [...state.newWorld.underwayConquests];
  state.newWorld.underwayConquests = [];

  // Resolve order: Hapsburg first, then England, then France
  const powerOrder = { hapsburg: 0, england: 1, france: 2 };
  voyages.sort((a, b) => powerOrder[a.power] - powerOrder[b.power]);

  for (const v of voyages) {
    resolveSingleConquest(state, v.power, helpers);
  }
}

function resolveSingleConquest(state, power, helpers) {
  let conquistadorId = null;
  let modifier = 0;

  if (power === 'hapsburg') {
    const pool = getAvailableConquistadors(state);
    if (pool.length === 0) return;
    const idx = Math.floor(Math.random() * pool.length);
    const conq = pool[idx];
    conquistadorId = conq.id;
    modifier = conq.conquest;
  }

  const dice = rollDice(2);
  const roll = dice[0] + dice[1] + modifier;
  const result = getConquestResult(roll);

  if (result === CONQUEST_RESULTS.KILLED) {
    if (conquistadorId) {
      state.newWorld.deadConquistadors.push(conquistadorId);
    }
    helpers.logEvent(state, 'conquest_failed', {
      power, conquistador: conquistadorId, dice, roll, result: 'killed'
    });
    return;
  }

  if (result === CONQUEST_RESULTS.NO_CONQUEST) {
    // Returned to pool
    helpers.logEvent(state, 'conquest_failed', {
      power, conquistador: conquistadorId, dice, roll, result: 'none'
    });
    return;
  }

  // Conquest succeeded — claim conquest at roll or next available below
  const conquest = claimConquest(state, roll);
  if (conquest) {
    if (conquistadorId) {
      state.newWorld.placedConquistadors.push({
        conquistadorId, conquestId: conquest.id, power
      });
    }
    state.newWorld.conquests.push({ power, conquestId: conquest.id });
    state.bonusVp[power] = (state.bonusVp[power] || 0) + conquest.vp;
    helpers.logEvent(state, 'conquest_made', {
      power, conquistador: conquistadorId, conquest: conquest.id,
      vp: conquest.vp, dice, roll
    });
  } else {
    helpers.logEvent(state, 'conquest_failed', {
      power, conquistador: conquistadorId, dice, roll, result: 'all_claimed'
    });
  }
}

function claimConquest(state, roll) {
  const claimedSet = new Set(state.newWorld.claimedConquests);
  for (let i = Math.min(roll, 11); i >= 9; i--) {
    const conq = CONQUESTS[i];
    if (conq && !claimedSet.has(conq.id)) {
      state.newWorld.claimedConquests.push(conq.id);
      return conq;
    }
  }
  return null;
}
