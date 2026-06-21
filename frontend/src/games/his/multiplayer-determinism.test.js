/**
 * Here I Stand — Multiplayer determinism (lockstep re-execution)
 *
 * The online sync model re-executes each relayed move via executeMove(action)
 * on the other client. For the two clients to stay in sync, re-executing the
 * SAME move against the SAME state must produce the SAME result — including
 * dice. Combat/reformation/event rolls draw from a state-backed PRNG
 * (state.rngState, see state/rng.js) so this holds. Before that fix the same
 * RESOLVE_BATTLE on the same state gave different outcomes (unseeded
 * Math.random), which would desync multiplayer on the first battle.
 */
import { describe, it, expect } from 'vitest';
import { HISGame } from './index.js';

const PLAYERS = [
  { id: 'p1', nickname: 'A', isHost: true }, { id: 'p2', nickname: 'B' },
  { id: 'p3', nickname: 'C' }, { id: 'p4', nickname: 'D' },
  { id: 'p5', nickname: 'E' }, { id: 'p6', nickname: 'F' }
];

const stack = (owner, r) => ({
  owner, regulars: r, mercenaries: 0, cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
});

/** A field-battle state ready to RESOLVE_BATTLE (no response cards → rolls now). */
function battleState(rngSeed) {
  const game = new HISGame('offline');
  game.start({ players: PLAYERS, gameType: 'his', options: { rngSeed } });
  const s = JSON.parse(JSON.stringify(game.getState()));
  s.phase = 'action'; s.activePower = 'ottoman'; s.pendingLuther95 = null;
  s.pendingResponse = null; s.cpRemaining = 5;
  s.spaces['Edirne'].units = [stack('ottoman', 5), stack('hapsburg', 5)];
  s.pendingBattle = { type: 'field_battle', space: 'Edirne', attackerPower: 'ottoman', defenderPower: 'hapsburg' };
  s.hands.ottoman = []; s.hands.hapsburg = [];
  return { game, s };
}

const outcome = (game, s) => {
  const out = game.processMove({ actionType: 'RESOLVE_BATTLE', actionData: {}, playerId: 'p1' }, s);
  const ev = (out.eventLog || []).filter(e => e.type === 'field_battle').slice(-1)[0]?.data || {};
  const reg = o => (out.spaces['Edirne'].units.find(u => u.owner === o) || { regulars: 0 }).regulars;
  return { aRolls: ev.attackerRolls, dRolls: ev.defenderRolls, ott: reg('ottoman'), hap: reg('hapsburg') };
};

describe('multiplayer determinism — re-executing a dice move', () => {
  it('RESOLVE_BATTLE on the same state is identical across re-execution', () => {
    const { game, s } = battleState(12345);
    // processMove does not mutate its input — re-run the same move on the same state.
    const a = outcome(game, JSON.parse(JSON.stringify(s)));
    const b = outcome(game, JSON.parse(JSON.stringify(s)));
    const c = outcome(game, JSON.parse(JSON.stringify(s)));
    expect(a.aRolls.length).toBeGreaterThan(0); // actually rolled
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('the roll advances rngState (a second roll from the resulting state differs)', () => {
    const { game, s } = battleState(999);
    const first = game.processMove({ actionType: 'RESOLVE_BATTLE', actionData: {}, playerId: 'p1' }, s);
    // rngState must have advanced (so successive moves aren't all the same roll).
    expect(first.rngState).not.toBe(s.rngState);
  });

  it('different seeds generally produce different dice (the PRNG is seeded, not fixed)', () => {
    const r1 = outcome(...Object.values(battleState(1)));
    const r2 = outcome(...Object.values(battleState(2)));
    expect(JSON.stringify(r1.aRolls)).not.toBe(JSON.stringify(r2.aRolls));
  });
});

// ── Two-client lockstep simulation ─────────────────────────────────
// Faithfully reproduce the online flow: the host broadcasts its initial state
// (applyStateUpdate on both), then each move is RELAYED as action-only
// (actionType + actionData, NO dice — exactly what sendGameAction puts on the
// wire). The remote re-executes it. The two states must remain byte-identical.
describe('two-client lockstep (host broadcast + action relay)', () => {
  const fresh = (seed) => {
    const g = new HISGame('offline');
    g.start({ players: PLAYERS, gameType: 'his', options: { rngSeed: seed } });
    return g;
  };

  /**
   * Set up host+remote from the SAME broadcast state (built by setupFn), relay
   * the dice `move` action-only, and assert both clients land identically.
   * Host and remote are *started* with different seeds to prove it is the
   * adopted broadcast state's rngState — not their own — that drives the sync.
   */
  function expectSynced(setupFn, move) {
    const host = fresh(111);
    const broadcast = setupFn(JSON.parse(JSON.stringify(host.getState())));
    host.applyStateUpdate(JSON.parse(JSON.stringify(broadcast)));

    const remote = fresh(222); // different start seed on purpose
    remote.applyStateUpdate(JSON.parse(JSON.stringify(broadcast)));

    // Host acts locally; only the action crosses the wire (no dice).
    const hostRes = host.executeMove({ ...move, playerId: 'p1' });
    expect(hostRes.success).toBe(true);
    const wireAction = {
      actionType: move.actionType,
      actionData: JSON.parse(JSON.stringify(move.actionData || {})),
      playerId: 'p1'
    };
    const remoteRes = remote.executeMove(wireAction);
    expect(remoteRes.success).toBe(true);

    // The whole game state — units, VP, eventLog event/data (dice!), rngState —
    // must match. Event-log `timestamp` is wall-clock metadata (Date.now), so it
    // legitimately differs by ~1ms between the two executeMove calls and is not
    // game state; strip it before comparing.
    const strip = (st) => {
      const c = JSON.parse(JSON.stringify(st));
      for (const e of (c.eventLog || [])) delete e.timestamp;
      return c;
    };
    expect(strip(remote.getState())).toEqual(strip(host.getState()));
    return host.getState();
  }

  const stk = (owner, r, sq = 0) => ({
    owner, regulars: r, mercenaries: 0, cavalry: 0, squadrons: sq, corsairs: 0, leaders: []
  });

  it('field battle (RESOLVE_BATTLE) stays in sync', () => {
    const end = expectSynced((s) => {
      s.phase = 'action'; s.activePower = 'ottoman'; s.pendingLuther95 = null;
      s.pendingResponse = null; s.cpRemaining = 5;
      s.spaces['Edirne'].units = [stk('ottoman', 5), stk('hapsburg', 5)];
      s.pendingBattle = { type: 'field_battle', space: 'Edirne', attackerPower: 'ottoman', defenderPower: 'hapsburg' };
      s.hands.ottoman = []; s.hands.hapsburg = [];
      return s;
    }, { actionType: 'RESOLVE_BATTLE', actionData: {} });
    expect((end.eventLog || []).some(e => e.type === 'field_battle')).toBe(true);
  });

  it('assault (ASSAULT) stays in sync', () => {
    expectSynced((s) => {
      s.phase = 'action'; s.activePower = 'ottoman'; s.pendingLuther95 = null;
      s.pendingResponse = null; s.cpRemaining = 5;
      const sp = s.spaces['Edirne'];
      sp.controller = 'hapsburg'; sp.besieged = true; sp.besiegedBy = 'ottoman';
      sp.units = [stk('ottoman', 6), stk('hapsburg', 1)];
      s.hands.ottoman = []; // no #35 → resolves immediately
      return s;
    }, { actionType: 'ASSAULT', actionData: { space: 'Edirne', free: true } });
  });

  it('naval combat (NAVAL_MOVE) stays in sync', () => {
    expectSynced((s) => {
      s.phase = 'action'; s.activePower = 'ottoman'; s.pendingLuther95 = null;
      s.pendingResponse = null; s.cpRemaining = 5;
      if (!s.wars.some(w => (w.a === 'ottoman' && w.b === 'hapsburg') || (w.a === 'hapsburg' && w.b === 'ottoman'))) {
        s.wars.push({ a: 'ottoman', b: 'hapsburg' });
      }
      for (const sp of Object.values(s.spaces)) sp.units = [];
      if (!s.spaces['Ionian Sea']) s.spaces['Ionian Sea'] = { units: [] };
      s.spaces['Ionian Sea'].units = [stk('ottoman', 0, 3)];
      s.spaces['Corfu'].units = [stk('hapsburg', 0, 1)];
      s.hands.ottoman = []; // no #34 → resolves immediately
      return s;
    }, { actionType: 'NAVAL_MOVE', actionData: { movements: [{ from: 'Ionian Sea', to: 'Corfu' }] } });
  });
});
