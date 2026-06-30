/**
 * Here I Stand — Two-Player Variant, Phase 2b (Remove-At-War, §9)
 *
 * The Papacy may end an invasion war at the start of the Diplomacy phase via
 * Papal Bull (excommunicate France/Hapsburg) or by suing for peace. Covers the
 * target gating, both effects, and the Diplomacy-phase stage machine — driven
 * through the real executeMove pipeline where practical.
 */

import { describe, it, expect } from 'vitest';
import { HISGame } from './index.js';
import { buildInitialState } from './state/state-init.js';
import {
  papalBullTargets, sueForPeaceTargets, applyPapalBull, applySueForPeace2P,
  initDiplomacy2P
} from './phases/phase-diplomacy-2p.js';
import { areAtWar } from './state/war-helpers.js';
import { isRulerExcommunicated } from './actions/excommunication-actions.js';
import { isHomeSpace } from './state/state-helpers.js';

const PLAYERS = [{ id: 'p1', nickname: 'Host', isHost: true }];
const OPTS = {
  variant: 'two_player', powerAssignment: [['papacy', 'protestant']], rngSeed: 11
};
const helpers = { logEvent: () => {} };
const make2pState = () => buildInitialState(PLAYERS, { ...OPTS });

describe('Remove-At-War target gating (§9)', () => {
  it('Papal Bull only targets France/Hapsburg at war; sue-for-peace any non-Protestant', () => {
    const st = make2pState();
    st.wars.push({ a: 'papacy', b: 'france' });
    st.wars.push({ a: 'papacy', b: 'ottoman' });

    expect(papalBullTargets(st)).toContain('france');
    expect(papalBullTargets(st)).not.toContain('ottoman'); // not France/Hapsburg
    expect(sueForPeaceTargets(st)).toEqual(expect.arrayContaining(['france', 'ottoman']));
  });

  it('excludes already-excommunicated rulers and a spent Papal Bull', () => {
    const st = make2pState();
    st.wars.push({ a: 'papacy', b: 'france' });
    st.excommunicatedRulers.france = true;
    expect(papalBullTargets(st)).not.toContain('france');

    const st2 = make2pState();
    st2.wars.push({ a: 'papacy', b: 'hapsburg' });
    st2.papalBullUsedThisTurn = true;
    expect(papalBullTargets(st2)).toEqual([]);
  });

  it('never lets the Papacy sue for peace with the Protestant', () => {
    const st = make2pState();
    st.wars.push({ a: 'papacy', b: 'protestant' });
    expect(sueForPeaceTargets(st)).not.toContain('protestant');
  });
});

describe('Papal Bull effect', () => {
  it('excommunicates the ruler, ends the war, draws a card, and spends the Bull', () => {
    const st = make2pState();
    st.wars.push({ a: 'papacy', b: 'france' });
    applyPapalBull(st, { targetPower: 'france', benefit: 'draw' }, helpers);

    expect(areAtWar(st, 'papacy', 'france')).toBe(false);
    expect(isRulerExcommunicated(st, 'france')).toBe(true);
    expect(st.papalBullUsedThisTurn).toBe(true);
    expect(st.pendingCardDraw.papacy).toBe(1);
  });
});

describe('Sue-for-peace effect', () => {
  it('ends the war, awards the Protestant a War-Winner VP, and removes 2 Papal units', () => {
    const st = make2pState();
    st.wars.push({ a: 'papacy', b: 'hapsburg' });
    const before = (sp) => (st.spaces[sp].units.find((u) => u.owner === 'papacy'));
    const romeBefore = before('Rome');
    const total = (u) => (u ? u.regulars + u.mercenaries + u.cavalry + u.squadrons : 0);
    const beforeTotal = total(romeBefore);

    applySueForPeace2P(st, {
      targetPower: 'hapsburg', removeUnits: [{ space: 'Rome' }, { space: 'Rome' }]
    }, helpers);

    expect(areAtWar(st, 'papacy', 'hapsburg')).toBe(false);
    expect(st.bonusVp.protestant).toBe(1);
    expect(total(before('Rome'))).toBe(beforeTotal - 2);
  });

  it('reclaims only valid Papal home spaces the target controls (+1 VP each)', () => {
    const st = make2pState();
    st.wars.push({ a: 'papacy', b: 'hapsburg' });
    const papalHome = Object.keys(st.spaces).find(
      (n) => isHomeSpace(n, 'papacy') && n !== 'Rome'
    );
    st.spaces[papalHome].controller = 'hapsburg';     // valid reclaim target
    st.spaces.Paris = st.spaces.Paris || { controller: 'hapsburg', units: [], languageZone: 'french' };
    st.spaces.Paris.controller = 'hapsburg';          // NOT a Papal home → filtered

    applySueForPeace2P(st, {
      targetPower: 'hapsburg', reclaimSpaces: [papalHome, 'Paris'], removeUnits: []
    }, helpers);

    expect(st.spaces[papalHome].controller).toBe('papacy'); // reclaimed
    expect(st.spaces.Paris.controller).toBe('hapsburg');    // not reclaimed (not Papal home)
    expect(st.bonusVp.protestant).toBe(2);                  // 1 base + 1 valid reclaim
  });
});

describe('Diplomacy-phase Remove-At-War stage', () => {
  it('enters remove_war only when a removable war exists (else deals directly)', () => {
    const peace = make2pState();
    peace.turn = 2;
    initDiplomacy2P(peace, helpers);
    expect(peace.diplomacy2P.stage).toBe('play'); // no wars → straight to the deal

    const atWar = make2pState();
    atWar.turn = 2;
    atWar.wars.push({ a: 'papacy', b: 'france' });
    initDiplomacy2P(atWar, helpers);
    expect(atWar.diplomacy2P.stage).toBe('remove_war');
  });
});

describe('Remove-At-War through the real pipeline', () => {
  it('Papal Bull ends the war, then Done deals the cards', () => {
    const game = new HISGame('offline');
    game.start({ players: PLAYERS, gameType: 'his', options: { ...OPTS } });
    const s = game.getState();
    s.turn = 2;
    s.phase = 'diplomacy';
    s.wars.push({ a: 'papacy', b: 'france' });
    initDiplomacy2P(s, helpers);
    expect(s.diplomacy2P.stage).toBe('remove_war');

    const pid = s.players[0].id;
    const r1 = game.executeMove({
      actionType: 'PAPAL_BULL', playerId: pid,
      actionData: { targetPower: 'france', benefit: 'draw' }
    });
    expect(r1.success).toBe(true);
    expect(areAtWar(game.getState(), 'papacy', 'france')).toBe(false);
    expect(isRulerExcommunicated(game.getState(), 'france')).toBe(true);
    // Still in the Remove-At-War step (player may end more wars or finish).
    expect(game.getState().diplomacy2P.stage).toBe('remove_war');

    const r2 = game.executeMove({ actionType: 'END_REMOVE_WAR', playerId: pid });
    expect(r2.success).toBe(true);
    // Cards dealt; Turn-2 play queue stands up.
    expect(game.getState().diplomacy2P.stage).toBe('play');
    expect(game.getState().diplomacy2P.pendingPlayers).toEqual(['papacy', 'protestant']);
  });
});
