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
import { ACTION_COSTS } from '../constants.js';

/**
 * Canonical catalog of CP-spend actions, grouped as the action panel renders
 * them (军事 / 宗教 / 新世界). Each entry maps the engine action `key` to its
 * `costKey` in ACTION_COSTS. This is the single source of truth for *which*
 * actions exist per group; presentation (label/icon) lives in action-panel.js.
 *
 * Per-power availability is fully data-driven: an action shows only when its
 * cost for that power is non-null. That gate (previously triplicated inline in
 * action-panel `_renderCpActions`) is enumerated by `cpActionsFor` below so the
 * "what may this power do" contract can be asserted exhaustively in node.
 */
export const CP_ACTION_CATALOG = {
  military: [
    { key: 'MOVE_FORMATION', costKey: 'move_formation' },
    { key: 'RAISE_REGULAR', costKey: 'raise_regular' },
    { key: 'BUY_MERCENARY', costKey: 'buy_mercenary' },
    { key: 'RAISE_CAVALRY', costKey: 'raise_cavalry' },
    { key: 'BUILD_SQUADRON', costKey: 'build_squadron' },
    { key: 'BUILD_CORSAIR', costKey: 'build_corsair' },
    { key: 'NAVAL_MOVE', costKey: 'naval_move' },
    { key: 'CONTROL_UNFORTIFIED', costKey: 'control_unfortified' },
    { key: 'ASSAULT', costKey: 'assault' },
    { key: 'PIRACY', costKey: 'initiate_piracy' }
  ],
  religious: [
    { key: 'PUBLISH_TREATISE', costKey: 'publish_treatise' },
    { key: 'TRANSLATE_SCRIPTURE', costKey: 'translate_scripture' },
    { key: 'CALL_DEBATE', costKey: 'call_debate' },
    { key: 'BUILD_ST_PETERS', costKey: 'build_st_peters' },
    { key: 'BURN_BOOKS', costKey: 'burn_books' },
    { key: 'FOUND_JESUIT', costKey: 'found_jesuit' }
  ],
  newWorld: [
    { key: 'EXPLORE', costKey: 'explore' },
    { key: 'COLONIZE', costKey: 'colonize' },
    { key: 'CONQUER', costKey: 'conquer' }
  ]
};

/**
 * Which CP-spend actions `power` may take with `cpRemaining` points, grouped as
 * the action panel renders them. An action qualifies when its cost for that
 * power is defined (non-null) and affordable (≤ cpRemaining).
 *
 * @param {string} power
 * @param {number} cpRemaining
 * @returns {{ military: Array<{key:string,cost:number}>,
 *            religious: Array<{key:string,cost:number}>,
 *            newWorld: Array<{key:string,cost:number}> }}
 */
export function cpActionsFor(power, cpRemaining) {
  const costs = ACTION_COSTS[power] || {};
  const pick = (group) => CP_ACTION_CATALOG[group]
    .filter((a) => costs[a.costKey] != null && costs[a.costKey] <= cpRemaining)
    .map((a) => ({ key: a.key, cost: costs[a.costKey] }));
  return {
    military: pick('military'),
    religious: pick('religious'),
    newWorld: pick('newWorld')
  };
}

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
