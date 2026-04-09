/**
 * Here I Stand — Power Detail Panel
 *
 * Detailed reference panel for the player's power showing:
 * - Ruler/leader attributes
 * - Action cost table
 * - Cards/VP track
 * - Bonus VP rules
 * - Power-specific tracks (piracy, chateau, marital, etc.)
 *
 * All data is derived from authoritative constants — no hardcoded duplicates.
 */

import {
  KEY_VP_TRACK, PROTESTANT_CARD_DRAW, ACTION_COSTS,
  RULERS, MARITAL_STATUS, CHATEAU_VP_TRACK, ST_PETERS, PIRACY_VP_TRACK,
  TRANSLATION
} from '../constants.js';
import { POWER_COLORS, POWER_LABELS, contrastText } from './his-theme.js';

/** Chinese labels for action cost keys */
const ACTION_LABELS = {
  move_formation: '移动编队 (平地)',
  move_over_pass: '移动编队 (山口)',
  naval_move: '海军移动',
  buy_mercenary: '购买雇佣兵',
  raise_regular: '招募正规军',
  raise_cavalry: '招募骑兵',
  build_squadron: '建造舰队',
  build_corsair: '建造海盗船',
  assault: '攻城突击',
  fight_foreign_war: '打外战',
  control_unfortified: '控制无防御地点',
  initiate_piracy: '发动海盗掠夺',
  explore: '探索新世界',
  colonize: '殖民',
  conquer: '征服',
  publish_treatise: '出版宣传册',
  translate_scripture: '翻译圣经',
  call_debate: '发起神学辩论',
  build_st_peters: '建造圣彼得大教堂',
  burn_books: '焚书',
  found_jesuit: '创建耶稣会大学',
};

/** Chinese ruler names */
const RULER_NAMES_ZH = {
  suleiman: '苏莱曼',
  charles_v: '查理五世',
  henry_viii: '亨利八世',
  edward_vi: '爱德华六世',
  mary_i: '玛丽一世',
  elizabeth_i: '伊丽莎白一世',
  francis_i: '弗朗索瓦一世',
  henry_ii: '亨利二世',
  leo_x: '利奥十世',
  clement_vii: '克莱门特七世',
  paul_iii: '保罗三世',
  julius_iii: '尤利乌斯三世',
  paul_iv: '保罗四世',
  luther: '马丁·路德',
};

/** Chinese labels for marital status */
const MARITAL_LABELS = {
  catherine_of_aragon: { name: '凯瑟琳 (阿拉贡)', note: '初始配偶' },
  ask_divorce: { name: '请求离婚', note: '事件推进' },
  anne_boleyn: { name: '安妮·博林', note: '英格兰宗教改革开启' },
  jane_seymour: { name: '简·西摩', note: '+1继承人掷骰' },
  anne_of_cleves: { name: '安妮 (克里维斯)', note: '' },
  kathryn_howard: { name: '凯瑟琳·霍华德', note: '' },
  katherine_parr: { name: '凯瑟琳·帕尔', note: '最终配偶' },
};

/** All powers in impulse order for the selector */
const ALL_POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];

export class PowerDetailPanel {
  constructor() {
    this._el = null;
    this._selectorRow = null;
    this._contentEl = null;
    this._state = null;
    this._playerPower = null;
    this._viewPower = null;
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
    `;

    // Power selector row
    this._selectorRow = document.createElement('div');
    this._selectorRow.style.cssText =
      'display:flex;gap:2px;margin-bottom:6px;flex-wrap:wrap;';
    this._el.appendChild(this._selectorRow);

    // Content area
    this._contentEl = document.createElement('div');
    this._el.appendChild(this._contentEl);

    return this._el;
  }

  /**
   * @param {Object} state
   * @param {string} power - the player's own power
   */
  update(state, power) {
    if (!this._el || !power) return;
    this._state = state;
    this._playerPower = power;
    if (!this._viewPower) this._viewPower = power;

    this._renderSelector();
    this._renderContent();
  }

  /** Render the 6-power selector buttons */
  _renderSelector() {
    this._selectorRow.innerHTML = '';
    for (const p of ALL_POWERS) {
      const btn = document.createElement('button');
      const color = POWER_COLORS[p] || '#666';
      const isActive = p === this._viewPower;
      btn.style.cssText = `
        flex:1;min-width:0;padding:3px 2px;font-size:9px;font-weight:600;
        border:2px solid ${color};border-radius:4px;cursor:pointer;
        background:${isActive ? color : 'transparent'};
        color:${isActive ? contrastText(color) : color};
        opacity:${isActive ? 1 : 0.7};
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      `;
      btn.textContent = POWER_LABELS[p] || p;
      btn.title = POWER_LABELS[p] || p;
      btn.addEventListener('click', () => {
        this._viewPower = p;
        this._renderSelector();
        this._renderContent();
      });
      this._selectorRow.appendChild(btn);
    }
  }

  /** Render detail content for _viewPower */
  _renderContent() {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = '';

    const power = this._viewPower;
    const state = this._state;
    const color = POWER_COLORS[power] || '#666';

    // Title
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight:700;font-size:14px;padding:4px 8px;margin-bottom:6px;
      background:${color};color:${contrastText(color)};border-radius:4px;
    `;
    header.textContent = `${POWER_LABELS[power] || power} — 势力详情`;
    this._contentEl.appendChild(header);

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
    const allRulers = RULERS[power];
    if (!allRulers || allRulers.length === 0) return;

    const currentRulerId = state?.rulers?.[power];
    const ruler = allRulers.find(r => r.id === currentRulerId) || allRulers[0];

    const section = this._section('君主/领袖');
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:2px 8px;';

    const zhName = RULER_NAMES_ZH[ruler.id] || ruler.name;
    this._gridRow(grid, '名称', zhName);
    this._gridRow(grid, '战斗力', `${ruler.battle}`);
    this._gridRow(grid, '指挥值', `${ruler.command}`);
    this._gridRow(grid, '行政', ruler.admin > 0 ? `保留${ruler.admin}张` : '无');
    this._gridRow(grid, '摸牌奖励', ruler.cardBonus > 0 ? `+${ruler.cardBonus}摸牌` : '无');

    section.appendChild(grid);
    this._contentEl.appendChild(section);
  }

  _renderActionCosts(power) {
    const costs = ACTION_COSTS[power];
    if (!costs) return;

    const section = this._section('行动消耗 (CP)');
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:100%;font-size:10px;';

    for (const [key, cost] of Object.entries(costs)) {
      if (cost === null) continue; // action not available for this power
      const label = ACTION_LABELS[key] || key;
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
    this._contentEl.appendChild(section);
  }

  _renderVpTrack(power, state) {
    if (power === 'protestant') {
      this._renderProtestantCardDraw(state);
      return;
    }

    const track = KEY_VP_TRACK[power];
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

    // Rows from index 1 up to (autoWin - 1), then auto-win row
    const maxIdx = Math.max(track.vp.length, track.cards.length) - 1;
    for (let k = 1; k <= maxIdx; k++) {
      const vp = k < track.vp.length ? track.vp[k] : track.vp[track.vp.length - 1];
      const cards = k < track.cards.length ? track.cards[k] : track.cards[track.cards.length - 1];
      const isCurrent = k === currentKeys;
      const tr = document.createElement('tr');
      for (const val of [k, cards, vp]) {
        const td = document.createElement('td');
        td.style.cssText = `padding:2px 4px;border:1px solid #ddd;${isCurrent ? 'background:#fff3e0;font-weight:700;' : ''}`;
        td.textContent = val;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    // Auto-win row
    const autoTr = document.createElement('tr');
    const isCurrentAuto = currentKeys >= track.autoWin;
    for (const val of [track.autoWin, '—', '自动胜利']) {
      const td = document.createElement('td');
      td.style.cssText = `padding:2px 4px;border:1px solid #ddd;font-weight:700;color:#c62828;${isCurrentAuto ? 'background:#fff3e0;' : ''}`;
      td.textContent = val;
      autoTr.appendChild(td);
    }
    table.appendChild(autoTr);

    section.appendChild(table);
    this._contentEl.appendChild(section);
  }

  /** Protestant has fixed card draw, not key-based */
  _renderProtestantCardDraw(state) {
    const section = this._section('摸牌规则');
    const note = document.createElement('div');
    note.style.cssText = 'font-size:10px;color:#444;';
    const electorateCount = state?.spaces
      ? Object.values(state.spaces).filter(sp => sp.isElectorate && sp.controller === 'protestant').length
      : 0;
    const currentDraw = electorateCount >= PROTESTANT_CARD_DRAW.electorateThreshold
      ? PROTESTANT_CARD_DRAW.withElectorates
      : PROTESTANT_CARD_DRAW.base;
    note.innerHTML = `
      基础: <b>${PROTESTANT_CARD_DRAW.base}张</b><br>
      控制${PROTESTANT_CARD_DRAW.electorateThreshold}+选帝侯: <b>${PROTESTANT_CARD_DRAW.withElectorates}张</b><br>
      当前: 控制 ${electorateCount} 个选帝侯 → <b>${currentDraw}张</b>
    `;
    section.appendChild(note);
    this._contentEl.appendChild(section);
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
    const max = PIRACY_VP_TRACK.length - 1;
    const bar = this._trackBar(val, max, '#2e7d32');
    section.appendChild(bar);
    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;margin-top:4px;';
    note.textContent = `每次成功海盗+1VP (最高${max}VP)`;
    section.appendChild(note);
    this._contentEl.appendChild(section);
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
    this._contentEl.appendChild(section);
  }

  _renderEnglandMarital(state) {
    const section = this._section('婚姻轨');
    const currentWife = state?.henryMaritalStatus || 'catherine_of_aragon';

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
    for (const id of MARITAL_STATUS) {
      const info = MARITAL_LABELS[id] || { name: id, note: '' };
      const chip = document.createElement('span');
      const isCurrent = id === currentWife;
      chip.style.cssText = `
        padding:2px 6px;border-radius:3px;font-size:9px;
        ${isCurrent ? 'background:#c62828;color:#fff;font-weight:700;' : 'background:#f0f0f0;color:#666;'}
      `;
      chip.textContent = info.name;
      if (info.note) chip.title = info.note;
      list.appendChild(chip);
    }
    section.appendChild(list);
    this._contentEl.appendChild(section);
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
    this._contentEl.appendChild(section);
  }

  _renderFranceChateau(state) {
    const section = this._section('城堡建造轨 (Chateau)');
    const val = state?.chateauxTrack || 0;
    const max = CHATEAU_VP_TRACK.length - 1;
    const bar = this._trackBar(val, max, '#1565c0');
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
    this._contentEl.appendChild(section);
  }

  _renderPapacyTracks(state) {
    // St Peter's
    const section1 = this._section('圣彼得大教堂建造轨');
    const progress = state?.stPetersProgress || 0;
    const stVp = state?.stPetersVp || 0;
    const bar = this._trackBar(progress, ST_PETERS.cpPerVp, '#7b1fa2');
    section1.appendChild(bar);
    const vpNote = document.createElement('div');
    vpNote.style.cssText = 'font-size:9px;color:#666;margin-top:2px;';
    vpNote.textContent = `建造VP: ${stVp}/${ST_PETERS.maxVp} | 每${ST_PETERS.cpPerVp}CP = +1VP`;
    section1.appendChild(vpNote);
    this._contentEl.appendChild(section1);

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
    this._contentEl.appendChild(section2);

    // Religious struggle VP
    const section3 = this._section('宗教斗争VP');
    const protSpaces = state?.protestantSpaces || 0;
    const rsVpNote = document.createElement('div');
    rsVpNote.style.cssText = 'font-size:9px;color:#666;';
    rsVpNote.textContent = `新教地点: ${protSpaces} → Religious Struggle VP根据轨道确定`;
    section3.appendChild(rsVpNote);
    this._contentEl.appendChild(section3);
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

      const ntMax = TRANSLATION.newTestamentCp;
      const fbMax = TRANSLATION.fullBibleCp;
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
    this._contentEl.appendChild(section1);

    // Special VP
    const section2 = this._section('新教特殊VP');
    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;';
    note.innerHTML = `
      每个新教控制+影响的选帝侯 +2VP<br>
      Protestant Spaces轨 → Religious Struggle VP<br>
      ${PROTESTANT_CARD_DRAW.electorateThreshold}+选帝侯控制时每回合摸${PROTESTANT_CARD_DRAW.withElectorates}张 (否则${PROTESTANT_CARD_DRAW.base}张)
    `;
    section2.appendChild(note);
    this._contentEl.appendChild(section2);
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

}
