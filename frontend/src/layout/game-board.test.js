// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { GameBoard } from './game-board.js';

function createStubState() {
  return {
    players: [
      { id: 'p1', nickname: 'Player 1', cardCount: 7, score: 0 },
      { id: 'p2', nickname: 'Player 2', cardCount: 7, score: 0 }
    ],
    currentPlayer: 'p1',
    currentPlayerIndex: 0,
    turnNumber: 1,
    status: 'playing',
    direction: 1,
    currentColor: 'red',
    hands: {
      p1: [],
      p2: []
    },
    deck: [],
    discardPile: [],
    drawPending: 0,
    lastAction: null,
    unoCalledBy: null,
    winner: null,
    options: {}
  };
}

function createStubGame(mode) {
  const state = createStubState();
  return {
    mode,
    config: { name: 'UNO', id: 'uno', gameType: 'uno' },
    getState: () => state,
    getHistory: () => []
  };
}

describe('GameBoard restart button', () => {
  it('renders restart button in offline mode and triggers onRestart', () => {
    const onRestart = vi.fn();
    const board = new GameBoard({
      game: createStubGame('offline'),
      playerId: 'p1',
      onLeave: vi.fn(),
      onRestart
    });

    const button = board.getElement().querySelector('.restart-btn');
    expect(button).not.toBeNull();

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('does not render restart button in online mode', () => {
    const board = new GameBoard({
      game: createStubGame('online'),
      playerId: 'p1',
      onLeave: vi.fn(),
      onRestart: vi.fn()
    });

    const button = board.getElement().querySelector('.restart-btn');
    expect(button).toBeNull();
  });
});
