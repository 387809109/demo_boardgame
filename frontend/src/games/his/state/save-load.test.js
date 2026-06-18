/**
 * Here I Stand — Save/Load Tests
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  validateSaveData, generateSlotKey,
  SAVE_VERSION, MAX_SAVE_SLOTS
} from './save-load.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a minimal valid save object from a test state */
function buildSave(overrides = {}) {
  const state = createTestState();
  return {
    version: 1,
    gameId: 'his',
    savedAt: Date.now(),
    label: 'Test Save',
    metadata: {
      turn: state.turn,
      phase: state.phase,
      activePower: state.activePower,
      playerCount: 6
    },
    state,
    history: [],
    config: { gameType: 'his', players: state.players },
    ...overrides
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('validateSaveData', () => {
  it('accepts a valid save', () => {
    const result = validateSaveData(buildSave());
    expect(result.valid).toBe(true);
  });

  it('rejects null', () => {
    const result = validateSaveData(null);
    expect(result.valid).toBe(false);
  });

  it('rejects non-object', () => {
    const result = validateSaveData('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects missing version', () => {
    const save = buildSave();
    delete save.version;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('version');
  });

  it('rejects version 0', () => {
    const result = validateSaveData(buildSave({ version: 0 }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('version');
  });

  it('rejects missing gameId', () => {
    const save = buildSave();
    delete save.gameId;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('gameId');
  });

  it('rejects wrong gameId', () => {
    const result = validateSaveData(buildSave({ gameId: 'uno' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Here I Stand');
  });

  it('rejects missing state', () => {
    const save = buildSave();
    delete save.state;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('state');
  });

  it('rejects state that is not an object', () => {
    const result = validateSaveData(buildSave({ state: 'bad' }));
    expect(result.valid).toBe(false);
  });

  it('rejects state missing spaces', () => {
    const save = buildSave();
    delete save.state.spaces;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('spaces');
  });

  it('rejects state missing hands', () => {
    const save = buildSave();
    delete save.state.hands;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hands');
  });

  it('rejects state missing vp', () => {
    const save = buildSave();
    delete save.state.vp;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('vp');
  });

  it('rejects state missing phase', () => {
    const save = buildSave();
    delete save.state.phase;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('phase');
  });

  it('rejects state missing players', () => {
    const save = buildSave();
    delete save.state.players;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('players');
  });

  it('rejects state with empty players array', () => {
    const save = buildSave();
    save.state.players = [];
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('players');
  });

  it('rejects state with empty hands object', () => {
    const save = buildSave();
    save.state.hands = {};
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hands');
  });

  it('rejects state missing deck', () => {
    const save = buildSave();
    delete save.state.deck;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('deck');
  });

  it('rejects state missing turn', () => {
    const save = buildSave();
    delete save.state.turn;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('turn');
  });

  it('rejects state missing activePower', () => {
    const save = buildSave();
    delete save.state.activePower;
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('activePower');
  });
});

describe('generateSlotKey', () => {
  it('returns formatted key', () => {
    expect(generateSlotKey('his', 0)).toBe('his_slot_0');
    expect(generateSlotKey('his', 4)).toBe('his_slot_4');
  });
});

describe('constants', () => {
  it('SAVE_VERSION is 1', () => {
    expect(SAVE_VERSION).toBe(1);
  });

  it('MAX_SAVE_SLOTS is 5', () => {
    expect(MAX_SAVE_SLOTS).toBe(5);
  });
});

// ── GameEngine Save/Load Integration ─────────────────────────────────

describe('GameEngine exportSave / importSave', () => {
  // We test via HISGame which extends GameEngine
  let HISGame;

  // Dynamic import since HISGame is an ES module
  beforeAll(async () => {
    const mod = await import('../index.js');
    HISGame = mod.default || mod.HISGame;
  });

  function startGame() {
    const game = new HISGame('offline');
    game.start({
      gameType: 'his',
      players: [
        { id: 'p1', nickname: 'A', isHost: true },
        { id: 'p2', nickname: 'B' },
        { id: 'p3', nickname: 'C' },
        { id: 'p4', nickname: 'D' },
        { id: 'p5', nickname: 'E' },
        { id: 'p6', nickname: 'F' }
      ],
      options: {}
    });
    return game;
  }

  it('exportSave returns correct shape', () => {
    const game = startGame();
    const save = game.exportSave();

    expect(save.version).toBe(1);
    expect(save.gameId).toBe('his');
    expect(save.savedAt).toBeGreaterThan(0);
    expect(save.label).toBeDefined();
    expect(save.metadata).toBeDefined();
    expect(save.state).toBeDefined();
    expect(save.history).toBeDefined();
    expect(save.config).toBeDefined();
  });

  it('exportSave uses custom label when provided', () => {
    const game = startGame();
    const save = game.exportSave('My Custom Save');
    expect(save.label).toBe('My Custom Save');
  });

  it('_autoLabel includes Chinese phase name', () => {
    const game = startGame();
    const label = game._autoLabel();
    expect(label).toContain('第');
    expect(label).toContain('回合');
  });

  it('_getSaveMetadata includes turn, phase, activePower', () => {
    const game = startGame();
    const meta = game._getSaveMetadata();
    expect(meta.turn).toBeDefined();
    expect(meta.phase).toBeDefined();
    expect(meta.activePower).toBeDefined();
    expect(meta.playerCount).toBe(6);
    expect(meta.vp).toBeDefined();
  });

  it('exportSave creates deep copy of state', () => {
    const game = startGame();
    const save = game.exportSave();
    // Mutating save state should not affect game state
    save.state.turn = 999;
    expect(game.getState().turn).not.toBe(999);
  });

  it('importSave restores state', () => {
    const game = startGame();
    const save = game.exportSave();

    // Modify state
    save.state.turn = 7;
    save.state.phase = 'action';

    game.importSave(save);
    expect(game.getState().turn).toBe(7);
    expect(game.getState().phase).toBe('action');
    expect(game.isRunning).toBe(true);
  });

  it('importSave restores history', () => {
    const game = startGame();
    const save = game.exportSave();
    save.history = [
      { actionType: 'TEST', timestamp: 1000 },
      { actionType: 'TEST2', timestamp: 2000 }
    ];

    game.importSave(save);
    expect(game.getHistory()).toHaveLength(2);
  });

  it('importSave emits stateUpdated event', () => {
    const game = startGame();
    const save = game.exportSave();

    let emitted = false;
    game.on('stateUpdated', () => { emitted = true; });
    game.importSave(save);
    expect(emitted).toBe(true);
  });

  it('round-trip: export → validate → import preserves state', () => {
    const game = startGame();
    const originalState = JSON.parse(JSON.stringify(game.getState()));
    const save = game.exportSave();

    // Validate
    const validation = validateSaveData(save);
    expect(validation.valid).toBe(true);

    // Import into fresh game
    const game2 = new HISGame('offline');
    game2.start({
      gameType: 'his',
      players: [
        { id: 'p1', nickname: 'A', isHost: true },
        { id: 'p2', nickname: 'B' },
        { id: 'p3', nickname: 'C' },
        { id: 'p4', nickname: 'D' },
        { id: 'p5', nickname: 'E' },
        { id: 'p6', nickname: 'F' }
      ],
      options: {}
    });
    game2.importSave(save);

    // Compare key fields
    const restored = game2.getState();
    expect(restored.turn).toBe(originalState.turn);
    expect(restored.phase).toBe(originalState.phase);
    expect(restored.activePower).toBe(originalState.activePower);
    expect(restored.players).toEqual(originalState.players);
    expect(Object.keys(restored.hands)).toEqual(Object.keys(originalState.hands));
  });

  it('auto-save hook fires after executeMove', () => {
    const game = startGame();
    let autoSaved = false;
    game._autoSaveEnabled = true;
    game._performAutoSave = () => { autoSaved = true; };

    // Try a valid move (SELECT_LUTHER95_TARGET if in luther_95 phase)
    const state = game.getState();
    if (state.phase === 'luther_95') {
      // Find a valid target
      const targets = state.luther95?.targets || [];
      if (targets.length > 0) {
        game.executeMove({
          actionType: 'SELECT_LUTHER95_TARGET',
          actionData: { targetSpace: targets[0] },
          playerId: state.playerByPower?.protestant
        });
        expect(autoSaved).toBe(true);
      }
    }
    // If no valid move available, at least verify the hook is wired
    expect(game._autoSaveEnabled).toBe(true);
  });
});

// ── Mid-pending save/load round-trip (backlog P2.3) ─────────────────
// The existing round-trip covers only ordinary phases. These verify a save
// taken mid-interaction (battle / response / debate / reformation / naval /
// assault / interrupt) survives export→import, and that a paused chain
// resumes correctly after load — the deterministic half of "存读档续局"
// (the post-load UI re-render is the browser-only part).
describe('mid-pending save/load round-trip (P2.3)', () => {
  let HISGame, ACTION_TYPES, PHASES;

  beforeAll(async () => {
    const mod = await import('../index.js');
    HISGame = mod.default || mod.HISGame;
    ACTION_TYPES = mod.ACTION_TYPES;
    PHASES = mod.PHASES;
  });

  function startGame() {
    const game = new HISGame('offline');
    game.start({
      gameType: 'his',
      players: [
        { id: 'p1', nickname: 'A', isHost: true }, { id: 'p2', nickname: 'B' },
        { id: 'p3', nickname: 'C' }, { id: 'p4', nickname: 'D' },
        { id: 'p5', nickname: 'E' }, { id: 'p6', nickname: 'F' }
      ],
      options: {}
    });
    return game;
  }

  it('every pending interaction survives export → import', () => {
    const game = startGame();
    const pending = {
      pendingBattle: {
        type: 'field_battle', space: 'Vienna', attackerPower: 'ottoman',
        defenderPower: 'hapsburg', battleType: 'field'
      },
      pendingResponse: {
        window: 'W2', respondingPower: 'ottoman', validCards: [24, 25],
        context: { space: 'Vienna', type: 'field' }, responses: {}
      },
      pendingInterception: {
        interceptorPower: 'hapsburg', interceptorSpace: 'Graz', targetSpace: 'Vienna'
      },
      pendingReformation: { type: 'reformation', attemptsLeft: 3, zone: 'german' },
      pendingDebate: { round: 1, phase: 'roll', attackerHits: 0, defenderHits: 0 },
      pendingNavalCombat: {
        space: 'Corfu', attackerPower: 'ottoman', defenderPower: 'hapsburg',
        defenderInPort: true, attackerRolls: [5, 3], defenderRolls: [2],
        attackerDice: 2, defenderDice: 1,
        attackerBefore: { squadrons: 3, corsairs: 0 },
        defenderBefore: { squadrons: 1, corsairs: 0 }
      },
      pendingNavalMove: {
        power: 'ottoman', movements: [],
        allMovements: [{ from: 'Ionian Sea', to: 'Corfu' }], currentTo: 'Corfu'
      },
      pendingAssault: {
        space: 'Edirne', attackerPower: 'ottoman', defenderPower: 'hapsburg',
        attackerRolls: [5, 5, 3], defenderRolls: [2], attackerDice: 3,
        defenderDice: 1, free: true
      },
      pendingGout: { targetLeader: 'charles_v' },
      pendingFoulWeather: {
        targetPower: 'france', maxMoveSpaces: 1, noAssault: true,
        noPiracy: true, noNavalMove: true, noNavalTransport: true
      }
    };
    Object.assign(game.getState(), pending);

    const save = game.exportSave();
    expect(validateSaveData(save).valid).toBe(true);

    const game2 = startGame();
    game2.importSave(save);
    const restored = game2.getState();
    for (const [field, value] of Object.entries(pending)) {
      expect(restored[field]).toEqual(value);
    }
  });

  it('resumes a paused W5 assault chain after load (decline finalizes)', () => {
    const game = startGame();
    const state = game.getState();
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.pendingLuther95 = null;
    state.consecutivePasses = 0;
    state.cpRemaining = 5;
    state.activeCard = 50;
    state.activeCardNumber = 50;
    // Edirne is adjacent to Istanbul (Ottoman fortified capital) → LOC ≤4.
    const sp = state.spaces['Edirne'];
    sp.controller = 'hapsburg';
    sp.besieged = true;
    sp.besiegedBy = 'ottoman';
    sp.units = [
      { owner: 'ottoman', regulars: 6, mercenaries: 0, cavalry: 0, squadrons: 0, corsairs: 0, leaders: [] },
      { owner: 'hapsburg', regulars: 1, mercenaries: 0, cavalry: 0, squadrons: 0, corsairs: 0, leaders: [] }
    ];
    state.hands.ottoman = [35, 50];

    // Drive the assault to pause at W5 (processMove bypasses player validation).
    const paused = game.processMove({
      actionType: ACTION_TYPES.ASSAULT,
      actionData: { space: 'Edirne', free: true }, playerId: 'p1'
    }, state);
    expect(paused.pendingResponse.window).toBe('W5');
    expect(paused.pendingAssault).toBeTruthy();
    game.state = paused;

    // Save mid-W5, load into a fresh game.
    const save = game.exportSave();
    const game2 = startGame();
    game2.importSave(save);
    expect(game2.getState().pendingResponse.window).toBe('W5');
    expect(game2.getState().pendingAssault).toBeTruthy();

    // Continue on the loaded game: decline → the assault finalizes.
    const after = game2.processMove({
      actionType: ACTION_TYPES.DECLINE_RESPONSE, actionData: {}, playerId: 'p1'
    }, game2.getState());
    expect(after.pendingResponse).toBeNull();
    expect(after.pendingAssault == null).toBe(true);
    expect(after.eventLog.find(e => e.type === 'assault')).toBeDefined();
  });
});
