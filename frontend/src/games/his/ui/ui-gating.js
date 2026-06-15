/**
 * Here I Stand — UI Gating (pure render-contract decisions)
 *
 * Single source of truth for "given this state, what may this power do in the
 * UI". These were previously duplicated inline across ui.js (two `canPlay`
 * sites) and action-panel.js — divergence there caused real bugs (e.g. hand
 * cards being unclickable during the Diet of Worms, 2026-06-15 UI test).
 *
 * Every function is pure (state + power → value) so the full UI-interaction
 * surface can be enumerated and asserted in a node-env coverage test
 * (ui-gating.test.js), mirroring the engine's gate-parity coverage approach.
 */

import { canActInSegment } from '../phases/phase-diplomacy.js';

/**
 * May `power` select/play a hand card right now?
 *
 * True when: a response window is open for this power, OR it is this power's
 * action-phase impulse, OR the Diet of Worms is awaiting this power's card.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
export function handCanPlay(state, power) {
  if (!state || !power) return false;
  if (state.pendingResponse && state.pendingResponse.respondingPower === power) {
    return true;
  }
  if (state.phase === 'action' && state.activePower === power) {
    return true;
  }
  if (state.phase === 'diet_of_worms' && state.pendingDietOfWorms &&
      state.pendingDietOfWorms.cards[power] == null) {
    return true;
  }
  return false;
}

/**
 * Should the action panel show controls for `power` (vs "等待对手行动")?
 *
 * Assumes no response window is open (the panel renders the response UI first;
 * see action-panel.update). Mirrors the per-phase active check:
 *  - diplomacy: power may still act in the current segment
 *  - diet_of_worms: power has not yet submitted a card
 *  - otherwise: it is this power's active impulse
 *
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
export function isActionPanelActive(state, power) {
  if (!state || !power) return false;
  if (state.phase === 'diplomacy') return canActInSegment(state, power);
  if (state.phase === 'diet_of_worms') {
    return state.pendingDietOfWorms?.cards[power] == null;
  }
  return state.activePower === power;
}

/**
 * Which panel the action panel renders for `power`, as a single key. Encodes
 * the full routing/precedence in action-panel.update so it can be asserted
 * exhaustively. Returns one of:
 *   'response' | 'waiting' | 'reformation' | 'debate' | 'battle' |
 *   'interception' | <phase string>
 *
 * @param {Object} state
 * @param {string} power
 * @returns {string}
 */
export function activePanelKey(state, power) {
  if (state.pendingResponse) {
    // Response UI renders regardless of active power; clickability of cards is
    // further gated by validCards inside the hand panel.
    return 'response';
  }
  if (!isActionPanelActive(state, power)) return 'waiting';
  if (state.pendingReformation) return 'reformation';
  if (state.pendingDebate) return 'debate';
  if (state.pendingBattle) return 'battle';
  if (state.pendingInterception) return 'interception';
  return state.phase;
}
