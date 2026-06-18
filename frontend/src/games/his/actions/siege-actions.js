/**
 * Here I Stand — Siege Mechanics
 *
 * Siege establish, assault, relief, and break.
 * Section 15 of the rulebook.
 */

import { ACTION_COSTS, COMBAT, CAPITALS } from '../constants.js';
import { spendCp } from './cp-manager.js';
import {
  getUnitsInSpace, countLandUnits, getAllAdjacentSpaces, isFortified,
  isHomeSpace
} from '../state/state-helpers.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { SPACE_BY_NAME } from '../data/map-data.js';
import { rollDice } from './religious-actions.js';
import { applyCasualties } from './combat-actions.js';
import { hasLineOfCommunicationForControl } from './military-actions.js';
import { getValidPostRollCards, createPostRollWindow } from './response-actions.js';
import { canAttack } from '../state/war-helpers.js';

// ── Line of Communication ───────────────────────────────────────

/**
 * Check if a power has a line of communication from a space.
 * LOC = path of friendly-controlled land spaces to a friendly
 * fortified home space (fortress or capital).
 * @param {Object} state
 * @param {string} space - Source space
 * @param {string} power - Power needing LOC
 * @returns {boolean}
 */
export function hasLineOfCommunication(state, space, power) {
  return hasLineOfCommunicationForControl(state, power, space);
}

/**
 * Is a space a fortified home space of `power`? (fortress/key, or its capital).
 * Mirrors the LOC-source test in military-actions.getLocSourceSpaces.
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {boolean}
 */
function isFortifiedHomeSpace(state, spaceName, power) {
  if (!isHomeSpace(spaceName, power)) return false;
  const sp = state.spaces[spaceName];
  if (!sp) return false;
  const capitals = CAPITALS[power] || [];
  return isFortified(sp, state) || capitals.includes(spaceName);
}

/**
 * §15 / card #35: is the assault space within a line of communication of
 * `maxLand` or fewer land spaces to a fortified home space of the assaulting
 * power? Used to gate the Siege Artillery (W5) post-roll window.
 *
 * Interpretation: BFS over land adjacency, traversing only spaces controlled
 * by `power`, counting land-space steps from the assault space; succeeds when a
 * fortified home space of `power` is reached at depth ≤ maxLand (depth 0 = the
 * assault space itself qualifying).
 *
 * @param {Object} state
 * @param {string} space - assault space
 * @param {string} power - assaulting major power
 * @param {number} [maxLand=4]
 * @returns {boolean}
 */
export function assaultLocWithinRange(state, space, power, maxLand = 4) {
  if (isFortifiedHomeSpace(state, space, power)) return true;
  const visited = new Set([space]);
  let frontier = [space];
  for (let depth = 1; depth <= maxLand; depth++) {
    const next = [];
    for (const current of frontier) {
      for (const neighbor of getAllAdjacentSpaces(current)) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        if (isFortifiedHomeSpace(state, neighbor, power)) return true;
        // Only traverse onward through spaces this power controls.
        if (state.spaces[neighbor]?.controller === power) next.push(neighbor);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return false;
}

// ── Establish Siege ─────────────────────────────────────────────

/**
 * Establish a siege at a fortified space.
 * Called automatically after field battle when attacker wins at fortress
 * and has more units than inside the fortification.
 * @param {Object} state
 * @param {string} space
 * @param {string} besiegingPower
 * @param {Object} helpers
 */
export function establishSiege(state, space, besiegingPower, helpers) {
  const sp = state.spaces[space];
  sp.besieged = true;
  sp.besiegedBy = besiegingPower;
  sp.siegeEstablishedImpulse = state.turnNumber;
  sp.siegeEstablishedTurn = state.turn;
  sp.siegeEstablishedCardNumber = state.activeCardNumber ?? null;
  sp.siegeEstablishedBy = besiegingPower;

  helpers.logEvent(state, 'siege_established', {
    space, besiegedBy: besiegingPower
  });
}

// ── Validate Assault ────────────────────────────────────────────

/**
 * Validate an assault action.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { space }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAssault(state, power, actionData) {
  const space = actionData?.space ?? actionData?.target;
  const isFree = actionData?.free === true;
  if (!space) return { valid: false, error: 'Missing space' };

  const sp = state.spaces[space];
  if (!sp) return { valid: false, error: `Space "${space}" not found` };

  // §card #42 Roxelana: a free assault by the named formation (Suleiman),
  // allowed "even on a fortress not under siege at the start of the impulse".
  // The grant bypasses the besieged / siege-timing / CP requirements; the LOC,
  // units and naval checks below still apply.
  const grant = state.pendingFreeAssault;
  const usingGrant = isFree && grant != null && grant.power === power;

  if (!usingGrant) {
    if (!sp.besieged) return { valid: false, error: 'Space is not under siege' };
    if (sp.besiegedBy !== power) {
      return { valid: false, error: 'You are not the besieger' };
    }

    // Cannot assault in the same impulse that established the siege.
    const sameCardImpulse = (
      sp.siegeEstablishedCardNumber != null &&
      state.activeCardNumber != null &&
      sp.siegeEstablishedTurn === state.turn &&
      sp.siegeEstablishedBy === power &&
      sp.siegeEstablishedCardNumber === state.activeCardNumber
    );
    if (sameCardImpulse || sp.siegeEstablishedImpulse === state.turnNumber) {
      return { valid: false, error: 'Cannot assault in same impulse as siege establishment' };
    }
  }

  // Check CP (skipped for free autumn assaults)
  const cost = ACTION_COSTS[power]?.assault;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot perform assault' };
  }
  if (!isFree && state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  // Must have units in the space
  const stack = getUnitsInSpace(state, space, power);
  if (!stack || countLandUnits(stack) === 0) {
    return { valid: false, error: 'No units available for assault' };
  }

  // Roxelana grant requires the named leader (Suleiman) in the formation.
  if (usingGrant && grant.requireLeader &&
      !stack.leaders.includes(grant.requireLeader)) {
    return { valid: false, error: `Free assault requires ${grant.requireLeader}` };
  }

  // LOC check: must have a path to a friendly fortified home space
  if (!hasLineOfCommunication(state, space, power)) {
    return { valid: false, error: 'No line of communication to a friendly fortified space' };
  }

  // §14 Naval checks for port spaces
  const mapSpace = SPACE_BY_NAME[space];
  if (sp.isPort && mapSpace?.connectedSeaZones?.length > 0) {
    for (const sz of mapSpace.connectedSeaZones) {
      // Check for enemy naval in adjacent sea zone
      const seaState = state.spaces[sz];
      if (seaState?.units) {
        const enemyNaval = seaState.units.find(u =>
          u.owner !== power && canAttack(state, power, u.owner) &&
          (u.squadrons > 0 || u.corsairs > 0)
        );
        if (enemyNaval) {
          return { valid: false, error: 'Enemy naval forces in adjacent sea zone' };
        }
      }
    }
  }

  return { valid: true };
}

// ── Execute Assault ─────────────────────────────────────────────

/**
 * Execute an assault on a besieged fortress.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { space }
 * @param {Object} helpers
 * @returns {Object} Assault result
 */
/**
 * Compute and roll assault dice for both sides. Shared by executeAssault (CP
 * action) and treacheryAssault (event #105). Returns the roll context that
 * finalizeAssault consumes. Cavalry is ignored for dice; the defender gets the
 * fortification bonus die.
 *
 * @param {Object} state
 * @param {string} space
 * @param {string} power - the assaulting (besieging) power
 * @returns {Object} { space, attackerPower, defenderPower, attackerRolls,
 *   defenderRolls, attackerDice, defenderDice }
 */
function rollAssault(state, space, power) {
  const sp = state.spaces[space];
  const attackerStack = getUnitsInSpace(state, space, power);
  const defenderPower = sp.controller;
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  // Calculate attacker dice (cavalry ignored in assaults)
  const attackerLandNoCAv = attackerStack.regulars + attackerStack.mercenaries;
  let attackerDice;
  if (!defenderStack || countLandUnits(defenderStack) === 0) {
    // No defenders: 1 die per unit
    attackerDice = attackerLandNoCAv;
  } else {
    // Defenders present: 1 die per 2 units, rounded up
    attackerDice = Math.ceil(attackerLandNoCAv / 2);
  }

  // §15.3: Add highest leader battle rating as extra dice for attacker
  let attackerLeaderBonus = 0;
  for (const lid of attackerStack.leaders) {
    const leader = LEADER_BY_ID[lid];
    if (leader && leader.battle > attackerLeaderBonus) {
      attackerLeaderBonus = leader.battle;
    }
  }
  attackerDice += attackerLeaderBonus;
  attackerDice = Math.max(attackerDice, 1);

  // Defender dice (cavalry ignored) + 1 bonus
  let defenderDice = 0;
  if (defenderStack) {
    defenderDice = defenderStack.regulars + defenderStack.mercenaries;

    // Add highest defender leader battle rating
    let defenderLeaderBonus = 0;
    for (const lid of defenderStack.leaders) {
      const leader = LEADER_BY_ID[lid];
      if (leader && leader.battle > defenderLeaderBonus) {
        defenderLeaderBonus = leader.battle;
      }
    }
    defenderDice += defenderLeaderBonus;
  }
  defenderDice += COMBAT.defenderBonusDice;
  defenderDice = Math.max(defenderDice, 1);

  const attackerRolls = rollDice(attackerDice);
  const defenderRolls = rollDice(defenderDice);

  return {
    space, attackerPower: power, defenderPower,
    attackerRolls, defenderRolls, attackerDice, defenderDice
  };
}

export function executeAssault(state, power, actionData, helpers) {
  const space = actionData?.space ?? actionData?.target;
  const isFree = actionData?.free === true;
  const cost = ACTION_COSTS[power].assault;
  if (!isFree) spendCp(state, cost);

  // §card #42 Roxelana: consume the one-shot free-assault grant when used.
  const grant = state.pendingFreeAssault;
  if (isFree && grant != null && grant.power === power) {
    const gStack = getUnitsInSpace(state, space, power);
    if (gStack && (!grant.requireLeader || gStack.leaders.includes(grant.requireLeader))) {
      state.pendingFreeAssault = null;
    }
  }

  const ctx = rollAssault(state, space, power);
  ctx.free = isFree;
  const { defenderPower, attackerRolls, defenderRolls } = ctx;

  // W5 (Siege Artillery #35) post-roll window: only the assaulting power, only
  // when it holds #35 and has a line of communication ≤4 to a fortified home
  // space. Pause here; finalizeAssault runs after the window resolves.
  const attackerCanSiegeArtillery =
    getValidPostRollCards(state, power, 'assault').includes(35) &&
    assaultLocWithinRange(state, space, power);
  if (attackerCanSiegeArtillery) {
    state.pendingAssault = ctx;
    const created = createPostRollWindow(
      state, 'W5', space, power, defenderPower, 'assault', { responses: {} }
    );
    if (created) {
      return { paused: true, window: 'W5', rolls: { attackerRolls, defenderRolls } };
    }
    state.pendingAssault = null;
  }

  return finalizeAssault(state, ctx, helpers);
}

/**
 * Finalize an assault after any W5 (Siege Artillery) window resolves. Applies
 * the #35 bonus dice (which hit on a lower value), then casualties, success,
 * control change and leader capture. Called directly from executeAssault when
 * no W5 window opens, or from the move router after W5 resolves.
 *
 * @param {Object} state
 * @param {Object} ctx - { space, attackerPower, defenderPower, attackerRolls,
 *                         defenderRolls, attackerDice, defenderDice }
 * @param {Object} helpers
 * @returns {Object} Assault result
 */
export function finalizeAssault(state, ctx, helpers) {
  const {
    space, attackerPower: power, defenderPower,
    attackerRolls, defenderRolls, attackerDice, defenderDice
  } = ctx;
  const sp = state.spaces[space];
  const attackerStack = getUnitsInSpace(state, space, power);
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  const baseAttackerHits = attackerRolls.filter(
    d => d >= COMBAT.hitThreshold).length;
  const defenderHits = defenderRolls.filter(
    d => d >= COMBAT.hitThreshold).length;

  // §card #35: +2 attacker dice that score hits on 3,4,5,6 (post-roll). The
  // bonus is set by EVENT_HANDLERS[35] on state.pendingCombatBonus when the
  // card is played in the W5 window.
  let siegeArtilleryHits = 0;
  let siegeArtilleryRolls = null;
  const bonus = state.pendingCombatBonus;
  if (bonus && bonus.card === 35 && (bonus.types || []).includes('assault')) {
    const hitOn = bonus.hitOn3 ? 3 : COMBAT.hitThreshold;
    siegeArtilleryRolls = rollDice(bonus.dice);
    siegeArtilleryHits = siegeArtilleryRolls.filter(d => d >= hitOn).length;
    helpers.logEvent(state, 'siege_artillery_bonus', {
      power, space, dice: bonus.dice, hitOn, rolls: siegeArtilleryRolls,
      hits: siegeArtilleryHits
    });
    state.pendingCombatBonus = null;
  }
  const attackerHits = baseAttackerHits + siegeArtilleryHits;

  // Apply casualties (cavalry can be taken as assault losses for attacker)
  const attackerCasualties = applyCasualties(attackerStack, defenderHits);
  let defenderCasualties = 0;
  if (defenderStack) {
    defenderCasualties = applyCasualties(defenderStack, attackerHits);
  }

  // Check success: at least 1 hit, no defenders remain, at least 1 attacker
  const defenderRemaining = defenderStack ? countLandUnits(defenderStack) : 0;
  const attackerRemaining = countLandUnits(attackerStack);

  const success = attackerHits >= 1 &&
    defenderRemaining === 0 &&
    attackerRemaining >= 1;

  if (success) {
    // Siege succeeds — attacker takes control
    sp.besieged = false;
    sp.besiegedBy = null;
    sp.siegeEstablishedImpulse = null;
    sp.siegeEstablishedTurn = null;
    sp.siegeEstablishedCardNumber = null;
    sp.siegeEstablishedBy = null;
    sp.controller = power;

    // Capture defender leaders
    if (defenderStack && defenderStack.leaders.length > 0) {
      if (!state.capturedLeaders[power]) {
        state.capturedLeaders[power] = [];
      }
      state.capturedLeaders[power].push(...defenderStack.leaders);
      defenderStack.leaders = [];
    }
  }

  // Clean up empty stacks
  sp.units = sp.units.filter(u =>
    countLandUnits(u) > 0 || u.leaders.length > 0 ||
    u.squadrons > 0 || u.corsairs > 0
  );

  const result = {
    success,
    attackerDice,
    defenderDice,
    attackerRolls,
    defenderRolls,
    attackerHits,
    defenderHits,
    attackerCasualties,
    defenderCasualties,
    siegeArtilleryHits,
    siegeArtilleryRolls
  };

  state.impulseActions.push({ type: 'assault', space });
  helpers.logEvent(state, 'assault', { power, space, ...result });

  return result;
}

/**
 * §card #105 Treachery!: the besieging power immediately assaults the units in
 * a besieged fortification, ignoring the usual LOC / naval requirements. The
 * W5 (Siege Artillery) window never applies (it requires a LOC, which Treachery
 * specifically bypasses). After the assault, if the besiegers still outnumber
 * the units within, all defenders are eliminated, their leaders captured, and
 * the space passes to the besieging power.
 *
 * @param {Object} state
 * @param {string} space - the besieged space
 * @param {Object} helpers
 * @returns {Object} assault result, plus { overrun: boolean }
 */
export function treacheryAssault(state, space, helpers) {
  const sp = state.spaces[space];
  if (!sp || !sp.besieged) return { error: 'Space is not under siege' };
  const power = sp.besiegedBy;
  if (!power) return { error: 'No besieging power' };
  const attackerStack = getUnitsInSpace(state, space, power);
  if (!attackerStack) return { error: 'No besieging units' };

  const ctx = rollAssault(state, space, power);
  ctx.free = true;
  const { defenderPower } = ctx;
  const result = finalizeAssault(state, ctx, helpers);

  // Overrun rule: if defenders remain but the besiegers outnumber them, the
  // fortification falls. (finalizeAssault already handles the defenders==0 win.)
  const defenderStack = getUnitsInSpace(state, space, defenderPower);
  const attackerAfter = getUnitsInSpace(state, space, power);
  const defLand = defenderStack ? countLandUnits(defenderStack) : 0;
  const attLand = attackerAfter ? countLandUnits(attackerAfter) : 0;
  let overrun = false;
  if (defLand > 0 && attLand > defLand) {
    overrun = true;
    if (defenderStack.leaders.length > 0) {
      if (!state.capturedLeaders[power]) state.capturedLeaders[power] = [];
      state.capturedLeaders[power].push(...defenderStack.leaders);
      defenderStack.leaders = [];
    }
    sp.units = sp.units.filter(u => u.owner !== defenderPower);
    sp.besieged = false;
    sp.besiegedBy = null;
    sp.siegeEstablishedImpulse = null;
    sp.siegeEstablishedTurn = null;
    sp.siegeEstablishedCardNumber = null;
    sp.siegeEstablishedBy = null;
    sp.controller = power;
    helpers.logEvent(state, 'treachery_overrun', { space, power, defenderPower });
  }

  return { ...result, overrun };
}

// ── Break Siege ─────────────────────────────────────────────────

/**
 * Check if a siege should be broken (besieger no longer has more
 * land units than defenders).
 * @param {Object} state
 * @param {string} space
 * @param {Object} helpers
 * @returns {boolean} Whether the siege was broken
 */
export function checkSiegeBreak(state, space, helpers) {
  const sp = state.spaces[space];
  if (!sp.besieged) return false;

  const besiegedBy = sp.besiegedBy;
  const besiegerStack = getUnitsInSpace(state, space, besiegedBy);
  const besiegerCount = besiegerStack ? countLandUnits(besiegerStack) : 0;

  // Count defender units (controlled power's units)
  const defenderPower = sp.controller;
  const defenderStack = getUnitsInSpace(state, space, defenderPower);
  const defenderCount = defenderStack ? countLandUnits(defenderStack) : 0;

  if (besiegerCount <= defenderCount) {
    sp.besieged = false;
    sp.besiegedBy = null;
    sp.siegeEstablishedImpulse = null;
    sp.siegeEstablishedTurn = null;
    sp.siegeEstablishedCardNumber = null;
    sp.siegeEstablishedBy = null;

    helpers.logEvent(state, 'siege_broken', { space, reason: 'insufficient_units' });
    return true;
  }

  return false;
}

// ── Relief ──────────────────────────────────────────────────────

/**
 * Check if a relief force arriving at a besieged space should trigger
 * a field battle. This is called when friendly units move into a
 * besieged space.
 * @param {Object} state
 * @param {string} space
 * @returns {{ shouldBattle: boolean, besiegingPower?: string }}
 */
export function checkRelief(state, space) {
  const sp = state.spaces[space];
  if (!sp.besieged) return { shouldBattle: false };
  return { shouldBattle: true, besiegingPower: sp.besiegedBy };
}
