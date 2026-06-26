/**
 * Here I Stand — Two-Player Variant (Phase 1: religious-core MVP)
 *
 * Covers the 2P setup overlay, the modified sequence of play (New World deleted,
 * Papacy→Protestant-only impulses), the Diplomatic-Deck phase wiring, the
 * §12–13 religious-struggle restrictions, and the 8-VP domination gap. Drives a
 * full Turn 1 through the real move pipeline as an integration smoke.
 */

import { describe, it, expect } from 'vitest';
import { HISGame } from './index.js';
import { buildInitialState } from './state/state-init.js';
import {
  buildTwoPlayerScenario, TWO_PLAYER_REMOVED_CARDS
} from './data/setup-1517-2p.js';
import { LAND_SPACES } from './data/map-data.js';
import {
  getImpulseOrder, getPassesToEnd, isReligiousZoneMoveBlocked, isTwoPlayer
} from './state/state-helpers.js';
import { getPhaseOrder } from './phases/phase-manager.js';
import {
  initDiplomacy2P, diplomacy2PNeedsInput, applyDiplomacy2PPlay
} from './phases/phase-diplomacy-2p.js';
import { VICTORY } from './constants.js';

const ZONE = Object.fromEntries(LAND_SPACES.map((s) => [s.name, s.languageZone]));
const PLAYERS = [
  { id: 'p1', nickname: 'Pap', isHost: true },
  { id: 'p2', nickname: 'Pro' }
];
const OPTS = {
  variant: 'two_player',
  powerAssignment: [['papacy'], ['protestant']],
  rngSeed: 7
};

function make2pState() {
  return buildInitialState(PLAYERS, { ...OPTS });
}

function start2pGame(extra = {}) {
  const game = new HISGame('offline');
  game.start({
    players: PLAYERS,
    gameType: 'his',
    options: { ...OPTS, dominationVictoryEnabled: false, ...extra }
  });
  return game;
}

describe('2P setup overlay', () => {
  const st = make2pState();

  it('removes exactly the 49 listed cards from the Main Deck', () => {
    expect(TWO_PLAYER_REMOVED_CARDS).toHaveLength(49);
    const leak = TWO_PLAYER_REMOVED_CARDS.filter((n) => st.deck.includes(n));
    expect(leak).toEqual([]);
  });

  it('reduces every stack outside German/Italian to at most 1 regular', () => {
    for (const [name, sp] of Object.entries(st.spaces)) {
      const zone = ZONE[name];
      if (zone === 'german' || zone === 'italian') continue;
      for (const u of sp.units || []) {
        expect((u.regulars || 0) + (u.mercenaries || 0) + (u.cavalry || 0))
          .toBeLessThanOrEqual(1);
        expect(u.mercenaries || 0).toBe(0);
        expect(u.cavalry || 0).toBe(0);
      }
    }
  });

  it('keeps naval units only in the five named ports', () => {
    const navalSpaces = new Set();
    for (const [name, sp] of Object.entries(st.spaces)) {
      for (const u of sp.units || []) {
        if ((u.squadrons || 0) > 0 || (u.corsairs || 0) > 0) navalSpaces.add(name);
      }
    }
    expect([...navalSpaces].sort()).toEqual(
      ['Genoa', 'Marseille', 'Naples', 'Rome', 'Venice']
    );
  });

  it('leaves only Andrea Doria on the map', () => {
    const leaders = [];
    for (const sp of Object.values(st.spaces)) {
      for (const u of sp.units || []) leaders.push(...(u.leaders || []));
    }
    expect(leaders).toEqual(['andrea_doria']);
  });

  it('reassigns Hungary/Bohemia: Prague→Hapsburg, Buda/Belgrade→Ottoman', () => {
    expect(st.spaces.Prague.controller).toBe('hapsburg');
    expect(st.spaces.Buda.controller).toBe('ottoman');
    expect(st.spaces.Belgrade.controller).toBe('ottoman');
  });

  it('stands up the Diplomatic Deck (12 base cards, empty hands)', () => {
    expect(st.variant).toBe('two_player');
    expect(st.diplomacyDeck).toHaveLength(12);
    expect(st.diplomacyHands).toEqual({ papacy: [], protestant: [] });
  });

  it('does not mutate the shared standard scenario', () => {
    const a = buildTwoPlayerScenario();
    const b = buildTwoPlayerScenario();
    expect(a.deployments.papacy).toEqual(b.deployments.papacy);
    // A standard game still has its full deck / leaders.
    const std = buildInitialState(PLAYERS, { rngSeed: 7 });
    expect(std.variant).toBe('standard');
    expect(std.diplomacyDeck).toBeUndefined();
  });
});

describe('2P sequence of play & impulse order', () => {
  const st = make2pState();

  it('deletes the New World phase from the 2P phase order', () => {
    expect(getPhaseOrder(2, true)).not.toContain('new_world');
    expect(getPhaseOrder(1, true)).not.toContain('new_world');
    // standard order still has it
    expect(getPhaseOrder(2, false)).toContain('new_world');
  });

  it('cycles only Papacy and Protestant', () => {
    expect(getImpulseOrder(st)).toEqual(['papacy', 'protestant']);
    expect(getPassesToEnd(st)).toBe(2);
  });
});

describe('2P religious-struggle restrictions (§12–13)', () => {
  const st = make2pState();

  it('§13 blocks Papal/Protestant movement outside German/Italian zones', () => {
    // German / Italian destinations are allowed.
    expect(isReligiousZoneMoveBlocked(st, 'papacy', 'Vienna')).toBe(false); // german
    expect(isReligiousZoneMoveBlocked(st, 'protestant', 'Florence')).toBe(false); // italian
    // Spanish / French / Eastern destinations are blocked for the religious powers.
    expect(isReligiousZoneMoveBlocked(st, 'papacy', 'Valladolid')).toBe(true); // spanish
    expect(isReligiousZoneMoveBlocked(st, 'protestant', 'Paris')).toBe(true); // french
    // Non-religious powers and the standard game are unaffected.
    expect(isReligiousZoneMoveBlocked(st, 'france', 'Valladolid')).toBe(false);
    const std = buildInitialState(PLAYERS, { rngSeed: 7 });
    expect(isReligiousZoneMoveBlocked(std, 'papacy', 'Valladolid')).toBe(false);
  });
});

describe('2P victory', () => {
  it('uses an 8-VP domination gap', () => {
    expect(VICTORY.twoPlayerDominationGap).toBe(8);
    expect(VICTORY.dominationGap).toBe(5);
  });
});

describe('2P sequence to the Action phase (integration smoke)', () => {
  const ACT = {
    PHASE_ADVANCE: 'PHASE_ADVANCE', PASS: 'PASS', SUBMIT_DIET_CARD: 'SUBMIT_DIET_CARD'
  };
  const pidFor = (power) => (power === 'papacy' ? 'p1' : 'p2');
  // Home cards (always in hand, never mandatory) — deterministic Diet submissions.
  const HOME = { papacy: 5, protestant: 7 };

  it('drives Luther95 → CardDraw → Diplomacy(T1 deal-only) → Diet → Spring → Action', () => {
    const game = start2pGame();
    const S = () => game.getState();
    const step = (actionType, playerId, actionData = {}) =>
      game.executeMove({ actionType, actionData, playerId });

    expect(isTwoPlayer(S())).toBe(true);
    expect(S().phase).toBe('luther_95');

    // Skip Luther's 95 Theses. Card Draw auto-runs; the Turn-1 Diplomacy phase
    // deals one card to each side (no play) and self-advances → Diet of Worms.
    step(ACT.PHASE_ADVANCE, 'p2');
    expect(S().phase).toBe('diet_of_worms');
    expect(S().diplomacyHands.papacy).toHaveLength(1);
    expect(S().diplomacyHands.protestant).toHaveLength(1);

    // Diet of Worms: Papacy & Protestant submit (Hapsburg auto-drawn from deck).
    for (const power of ['papacy', 'protestant']) {
      step(ACT.SUBMIT_DIET_CARD, pidFor(power), { cardNumber: HOME[power] });
    }
    expect(S().phase).toBe('spring_deployment');

    // Spring deployment: both sides pass → Action phase.
    let guard = 0;
    while (S().phase === 'spring_deployment' && guard++ < 6) {
      step(ACT.PASS, pidFor(S().activePower));
    }
    expect(S().phase).toBe('action');
    expect(S().activePower).toBe('papacy');
    expect(getImpulseOrder(S())).toEqual(['papacy', 'protestant']);

    // The New World phase never ran during Turn 1.
    expect(S().eventLog.some(
      (e) => e.type === 'phase_change' && e.data?.phase === 'new_world'
    )).toBe(false);

    // Turn-1 Diplomacy dealt cards but queued no plays.
    const diplo = S().eventLog.filter((e) => e.type === 'diplomacy_2p_start');
    expect(diplo).toHaveLength(1);
    expect(diplo[0].data.willPlay).toEqual([]);
  });
});

describe('2P Diplomacy phase (§9): deal + Papacy→Protestant play', () => {
  const helpers = { logEvent: () => {} };

  it('Turn 1 deals one card to each side and queues no plays', () => {
    const st = make2pState();
    st.turn = 1;
    initDiplomacy2P(st, helpers);
    expect(st.diplomacyHands.papacy).toHaveLength(1);
    expect(st.diplomacyHands.protestant).toHaveLength(1);
    expect(diplomacy2PNeedsInput(st)).toBe(false);
  });

  it('Turn 2 deals, then Papacy plays before Protestant; plays are discarded', () => {
    const st = make2pState();
    // Hold one card each from Turn 1, then run the Turn-2 deal.
    st.turn = 1;
    initDiplomacy2P(st, helpers);
    st.turn = 2;
    initDiplomacy2P(st, helpers);

    expect(st.diplomacyHands.papacy).toHaveLength(2);
    expect(st.diplomacy2P.pendingPlayers).toEqual(['papacy', 'protestant']);

    // Protestant cannot jump the queue.
    const early = applyDiplomacy2PPlay(st, 'protestant',
      st.diplomacyHands.protestant[0], helpers);
    expect(early.ok).toBe(false);

    const papCard = st.diplomacyHands.papacy[0];
    const r1 = applyDiplomacy2PPlay(st, 'papacy', papCard, helpers);
    expect(r1).toMatchObject({ ok: true, done: false });
    expect(st.diplomacy2P.pendingPlayers).toEqual(['protestant']);

    const protCard = st.diplomacyHands.protestant[0];
    const r2 = applyDiplomacy2PPlay(st, 'protestant', protCard, helpers);
    expect(r2).toMatchObject({ ok: true, done: true });

    expect(st.diplomacyDiscard).toContain(papCard);
    expect(st.diplomacyDiscard).toContain(protCard);
    expect(diplomacy2PNeedsInput(st)).toBe(false);
  });

  it('plays through the real move pipeline (validateMove + processMove)', () => {
    // Hotseat assignment: one local player controls both sides.
    const game = new HISGame('offline');
    game.start({
      players: [{ id: 'p1', nickname: 'Host', isHost: true }],
      gameType: 'his',
      options: {
        variant: 'two_player', powerAssignment: [['papacy', 'protestant']], rngSeed: 3
      }
    });
    // Place the game in a Turn-2 Diplomacy phase with cards dealt + queued.
    const s = game.getState();
    s.turn = 2;
    s.phase = 'diplomacy';
    initDiplomacy2P(s, helpers);
    expect(s.diplomacy2P.pendingPlayers).toEqual(['papacy', 'protestant']);

    // A targetSpace is supplied so the play is valid whether or not the dealt
    // card is an Invasion (invasion cards require a landing space; others ignore it).
    const papCard = s.diplomacyHands.papacy[0];
    const r1 = game.executeMove({
      actionType: 'PLAY_DIPLOMACY_CARD', playerId: 'p1',
      actionData: { cardNumber: papCard, targetSpace: 'Milan' }
    });
    expect(r1.success).toBe(true);
    expect(game.getState().diplomacy2P.pendingPlayers).toEqual(['protestant']);

    const protCard = game.getState().diplomacyHands.protestant[0];
    const r2 = game.executeMove({
      actionType: 'PLAY_DIPLOMACY_CARD', playerId: 'p1',
      actionData: { cardNumber: protCard, targetSpace: 'Milan' }
    });
    expect(r2.success).toBe(true);
    // Both played → Diplomacy phase complete, advanced to Spring Deployment.
    expect(game.getState().phase).toBe('spring_deployment');
  });
});
