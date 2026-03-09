/**
 * Here I Stand — Power Detail Panel
 *
 * Detailed reference panel for the player's power showing:
 * - Ruler/leader attributes
 * - Action cost table
 * - Cards/VP track
 * - Bonus VP rules
 * - Power-specific tracks (piracy, chateau, marital, etc.)
 */

import { ARMY_LEADERS, NAVAL_LEADERS, LEADER_BY_ID } from '../data/leaders.js';

const POWER_LABELS = {
  ottoman: '奥斯曼帝国', hapsburg: '哈布斯堡', england: '英格兰',
  france: '法兰西', papacy: '教廷', protestant: '新教',
};

const POWER_COLORS = {
  ottoman: '#2e7d32', hapsburg: '#f9a825', england: '#c62828',
  france: '#1565c0', papacy: '#7b1fa2', protestant: '#1a1a1a',
};

/** Action costs per power: [cost, actionLabel] */
const COMMON_ACTIONS = [
  [1, '移动编队 (平地)'],
  [2, '移动编队 (山口)'],
  [1, '海军移动'],
  [1, '控制无防御地点'],
  [1, '攻城/外战'],
  [1, '购买雇佣兵'],
  [2, '招募正规军'],
  [2, '建造舰队'],
];

const POWER_ACTIONS = {
  ottoman: [
    [1, '招募骑兵'],
    [1, '建造海盗船'],
    [2, '发动海盗掠夺'],
  ],
  hapsburg: [
    [2, '探索新世界'],
    [2, '殖民'],
    [4, '征服'],
  ],
  england: [
    [2, '探索新世界'],
    [3, '殖民'],
    [4, '征服'],
    [5, '出版宣传册 (英语区)'],
  ],
  france: [
    [2, '探索新世界'],
    [3, '殖民'],
    [4, '征服'],
  ],
  papacy: [
    [1, '建造圣彼得大教堂'],
    [2, '焚书'],
    [3, '创建耶稣会大学'],
    [3, '发起神学辩论'],
  ],
  protestant: [
    [1, '翻译圣经'],
    [2, '出版宣传册'],
    [3, '发起神学辩论'],
  ],
};

/** Cards/VP track per power (keysControlled → { cards, vp }) */
const VP_TRACKS = {
  ottoman:    [{ k: 2, c: 2, v: 2 }, { k: 3, c: 2, v: 4 }, { k: 4, c: 3, v: 6 }, { k: 5, c: 3, v: 8 }, { k: 6, c: 4, v: 10 }, { k: 7, c: 5, v: 12 }, { k: 8, c: 6, v: 0, auto: true }],
  hapsburg:   [{ k: 3, c: 1, v: 2 }, { k: 4, c: 2, v: 4 }, { k: 5, c: 2, v: 6 }, { k: 6, c: 3, v: 8 }, { k: 7, c: 4, v: 9 }, { k: 8, c: 5, v: 10 }, { k: 9, c: 6, v: 11 }, { k: 10, c: 6, v: 0, auto: true }],
  england:    [{ k: 1, c: 1, v: 3 }, { k: 2, c: 1, v: 5 }, { k: 3, c: 2, v: 7 }, { k: 4, c: 2, v: 9 }, { k: 5, c: 3, v: 11 }, { k: 6, c: 3, v: 13 }, { k: 7, c: 4, v: 15 }, { k: 8, c: 4, v: 17 }, { k: 9, c: 4, v: 0, auto: true }],
  france:     [{ k: 2, c: 1, v: 2 }, { k: 3, c: 2, v: 6 }, { k: 4, c: 3, v: 9 }, { k: 5, c: 3, v: 12 }, { k: 6, c: 4, v: 15 }, { k: 7, c: 5, v: 18 }, { k: 8, c: 5, v: 20 }, { k: 9, c: 5, v: 0, auto: true }],
  papacy:     [{ k: 2, c: 2, v: 2 }, { k: 3, c: 2, v: 5 }, { k: 4, c: 3, v: 8 }, { k: 5, c: 4, v: 12 }, { k: 6, c: 4, v: 0, auto: true }],
  protestant: [{ k: 0, c: 4, v: 0 }, { k: 1, c: 4, v: 2 }, { k: 2, c: 4, v: 4 }, { k: 3, c: 4, v: 6 }, { k: 4, c: 5, v: 8 }, { k: 5, c: 5, v: 0, auto: true }],
};

/** Ruler attributes */
const RULERS = {
  ottoman: [
    { id: 'suleiman', name: '苏莱曼', battle: 2, command: 12, admin: '保留2张', bonus: '无' },
  ],
  hapsburg: [
    { id: 'charles_v', name: '查理五世', battle: 2, command: 10, admin: '保留2张', bonus: '无' },
  ],
  england: [
    { id: 'henry_viii', name: '亨利八世', battle: 1, command: 8, admin: '保留1张', bonus: '+1摸牌' },
  ],
  france: [
    { id: 'francis_i', name: '弗朗西斯一世', battle: 1, command: 8, admin: '保留1张', bonus: '+1摸牌' },
  ],
  papacy: [
    { id: 'leo_x', name: '利奥十世', battle: 0, command: 0, admin: '无', bonus: '无' },
  ],
  protestant: [
    { id: 'luther', name: '马丁·路德', battle: 0, command: 0, admin: '保留2张', bonus: '无' },
  ],
};

const MARITAL_TRACK = [
  'Catherine of Aragon', 'Anne Boleyn', 'Jane Seymour (+1)',
  'Anne of Cleves', 'Catherine Howard', 'Catherine Parr'
];

export class PowerDetailPanel {
  constructor() {
    this._el = null;
  }

  render() {
    this._el = document.createElement('div');
    this._el.className = 'his-power-detail';
    this._el.style.cssText = `
      padding: 8px;
      background: var(--bg-secondary, #f8fafc);
      border-radius: 6px;
      border: 1px solid var(--border-light, #e2e8f0);
      font-size: 11px;
      overflow-y: auto;
      max-height: 400px;
    `;
    return this._el;
  }

  /**
   * @param {Object} state
   * @param {string} power
   */
  update(state, power) {
    if (!this._el || !power) return;
    this._el.innerHTML = '';

    const color = POWER_COLORS[power] || '#666';

    // Title
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight:700;font-size:14px;padding:4px 8px;margin-bottom:6px;
      background:${color};color:${this._contrast(color)};border-radius:4px;
    `;
    header.textContent = `${POWER_LABELS[power] || power} — 势力详情`;
    this._el.appendChild(header);

    // Ruler info
    this._renderRuler(power, state);

    // Action costs
    this._renderActionCosts(power);

    // Cards/VP Track
    this._renderVpTrack(power, state);

    // Power-specific sections
    this._renderPowerSpecific(power, state);
  }

  _renderRuler(power, state) {
    const rulers = RULERS[power];
    if (!rulers || rulers.length === 0) return;

    const currentRulerId = state?.rulers?.[power];
    const ruler = rulers.find(r => r.id === currentRulerId) || rulers[0];

    const section = this._section('君主/领袖');
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:2px 8px;';

    this._gridRow(grid, '名称', ruler.name);
    this._gridRow(grid, '战斗力', `${ruler.battle}`);
    this._gridRow(grid, '指挥值', `${ruler.command}`);
    this._gridRow(grid, '行政', ruler.admin);
    this._gridRow(grid, '摸牌奖励', ruler.bonus);

    section.appendChild(grid);
    this._el.appendChild(section);
  }

  _renderActionCosts(power) {
    const section = this._section('行动消耗 (CP)');
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:100%;font-size:10px;';

    const allActions = [...COMMON_ACTIONS, ...(POWER_ACTIONS[power] || [])];
    for (const [cost, label] of allActions) {
      const tr = document.createElement('tr');
      const tdCost = document.createElement('td');
      tdCost.style.cssText = 'padding:2px 6px;font-weight:700;text-align:center;border-bottom:1px solid #eee;width:24px;';
      tdCost.textContent = cost;
      const tdLabel = document.createElement('td');
      tdLabel.style.cssText = 'padding:2px 6px;border-bottom:1px solid #eee;';
      tdLabel.textContent = label;
      tr.appendChild(tdCost);
      tr.appendChild(tdLabel);
      table.appendChild(tr);
    }

    section.appendChild(table);
    this._el.appendChild(section);
  }

  _renderVpTrack(power, state) {
    const track = VP_TRACKS[power];
    if (!track) return;

    const section = this._section('关键城市 / 摸牌 / VP');
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:100%;font-size:10px;text-align:center;';

    // Header
    const headTr = document.createElement('tr');
    for (const h of ['城市', '摸牌', 'VP']) {
      const th = document.createElement('th');
      th.style.cssText = 'padding:2px 4px;border:1px solid #ddd;background:#f0f0f0;font-size:9px;';
      th.textContent = h;
      headTr.appendChild(th);
    }
    table.appendChild(headTr);

    // Count current keys
    let currentKeys = 0;
    if (state?.spaces) {
      for (const sp of Object.values(state.spaces)) {
        if (sp.controller === power && sp.isKey) currentKeys++;
      }
    }

    for (const entry of track) {
      const tr = document.createElement('tr');
      const isCurrent = entry.k === currentKeys;

      for (const val of [entry.k, entry.c, entry.auto ? '自动胜利' : entry.v]) {
        const td = document.createElement('td');
        td.style.cssText = `padding:2px 4px;border:1px solid #ddd;${isCurrent ? 'background:#fff3e0;font-weight:700;' : ''}`;
        td.textContent = val;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    section.appendChild(table);
    this._el.appendChild(section);
  }

  _renderPowerSpecific(power, state) {
    switch (power) {
      case 'ottoman':
        this._renderOttomanPiracy(state);
        break;
      case 'hapsburg':
        this._renderHapsburgSL(state);
        break;
      case 'england':
        this._renderEnglandMarital(state);
        this._renderEnglandBonusVp(state);
        break;
      case 'france':
        this._renderFranceChateau(state);
        break;
      case 'papacy':
        this._renderPapacyTracks(state);
        break;
      case 'protestant':
        this._renderProtestantTracks(state);
        break;
    }
  }

  _renderOttomanPiracy(state) {
    const section = this._section('海盗VP轨');
    const val = state?.piracyTrack || 0;
    const bar = this._trackBar(val, 10, '#2e7d32');
    section.appendChild(bar);
    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;margin-top:4px;';
    note.textContent = '每次成功海盗+1VP (最高10VP)';
    section.appendChild(note);
    this._el.appendChild(section);
  }

  _renderHapsburgSL(state) {
    const section = this._section('施马尔卡尔登同盟');
    const formed = state?.schmalkaldicLeagueFormed || false;
    const status = document.createElement('div');
    status.style.cssText = `font-weight:600;color:${formed ? '#c62828' : '#666'};`;
    status.textContent = formed
      ? '已成立 — 每控制一个选帝侯+1VP'
      : '未成立';
    section.appendChild(status);
    this._el.appendChild(section);
  }

  _renderEnglandMarital(state) {
    const section = this._section('婚姻轨');
    const currentWife = state?.henryMaritalStatus || 'catherine_of_aragon';

    const wives = [
      { id: 'catherine_of_aragon', name: 'Catherine of Aragon', note: '初始配偶' },
      { id: 'anne_boleyn', name: 'Anne Boleyn', note: '离婚需2CP' },
      { id: 'jane_seymour', name: 'Jane Seymour', note: '+1继承人掷骰' },
      { id: 'anne_of_cleves', name: 'Anne of Cleves', note: '德意志联盟' },
      { id: 'catherine_howard', name: 'Catherine Howard', note: '' },
      { id: 'catherine_parr', name: 'Catherine Parr', note: '最终配偶' },
    ];

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
    for (const wife of wives) {
      const chip = document.createElement('span');
      const isCurrent = wife.id === currentWife;
      chip.style.cssText = `
        padding:2px 6px;border-radius:3px;font-size:9px;
        ${isCurrent ? 'background:#c62828;color:#fff;font-weight:700;' : 'background:#f0f0f0;color:#666;'}
      `;
      chip.textContent = wife.name;
      if (wife.note) chip.title = wife.note;
      list.appendChild(chip);
    }
    section.appendChild(list);
    this._el.appendChild(section);
  }

  _renderEnglandBonusVp(state) {
    const section = this._section('英格兰特殊VP');
    const notes = document.createElement('div');
    notes.style.cssText = 'font-size:9px;color:#666;';
    const edward = state?.edwardBorn ? '✅' : '❌';
    const elizabeth = state?.elizabethBorn ? '✅' : '❌';
    notes.innerHTML = `
      ${edward} 爱德华六世出生 (+5VP)<br>
      ${elizabeth} 伊丽莎白出生 (+2VP，无爱德华时)<br>
      每2个英格兰本土新教地点 +1VP
    `;
    section.appendChild(notes);
    this._el.appendChild(section);
  }

  _renderFranceChateau(state) {
    const section = this._section('城堡建造轨 (Chateau)');
    const val = state?.chateauxTrack || 0;
    const bar = this._trackBar(val, 4, '#1565c0');
    section.appendChild(bar);

    const modifiers = document.createElement('div');
    modifiers.style.cssText = 'font-size:9px;color:#666;margin-top:4px;';
    modifiers.innerHTML = `
      掷骰修正: +2控制Milan, +1控制Florence<br>
      +2控制3个意大利关键城市<br>
      -1本土被敌控, -2本土有敌军<br>
      8+: 摸2弃1(+1VP) | 5-7: 摸1(+1VP) | 3-4: 摸1弃1(+1VP) | ≤2: 摸2弃1(无VP)
    `;
    section.appendChild(modifiers);
    this._el.appendChild(section);
  }

  _renderPapacyTracks(state) {
    // St Peter's
    const section1 = this._section('圣彼得大教堂建造轨');
    const progress = state?.stPetersProgress || 0;
    const stVp = state?.stPetersVp || 0;
    const bar = this._trackBar(progress, 5, '#7b1fa2');
    section1.appendChild(bar);
    const vpNote = document.createElement('div');
    vpNote.style.cssText = 'font-size:9px;color:#666;margin-top:2px;';
    vpNote.textContent = `建造VP: ${stVp} | 每CP投入+1进度`;
    section1.appendChild(vpNote);
    this._el.appendChild(section1);

    // Excommunication
    const section2 = this._section('绝罚');
    const excomm = state?.excommunicated || [];
    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;';
    if (excomm.length > 0) {
      note.textContent = `被绝罚: ${excomm.join(', ')}`;
    } else {
      note.textContent = '当前无绝罚';
    }
    section2.appendChild(note);
    this._el.appendChild(section2);

    // Religious struggle VP
    const section3 = this._section('宗教斗争VP');
    const protSpaces = state?.protestantSpaces || 0;
    const rsVpNote = document.createElement('div');
    rsVpNote.style.cssText = 'font-size:9px;color:#666;';
    rsVpNote.textContent = `新教地点: ${protSpaces} → Religious Struggle VP根据轨道确定`;
    section3.appendChild(rsVpNote);
    this._el.appendChild(section3);
  }

  _renderProtestantTracks(state) {
    // Translation tracks
    const section1 = this._section('圣经翻译轨');
    const tracks = state?.translationTracks || { german: 0, english: 0, french: 0 };

    for (const [lang, label] of [['german', '德语'], ['english', '英语'], ['french', '法语']]) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:3px;';
      const langLabel = document.createElement('span');
      langLabel.style.cssText = 'font-size:10px;width:36px;';
      langLabel.textContent = label;
      row.appendChild(langLabel);

      const ntMax = 6;
      const fbMax = 10;
      const val = tracks[lang] || 0;
      const isNtDone = val >= ntMax;
      const ntBar = this._trackBar(Math.min(val, ntMax), ntMax, '#1a1a1a', '新约');
      row.appendChild(ntBar);
      if (isNtDone) {
        const fbBar = this._trackBar(Math.min(val - ntMax, fbMax), fbMax, '#5c6bc0', '全本');
        row.appendChild(fbBar);
      }
      section1.appendChild(row);
    }
    this._el.appendChild(section1);

    // Special VP
    const section2 = this._section('新教特殊VP');
    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;';
    note.innerHTML = `
      每个新教控制+影响的选帝侯 +2VP<br>
      Protestant Spaces轨 → Religious Struggle VP<br>
      4+选帝侯控制时每回合摸5张 (否则4张)
    `;
    section2.appendChild(note);
    this._el.appendChild(section2);
  }

  // ── Helpers ──────────────────────────────────────────────────

  _section(title) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:8px;';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:600;font-size:11px;margin-bottom:3px;color:#37474f;border-bottom:1px solid #e0e0e0;padding-bottom:2px;';
    h.textContent = title;
    section.appendChild(h);
    return section;
  }

  _gridRow(grid, label, value) {
    const l = document.createElement('span');
    l.style.cssText = 'color:#666;font-size:10px;';
    l.textContent = label;
    const v = document.createElement('span');
    v.style.cssText = 'font-weight:600;font-size:10px;';
    v.textContent = value;
    grid.appendChild(l);
    grid.appendChild(v);
  }

  _trackBar(value, max, color, label = '') {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:3px;flex:1;';
    if (label) {
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:8px;color:#999;width:20px;';
      lbl.textContent = label;
      bar.appendChild(lbl);
    }
    for (let i = 0; i < max; i++) {
      const pip = document.createElement('span');
      pip.style.cssText = `
        width:8px;height:8px;border-radius:2px;
        background:${i < value ? color : '#e0e0e0'};
        display:inline-block;
      `;
      bar.appendChild(pip);
    }
    const count = document.createElement('span');
    count.style.cssText = 'font-size:9px;font-weight:600;margin-left:2px;';
    count.textContent = `${value}/${max}`;
    bar.appendChild(count);
    return bar;
  }

  _contrast(hex) {
    if (!hex || hex[0] !== '#') return '#fff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
  }
}
