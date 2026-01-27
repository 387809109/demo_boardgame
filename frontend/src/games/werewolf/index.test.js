import { describe, it, expect, beforeEach } from 'vitest';
import WerewolfGame, { WEREWOLF_ACTIONS } from './index.js';
import { PHASES, TEAMS } from './rules.js';

function createPlayers(count) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `player-${i + 1}`,
    nickname: `Player ${i + 1}`,
    isHost: i === 0
  }));
}

describe('WerewolfGame', () => {
  let game;

  beforeEach(() => {
    game = new WerewolfGame('offline');
  });

  it('should initialize with night phase and assigned roles', () => {
    const players = createPlayers(6);
    game.start({ players, gameType: 'werewolf', options: {} });

    const state = game.getState();
    expect(state.phase).toBe(PHASES.NIGHT);
    expect(state.players.every(p => p.roleId)).toBe(true);
  });

  it('should resolve night deaths on phase advance', () => {
    const players = createPlayers(6);
    game.start({ players, gameType: 'werewolf', options: {} });

    const state = game.getState();
    const wolf = state.players.find(p => p.team === TEAMS.WEREWOLF);
    const target = state.players.find(p => p.id !== wolf.id && p.alive);

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.NIGHT_WOLF_KILL,
      actionData: { targetId: target.id },
      playerId: wolf.id
    });

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE,
      actionData: {},
      playerId: state.players[0].id
    });

    const next = game.getState();
    expect(next.phase).toBe(PHASES.DAY_ANNOUNCE);
    expect(next.deaths).toContain(target.id);
  });

  it('should end game when all wolves are dead', () => {
    const players = createPlayers(6);
    game.start({ players, gameType: 'werewolf', options: {} });

    const state = game.getState();
    const wolves = state.players.filter(p => p.team === TEAMS.WEREWOLF);
    wolves.forEach(wolf => {
      state.playerMap[wolf.id].alive = false;
    });

    const end = game.checkGameEnd(state);
    expect(end.ended).toBe(true);
    expect(end.winner).toBe(TEAMS.VILLAGE);
  });

  it('should reveal wolves to wolves in visible state', () => {
    const players = createPlayers(6);
    game.start({ players, gameType: 'werewolf', options: {} });

    const state = game.getState();
    const wolf = state.players.find(p => p.team === TEAMS.WEREWOLF);
    const visible = game.getVisibleState(wolf.id);
    const visibleWolfIds = Object.keys(visible.rolesVisible);

    expect(visibleWolfIds.length).toBeGreaterThan(0);
    expect(visibleWolfIds).toContain(wolf.id);
    const hiddenPlayer = visible.players.find(p => p.id !== wolf.id);
    expect(hiddenPlayer.roleId).toBeUndefined();
    expect(hiddenPlayer.team).toBeUndefined();
  });
});
