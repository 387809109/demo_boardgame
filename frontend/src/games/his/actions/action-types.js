/**
 * Here I Stand — Action Types & Cost Mappings
 */

// ── Card-Level Actions ────────────────────────────────────────────

export const CARD_ACTIONS = {
  PLAY_CARD_CP: 'PLAY_CARD_CP',
  PLAY_CARD_EVENT: 'PLAY_CARD_EVENT',
  PASS: 'PASS',
  PHASE_ADVANCE: 'PHASE_ADVANCE',
  END_IMPULSE: 'END_IMPULSE'
};

// ── CP Sub-Actions (Military) ─────────────────────────────────────

export const MILITARY_ACTIONS = {
  MOVE_FORMATION: 'MOVE_FORMATION',
  RAISE_REGULAR: 'RAISE_REGULAR',
  BUY_MERCENARY: 'BUY_MERCENARY',
  RAISE_CAVALRY: 'RAISE_CAVALRY',
  BUILD_SQUADRON: 'BUILD_SQUADRON',
  BUILD_CORSAIR: 'BUILD_CORSAIR',
  CONTROL_UNFORTIFIED: 'CONTROL_UNFORTIFIED'
};

// ── CP Sub-Actions (Religious) ────────────────────────────────────

export const RELIGIOUS_ACTIONS = {
  PUBLISH_TREATISE: 'PUBLISH_TREATISE',
  TRANSLATE_SCRIPTURE: 'TRANSLATE_SCRIPTURE',
  CALL_DEBATE: 'CALL_DEBATE',
  BUILD_ST_PETERS: 'BUILD_ST_PETERS',
  BURN_BOOKS: 'BURN_BOOKS',
  FOUND_JESUIT: 'FOUND_JESUIT'
};

// ── Sub-Interaction Actions ───────────────────────────────────────

export const SUB_ACTIONS = {
  RESOLVE_REFORMATION_ATTEMPT: 'RESOLVE_REFORMATION_ATTEMPT',
  RESOLVE_DEBATE_STEP: 'RESOLVE_DEBATE_STEP'
};

// ── Combined ACTION_TYPES ─────────────────────────────────────────

export const ACTION_TYPES = {
  ...CARD_ACTIONS,
  ...MILITARY_ACTIONS,
  ...RELIGIOUS_ACTIONS,
  ...SUB_ACTIONS
};

// ── Action → ACTION_COSTS key mapping ─────────────────────────────

export const ACTION_COST_KEY = {
  MOVE_FORMATION: 'move_formation',
  RAISE_REGULAR: 'raise_regular',
  BUY_MERCENARY: 'buy_mercenary',
  RAISE_CAVALRY: 'raise_cavalry',
  BUILD_SQUADRON: 'build_squadron',
  BUILD_CORSAIR: 'build_corsair',
  CONTROL_UNFORTIFIED: 'control_unfortified',
  PUBLISH_TREATISE: 'publish_treatise',
  TRANSLATE_SCRIPTURE: 'translate_scripture',
  CALL_DEBATE: 'call_debate',
  BUILD_ST_PETERS: 'build_st_peters',
  BURN_BOOKS: 'burn_books',
  FOUND_JESUIT: 'found_jesuit'
};

/**
 * Check if an action type is a CP sub-action (requires cpRemaining > 0).
 * @param {string} actionType
 * @returns {boolean}
 */
export function isCpAction(actionType) {
  return actionType in ACTION_COST_KEY;
}

/**
 * Check if an action type is a sub-interaction (during pending state).
 * @param {string} actionType
 * @returns {boolean}
 */
export function isSubAction(actionType) {
  return actionType in SUB_ACTIONS;
}
