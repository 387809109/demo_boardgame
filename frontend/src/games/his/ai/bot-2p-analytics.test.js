/**
 * Here I Stand — Two-Player bot analytics (deeper-AI v2 diagnosis + guard)
 *
 * Runs a wider sweep of seeded all-bot 2P games and aggregates how they play —
 * win split, length, and resource use — so strategy changes can be measured, not
 * guessed. It asserts only the invariants (every game ends, no bot ever gets
 * stuck), so it doubles as a wider-seed robustness sweep for the 2P bot.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HISGame } from '../index.js';
import { scheduleBotAction } from './bot-controller.js';
import { getAllVpTotals } from '../state/state-helpers.js';

const SEEDS = [1, 7, 42, 99, 314, 777, 2026, 5555, 9001, 12345, 31337, 65535];
const NON_PLAYER = new Set(['france', 'hapsburg', 'ottoman', 'england']);

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function makeTwoPlayerBotGame(seed) {
  const game = new HISGame('offline');
  game.start({
    players: [{ id: 'obs', nickname: 'Obs', isHost: true }],
    gameType: 'his',
    options: {
      variant: 'two_player', powerAssignment: [[]],
      botPowers: ['papacy', 'protestant'], rngSeed: seed,
      dominationVictoryEnabled: false
    }
  });
  return game;
}

function playSeeded(seed) {
  const orig = { log: console.log, warn: console.warn, error: console.error, random: Math.random };
  let stuck = 0, chainBroken = 0, invaderActs = 0;
  console.log = () => {};
  console.warn = (...a) => { if (String(a[0]).includes('[BOT STUCK]')) stuck++; };
  console.error = (...a) => { if (String(a[0]).includes('[BOT CHAIN BROKEN]')) chainBroken++; };
  Math.random = mulberry32(seed);

  let game, iters = 0;
  try {
    game = makeTwoPlayerBotGame(seed);
    const kick = () => scheduleBotAction(game, (move) => {
      const r = game.executeMove(move);
      if (r.success && NON_PLAYER.has(move.actionData?.forPower)) invaderActs++;
      if (r.success) kick();
      return r;
    });
    kick();
    while (game.getState().status === 'playing' && vi.getTimerCount() > 0 && iters < 60000) {
      vi.runOnlyPendingTimers(); iters++;
    }
  } finally {
    Object.assign(console, { log: orig.log, warn: orig.warn, error: orig.error });
    Math.random = orig.random;
  }

  const st = game.getState();
  const log = st.eventLog || [];
  const count = (type) => log.filter((e) => e.type === type).length;
  const result = st.status === 'ended' ? game.checkGameEnd(st) : { winnerPower: null };
  const vp = getAllVpTotals(st);
  let protSpaces = 0, catSpaces = 0;
  for (const sp of Object.values(st.spaces)) {
    if (sp.religion === 'protestant') protSpaces++;
    else if (sp.religion === 'catholic') catSpaces++;
  }
  return {
    seed,
    ended: st.status !== 'playing',
    turn: st.turn,
    stuck, chainBroken, invaderActs,
    winner: result.winnerPower,
    papacyVp: vp.papacy || 0,
    protestantVp: vp.protestant || 0,
    protSpaces, catSpaces,
    invasionsPlayed: log.filter((e) => e.type === 'diplomacy_2p_play' && e.data?.invasion).length,
    sueForPeace: count('diplomacy_2p_sue_for_peace'),
    papalBull: count('diplomacy_2p_papal_bull'),
    publishTreatise: count('publish_treatise'),
    burnBooks: count('burn_books'),
    translate: count('translate_scripture'),
    debates: count('call_debate'),
    debateFlips: count('debate_flip'),
    stPetersVp: st.stPetersVp || 0
  };
}

describe('Two-player bot analytics (deeper-AI v2)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('all-bot 2P games end cleanly; reports the strategic profile', () => {
    const rows = SEEDS.map(playSeeded);

    const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
    const wins = { papacy: 0, protestant: 0, other: 0 };
    for (const r of rows) wins[r.winner === 'papacy' || r.winner === 'protestant' ? r.winner : 'other']++;
    const profile = {
      games: rows.length,
      notEnded: rows.filter((r) => !r.ended).length,
      stuckTotal: sum((r) => r.stuck),
      chainBroken: sum((r) => r.chainBroken),
      wins,
      avgEndTurn: +(sum((r) => r.turn) / rows.length).toFixed(2),
      avgPapacyVp: +(sum((r) => r.papacyVp) / rows.length).toFixed(1),
      avgProtestantVp: +(sum((r) => r.protestantVp) / rows.length).toFixed(1),
      avgProtSpaces: +(sum((r) => r.protSpaces) / rows.length).toFixed(1),
      avgCatSpaces: +(sum((r) => r.catSpaces) / rows.length).toFixed(1),
      avgPublish: +(sum((r) => r.publishTreatise) / rows.length).toFixed(1),
      avgBurn: +(sum((r) => r.burnBooks) / rows.length).toFixed(1),
      avgTranslate: +(sum((r) => r.translate) / rows.length).toFixed(1),
      avgDebates: +(sum((r) => r.debates) / rows.length).toFixed(1),
      avgDebateFlips: +(sum((r) => r.debateFlips) / rows.length).toFixed(1),
      avgStPetersVp: +(sum((r) => r.stPetersVp) / rows.length).toFixed(1),
      invadersActedGames: rows.filter((r) => r.invaderActs > 0).length,
      invaderMovesTotal: sum((r) => r.invaderActs),
      invasionsPlayedTotal: sum((r) => r.invasionsPlayed),
      sueForPeaceTotal: sum((r) => r.sueForPeace),
      papalBullTotal: sum((r) => r.papalBull)
    };
    console.log('[2P ANALYTICS] ' + JSON.stringify(profile));

    // Robustness invariants: every game ends, no bot ever gets stuck.
    expect(profile.notEnded).toBe(0);
    expect(profile.stuckTotal).toBe(0);
    expect(profile.chainBroken).toBe(0);
    // Competitiveness guard: the matchup must not be a walkover for either side
    // (the 2P bot was tuned from a 19-0 Papacy sweep to ~even — see the
    // Protestant publish-priority in bot-goals.js dispatchGoalAction). Loose
    // bound so the slim-VP, T9-decided games don't flake.
    expect(profile.wins.papacy).toBeGreaterThan(0);
    expect(profile.wins.protestant).toBeGreaterThan(0);
  }, 120000);
});
