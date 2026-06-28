/**
 * Here I Stand — Full-bot run-to-end integration (backlog P2.4)
 *
 * Drives the REAL bot loop (scheduleBotAction) over deterministic all-bot games
 * until a terminal status, asserting the engine runs end-to-end without a broken
 * chain and produces a winner. This is the node/CI complement to the
 * browser-driven window.app._runHisBotBatch harness.
 *
 * Mechanism: vitest fake timers turn the setTimeout-driven bot chain into a
 * synchronous loop — each runOnlyPendingTimers() fires one bot action, whose
 * executeMove re-kicks the next. Math.random is seeded (mulberry32) so dice /
 * shuffles are reproducible; automatic phases (card_draw/winter/new_world/
 * victory_determination) self-advance via transitionPhase, so the loop is pure
 * bot decisions on interactive phases. Domination victory is disabled so games
 * play the full turn track for a richer engine exercise.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HISGame } from '../index.js';
import { scheduleBotAction } from './bot-controller.js';

const ALL_POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function makeAllBotGame(seed) {
  const game = new HISGame('offline');
  game.start({
    players: [{ id: 'observer', nickname: 'Obs', isHost: true }],
    gameType: 'his',
    options: {
      powerAssignment: [[]], botPowers: ALL_POWERS,
      rngSeed: seed, dominationVictoryEnabled: false
    }
  });
  return game;
}

/** Two-player variant, both sides bot-driven (Papacy + Protestant). */
function makeTwoPlayerBotGame(seed) {
  const game = new HISGame('offline');
  game.start({
    players: [{ id: 'observer', nickname: 'Obs', isHost: true }],
    gameType: 'his',
    options: {
      variant: 'two_player', powerAssignment: [[]],
      botPowers: ['papacy', 'protestant'],
      rngSeed: seed, dominationVictoryEnabled: false
    }
  });
  return game;
}

/**
 * Run one seeded all-bot game to completion. Returns
 * { ended, iters, status, turn, chainBroken, stuck }. Suppresses the bots'
 * verbose decision logging while still capturing [BOT STUCK]/[BOT CHAIN BROKEN].
 */
function playSeededGame(seed, cap = 50000, factory = makeAllBotGame) {
  const orig = { log: console.log, warn: console.warn, error: console.error, random: Math.random };
  let chainBroken = 0;
  let stuck = 0;
  console.log = () => {};
  console.warn = (...a) => {
    const s = a.map(x => (typeof x === 'string' ? x : '')).join(' ');
    if (s.includes('[BOT STUCK]')) stuck++;
  };
  console.error = (...a) => {
    const s = a.map(x => (typeof x === 'string' ? x : '')).join(' ');
    if (s.includes('[BOT CHAIN BROKEN]')) chainBroken++;
  };
  Math.random = mulberry32(seed);

  // Count successful §11 invader-command actions (a religious side moving a
  // non-player power's army). Always 0 in the 3–6p games (no such forPower).
  let invaderActs = 0;
  const NON_PLAYER = new Set(['france', 'hapsburg', 'ottoman', 'england']);

  let game, iters = 0;
  try {
    game = factory(seed);
    const kick = () => scheduleBotAction(game, (move) => {
      const r = game.executeMove(move);
      if (r.success && NON_PLAYER.has(move.actionData?.forPower)) invaderActs++;
      if (r.success) kick();
      return r;
    });
    kick();
    while (game.getState().status === 'playing' &&
           vi.getTimerCount() > 0 && iters < cap) {
      vi.runOnlyPendingTimers();
      iters++;
    }
  } finally {
    Object.assign(console, { log: orig.log, warn: orig.warn, error: orig.error });
    Math.random = orig.random;
  }

  const st = game.getState();
  return {
    ended: st.status !== 'playing', iters, status: st.status,
    turn: st.turn, chainBroken, stuck, invaderActs, game
  };
}

describe('HIS full-bot game runs to completion (P2.4)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  // A few fixed seeds — reproducible; reuse a printed seed to debug a failure.
  for (const seed of [12345, 2026, 777]) {
    it(`seed ${seed}: clean full-game run (ended, no stuck/broken) with late-turn mechanics + winner`, () => {
      const r = playSeededGame(seed);
      if (!r.ended || r.chainBroken || r.stuck) {
        console.error(`[fullgame seed=${seed}] status=${r.status} turn=${r.turn} ` +
          `iters=${r.iters} chainBroken=${r.chainBroken} stuck=${r.stuck}`);
      }
      // A clean run: reaches a terminal status with neither a bot stuck nor a
      // broken chain (matches _runHisBotBatch's `clean`).
      expect(r.ended).toBe(true);
      expect(r.chainBroken).toBe(0);
      expect(r.stuck).toBe(0);

      // Late-turn mechanics actually executed (T3–T9): the game progressed
      // several turns and the New World phase resolved at least once.
      const state = r.game.getState();
      expect(r.turn).toBeGreaterThanOrEqual(3);
      const ranNewWorld = state.eventLog.some(
        e => e.type === 'phase_change' && e.data?.phase === 'new_world');
      expect(ranNewWorld).toBe(true);

      // A concrete winner with full scoring is produced.
      const result = r.game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(ALL_POWERS).toContain(result.winnerPower);
      expect(result.rankings).toHaveLength(ALL_POWERS.length);
    }, 30000); // a full game is ~1300 bot actions; generous under parallel load
  }
});

describe('HIS two-player variant — full-bot run to completion (Phase 4b)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  // Both sides (Papacy + Protestant) are bot-driven through the full 2P flow:
  // Diplomatic Deck + Remove-At-War, action/religious, England automation, winter.
  for (const seed of [12345, 2026, 777]) {
    it(`seed ${seed}: clean 2P full-game run (ended, no stuck/broken)`, () => {
      const r = playSeededGame(seed, 50000, makeTwoPlayerBotGame);
      if (!r.ended || r.chainBroken || r.stuck) {
        console.error(`[2p fullgame seed=${seed}] status=${r.status} turn=${r.turn} ` +
          `iters=${r.iters} chainBroken=${r.chainBroken} stuck=${r.stuck}`);
      }
      // The bot plays a complete, clean 2P game: a terminal status with no broken
      // chain and no stuck primary action (every proposal is legal — matching the
      // 3–6p full-bot bar).
      expect(r.ended).toBe(true);
      expect(r.chainBroken).toBe(0);
      expect(r.stuck).toBe(0);
      // The variant ran several turns (the Diplomatic Deck phase begins T1).
      expect(r.turn).toBeGreaterThanOrEqual(3);

      const state = r.game.getState();
      expect(state.variant).toBe('two_player');
      // A winner is produced; in the 2P variant it is one of the two players.
      const result = r.game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(['papacy', 'protestant']).toContain(result.winnerPower);
    }, 30000);
  }

  it('§11 invader command is exercised (the bot moves at-war invaders)', () => {
    // Across the seeds, the bot plays invasion cards and then commands the
    // activated non-player armies (forPower) to advance on the opponent — not
    // leaving them idle. Aggregated to avoid per-seed deck-draw flakiness.
    const total = [12345, 2026, 777]
      .reduce((n, seed) => n + playSeededGame(seed, 50000, makeTwoPlayerBotGame).invaderActs, 0);
    expect(total).toBeGreaterThan(0);
  }, 30000);
});
