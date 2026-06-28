/**
 * Here I Stand — Bot Card Play Routing
 *
 * HISBOT §2.10: Action Phase card play decisions.
 *   C1: Card type routing (Home/Event/Mandatory/Combat-Response)
 *   C2: Home card criteria (§6)
 *   C4: Treaty token logic (§2.10.1) + Ganging Up (§2.10.2)
 *   C5: Combat/Response card handling + Saving Cards (§4.25)
 *
 * All functions read state and return {actionType, actionData} — no mutation.
 */

import { CARD_BY_NUMBER } from '../data/cards.js';
import { ACTION_TYPES } from '../actions/action-types.js';
import { CAPITALS, RULERS, MARITAL_STATUS } from '../constants.js';
import { getActiveBehaviorCard } from './behavior-cards.js';
import { areAtWar, canAttack, getWarsOf } from '../state/war-helpers.js';
import { getActiveRuler, countLandUnits, getUnitsInSpace, getAllVpTotals, isHomeSpace, isTwoPlayer } from '../state/state-helpers.js';
import { hasLineOfCommunicationForControl } from '../actions/military-actions.js';
import {
  shouldPlayEvent, satisfiesTreaty, shouldPlayResponse,
  satisfiesResponseTreaty, hasEventCriteria, hasResponseCriteria,
  eventScore, hasEventScore,
  findSackOfRomeSource
} from './bot-event-criteria.js';

// ── Event Scoring Utilities (Phase G1) ────────────────────────────
//
// Phase G migrates the event-vs-CP decision from a boolean `shouldPlay`
// to a continuous score in [0, 1]. `cpUtility` is the CP-side counterpart
// to `eventScore`: a rough estimate of how productively the bot can spend
// this card's CPs on its behavior-card goals right now.
//
// The decision (applied in Phase G2) is:
//     PLAY_CARD_EVENT  iff  eventScore > cpUtility + THRESHOLD
//
// See docs/games/his/BOT_EVENT_SCORING_PLAN.md.

/**
 * Rough saturation of the active behavior card's goal budget for this
 * power: how much of the card's goal.max capacity has already been spent
 * this impulse. Returns 0 (untouched) to 1 (fully consumed).
 *
 * Reads `state.botGoalCounts[power]` and `getActiveBehaviorCard(deck).goals`
 * (both already maintained by the bot controller / dispatcher).
 *
 * @param {Object} state
 * @param {string} power
 * @returns {number} Saturation in [0, 1]
 */
export function computeGoalSaturation(state, power) {
  const deck = state.botDecks?.[power];
  const card = deck ? getActiveBehaviorCard(deck) : null;
  const goals = card?.goals;
  if (!Array.isArray(goals) || goals.length === 0) return 0;

  const counts = state.botGoalCounts?.[power] || {};
  let totalCapacity = 0;
  let totalUsed = 0;
  for (const g of goals) {
    const max = g.max;
    // INF-max goals (Number.POSITIVE_INFINITY) never saturate — skip them
    // from the capacity tally so the ratio stays meaningful.
    if (!Number.isFinite(max) || max <= 0) continue;
    const used = Math.min(counts[g.type] || 0, max);
    totalCapacity += max;
    totalUsed += used;
  }
  if (totalCapacity === 0) return 0;
  return Math.max(0, Math.min(1, totalUsed / totalCapacity));
}

/**
 * Estimate the utility of playing this card for CPs right now, in [0, 1].
 *
 *   baseCpValue  = cp / 8                — 5 CP ≈ 0.625 (intentional head-
 *                                          room: canonical "always play for
 *                                          owner" events at score 1.0 must
 *                                          beat even a max-CP card, and
 *                                          wartime 0.9 events must beat a
 *                                          wartime full-CP card).
 *   saturation   = computeGoalSaturation — goals already spent reduce upside
 *   warBonus     = +0.10 if at war       — combat CPs more valuable than
 *                                          peacetime, but not enough to
 *                                          dominate a 0.9-score wartime
 *                                          event at THRESHOLD 0.05
 *
 * Calibration notes:
 *   Peace max (5 CP, no saturation):  0.625 → score≥0.7 wins
 *   War   max (5 CP, no saturation):  0.725 → score≥0.78 wins
 *   Fully-saturated (any cp):         ≈ 0.0 → any positive score wins
 *
 * Intentionally simple; refinable once more telemetry lands.
 *
 * @param {Object} state
 * @param {string} power
 * @param {number} cardNumber
 * @returns {number} CP utility in [0, 1]
 */
export function cpUtility(state, power, cardNumber) {
  const card = CARD_BY_NUMBER[cardNumber];
  const cp = card?.cp || 0;
  if (cp <= 0) return 0;
  const baseCpValue = Math.min(cp / 8, 0.7);
  const saturation = computeGoalSaturation(state, power);
  const warBonus = getWarsOf(state, power).length > 0 ? 0.10 : 0;
  const raw = baseCpValue * (1 - saturation * 0.6) + warBonus;
  return Math.max(0, Math.min(1, raw));
}

// Re-export for consumers that want the scoring pair from a single module.
export { eventScore };

// ── Home Card Numbers per Power ──────────────────────────────────

const HOME_CARDS = {
  ottoman: 1,    // Janissaries
  hapsburg: 2,   // Holy Roman Emperor
  england: 3,    // Six Wives of Henry VIII
  france: 4,     // Patron of the Arts
  papacy: 5,     // Papal Bull (primary Home card)
  protestant: 7  // Here I Stand
};

/** Papacy's second Home card */
const LEIPZIG_DEBATE = 6;

// ── Card Classification ──────────────────────────────────────────

/**
 * Determine a card's type for Bot routing purposes.
 * @param {number} cardNumber
 * @returns {'home'|'mandatory'|'combat'|'response'|'event'}
 */
export function classifyCard(cardNumber) {
  const card = CARD_BY_NUMBER[cardNumber];
  if (!card) return 'event';

  if (card.deck === 'home') return 'home';
  if (card.category === 'MANDATORY') return 'mandatory';
  if (card.category === 'COMBAT') return 'combat';
  if (card.category === 'RESPONSE') return 'response';
  return 'event';
}

/**
 * Check if a card number is a Home card for the given power.
 * @param {number} cardNumber
 * @param {string} power
 * @returns {boolean}
 */
export function isHomeCardFor(cardNumber, power) {
  if (HOME_CARDS[power] === cardNumber) return true;
  // Papacy also has Leipzig Debate as Home card
  if (power === 'papacy' && cardNumber === LEIPZIG_DEBATE) return true;
  return false;
}

// ── §6 Home Card Criteria ────────────────────────────────────────

/**
 * Determine if the Bot should play its Home card for the event effect
 * and what action to generate. Returns null if should play for CPs.
 *
 * HISBOT §6: Each power has unique Home card behaviors.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function evaluateHomeCard(state, power) {
  const deck = state.botDecks?.[power];
  if (!deck) return null;
  const behaviorCard = getActiveBehaviorCard(deck);

  // If behavior card says "Home: No" → play for CPs
  if (!behaviorCard?.home) return null;

  switch (power) {
    case 'ottoman':
      return evaluateOttomanHome(state);
    case 'hapsburg':
      return evaluateHapsburgHome(state);
    case 'england':
      return evaluateEnglandHome(state);
    case 'france':
      return evaluateFranceHome(state);
    case 'papacy':
      return evaluatePapacyHome(state);
    case 'protestant':
      // Protestant Home is response-only (debate substitution) — never played proactively
      return null;
    default:
      return null;
  }
}

/**
 * Ottoman Home: If < 12 land units in Istanbul, build regulars.
 * (Combat response use handled separately in bot-combat.js)
 */
function evaluateOttomanHome(state) {
  const ottoman = getUnitsInSpace(state, 'Istanbul', 'ottoman');
  const total = ottoman ? countLandUnits(ottoman) : 0;

  if (total < 12) {
    return {
      actionType: ACTION_TYPES.PLAY_CARD_EVENT,
      actionData: {
        cardNumber: HOME_CARDS.ottoman,
        mode: 'recruit',
        placements: [{ space: 'Istanbul', count: 4 }]
      }
    };
  }
  return null; // Play for CPs
}

/**
 * Hapsburg Home: Move Charles V to German zone/Hungary if at war
 * with Ottoman or Protestant and Charles not already there.
 */
function evaluateHapsburgHome(state) {
  const atWarOttoman = areAtWar(state, 'hapsburg', 'ottoman');
  const atWarProt = areAtWar(state, 'hapsburg', 'protestant');

  if (!atWarOttoman && !atWarProt) return null;

  const charlesLocation = findLeaderLocation(state, 'charles_v');
  if (!charlesLocation) return null; // Captured or not on map

  if (isInGermanOrHungaryHome(state, charlesLocation)) return null;

  // Per HISBOT §6: locate a German-zone or Hungary-home space controlled by
  // Hapsburg (or a minor ally) with the most friendly land units (≥ 2).
  const target = pickCharlesVTargetSpace(state);
  if (!target) return null;  // No viable destination → play for CPs

  return {
    actionType: ACTION_TYPES.PLAY_CARD_EVENT,
    actionData: {
      cardNumber: HOME_CARDS.hapsburg,
      homeEffect: 'move_charles',
      targetSpace: target
    }
  };
}

function isInGermanOrHungaryHome(state, spaceName) {
  const space = state.spaces?.[spaceName];
  if (space?.languageZone === 'german') return true;
  return isHomeSpace(spaceName, 'hungary_bohemia');
}

function pickCharlesVTargetSpace(state) {
  let best = null;
  let bestUnits = 1;  // require ≥ 2 units
  for (const [spaceName, space] of Object.entries(state.spaces || {})) {
    const inScope = space?.languageZone === 'german' || isHomeSpace(spaceName, 'hungary_bohemia');
    if (!inScope) continue;
    // Must be controlled by Hapsburg or a minor ally (Hungary counts here)
    const controlledByAlly =
      space.controller === 'hapsburg' ||
      space.controller === 'hungary_bohemia' ||
      space.controller === 'genoa';
    if (!controlledByAlly) continue;
    const friendly = (space.units || []).reduce((sum, u) => {
      if (u.owner === 'hapsburg' || u.owner === 'hungary_bohemia' || u.owner === 'genoa') {
        return sum + countLandUnits(u);
      }
      return sum;
    }, 0);
    if (friendly > bestUnits) {
      bestUnits = friendly;
      best = spaceName;
    }
  }
  return best;
}

/**
 * England Home: War declaration if pending (handled in bot-phases.js §2.7),
 * or advance Marital Status marker if Turn 2+.
 */
function evaluateEnglandHome(state) {
  // Check if England should declare war via Home card (set during war segment)
  if (state.englandHomeCardWar) {
    return {
      actionType: ACTION_TYPES.PLAY_CARD_EVENT,
      actionData: {
        cardNumber: HOME_CARDS.england,
        mode: 'war',
        targetPower: state.englandHomeCardWar
      }
    };
  }

  // Otherwise: advance Marital Status if Turn 2+ and Henry alive + not captured
  // AND the marital track can still advance (engine rejects at the final
  // status — event-actions.js[3] "Cannot advance marital status further").
  if ((state.turn || 1) >= 2) {
    const ruler = getActiveRuler(state, 'england');
    // Unset → initial status (catherine_of_aragon, idx 0); real play always
    // initializes it. Only the final status blocks advancing.
    let maritalIdx = MARITAL_STATUS.indexOf(state.henryMaritalStatus);
    if (maritalIdx === -1) maritalIdx = 0;
    const canAdvanceMarital = maritalIdx < MARITAL_STATUS.length - 1;
    if (ruler?.id === 'henry_viii' && !isLeaderCaptured(state, 'henry_viii') && canAdvanceMarital) {
      return {
        actionType: ACTION_TYPES.PLAY_CARD_EVENT,
        actionData: {
          cardNumber: HOME_CARDS.england,
          mode: 'marital'
        }
      };
    }
  }

  return null;
}

/**
 * Check if a leader (by id) is currently captured by any power.
 * Mirrors the engine's validation in EVENT_HANDLERS[3].validate.
 */
function isLeaderCaptured(state, leaderId) {
  const captured = state.capturedLeaders || {};
  return Object.values(captured).some(
    arr => Array.isArray(arr) && arr.includes(leaderId)
  );
}

/**
 * France Home: Play Chateaux Table roll if modifier won't be -3 or less.
 */
function evaluateFranceHome(state) {
  const ruler = getActiveRuler(state, 'france');
  if (ruler?.id !== 'francis_i') return null; // Only Francis I
  // Engine rejects Patron of the Arts when Francis I is captured
  // (event-actions.js EVENT_HANDLERS[4].validate). Mirror that gate.
  if (isLeaderCaptured(state, 'francis_i')) return null;

  // Calculate Chateau modifier
  const modifier = calculateChateauModifier(state);
  if (modifier <= -3) return null; // Too low

  return {
    actionType: ACTION_TYPES.PLAY_CARD_EVENT,
    actionData: {
      cardNumber: HOME_CARDS.france,
      homeEffect: 'chateau_roll',
      modifier
    }
  };
}

/**
 * Calculate the France Chateau Table modifier.
 */
function calculateChateauModifier(state) {
  let mod = 0;
  // +2 if Milan controlled
  if (state.spaces?.['Milan']?.controller === 'france') mod += 2;
  // +1 if Florence controlled
  if (state.spaces?.['Florence']?.controller === 'france') mod += 1;
  // -1 per home space lost
  for (const [name, sp] of Object.entries(state.spaces || {})) {
    if (sp.homeSpace === 'france' && sp.controller !== 'france') mod -= 1;
  }
  return mod;
}

/**
 * Papacy Home (Papal Bull): Excommunicate reformer or ruler.
 * Also considers Leipzig Debate as secondary Home card.
 */
function evaluatePapacyHome(state) {
  const turn = state.turn || 1;

  // Two-player variant: Papal Bull may only excommunicate a ruler during the
  // Diplomacy Phase (§9, the PAPAL_BULL action) — its standard event is disabled.
  // Returning null routes the home card as CP instead.
  if (isTwoPlayer(state)) return null;

  // Turn 2+: check for ruler excommunication grounds
  if (turn >= 2) {
    // Check if any non-excommunicated ruler has grounds
    for (const power of ['england', 'france', 'hapsburg']) {
      const ruler = getActiveRuler(state, power);
      if (ruler && !state.excommunicated?.[power] &&
          hasExcommunicationGrounds(state, power)) {
        return {
          actionType: ACTION_TYPES.PLAY_CARD_EVENT,
          actionData: {
            cardNumber: HOME_CARDS.papacy,
            homeEffect: 'excommunicate_ruler',
            target: power
          }
        };
      }
    }
  }

  // Excommunicate Luther or Calvin
  const reformerTargets = ['luther', 'calvin'].filter(
    r => !state.excommunicated?.[r] && isReformerAvailable(state, r)
  );

  if (reformerTargets.length > 0) {
    return {
      actionType: ACTION_TYPES.PLAY_CARD_EVENT,
      actionData: {
        cardNumber: HOME_CARDS.papacy,
        homeEffect: 'excommunicate_reformer',
        target: reformerTargets[0]
      }
    };
  }

  return null;
}

/**
 * Check if excommunication grounds exist for a ruler.
 * Simplified: grounds exist if the ruler has taken anti-papal actions.
 */
function hasExcommunicationGrounds(state, power) {
  return !!(state.excommunicationGrounds?.[power]);
}

/**
 * Check if a reformer is available (alive, on map).
 */
function isReformerAvailable(state, reformerId) {
  return !(state.removedReformers || []).includes(reformerId);
}

/**
 * Evaluate Leipzig Debate Home card for Papacy Bot.
 * §6: Only play if >= 2 uncommitted Catholic debaters with debate value >= 2.
 *
 * @param {Object} state
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function evaluateLeipzigDebate(state) {
  const debaters = state.debaters?.papal || [];
  const uncommitted = debaters.filter(d => !d.committed && d.value >= 2);
  if (uncommitted.length < 2) return null;

  return {
    actionType: ACTION_TYPES.PLAY_CARD_EVENT,
    actionData: {
      cardNumber: LEIPZIG_DEBATE,
      homeEffect: 'leipzig_debate'
    }
  };
}

// ── §2.10.1 Treaty Token Logic ───────────────────────────────────

/**
 * Check if the Bot holds any Treaty tokens, and if this card could
 * satisfy the obligation by playing as event for the token power.
 *
 * @param {Object} state
 * @param {string} power - Bot power
 * @param {number} cardNumber
 * @returns {{ shouldPlayForTreaty: boolean, tokenPower: string|null }}
 */
export function checkTreatyObligation(state, power, cardNumber) {
  const tokens = state.treatyTokens?.[power] || [];
  if (tokens.length === 0) return { shouldPlayForTreaty: false, tokenPower: null };

  // Already satisfied this turn?
  if (state.treatySatisfied?.[power]) {
    return { shouldPlayForTreaty: false, tokenPower: null };
  }

  // Check each held token
  for (const tokenPower of tokens) {
    if (satisfiesTreaty(state, power, cardNumber, tokenPower)) {
      return { shouldPlayForTreaty: true, tokenPower };
    }
  }
  return { shouldPlayForTreaty: false, tokenPower: null };
}

// ── §2.10.2 Ganging Up ───────────────────────────────────────────

/**
 * Get powers that are close to winning and should trigger Ganging Up.
 * Powers at >= 21 VPs (or 20 in tournament) AND higher than this Bot.
 *
 * @param {Object} state
 * @param {string} power - Bot power
 * @returns {string[]} Powers being ganged up on
 */
export function getGangingUpTargets(state, power) {
  const threshold = state.tournament ? 20 : 21;
  const vpTotals = getAllVpTotals(state);
  const myVp = vpTotals[power] || 0;
  const targets = [];

  for (const [p, vp] of Object.entries(vpTotals)) {
    if (p !== power && vp >= threshold && vp > myVp) {
      targets.push(p);
    }
  }
  return targets;
}

/**
 * Re-evaluate event criteria as if at war with ganging-up targets.
 *
 * @param {Object} state
 * @param {string} power
 * @param {number} cardNumber
 * @param {string[]} gangTargets
 * @returns {boolean}
 */
export function shouldPlayEventGangingUp(state, power, cardNumber, gangTargets) {
  if (gangTargets.length === 0) return false;

  // Create a virtual state where Bot is at war with gang targets
  const virtualWars = [...(state.wars || [])];
  for (const target of gangTargets) {
    if (!areAtWar(state, power, target)) {
      virtualWars.push({ a: power, b: target });
    }
  }

  const virtualState = { ...state, wars: virtualWars };
  return shouldPlayEvent(virtualState, power, cardNumber);
}

// ── §4.25 Saving Cards ───────────────────────────────────────────

/**
 * Check if Bot should save its remaining Combat/Response cards
 * rather than playing them for CPs.
 *
 * §4.25: If Bot has played all face-down hand cards and remaining
 * set-aside cards <= ruler's Admin Rating → pass and save them.
 * Exception: if any power >= 25 VPs (23 tournament), don't save.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
export function shouldSaveCards(state, power) {
  // Check VP threshold — no saving in endgame
  const vpThreshold = state.tournament ? 23 : 25;
  const vpTotals = getAllVpTotals(state);
  for (const vp of Object.values(vpTotals)) {
    if (vp >= vpThreshold) return false;
  }

  // Count remaining set-aside cards
  const setAside = state.botSetAside?.[power] || [];
  if (setAside.length === 0) return false;

  // Check admin rating
  const ruler = getActiveRuler(state, power);
  const adminRating = ruler?.admin || 0;

  return setAside.length <= adminRating;
}

// ── §2.10.3 Final Autumn Assaults ────────────────────────────────

/**
 * Get free assault actions for Bot at end of Action Phase.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Array<{ actionType: string, actionData: Object }>}
 */
export function getFinalAutumnAssaults(state, power) {
  const actions = [];

  // Free assault on each active siege
  for (const [spaceName, space] of Object.entries(state.spaces || {})) {
    if (!(space.besieged && space.besiegedBy === power)) continue;
    // Same-impulse siege cannot be assaulted
    if (space.siegeEstablishedImpulse === state.turnNumber) continue;
    // Besieger units may have been removed mid-turn (retreat/death) without
    // clearing the besieged flag. Skip stale sieges with no attacker presence.
    if (space.units !== undefined) {
      const besieger = getUnitsInSpace(state, spaceName, power);
      if (!besieger || countLandUnits(besieger) === 0) continue;
    }
    // LOC precheck: engine's validateAssault (siege-actions.js #109)
    // rejects when the besieger has no supply line back to a friendly
    // fortification. Skip up front so we don't queue an autumn-assault
    // the engine will reject. (Mirrors findAssaultTarget in bot-goals.js
    // — the same #H fix needs to apply here too.)
    if (!hasLineOfCommunicationForControl(state, power, spaceName)) continue;
    // §14 port: enemy naval in adjacent sea zone blocks assault
    if (space.isPort && (space.connectedSeaZones || []).length > 0) {
      let blocked = false;
      for (const sz of space.connectedSeaZones) {
        const seaState = state.spaces[sz];
        if (!seaState?.units) continue;
        const enemyNaval = seaState.units.find(u =>
          u.owner !== power && canAttack(state, power, u.owner) &&
          ((u.squadrons || 0) > 0 || (u.corsairs || 0) > 0)
        );
        if (enemyNaval) { blocked = true; break; }
      }
      if (blocked) continue;
    }
    actions.push({
      actionType: ACTION_TYPES.ASSAULT,
      actionData: { target: spaceName, free: true }
    });
  }

  // Free foreign war actions
  const foreignWars = state.activeForeignWars?.[power] || [];
  for (const fw of foreignWars) {
    // Only if friendly units >= enemy units on the card
    if ((fw.friendlyUnits || 0) >= (fw.enemyUnits || 0)) {
      actions.push({
        actionType: ACTION_TYPES.ASSAULT,
        actionData: {
          target: fw.id,
          free: true,
          foreignWar: true
        }
      });
    }
  }

  return actions;
}

// ── Main Card Play Router ────────────────────────────────────────

/**
 * Decide how to play the next card in the Bot's hand.
 *
 * HISBOT §2.10: Flip top card, route by type:
 *   Home → check §6 criteria
 *   Event → check §5 criteria, Treaty, Ganging Up
 *   Mandatory → play event + spend CPs
 *   Combat/Response → set aside or play if criteria met
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function decideCardPlay(state, power) {
  const hand = state.hands?.[power] || [];

  // No cards left — check set-aside cards or pass
  if (hand.length === 0) {
    return handleEmptyHand(state, power);
  }

  // Top card from hand deck
  const cardNumber = hand[0];
  const card = CARD_BY_NUMBER[cardNumber];
  if (!card) {
    return { actionType: ACTION_TYPES.PASS, actionData: {} };
  }

  const cardType = classifyCard(cardNumber);

  switch (cardType) {
    case 'home':
      return routeHomeCard(state, power, cardNumber);

    case 'mandatory':
      return routeMandatoryCard(state, power, cardNumber, card);

    case 'combat':
    case 'response':
      return routeCombatResponseCard(state, power, cardNumber, card);

    case 'event':
    default:
      return routeEventCard(state, power, cardNumber, card);
  }
}

/**
 * Route a Home card: check §6 criteria, play event or CPs.
 */
function routeHomeCard(state, power, cardNumber) {
  // Leipzig Debate special handling for Papacy
  if (power === 'papacy' && cardNumber === LEIPZIG_DEBATE) {
    const leipzigAction = evaluateLeipzigDebate(state);
    if (leipzigAction) return leipzigAction;
    // Can't play Leipzig event → play for CPs
    return {
      actionType: ACTION_TYPES.PLAY_CARD_CP,
      actionData: { cardNumber }
    };
  }

  // evaluateHomeCard always plays the power's OWN home card (HOME_CARDS[power]).
  // But routeHomeCard is reached for ANY 'home'-deck card in hand — e.g. the
  // generic "Here I Stand" (#7) — and the power's home card may already have
  // been played this turn (homeCardPlayed → spliced from hand). Only emit the
  // home-effect action when that card is actually in hand; otherwise play the
  // actually-selected card for CPs. Mirrors the engine's "Card not in hand"
  // guard (index.js) so the bot never routes a phantom home-card event. (#T)
  const homeCardNumber = HOME_CARDS[power];
  if ((state.hands?.[power] || []).includes(homeCardNumber)) {
    const homeAction = evaluateHomeCard(state, power);
    if (homeAction) return homeAction;
  }

  // Home criteria not met (or home card unavailable) → play selected card for CPs
  return {
    actionType: ACTION_TYPES.PLAY_CARD_CP,
    actionData: { cardNumber }
  };
}

/**
 * Whether a mandatory event card can currently be played as its event.
 *
 * Most mandatory cards have no extra preconditions, so they are always
 * playable on their turn. Card 13 (Schmalkaldic League) is the exception:
 * its action-phase event requires Turn 2+ AND 12+ Protestant-religion
 * spaces (event-actions.js#13 validate). Before that it must be held —
 * the engine also auto-fires it in the Winter phase of its dueByTurn
 * (phase-winter.js triggerOverdueMandatoryEvents).
 *
 * @param {Object} state
 * @param {number} cardNumber
 * @returns {boolean}
 */
function isMandatoryEventPlayable(state, cardNumber) {
  if (cardNumber === 13) {
    if ((state.turn || 0) < 2) return false;
    let protSpaces = 0;
    for (const sp of Object.values(state.spaces || {})) {
      if (sp.religion === 'protestant') protSpaces++;
    }
    return protSpaces >= 12;
  }
  return true;
}

/**
 * Route a Mandatory event card: play event, spend remaining CPs on goals.
 * If the event's precondition is not yet met, hold the card (set aside)
 * rather than attempting an event the engine will reject.
 */
function routeMandatoryCard(state, power, cardNumber, card) {
  if (!isMandatoryEventPlayable(state, cardNumber)) {
    return {
      actionType: 'SET_ASIDE_CARD',
      actionData: { cardNumber, reason: 'mandatory_precondition' }
    };
  }
  // Also check §5 for additional criteria
  return {
    actionType: ACTION_TYPES.PLAY_CARD_EVENT,
    actionData: {
      cardNumber,
      mandatory: true,
      remainingCp: card.cp || 0
    }
  };
}

/**
 * Route a Combat/Response card: check §5, set aside or play.
 *
 * §2.10: If listed in §5 with "play immediately" → play now.
 *        If listed with conditions → set aside, play when conditions met.
 *        If not listed → set aside face-up, draw next card.
 */
function routeCombatResponseCard(state, power, cardNumber, card) {
  // Check if §5 says to play immediately
  if (hasEventCriteria(cardNumber) &&
      shouldPlayEvent(state, power, cardNumber)) {
    return {
      actionType: ACTION_TYPES.PLAY_CARD_EVENT,
      actionData: { cardNumber }
    };
  }

  // Set aside face-up — Bot draws next card
  return {
    actionType: 'SET_ASIDE_CARD',
    actionData: { cardNumber, reason: 'combat_response' }
  };
}

/**
 * Route a regular Event card.
 *
 * Step 1: Check §5 — should play event?
 * Step 2: If not → check Treaty obligation (§2.10.1)
 * Step 3: If not → check Ganging Up (§2.10.2)
 * Step 4: Otherwise → play for CPs
 */
/**
 * Threshold for the event-vs-CP comparison. `eventScore` must exceed
 * `cpUtility` by at least this margin to win — biases toward CP when
 * scores are close, which preserves the behavior-card goal pipeline.
 * Calibrated from 2026-04-23 baseline (86/1286 PLAY_CARD_EVENT = 6.7%).
 * See docs/games/his/BOT_EVENT_SCORING_PLAN.md G2.
 */
const EVENT_VS_CP_THRESHOLD = 0.05;

/**
 * Build the actionData payload for a PLAY_CARD_EVENT action, augmenting
 * `{ cardNumber }` with any card-specific fields the engine validators
 * require. Cards that don't need extras (the vast majority) just get
 * `{ cardNumber }` back unchanged.
 *
 * Currently handles:
 *   #95 Sack of Rome — fills `fromSpace` from `findSackOfRomeSource`.
 *     Score function already gates this card to 0 when no source space
 *     exists, so reaching this code with no candidate is unexpected;
 *     defensive fallback returns just `{ cardNumber }`.
 *
 * @param {Object} state
 * @param {number} cardNumber
 * @returns {Object} actionData
 */
export function buildEventActionData(state, cardNumber) {
  const data = { cardNumber };
  if (cardNumber === 95) {
    const fromSpace = findSackOfRomeSource(state);
    if (fromSpace) data.fromSpace = fromSpace;
  }
  return data;
}

/**
 * Pure helper: decide whether to play a card as event or for CPs given
 * pre-computed event/cp scores, the configured randomness, and an RNG.
 *
 * Phase H (D approach) introduces threshold-jitter: instead of a fixed
 * THRESHOLD = 0.05, the actual cutoff is `0.05 + uniform(-r, +r)`. With
 * `r = 0` the jitter is zero so behavior matches Phase G exactly; with
 * `r > 0`, only score-pairs whose gap is within ±r of the deterministic
 * boundary actually flip outcomes — clear-cut decisions stay deterministic.
 *
 * @param {number} eventScore - 0..1
 * @param {number} cpScore - 0..1
 * @param {number} randomness - 0..0.3 (already clamped in state-init)
 * @param {Function} [rng] - RNG returning [0, 1); defaults to Math.random
 * @returns {{ chose: 'event'|'cp', threshold: number }}
 */
export function shouldRouteToEvent(eventScore, cpScore, randomness, rng = Math.random) {
  const r = randomness > 0 ? randomness : 0;
  const jitter = r > 0 ? (rng() - 0.5) * 2 * r : 0;
  const threshold = EVENT_VS_CP_THRESHOLD + jitter;
  return {
    chose: eventScore > cpScore + threshold ? 'event' : 'cp',
    threshold
  };
}

function routeEventCard(state, power, cardNumber, card) {
  // Step 1: §5 criteria for own benefit.
  // Phase G2 adds a scoring-path gate: only cards that have been migrated
  // to an explicit `score` function (G3/G4 work) run through the
  // event-vs-CP score comparison. Unmigrated cards fall through to the
  // legacy boolean `shouldPlayEvent` check to preserve baseline behavior
  // until they're migrated.
  if (hasEventScore(cardNumber)) {
    const es = eventScore(state, power, cardNumber);
    const cs = cpUtility(state, power, cardNumber);
    const r = state.botEventRandomness || 0;
    const { chose, threshold } = shouldRouteToEvent(es, cs, r);
    // Decision telemetry — emits one line per scored card play. Inspect via
    // browser DevTools console (filter "[event-vs-cp]") to debug threshold
    // tuning and per-card score calibration. See HISBOT_REF.md §8.5.
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[event-vs-cp]', power, cardNumber,
        `es=${es.toFixed(2)} cs=${cs.toFixed(2)} threshold=${threshold.toFixed(2)} →`,
        chose, r > 0 ? `(r=${r.toFixed(2)})` : '');
    }
    if (chose === 'event') {
      return {
        actionType: ACTION_TYPES.PLAY_CARD_EVENT,
        actionData: buildEventActionData(state, cardNumber)
      };
    }
  } else if (shouldPlayEvent(state, power, cardNumber)) {
    return {
      actionType: ACTION_TYPES.PLAY_CARD_EVENT,
      actionData: { cardNumber }
    };
  }

  // Step 2: Treaty obligation — first event that could benefit token power
  const treaty = checkTreatyObligation(state, power, cardNumber);
  if (treaty.shouldPlayForTreaty) {
    return {
      actionType: ACTION_TYPES.PLAY_CARD_EVENT,
      actionData: {
        cardNumber,
        forTreaty: true,
        tokenPower: treaty.tokenPower
      }
    };
  }

  // Step 3: Ganging Up
  const gangTargets = getGangingUpTargets(state, power);
  if (gangTargets.length > 0 &&
      shouldPlayEventGangingUp(state, power, cardNumber, gangTargets)) {
    return {
      actionType: ACTION_TYPES.PLAY_CARD_EVENT,
      actionData: {
        cardNumber,
        gangingUp: true,
        targets: gangTargets
      }
    };
  }

  // Step 4: Play for CPs
  return {
    actionType: ACTION_TYPES.PLAY_CARD_CP,
    actionData: { cardNumber }
  };
}

/**
 * Handle empty hand deck: use set-aside cards or pass.
 *
 * §2.10: If face-down hand empty → take from set-aside Combat/Response
 * (in order drawn) and play for CPs. But save them if possible (§4.25).
 */
function handleEmptyHand(state, power) {
  // Check if we should save remaining cards
  if (shouldSaveCards(state, power)) {
    return { actionType: ACTION_TYPES.PASS, actionData: { saving: true } };
  }

  // Use set-aside cards
  const setAside = state.botSetAside?.[power] || [];
  if (setAside.length > 0) {
    const cardNumber = setAside[0];
    return {
      actionType: ACTION_TYPES.PLAY_CARD_CP,
      actionData: { cardNumber, fromSetAside: true }
    };
  }

  // Truly empty — pass
  return { actionType: ACTION_TYPES.PASS, actionData: {} };
}

// ── Response Window Decision ─────────────────────────────────────

/**
 * Decide whether to play a response card during a response window.
 *
 * Checks set-aside Combat/Response cards and evaluates if any should
 * be played based on current game conditions.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function decideResponsePlay(state, power) {
  const setAside = state.botSetAside?.[power] || [];
  // Only play cards the engine will accept in this response window
  const validCards = state.pendingResponse?.validCards || [];

  for (const cardNumber of setAside) {
    // Skip cards not allowed in the current response window
    if (validCards.length > 0 && !validCards.includes(cardNumber)) continue;
    if (shouldPlayResponse(state, power, cardNumber)) {
      return {
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber, fromSetAside: true }
      };
    }
  }

  // Also check Treaty obligation for response cards
  const tokens = state.treatyTokens?.[power] || [];
  for (const tokenPower of tokens) {
    for (const cardNumber of setAside) {
      if (validCards.length > 0 && !validCards.includes(cardNumber)) continue;
      // Check both event criteria treaty and response criteria treaty
      if (satisfiesTreaty(state, power, cardNumber, tokenPower) ||
          satisfiesResponseTreaty(state, power, cardNumber, tokenPower)) {
        return {
          actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
          actionData: { cardNumber, fromSetAside: true, forTreaty: true, tokenPower }
        };
      }
    }
  }

  return {
    actionType: ACTION_TYPES.DECLINE_RESPONSE,
    actionData: {}
  };
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Find the map location of a specific leader.
 * @param {Object} state
 * @param {string} leaderId
 * @returns {string|null} Space name or null
 */
function findLeaderLocation(state, leaderId) {
  for (const [spaceName, space] of Object.entries(state.spaces || {})) {
    for (const unit of space.units || []) {
      for (const leader of unit.leaders || []) {
        const lid = typeof leader === 'string' ? leader : leader.id;
        if (lid === leaderId) return spaceName;
      }
    }
  }
  return null;
}
