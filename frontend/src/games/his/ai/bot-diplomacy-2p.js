/**
 * Here I Stand — Bot: Two-Player Diplomacy Phase (§9)
 *
 * The 3–6p HISBOT only knows the standard segmented Diplomacy phase. The
 * two-player variant replaces it with the Diplomatic-Deck procedure (a
 * Remove-At-War step, then each side plays one card). This MVP handler lets a
 * bot Papacy / Protestant act through that phase legally so an offline vs-AI (or
 * all-bot) 2P game runs to completion. Strategy is intentionally simple.
 */

import { ACTION_TYPES } from '../actions/action-types.js';
import { isInvasionCard } from '../state/diplomacy-deck.js';
import { getDiplomacy2PActor, papalBullTargets } from '../phases/phase-diplomacy-2p.js';

/**
 * Pick a landing space for an Invasion diplomatic card: any German/Italian-zone
 * land space (where the variant's fighting happens). The engine only requires the
 * space to exist; any DE/IT space is legal, and the §11 invader-command goal then
 * advances the activated army toward the opponent from there. (A smarter
 * land-near-the-front heuristic is deferred — it perturbs the bot's trajectory
 * enough to surface unrelated latent quirks for marginal engagement gain.)
 * @param {Object} state
 * @returns {string|undefined}
 */
function pickInvasionTarget(state) {
  for (const [name, sp] of Object.entries(state.spaces || {})) {
    if (sp.languageZone === 'german' || sp.languageZone === 'italian') return name;
  }
  return undefined;
}

/**
 * Which religious side an Invasion card benefits — i.e. whose opponent the
 * activated invader goes to war with. French (#202/#206) and Ottoman (#216)
 * invasions attack the Papacy → help the Protestant; the post-SL Austrian/
 * Imperial invasions (#213/#214) are commanded by the Papacy against the
 * Protestant; the Spanish invasion (#211) flips with the Schmalkaldic League.
 * @param {Object} state
 * @param {number} cardNumber
 * @returns {string|null} 'papacy' | 'protestant' | null (not classified)
 */
function invasionBeneficiary(state, cardNumber) {
  if (cardNumber === 202 || cardNumber === 206 || cardNumber === 216) return 'protestant';
  if (cardNumber === 213 || cardNumber === 214) return 'papacy';
  if (cardNumber === 211) return state.schmalkaldicLeague ? 'papacy' : 'protestant';
  return null;
}

/**
 * Score a diplomatic card for `side` (higher is better to play). §9 forces a play
 * each turn, so the bot picks its best card: a self-beneficial Invasion (activates
 * an invader against the opponent, which the §11 command then uses) outranks a
 * neutral non-invasion, which outranks an Invasion that would help the opponent.
 * @param {Object} state
 * @param {string} side
 * @param {number} cardNumber
 * @returns {number}
 */
function scoreDiplomacyCard(state, side, cardNumber) {
  if (isInvasionCard(cardNumber)) {
    const ben = invasionBeneficiary(state, cardNumber);
    if (ben === side) return 2;
    if (ben && ben !== side) return -2;
    return 1; // unclassified invasion — treat as mildly useful
  }
  return 1; // most non-invasion cards aid the side that plays them
}

/** Pick the highest-scoring card in hand (ties keep hand order, for determinism). */
function bestDiplomacyCard(state, side, hand) {
  let best = hand[0];
  let bestScore = scoreDiplomacyCard(state, side, best);
  for (let i = 1; i < hand.length; i++) {
    const sc = scoreDiplomacyCard(state, side, hand[i]);
    if (sc > bestScore) { best = hand[i]; bestScore = sc; }
  }
  return best;
}

/**
 * Decide a bot move for the two-player Diplomacy phase (§9). Returns a move or
 * null (null lets the engine auto-advance, e.g. Turn 1's deal-only phase).
 * @param {Object} state
 * @param {string} power - the bot power ('papacy' | 'protestant')
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function decideDiplomacy2P(state, power) {
  const d = state.diplomacy2P;
  if (!d) return null;

  // ── Remove-At-War stage (Papacy only) ──────────────────────────────
  if (d.stage === 'remove_war') {
    if (power !== 'papacy') return null;
    // End a France/Hapsburg invasion war with Papal Bull (draw benefit); the bot
    // does not sue for peace (it would hand the Protestant a War-Winner VP).
    const bullTargets = papalBullTargets(state);
    if (bullTargets.length > 0) {
      return {
        actionType: ACTION_TYPES.PAPAL_BULL,
        actionData: { targetPower: bullTargets[0], benefit: 'draw' }
      };
    }
    return { actionType: ACTION_TYPES.END_REMOVE_WAR, actionData: {} };
  }

  // ── Play stage: play one card from the bot's diplomatic hand ────────
  if (getDiplomacy2PActor(state) !== power) return null;
  const hand = state.diplomacyHands?.[power];
  if (!Array.isArray(hand) || hand.length === 0) return null;

  // §9: you must always play a card. Honor a #205 forced-play constraint; else
  // play the card that most benefits this side (see scoreDiplomacyCard).
  const forced = state.diplomacyForcedPlay;
  const cardNumber = (forced?.side === power && forced.card != null && hand.includes(forced.card))
    ? forced.card
    : bestDiplomacyCard(state, power, hand);

  const actionData = { cardNumber };
  if (isInvasionCard(cardNumber)) {
    actionData.targetSpace = pickInvasionTarget(state);
  }
  return { actionType: ACTION_TYPES.PLAY_DIPLOMACY_CARD, actionData };
}
