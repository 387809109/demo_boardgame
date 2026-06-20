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
import { ACTION_COSTS, IMPULSE_ORDER } from '../constants.js';

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
 * Some actions are additionally hidden via `opts.unavailable` (a Set of action
 * keys) — see {@link unavailableCpActions}. These are actions the cost catalog
 * deems affordable but the engine validators reject on a state precondition
 * (feature not yet unlocked, once-per-turn already used). Offering them lets the
 * human complete a selection flow the engine then silently drops (no effect, no
 * feedback). When `opts.unavailable` is omitted, only the cost-based catalog
 * applies (tests and any caller that doesn't need state gating are unaffected).
 *
 * @param {string} power
 * @param {number} cpRemaining
 * @param {{ unavailable?: Set<string> }} [opts]
 * @returns {{ military: Array<{key:string,cost:number}>,
 *            religious: Array<{key:string,cost:number}>,
 *            newWorld: Array<{key:string,cost:number}> }}
 */
export function cpActionsFor(power, cpRemaining, opts = {}) {
  const costs = ACTION_COSTS[power] || {};
  const unavailable = opts.unavailable || null;
  const pick = (group) => CP_ACTION_CATALOG[group]
    .filter((a) => costs[a.costKey] != null && costs[a.costKey] <= cpRemaining &&
      !(unavailable && unavailable.has(a.key)))
    .map((a) => ({ key: a.key, cost: costs[a.costKey] }));
  return {
    military: pick('military'),
    religious: pick('religious'),
    newWorld: pick('newWorld')
  };
}

/**
 * CP-action keys that are currently unavailable to `power` for state-level
 * reasons the cost catalog cannot express. Keep in sync with the corresponding
 * `validate*` gates — each entry here mirrors an engine precondition that would
 * otherwise reject a menu-offered action with no on-screen feedback:
 *
 *  - PIRACY / BUILD_CORSAIR — before Barbary Pirates (`!piracyEnabled`)
 *    (validatePiracy / validateBuildCorsair).
 *  - FOUND_JESUIT — before Society of Jesus (`!jesuitFoundingEnabled`)
 *    (validateFoundJesuit).
 *  - EXPLORE / COLONIZE / CONQUER — once-per-turn already used by this power
 *    (validateExplore / validateColonize / validateConquer).
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Set<string>}
 */
export function unavailableCpActions(state, power) {
  const out = new Set();
  if (!state) return out;
  if (!state.piracyEnabled) { out.add('PIRACY'); out.add('BUILD_CORSAIR'); }
  if (!state.jesuitFoundingEnabled) out.add('FOUND_JESUIT');
  const nw = state.newWorld;
  if (nw) {
    if (nw.exploredThisTurn?.[power]) out.add('EXPLORE');
    if (nw.colonizedThisTurn?.[power]) out.add('COLONIZE');
    if (nw.conqueredThisTurn?.[power]) out.add('CONQUER');
  }
  return out;
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

// ── Combat-response panel models (P1 backlog item 2) ────────────────
// Pure state→panel descriptors for the historically bug-prone response /
// battle / interception windows. action-panel renders straight from these so
// "which controls appear and what move each emits" has one source of truth and
// can be enumerated in node (W1–W7 × my/not-my response × cards/no-cards, etc.)
// without a live battle. Each control is { label, move } (direct emit) or
// { label, select } (starts a target-selection flow).

/** Window id → short label (响应窗口名). */
export const RESPONSE_WINDOW_LABELS = {
  W1: '佣兵响应',
  W2: '攻方战斗卡',
  W3: '守方战斗卡',
  W4: '禁卫军',
  W5: '攻城炮',
  W6: '划桨手',
  W7: '脉冲中断'
};

/** Window id → one-line hint. */
export const RESPONSE_WINDOW_HINTS = {
  W1: '选择是否打出佣兵卡',
  W2: '选择是否打出战斗卡',
  W3: '选择是否打出战斗卡',
  W4: '奥斯曼可重投',
  W5: '增加突击骰',
  W6: '增加海战骰',
  W7: '响应对手行动'
};

/**
 * Descriptor for the response window panel, or null when none is open.
 * Cards/decline are offered only to the responding power; spectators see a
 * waiting state (isMyResponse=false, empty cards, no decline).
 *
 * @param {Object} state
 * @param {string} playerPower
 * @returns {null | {window, label, hint, respondingPower, isMyResponse,
 *   context, cards: Array<{cardNumber, move}>, canDecline, declineMove}}
 */
export function responsePanelModel(state, playerPower) {
  const resp = state && state.pendingResponse;
  if (!resp) return null;
  const window = resp.window || '?';
  const respondingPower = resp.respondingPower;
  const isMyResponse = respondingPower === playerPower;
  const validCards = isMyResponse ? (resp.validCards || []) : [];
  return {
    window,
    label: RESPONSE_WINDOW_LABELS[window] || window,
    hint: RESPONSE_WINDOW_HINTS[window] || '',
    respondingPower,
    isMyResponse,
    context: resp.context || null,
    cards: validCards.map((n) => ({
      cardNumber: n,
      move: { actionType: 'PLAY_RESPONSE_CARD', actionData: { cardNumber: n } }
    })),
    canDecline: isMyResponse,
    declineMove: isMyResponse
      ? { actionType: 'DECLINE_RESPONSE', actionData: {} }
      : null
  };
}

/**
 * Descriptor for the battle panel, or null when no battle is pending. When the
 * defender may retreat into fortification two choices are offered (退入工事 /
 * 应战); otherwise a single resolve. A post-battle retreat appends a
 * selection-flow control.
 *
 * @param {Object} state
 * @returns {null | {type, space, attackerPower, defenderPower, canWithdraw,
 *   controls: Array<{label, move?, select?}>, needsRetreat}}
 */
export function battlePanelModel(state) {
  const battle = state && state.pendingBattle;
  if (!battle) return null;
  const controls = [];
  if (battle.canWithdraw) {
    controls.push({
      label: '退入工事',
      move: { actionType: 'WITHDRAW_INTO_FORTIFICATION', actionData: { space: battle.space } }
    });
    controls.push({
      label: '应战',
      move: { actionType: 'RESOLVE_BATTLE', actionData: {} }
    });
  } else {
    controls.push({
      label: '解决战斗',
      move: { actionType: 'RESOLVE_BATTLE', actionData: {} }
    });
  }
  if (battle.needsRetreat) {
    controls.push({ label: '撤退到选中空间', select: 'RESOLVE_RETREAT' });
  }
  return {
    type: battle.type === 'field_battle' ? '野战' : '战斗',
    space: battle.space,
    attackerPower: battle.attackerPower,
    defenderPower: battle.defenderPower,
    canWithdraw: !!battle.canWithdraw,
    controls,
    needsRetreat: !!battle.needsRetreat
  };
}

/**
 * Descriptor for the interception panel, or null when none is pending. Offers
 * 尝试拦截 always; 避战 only when the mover may avoid.
 *
 * @param {Object} state
 * @returns {null | {interceptorPower, interceptorSpace, targetSpace,
 *   controls: Array<{label, move}>}}
 */
export function interceptionPanelModel(state) {
  const interc = state && state.pendingInterception;
  if (!interc) return null;
  const controls = [
    { label: '尝试拦截', move: { actionType: 'RESOLVE_INTERCEPTION', actionData: {} } }
  ];
  if (interc.canAvoid) {
    controls.push({ label: '避战', move: { actionType: 'AVOID_BATTLE', actionData: {} } });
  }
  return {
    interceptorPower: interc.interceptorPower,
    interceptorSpace: interc.interceptorSpace,
    targetSpace: interc.targetSpace,
    controls
  };
}

/**
 * Descriptor for the reformation / counter-reformation panel, or null when none
 * is pending. Normalizes the two pendingReformation schemas (type-based from
 * religious-actions, playedBy-based from event-actions) into one contract.
 *
 * @param {Object} state
 * @returns {null | {isReform, title, attemptsLeft, zone, autoFlip,
 *   control: {label, select}}}
 */
export function reformationPanelModel(state) {
  const ref = state && state.pendingReformation;
  if (!ref) return null;
  const isReform = !ref.type || ref.type === 'reformation';
  const attemptsLeft = ref.attemptsLeft ?? ref.attemptsRemaining ?? 0;
  const zone = ref.zone || (ref.zones && ref.zones !== 'all' ? ref.zones : null);
  return {
    isReform,
    title: isReform ? '宗教改革' : '反宗教改革',
    attemptsLeft,
    zone,
    autoFlip: !!ref.autoFlip,
    control: {
      label: ref.autoFlip ? '翻转选中空间' : '掷骰尝试',
      select: 'RESOLVE_REFORMATION_ATTEMPT'
    }
  };
}

/**
 * Descriptor for the theological debate panel, or null when none is pending.
 * Surfaces the round/phase and (once rolled) the hit tallies; the single
 * control advances the debate step.
 *
 * @param {Object} state
 * @returns {null | {round, phase, phaseLabel, hasRolls, attackerHits,
 *   defenderHits, control: {label, move}}}
 */
export function debatePanelModel(state) {
  const debate = state && state.pendingDebate;
  if (!debate) return null;
  const phaseLabel = debate.phase === 'roll' ? '掷骰'
    : debate.phase === 'resolve' ? '结算' : debate.phase;
  return {
    round: debate.round,
    phase: debate.phase,
    phaseLabel,
    hasRolls: !!debate.attackerRolls,
    attackerHits: debate.attackerHits,
    defenderHits: debate.defenderHits,
    control: {
      label: '继续',
      move: { actionType: 'RESOLVE_DEBATE_STEP', actionData: {} }
    }
  };
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
 * Which single power the status UI should present as "currently acting" (the
 * ▶ / "[BOT] 思考中" badge).
 *
 * `state.activePower` is only maintained for the impulse-ordered phases
 * (action / spring_deployment / luther_95). The segment-based phases
 * (diplomacy, diet_of_worms) never update it, so a naive `state.activePower`
 * read shows whoever last set it — e.g. the Protestant bot from Luther's 95
 * Theses — together with a misleading "[BOT] 思考中" badge while it is in fact
 * the human's turn to act in the diplomacy segment. Derive the real actor from
 * the same per-phase turn model as {@link isActionPanelActive}: the first power
 * in impulse order that may still act.
 *
 * @param {Object} state
 * @returns {string|null} the acting power, or null if none is currently waiting
 */
export function getActivePower(state) {
  if (!state) return null;
  if (state.phase === 'diplomacy') {
    return IMPULSE_ORDER.find(p => canActInSegment(state, p)) || null;
  }
  if (state.phase === 'diet_of_worms') {
    return IMPULSE_ORDER.find(
      p => state.pendingDietOfWorms?.cards?.[p] == null
    ) || null;
  }
  return state.activePower || null;
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
