/**
 * UNO Game Implementation
 * @module games/uno
 */

import { GameEngine } from '../../game/engine.js';
import {
  COLORS,
  CARD_TYPES,
  canPlayCard,
  applyCardEffect,
  shouldCallUno,
  forgotUno,
  getUnoPenalty,
  calculateHandScore,
  generateDeck,
  shuffleDeck
} from './rules.js';
import config from './config.json';

/**
 * UNO Game Action Types
 */
export const UNO_ACTIONS = {
  PLAY_CARD: 'PLAY_CARD',
  DRAW_CARD: 'DRAW_CARD',
  SKIP_TURN: 'SKIP_TURN',
  CALL_UNO: 'CALL_UNO',
  CHALLENGE_UNO: 'CHALLENGE_UNO'
};

/**
 * UNO Game class
 */
export class UnoGame extends GameEngine {
  constructor(mode = 'offline') {
    super(mode);
    this.config = config;
  }

  /**
   * Initialize the game
   * @param {Object} gameConfig - Game configuration
   * @returns {Object} Initial game state
   */
  initialize(gameConfig) {
    const { players, options = {} } = gameConfig;

    // Merge default rules with custom options
    const gameOptions = {
      initialCards: options.initialCards ?? config.rules.initialCards,
      stackDrawCards: options.stackDrawCards ?? config.rules.stackDrawCards ?? false,
      forcePlay: options.forcePlay ?? config.rules.forcePlay ?? false,
      unoPenalty: options.unoPenalty ?? config.rules.unoPenalty ?? 2,
      drawUntilMatch: options.drawUntilMatch ?? false,
      sevenSwap: options.sevenSwap ?? false,
      zeroRotate: options.zeroRotate ?? false
    };

    const initialCards = gameOptions.initialCards;

    // Generate and shuffle deck
    let deck = shuffleDeck(generateDeck());

    // Deal cards to players
    const hands = {};
    players.forEach(player => {
      hands[player.id] = deck.splice(0, initialCards);
    });

    // Set up discard pile with first non-wild card
    let discardPile = [];
    let topCard = deck.shift();

    // If first card is wild, shuffle back and try again
    while (topCard.type === CARD_TYPES.WILD || topCard.type === CARD_TYPES.WILD_DRAW_FOUR) {
      deck.push(topCard);
      deck = shuffleDeck(deck);
      topCard = deck.shift();
    }

    discardPile.push(topCard);

    // Determine initial current color and apply any first card effects
    let currentColor = topCard.color;
    let direction = 1; // 1 = clockwise, -1 = counter-clockwise
    let currentPlayerIndex = 0;

    // Apply first card effects if it's an action card
    if (topCard.type === CARD_TYPES.REVERSE && players.length > 2) {
      direction = -1;
    } else if (topCard.type === CARD_TYPES.SKIP) {
      currentPlayerIndex = 1 % players.length;
    }

    const state = {
      players: players.map((p, i) => ({
        ...p,
        cardCount: hands[p.id].length,
        score: 0
      })),
      currentPlayer: players[currentPlayerIndex].id,
      currentPlayerIndex,
      turnNumber: 1,
      status: 'playing',
      direction,
      currentColor,
      hands,
      deck,
      discardPile,
      drawPending: topCard.type === CARD_TYPES.DRAW_TWO ? 2 : 0,
      lastAction: null,
      unoCalledBy: null,
      winner: null,
      options: gameOptions // Store game options for use during gameplay
    };

    return state;
  }

  /**
   * Validate a move
   * @param {Object} move - Move to validate
   * @param {Object} state - Current state
   * @returns {{ valid: boolean, error?: string }}
   */
  validateMove(move, state) {
    const { actionType, actionData, playerId } = move;

    // Check if game is in progress
    if (state.status !== 'playing') {
      return { valid: false, error: '游戏未在进行中' };
    }

    // Check if it's the player's turn (except for CALL_UNO which can happen anytime)
    if (actionType !== UNO_ACTIONS.CALL_UNO && state.currentPlayer !== playerId) {
      return { valid: false, error: '不是你的回合' };
    }

    switch (actionType) {
      case UNO_ACTIONS.PLAY_CARD: {
        const { cardId, chosenColor } = actionData;
        const hand = state.hands[playerId];
        const card = hand?.find(c => c.id === cardId);

        if (!card) {
          return { valid: false, error: '你没有这张牌' };
        }

        // Check if there are pending draw cards
        if (state.drawPending > 0) {
          // If stacking is enabled, allow playing +2 on +2 or +4 on +4
          if (state.options?.stackDrawCards) {
            const topCard = state.discardPile[state.discardPile.length - 1];
            const canStack =
              (topCard.type === CARD_TYPES.DRAW_TWO && card.type === CARD_TYPES.DRAW_TWO) ||
              (topCard.type === CARD_TYPES.WILD_DRAW_FOUR && card.type === CARD_TYPES.WILD_DRAW_FOUR);

            if (!canStack) {
              return { valid: false, error: `必须先摸 ${state.drawPending} 张牌，或出相同的牌叠加` };
            }
            // Allow stacking - continue to validate the card play
          } else {
            return { valid: false, error: `必须先摸 ${state.drawPending} 张牌` };
          }
        }

        const topCard = state.discardPile[state.discardPile.length - 1];

        if (!canPlayCard(card, topCard, state.currentColor)) {
          return { valid: false, error: '这张牌无法出' };
        }

        // Wild cards need a chosen color
        if ((card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) && !chosenColor) {
          return { valid: false, error: '请选择颜色' };
        }

        return { valid: true };
      }

      case UNO_ACTIONS.DRAW_CARD:
        return { valid: true };

      case UNO_ACTIONS.SKIP_TURN: {
        // Can only skip if just drew a card and can't play
        if (!state.lastAction || state.lastAction.type !== 'drew') {
          return { valid: false, error: '只能在摸牌后跳过' };
        }
        return { valid: true };
      }

      case UNO_ACTIONS.CALL_UNO: {
        const hand = state.hands[playerId];
        if (hand?.length !== 1 && hand?.length !== 2) {
          return { valid: false, error: '只有剩余1-2张牌时才能喊UNO' };
        }
        return { valid: true };
      }

      case UNO_ACTIONS.CHALLENGE_UNO: {
        const { targetPlayerId } = actionData;
        const targetHand = state.hands[targetPlayerId];

        if (!targetHand || targetHand.length !== 1) {
          return { valid: false, error: '该玩家不能被质疑' };
        }

        if (state.unoCalledBy === targetPlayerId) {
          return { valid: false, error: '该玩家已经喊了UNO' };
        }

        return { valid: true };
      }

      default:
        return { valid: false, error: '未知操作' };
    }
  }

  /**
   * Process a move and return new state
   * @param {Object} move - Move to process
   * @param {Object} state - Current state
   * @returns {Object} New state
   */
  processMove(move, state) {
    const { actionType, actionData, playerId } = move;
    let newState = JSON.parse(JSON.stringify(state)); // Deep clone

    switch (actionType) {
      case UNO_ACTIONS.PLAY_CARD: {
        const { cardId, chosenColor } = actionData;
        const hand = newState.hands[playerId];
        const cardIndex = hand.findIndex(c => c.id === cardId);
        const card = hand[cardIndex];

        // Remove card from hand
        hand.splice(cardIndex, 1);

        // Add to discard pile
        newState.discardPile.push(card);

        // Apply card effects
        const effects = applyCardEffect(card, newState, chosenColor);
        newState.currentColor = effects.currentColor;

        // Handle direction change
        if (effects.reverseDirection) {
          newState.direction *= -1;
          // In 2-player game, reverse acts like skip
          if (newState.players.length === 2) {
            effects.skipNext = true;
          }
        }

        // Handle draw stacking
        if (newState.options?.stackDrawCards && newState.drawPending > 0 && effects.drawPending > 0) {
          // Stack the draws
          newState.drawPending += effects.drawPending;
        } else {
          // Set pending draws for next player
          newState.drawPending = effects.drawPending;
        }

        // Update player card count
        const playerIndex = newState.players.findIndex(p => p.id === playerId);
        newState.players[playerIndex].cardCount = hand.length;

        // Reset UNO call
        newState.unoCalledBy = null;

        // Move to next player
        this._advancePlayer(newState, effects.skipNext);

        newState.lastAction = {
          type: 'played',
          playerId,
          card,
          chosenColor
        };

        break;
      }

      case UNO_ACTIONS.DRAW_CARD: {
        const hand = newState.hands[playerId];
        const drawCount = newState.drawPending > 0 ? newState.drawPending : 1;

        // Draw cards
        for (let i = 0; i < drawCount; i++) {
          if (newState.deck.length === 0) {
            this._reshuffleDeck(newState);
          }

          if (newState.deck.length > 0) {
            hand.push(newState.deck.shift());
          }
        }

        // Update player card count
        const playerIndex = newState.players.findIndex(p => p.id === playerId);
        newState.players[playerIndex].cardCount = hand.length;

        // Reset pending draws
        const hadPendingDraws = newState.drawPending > 0;
        newState.drawPending = 0;

        newState.lastAction = {
          type: 'drew',
          playerId,
          count: drawCount
        };

        // If had pending draws, skip to next player
        if (hadPendingDraws) {
          this._advancePlayer(newState, false);
        }

        break;
      }

      case UNO_ACTIONS.SKIP_TURN: {
        this._advancePlayer(newState, false);
        newState.lastAction = {
          type: 'skipped',
          playerId
        };
        break;
      }

      case UNO_ACTIONS.CALL_UNO: {
        newState.unoCalledBy = playerId;
        newState.lastAction = {
          type: 'uno',
          playerId
        };
        break;
      }

      case UNO_ACTIONS.CHALLENGE_UNO: {
        const { targetPlayerId } = actionData;
        const targetHand = newState.hands[targetPlayerId];

        // Target draws penalty cards (use custom penalty from options)
        const penaltyCount = getUnoPenalty(newState.options?.unoPenalty);
        for (let i = 0; i < penaltyCount; i++) {
          if (newState.deck.length === 0) {
            this._reshuffleDeck(newState);
          }
          if (newState.deck.length > 0) {
            targetHand.push(newState.deck.shift());
          }
        }

        // Update card count
        const targetIndex = newState.players.findIndex(p => p.id === targetPlayerId);
        newState.players[targetIndex].cardCount = targetHand.length;

        newState.lastAction = {
          type: 'challenged',
          playerId,
          targetPlayerId,
          penaltyCount
        };
        break;
      }
    }

    return newState;
  }

  /**
   * Advance to next player
   * @private
   */
  _advancePlayer(state, skip = false) {
    const playerCount = state.players.length;
    let steps = skip ? 2 : 1;

    state.currentPlayerIndex = (state.currentPlayerIndex + (steps * state.direction) + playerCount) % playerCount;
    state.currentPlayer = state.players[state.currentPlayerIndex].id;
    state.turnNumber++;
  }

  /**
   * Reshuffle discard pile into deck
   * @private
   */
  _reshuffleDeck(state) {
    if (state.discardPile.length <= 1) return;

    // Keep top card
    const topCard = state.discardPile.pop();

    // Shuffle rest into deck
    state.deck = shuffleDeck(state.discardPile);
    state.discardPile = [topCard];
  }

  /**
   * Enrich move with card details for history
   * @param {Object} move - The move
   * @param {Object} state - Current state
   * @returns {Object} Enriched move
   */
  enrichMoveForHistory(move, state) {
    const { actionType, actionData, playerId } = move;

    if (actionType === UNO_ACTIONS.PLAY_CARD && actionData?.cardId) {
      const hand = state.hands[playerId];
      const card = hand?.find(c => c.id === actionData.cardId);

      if (card) {
        return {
          ...move,
          actionData: {
            ...actionData,
            card: { ...card } // Store a copy of the card
          }
        };
      }
    }

    if (actionType === UNO_ACTIONS.DRAW_CARD) {
      // Calculate how many cards will be drawn
      const drawCount = state.drawPending > 0 ? state.drawPending : 1;
      return {
        ...move,
        actionData: {
          ...actionData,
          count: drawCount
        }
      };
    }

    return move;
  }

  /**
   * Check if game has ended
   * @param {Object} state - Current state
   * @returns {{ ended: boolean, winner?: string, rankings?: Array }}
   */
  checkGameEnd(state) {
    // Check if any player has no cards
    for (const player of state.players) {
      const hand = state.hands[player.id];
      if (hand && hand.length === 0) {
        // Calculate scores
        const rankings = state.players.map(p => {
          const score = p.id === player.id ? 0 : calculateHandScore(state.hands[p.id]);
          return {
            playerId: p.id,
            nickname: p.nickname,
            score,
            rank: 0
          };
        });

        // Sort by score (lowest is better for winner)
        rankings.sort((a, b) => a.score - b.score);
        rankings.forEach((r, i) => r.rank = i + 1);

        return {
          ended: true,
          winner: player.id,
          rankings
        };
      }
    }

    return { ended: false };
  }

  /**
   * Get playable cards for a player
   * @param {string} playerId - Player ID
   * @returns {Array}
   */
  getPlayableCards(playerId) {
    const state = this.state;
    if (!state || state.currentPlayer !== playerId) return [];

    if (state.drawPending > 0) return [];

    const hand = state.hands[playerId];
    const topCard = state.discardPile[state.discardPile.length - 1];

    return hand.filter(card => canPlayCard(card, topCard, state.currentColor));
  }

  /**
   * Get visible state for a player (hide other hands)
   * @param {string} playerId - Player ID
   * @returns {Object}
   */
  getVisibleState(playerId) {
    const state = this.state;
    if (!state) return null;

    return {
      ...state,
      hands: undefined,
      myHand: state.hands[playerId] || [],
      otherPlayers: state.players.filter(p => p.id !== playerId).map(p => ({
        ...p,
        cardCount: state.hands[p.id]?.length || 0
      })),
      topCard: state.discardPile[state.discardPile.length - 1],
      deckCount: state.deck.length
    };
  }
}

export default UnoGame;
