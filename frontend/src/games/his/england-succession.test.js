/**
 * England succession — Lady Jane Grey (#59) play path.
 *
 * #59 is only playable when England changed rulers this turn
 * (state.englandRulerChangedThisTurn — set e.g. by #58 Edward VI / succession
 * events). That mid-game window is hard to reach in a live playthrough, so this
 * pins the human play path deterministically through the REAL move pipeline:
 * executeMove → validateMove (the gate) → processMove (execution), driven from a
 * constructed action-phase state. This is the integration a UI "触发事件" click
 * triggers; the card's event handler itself is covered separately
 * (event-actions-extended.test.js #59).
 *
 * Note on UI gating: the "触发事件" button is intentionally NOT pre-gated per
 * card — many events (e.g. #6 Leipzig Debate) have validators that require
 * post-click target selection and would reject empty actionData, so pre-gating
 * would falsely hide playable cards. #59 instead relies on the engine gate +
 * the existing rejected-move toast (see _handleGameAction). This test pins that
 * the engine gate is enforced on the play path.
 */
import { describe, it, expect } from 'vitest';
import { HISGame } from './index.js';
import { MAJOR_POWERS } from './constants.js';

// DEFAULT_POWER_ASSIGNMENTS[6] maps p6 -> protestant (and p5 -> papacy).
const PLAYERS = [
  { id: 'p1', nickname: 'A', isHost: true }, { id: 'p2', nickname: 'B' },
  { id: 'p3', nickname: 'C' }, { id: 'p4', nickname: 'D' },
  { id: 'p5', nickname: 'E' }, { id: 'p6', nickname: 'F' }
];

const PLAY_59 = {
  actionType: 'PLAY_CARD_EVENT',
  actionData: { cardNumber: 59 },
  playerId: 'p6'
};

/** A Protestant action-phase impulse holding #59, with no pending interaction. */
function gameWithLadyJane(rulerChanged) {
  const game = new HISGame('offline');
  game.start({ players: PLAYERS, gameType: 'his', options: { rngSeed: 7 } });

  const s = JSON.parse(JSON.stringify(game.getState()));
  s.phase = 'action';
  s.activePower = 'protestant';
  s.cpRemaining = 0;
  s.activeCardNumber = null;
  // Clear every pending interaction so the card-play path is open.
  s.pendingReformation = null;
  s.pendingDebate = null;
  s.pendingBattle = null;
  s.pendingInterception = null;
  s.pendingResponse = null;
  s.pendingLuther95 = null;
  s.pendingDietOfWorms = null;
  // Empty all hands (no other power can W7-interrupt the event play), then deal #59.
  for (const p of MAJOR_POWERS) s.hands[p] = [];
  s.hands.protestant = [59];
  s.englandRulerChangedThisTurn = rulerChanged;

  game.applyStateUpdate(s);
  return game;
}

describe('England succession — Lady Jane Grey (#59) play path', () => {
  it('rejects the event play when England has not changed rulers this turn', () => {
    const game = gameWithLadyJane(false);
    const res = game.executeMove(PLAY_59);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/England/i);
    // Rejected move is never processed — the card stays in hand, no pending effect.
    expect(game.getState().hands.protestant).toContain(59);
    expect(game.getState().pendingLadyJaneGrey).toBeFalsy();
  });

  it('plays the event once England changed rulers: pendingLadyJaneGrey + discard', () => {
    const game = gameWithLadyJane(true);
    const res = game.executeMove(PLAY_59);

    expect(res.success).toBe(true);
    const out = game.getState();
    expect(out.pendingLadyJaneGrey).toBeTruthy();
    expect(out.pendingLadyJaneGrey.giveTo)
      .toEqual(expect.arrayContaining(['protestant', 'papacy']));
    expect(out.hands.protestant).not.toContain(59);
    // #59 is removeAfterPlay, so it leaves play (removedCards) rather than discard.
    expect(out.removedCards).toContain(59);
    expect(out.discard).not.toContain(59);
    expect((out.eventLog || []).some(e => e.type === 'event_lady_jane_grey')).toBe(true);
  });

  it('validateMove is the gate (toggles purely on englandRulerChangedThisTurn)', () => {
    const blocked = gameWithLadyJane(false);
    const open = gameWithLadyJane(true);

    expect(blocked.validateMove(PLAY_59, blocked.getState()).valid).toBe(false);
    expect(open.validateMove(PLAY_59, open.getState()).valid).toBe(true);
  });
});
