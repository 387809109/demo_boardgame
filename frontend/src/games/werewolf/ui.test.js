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

describe('Captain UI selection logic', () => {
  it('should allow captain voter to select from candidates', () => {
    const ui = new WerewolfUI();
    ui.state = createState({
      phase: 'captain_vote',
      captainCurrentVoter: 'p1',
      captainCandidates: ['p2', 'p3'],
      playerMap: { p1: { alive: true } }
    });
    ui.playerId = 'p1';

    const selection = ui.getSelectionConfig();
    expect(selection).not.toBeNull();
    expect(selection.selectableIds).toEqual(['p2', 'p3']);
  });

  it('should include self in captain vote candidates', () => {
    const ui = new WerewolfUI();
    ui.state = createState({
      phase: 'captain_vote',
      captainCurrentVoter: 'p2',
      captainCandidates: ['p1', 'p2', 'p3'],
      playerMap: { p2: { alive: true } }
    });
    ui.playerId = 'p2';

    const selection = ui.getSelectionConfig();
    expect(selection.selectableIds).toEqual(['p1', 'p2', 'p3']);
    expect(selection.selectableIds).toContain('p2');
  });

  it('should use runoff candidates during captain runoff vote', () => {
    const ui = new WerewolfUI();
    ui.state = createState({
      phase: 'captain_runoff_vote',
      captainCurrentVoter: 'p1',
      captainCandidates: ['p2', 'p3', 'p4'],
      captainRunoffCandidates: ['p3', 'p4'],
      playerMap: { p1: { alive: true } }
    });
    ui.playerId = 'p1';

    const selection = ui.getSelectionConfig();
    expect(selection.selectableIds).toEqual(['p3', 'p4']);
  });

  it('should not allow non-current voter to select captain candidates', () => {
    const ui = new WerewolfUI();
    ui.state = createState({
      phase: 'captain_vote',
      captainCurrentVoter: 'p2',
      captainCandidates: ['p3', 'p4'],
      playerMap: { p1: { alive: true } }
    });
    ui.playerId = 'p1';

    const selection = ui.getSelectionConfig();
    expect(selection).toBeNull();
  });

  it('should allow dead captain to select transfer target', () => {
    const ui = new WerewolfUI();
    ui.state = createState({
      phase: 'captain_transfer',
      captainPlayerId: 'p5',
      players: [
        { id: 'p1', alive: true },
        { id: 'p2', alive: true },
        { id: 'p3', alive: true },
        { id: 'p4', alive: true },
        { id: 'p5', alive: false }
      ]
    });
    ui.playerId = 'p5';

    const selection = ui.getSelectionConfig();
    expect(selection).not.toBeNull();
    expect(selection.selectableIds).toContain('p1');
    expect(selection.selectableIds).not.toContain('p5');
  });

  it('should not allow non-captain to select transfer target', () => {
    const ui = new WerewolfUI();
    ui.state = createState({
      phase: 'captain_transfer',
      captainPlayerId: 'p5',
      playerMap: { p1: { alive: true } }
    });
    ui.playerId = 'p1';

    const selection = ui.getSelectionConfig();
    expect(selection).toBeNull();
  });

  it('should fire CAPTAIN_VOTE action on candidate select', () => {
    const ui = new WerewolfUI();
    const mockAction = vi.fn();
    ui.state = createState({
      phase: 'captain_vote',
      captainCurrentVoter: 'p1',
      captainCandidates: ['p2', 'p3']
    });
    ui.playerId = 'p1';
    ui.onAction = mockAction;

    const selection = ui.getSelectionConfig();
    selection.onSelect('p2');

    expect(mockAction).toHaveBeenCalledWith({
      actionType: 'CAPTAIN_VOTE',
      actionData: { targetId: 'p2' }
    });
  });

  it('should fire CAPTAIN_TRANSFER action on transfer target select', () => {
    const ui = new WerewolfUI();
    const mockAction = vi.fn();
    ui.state = createState({
      phase: 'captain_transfer',
      captainPlayerId: 'p5',
      players: [
        { id: 'p1', alive: true },
        { id: 'p2', alive: true },
        { id: 'p5', alive: false }
      ]
    });
    ui.playerId = 'p5';
    ui.onAction = mockAction;

    const selection = ui.getSelectionConfig();
    selection.onSelect('p1');

    expect(mockAction).toHaveBeenCalledWith({
      actionType: 'CAPTAIN_TRANSFER',
      actionData: { targetId: 'p1' }
    });
  });
});
