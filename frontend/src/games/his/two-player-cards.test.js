/**
 * Here I Stand — Two-Player Variant, Phase 2b-cards
 *
 * Every diplomatic card now dispatches its DIPLOMACY_EVENT_HANDLERS effect in
 * the 2P Diplomacy play-loop (Phase 2 dispatched only Invasions). Covers the
 * actionData normalizer that bridges UI-collected flat keys into handler shape,
 * the #205 forced-play constraint, Papal Bull's regain-space benefit, the §11
 * Landsknechts/Swiss response exclusion, and opponent diplomacy-hand masking.
 */

import { describe, it, expect } from 'vitest';
import { HISGame } from './index.js';
import { buildInitialState } from './state/state-init.js';
import {
  applyDiplomacy2PPlay, normalizeDiplomacyActionData, applyPapalBull
} from './phases/phase-diplomacy-2p.js';
import { getVisibleState } from './state/state-visible.js';
import { CARD_BY_NUMBER } from './data/cards.js';

const PLAYERS = [{ id: 'p1', nickname: 'Host', isHost: true }];
const OPTS = {
  variant: 'two_player', powerAssignment: [['papacy', 'protestant']], rngSeed: 7
};
const helpers = { logEvent: () => {} };
const make2pState = () => buildInitialState(PLAYERS, { ...OPTS });

/** Queue a single side to play one diplomatic card from a fixed hand. */
function queuePlay(st, side, hand) {
  st.turn = 2;
  st.diplomacyHands[side] = [...hand];
  st.diplomacy2P = { stage: 'play', pendingPlayers: [side] };
}

describe('normalizeDiplomacyActionData — UI keys → handler shape', () => {
  const st = make2pState();

  it('#209 Plague: r0/r1/r2 → removals (owner derived from the space)', () => {
    st.spaces.Istanbul.units = [{
      owner: 'ottoman', regulars: 5, mercenaries: 0, cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];
    const out = normalizeDiplomacyActionData(st, 'papacy', 209, {
      cardNumber: 209, r0: 'Istanbul', r1: 'Istanbul', r2: 'Istanbul'
    });
    expect(out.removals).toEqual([
      { space: 'Istanbul', owner: 'ottoman' },
      { space: 'Istanbul', owner: 'ottoman' },
      { space: 'Istanbul', owner: 'ottoman' }
    ]);
  });

  it('#210 Shipbuilding: p0/p1 → placements owned by the acting side', () => {
    const out = normalizeDiplomacyActionData(st, 'protestant', 210, {
      cardNumber: 210, p0: 'London', p1: 'Hamburg'
    });
    expect(out.placements).toEqual([
      { space: 'London', owner: 'protestant' },
      { space: 'Hamburg', owner: 'protestant' }
    ]);
  });

  it('#218 Siege of Vienna: r0/r1 → Hapsburg removals', () => {
    const out = normalizeDiplomacyActionData(st, 'papacy', 218, {
      cardNumber: 218, r0: 'Vienna', r1: 'Vienna'
    });
    expect(out.removals).toEqual([
      { space: 'Vienna', owner: 'hapsburg' },
      { space: 'Vienna', owner: 'hapsburg' }
    ]);
  });

  it('#207 Henry refused: space → 3-regular Hapsburg placement', () => {
    const out = normalizeDiplomacyActionData(st, 'papacy', 207, {
      cardNumber: 207, choice: 'refused', space: 'Vienna'
    });
    expect(out.placements).toEqual([{ space: 'Vienna', count: 3 }]);
  });

  it('#215 Machiavelli: targetSpace → invasionData', () => {
    const out = normalizeDiplomacyActionData(st, 'papacy', 215, {
      cardNumber: 215, targetCard: 211, targetSpace: 'Milan'
    });
    expect(out.invasionData).toEqual({ targetSpace: 'Milan' });
  });

  it('#204 Diplomatic Marriage: defaults action + side-appropriate ally', () => {
    expect(normalizeDiplomacyActionData(st, 'papacy', 204, { cardNumber: 204 }))
      .toMatchObject({ action: 'activate', allyPower: 'papacy' });
    expect(normalizeDiplomacyActionData(st, 'protestant', 204, { cardNumber: 204 }))
      .toMatchObject({ action: 'activate', allyPower: 'france' });
  });

  it('passes structured actionData through untouched (online / AI / tests)', () => {
    const raw = { cardNumber: 209, removals: [{ space: 'Rome', owner: 'papacy' }] };
    expect(normalizeDiplomacyActionData(st, 'papacy', 209, raw)).toBe(raw);
  });
});

describe('Non-invasion card dispatch in the 2P play-loop', () => {
  it('#204 activates a minor power for the acting side', () => {
    const st = make2pState();
    queuePlay(st, 'papacy', [204]);
    const r = applyDiplomacy2PPlay(st, 'papacy',
      { cardNumber: 204, minorPower: 'scotland', action: 'activate' }, helpers);
    expect(r.ok).toBe(true);
    expect(st.minorPowers.scotland).toMatchObject({ ally: 'papacy', active: true });
  });

  it('#209 removes units from the board via the normalizer', () => {
    const st = make2pState();
    st.spaces.Istanbul.units = [{
      owner: 'ottoman', regulars: 5, mercenaries: 0, cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];
    queuePlay(st, 'papacy', [209]);
    applyDiplomacy2PPlay(st, 'papacy',
      { cardNumber: 209, r0: 'Istanbul', r1: 'Istanbul', r2: 'Istanbul' }, helpers);
    expect(st.spaces.Istanbul.units[0].regulars).toBe(2);
  });

  it('#217 flips an Italian space to Protestant', () => {
    const st = make2pState();
    st.spaces.Genoa.languageZone = 'italian';
    st.spaces.Genoa.religion = 'catholic';
    queuePlay(st, 'protestant', [217]);
    applyDiplomacy2PPlay(st, 'protestant',
      { cardNumber: 217, italianSpace: 'Genoa', dieRoll: 2 }, helpers);
    expect(st.spaces.Genoa.religion).toBe('protestant');
  });

  it('#208 Knights of St. John funds St. Peter\'s with the drawn card CP', () => {
    const st = make2pState();
    st.deck = [33];
    st.stPetersProgress = 0;
    st.stPetersVp = 0;
    queuePlay(st, 'papacy', [208]);
    applyDiplomacy2PPlay(st, 'papacy', { cardNumber: 208 }, helpers);
    expect(st.hands.papacy).toContain(33);
    expect(st.stPetersProgress).toBe(CARD_BY_NUMBER[33].cp);
    expect(st.pendingStPetersContribution).toBeUndefined(); // dead marker gone
  });

  it('#207 granted resolves its debate within dispatch — no pending state leaks', () => {
    const st = make2pState();
    queuePlay(st, 'papacy', [207]);
    const r = applyDiplomacy2PPlay(st, 'papacy', { cardNumber: 207, choice: 'granted' }, helpers);
    expect(r.ok).toBe(true);
    // A leaked pendingDebate/pendingReformation would strand the 2P phase.
    expect(st.pendingDebate).toBeFalsy();
    expect(st.pendingReformation).toBeFalsy();
    expect(st.pendingDebateCall).toBeUndefined();
  });

  it('#219 Spanish Inquisition discards a Protestant card + forces a play via dispatch', () => {
    const st = make2pState();
    st.turn = 2;
    st.diplomacyHands = { papacy: [219], protestant: [206, 201] }; // 206 = Invasion
    st.diplomacyDeck = [203, 204];
    st.diplomacyDiscard = [];
    // Papacy plays first, Protestant still queued (so the turn doesn't end and
    // clear the forced-play the Inquisition imposes on the Protestant).
    st.diplomacy2P = { stage: 'play', pendingPlayers: ['papacy', 'protestant'] };
    const r = applyDiplomacy2PPlay(st, 'papacy', { cardNumber: 219 }, helpers);
    expect(r.ok).toBe(true);
    expect(st.diplomacyDiscard).toContain(206);
    expect(st.diplomacyForcedPlay).toEqual({ side: 'protestant', card: 201 });
  });
});

describe('#205 Diplomatic Pressure forced-play constraint (§9)', () => {
  it('binds the targeted side to the dictated card', () => {
    const st = make2pState();
    st.turn = 2;
    st.diplomacyHands.protestant = [201, 212];
    st.diplomacy2P = { stage: 'play', pendingPlayers: ['protestant'] };
    st.diplomacyForcedPlay = { side: 'protestant', card: 212 };

    const wrong = applyDiplomacy2PPlay(st, 'protestant', { cardNumber: 201 }, helpers);
    expect(wrong.ok).toBe(false);

    const right = applyDiplomacy2PPlay(st, 'protestant', { cardNumber: 212 }, helpers);
    expect(right.ok).toBe(true);
  });
});

describe('Papal Bull — regain-space benefit (§9)', () => {
  it('regains a Papal home space the enemy controls instead of drawing', () => {
    const st = make2pState();
    st.wars.push({ a: 'papacy', b: 'france' });
    st.spaces.Rome.controller = 'france';
    st.pendingCardDraw = null;

    applyPapalBull(st, { targetPower: 'france', benefit: 'regain', regainSpace: 'Rome' }, helpers);

    expect(st.spaces.Rome.controller).toBe('papacy');
    expect(st.excommunicatedRulers.france).toBe(true);
    expect(st.pendingCardDraw).toBeNull(); // regain does not draw a card
  });
});

describe('§11 — Landsknechts/Swiss may not be played on behalf of an invader', () => {
  function responseGame() {
    const game = new HISGame('offline');
    game.start({ players: PLAYERS, gameType: 'his', options: { ...OPTS } });
    const s = game.getState();
    s.phase = 'action';
    s.activePower = 'papacy';
    // Hapsburg is an at-war invader the religious player commands (§11).
    s.wars = [{ a: 'hapsburg', b: 'protestant' }];
    s.hands.hapsburg = [33, 35];
    s.pendingResponse = {
      respondingPower: 'hapsburg',
      respondingPowers: ['hapsburg'],
      currentResponderIndex: 0,
      validCards: [33, 35]
    };
    return game;
  }

  it('rejects #33 Landsknechts but allows an ordinary response card (#35)', () => {
    const game = responseGame();
    const bad = game.validateMove({
      actionType: 'PLAY_RESPONSE_CARD', playerId: 'p1', actionData: { cardNumber: 33 }
    }, game.getState());
    expect(bad.valid).toBe(false);

    const ok = game.validateMove({
      actionType: 'PLAY_RESPONSE_CARD', playerId: 'p1', actionData: { cardNumber: 35 }
    }, game.getState());
    expect(ok.valid).toBe(true);
  });
});

describe('getVisibleState — opponent diplomacy hand masking (online 2p)', () => {
  it('masks the side the player does not control, leaves theirs intact', () => {
    const st = make2pState();
    st.diplomacyHands = { papacy: [201], protestant: [205, 212] };
    st.powersForPlayer = { p1: ['papacy'] }; // online: player controls only the Papacy

    const visible = getVisibleState(st, 'p1');
    expect(visible.diplomacyHands.papacy).toEqual([201]);
    expect(visible.diplomacyHands.protestant).toBe(2); // masked to a count
  });

  it('hides nothing in hotseat (the seat controls both sides)', () => {
    const st = make2pState();
    st.diplomacyHands = { papacy: [201], protestant: [205, 212] };
    st.powersForPlayer = { p1: ['papacy', 'protestant'] };

    const visible = getVisibleState(st, 'p1');
    expect(visible.diplomacyHands.papacy).toEqual([201]);
    expect(visible.diplomacyHands.protestant).toEqual([205, 212]);
  });
});
