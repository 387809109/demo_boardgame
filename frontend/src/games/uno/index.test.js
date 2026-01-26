/**
 * UNO Game Logic Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UnoGame, UNO_ACTIONS } from './index.js';
import { CARD_TYPES } from './rules.js';

// Helper function to create test cards
function createCard(type, color = null, value = null, id = null) {
  return {
    id: id || `test-${type}-${color}-${value}-${Math.random()}`,
    type,
    color,
    value
  };
}

// Helper function to create a controlled game state
function createTestState(overrides = {}) {
  const defaultState = {
    players: [
      { id: 'player1', nickname: 'Player 1', cardCount: 7, score: 0 },
      { id: 'player2', nickname: 'Player 2', cardCount: 7, score: 0 },
      { id: 'player3', nickname: 'Player 3', cardCount: 7, score: 0 }
    ],
    currentPlayer: 'player1',
    currentPlayerIndex: 0,
    turnNumber: 1,
    status: 'playing',
    direction: 1,
    currentColor: 'red',
    hands: {
      player1: [
        createCard(CARD_TYPES.NUMBER, 'red', 5, 'p1-red-5'),
        createCard(CARD_TYPES.NUMBER, 'blue', 3, 'p1-blue-3'),
        createCard(CARD_TYPES.SKIP, 'red', null, 'p1-red-skip'),
        createCard(CARD_TYPES.DRAW_TWO, 'green', null, 'p1-green-draw2'),
        createCard(CARD_TYPES.WILD, null, null, 'p1-wild'),
        createCard(CARD_TYPES.WILD_DRAW_FOUR, null, null, 'p1-wild4'),
        createCard(CARD_TYPES.NUMBER, 'yellow', 9, 'p1-yellow-9')
      ],
      player2: [
        createCard(CARD_TYPES.NUMBER, 'red', 7, 'p2-red-7'),
        createCard(CARD_TYPES.NUMBER, 'blue', 5, 'p2-blue-5'),
        createCard(CARD_TYPES.REVERSE, 'yellow', null, 'p2-yellow-reverse'),
        createCard(CARD_TYPES.NUMBER, 'green', 2, 'p2-green-2'),
        createCard(CARD_TYPES.SKIP, 'blue', null, 'p2-blue-skip'),
        createCard(CARD_TYPES.DRAW_TWO, 'red', null, 'p2-red-draw2'),
        createCard(CARD_TYPES.NUMBER, 'yellow', 4, 'p2-yellow-4')
      ],
      player3: [
        createCard(CARD_TYPES.NUMBER, 'green', 1, 'p3-green-1'),
        createCard(CARD_TYPES.NUMBER, 'blue', 8, 'p3-blue-8'),
        createCard(CARD_TYPES.NUMBER, 'red', 2, 'p3-red-2'),
        createCard(CARD_TYPES.REVERSE, 'green', null, 'p3-green-reverse'),
        createCard(CARD_TYPES.WILD, null, null, 'p3-wild'),
        createCard(CARD_TYPES.NUMBER, 'yellow', 6, 'p3-yellow-6'),
        createCard(CARD_TYPES.NUMBER, 'red', 0, 'p3-red-0')
      ]
    },
    deck: [
      createCard(CARD_TYPES.NUMBER, 'blue', 1, 'deck-1'),
      createCard(CARD_TYPES.NUMBER, 'green', 4, 'deck-2'),
      createCard(CARD_TYPES.NUMBER, 'yellow', 7, 'deck-3'),
      createCard(CARD_TYPES.SKIP, 'yellow', null, 'deck-4'),
      createCard(CARD_TYPES.NUMBER, 'red', 8, 'deck-5')
    ],
    discardPile: [
      createCard(CARD_TYPES.NUMBER, 'red', 4, 'discard-1')
    ],
    drawPending: 0,
    lastAction: null,
    unoCalledBy: null,
    winner: null,
    options: {
      initialCards: 7,
      stackDrawCards: false,
      forcePlay: false,
      unoPenalty: 2,
      drawUntilMatch: false,
      sevenSwap: false,
      zeroRotate: false
    }
  };

  return { ...defaultState, ...overrides };
}

describe('UnoGame', () => {
  let game;

  beforeEach(() => {
    game = new UnoGame('offline');
  });

  describe('initialize', () => {
    it('should create a game with correct number of players', () => {
      const players = [
        { id: 'p1', nickname: 'Player 1' },
        { id: 'p2', nickname: 'Player 2' }
      ];

      const state = game.initialize({ players, options: {} });

      expect(state.players).toHaveLength(2);
      expect(state.status).toBe('playing');
    });

    it('should deal correct number of initial cards', () => {
      const players = [
        { id: 'p1', nickname: 'Player 1' },
        { id: 'p2', nickname: 'Player 2' }
      ];

      const state = game.initialize({ players, options: { initialCards: 7 } });

      expect(state.hands.p1).toHaveLength(7);
      expect(state.hands.p2).toHaveLength(7);
    });

    it('should respect custom initialCards option', () => {
      const players = [
        { id: 'p1', nickname: 'Player 1' },
        { id: 'p2', nickname: 'Player 2' }
      ];

      const state = game.initialize({ players, options: { initialCards: 5 } });

      expect(state.hands.p1).toHaveLength(5);
      expect(state.hands.p2).toHaveLength(5);
    });

    it('should have non-wild card as first card in discard pile', () => {
      const players = [
        { id: 'p1', nickname: 'Player 1' },
        { id: 'p2', nickname: 'Player 2' }
      ];

      const state = game.initialize({ players, options: {} });
      const topCard = state.discardPile[0];

      expect(topCard.type).not.toBe(CARD_TYPES.WILD);
      expect(topCard.type).not.toBe(CARD_TYPES.WILD_DRAW_FOUR);
    });

    it('should set currentColor from first card', () => {
      const players = [
        { id: 'p1', nickname: 'Player 1' },
        { id: 'p2', nickname: 'Player 2' }
      ];

      const state = game.initialize({ players, options: {} });
      const topCard = state.discardPile[0];

      expect(state.currentColor).toBe(topCard.color);
    });

    it('should set drawPending to 2 if first card is Draw Two', () => {
      const players = [
        { id: 'p1', nickname: 'Player 1' },
        { id: 'p2', nickname: 'Player 2' }
      ];

      // Run multiple times to hopefully get a Draw Two as first card
      let foundDrawTwo = false;
      for (let i = 0; i < 100; i++) {
        const state = game.initialize({ players, options: {} });
        const topCard = state.discardPile[0];
        if (topCard.type === CARD_TYPES.DRAW_TWO) {
          expect(state.drawPending).toBe(2);
          foundDrawTwo = true;
          break;
        }
      }
      // Test passes even if we didn't find Draw Two - it's random
    });
  });

  describe('validateMove', () => {
    describe('PLAY_CARD', () => {
      it('should reject when game is not playing', () => {
        const state = createTestState({ status: 'ended' });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should reject when not player turn', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p2-red-7' },
          playerId: 'player2'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should reject when card not in hand', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'nonexistent-card' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should reject card that cannot be played', () => {
        const state = createTestState({ currentColor: 'red' });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-blue-3' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should accept valid card play', () => {
        const state = createTestState({ currentColor: 'red' });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should require color choice for Wild card', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-wild' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('颜色');
      });

      it('should accept Wild card with color choice', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-wild', chosenColor: 'blue' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should accept Skip card on Skip card with different color', () => {
        // Top card is blue Skip, current color is blue
        // Player wants to play red Skip - should be allowed (same action card type)
        const state = createTestState({
          currentColor: 'blue',
          discardPile: [createCard(CARD_TYPES.SKIP, 'blue', null, 'top-blue-skip')]
        });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-skip' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should accept Reverse card on Reverse card with different color', () => {
        // Top card is green Reverse, current color is green
        // Player 2 wants to play yellow Reverse
        const state = createTestState({
          currentColor: 'green',
          currentPlayer: 'player2',
          currentPlayerIndex: 1,
          discardPile: [createCard(CARD_TYPES.REVERSE, 'green', null, 'top-green-reverse')]
        });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p2-yellow-reverse' },
          playerId: 'player2'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should accept Draw Two card on Draw Two card with different color', () => {
        // Top card is blue Draw Two, current color is blue
        // Player wants to play green Draw Two
        const state = createTestState({
          currentColor: 'blue',
          discardPile: [createCard(CARD_TYPES.DRAW_TWO, 'blue', null, 'top-blue-draw2')]
        });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-green-draw2' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should reject play when drawPending > 0 (no stacking)', () => {
        const state = createTestState({ drawPending: 2 });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should allow stacking +2 on +2 when stackDrawCards is enabled', () => {
        const state = createTestState({
          drawPending: 2,
          discardPile: [createCard(CARD_TYPES.DRAW_TWO, 'red', null, 'top-draw2')],
          options: { ...createTestState().options, stackDrawCards: true }
        });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-green-draw2' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should reject stacking +2 when stackDrawCards is disabled', () => {
        const state = createTestState({
          drawPending: 2,
          discardPile: [createCard(CARD_TYPES.DRAW_TWO, 'red', null, 'top-draw2')],
          options: { ...createTestState().options, stackDrawCards: false }
        });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-green-draw2' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should allow stacking +4 on +2 when stackDrawCards is enabled', () => {
        const state = createTestState({
          drawPending: 2,
          discardPile: [createCard(CARD_TYPES.DRAW_TWO, 'blue', null, 'top-draw2')],
          options: { ...createTestState().options, stackDrawCards: true }
        });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-wild4', chosenColor: 'red' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should reject stacking +2 on +4 (lower cannot stack on higher)', () => {
        const state = createTestState({
          drawPending: 4,
          discardPile: [createCard(CARD_TYPES.WILD_DRAW_FOUR, null, null, 'top-wild4')],
          options: { ...createTestState().options, stackDrawCards: true }
        });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-green-draw2' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should allow stacking +4 on +4 when stackDrawCards is enabled', () => {
        const state = createTestState({
          drawPending: 4,
          currentColor: 'blue',
          discardPile: [createCard(CARD_TYPES.WILD_DRAW_FOUR, null, null, 'top-wild4')],
          options: { ...createTestState().options, stackDrawCards: true }
        });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-wild4', chosenColor: 'green' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });
    });

    describe('DRAW_CARD', () => {
      it('should always allow drawing cards', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should allow drawing when drawPending > 0', () => {
        const state = createTestState({ drawPending: 4 });
        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });
    });

    describe('SKIP_TURN', () => {
      it('should reject skip without drawing first', () => {
        const state = createTestState({ lastAction: null });
        const move = {
          actionType: UNO_ACTIONS.SKIP_TURN,
          actionData: {},
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should allow skip after drawing', () => {
        const state = createTestState({
          lastAction: { type: 'drew', playerId: 'player1', count: 1 }
        });
        const move = {
          actionType: UNO_ACTIONS.SKIP_TURN,
          actionData: {},
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });
    });

    describe('CALL_UNO', () => {
      it('should allow UNO call with 1 card', () => {
        const state = createTestState();
        state.hands.player1 = [createCard(CARD_TYPES.NUMBER, 'red', 5, 'p1-last')];
        const move = {
          actionType: UNO_ACTIONS.CALL_UNO,
          actionData: {},
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should allow UNO call with 2 cards', () => {
        const state = createTestState();
        state.hands.player1 = [
          createCard(CARD_TYPES.NUMBER, 'red', 5, 'p1-1'),
          createCard(CARD_TYPES.NUMBER, 'blue', 3, 'p1-2')
        ];
        const move = {
          actionType: UNO_ACTIONS.CALL_UNO,
          actionData: {},
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should reject UNO call with more than 2 cards', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.CALL_UNO,
          actionData: {},
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should allow CALL_UNO even when not player turn', () => {
        const state = createTestState({ currentPlayer: 'player2' });
        state.hands.player1 = [createCard(CARD_TYPES.NUMBER, 'red', 5, 'p1-last')];
        const move = {
          actionType: UNO_ACTIONS.CALL_UNO,
          actionData: {},
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });
    });

    describe('CHALLENGE_UNO', () => {
      it('should allow challenge when target has 1 card and did not call UNO', () => {
        const state = createTestState({ unoCalledBy: null });
        state.hands.player2 = [createCard(CARD_TYPES.NUMBER, 'red', 5, 'p2-last')];
        state.players[1].cardCount = 1;
        const move = {
          actionType: UNO_ACTIONS.CHALLENGE_UNO,
          actionData: { targetPlayerId: 'player2' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(true);
      });

      it('should reject challenge when target called UNO', () => {
        const state = createTestState({ unoCalledBy: 'player2' });
        state.hands.player2 = [createCard(CARD_TYPES.NUMBER, 'red', 5, 'p2-last')];
        const move = {
          actionType: UNO_ACTIONS.CHALLENGE_UNO,
          actionData: { targetPlayerId: 'player2' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });

      it('should reject challenge when target has more than 1 card', () => {
        const state = createTestState({ unoCalledBy: null });
        const move = {
          actionType: UNO_ACTIONS.CHALLENGE_UNO,
          actionData: { targetPlayerId: 'player2' },
          playerId: 'player1'
        };

        const result = game.validateMove(move, state);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('processMove', () => {
    describe('PLAY_CARD', () => {
      it('should remove card from hand and add to discard pile', () => {
        const state = createTestState();
        const initialHandCount = state.hands.player1.length;
        const initialDiscardCount = state.discardPile.length;

        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);

        expect(newState.hands.player1).toHaveLength(initialHandCount - 1);
        expect(newState.discardPile).toHaveLength(initialDiscardCount + 1);
        expect(newState.hands.player1.find(c => c.id === 'p1-red-5')).toBeUndefined();
        expect(newState.discardPile[newState.discardPile.length - 1].id).toBe('p1-red-5');
      });

      it('should update currentColor for colored card', () => {
        const state = createTestState({ currentColor: 'red' });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-skip' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentColor).toBe('red');
      });

      it('should update currentColor for Wild card with chosen color', () => {
        const state = createTestState({ currentColor: 'red' });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-wild', chosenColor: 'blue' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentColor).toBe('blue');
      });

      it('should advance to next player after number card', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentPlayer).toBe('player2');
        expect(newState.currentPlayerIndex).toBe(1);
      });

      it('should skip next player after Skip card', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-skip' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentPlayer).toBe('player3');
        expect(newState.currentPlayerIndex).toBe(2);
      });

      it('should reverse direction after Reverse card', () => {
        const state = createTestState({ direction: 1 });
        // Need to have a valid reverse card that can be played
        state.hands.player1.push(createCard(CARD_TYPES.REVERSE, 'red', null, 'p1-red-reverse'));

        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-reverse' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.direction).toBe(-1);
      });

      it('should set drawPending after Draw Two card and advance to next player', () => {
        const state = createTestState({
          currentColor: 'green',
          discardPile: [createCard(CARD_TYPES.NUMBER, 'green', 5, 'top')]
        });

        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-green-draw2' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.drawPending).toBe(2);
        // Next player (player2) must draw, they are NOT skipped immediately
        expect(newState.currentPlayer).toBe('player2');
      });

      it('should set drawPending to 4 after Wild Draw Four and advance to next player', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-wild4', chosenColor: 'yellow' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.drawPending).toBe(4);
        expect(newState.currentColor).toBe('yellow');
        // Next player (player2) must draw, they are NOT skipped immediately
        expect(newState.currentPlayer).toBe('player2');
      });

      it('should stack drawPending when stackDrawCards is enabled', () => {
        const state = createTestState({
          drawPending: 2,
          discardPile: [createCard(CARD_TYPES.DRAW_TWO, 'red', null, 'top-draw2')],
          options: { ...createTestState().options, stackDrawCards: true }
        });

        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-green-draw2' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.drawPending).toBe(4); // 2 + 2
      });

      it('should update player cardCount', () => {
        const state = createTestState();
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.players[0].cardCount).toBe(6);
      });

      it('should reset unoCalledBy after playing', () => {
        const state = createTestState({ unoCalledBy: 'player1' });
        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.unoCalledBy).toBeNull();
      });
    });

    describe('DRAW_CARD', () => {
      it('should add 1 card to hand when no drawPending', () => {
        const state = createTestState({ drawPending: 0 });
        const initialHandCount = state.hands.player1.length;
        const initialDeckCount = state.deck.length;

        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);

        expect(newState.hands.player1).toHaveLength(initialHandCount + 1);
        expect(newState.deck).toHaveLength(initialDeckCount - 1);
      });

      it('should add drawPending cards to hand when drawPending > 0', () => {
        const state = createTestState({ drawPending: 4 });
        const initialHandCount = state.hands.player1.length;

        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);

        expect(newState.hands.player1).toHaveLength(initialHandCount + 4);
        expect(newState.drawPending).toBe(0);
      });

      it('should advance to next player after drawing pending cards', () => {
        const state = createTestState({ drawPending: 2 });

        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentPlayer).toBe('player2');
      });

      it('should NOT advance player after regular draw (no pending)', () => {
        const state = createTestState({ drawPending: 0 });

        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentPlayer).toBe('player1');
      });

      it('should update lastAction to drew', () => {
        const state = createTestState({ drawPending: 0 });

        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.lastAction.type).toBe('drew');
        expect(newState.lastAction.count).toBe(1);
      });

      it('should update player cardCount', () => {
        const state = createTestState({ drawPending: 2 });

        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.players[0].cardCount).toBe(9); // 7 + 2
      });
    });

    describe('SKIP_TURN', () => {
      it('should advance to next player', () => {
        const state = createTestState({
          lastAction: { type: 'drew', playerId: 'player1', count: 1 }
        });

        const move = {
          actionType: UNO_ACTIONS.SKIP_TURN,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentPlayer).toBe('player2');
      });

      it('should update lastAction to skipped', () => {
        const state = createTestState({
          lastAction: { type: 'drew', playerId: 'player1', count: 1 }
        });

        const move = {
          actionType: UNO_ACTIONS.SKIP_TURN,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.lastAction.type).toBe('skipped');
      });
    });

    describe('CALL_UNO', () => {
      it('should set unoCalledBy', () => {
        const state = createTestState();
        state.hands.player1 = [createCard(CARD_TYPES.NUMBER, 'red', 5, 'p1-last')];

        const move = {
          actionType: UNO_ACTIONS.CALL_UNO,
          actionData: {},
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.unoCalledBy).toBe('player1');
      });
    });

    describe('CHALLENGE_UNO', () => {
      it('should make target draw penalty cards', () => {
        const state = createTestState({ unoCalledBy: null });
        state.hands.player2 = [createCard(CARD_TYPES.NUMBER, 'red', 5, 'p2-last')];
        state.players[1].cardCount = 1;

        const move = {
          actionType: UNO_ACTIONS.CHALLENGE_UNO,
          actionData: { targetPlayerId: 'player2' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.hands.player2).toHaveLength(3); // 1 + 2 penalty
        expect(newState.players[1].cardCount).toBe(3);
      });

      it('should use custom unoPenalty from options', () => {
        const state = createTestState({
          unoCalledBy: null,
          options: { ...createTestState().options, unoPenalty: 4 }
        });
        state.hands.player2 = [createCard(CARD_TYPES.NUMBER, 'red', 5, 'p2-last')];
        state.players[1].cardCount = 1;

        const move = {
          actionType: UNO_ACTIONS.CHALLENGE_UNO,
          actionData: { targetPlayerId: 'player2' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.hands.player2).toHaveLength(5); // 1 + 4 penalty
      });
    });

    describe('Direction and Player Advancement', () => {
      it('should handle counter-clockwise direction correctly', () => {
        const state = createTestState({ direction: -1 });

        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentPlayer).toBe('player3'); // Goes backwards
      });

      it('should wrap around correctly at player 0 going backwards', () => {
        const state = createTestState({
          direction: -1,
          currentPlayer: 'player1',
          currentPlayerIndex: 0
        });

        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-5' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        expect(newState.currentPlayerIndex).toBe(2); // Wraps to last player
        expect(newState.currentPlayer).toBe('player3');
      });

      it('should skip correctly with reverse direction', () => {
        const state = createTestState({ direction: -1 });

        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-skip' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        // Player 0, direction -1, skip = 2 steps
        // (0 + 2 * -1 + 3) % 3 = 1
        expect(newState.currentPlayerIndex).toBe(1);
        expect(newState.currentPlayer).toBe('player2');
      });

      it('should handle Reverse as Skip in 2-player game', () => {
        const state = createTestState();
        state.players = [
          { id: 'player1', nickname: 'Player 1', cardCount: 7, score: 0 },
          { id: 'player2', nickname: 'Player 2', cardCount: 7, score: 0 }
        ];
        state.hands.player1.push(createCard(CARD_TYPES.REVERSE, 'red', null, 'p1-red-reverse'));

        const move = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-reverse' },
          playerId: 'player1'
        };

        const newState = game.processMove(move, state);
        // In 2-player game, reverse acts like skip, so player1 should play again
        expect(newState.currentPlayer).toBe('player1');
      });
    });
  });

  describe('checkGameEnd', () => {
    it('should return ended: false when no player has empty hand', () => {
      const state = createTestState();

      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(false);
    });

    it('should return ended: true when a player has empty hand', () => {
      const state = createTestState();
      state.hands.player1 = [];

      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.winner).toBe('player1');
    });

    it('should calculate rankings correctly', () => {
      const state = createTestState();
      state.hands.player1 = []; // Winner
      state.hands.player2 = [
        createCard(CARD_TYPES.NUMBER, 'red', 5), // 5 points
        createCard(CARD_TYPES.SKIP, 'blue')       // 20 points
      ];
      state.hands.player3 = [
        createCard(CARD_TYPES.WILD),              // 50 points
        createCard(CARD_TYPES.NUMBER, 'green', 9) // 9 points
      ];

      const result = game.checkGameEnd(state);
      expect(result.rankings).toHaveLength(3);

      const p1Rank = result.rankings.find(r => r.playerId === 'player1');
      const p2Rank = result.rankings.find(r => r.playerId === 'player2');
      const p3Rank = result.rankings.find(r => r.playerId === 'player3');

      expect(p1Rank.score).toBe(0);  // Winner
      expect(p2Rank.score).toBe(25); // 5 + 20
      expect(p3Rank.score).toBe(59); // 50 + 9
    });
  });

  describe('getPlayableCards', () => {
    it('should return empty when not player turn', () => {
      game.state = createTestState({ currentPlayer: 'player2' });
      const result = game.getPlayableCards('player1');
      expect(result).toEqual([]);
    });

    it('should return empty when drawPending > 0 and stacking disabled', () => {
      game.state = createTestState({
        drawPending: 2,
        discardPile: [createCard(CARD_TYPES.DRAW_TWO, 'red', null, 'top-draw2')],
        options: { ...createTestState().options, stackDrawCards: false }
      });
      const result = game.getPlayableCards('player1');
      expect(result).toEqual([]);
    });

    it('should return +2 and +4 cards when drawPending > 0 from +2 and stacking enabled', () => {
      game.state = createTestState({
        drawPending: 2,
        discardPile: [createCard(CARD_TYPES.DRAW_TWO, 'blue', null, 'top-draw2')],
        options: { ...createTestState().options, stackDrawCards: true }
      });
      const result = game.getPlayableCards('player1');

      // Should include both +2 and +4 cards (player1 has p1-green-draw2 and p1-wild4)
      expect(result.some(c => c.id === 'p1-green-draw2')).toBe(true);
      expect(result.some(c => c.id === 'p1-wild4')).toBe(true);

      // Should NOT include other cards
      expect(result.some(c => c.id === 'p1-red-5')).toBe(false);
      expect(result.some(c => c.id === 'p1-wild')).toBe(false);
    });

    it('should return only +4 cards when drawPending > 0 from +4 and stacking enabled', () => {
      game.state = createTestState({
        drawPending: 4,
        currentColor: 'blue',
        discardPile: [createCard(CARD_TYPES.WILD_DRAW_FOUR, null, null, 'top-wild4')],
        options: { ...createTestState().options, stackDrawCards: true }
      });
      const result = game.getPlayableCards('player1');

      // Should only include +4 cards
      expect(result.some(c => c.id === 'p1-wild4')).toBe(true);

      // Should NOT include +2 or other cards
      expect(result.some(c => c.id === 'p1-green-draw2')).toBe(false);
      expect(result.some(c => c.id === 'p1-red-5')).toBe(false);
    });

    it('should return playable cards', () => {
      game.state = createTestState({ currentColor: 'red', drawPending: 0 });
      const result = game.getPlayableCards('player1');

      // Should include: red-5, red-skip, wild, wild4
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(c => c.id === 'p1-red-5')).toBe(true);
      expect(result.some(c => c.id === 'p1-red-skip')).toBe(true);
      expect(result.some(c => c.id === 'p1-wild')).toBe(true);
      expect(result.some(c => c.id === 'p1-wild4')).toBe(true);

      // Should NOT include non-matching cards
      expect(result.some(c => c.id === 'p1-blue-3')).toBe(false);
    });
  });

  describe('getVisibleState', () => {
    it('should hide other players hands', () => {
      game.state = createTestState();
      const visible = game.getVisibleState('player1');

      expect(visible.hands).toBeUndefined();
      expect(visible.myHand).toBeDefined();
      expect(visible.myHand).toHaveLength(7);
    });

    it('should include top card', () => {
      game.state = createTestState();
      const visible = game.getVisibleState('player1');

      expect(visible.topCard).toBeDefined();
      expect(visible.topCard.id).toBe('discard-1');
    });

    it('should include deck count', () => {
      game.state = createTestState();
      const visible = game.getVisibleState('player1');

      expect(visible.deckCount).toBe(5);
    });

    it('should include other players card counts', () => {
      game.state = createTestState();
      const visible = game.getVisibleState('player1');

      expect(visible.otherPlayers).toHaveLength(2);
      expect(visible.otherPlayers[0].cardCount).toBe(7);
      expect(visible.otherPlayers[1].cardCount).toBe(7);
    });
  });

  describe('Integration Tests - Complete Turn Sequences', () => {
    describe('Draw Two complete flow', () => {
      it('should require next player to draw, then skip them', () => {
        // Setup: player1 has Draw Two, currentColor is green
        const state = createTestState({
          currentColor: 'green',
          discardPile: [createCard(CARD_TYPES.NUMBER, 'green', 5, 'top')]
        });

        // Step 1: player1 plays Draw Two
        const playMove = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-green-draw2' },
          playerId: 'player1'
        };
        const afterPlay = game.processMove(playMove, state);

        // Verify: player2 is current, must face drawPending
        expect(afterPlay.currentPlayer).toBe('player2');
        expect(afterPlay.drawPending).toBe(2);

        // Step 2: player2 must draw (cannot play cards)
        const playAttempt = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p2-green-2' },
          playerId: 'player2'
        };
        const canPlay = game.validateMove(playAttempt, afterPlay);
        expect(canPlay.valid).toBe(false);

        // Step 3: player2 draws cards
        const drawMove = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player2'
        };
        const afterDraw = game.processMove(drawMove, afterPlay);

        // Verify: player2 drew 2 cards, now it's player3's turn
        expect(afterDraw.hands.player2).toHaveLength(9); // 7 + 2
        expect(afterDraw.drawPending).toBe(0);
        expect(afterDraw.currentPlayer).toBe('player3');
      });
    });

    describe('Wild Draw Four complete flow', () => {
      it('should require next player to draw 4, then skip them', () => {
        const state = createTestState({
          currentColor: 'red',
          discardPile: [createCard(CARD_TYPES.NUMBER, 'red', 4, 'top')]
        });

        // Step 1: player1 plays Wild Draw Four
        const playMove = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-wild4', chosenColor: 'blue' },
          playerId: 'player1'
        };
        const afterPlay = game.processMove(playMove, state);

        // Verify: player2 is current, must face drawPending=4, color changed
        expect(afterPlay.currentPlayer).toBe('player2');
        expect(afterPlay.drawPending).toBe(4);
        expect(afterPlay.currentColor).toBe('blue');

        // Step 2: player2 draws cards
        const drawMove = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player2'
        };
        const afterDraw = game.processMove(drawMove, afterPlay);

        // Verify: player2 drew 4 cards, now it's player3's turn
        expect(afterDraw.hands.player2).toHaveLength(11); // 7 + 4
        expect(afterDraw.drawPending).toBe(0);
        expect(afterDraw.currentPlayer).toBe('player3');
      });
    });

    describe('Draw Two stacking flow', () => {
      it('should allow stacking when enabled', () => {
        const state = createTestState({
          currentColor: 'green',
          discardPile: [createCard(CARD_TYPES.DRAW_TWO, 'green', null, 'top-draw2')],
          drawPending: 2,
          currentPlayer: 'player2',
          currentPlayerIndex: 1,
          options: { ...createTestState().options, stackDrawCards: true }
        });

        // player2 can stack their Draw Two
        const stackMove = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p2-red-draw2' },
          playerId: 'player2'
        };

        const canStack = game.validateMove(stackMove, state);
        expect(canStack.valid).toBe(true);

        const afterStack = game.processMove(stackMove, state);
        expect(afterStack.drawPending).toBe(4); // 2 + 2
        expect(afterStack.currentPlayer).toBe('player3');
      });
    });

    describe('enrichMoveForHistory', () => {
      it('should add count to DRAW_CARD when drawPending > 0', () => {
        const state = createTestState({ drawPending: 4 });
        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const enriched = game.enrichMoveForHistory(move, state);
        expect(enriched.actionData.count).toBe(4);
      });

      it('should add count=1 to DRAW_CARD when drawPending is 0', () => {
        const state = createTestState({ drawPending: 0 });
        const move = {
          actionType: UNO_ACTIONS.DRAW_CARD,
          actionData: {},
          playerId: 'player1'
        };

        const enriched = game.enrichMoveForHistory(move, state);
        expect(enriched.actionData.count).toBe(1);
      });
    });

    describe('Skip card flow', () => {
      it('should skip next player immediately without draw', () => {
        const state = createTestState({
          currentColor: 'red',
          discardPile: [createCard(CARD_TYPES.NUMBER, 'red', 4, 'top')]
        });

        const playMove = {
          actionType: UNO_ACTIONS.PLAY_CARD,
          actionData: { cardId: 'p1-red-skip' },
          playerId: 'player1'
        };
        const afterPlay = game.processMove(playMove, state);

        // Skip should jump directly to player3
        expect(afterPlay.currentPlayer).toBe('player3');
        expect(afterPlay.drawPending).toBe(0);
      });
    });
  });
});
