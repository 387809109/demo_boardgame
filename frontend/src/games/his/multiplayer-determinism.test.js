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
