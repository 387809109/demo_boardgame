/**
 * Here I Stand — Selection Manager
 *
 * Multi-step target selection state machine.
 * When a player clicks an action button, the SelectionManager guides
 * them through selecting spaces, zones, powers, or units on the map.
 *
 * Flow: action button → startFlow() → step-by-step prompts →
 *       onComplete callback with collected data.
 */

import { MAJOR_POWERS, CAPITALS, ACTION_COSTS } from '../constants.js';
import {
  getAdjacentSpaces, getUnitsInSpace, isHomeSpace,
  hasEnemyUnits, isFortified
} from '../state/state-helpers.js';
import { LAND_SPACES } from '../data/map-data.js';

// ── Selection Flow Definitions ────────────────────────────────────

/**
 * Each action type maps to an array of selection steps.
 * Step types:
 *   'space'  — click a space on the map
 *   'zone'   — pick a language zone from a list
 *   'power'  — pick a target power from a list
 *   'units'  — pick unit counts (regulars, mercs, cavalry, leaders)
 */
const SELECTION_FLOWS = {
  // Military
  MOVE_FORMATION: [
    { type: 'space', key: 'from', prompt: '选择出发空间 (有己方部队)' },
    { type: 'space', key: 'to', prompt: '选择目标空间 (相邻空间)' },
    { type: 'units', key: 'units', prompt: '选择移动的部队' }
  ],
  RAISE_REGULAR: [
    { type: 'space', key: 'space', prompt: '选择征募正规军的空间' }
  ],
  BUY_MERCENARY: [
    { type: 'space', key: 'space', prompt: '选择雇佣兵部署的空间' }
  ],
  RAISE_CAVALRY: [
    { type: 'space', key: 'space', prompt: '选择骑兵部署的空间' }
  ],
  BUILD_SQUADRON: [
    { type: 'space', key: 'space', prompt: '选择建造舰队的港口' }
  ],
  BUILD_CORSAIR: [
    { type: 'space', key: 'space', prompt: '选择建造海盗船的港口' }
  ],
  CONTROL_UNFORTIFIED: [
    { type: 'space', key: 'space', prompt: '选择要控制的非堡垒空间' }
  ],
  ASSAULT: [
    { type: 'space', key: 'space', prompt: '选择要突击的被围城空间' }
  ],
  NAVAL_MOVE: [
    { type: 'space', key: 'from', prompt: '选择海军出发港口/海域' },
    { type: 'space', key: 'to', prompt: '选择海军目标港口/海域' }
  ],
  PIRACY: [
    { type: 'space', key: 'seaZone', prompt: '选择海盗行动的海域' }
  ],

  // Religious
  PUBLISH_TREATISE: [
    { type: 'zone', key: 'zone', prompt: '选择发表论文的语言区' }
  ],
  TRANSLATE_SCRIPTURE: [
    { type: 'zone', key: 'zone', prompt: '选择翻译圣经的语言区' }
  ],
  CALL_DEBATE: [
    { type: 'zone', key: 'zone', prompt: '选择召集辩论的语言区' }
  ],
  BURN_BOOKS: [
    { type: 'zone', key: 'zone', prompt: '选择烧书的语言区' }
  ],
  BUILD_ST_PETERS: [],
  FOUND_JESUIT: [
    { type: 'space', key: 'space', prompt: '选择创立耶稣会大学的空间' }
  ],

  // Diplomacy
  DECLARE_WAR: [
    { type: 'power', key: 'targetPower', prompt: '选择宣战目标' }
  ],
  SUE_FOR_PEACE: [
    { type: 'power', key: 'targetPower', prompt: '选择求和目标' }
  ],
  NEGOTIATE: [
    { type: 'power', key: 'targetPower', prompt: '选择谈判目标' }
  ],
  RANSOM_LEADER: [
    { type: 'power', key: 'captor', prompt: '选择关押将领的势力' }
  ],

  // Spring Deployment
  SPRING_DEPLOY: [
    { type: 'space', key: 'from', prompt: '选择出发首都' },
    { type: 'space', key: 'to', prompt: '选择部署目标空间' },
    { type: 'units', key: 'units', prompt: '选择部署的部队' }
  ],

  // Luther 95 / sub-interactions
  SELECT_LUTHER95_TARGET: [
    { type: 'space', key: 'targetSpace', prompt: '选择改革目标空间' }
  ],
  RESOLVE_REFORMATION_ATTEMPT: [
    { type: 'space', key: 'targetSpace', prompt: '选择宗教改革目标空间' }
  ],
  RESOLVE_RETREAT: [
    { type: 'space', key: 'destination', prompt: '选择撤退目的地' }
  ],

  // New World
  EXPLORE: [],
  COLONIZE: [],
  CONQUER: []
};

// ── Valid Target Computations ─────────────────────────────────────

/**
 * Compute valid targets for a given step in a flow.
 * Returns an array of valid space names, zone names, or power names.
 * Returns null if any target is acceptable (no filtering).
 */
function computeValidTargets(state, power, actionType, step, collectedData) {
  const stepType = step.type;
  const stepKey = step.key;

  if (stepType === 'zone') {
    return _getValidZones(state, power, actionType);
  }

  if (stepType === 'power') {
    return _getValidPowers(state, power, actionType);
  }

  if (stepType === 'space') {
    return _getValidSpaces(state, power, actionType, stepKey, collectedData);
  }

  // units type doesn't have spatial targets
  return null;
}

function _getValidZones(state, power, actionType) {
  const allZones = ['german', 'french', 'english', 'italian', 'spanish'];

  if (actionType === 'TRANSLATE_SCRIPTURE') {
    return ['german', 'english', 'french'];
  }
  if (actionType === 'PUBLISH_TREATISE' && power === 'england') {
    return ['english'];
  }
  if (actionType === 'PUBLISH_TREATISE') {
    return allZones;
  }
  if (actionType === 'BURN_BOOKS') {
    return allZones;
  }
  if (actionType === 'CALL_DEBATE') {
    return allZones;
  }
  return allZones;
}

function _getValidPowers(state, power, actionType) {
  return MAJOR_POWERS.filter(p => p !== power);
}

function _getValidSpaces(state, power, actionType, stepKey, collected) {
  switch (actionType) {
    case 'MOVE_FORMATION': {
      if (stepKey === 'from') {
        // Spaces with own units
        return _spacesWithOwnUnits(state, power);
      }
      if (stepKey === 'to') {
        // Adjacent to "from"
        const from = collected.from;
        if (!from) return [];
        const adj = getAdjacentSpaces(from);
        return [...adj.connections, ...adj.passes];
      }
      return null;
    }

    case 'RAISE_REGULAR':
    case 'BUY_MERCENARY':
    case 'RAISE_CAVALRY':
      return _validBuildSpaces(state, power, false);

    case 'BUILD_SQUADRON':
      return _validBuildSpaces(state, power, true);

    case 'BUILD_CORSAIR':
      return _validBuildSpaces(state, power, true);

    case 'CONTROL_UNFORTIFIED':
      return _validControlSpaces(state, power);

    case 'ASSAULT':
      return _validAssaultSpaces(state, power);

    case 'NAVAL_MOVE':
      return null; // Any port or sea zone

    case 'PIRACY':
      return null; // Any sea zone

    case 'FOUND_JESUIT':
      return _validJesuitSpaces(state, power);

    case 'SPRING_DEPLOY': {
      if (stepKey === 'from') {
        return CAPITALS[power] || [];
      }
      if (stepKey === 'to') {
        const from = collected.from;
        if (!from) return [];
        const adj = getAdjacentSpaces(from);
        return adj.connections;
      }
      return null;
    }

    case 'SELECT_LUTHER95_TARGET':
    case 'RESOLVE_REFORMATION_ATTEMPT':
      return _validReformationSpaces(state, power);

    case 'RESOLVE_RETREAT':
      return null; // Computed by game engine, highlight all adjacent

    default:
      return null;
  }
}

function _spacesWithOwnUnits(state, power) {
  const result = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.units) continue;
    const hasOwn = sp.units.some(u => u.owner === power &&
      ((u.regulars || 0) + (u.mercenaries || 0) + (u.cavalry || 0) > 0 ||
        (u.leaders && u.leaders.length > 0)));
    if (hasOwn) result.push(name);
  }
  return result;
}

function _validBuildSpaces(state, power, naval) {
  const result = [];
  for (const space of LAND_SPACES) {
    const sp = state.spaces[space.name];
    if (!sp) continue;
    if (!isHomeSpace(space.name, power)) continue;
    if (sp.controller !== power) continue;
    if (sp.unrest) continue;
    if (hasEnemyUnits(state, space.name, power)) continue;
    if (naval && !sp.isPort) continue;
    result.push(space.name);
  }
  return result;
}

function _validControlSpaces(state, power) {
  const result = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (isFortified(sp)) continue;
    if (sp.controller === power) continue;
    // Must have adjacent own units
    const adj = getAdjacentSpaces(name);
    const hasAdj = adj.connections.some(adjName => {
      const adjSp = state.spaces[adjName];
      return adjSp?.units?.some(u => u.owner === power &&
        ((u.regulars || 0) + (u.mercenaries || 0) + (u.cavalry || 0) > 0));
    });
    if (hasAdj) result.push(name);
  }
  return result;
}

function _validAssaultSpaces(state, power) {
  const result = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.besieged && sp.besiegedBy === power) {
      result.push(name);
    }
  }
  return result;
}

function _validJesuitSpaces(state, power) {
  const result = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.religion === 'catholic' && sp.controller === 'papacy') {
      result.push(name);
    }
  }
  return result;
}

function _validReformationSpaces(state, power) {
  const result = [];
  const isProtestant = power === 'protestant' || power === 'england';
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.religion) continue;
    if (isProtestant && sp.religion === 'catholic') {
      result.push(name);
    } else if (!isProtestant && sp.religion === 'protestant') {
      result.push(name);
    }
  }
  return result;
}

// ── SelectionManager Class ────────────────────────────────────────

export class SelectionManager {
  constructor() {
    /** @type {'idle'|'selecting'} */
    this._mode = 'idle';
    this._actionType = null;
    this._steps = [];
    this._currentStep = 0;
    this._collectedData = {};
    this._validTargets = null;
    this._onComplete = null;
    this._onUpdate = null;
  }

  /** Whether a selection flow is active */
  get active() { return this._mode === 'selecting'; }

  /** Current prompt text to show the user */
  get prompt() {
    if (!this.active) return null;
    const step = this._steps[this._currentStep];
    return step?.prompt || null;
  }

  /** Current step type ('space', 'zone', 'power', 'units') */
  get stepType() {
    if (!this.active) return null;
    return this._steps[this._currentStep]?.type || null;
  }

  /** Valid targets for the current step (array or null) */
  get validTargets() { return this._validTargets; }

  /** The action type being built */
  get actionType() { return this._actionType; }

  /** Data collected so far */
  get collectedData() { return { ...this._collectedData }; }

  /**
   * Start a new selection flow for an action type.
   * @param {string} actionType
   * @param {Object} state - current game state
   * @param {string} power - player's power
   * @param {Function} onComplete - called with { type, data } when done
   * @param {Function} onUpdate - called whenever the selection state changes
   */
  startFlow(actionType, state, power, onComplete, onUpdate) {
    const steps = SELECTION_FLOWS[actionType];

    // No selection needed — emit immediately
    if (!steps || steps.length === 0) {
      onComplete({ actionType, actionData: {} });
      return;
    }

    this._mode = 'selecting';
    this._actionType = actionType;
    this._steps = steps;
    this._currentStep = 0;
    this._collectedData = {};
    this._onComplete = onComplete;
    this._onUpdate = onUpdate;

    // Compute valid targets for step 0
    this._validTargets = computeValidTargets(
      state, power, actionType, steps[0], this._collectedData
    );
    this._notify();
  }

  /**
   * Feed a space click into the selection flow.
   * @param {string} spaceName
   * @param {Object} state
   * @param {string} power
   * @returns {boolean} true if the click was consumed
   */
  onSpaceClicked(spaceName, state, power) {
    if (!this.active) return false;
    const step = this._steps[this._currentStep];
    if (step.type !== 'space') return false;

    // Validate against valid targets
    if (this._validTargets && !this._validTargets.includes(spaceName)) {
      return true; // consumed but invalid — don't propagate
    }

    this._collectedData[step.key] = spaceName;
    this._advanceStep(state, power);
    return true;
  }

  /**
   * Feed a zone selection into the flow.
   * @param {string} zone
   * @param {Object} state
   * @param {string} power
   */
  onZoneSelected(zone, state, power) {
    if (!this.active) return;
    const step = this._steps[this._currentStep];
    if (step.type !== 'zone') return;

    this._collectedData[step.key] = zone;
    this._advanceStep(state, power);
  }

  /**
   * Feed a power selection into the flow.
   * @param {string} targetPower
   * @param {Object} state
   * @param {string} power
   */
  onPowerSelected(targetPower, state, power) {
    if (!this.active) return;
    const step = this._steps[this._currentStep];
    if (step.type !== 'power') return;

    this._collectedData[step.key] = targetPower;
    this._advanceStep(state, power);
  }

  /**
   * Feed a unit selection into the flow.
   * @param {Object} units - { regulars, mercenaries, cavalry, leaders }
   * @param {Object} state
   * @param {string} power
   */
  onUnitsSelected(units, state, power) {
    if (!this.active) return;
    const step = this._steps[this._currentStep];
    if (step.type !== 'units') return;

    this._collectedData[step.key] = units;
    this._advanceStep(state, power);
  }

  /** Cancel the current selection flow */
  cancel() {
    this._mode = 'idle';
    this._actionType = null;
    this._steps = [];
    this._currentStep = 0;
    this._collectedData = {};
    this._validTargets = null;
    this._notify();
  }

  // ── Private ──────────────────────────────────────────────────────

  _advanceStep(state, power) {
    this._currentStep++;

    if (this._currentStep >= this._steps.length) {
      // All steps collected — emit the complete action (engine format)
      const action = {
        actionType: this._actionType,
        actionData: { ...this._collectedData }
      };
      const onComplete = this._onComplete;
      this.cancel(); // reset state
      if (onComplete) onComplete(action);
      return;
    }

    // Compute valid targets for the next step
    const nextStep = this._steps[this._currentStep];
    this._validTargets = computeValidTargets(
      state, power, this._actionType, nextStep, this._collectedData
    );
    this._notify();
  }

  _notify() {
    if (this._onUpdate) this._onUpdate();
  }
}
