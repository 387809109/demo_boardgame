import { describe, it, expect } from 'vitest';
import { formatLogEntry } from './event-display.js';

describe('formatLogEntry', () => {
  it('formats play_card_event entries', () => {
    const entry = {
      type: 'play_card_event',
      data: { power: 'ottoman', cardNumber: 1, title: 'Janissaries' }
    };
    expect(formatLogEntry(entry)).toBe('奥斯曼 打出事件: Janissaries');
  });

  it('formats play_card (CP) entries', () => {
    const entry = {
      type: 'play_card',
      data: { power: 'hapsburg', cardNumber: 2, title: 'Holy Roman Emperor', cp: 5 }
    };
    expect(formatLogEntry(entry)).toBe('哈布斯堡 打出卡牌用作 5 CP: Holy Roman Emperor');
  });

  it('formats war_declared entries', () => {
    const entry = {
      type: 'war_declared',
      data: { attacker: 'france', defender: 'hapsburg' }
    };
    expect(formatLogEntry(entry)).toBe('法兰西 对 哈布斯堡 宣战');
  });

  it('formats reformation success', () => {
    const entry = {
      type: 'reformation',
      data: { space: 'Wittenberg', success: true, roll: 4 }
    };
    expect(formatLogEntry(entry)).toBe('宗教改革: Wittenberg 成功 (掷骰4)');
  });

  it('formats reformation failure', () => {
    const entry = {
      type: 'reformation',
      data: { space: 'Augsburg', success: false, roll: 2 }
    };
    expect(formatLogEntry(entry)).toBe('宗教改革: Augsburg 失败 (掷骰2)');
  });

  it('formats field_battle entries', () => {
    const entry = {
      type: 'field_battle',
      data: { space: 'Vienna', winner: 'hapsburg' }
    };
    expect(formatLogEntry(entry)).toBe('野战 @ Vienna: 哈布斯堡 胜');
  });

  it('formats pass entries', () => {
    const entry = { type: 'pass', data: { power: 'england' } };
    expect(formatLogEntry(entry)).toBe('英格兰 跳过');
  });

  it('formats vp_change entries', () => {
    const entry = {
      type: 'vp_change',
      data: { power: 'papacy', delta: 2, reason: '圣彼得' }
    };
    expect(formatLogEntry(entry)).toBe('教廷 VP +2 (圣彼得)');
  });

  it('formats negative vp_change', () => {
    const entry = {
      type: 'vp_change',
      data: { power: 'protestant', delta: -1 }
    };
    expect(formatLogEntry(entry)).toBe('新教 VP -1');
  });

  it('formats immediate_victory entries', () => {
    const entry = {
      type: 'immediate_victory',
      data: { winner: 'ottoman' }
    };
    expect(formatLogEntry(entry)).toBe('奥斯曼 达成即时胜利!');
  });

  it('formats ruler_replaced entries', () => {
    const entry = {
      type: 'ruler_replaced',
      data: { power: 'england', oldRuler: 'henry_viii', newRuler: 'edward_vi', name: 'Edward VI' }
    };
    expect(formatLogEntry(entry)).toBe('英格兰 统治者更替: henry_viii → Edward VI');
  });

  it('formats debate_result entries', () => {
    const entry = {
      type: 'debate_result',
      data: { winner: 'Protestant', disgrace: 'Eck' }
    };
    expect(formatLogEntry(entry)).toBe('辩论结果: Protestant (Eck蒙羞)');
  });

  it('handles unknown event types gracefully', () => {
    const entry = { type: 'unknown_type', data: { foo: 'bar' } };
    const result = formatLogEntry(entry);
    expect(result).toContain('unknown_type');
    expect(result).toContain('foo=bar');
  });

  it('handles entries with no data', () => {
    const entry = { type: 'unknown_type' };
    expect(formatLogEntry(entry)).toBe('unknown_type');
  });

  it('formats move entries', () => {
    const entry = {
      type: 'move',
      data: { power: 'france', from: 'Paris', to: 'Lyon' }
    };
    expect(formatLogEntry(entry)).toBe('法兰西 移动: Paris → Lyon');
  });

  it('formats spring_deploy entries', () => {
    const entry = {
      type: 'spring_deploy',
      data: { power: 'ottoman', from: 'Istanbul', to: 'Edirne' }
    };
    expect(formatLogEntry(entry)).toBe('奥斯曼 春季部署: Istanbul → Edirne');
  });

  it('formats peace_made entries', () => {
    const entry = {
      type: 'peace_made',
      data: { initiator: 'france', target: 'hapsburg' }
    };
    expect(formatLogEntry(entry)).toBe('法兰西 与 哈布斯堡 议和');
  });

  it('formats excommunication entries', () => {
    const entry = {
      type: 'excommunication',
      data: { target: 'Luther' }
    };
    expect(formatLogEntry(entry)).toBe('绝罚: Luther');
  });

  it('formats control_change entries', () => {
    const entry = {
      type: 'control_change',
      data: { space: 'Milan', newController: 'france' }
    };
    expect(formatLogEntry(entry)).toBe('Milan 控制权: 法兰西');
  });

  it('formats debate_roll entries', () => {
    const entry = {
      type: 'debate_roll',
      data: { round: 1, attackerRolls: [3, 5, 6], defenderRolls: [2, 4], attackerHits: 2, defenderHits: 0 }
    };
    expect(formatLogEntry(entry)).toBe('辩论第 1 轮: 进攻2命中 / 防守0命中');
  });

  it('formats reformation_success entries', () => {
    const entry = {
      type: 'reformation_success',
      data: { space: 'Augsburg', protestantMax: 5, papalMax: 3 }
    };
    expect(formatLogEntry(entry)).toBe('宗教改革成功: Augsburg (5>3)');
  });

  it('formats reformation_failure entries', () => {
    const entry = {
      type: 'reformation_failure',
      data: { space: 'Cologne', protestantMax: 2, papalMax: 4 }
    };
    expect(formatLogEntry(entry)).toBe('宗教改革失败: Cologne (2≤4)');
  });

  it('formats counter_reformation_success entries', () => {
    const entry = {
      type: 'counter_reformation_success',
      data: { space: 'Wittenberg', papalMax: 5, protestantMax: 3, autoSuccess: false }
    };
    expect(formatLogEntry(entry)).toBe('反宗教改革成功: Wittenberg (5≥3)');
  });

  it('formats interception_attempt entries', () => {
    const entry = {
      type: 'interception_attempt',
      data: { interceptorPower: 'hapsburg', success: true, roll: 10, threshold: 9 }
    };
    expect(formatLogEntry(entry)).toBe('哈布斯堡 拦截成功 (掷10/9)');
  });

  it('formats naval_combat entries', () => {
    const entry = {
      type: 'naval_combat',
      data: { space: 'Tyrrhenian Sea', winnerPower: 'ottoman', winner: 'attacker' }
    };
    expect(formatLogEntry(entry)).toBe('海战 @ Tyrrhenian Sea: 奥斯曼 胜');
  });

  it('formats publish_treatise entries', () => {
    const entry = {
      type: 'publish_treatise',
      data: { power: 'protestant', zone: 'german' }
    };
    expect(formatLogEntry(entry)).toBe('新教 发表论文 @ german');
  });

  it('formats luther_reform_success entries', () => {
    const entry = {
      type: 'luther_reform_success',
      data: { space: 'Erfurt', attempt: 2 }
    };
    expect(formatLogEntry(entry)).toBe('路德改革成功: Erfurt (第2次)');
  });

  it('formats call_debate entries', () => {
    const entry = {
      type: 'call_debate',
      data: { power: 'papacy', zone: 'german' }
    };
    expect(formatLogEntry(entry)).toBe('教廷 召集辩论 @ german');
  });
});
