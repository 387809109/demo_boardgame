import { describe, it, expect, beforeEach } from 'vitest';
import WerewolfGame, { WEREWOLF_ACTIONS } from './index.js';
import { PHASES } from './rules.js';

function createPlayers(count) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `player-${i + 1}`,
    nickname: `Player ${i + 1}`,
    isHost: i === 0
  }));
}

function advanceToNight(game, hostId) {
  let safety = 0;
  while (game.getState().phase !== PHASES.NIGHT && safety < 8) {
    if (game.getState().status === 'ended') break;
    game.executeMove({
      actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE,
      actionData: {},
      playerId: hostId
    });
    safety += 1;
  }
}

describe('WerewolfGame integration (P1 roles)', () => {
  let game;

  beforeEach(() => {
    game = new WerewolfGame('offline');
  });

  it('should link lovers and chain death when one dies', () => {
    const players = createPlayers(6);
    game.start({
      players,
      gameType: 'werewolf',
      options: {
        enabledRoles: ['cupid', 'werewolf', 'villager'],
        roleCounts: { cupid: 1, werewolf: 1, villager: 4 }
      }
    });

    const state = game.getState();
    const cupid = state.players.find(p => p.roleId === 'cupid');
    const wolf = state.players.find(p => p.roleId === 'werewolf');
    const [loverA, loverB] = state.players.filter(p => p.roleId === 'villager').slice(0, 2);

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.NIGHT_CUPID_LINK,
      actionData: { targetIds: [loverA.id, loverB.id] },
      playerId: cupid.id
    });

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.NIGHT_WOLF_KILL,
      actionData: { targetId: loverA.id },
      playerId: wolf.id
    });

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE,
      actionData: {},
      playerId: players[0].id
    });

    const next = game.getState();
    expect(next.deaths).toContain(loverA.id);
    expect(next.deaths).toContain(loverB.id);
  });

  it('should allow piper to win after charming all alive players', () => {
    const players = createPlayers(4);
    game.start({
      players,
      gameType: 'werewolf',
      options: {
        enabledRoles: ['piper', 'werewolf', 'villager'],
        roleCounts: { piper: 1, werewolf: 1, villager: 2 }
      }
    });

    const hostId = players[0].id;
    const getRole = roleId => game.getState().players.find(p => p.roleId === roleId);
    const piper = getRole('piper');
    const wolf = getRole('werewolf');

    const targets = game.getState().players.filter(p => p.id !== piper.id).map(p => p.id);
    for (const targetId of targets) {
      game.executeMove({
        actionType: WEREWOLF_ACTIONS.NIGHT_PIPER_CHARM,
        actionData: { targetId },
        playerId: piper.id
      });
      game.executeMove({
        actionType: WEREWOLF_ACTIONS.NIGHT_SKIP,
        actionData: {},
        playerId: wolf.id
      });
      game.executeMove({
        actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE,
        actionData: {},
        playerId: hostId
      });
      advanceToNight(game, hostId);
    }

    const final = game.getState();
    expect(final.status).toBe('ended');
    expect(final.winner).toBe('neutral');
    expect(final.winReason).toBe('piper_charm');
  });

  it('should return suspicious when sheriff checks a werewolf', () => {
    const players = createPlayers(6);
    game.start({
      players,
      gameType: 'werewolf',
      options: {
        enabledRoles: ['sheriff', 'werewolf', 'villager'],
        roleCounts: { sheriff: 1, werewolf: 1, villager: 4 }
      }
    });

    const state = game.getState();
    const sheriff = state.players.find(p => p.roleId === 'sheriff');
    const wolf = state.players.find(p => p.roleId === 'werewolf');

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.NIGHT_SHERIFF_CHECK,
      actionData: { targetId: wolf.id },
      playerId: sheriff.id
    });

    const next = game.getState();
    expect(next.sheriffResults[sheriff.id].suspicion).toBe('suspicious');
  });

  it('should apply captain double vote after reveal', () => {
    const players = createPlayers(4);
    game.start({
      players,
      gameType: 'werewolf',
      options: {
        enabledRoles: ['captain', 'werewolf', 'villager'],
        roleCounts: { captain: 1, werewolf: 1, villager: 2 }
      }
    });

    const hostId = players[0].id;
    const state = game.getState();
    const captain = state.players.find(p => p.roleId === 'captain');
    const wolf = state.players.find(p => p.roleId === 'werewolf');
    const villager = state.players.find(p => p.roleId === 'villager' && p.id !== captain.id);
    const otherVillager = state.players.find(p => p.roleId === 'villager' && p.id !== captain.id && p.id !== villager.id);

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.NIGHT_SKIP,
      actionData: {},
      playerId: wolf.id
    });
    game.executeMove({
      actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE,
      actionData: {},
      playerId: hostId
    });
    game.executeMove({
      actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE,
      actionData: {},
      playerId: hostId
    });

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.DAY_REVEAL_CAPTAIN,
      actionData: {},
      playerId: captain.id
    });
    expect(game.getState().captainRevealed).toBe(true);

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE,
      actionData: {},
      playerId: hostId
    });
    let safety = 0;
    while (game.getState().phase !== PHASES.DAY_VOTE && safety < 4) {
      game.executeMove({
        actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE,
        actionData: {},
        playerId: hostId
      });
      safety += 1;
    }

    game.executeMove({
      actionType: WEREWOLF_ACTIONS.DAY_VOTE,
      actionData: { targetId: wolf.id },
      playerId: captain.id
    });
    game.executeMove({
      actionType: WEREWOLF_ACTIONS.DAY_VOTE,
      actionData: { targetId: wolf.id },
      playerId: villager.id
    });
    game.executeMove({
      actionType: WEREWOLF_ACTIONS.DAY_VOTE,
      actionData: { targetId: villager.id },
      playerId: wolf.id
    });
    game.executeMove({
      actionType: WEREWOLF_ACTIONS.DAY_SKIP_VOTE,
      actionData: {},
      playerId: otherVillager.id
    });

    const next = game.getState();
    expect(next.dayVoteResult.targetId).toBe(wolf.id);
  });
});
