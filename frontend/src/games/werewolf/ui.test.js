import { describe, it, expect, vi } from 'vitest';
import { WerewolfUI } from './ui.js';

function createState(overrides = {}) {
  return {
    phase: 'day_announce',
    hunterPendingShoot: null,
    players: [
      { id: 'p1', alive: true },
      { id: 'p2', alive: true },
      { id: 'p3', alive: true },
      { id: 'p4', alive: true },
      { id: 'p5', alive: false }
    ],
    ...overrides
  };
}

describe('WerewolfUI selection logic', () => {
  it('should allow dead hunter to select a shoot target when pending shoot exists', () => {
    const ui = new WerewolfUI();
    ui.state = createState({ hunterPendingShoot: 'p5' });
    ui.playerId = 'p5';

    const selection = ui.getSelectionConfig();
    expect(selection).not.toBeNull();
    expect(selection.selectableIds).toContain('p1');
    expect(selection.selectableIds).toContain('p4');
    expect(selection.selectableIds).not.toContain('p5');
  });

  it('should not allow other dead players to select targets', () => {
    const ui = new WerewolfUI();
    ui.state = createState();
    ui.playerId = 'p5';

    const selection = ui.getSelectionConfig();
    expect(selection).toBeNull();
  });

  it('should propagate selected hunter target for ring highlight', () => {
    const ui = new WerewolfUI();
    ui.state = createState({ hunterPendingShoot: 'p5' });
    ui.playerId = 'p5';
    ui._gameBoard = {
      enablePlayerSelection: vi.fn(),
      disablePlayerSelection: vi.fn()
    };

    ui._handleTargetSelect('p2');

    expect(ui._gameBoard.enablePlayerSelection).toHaveBeenCalledTimes(1);
    const call = ui._gameBoard.enablePlayerSelection.mock.calls[0][0];
    expect(call.selectedId).toBe('p2');
    expect(call.selectableIds).toContain('p2');
    expect(call.selectableIds).not.toContain('p5');
  });
});
