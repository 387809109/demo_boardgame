/**
 * Here I Stand — Full-bot batch analysis (gameplay-quality signals)
 *
 * On-demand tool (NOT a regression — the describe is .skip by default so it
 * doesn't slow CI). Un-skip and run explicitly to regenerate the numbers behind
 * a docs/games/his/bot_anomalies/ report:
 *
 *   npx vitest run src/games/his/ai/bot-analysis.test.js
 *
 * Drives the REAL bot loop (scheduleBotAction) over N seeded all-bot games to
 * completion and aggregates per-game signals: winner/reason, turns, final VP,
 * religious pressure, wars vs. battles per power, and stuck/chain-broken counts.
 * Same mechanism as bot-fullgame.test.js (vitest fake timers).
 */

import { describe, it, vi, beforeEach, afterEach } from 'vitest';
import { HISGame } from '../index.js';
import { scheduleBotAction } from './bot-controller.js';
import { countProtestantSpaces } from '../state/victory-checks.js';

const ALL_POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];
const BATTLE_EVENTS = new Set(['field_battle', 'assault', 'naval_combat']);

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

function analyzeSeed(seed, cap = 50000) {
  const orig = { log: console.log, warn: console.warn, error: console.error, random: Math.random };
  let chainBroken = 0, stuck = 0;
  const brokenMsgs = [];
  console.log = () => {};
  const stuckMsgs = [];
  console.warn = (...a) => {
    const s = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    if (s.includes('[BOT STUCK]')) { stuck++; stuckMsgs.push(s.slice(0, 180)); }
  };
  console.error = (...a) => {
    const s = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    if (s.includes('[BOT CHAIN BROKEN]')) { chainBroken++; brokenMsgs.push(s.slice(0, 280)); }
  };
  Math.random = mulberry32(seed);

  let game;
  try {
    game = makeAllBotGame(seed);
    const kick = () => scheduleBotAction(game, (move) => {
      const r = game.executeMove(move);
      if (r.success) kick();
      return r;
    });
    kick();
    let iters = 0;
    while (game.getState().status === 'playing' &&
           vi.getTimerCount() > 0 && iters < cap) {
      vi.runOnlyPendingTimers();
      iters++;
    }
  } finally {
    Object.assign(console, { log: orig.log, warn: orig.warn, error: orig.error });
    Math.random = orig.random;
  }

  const state = game.getState();
  const result = game.checkGameEnd(state);
  const log = state.eventLog || [];

  // Per-power tallies of wars declared vs. battles initiated (a "declares war
  // but never attacks" anomaly shows up as warsBy >> battlesBy).
  const warsBy = {}, battlesBy = {}, eventCounts = {};
  for (const p of ALL_POWERS) { warsBy[p] = 0; battlesBy[p] = 0; }
  for (const e of log) {
    eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
    if (e.type === 'war_declared' && e.data?.attacker) warsBy[e.data.attacker]++;
    if (BATTLE_EVENTS.has(e.type)) {
      const atk = e.data?.attackerPower || e.data?.power;
      if (atk && battlesBy[atk] != null) battlesBy[atk]++;
    }
  }

  const vp = {};
  for (const r of (result.rankings || [])) vp[r.power] = r.vp;

  return {
    seed, status: state.status, turn: state.turn,
    winner: result.winnerPower, reason: result.reason,
    vp, protestantSpaces: countProtestantSpaces(state),
    wars: (state.wars || []).length,
    warsBy, battlesBy,
    battlesTotal: ALL_POWERS.reduce((s, p) => s + battlesBy[p], 0),
    warDeclares: eventCounts.war_declared || 0,
    debates: eventCounts.call_debate || 0,
    reformations: eventCounts.reformation || 0,
    stuck, chainBroken, brokenMsgs, stuckMsgs
  };
}

describe.skip('HIS full-bot batch analysis (on-demand)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs N seeds and prints an aggregate report', () => {
    const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i);
    const rows = SEEDS.map(s => analyzeSeed(s));

    const log = (...a) => console.info('[ANALYSIS]', ...a);
    log('seed | turn | winner | reason | winnerVP | protSpaces | wars | battles | stuck | broken');
    for (const r of rows) {
      log(`${r.seed} | T${r.turn} | ${r.winner} | ${r.reason} | ${r.vp[r.winner]} | ` +
        `${r.protestantSpaces} | ${r.warDeclares} | ${r.battlesTotal} | ${r.stuck} | ${r.chainBroken}`);
    }

    // Aggregates
    const winCount = {}, reasonCount = {};
    let stuckSum = 0, brokenSum = 0, turnSum = 0, protSum = 0, warSum = 0, battleSum = 0;
    const warsBy = {}, battlesBy = {};
    for (const p of ALL_POWERS) { winCount[p] = 0; warsBy[p] = 0; battlesBy[p] = 0; }
    for (const r of rows) {
      winCount[r.winner] = (winCount[r.winner] || 0) + 1;
      reasonCount[r.reason] = (reasonCount[r.reason] || 0) + 1;
      stuckSum += r.stuck; brokenSum += r.chainBroken;
      turnSum += r.turn; protSum += r.protestantSpaces;
      warSum += r.warDeclares; battleSum += r.battlesTotal;
      for (const p of ALL_POWERS) { warsBy[p] += r.warsBy[p]; battlesBy[p] += r.battlesBy[p]; }
    }
    const n = rows.length;
    log('—— aggregate ——');
    log('winner distribution:', JSON.stringify(winCount));
    log('win reasons:', JSON.stringify(reasonCount));
    log(`avg turn=${(turnSum / n).toFixed(1)} avg protSpaces=${(protSum / n).toFixed(1)} ` +
      `avg warDeclares=${(warSum / n).toFixed(1)} avg battles=${(battleSum / n).toFixed(1)}`);
    log('wars declared by power:', JSON.stringify(warsBy));
    log('battles initiated by power:', JSON.stringify(battlesBy));
    log(`TOTAL stuck=${stuckSum} chainBroken=${brokenSum}`);
    for (const r of rows) {
      if (r.chainBroken > 0) {
        for (const m of r.stuckMsgs) log(`STUCK seed=${r.seed}:`, m);
        for (const m of r.brokenMsgs) log(`BROKEN seed=${r.seed}:`, m);
      }
    }
  }, 180000);
});
