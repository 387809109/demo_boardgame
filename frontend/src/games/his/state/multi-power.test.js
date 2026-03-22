/**
 * Here I Stand — Multi-Power (3-5 Player) Tests
 */
import { describe, it, expect } from 'vitest';
import { buildInitialState } from './state-init.js';
import { getVisibleState } from './state-visible.js';
import {
  getPowerForPlayer, getPowersForPlayer, playerControlsPower
} from './state-helpers.js';
import { IMPULSE_ORDER, DEFAULT_POWER_ASSIGNMENTS } from '../constants.js';
import { HISGame } from '../index.js';
import { ACTION_TYPES } from '../actions/action-types.js';
import { TEST_PLAYERS } from '../test-helpers.js';

const PLAYERS_5 = TEST_PLAYERS.slice(0, 5);
const PLAYERS_4 = TEST_PLAYERS.slice(0, 4);
const PLAYERS_3 = TEST_PLAYERS.slice(0, 3);

// ── State Init ─────────────────────────────────────────────────

describe('buildInitialState — multi-power', () => {
  describe('5 players', () => {
    const state = buildInitialState(PLAYERS_5, {});

    it('assigns 5 players', () => {
      expect(state.players).toHaveLength(5);
    });

    it('assigns correct powers to each player', () => {
      expect(state.players[0].powers).toEqual(['ottoman']);
      expect(state.players[1].powers).toEqual(['hapsburg']);
      expect(state.players[2].powers).toEqual(['england']);
      expect(state.players[3].powers).toEqual(['france']);
      expect(state.players[4].powers).toEqual(['papacy', 'protestant']);
    });

    it('sets primary power (backward compat)', () => {
      expect(state.players[4].power).toBe('papacy');
      expect(state.powerByPlayer['p5']).toBe('papacy');
    });

    it('maps all 6 powers to players in playerByPower', () => {
      for (const power of IMPULSE_ORDER) {
        expect(state.playerByPower[power]).toBeTruthy();
      }
      expect(state.playerByPower['papacy']).toBe('p5');
      expect(state.playerByPower['protestant']).toBe('p5');
    });

    it('builds powersForPlayer correctly', () => {
      expect(state.powersForPlayer['p1']).toEqual(['ottoman']);
      expect(state.powersForPlayer['p5']).toEqual(['papacy', 'protestant']);
    });
  });

  describe('4 players', () => {
    const state = buildInitialState(PLAYERS_4, {});

    it('assigns correct powers', () => {
      expect(state.players[0].powers).toEqual(['ottoman']);
      expect(state.players[1].powers).toEqual(['hapsburg']);
      expect(state.players[2].powers).toEqual(['england', 'protestant']);
      expect(state.players[3].powers).toEqual(['france', 'papacy']);
    });

    it('maps all 6 powers to players', () => {
      for (const power of IMPULSE_ORDER) {
        expect(state.playerByPower[power]).toBeTruthy();
      }
    });
  });

  describe('3 players', () => {
    const state = buildInitialState(PLAYERS_3, {});

    it('assigns correct powers', () => {
      expect(state.players[0].powers).toEqual(['ottoman']);
      expect(state.players[1].powers).toEqual(['hapsburg', 'england']);
      expect(state.players[2].powers).toEqual(['france', 'papacy', 'protestant']);
    });

    it('maps all 6 powers to players', () => {
      for (const power of IMPULSE_ORDER) {
        expect(state.playerByPower[power]).toBeTruthy();
      }
    });

    it('p3 controls france, papacy, and protestant', () => {
      expect(state.powersForPlayer['p3']).toEqual(
        ['france', 'papacy', 'protestant']
      );
    });
  });

  describe('6 players (regression)', () => {
    const state = buildInitialState(TEST_PLAYERS, {});

    it('assigns 1 power per player', () => {
      for (const player of state.players) {
        expect(player.powers).toHaveLength(1);
        expect(player.powers[0]).toBe(player.power);
      }
    });

    it('powersForPlayer each has exactly 1', () => {
      for (const pid of Object.keys(state.powersForPlayer)) {
        expect(state.powersForPlayer[pid]).toHaveLength(1);
      }
    });
  });

  describe('custom assignment', () => {
    it('uses options.powerAssignment if provided', () => {
      const custom = [
        ['ottoman', 'hapsburg', 'england'],
        ['france', 'papacy', 'protestant']
      ];
      const state = buildInitialState(
        [TEST_PLAYERS[0], TEST_PLAYERS[1]],
        { powerAssignment: custom }
      );
      expect(state.players[0].powers).toEqual(custom[0]);
      expect(state.players[1].powers).toEqual(custom[1]);
    });
  });
});

// ── State Helpers ──────────────────────────────────────────────

describe('multi-power helper functions', () => {
  const state = buildInitialState(PLAYERS_3, {});

  describe('getPowersForPlayer', () => {
    it('returns array for multi-power player', () => {
      expect(getPowersForPlayer(state, 'p3')).toEqual(
        ['france', 'papacy', 'protestant']
      );
    });

    it('returns single-element array for single-power player', () => {
      expect(getPowersForPlayer(state, 'p1')).toEqual(['ottoman']);
    });

    it('returns empty array for unknown player', () => {
      expect(getPowersForPlayer(state, 'unknown')).toEqual([]);
    });

    it('falls back to powerByPlayer when powersForPlayer missing', () => {
      const legacy = { powerByPlayer: { p1: 'ottoman' } };
      expect(getPowersForPlayer(legacy, 'p1')).toEqual(['ottoman']);
    });
  });

  describe('playerControlsPower', () => {
    it('returns true for controlled power', () => {
      expect(playerControlsPower(state, 'p3', 'france')).toBe(true);
      expect(playerControlsPower(state, 'p3', 'papacy')).toBe(true);
      expect(playerControlsPower(state, 'p3', 'protestant')).toBe(true);
    });

    it('returns false for uncontrolled power', () => {
      expect(playerControlsPower(state, 'p3', 'ottoman')).toBe(false);
      expect(playerControlsPower(state, 'p1', 'hapsburg')).toBe(false);
    });
  });

  describe('getPowerForPlayer (backward compat)', () => {
    it('returns primary power', () => {
      expect(getPowerForPlayer(state, 'p3')).toBe('france');
      expect(getPowerForPlayer(state, 'p1')).toBe('ottoman');
    });
  });
});

// ── Visible State ──────────────────────────────────────────────

describe('getVisibleState — multi-power', () => {
  const state = buildInitialState(PLAYERS_3, {});
  // Give each power some cards
  for (const power of IMPULSE_ORDER) {
    state.hands[power] = [100 + IMPULSE_ORDER.indexOf(power)];
  }

  it('reveals all controlled powers hands for multi-power player', () => {
    const visible = getVisibleState(state, 'p3');
    // p3 controls france, papacy, protestant
    expect(Array.isArray(visible.hands['france'])).toBe(true);
    expect(Array.isArray(visible.hands['papacy'])).toBe(true);
    expect(Array.isArray(visible.hands['protestant'])).toBe(true);
  });

  it('hides non-controlled powers hands', () => {
    const visible = getVisibleState(state, 'p3');
    expect(typeof visible.hands['ottoman']).toBe('number');
    expect(typeof visible.hands['hapsburg']).toBe('number');
    expect(typeof visible.hands['england']).toBe('number');
  });

  it('6-player regression: shows only own hand', () => {
    const state6 = buildInitialState(TEST_PLAYERS, {});
    for (const power of IMPULSE_ORDER) {
      state6.hands[power] = [100];
    }
    const visible = getVisibleState(state6, 'p1');
    expect(Array.isArray(visible.hands['ottoman'])).toBe(true);
    expect(typeof visible.hands['hapsburg']).toBe('number');
  });
});

// ── Validation — Multi-Power ───────────────────────────────────

describe('validateMove — multi-power', () => {
  const game = new HISGame('offline');

  function makeState(playerCount, overrides = {}) {
    const players = TEST_PLAYERS.slice(0, playerCount);
    const state = buildInitialState(players, {});
    return { ...state, ...overrides };
  }

  describe('action phase — impulse check', () => {
    it('allows player to act when activePower is their power', () => {
      const state = makeState(3, {
        phase: 'action', activePower: 'ottoman', impulseIndex: 0
      });
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p1' }, state
      );
      expect(result.valid).toBe(true);
    });

    it('allows multi-power player when activePower is one of theirs', () => {
      // p2 controls hapsburg + england in 3-player
      const state = makeState(3, {
        phase: 'action', activePower: 'england', impulseIndex: 2
      });
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p2' }, state
      );
      expect(result.valid).toBe(true);
    });

    it('rejects player when activePower is not theirs', () => {
      const state = makeState(3, {
        phase: 'action', activePower: 'ottoman', impulseIndex: 0
      });
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p2' }, state
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Not your impulse');
    });
  });

  describe('spring deployment — impulse check', () => {
    it('allows multi-power player for their power', () => {
      const state = makeState(3, {
        phase: 'spring_deployment',
        activePower: 'hapsburg',
        impulseIndex: 1,
        springDeploymentDone: {}
      });
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p2' }, state
      );
      expect(result.valid).toBe(true);
    });

    it('rejects when activePower is not this player', () => {
      const state = makeState(3, {
        phase: 'spring_deployment',
        activePower: 'france',
        impulseIndex: 3,
        springDeploymentDone: {}
      });
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p1' }, state
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('diplomacy — forPower routing', () => {
    it('allows player to act for a controlled power', () => {
      // p3 controls france+papacy+protestant in 3-player
      const state = makeState(3, {
        phase: 'diplomacy',
        diplomacySegment: 'declarations_of_war',
        diplomacyActed: {}
      });
      const result = game.validateMove({
        actionType: ACTION_TYPES.PASS,
        actionData: { forPower: 'papacy' },
        playerId: 'p3'
      }, state);
      expect(result.valid).toBe(true);
    });

    it('rejects acting for uncontrolled power', () => {
      const state = makeState(3, {
        phase: 'diplomacy',
        diplomacySegment: 'declarations_of_war',
        diplomacyActed: {}
      });
      const result = game.validateMove({
        actionType: ACTION_TYPES.PASS,
        actionData: { forPower: 'ottoman' },
        playerId: 'p3'
      }, state);
      expect(result.valid).toBe(false);
    });
  });

  describe('6-player regression', () => {
    it('works identically for 6-player game', () => {
      const state = makeState(6, {
        phase: 'action', activePower: 'ottoman', impulseIndex: 0
      });
      const valid = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p1' }, state
      );
      expect(valid.valid).toBe(true);

      const invalid = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p2' }, state
      );
      expect(invalid.valid).toBe(false);
    });
  });
});
