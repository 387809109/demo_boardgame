/**
 * Here I Stand — Bot UI Helper Tests (Phase F6)
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks } from './bot-controller.js';
import { formatBotAction, getActiveBotInfo, getPowerDisplayList } from './bot-ui.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  return state;
}

// ═══════════════════════════════════════════════════════════════════════
//  formatBotAction
// ═══════════════════════════════════════════════════════════════════════

describe('formatBotAction', () => {
  it('formats PLAY_CARD_EVENT with card number', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'ottoman', {
      actionType: 'PLAY_CARD_EVENT',
      actionData: { cardNumber: 42 }
    });
    expect(result.label).toContain('[BOT]');
    expect(result.label).toContain('奥斯曼');
    expect(result.label).toContain('打出事件');
    expect(result.detail).toBe('#42');
    expect(result.power).toBe('ottoman');
  });

  it('formats MOVE_FORMATION with from/to', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'hapsburg', {
      actionType: 'MOVE_FORMATION',
      actionData: { from: 'Vienna', to: 'Prague' }
    });
    expect(result.detail).toBe('Vienna → Prague');
  });

  it('formats ASSAULT with free flag', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'ottoman', {
      actionType: 'ASSAULT',
      actionData: { target: 'Vienna', free: true }
    });
    expect(result.detail).toBe('Vienna (免费)');
  });

  it('formats ASSAULT with foreignWar flag', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'hapsburg', {
      actionType: 'ASSAULT',
      actionData: { target: 'fw_ottoman', free: true, foreignWar: true }
    });
    expect(result.detail).toContain('(外战)');
  });

  it('formats DECLARE_WAR with power name', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'ottoman', {
      actionType: 'DECLARE_WAR',
      actionData: { target: 'hapsburg' }
    });
    expect(result.detail).toBe('哈布斯堡');
  });

  it('formats PASS with empty detail', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'ottoman', {
      actionType: 'PASS',
      actionData: {}
    });
    expect(result.label).toContain('跳过');
    expect(result.detail).toBe('');
  });

  it('formats AVOID_BATTLE with destination', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'france', {
      actionType: 'AVOID_BATTLE',
      actionData: { destination: 'Paris' }
    });
    expect(result.detail).toBe('→ Paris');
  });

  it('formats treaty event', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'ottoman', {
      actionType: 'PLAY_CARD_EVENT',
      actionData: { cardNumber: 50, forTreaty: true }
    });
    expect(result.detail).toContain('(条约)');
  });

  it('handles unknown action type gracefully', () => {
    const state = createBotState();
    const result = formatBotAction(state, 'ottoman', {
      actionType: 'UNKNOWN_ACTION',
      actionData: { target: 'somewhere' }
    });
    expect(result.label).toContain('UNKNOWN_ACTION');
    expect(result.detail).toBe('somewhere');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  getActiveBotInfo
// ═══════════════════════════════════════════════════════════════════════

describe('getActiveBotInfo', () => {
  it('returns isBot=true when active power is a Bot', () => {
    const state = createBotState(['ottoman']);
    state.activePower = 'ottoman';
    const info = getActiveBotInfo(state);
    expect(info.isBot).toBe(true);
    expect(info.power).toBe('ottoman');
    expect(info.label).toBe('奥斯曼');
  });

  it('returns isBot=false when active power is human', () => {
    const state = createBotState(['ottoman']);
    state.activePower = 'france';
    const info = getActiveBotInfo(state);
    expect(info.isBot).toBe(false);
    expect(info.power).toBeNull();
  });

  it('returns isBot=false when no active power', () => {
    const state = createBotState(['ottoman']);
    state.activePower = null;
    const info = getActiveBotInfo(state);
    expect(info.isBot).toBe(false);
  });

  it('includes difficulty from state', () => {
    const state = createBotState(['ottoman']);
    state.activePower = 'ottoman';
    state.botDifficulty = 'expert';
    const info = getActiveBotInfo(state);
    expect(info.difficulty).toBe('expert');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  getPowerDisplayList
// ═══════════════════════════════════════════════════════════════════════

describe('getPowerDisplayList', () => {
  it('returns all 6 powers with Bot flags', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    const list = getPowerDisplayList(state);
    expect(list).toHaveLength(6);

    const ottoman = list.find(p => p.power === 'ottoman');
    expect(ottoman.isBot).toBe(true);
    expect(ottoman.label).toBe('奥斯曼');

    const france = list.find(p => p.power === 'france');
    expect(france.isBot).toBe(false);
  });

  it('marks all as non-Bot when no bots configured', () => {
    const state = createTestState();
    const list = getPowerDisplayList(state);
    for (const p of list) {
      expect(p.isBot).toBe(false);
    }
  });
});
