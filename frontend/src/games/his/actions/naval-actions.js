/**
 * Here I Stand — Naval Movement, Combat & Piracy
 *
 * Naval move (1 CP, batch all stacks), naval combat resolution,
 * and Ottoman piracy.
 */

import {
  ACTION_COSTS, NAVAL_COMBAT, IMPULSE_ORDER, MAJOR_POWERS, PIRACY_VP_TRACK
} from '../constants.js';
import { spendCp } from './cp-manager.js';
import { getUnitsInSpace } from '../state/state-helpers.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { SEA_ZONES, SEA_EDGES, PORTS_BY_SEA_ZONE } from '../data/map-data.js';
import { rollDice } from './religious-actions.js';
import { canAttack } from '../state/war-helpers.js';

const SEA_EDGE_SET = (() => {
  const edges = new Set();
  for (const { a, b } of SEA_EDGES) {
    edges.add(`${a}|${b}`);
    edges.add(`${b}|${a}`);
  }
  return edges;
})();

const SEA_ADJACENCY = (() => {
  const adj = {};
  for (const seaZone of SEA_ZONES) adj[seaZone] = [];
  for (const { a, b } of SEA_EDGES) {
    if (adj[a]) adj[a].push(b);
    if (adj[b]) adj[b].push(a);
  }
  return adj;
})();

const PORT_SET = new Set(Object.values(PORTS_BY_SEA_ZONE).flat());
const KNIGHTS_FORTRESS_SPACES = new Set(['Rhodes', 'Malta']);
const MAX_PIRACY_VP = PIRACY_VP_TRACK.length - 1;

function isSeaZoneLocation(name) {
  return SEA_ZONES.includes(name);
}

function isPortLocation(state, name) {
  if (PORT_SET.has(name)) return true;
  return Boolean(state.spaces[name]?.isPort);
}

function hasNavalUnits(stack) {
  if (!stack) return false;
  return (stack.squadrons || 0) > 0 || (stack.corsairs || 0) > 0;
}

function hasNavalAssets(stack) {
  if (!stack) return false;
  if (hasNavalUnits(stack)) return true;
  return (stack.leaders || []).some(lid => LEADER_BY_ID[lid]?.type === 'naval');
}

function isNavalLeaderId(leaderId) {
  return LEADER_BY_ID[leaderId]?.type === 'naval';
}

function ensureTurnTrackState(state) {
  state.turnTrack = state.turnTrack || {};
  if (!Array.isArray(state.turnTrack.navalUnits)) state.turnTrack.navalUnits = [];
  if (!Array.isArray(state.turnTrack.navalLeaders)) state.turnTrack.navalLeaders = [];
  return state.turnTrack;
}

function getReturnTurn(state) {
  const currentTurn = Number.isInteger(state.turn) ? state.turn : 1;
  return currentTurn + 1;
}

function addNavalUnitTurnTrackEntry(state, power, type, count, source, space) {
  if (!count || count <= 0) return;
  const turnTrack = ensureTurnTrackState(state);
  turnTrack.navalUnits.push({
    power,
    type,
    count,
    returnTurn: getReturnTurn(state),
    source,
    space
  });
}

function addNavalLeaderTurnTrackEntry(state, power, leaderId, source, space) {
  const turnTrack = ensureTurnTrackState(state);
  turnTrack.navalLeaders.push({
    power,
    leaderId,
    returnTurn: getReturnTurn(state),
    source,
    space
  });
}

function addNavalLossesToTurnTrack(state, power, losses, source, space) {
  addNavalUnitTurnTrackEntry(
    state, power, 'squadron', losses?.squadrons || 0, source, space
  );
  addNavalUnitTurnTrackEntry(
    state, power, 'corsair', losses?.corsairs || 0, source, space
  );
}

function moveEliminatedNavalLeadersToTurnTrack(state, stack, power, source, space) {
  if (!stack) return [];
  const leaders = stack.leaders || [];
  const navalLeaders = leaders.filter(isNavalLeaderId);
  if (navalLeaders.length === 0) return [];

  stack.leaders = leaders.filter(lid => !isNavalLeaderId(lid));
  for (const leaderId of navalLeaders) {
    addNavalLeaderTurnTrackEntry(state, power, leaderId, source, space);
  }
  return navalLeaders;
}

function isAtWarWithOwner(state, power, otherOwner) {
  if (!otherOwner || otherOwner === power || otherOwner === 'independent') return false;
  return canAttack(state, power, otherOwner);
}

function getNavalNeighbors(state, location) {
  if (isSeaZoneLocation(location)) {
    return [...(SEA_ADJACENCY[location] || []), ...(PORTS_BY_SEA_ZONE[location] || [])];
  }
  if (isPortLocation(state, location)) {
    return getConnectedSeaZones(state, location);
  }
  return [];
}

function hasEnemyNavalPresence(state, location, power) {
  const sp = state.spaces[location];
  if (!sp || !sp.units) return false;
  return sp.units.some(
    stack => hasNavalUnits(stack) && isAtWarWithOwner(state, power, stack.owner)
  );
}

function getNavalLeaderBattleBonus(stack) {
  let best = 0;
  for (const lid of stack?.leaders || []) {
    const leader = LEADER_BY_ID[lid];
    if (leader?.type === 'naval' && leader.battle > best) {
      best = leader.battle;
    }
  }
  return best;
}

function getRoll2d6WithBonus(bonus = 0) {
  const dice = rollDice(2);
  const total = (dice[0] || 0) + (dice[1] || 0) + bonus;
  return { dice, total };
}

function getSeaRetreatOptions(state, fromSpace, retreatPower) {
  const seaOptions = isSeaZoneLocation(fromSpace)
    ? [...(SEA_ADJACENCY[fromSpace] || [])]
    : getConnectedSeaZones(state, fromSpace);
  return seaOptions.filter(seaZone => !hasEnemyNavalPresence(state, seaZone, retreatPower));
}

function getPortRetreatOptionsFromSea(state, seaZone, retreatPower) {
  const ports = PORTS_BY_SEA_ZONE[seaZone] || [];
  return ports.filter(portName => {
    const sp = state.spaces[portName];
    if (!sp) return false;
    if (sp.controller !== retreatPower) return false;
    return !hasEnemyNavalPresence(state, portName, retreatPower);
  });
}

function eliminateNavalAssets(state, space, power, helpers, reason) {
  const stack = getUnitsInSpace(state, space, power);
  if (!stack) return;

  const squadrons = stack.squadrons || 0;
  const corsairs = stack.corsairs || 0;
  const navalLeaders = (stack.leaders || []).filter(isNavalLeaderId);

  addNavalLossesToTurnTrack(
    state,
    power,
    { squadrons, corsairs },
    'naval_retreat_elimination',
    space
  );
  for (const leaderId of navalLeaders) {
    addNavalLeaderTurnTrackEntry(
      state,
      power,
      leaderId,
      'naval_retreat_elimination',
      space
    );
  }

  stack.squadrons = 0;
  stack.corsairs = 0;
  stack.leaders = (stack.leaders || []).filter(lid => !isNavalLeaderId(lid));

  if (
    (stack.regulars || 0) === 0 &&
    (stack.mercenaries || 0) === 0 &&
    (stack.cavalry || 0) === 0 &&
    (stack.squadrons || 0) === 0 &&
    (stack.corsairs || 0) === 0 &&
    (stack.leaders || []).length === 0
  ) {
    const sp = state.spaces[space];
    if (sp?.units) {
      sp.units = sp.units.filter(u => u !== stack);
    }
  }

  helpers.logEvent(state, 'naval_retreat_eliminated', {
    power,
    space,
    reason,
    squadrons,
    corsairs,
    navalLeaders: navalLeaders.length
  });
}

function executeNavalRetreat(state, battleSpace, retreatPower, inPortBattle, helpers) {
  const stack = getUnitsInSpace(state, battleSpace, retreatPower);
  if (!stack || !hasNavalAssets(stack)) {
    return { retreated: false, eliminated: false };
  }

  let options = [];
  if (inPortBattle) {
    options = getSeaRetreatOptions(state, battleSpace, retreatPower);
  } else {
    options = [
      ...getPortRetreatOptionsFromSea(state, battleSpace, retreatPower),
      ...getSeaRetreatOptions(state, battleSpace, retreatPower)
    ];
  }

  if (options.length === 0) {
    eliminateNavalAssets(state, battleSpace, retreatPower, helpers, 'no_legal_destination');
    return { retreated: false, eliminated: true };
  }

  const destination = options[0];
  moveNavalStack(state, battleSpace, destination, retreatPower);
  helpers.logEvent(state, 'naval_retreat', {
    power: retreatPower,
    from: battleSpace,
    to: destination,
    inPortBattle
  });
  return { retreated: true, destination };
}

function tryNavalInterceptions(state, movingPower, destination, from, helpers) {
  if (!isSeaZoneLocation(destination)) {
    return { success: false };
  }

  const neighboringLocations = getNavalNeighbors(state, destination);
  const candidates = [];

  for (const location of neighboringLocations) {
    if (location === from) continue;
    if (hasNavalUnits(getUnitsInSpace(state, location, movingPower))) continue;

    const sp = state.spaces[location];
    if (!sp || !sp.units) continue;

    for (const stack of sp.units) {
      if (!hasNavalUnits(stack)) continue;
      if (!isAtWarWithOwner(state, movingPower, stack.owner)) continue;
      candidates.push({ power: stack.owner, location });
    }
  }

  candidates.sort((a, b) =>
    IMPULSE_ORDER.indexOf(a.power) - IMPULSE_ORDER.indexOf(b.power)
  );

  for (const candidate of candidates) {
    const stack = getUnitsInSpace(state, candidate.location, candidate.power);
    if (!hasNavalUnits(stack)) continue;

    const bonus = getNavalLeaderBattleBonus(stack);
    const { dice, total } = getRoll2d6WithBonus(bonus);
    const success = total >= 9;
    helpers.logEvent(state, 'naval_interception_attempt', {
      power: candidate.power,
      from: candidate.location,
      to: destination,
      dice,
      bonus,
      total,
      success
    });

    if (!success) continue;

    moveNavalStack(state, candidate.location, destination, candidate.power);
    helpers.logEvent(state, 'naval_interception_success', {
      power: candidate.power,
      from: candidate.location,
      to: destination
    });
    return { success: true, interceptorPower: candidate.power };
  }

  return { success: false };
}

function tryNavalEvades(state, movingPower, destination, helpers) {
  if (!isSeaZoneLocation(destination)) return;

  const sp = state.spaces[destination];
  if (!sp || !sp.units) return;

  const enemyPowers = [...new Set(
    sp.units
      .filter(stack => hasNavalUnits(stack) && isAtWarWithOwner(state, movingPower, stack.owner))
      .map(stack => stack.owner)
  )].sort((a, b) => IMPULSE_ORDER.indexOf(a) - IMPULSE_ORDER.indexOf(b));

  for (const enemyPower of enemyPowers) {
    const stack = getUnitsInSpace(state, destination, enemyPower);
    if (!hasNavalUnits(stack)) continue;

    const options = [
      ...getPortRetreatOptionsFromSea(state, destination, enemyPower),
      ...getSeaRetreatOptions(state, destination, enemyPower)
    ];
    if (options.length === 0) {
      helpers.logEvent(state, 'naval_evade_attempt', {
        power: enemyPower,
        from: destination,
        success: false,
        reason: 'no_legal_destination'
      });
      continue;
    }

    const bonus = getNavalLeaderBattleBonus(stack);
    const { dice, total } = getRoll2d6WithBonus(bonus);
    const success = total >= 9;
    const destinationChoice = options[0];

    helpers.logEvent(state, 'naval_evade_attempt', {
      power: enemyPower,
      from: destination,
      to: destinationChoice,
      dice,
      bonus,
      total,
      success
    });

    if (!success) continue;

    moveNavalStack(state, destination, destinationChoice, enemyPower);
    helpers.logEvent(state, 'naval_evade_success', {
      power: enemyPower,
      from: destination,
      to: destinationChoice
    });
  }
}

function resolveNavalCombatSequence(state, movingPower, destination, helpers) {
  const defenderInPort = isPortLocation(state, destination);

  while (true) {
    const attacker = getUnitsInSpace(state, destination, movingPower);
    if (!hasNavalUnits(attacker)) break;

    const sp = state.spaces[destination];
    const enemyPowers = [...new Set(
      (sp?.units || [])
        .filter(stack => hasNavalUnits(stack) && isAtWarWithOwner(state, movingPower, stack.owner))
        .map(stack => stack.owner)
    )].sort((a, b) => IMPULSE_ORDER.indexOf(a) - IMPULSE_ORDER.indexOf(b));

    if (enemyPowers.length === 0) break;

    const defenderPower = enemyPowers[0];
    const result = resolveNavalCombat(
      state, destination, movingPower, defenderPower, defenderInPort, helpers
    );
    if (result.error) break;

    const retreatPower = defenderInPort ? movingPower : result.loserPower;
    executeNavalRetreat(state, destination, retreatPower, defenderInPort, helpers);

    if (defenderInPort || retreatPower === movingPower) {
      break;
    }
  }
}

function violatesAtlanticRestriction(stack, to) {
  if (to !== 'Atlantic Ocean') return false;
  const owner = stack?.owner;
  if (owner === 'genoa' || owner === 'venice') return true;
  return (stack?.leaders || []).includes('andrea_doria');
}

function ensureSpaceRecord(state, name) {
  if (state.spaces[name]) return state.spaces[name];
  const isSea = isSeaZoneLocation(name);
  const sp = {
    controller: null,
    religion: 'other',
    unrest: false,
    units: [],
    isKey: false,
    isElectorate: false,
    isFortress: false,
    isPort: !isSea && PORT_SET.has(name),
    languageZone: null,
    connectedSeaZones: [],
    besieged: false,
    besiegedBy: null,
    siegeEstablishedImpulse: null,
    siegeEstablishedTurn: null,
    siegeEstablishedCardNumber: null,
    siegeEstablishedBy: null
  };
  state.spaces[name] = sp;
  return sp;
}

function getConnectedSeaZones(state, portName) {
  const seen = new Set();
  for (const seaZone of SEA_ZONES) {
    if (PORTS_BY_SEA_ZONE[seaZone]?.includes(portName)) seen.add(seaZone);
  }
  const stateSp = state.spaces[portName];
  for (const seaZone of stateSp?.connectedSeaZones || []) {
    seen.add(seaZone);
  }
  return [...seen];
}

function targetControlsConnectedPort(state, seaZone, targetPower) {
  return (PORTS_BY_SEA_ZONE[seaZone] || []).some(
    portName => state.spaces[portName]?.controller === targetPower
  );
}

function getPiracyAdjacentLocations(state, seaZone) {
  return [...new Set(getNavalNeighbors(state, seaZone))];
}

function isWarContributorAgainstOttoman(state, owner) {
  if (!owner || owner === 'ottoman') return false;
  return canAttack(state, 'ottoman', owner);
}

function countAntiPiracyZoneSquadronDice(state, seaZone, targetPower) {
  const stack = getUnitsInSpace(state, seaZone, targetPower);
  return (stack?.squadrons || 0) * 2;
}

function countAntiPiracyAdjacentSquadronDice(state, seaZone, targetPower) {
  let dice = 0;
  const adjacent = getPiracyAdjacentLocations(state, seaZone);

  for (const loc of adjacent) {
    const sp = state.spaces[loc];
    if (!sp?.units) continue;
    for (const stack of sp.units) {
      const owner = stack.owner;
      if (owner !== targetPower && !isWarContributorAgainstOttoman(state, owner)) continue;
      dice += stack.squadrons || 0;
    }
  }

  return dice;
}

function isKnightsFortress(spaceName, controller) {
  if (controller === 'knights_of_st_john') return true;
  return controller === 'independent' && KNIGHTS_FORTRESS_SPACES.has(spaceName);
}

function countAntiPiracyFortressDice(state, seaZone, targetPower) {
  let dice = 0;

  for (const [spaceName, sp] of Object.entries(state.spaces)) {
    if (!sp?.isFortress) continue;
    if (sp.isKey) continue;
    if (sp.unrest || sp.besieged) continue;
    if (!(sp.connectedSeaZones || []).includes(seaZone)) continue;

    const controller = sp.controller;
    const eligibleByControl = controller === targetPower;
    const eligibleByWar = isWarContributorAgainstOttoman(state, controller);
    const eligibleByKnights = isKnightsFortress(spaceName, controller);

    if (eligibleByControl || eligibleByWar || eligibleByKnights) {
      dice++;
    }
  }

  return dice;
}

function getPiracyBaseDice(state, seaZone, targetPower, corsairsRemaining) {
  if (corsairsRemaining <= 0) return 0;
  const connectedTargetPorts = (PORTS_BY_SEA_ZONE[seaZone] || []).filter(
    portName => state.spaces[portName]?.controller === targetPower
  ).length;
  if (corsairsRemaining === 1 || connectedTargetPorts <= 1) return 1;
  return 2;
}

function getPiracySquadronRemovalOptions(state, seaZone, targetPower) {
  const options = [seaZone, ...getPiracyAdjacentLocations(state, seaZone)];
  return options.filter((loc, idx, arr) => {
    if (arr.indexOf(loc) !== idx) return false;
    const stack = getUnitsInSpace(state, loc, targetPower);
    return (stack?.squadrons || 0) > 0;
  });
}

function removeOneSquadron(state, space, power) {
  const stack = getUnitsInSpace(state, space, power);
  if (!stack || (stack.squadrons || 0) <= 0) return false;
  stack.squadrons -= 1;

  if (
    (stack.regulars || 0) === 0 &&
    (stack.mercenaries || 0) === 0 &&
    (stack.cavalry || 0) === 0 &&
    (stack.squadrons || 0) === 0 &&
    (stack.corsairs || 0) === 0 &&
    (stack.leaders || []).length === 0
  ) {
    const sp = state.spaces[space];
    if (sp?.units) {
      sp.units = sp.units.filter(u => u !== stack);
    }
  }

  return true;
}

function drawRandomCard(state, fromPower, toPower) {
  const hand = state.hands?.[fromPower];
  if (!Array.isArray(hand) || hand.length === 0) return null;
  const idx = Math.floor(Math.random() * hand.length);
  const card = hand.splice(idx, 1)[0];
  state.hands[toPower] = state.hands[toPower] || [];
  state.hands[toPower].push(card);
  return card;
}

function getPiracyHitChoices(state, seaZone, targetPower) {
  const choices = [];
  if (getPiracySquadronRemovalOptions(state, seaZone, targetPower).length > 0) {
    choices.push('eliminate_squadron');
  }
  if ((state.hands?.[targetPower] || []).length > 0) {
    choices.push('give_card');
  }
  if ((state.piracyTrack || 0) < MAX_PIRACY_VP) {
    choices.push('give_vp');
  }
  return choices;
}

function extractPlannedPiracyHit(planEntry) {
  if (!planEntry) return { choice: null, space: null };
  if (typeof planEntry === 'string') return { choice: planEntry, space: null };
  return { choice: planEntry.choice || null, space: planEntry.space || null };
}

function validateNavalLeg(state, from, to) {
  const fromSea = isSeaZoneLocation(from);
  const toSea = isSeaZoneLocation(to);
  const fromPort = isPortLocation(state, from);
  const toPort = isPortLocation(state, to);

  if ((!fromSea && !fromPort) || (!toSea && !toPort)) {
    return { valid: false, error: 'Naval movement must be between sea zones and ports' };
  }
  if (fromPort && toPort) {
    return { valid: false, error: 'Cannot move naval units directly port-to-port' };
  }

  if (fromSea && toSea) {
    if (!SEA_EDGE_SET.has(`${from}|${to}`)) {
      return { valid: false, error: 'Sea zones are not adjacent' };
    }
    return { valid: true };
  }

  if (fromSea && toPort) {
    const connected = getConnectedSeaZones(state, to);
    if (!connected.includes(from)) {
      return { valid: false, error: 'Destination port is not adjacent to source sea zone' };
    }
    return { valid: true };
  }

  if (fromPort && toSea) {
    const connected = getConnectedSeaZones(state, from);
    if (!connected.includes(to)) {
      return { valid: false, error: 'Destination sea zone is not adjacent to source port' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Invalid naval movement' };
}

// ── Naval Movement ──────────────────────────────────────────────

/**
 * Validate a naval movement action (1 CP, moves all eligible stacks).
 * @param {Object} state
 * @param {string} power
 * @param {Object} [actionData]
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNavalMove(state, power, actionData = {}) {
  const cost = ACTION_COSTS[power]?.naval_move;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot perform naval movement' };
  }
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  const { movements } = actionData;
  if (movements === undefined) {
    return { valid: true };
  }
  if (!Array.isArray(movements) || movements.length === 0) {
    return { valid: false, error: 'Naval movement requires at least one move leg' };
  }

  const sim = JSON.parse(JSON.stringify(state.spaces));

  for (const mv of movements) {
    const from = mv?.from;
    const to = mv?.to;
    if (!from || !to) {
      return { valid: false, error: 'Each naval move must include from and to' };
    }
    if (from === to) {
      return { valid: false, error: 'Naval movement origin and destination must differ' };
    }

    const leg = validateNavalLeg({ spaces: sim }, from, to);
    if (!leg.valid) return leg;

    const fromSpace = sim[from];
    const srcStack = fromSpace?.units?.find(u => u.owner === power);
    if (!hasNavalAssets(srcStack)) {
      return { valid: false, error: `No naval units to move from ${from}` };
    }
    if (violatesAtlanticRestriction(srcStack, to)) {
      return {
        valid: false,
        error: 'Genoa/Venice naval units and Andrea Doria cannot enter Atlantic Ocean'
      };
    }

    if (isPortLocation({ spaces: sim }, to)) {
      const toSpace = sim[to];
      const controller = toSpace?.controller;
      if (controller && controller !== power) {
        const hasEnemyNaval = (toSpace?.units || []).some(
          u => u.owner !== power && hasNavalUnits(u)
        );
        if (!hasEnemyNaval) {
          return {
            valid: false,
            error: 'Can only enter non-friendly controlled port if enemy naval units are present'
          };
        }
      }
    }

    if (!sim[to]) {
      sim[to] = {
        controller: null,
        units: [],
        isPort: isPortLocation({ spaces: sim }, to),
        connectedSeaZones: []
      };
    }
    if (!sim[to].units) sim[to].units = [];

    let dstStack = sim[to].units.find(u => u.owner === power);
    if (!dstStack) {
      dstStack = {
        owner: power,
        regulars: 0,
        mercenaries: 0,
        cavalry: 0,
        squadrons: 0,
        corsairs: 0,
        leaders: []
      };
      sim[to].units.push(dstStack);
    }

    dstStack.squadrons += srcStack.squadrons || 0;
    dstStack.corsairs += srcStack.corsairs || 0;
    srcStack.squadrons = 0;
    srcStack.corsairs = 0;
    srcStack.leaders = srcStack.leaders || [];
    dstStack.leaders = dstStack.leaders || [];
    const navalLeaders = srcStack.leaders.filter(lid => LEADER_BY_ID[lid]?.type === 'naval');
    for (const lid of navalLeaders) {
      srcStack.leaders = srcStack.leaders.filter(id => id !== lid);
      dstStack.leaders.push(lid);
    }

    if (
      (srcStack.regulars || 0) === 0 &&
      (srcStack.mercenaries || 0) === 0 &&
      (srcStack.cavalry || 0) === 0 &&
      (srcStack.squadrons || 0) === 0 &&
      (srcStack.corsairs || 0) === 0 &&
      (srcStack.leaders || []).length === 0
    ) {
      fromSpace.units = fromSpace.units.filter(u => u !== srcStack);
    }
  }

  return { valid: true };
}

/**
 * Execute naval movement — move squadrons/corsairs between sea zones
 * and ports.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { movements: [{ from, to }] }
 * @param {Object} helpers
 */
export function executeNavalMove(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].naval_move;
  spendCp(state, cost);

  const { movements = [] } = actionData;
  for (const { from, to } of movements) {
    const interception = tryNavalInterceptions(state, power, to, from, helpers);
    moveNavalStack(state, from, to, power);
    if (!interception.success) {
      tryNavalEvades(state, power, to, helpers);
    }
    resolveNavalCombatSequence(state, power, to, helpers);
  }

  state.impulseActions.push({ type: 'naval_move', movements });
  helpers.logEvent(state, 'naval_move', { power, movements });
}

/**
 * Move a naval stack (squadrons/corsairs) between spaces.
 */
function moveNavalStack(state, from, to, power) {
  ensureSpaceRecord(state, from);
  ensureSpaceRecord(state, to);

  const srcStack = getUnitsInSpace(state, from, power);
  if (!hasNavalAssets(srcStack)) return;
  if (violatesAtlanticRestriction(srcStack, to)) return;

  let dstStack = getUnitsInSpace(state, to, power);
  if (!dstStack) {
    dstStack = {
      owner: power, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    state.spaces[to].units.push(dstStack);
  }

  dstStack.squadrons += srcStack.squadrons;
  dstStack.corsairs += srcStack.corsairs;
  srcStack.squadrons = 0;
  srcStack.corsairs = 0;

  // Move naval leaders
  const navalLeaders = srcStack.leaders.filter(lid => {
    const l = LEADER_BY_ID[lid];
    return l && l.type === 'naval';
  });
  for (const lid of navalLeaders) {
    const idx = srcStack.leaders.indexOf(lid);
    if (idx !== -1) {
      srcStack.leaders.splice(idx, 1);
      dstStack.leaders.push(lid);
    }
  }

  // Remove empty stack
  if (srcStack.regulars === 0 && srcStack.mercenaries === 0 &&
      srcStack.cavalry === 0 && srcStack.squadrons === 0 &&
      srcStack.corsairs === 0 && srcStack.leaders.length === 0) {
    const sp = state.spaces[from];
    sp.units = sp.units.filter(u => u !== srcStack);
  }
}

// ── Naval Combat ────────────────────────────────────────────────

/**
 * Get the highest naval leader battle rating.
 * @param {string[]} leaderIds
 * @returns {number}
 */
function getNavalLeaderRating(leaderIds) {
  let best = 0;
  for (const lid of leaderIds) {
    const leader = LEADER_BY_ID[lid];
    if (leader && leader.type === 'naval' && leader.battle > best) {
      best = leader.battle;
    }
  }
  return best;
}

function retainOneNavalUnit(stack, beforeCombat) {
  if ((beforeCombat.squadrons || 0) > 0) {
    stack.squadrons = 1;
    return;
  }
  if ((beforeCombat.corsairs || 0) > 0) {
    stack.corsairs = 1;
    return;
  }
  stack.squadrons = 1;
}

/**
 * Resolve naval combat between two powers in a space (port or sea zone).
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {boolean} defenderInPort
 * @param {Object} helpers
 * @returns {Object} Naval combat result
 */
export function resolveNavalCombat(state, space, attackerPower,
  defenderPower, defenderInPort, helpers) {
  const attackerStack = getUnitsInSpace(state, space, attackerPower);
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  if (!attackerStack || !defenderStack) {
    return { error: 'Both sides must have naval units' };
  }

  const attackerBefore = {
    squadrons: attackerStack.squadrons || 0,
    corsairs: attackerStack.corsairs || 0
  };
  const defenderBefore = {
    squadrons: defenderStack.squadrons || 0,
    corsairs: defenderStack.corsairs || 0
  };

  // Attacker dice: 2/squadron + 1/corsair + naval leader
  const attSquadDice = attackerStack.squadrons * NAVAL_COMBAT.dicePerSquadron;
  const attCorsDice = attackerStack.corsairs * NAVAL_COMBAT.dicePerCorsair;
  const attLeaderBonus = getNavalLeaderRating(attackerStack.leaders);
  let attackerDice = attSquadDice + attCorsDice + attLeaderBonus;
  attackerDice = Math.max(attackerDice, 1);

  // Defender dice: same + port bonus
  const defSquadDice = defenderStack.squadrons * NAVAL_COMBAT.dicePerSquadron;
  const defCorsDice = defenderStack.corsairs * NAVAL_COMBAT.dicePerCorsair;
  const defLeaderBonus = getNavalLeaderRating(defenderStack.leaders);
  let defenderDice = defSquadDice + defCorsDice + defLeaderBonus;
  if (defenderInPort) defenderDice += NAVAL_COMBAT.portDefenderBonusDice;
  defenderDice = Math.max(defenderDice, 1);

  // Roll
  const attackerRolls = rollDice(attackerDice);
  const defenderRolls = rollDice(defenderDice);

  const attackerHits = attackerRolls.filter(
    d => d >= NAVAL_COMBAT.hitThreshold).length;
  const defenderHits = defenderRolls.filter(
    d => d >= NAVAL_COMBAT.hitThreshold).length;

  // Winner: tie = defender
  let winner, winnerPower, loserPower;
  if (attackerHits > defenderHits) {
    winner = 'attacker';
    winnerPower = attackerPower;
    loserPower = defenderPower;
  } else {
    winner = 'defender';
    winnerPower = defenderPower;
    loserPower = attackerPower;
  }

  // Apply naval casualties: 1 squadron per 2 hits
  const attSquadLoss = Math.floor(defenderHits / NAVAL_COMBAT.hitsPerSquadronLost);
  const defSquadLoss = Math.floor(attackerHits / NAVAL_COMBAT.hitsPerSquadronLost);

  applyNavalCasualties(attackerStack, attSquadLoss, defenderHits);
  applyNavalCasualties(defenderStack, defSquadLoss, attackerHits);

  // Odd hit against loser eliminates 1 extra squadron
  const loserStack = loserPower === attackerPower ? attackerStack : defenderStack;
  const hitsVsLoser = loserPower === attackerPower ? defenderHits : attackerHits;
  if (hitsVsLoser % 2 === 1 && loserStack.squadrons > 0) {
    loserStack.squadrons--;
  }

  let retainedPower = null;
  const attackerEliminated = attackerStack.squadrons === 0 && attackerStack.corsairs === 0;
  const defenderEliminated = defenderStack.squadrons === 0 && defenderStack.corsairs === 0;
  if (attackerEliminated && defenderEliminated) {
    const defenderRetains = defenderDice >= attackerDice;
    const stackToRetain = defenderRetains ? defenderStack : attackerStack;
    const beforeCombat = defenderRetains ? defenderBefore : attackerBefore;
    retainOneNavalUnit(stackToRetain, beforeCombat);
    retainedPower = defenderRetains ? defenderPower : attackerPower;
  }

  const attackerLosses = {
    squadrons: Math.max(0, (attackerBefore.squadrons || 0) - (attackerStack.squadrons || 0)),
    corsairs: Math.max(0, (attackerBefore.corsairs || 0) - (attackerStack.corsairs || 0))
  };
  const defenderLosses = {
    squadrons: Math.max(0, (defenderBefore.squadrons || 0) - (defenderStack.squadrons || 0)),
    corsairs: Math.max(0, (defenderBefore.corsairs || 0) - (defenderStack.corsairs || 0))
  };
  addNavalLossesToTurnTrack(
    state, attackerPower, attackerLosses, 'naval_combat_casualties', space
  );
  addNavalLossesToTurnTrack(
    state, defenderPower, defenderLosses, 'naval_combat_casualties', space
  );

  let attackerLeadersToTurnTrack = [];
  let defenderLeadersToTurnTrack = [];
  if ((attackerStack.squadrons || 0) === 0 && (attackerStack.corsairs || 0) === 0) {
    attackerLeadersToTurnTrack = moveEliminatedNavalLeadersToTurnTrack(
      state, attackerStack, attackerPower, 'naval_combat_elimination', space
    );
  }
  if ((defenderStack.squadrons || 0) === 0 && (defenderStack.corsairs || 0) === 0) {
    defenderLeadersToTurnTrack = moveEliminatedNavalLeadersToTurnTrack(
      state, defenderStack, defenderPower, 'naval_combat_elimination', space
    );
  }

  // Clean up empty stacks
  const sp = state.spaces[space];
  sp.units = sp.units.filter(u =>
    u.regulars > 0 || u.mercenaries > 0 || u.cavalry > 0 ||
    u.squadrons > 0 || u.corsairs > 0 || u.leaders.length > 0
  );

  const result = {
    winner,
    winnerPower,
    loserPower,
    attackerDice,
    defenderDice,
    attackerRolls,
    defenderRolls,
    attackerHits,
    defenderHits,
    retainedPower,
    attackerLosses,
    defenderLosses,
    attackerLeadersToTurnTrack,
    defenderLeadersToTurnTrack
  };

  helpers.logEvent(state, 'naval_combat', { space, ...result });
  return result;
}

/**
 * Apply naval casualties to a stack.
 * @param {Object} stack
 * @param {number} squadronLoss
 * @param {number} totalHits - Total hits received (for corsair overflow)
 */
function applyNavalCasualties(stack, squadronLoss, totalHits) {
  const actualSquadLoss = Math.min(squadronLoss, stack.squadrons);
  stack.squadrons -= actualSquadLoss;

  // Remaining hits after squadron losses hit corsairs (Ottoman)
  const hitsUsedOnSquads = actualSquadLoss * NAVAL_COMBAT.hitsPerSquadronLost;
  const remainingHits = totalHits - hitsUsedOnSquads;
  if (remainingHits > 0 && stack.corsairs > 0) {
    const corsairLoss = Math.min(remainingHits, stack.corsairs);
    stack.corsairs -= corsairLoss;
  }
}

// ── Piracy ──────────────────────────────────────────────────────

/**
 * Validate a piracy action (Ottoman only, 2 CP, once per sea zone per turn).
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { seaZone, targetPower }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePiracy(state, power, actionData) {
  if (power !== 'ottoman') {
    return { valid: false, error: 'Only Ottoman can perform piracy' };
  }
  if (!state.piracyEnabled) {
    return { valid: false, error: 'Cannot initiate piracy before Barbary Pirates is in play' };
  }

  const { seaZone, targetPower } = actionData;
  if (!seaZone) return { valid: false, error: 'Missing sea zone' };
  if (!targetPower) return { valid: false, error: 'Missing target power' };
  if (!SEA_ZONES.includes(seaZone)) {
    return { valid: false, error: 'Invalid sea zone' };
  }
  if (!MAJOR_POWERS.includes(targetPower) || targetPower === 'ottoman') {
    return { valid: false, error: 'Piracy target must be a non-Ottoman major power' };
  }
  if (!targetControlsConnectedPort(state, seaZone, targetPower)) {
    return { valid: false, error: 'Target power must control a port connected to this sea zone' };
  }

  const cost = ACTION_COSTS[power]?.initiate_piracy;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot perform piracy' };
  }
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  // Once per sea zone per turn
  if (state.piracyUsed[seaZone]) {
    return { valid: false, error: 'Already used piracy in this sea zone this turn' };
  }

  // Must have corsairs in the sea zone
  const stack = getUnitsInSpace(state, seaZone, power);
  if (!stack || stack.corsairs === 0) {
    return { valid: false, error: 'No corsairs in this sea zone' };
  }

  return { valid: true };
}

/**
 * Execute a piracy action.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { seaZone, targetPower }
 * @param {Object} helpers
 * @returns {Object} Piracy result
 */
export function executePiracy(state, power, actionData, helpers) {
  const { seaZone, targetPower, hitChoices = [] } = actionData;
  const cost = ACTION_COSTS[power].initiate_piracy;
  spendCp(state, cost);

  const stack = getUnitsInSpace(state, seaZone, power);
  const antiPiracyZoneDice = countAntiPiracyZoneSquadronDice(state, seaZone, targetPower);
  const antiPiracyAdjacentDice = countAntiPiracyAdjacentSquadronDice(state, seaZone, targetPower);
  const antiPiracyFortressDice = countAntiPiracyFortressDice(state, seaZone, targetPower);
  const antiPiracyDice = antiPiracyZoneDice + antiPiracyAdjacentDice + antiPiracyFortressDice;
  const antiPiracyRolls = antiPiracyDice > 0 ? rollDice(antiPiracyDice) : [];
  const antiPiracyHits = antiPiracyRolls.filter(
    d => d >= NAVAL_COMBAT.hitThreshold).length;

  // Remove corsairs hit by anti-piracy
  const corsairsBefore = stack?.corsairs || 0;
  if (stack) {
    stack.corsairs = Math.max(0, stack.corsairs - antiPiracyHits);
  }
  const corsairsAfterAntiPiracy = stack?.corsairs || 0;

  // Piracy roll (base 1 or 2 dice by 16.4 + piracy rating)
  const basePiracyDice = getPiracyBaseDice(
    state, seaZone, targetPower, corsairsAfterAntiPiracy
  );
  let piracyDice = basePiracyDice;
  for (const lid of stack?.leaders || []) {
    const leader = LEADER_BY_ID[lid];
    if (leader && leader.piracy) piracyDice += leader.piracy;
  }
  piracyDice = Math.max(piracyDice, 0);

  const piracyRolls = piracyDice > 0 ? rollDice(piracyDice) : [];
  const piracyHits = piracyRolls.filter(
    d => d >= NAVAL_COMBAT.hitThreshold).length;

  let squadronsEliminated = 0;
  let cardsStolen = 0;
  let piracyVpAwarded = 0;
  const piracyHitResolutions = [];
  const defaultChoiceOrder = ['eliminate_squadron', 'give_vp', 'give_card'];

  for (let i = 0; i < piracyHits; i++) {
    const { choice: plannedChoice, space: plannedSpace } = extractPlannedPiracyHit(hitChoices[i]);
    const orderedChoices = [];
    if (plannedChoice) orderedChoices.push(plannedChoice);
    for (const c of defaultChoiceOrder) {
      if (!orderedChoices.includes(c)) orderedChoices.push(c);
    }

    let resolved = false;
    for (const choice of orderedChoices) {
      const available = getPiracyHitChoices(state, seaZone, targetPower);
      if (!available.includes(choice)) continue;

      if (choice === 'eliminate_squadron') {
        const options = getPiracySquadronRemovalOptions(state, seaZone, targetPower);
        const selectedSpace = options.includes(plannedSpace) ? plannedSpace : options[0];
        if (!selectedSpace || !removeOneSquadron(state, selectedSpace, targetPower)) continue;
        squadronsEliminated++;
        piracyHitResolutions.push({ choice, space: selectedSpace });
        resolved = true;
        break;
      }

      if (choice === 'give_card') {
        const cardNumber = drawRandomCard(state, targetPower, 'ottoman');
        if (cardNumber == null) continue;
        cardsStolen++;
        piracyHitResolutions.push({ choice, cardNumber });
        resolved = true;
        break;
      }

      if (choice === 'give_vp') {
        if ((state.piracyTrack || 0) >= MAX_PIRACY_VP) continue;
        state.piracyTrack = Math.min(MAX_PIRACY_VP, (state.piracyTrack || 0) + 1);
        piracyVpAwarded++;
        piracyHitResolutions.push({ choice, piracyTrack: state.piracyTrack });
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      piracyHitResolutions.push({ choice: 'none' });
    }
  }

  // Mark used
  state.piracyUsed[seaZone] = true;

  const result = {
    antiPiracyZoneDice,
    antiPiracyAdjacentDice,
    antiPiracyFortressDice,
    antiPiracyDice,
    antiPiracyRolls,
    antiPiracyHits,
    corsairsLost: corsairsBefore - corsairsAfterAntiPiracy,
    corsairsRemaining: corsairsAfterAntiPiracy,
    basePiracyDice,
    piracyDice,
    piracyRolls,
    piracyHits,
    piracyHitResolutions,
    squadronsEliminated,
    cardsStolen,
    piracyVpAwarded,
    piracyTrack: state.piracyTrack
  };

  state.impulseActions.push({ type: 'piracy', seaZone, targetPower });
  helpers.logEvent(state, 'piracy', { power, seaZone, targetPower, ...result });

  return result;
}
