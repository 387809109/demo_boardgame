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
 * land space (where the variant's fighting happens). The engine only requires
 * the space to exist; any DE/IT space is a legal, sensible target.
 * @param {Object} state
 * @returns {string|undefined}
 */
function pickInvasionTarget(state) {
  let fallback;
  for (const [name, sp] of Object.entries(state.spaces || {})) {
    if (sp.languageZone === 'german' || sp.languageZone === 'italian') {
      // Prefer a space the bot's opponent religiously holds (a real contest);
      // otherwise keep the first DE/IT space as a fallback.
      fallback = fallback || name;
    }
  }
  return fallback;
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

  // §9: you must always play a card. Honor a #205 forced-play constraint.
  const forced = state.diplomacyForcedPlay;
  const cardNumber = (forced?.side === power && forced.card != null && hand.includes(forced.card))
    ? forced.card
    : hand[0];

  const actionData = { cardNumber };
  if (isInvasionCard(cardNumber)) {
    actionData.targetSpace = pickInvasionTarget(state);
  }
  return { actionType: ACTION_TYPES.PLAY_DIPLOMACY_CARD, actionData };
}
