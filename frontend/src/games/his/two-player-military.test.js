/**
 * Here I Stand — Two-Player Variant, Phase 2 (military core)
 *
 * Covers invasion-card dispatch, §11 control of an at-war invader (the
 * forPower CP routing), §13 invader movement limits, §19 Winter removal of
 * French/Hapsburg/Ottoman units & leaders, and the Schmalkaldic-League war/ally
 * transitions. Pure logic is asserted directly; the forPower routing is driven
 * through the real executeMove pipeline.
 */

import { describe, it, expect } from 'vitest';
import { HISGame } from './index.js';
import { buildInitialState } from './state/state-init.js';
import {
  controllableInvaders, canControlInvaderAction, invaderController,
  playerCommandsPower, isInvaderMoveBlocked
} from './state/state-helpers.js';
import { applyDiplomacy2PPlay } from './phases/phase-diplomacy-2p.js';
import { areAtWar, areAllied } from './state/war-helpers.js';
import { executeWinter } from './phases/phase-winter.js';
import { EVENT_HANDLERS } from './actions/event-actions.js';

const PLAYERS = [{ id: 'p1', nickname: 'Host', isHost: true }];
const OPTS = {
  variant: 'two_player', powerAssignment: [['papacy', 'protestant']], rngSeed: 9
};
const helpers = { logEvent: () => {} };

function make2pState() {
  return buildInitialState(PLAYERS, { ...OPTS });
}
function start2pGame() {
  const game = new HISGame('offline');
  game.start({ players: PLAYERS, gameType: 'his', options: { ...OPTS } });
  return game;
}

describe('§11/§13 control logic', () => {
  const st = make2pState();
  st.wars.push({ a: 'hapsburg', b: 'protestant' });

  it('a side commands the powers at war with its opponent', () => {
    expect(controllableInvaders(st, 'papacy')).toContain('hapsburg');
    expect(controllableInvaders(st, 'protestant')).not.toContain('hapsburg');
    expect(invaderController(st, 'hapsburg')).toBe('papacy');
  });

  it('permits the §11 actions and rejects construction / wrong side', () => {
    expect(canControlInvaderAction(st, 'papacy', 'hapsburg', 'MOVE_FORMATION')).toBe(true);
    expect(canControlInvaderAction(st, 'papacy', 'hapsburg', 'ASSAULT')).toBe(true);
    expect(canControlInvaderAction(st, 'papacy', 'hapsburg', 'RAISE_REGULAR')).toBe(false);
    expect(canControlInvaderAction(st, 'protestant', 'hapsburg', 'MOVE_FORMATION')).toBe(false);
    expect(canControlInvaderAction(st, 'papacy', 'papacy', 'MOVE_FORMATION')).toBe(false);
  });

  it('playerCommandsPower covers own powers and commanded invaders', () => {
    const pid = st.players[0].id;
    expect(playerCommandsPower(st, pid, 'papacy')).toBe(true);
    expect(playerCommandsPower(st, pid, 'hapsburg')).toBe(true); // commanded via papacy
  });

  it('§13 confines invaders to DE/IT + independent/own spaces', () => {
    st.spaces.Paris = st.spaces.Paris || { controller: 'france', languageZone: 'french' };
    expect(isInvaderMoveBlocked(st, 'hapsburg', 'Paris')).toBe(true);   // french, France-controlled
    expect(isInvaderMoveBlocked(st, 'hapsburg', 'Vienna')).toBe(false); // german
  });
});

describe('invasion-card dispatch (#206 French Invasion)', () => {
  it('sets the war, places the army at the target, and draws for the controller', () => {
    const st = make2pState();
    st.turn = 2;
    st.diplomacyHands.papacy = [206];
    st.diplomacy2P = { pendingPlayers: ['papacy', 'protestant'] };

    const before = st.hands.protestant.length;
    const res = applyDiplomacy2PPlay(st, 'papacy', { cardNumber: 206, targetSpace: 'Milan' }, helpers);
    expect(res.ok).toBe(true);

    expect(areAtWar(st, 'france', 'papacy')).toBe(true);
    const french = st.spaces.Milan.units.find((u) => u.owner === 'france');
    expect(french).toBeTruthy();
    expect(french.regulars).toBeGreaterThan(0);
    // The handler's pendingCardDraw was drained to the controlling player.
    expect(st.hands.protestant.length).toBeGreaterThan(before);
    expect(st.pendingCardDraw).toBeNull();
  });
});

describe('§11 forPower CP routing (real executeMove pipeline)', () => {
  function setupActionCpGame() {
    const game = start2pGame();
    const s = game.getState();
    s.phase = 'action';
    s.activePower = 'papacy';
    s.cpRemaining = 4;
    s.activeCardNumber = 999; // in CP mode
    s.consecutivePasses = 0;
    if (!areAtWar(s, 'hapsburg', 'protestant')) s.wars.push({ a: 'hapsburg', b: 'protestant' });
    const stack = (regulars) => ({
      owner: 'hapsburg', regulars, mercenaries: 0, cavalry: 0,
      squadrons: 0, corsairs: 0, leaders: []
    });
    s.spaces.Augsburg.units = [stack(3)];
    s.spaces.Nuremberg.units = [];
    return { game, pid: s.players[0].id };
  }

  it('papacy moves a commanded Hapsburg formation (forPower routed)', () => {
    const { game, pid } = setupActionCpGame();
    const r = game.executeMove({
      actionType: 'MOVE_FORMATION', playerId: pid,
      actionData: { forPower: 'hapsburg', from: 'Augsburg', to: 'Nuremberg', units: { regulars: 2 } }
    });
    expect(r.success).toBe(true);
    const to = game.getState().spaces.Nuremberg.units.find((u) => u.owner === 'hapsburg');
    expect(to?.regulars).toBe(2);
  });

  it('rejects construction on behalf of an invader (not in the §11 list)', () => {
    const { game, pid } = setupActionCpGame();
    const r = game.executeMove({
      actionType: 'RAISE_REGULAR', playerId: pid,
      actionData: { forPower: 'hapsburg', space: 'Augsburg' }
    });
    expect(r.success).toBe(false);
    // No Hapsburg regular was added on behalf.
    const aug = game.getState().spaces.Augsburg.units.find((u) => u.owner === 'hapsburg');
    expect(aug.regulars).toBe(3);
  });
});

describe('§19 Winter removal of invaders', () => {
  it('removes FR/HA/OT army leaders and units forced back to capital', () => {
    const st = make2pState();
    // A French army stranded deep in (Hapsburg-controlled) German territory with
    // no reachable friendly fortress → forced toward its capital → removed (§19).
    st.spaces.Augsburg.units = [{
      owner: 'france', regulars: 2, mercenaries: 1, cavalry: 0,
      squadrons: 0, corsairs: 0, leaders: ['montmorency']
    }];

    executeWinter(st, helpers);

    const french = (st.spaces.Augsburg.units || []).find((u) => u.owner === 'france');
    const frenchUnits = french
      ? french.regulars + french.mercenaries + french.cavalry : 0;
    expect(frenchUnits).toBe(0); // eliminated (§19 forced-to-capital removal)
    // The army leader is gone from the entire map.
    let leaderStillOnMap = false;
    for (const sp of Object.values(st.spaces)) {
      for (const u of sp.units || []) {
        if ((u.leaders || []).includes('montmorency')) leaderStillOnMap = true;
      }
    }
    expect(leaderStillOnMap).toBe(false);
  });
});

describe('Schmalkaldic League transitions (2P)', () => {
  it('sets Papacy/Protestant + Hapsburg/Protestant at war and Papacy/Hapsburg allied', () => {
    const st = make2pState();
    st.turn = 3;
    // 12+ protestant spaces so the action-phase guard would pass (not needed for execute).
    EVENT_HANDLERS[13].execute(st, 'protestant', {}, helpers);

    expect(st.schmalkaldicLeagueFormed).toBe(true);
    expect(areAtWar(st, 'papacy', 'protestant')).toBe(true);
    expect(areAtWar(st, 'hapsburg', 'protestant')).toBe(true);
    expect(areAllied(st, 'papacy', 'hapsburg')).toBe(true);
  });
});
