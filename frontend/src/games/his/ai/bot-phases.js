/**
 * Here I Stand — Bot Phase-Specific Logic
 *
 * Implements HISBOT v1.1 decision rules for non-action phases:
 *   §2.2  Card Draw stacking
 *   §2.4  Peace segment
 *   §2.5  Ransom segment
 *   §2.6  Excommunication segment
 *   §2.7  War declarations
 *   §2.8  Diet of Worms
 *   §2.9  Spring Deployment
 *   §2.11 Winter phase
 *   §2.12 New World phase
 *
 * All functions are pure helpers that read state and return
 * {actionType, actionData} moves — they do NOT mutate state.
 */

import { CAPITALS, DOW_COSTS, RULERS, FORMATION } from '../constants.js';
import { ACTION_TYPES } from '../actions/action-types.js';
import { CARD_BY_NUMBER } from '../data/cards.js';
import { getActiveBehaviorCard, revealBehaviorCard, CARD_BY_ID } from './behavior-cards.js';
import {
  areAtWar, getWarsOf, getAlliesOf, isMinorPower, getMinorAlly
} from '../state/war-helpers.js';
import {
  countKeysForPower, getActiveRuler, isFortified, countLandUnits,
  getUnitsInSpace, isHomeSpace, getAdjacentSpaces
} from '../state/state-helpers.js';
import { isBotPower, getBotPowers } from './bot-controller.js';
import { validateSpringDeployment } from '../phases/phase-spring-deployment.js';
import { hasDiploPair } from '../actions/diplomacy-actions.js';

// ── §2.2 Card Draw — Hand Deck Stacking ──────────────────────────

/**
 * Stack a Bot's hand for the turn: Home card at bottom,
 * Papacy special (Leipzig Debate bottom, Papal Bull above it).
 *
 * HISBOT §2.2: Deal cards face-down, Home card at bottom.
 * Papacy: Leipzig Debate always at bottom, Papal Bull on top of it.
 *
 * @param {number[]} hand - Card numbers dealt to this power (mutated in-place)
 * @param {string} power
 * @returns {number[]} The reordered hand
 */
export function stackBotHand(hand, power) {
  if (!hand || hand.length === 0) return hand;

  if (power === 'papacy') {
    return stackPapacyHand(hand);
  }

  // General rule: Home card goes to the bottom (end of array).
  // Hand is treated as a stack — index 0 = top (drawn first).
  const homeIdx = hand.findIndex(c => CARD_BY_NUMBER[c]?.deck === 'home');
  if (homeIdx >= 0) {
    const [homeCard] = hand.splice(homeIdx, 1);
    hand.push(homeCard);
  }

  return hand;
}

/**
 * Papacy special stacking: Leipzig Debate at very bottom,
 * Papal Bull on top of it, dealt cards on top.
 * @param {number[]} hand
 * @returns {number[]}
 */
function stackPapacyHand(hand) {
  const PAPAL_BULL = 5;
  const LEIPZIG_DEBATE = 6;

  const nonHome = [];
  let hasPapalBull = false;
  let hasLeipzig = false;

  for (const c of hand) {
    if (c === PAPAL_BULL) { hasPapalBull = true; continue; }
    if (c === LEIPZIG_DEBATE) { hasLeipzig = true; continue; }
    nonHome.push(c);
  }

  // Rebuild: dealt cards on top, Papal Bull, Leipzig Debate at bottom
  const result = [...nonHome];
  if (hasPapalBull) result.push(PAPAL_BULL);
  if (hasLeipzig) result.push(LEIPZIG_DEBATE);

  // Mutate in place
  hand.length = 0;
  hand.push(...result);
  return hand;
}

// ── §2.4 Peace Segment ───────────────────────────────────────────

/**
 * Determine if a Bot power should sue for peace with a given enemy.
 *
 * HISBOT §2.4: Sue for peace if:
 *   - Lost capital (or either capital for Hapsburgs), OR
 *   - Lost more home keys than enemy in the current war
 * Exception: Will NOT sue for peace with power in Behavior Card War field.
 *
 * @param {Object} state
 * @param {string} power - Bot power
 * @param {string} enemy - Enemy to potentially sue
 * @returns {boolean}
 */
export function shouldSueForPeace(state, power, enemy) {
  // Engine rejects SUE_FOR_PEACE on the final turn (diplomacy-actions.js) —
  // skip to avoid wasting a decision on a guaranteed-invalid action.
  const finalTurn = state.finalTurn || 9;
  if (state.turn >= finalTurn) return false;

  // Check behavior card war field — won't sue target of intended war
  const deck = state.botDecks?.[power];
  if (deck) {
    const activeCard = getActiveBehaviorCard(deck);
    if (activeCard && activeCard.war) {
      // War field target — check direct match and minor ally match
      const warTarget = activeCard.war;
      if (warTarget === enemy) return false;
      // Minor power → check if its ally is the enemy
      if (isMinorPower(warTarget)) {
        const minorAlly = getMinorAlly(state, warTarget);
        if (minorAlly === enemy) return false;
      }
    }
  }

  // The engine's validateSueForPeace requires that the SPECIFIC target has
  // either captured a leader of `power` or controls at least one of `power`'s
  // home spaces. Before returning true we gate on this to avoid churning
  // invalid SUE_FOR_PEACE attempts (anomaly #4: France looped on the sue
  // segment because it had lost a key to a third power but not to `enemy`).
  const eligibleVsTarget = hasPeaceEligibleLossTo(state, power, enemy);

  // Check if capital is lost (strategic trigger: sue aggressively)
  const caps = CAPITALS[power] || [];
  for (const cap of caps) {
    const sp = state.spaces[cap];
    if (sp && sp.controller !== power) {
      return eligibleVsTarget;
    }
  }

  // Check home key balance (only counts keys lost to THIS enemy)
  const myLostKeysToTarget = countLostHomeKeysTo(state, power, enemy);
  const enemyLostKeysToMe = countLostHomeKeysTo(state, enemy, power);
  if (myLostKeysToTarget > enemyLostKeysToMe && eligibleVsTarget) return true;

  return false;
}

/**
 * Whether `target` has taken something from `power` that makes the engine's
 * SUE_FOR_PEACE eligibility check pass: captured a leader or controls a home
 * space of `power`.
 */
function hasPeaceEligibleLossTo(state, power, target) {
  const captured = state.capturedLeaders?.[target] || [];
  for (const leaderId of captured) {
    if (isLeaderOfPower(leaderId, power)) return true;
  }
  for (const [spaceName, sp] of Object.entries(state.spaces)) {
    if (!isHomeSpace(spaceName, power)) continue;
    if (sp.controller === target) return true;
  }
  return false;
}

/** Home keys of `power` currently controlled by `target`. */
function countLostHomeKeysTo(state, power, target) {
  let lost = 0;
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.isKey && isHomeSpace(name, power) && sp.controller === target) {
      lost++;
    }
  }
  return lost;
}

/**
 * Count home keys lost by a power (controlled by someone else).
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
function countLostHomeKeys(state, power) {
  let lost = 0;
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.isKey && isHomeSpace(name, power) && sp.controller !== power) {
      lost++;
    }
  }
  return lost;
}

// ── §2.5 Ransom Segment ──────────────────────────────────────────

/**
 * Determine if Bot should ransom a leader.
 *
 * HISBOT §2.5: Ransom if no remaining leaders on map OR ruler captured.
 * Ransom the leader with highest command rating.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ shouldRansom: boolean, leaderId: string|null }}
 */
export function shouldRansomLeader(state, power) {
  const captured = getCapturedLeaders(state, power);
  if (captured.length === 0) return { shouldRansom: false, leaderId: null };

  // Check if ruler is captured
  const ruler = getActiveRuler(state, power);
  const rulerCaptured = ruler && captured.some(l => l.id === ruler.id);

  // Check if no leaders remain on map
  const leadersOnMap = countLeadersOnMap(state, power);

  if (rulerCaptured || leadersOnMap === 0) {
    // Ransom leader with highest command rating
    captured.sort((a, b) => (b.command || 0) - (a.command || 0));
    return { shouldRansom: true, leaderId: captured[0].id };
  }

  return { shouldRansom: false, leaderId: null };
}

/**
 * Get captured leaders for a power.
 * @param {Object} state
 * @param {string} power
 * @returns {Array<{id: string, command: number}>}
 */
function getCapturedLeaders(state, power) {
  if (!state.capturedLeaders) return [];
  const result = [];
  for (const [leaderId, captor] of Object.entries(state.capturedLeaders)) {
    // Leader belongs to this power and is held by someone else
    if (captor !== power && isLeaderOfPower(leaderId, power)) {
      const ldr = getLeaderDef(leaderId);
      result.push({ id: leaderId, command: ldr?.command || 0 });
    }
  }
  return result;
}

/**
 * Check if a leader ID belongs to a power.
 * @param {string} leaderId
 * @param {string} power
 * @returns {boolean}
 */
function isLeaderOfPower(leaderId, power) {
  // Leaders are defined per power in constants/data — use naming convention
  // Leader IDs include power-specific names (suleiman → ottoman, charles_v → hapsburg, etc.)
  const POWER_LEADERS = {
    ottoman: ['suleiman', 'ibrahim'],
    hapsburg: ['charles_v', 'duke_of_alva', 'ferdinand'],
    england: ['henry_viii', 'brandon', 'edward_vi', 'mary_i', 'elizabeth_i'],
    france: ['francis_i', 'henry_ii', 'montmorency'],
    papacy: ['pope'],
    protestant: ['luther', 'philip_of_hesse', 'maurice']
  };
  return (POWER_LEADERS[power] || []).includes(leaderId);
}

/**
 * Count leaders on the map for a power.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
function countLeadersOnMap(state, power) {
  let count = 0;
  for (const sp of Object.values(state.spaces)) {
    if (!sp.units) continue;
    for (const stack of sp.units) {
      if (stack.owner === power && stack.leaders) {
        count += stack.leaders.length;
      }
    }
  }
  return count;
}

/**
 * Simple leader definition lookup.
 * @param {string} leaderId
 * @returns {{ command: number }|null}
 */
function getLeaderDef(leaderId) {
  // Flatten RULERS to find a match
  for (const rulers of Object.values(RULERS)) {
    const r = rulers.find(r => r.id === leaderId);
    if (r) return r;
  }
  return null;
}

// ── §2.6 Excommunication Segment ─────────────────────────────────

/**
 * Excommunicated Bot rulers always grant a card to rescind.
 *
 * HISBOT §2.6: Always grant the Papal player a card.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
export function shouldGrantCardToRescind(state, power) {
  return !!state.excommunicatedRulers?.[power];
}

// ── §2.7 War Declarations ────────────────────────────────────────

/**
 * War Limitation rules per power.
 *
 * HISBOT §4.28:
 *   Ottoman: Always declare war.
 *   Hapsburg: Not France+England at same time. Never Papacy.
 *   England: Only if NOT at war with France or Hapsburgs (but always Scotland).
 *   France: Only if NOT at war with England, Hapsburgs, or Papacy.
 *   Papacy: Not France+Ottomans at same time. Never Hapsburgs.
 *   Protestant: Never declare war.
 */
const WAR_LIMITATIONS = {
  ottoman: (/* state, target */) => true,
  protestant: () => false,
  hapsburg: (state, target) => {
    if (target === 'papacy') return false;
    // Can't be at war with both France and England
    if (target === 'france' && areAtWar(state, 'hapsburg', 'england')) return false;
    if (target === 'england' && areAtWar(state, 'hapsburg', 'france')) return false;
    return true;
  },
  england: (state, target) => {
    if (target === 'scotland') return true; // Always Scotland
    if (areAtWar(state, 'england', 'france')) return false;
    if (areAtWar(state, 'england', 'hapsburg')) return false;
    return true;
  },
  france: (state, target) => {
    if (areAtWar(state, 'france', 'england')) return false;
    if (areAtWar(state, 'france', 'hapsburg')) return false;
    if (areAtWar(state, 'france', 'papacy')) return false;
    return true;
  },
  papacy: (state, target) => {
    if (target === 'hapsburg') return false;
    if (target === 'france' && areAtWar(state, 'papacy', 'ottoman')) return false;
    if (target === 'ottoman' && areAtWar(state, 'papacy', 'france')) return false;
    return true;
  }
};

/**
 * Determine if a Bot power should declare war and on whom.
 *
 * HISBOT §2.7: Declare war on Behavior Card's War field target,
 * subject to War Limitations (§4.28).
 * If war is against a minor power allied with a major → declare on the major.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ shouldDeclare: boolean, target: string|null, isEnglandHomeCard: boolean }}
 */
export function decideWarDeclaration(state, power) {
  const deck = state.botDecks?.[power];
  if (!deck) return { shouldDeclare: false, target: null, isEnglandHomeCard: false };

  const activeCard = getActiveBehaviorCard(deck);
  if (!activeCard || !activeCard.war) {
    return { shouldDeclare: false, target: null, isEnglandHomeCard: false };
  }

  let target = activeCard.war;

  // Minor power → resolve to allied major power
  if (isMinorPower(target)) {
    const majorAlly = getMinorAlly(state, target);
    if (majorAlly) {
      target = majorAlly;
    }
    // If minor is not active, still declare on the minor itself
  }

  // Already at war?
  if (areAtWar(state, power, target)) {
    return { shouldDeclare: false, target: null, isEnglandHomeCard: false };
  }

  // Made peace with this power this turn? Engine rejects re-declaration
  // (diplomacy-actions.js validateDeclareWar → peaceMadeThisTurn). Mirror it.
  if (hasDiploPair(state.peaceMadeThisTurn, power, target)) {
    return { shouldDeclare: false, target: null, isEnglandHomeCard: false };
  }

  // War limitation check
  const canDeclare = WAR_LIMITATIONS[power];
  if (canDeclare && !canDeclare(state, target)) {
    return { shouldDeclare: false, target: null, isEnglandHomeCard: false };
  }

  // England exception: uses Home card in first impulse instead of War Segment
  const isEnglandHomeCard = power === 'england' &&
    ['france', 'hapsburg', 'scotland'].includes(target);

  return { shouldDeclare: true, target, isEnglandHomeCard };
}

/**
 * Calculate CP cost for war declaration and check if Bot can pay.
 *
 * @param {Object} state
 * @param {string} power - Declaring power
 * @param {string} target - Target power
 * @returns {{ canPay: boolean, cost: number }}
 */
export function getWarDeclarationCost(state, power, target) {
  const costs = DOW_COSTS[power];
  if (!costs) return { canPay: false, cost: 0 };
  const cost = costs[target];
  if (cost == null) return { canPay: false, cost: 0 };

  // Bot pays by revealing cards from hand deck
  const hand = state.hands[power] || [];
  let totalCp = 0;
  for (const cardNum of hand) {
    const card = CARD_BY_NUMBER[cardNum];
    if (!card) continue;
    // Skip mandatory events — they don't count
    if (card.deck === 'mandatory_event') continue;
    totalCp += card.cp || 0;
  }

  return { canPay: totalCp >= cost, cost };
}

// ── §2.8 Diet of Worms ──────────────────────────────────────────

/**
 * Pick a card for Diet of Worms.
 *
 * HISBOT §2.8: Flip top card of hand deck.
 * If it's a Mandatory event or 1 CP → ignore it, commit Home card instead.
 * Papacy commits Papal Bull.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ cardNumber: number }|null}
 */
export function pickDietOfWormsCard(state, power) {
  const hand = state.hands[power] || [];
  if (hand.length === 0) return null;

  // Top card = index 0 (after stacking)
  const topCard = hand[0];
  const cardDef = CARD_BY_NUMBER[topCard];

  // If mandatory event or 1 CP → use Home card instead
  if (cardDef && (cardDef.deck === 'mandatory_event' || cardDef.cp <= 1)) {
    // Find Home card (at bottom of hand)
    const homeCard = findHomeCard(hand, power);
    if (homeCard != null) return { cardNumber: homeCard };
  }

  return { cardNumber: topCard };
}

/**
 * Find the Home card in a hand.
 * @param {number[]} hand
 * @param {string} power
 * @returns {number|null}
 */
function findHomeCard(hand, power) {
  for (const c of hand) {
    if (CARD_BY_NUMBER[c]?.deck === 'home') return c;
  }
  return null;
}

// Home card numbers per power (for quick reference)
const HOME_CARDS = {
  ottoman: 1,
  hapsburg: 2,
  england: 3,
  france: 4,
  papacy: 5, // Papal Bull (use for Diet)
  protestant: 7
};

// ── §2.9 Spring Deployment ───────────────────────────────────────

/**
 * Decide spring deployment for a Bot power.
 *
 * HISBOT §2.9:
 * At War: Deploy formation from capital toward enemy key (≤4 spaces away).
 * At Peace: Move single unit to controlled key with fewest units.
 *
 * Returns {actionType, actionData} or null (pass).
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
export function decideSpringDeployment(state, power) {
  const enemies = getWarsOf(state, power);
  const isAtWar = enemies.length > 0 ||
    hasNearbyIndependents(state, power);

  // England exception: if intending to declare war via Home card, treat as at war
  if (power === 'england') {
    const { shouldDeclare, isEnglandHomeCard } = decideWarDeclaration(state, power);
    if (shouldDeclare && isEnglandHomeCard) {
      return decideSpringDeploymentAtWar(state, power);
    }
  }

  if (isAtWar) {
    return decideSpringDeploymentAtWar(state, power);
  } else {
    return decideSpringDeploymentAtPeace(state, power);
  }
}

/**
 * §2.9 At War: Deploy formation from capital toward enemy key.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideSpringDeploymentAtWar(state, power) {
  const caps = CAPITALS[power] || [];
  if (caps.length === 0) return null;

  // Candidate destinations: all controlled spaces within 4 land-hops of any
  // enemy key, sorted by distance ascending. Fall back through the list when
  // the closest target cannot be reached from any eligible capital.
  const dests = findSpringDeploymentDests(state, power);
  if (dests.length === 0) return null;

  // Try each capital in order of spare units, validate path before returning
  const capCandidates = caps
    .map(cap => {
      const sp = state.spaces[cap];
      if (!sp || sp.controller !== power) return null;
      const stack = getUnitsInSpace(state, cap, power);
      if (!stack) return null;
      const total = countLandUnits(stack);
      const garrison = getGarrisonRequirement(state, cap, power);
      const spare = total - garrison;
      return spare > 0 ? { cap, spare, stack } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.spare - a.spare);

  for (const { space: dest } of dests) {
    for (const { cap, spare, stack } of capCandidates) {
      // Cap deployment at formation max (no leader moved) to avoid triggering
      // the "Exceeds formation cap" validator failure when capitals stockpile
      // more than 4 spare regulars.
      const deployCount = Math.min(spare, FORMATION.noLeaderMax);
      const deployUnits = buildDeployUnits(stack, deployCount);
      const actionData = { from: cap, to: dest, units: deployUnits, forPower: power };
      if (validateSpringDeployment(state, power, actionData).valid) {
        return { actionType: ACTION_TYPES.SPRING_DEPLOY, actionData };
      }
    }
  }
  return null;
}

/**
 * §2.9 At Peace: Move single unit to controlled key with fewest units.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideSpringDeploymentAtPeace(state, power) {
  const caps = CAPITALS[power] || [];
  if (caps.length === 0) return null;

  // Find a capital with spare units above garrison
  let sourceCap = null;
  for (const cap of caps) {
    const sp = state.spaces[cap];
    if (!sp || sp.controller !== power) continue;
    const stack = getUnitsInSpace(state, cap, power);
    if (!stack) continue;
    const total = countLandUnits(stack);
    const garrison = getGarrisonRequirement(state, cap, power);
    if (total > garrison) {
      sourceCap = cap;
      break;
    }
  }
  if (!sourceCap) return null;

  // Find controlled key with fewest units (prefer non-home, then farthest)
  let bestKey = null;
  let bestScore = Infinity;

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.isKey || sp.controller !== power) continue;
    if (caps.includes(name)) continue; // Not capital itself
    const stack = getUnitsInSpace(state, name, power);
    const units = stack ? countLandUnits(stack) : 0;
    // Score: fewer units better; non-home preferred (subtract 100)
    const isHome = isHomeSpace(name, power);
    const score = units + (isHome ? 100 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestKey = name;
    }
  }

  if (!bestKey) return null;

  // Build units object: deploy 1 regular (or mercenary if no regulars)
  const stack = getUnitsInSpace(state, sourceCap, power);
  const deployUnits = buildDeployUnits(stack, 1);

  return {
    actionType: ACTION_TYPES.SPRING_DEPLOY,
    actionData: {
      from: sourceCap,
      to: bestKey,
      units: deployUnits,
      forPower: power
    }
  };
}

/**
 * Build a units object { regulars, mercenaries, cavalry, leaders } from a stack,
 * taking up to `count` land units (regulars first, then mercenaries, then cavalry).
 */
function buildDeployUnits(stack, count) {
  const units = { regulars: 0, mercenaries: 0, cavalry: 0, leaders: [] };
  if (!stack) return units;
  let remaining = count;
  const takeRegs = Math.min(remaining, stack.regulars || 0);
  units.regulars = takeRegs;
  remaining -= takeRegs;
  const takeMercs = Math.min(remaining, stack.mercenaries || 0);
  units.mercenaries = takeMercs;
  remaining -= takeMercs;
  const takeCav = Math.min(remaining, stack.cavalry || 0);
  units.cavalry = takeCav;
  return units;
}

/**
 * Find spring deployment destinations — all controlled spaces within 4 land
 * hops of any enemy key, ranked by distance ascending. Multiple candidates
 * are returned so the caller can fall back when the closest target is
 * unreachable from any eligible capital.
 * @param {Object} state
 * @param {string} power
 * @returns {Array<{space: string, dist: number}>}
 */
function findSpringDeploymentDests(state, power) {
  const enemies = getWarsOf(state, power);
  if (enemies.length === 0) return [];

  // Collect enemy key spaces
  const enemyKeys = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.isKey) continue;
    for (const enemy of enemies) {
      if (sp.controller === enemy || isHomeSpace(name, enemy)) {
        enemyKeys.push(name);
        break;
      }
    }
  }
  if (enemyKeys.length === 0) return [];

  // Track best (shortest) distance seen for each controlled candidate space
  const bestByName = new Map();

  for (const ek of enemyKeys) {
    const visited = new Set([ek]);
    const queue = [{ space: ek, dist: 0 }];

    while (queue.length > 0) {
      const { space, dist } = queue.shift();
      if (dist > 4) continue;

      const sp = state.spaces[space];
      if (sp && sp.controller === power && dist > 0) {
        const prev = bestByName.get(space);
        if (prev === undefined || dist < prev) bestByName.set(space, dist);
      }

      const adj = getAdjacentSpaces(space);
      if (!adj) continue;
      for (const next of [...(adj.connections || []), ...(adj.passes || [])]) {
        if (!visited.has(next)) {
          visited.add(next);
          const passCost = (adj.passes || []).includes(next) ? 2 : 1;
          queue.push({ space: next, dist: dist + passCost });
        }
      }
    }
  }

  return Array.from(bestByName.entries())
    .map(([space, dist]) => ({ space, dist }))
    .sort((a, b) => a.dist - b.dist);
}

// ── §2.11 Winter Phase ───────────────────────────────────────────

/**
 * Decide winter actions for a Bot power.
 *
 * The winter phase is mostly automatic (handled by phase-winter.js),
 * but Bots need to make decisions about:
 *   1. Naval unit return destinations (port priority)
 *   2. Land unit return priorities
 *   3. Free unrest removal (§2.11 rule exception)
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ navalReturnPorts: Object[], landReturnSpaces: Object[], unrestRemoval: string|null }}
 */
export function decideWinterActions(state, power) {
  return {
    navalReturnPorts: pickNavalReturnPorts(state, power),
    landReturnSpaces: [], // Winter land return is mostly automatic
    unrestRemoval: pickUnrestRemoval(state, power)
  };
}

/**
 * §2.11: Pick port destinations for returning naval units.
 * Priority: naval leader → fewest fleets → 2 sea zones → key → closest to capital.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Array<{unitType: string, destination: string}>}
 */
function pickNavalReturnPorts(state, power) {
  // Get all ports controlled by this power
  const ports = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.isPort && sp.controller === power) {
      const stack = getUnitsInSpace(state, name, power);
      const squadrons = stack ? (stack.squadrons || 0) : 0;
      const hasNavalLeader = stack?.leaders?.length > 0; // Simplified
      const seaZones = sp.connectedSeaZones?.length || 0;
      ports.push({
        name,
        squadrons,
        hasNavalLeader,
        seaZones,
        isKey: !!sp.isKey
      });
    }
  }

  // Sort by priority: naval leader > fewest fleets > 2 sea zones > key
  ports.sort((a, b) => {
    if (a.hasNavalLeader !== b.hasNavalLeader) return b.hasNavalLeader ? 1 : -1;
    if (a.squadrons !== b.squadrons) return a.squadrons - b.squadrons;
    if (a.seaZones !== b.seaZones) return b.seaZones - a.seaZones;
    if (a.isKey !== b.isKey) return b.isKey ? 1 : -1;
    return 0;
  });

  return ports;
}

/**
 * §2.11: After all returns, Bot removes one unrest marker from
 * home space closest to capital. (Rule exception)
 *
 * @param {Object} state
 * @param {string} power
 * @returns {string|null} Space name to remove unrest, or null
 */
function pickUnrestRemoval(state, power) {
  const caps = CAPITALS[power] || [];
  if (caps.length === 0) return null;

  // Find home spaces with unrest, pick closest to capital
  let best = null;
  let bestDist = Infinity;

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.unrest) continue;
    if (!isHomeSpace(name, power)) continue;
    if (sp.controller !== power) continue;

    // Simple distance: BFS from first capital
    const dist = simpleDistance(state, caps[0], name);
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }

  return best;
}

// ── §2.12 New World Phase ────────────────────────────────────────

/**
 * Choose exploration result when Bot rolls 10+.
 *
 * HISBOT §2.12:
 * If total exploration bonus ≤ +1:
 *   1. Amazon → 2. St. Lawrence → Great Lakes → Mississippi (1 VP) → 3. Circumnavigation
 * If total exploration bonus ≥ +2:
 *   1. Pacific Strait (+ attempt circumnavigation) → 2. Amazon → 3. Circumnavigation
 *
 * @param {Object} state
 * @param {string} power
 * @param {number} totalBonus - Explorer + modifiers total
 * @param {string[]} availableChoices - Available discovery IDs
 * @returns {string|null} Discovery ID to choose
 */
export function pickExplorationChoice(state, power, totalBonus, availableChoices) {
  const available = new Set(availableChoices || []);

  if (totalBonus >= 2) {
    // High bonus priority: Pacific Strait → Amazon → Circumnavigation
    if (available.has('pacific_strait')) return 'pacific_strait';
    if (available.has('amazon')) return 'amazon';
    if (available.has('circumnavigation')) return 'circumnavigation';
  } else {
    // Low bonus priority: Amazon → 1VP discoveries → Circumnavigation
    if (available.has('amazon')) return 'amazon';
    if (available.has('st_lawrence')) return 'st_lawrence';
    if (available.has('great_lakes')) return 'great_lakes';
    if (available.has('mississippi')) return 'mississippi';
    if (available.has('circumnavigation')) return 'circumnavigation';
  }

  // Fallback: first available
  return availableChoices?.[0] || null;
}

// ── §4.10 Garrison Requirements ──────────────────────────────────

/**
 * Calculate garrison requirement for a space.
 *
 * HISBOT §4.10:
 *   Capital: 2 land units
 *   Controlled key/electorate: 1 land unit
 *   Non-key fortification: 0
 *   +1 for each within 2 spaces of enemy land unit
 *
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {number}
 */
export function getGarrisonRequirement(state, spaceName, power) {
  const sp = state.spaces[spaceName];
  if (!sp) return 0;
  if (sp.controller !== power) return 0;
  if (!isFortified(sp)) return 0;

  const caps = CAPITALS[power] || [];
  let base = 0;

  if (caps.includes(spaceName)) {
    base = 2;
  } else if (sp.isKey || sp.isElectorate) {
    base = 1;
  }

  // +1 if within 2 spaces of enemy unit
  if (hasEnemyWithin(state, spaceName, power, 2)) {
    base += 1;
  }

  return base;
}

/**
 * Check if there's an enemy land unit within N spaces.
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @param {number} maxDist
 * @returns {boolean}
 */
function hasEnemyWithin(state, from, power, maxDist) {
  const enemies = getWarsOf(state, power);
  if (enemies.length === 0) return false;

  const visited = new Set([from]);
  const queue = [{ space: from, dist: 0 }];

  while (queue.length > 0) {
    const { space, dist } = queue.shift();
    if (dist > maxDist) continue;

    if (dist > 0) {
      const sp = state.spaces[space];
      if (sp?.units) {
        for (const stack of sp.units) {
          if (enemies.includes(stack.owner) && countLandUnits(stack) > 0) {
            return true;
          }
          // Independent units count as enemy
          if (stack.owner === 'independent' && countLandUnits(stack) > 0) {
            return true;
          }
        }
      }
    }

    const adj = getAdjacentSpaces(space);
    if (!adj) continue;
    for (const next of [...(adj.connections || []), ...(adj.passes || [])]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ space: next, dist: dist + 1 });
      }
    }
  }

  return false;
}

/**
 * Check if a Bot has independent-controlled fortifications within 2 spaces.
 * HISBOT §4.13: Independents treated as enemy.
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
function hasNearbyIndependents(state, power) {
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller !== power || !isFortified(sp)) continue;
    if (hasEnemyWithin(state, name, power, 2)) return true;
  }
  return false;
}

// ── Utility ──────────────────────────────────────────────────────

/**
 * Simple BFS distance between two spaces.
 * Passes count as 2.
 * @param {Object} state
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
function simpleDistance(state, from, to) {
  if (from === to) return 0;

  const visited = new Map([[from, 0]]);
  const queue = [{ space: from, dist: 0 }];

  while (queue.length > 0) {
    const { space, dist } = queue.shift();
    if (space === to) return dist;

    const adj = getAdjacentSpaces(space);
    if (!adj) continue;

    for (const next of (adj.connections || [])) {
      if (!visited.has(next) || visited.get(next) > dist + 1) {
        visited.set(next, dist + 1);
        queue.push({ space: next, dist: dist + 1 });
      }
    }
    for (const next of (adj.passes || [])) {
      if (!visited.has(next) || visited.get(next) > dist + 2) {
        visited.set(next, dist + 2);
        queue.push({ space: next, dist: dist + 2 });
      }
    }
  }

  return Infinity;
}
