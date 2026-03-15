/**
 * Here I Stand — Event Display
 *
 * Shows a modal overlay when a card event is played, displaying:
 *   - Card number, title, CP, deck info
 *   - Event description text
 *   - Resolution effects (from eventLog entries)
 *
 * Also provides a persistent "last event" banner for quick reference.
 */

import { CARD_BY_NUMBER } from '../data/cards.js';

// ── Power Colors ─────────────────────────────────────────────────

const POWER_COLORS = {
  ottoman: '#2e7d32', hapsburg: '#c6873e', england: '#c62828',
  france: '#1565c0', papacy: '#7b1fa2', protestant: '#2c3e50'
};

const POWER_LABELS = {
  ottoman: '奥斯曼', hapsburg: '哈布斯堡', england: '英格兰',
  france: '法兰西', papacy: '教廷', protestant: '新教'
};

const DECK_LABELS = {
  home: '本势力卡', main: '主牌堆', diplomacy: '外交牌',
  diplomacy_sl: '外交牌(SL后)', '1517_only': '1517初始',
  '1517_and_turn3': '1517+T3', turn3: 'T3', turn4: 'T4',
  turn5: 'T5', turn6: 'T6', turn7: 'T7', special: '特殊'
};

// ── Log Entry Display Mapping ────────────────────────────────────

const LOG_FORMATTERS = {
  play_card_event: (d) => `${POWER_LABELS[d.power] || d.power} 打出事件: ${d.title || `#${d.cardNumber}`}`,
  play_card: (d) => `${POWER_LABELS[d.power] || d.power} 打出卡牌用作 ${d.cp} CP: ${d.title || `#${d.cardNumber}`}`,
  ruler_replaced: (d) => `${POWER_LABELS[d.power] || d.power} 统治者更替: ${d.oldRuler} → ${d.name || d.newRuler}`,
  war_declared: (d) => `${POWER_LABELS[d.attacker] || d.attacker} 对 ${POWER_LABELS[d.defender] || d.defender} 宣战`,
  peace_made: (d) => `${POWER_LABELS[d.initiator] || d.initiator} 与 ${POWER_LABELS[d.target] || d.target} 议和`,
  reformation: (d) => `宗教改革: ${d.space} ${d.success ? '成功' : '失败'}${d.roll ? ` (掷骰${d.roll})` : ''}`,
  counter_reformation: (d) => `反宗教改革: ${d.space} ${d.success ? '成功' : '失败'}${d.roll ? ` (掷骰${d.roll})` : ''}`,
  debate_result: (d) => `辩论结果: ${d.winner || '平局'}${d.disgrace ? ` (${d.disgrace}蒙羞)` : ''}${d.burn ? ` (${d.burn}被烧)` : ''}`,
  field_battle: (d) => `野战 @ ${d.space}: ${POWER_LABELS[d.winner] || d.winner} 胜`,
  assault: (d) => `突击 @ ${d.space}: ${d.success ? '成功' : '失败'}`,
  siege_established: (d) => `围城建立 @ ${d.space}`,
  interception: (d) => `拦截${d.success ? '成功' : '失败'} @ ${d.space}`,
  interception_attempt: (d) => `${POWER_LABELS[d.interceptorPower] || d.interceptorPower} 拦截${d.success ? '成功' : '失败'} (掷${d.roll}/${d.threshold})`,
  naval_combat: (d) => `海战 @ ${d.space}: ${POWER_LABELS[d.winnerPower] || d.winner} 胜`,
  excommunication: (d) => `绝罚: ${d.target}`,
  new_world: (d) => `新世界: ${d.type} - ${d.result || ''}`,
  piracy: (d) => `海盗行动 @ ${d.seaZone}: ${d.hits}VP`,
  units_raised: (d) => `${POWER_LABELS[d.power] || d.power} 征募: ${_unitsSummary(d)}`,
  units_lost: (d) => `${POWER_LABELS[d.power] || d.power} 损失: ${_unitsSummary(d)}`,
  move: (d) => `${POWER_LABELS[d.power] || d.power} 移动: ${d.from} → ${d.to}`,
  control_change: (d) => `${d.space} 控制权: ${POWER_LABELS[d.newController] || d.newController}`,
  pass: (d) => `${POWER_LABELS[d.power] || d.power} 跳过`,
  vp_change: (d) => `${POWER_LABELS[d.power] || d.power} VP ${d.delta > 0 ? '+' : ''}${d.delta}${d.reason ? ` (${d.reason})` : ''}`,
  immediate_victory: (d) => `${POWER_LABELS[d.winner] || d.winner} 达成即时胜利!`,
  explore: (d) => `探索: ${d.result || ''}`,
  conquer: (d) => `征服: ${d.target} ${d.success ? '成功' : '失败'}`,
  colonize: (d) => `殖民: ${d.result || ''}`,
  spring_deploy: (d) => `${POWER_LABELS[d.power] || d.power} 春季部署: ${d.from} → ${d.to}`,
  action_phase_end: (d) => `第 ${d.turn} 回合行动阶段结束`,
  card_draw: (d) => `${POWER_LABELS[d.power] || d.power} 抽取 ${d.count} 张卡牌`,
  home_card_returned: (d) => `${POWER_LABELS[d.power] || d.power} 本势力卡回手`,
  alliance_formed: (d) => `同盟: ${POWER_LABELS[d.power1] || d.power1} + ${POWER_LABELS[d.power2] || d.power2}`,
  leader_captured: (d) => `将领被俘: ${d.leader}`,
  leader_ransomed: (d) => `将领赎回: ${d.leader}`,
  retreat: (d) => `${POWER_LABELS[d.power] || d.power} 撤退到 ${d.destination}`,
  burn_books: (d) => `焚书 @ ${d.zone}${d.removed ? `: 移除 ${d.removed} 个新教空间` : ''}`,
  debate_roll: (d) => `辩论第 ${d.round} 轮: 进攻${d.attackerHits}命中 / 防守${d.defenderHits}命中`,
  debate_tie: (d) => `辩论第 ${d.round} 轮平局`,
  debate_flip: (d) => `辩论翻转: ${d.space} → ${d.religion}`,
  call_debate: (d) => `${POWER_LABELS[d.power] || d.power} 召集辩论 @ ${d.zone}`,
  reformation_success: (d) => `宗教改革成功: ${d.space}${d.autoSuccess ? ' (自动)' : ` (${d.protestantMax}>${d.papalMax})`}`,
  reformation_failure: (d) => `宗教改革失败: ${d.space} (${d.protestantMax}≤${d.papalMax})`,
  counter_reformation_success: (d) => `反宗教改革成功: ${d.space}${d.autoSuccess ? ' (自动)' : ` (${d.papalMax}≥${d.protestantMax})`}`,
  counter_reformation_failure: (d) => `反宗教改革失败: ${d.space} (${d.papalMax}<${d.protestantMax})`,
  luther_reform_success: (d) => `路德改革成功: ${d.space} (第${d.attempt}次)`,
  luther_reform_failure: (d) => `路德改革失败: ${d.space} (第${d.attempt}次)`,
  publish_treatise: (d) => `${POWER_LABELS[d.power] || d.power} 发表论文 @ ${d.zone}`,
  translate_scripture: (d) => `${POWER_LABELS[d.power] || d.power} 翻译圣经 @ ${d.zone} (进度${d.progress})`,
  new_testament_complete: (d) => `${d.zone} 新约翻译完成!`,
  full_bible_complete: (d) => `${d.zone} 完整圣经翻译完成!`,
  build_st_peters: (d) => `圣彼得大教堂建造 (进度${d.progress}, VP${d.vp})`,
  found_jesuit: (d) => `${POWER_LABELS[d.power] || d.power} 创立耶稣会 @ ${d.space}`,
  explore_underway: (d) => `${POWER_LABELS[d.power] || d.power} 发起探索`,
  colonize_underway: (d) => `${POWER_LABELS[d.power] || d.power} 发起殖民`,
  conquer_underway: (d) => `${POWER_LABELS[d.power] || d.power} 发起征服`,
  colony_placed: (d) => `${POWER_LABELS[d.power] || d.power} 殖民地建成`,
  explorer_lost: (d) => `探险家 ${d.explorer} 失踪! (掷${d.roll})`,
  no_discovery: (d) => `${d.explorer} 未有发现 (掷${d.roll})`,
  discovery_made: (d) => `${d.explorer} 发现 ${d.discovery}! +${d.vp}VP (掷${d.roll})`,
  circumnavigation_success: (d) => `${d.explorer} 环球航行成功! +${d.vp}VP`,
  circumnavigation_failed: (d) => `${d.explorer} 环球航行失败 — 遇难`,
  conquest_made: (d) => `${POWER_LABELS[d.power] || d.power} 征服 ${d.conquest}! +${d.vp}VP`,
  conquest_failed: (d) => `${POWER_LABELS[d.power] || d.power} 征服失败${d.result === 'killed' ? ' (阵亡)' : ''}`,
  new_world_phase_start: () => '— 新世界阶段开始 —',
  new_world_phase_end: () => '— 新世界阶段结束 —',
  translation_complete: (d) => `${d.zone} ${d.type === 'full' ? '完整圣经' : '新约'}翻译完成`,
  jesuit_founded: (d) => `耶稣会大学创立 @ ${d.space}`,
  st_peters: (d) => `圣彼得大教堂进度 +${d.cp}${d.vpGained ? ' → +1 VP' : ''}`,
  marital_advance: (d) => `亨利八世婚姻进展: ${d.wife || ''}`,
  pregnancy: (d) => `怀孕结果: ${d.result || ''}`,
  conclave: (d) => `教宗选举: ${d.newPope || ''}`,
};

function _unitsSummary(d) {
  const parts = [];
  if (d.regulars) parts.push(`${d.regulars}正规`);
  if (d.mercenaries) parts.push(`${d.mercenaries}雇佣`);
  if (d.cavalry) parts.push(`${d.cavalry}骑兵`);
  if (d.squadrons) parts.push(`${d.squadrons}舰队`);
  if (d.corsairs) parts.push(`${d.corsairs}海盗`);
  return parts.join(', ') || '—';
}

/**
 * Format a single log entry for display.
 * @param {Object} entry - { type, data, timestamp }
 * @returns {string} Human-readable text
 */
export function formatLogEntry(entry) {
  const formatter = LOG_FORMATTERS[entry.type];
  if (formatter && entry.data) {
    try { return formatter(entry.data); } catch { /* fall through */ }
  }
  // Fallback: show type + key data
  const dataStr = entry.data ? Object.entries(entry.data)
    .slice(0, 3).map(([k, v]) => `${k}=${v}`).join(', ') : '';
  return `${entry.type}${dataStr ? ': ' + dataStr : ''}`;
}

// ── EventDisplay Class ───────────────────────────────────────────

export class EventDisplay {
  constructor() {
    this._overlayEl = null;
    this._bannerEl = null;
    this._visible = false;
    this._autoHideTimer = null;
  }

  /**
   * Create the overlay element (hidden by default).
   * Append this to the map container or game root.
   * @returns {HTMLElement}
   */
  createOverlay() {
    this._overlayEl = document.createElement('div');
    this._overlayEl.className = 'his-event-overlay';
    this._overlayEl.style.cssText = `
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 100;
      justify-content: center;
      align-items: center;
    `;
    this._overlayEl.addEventListener('click', (e) => {
      if (e.target === this._overlayEl) this.hide();
    });
    return this._overlayEl;
  }

  /**
   * Create a persistent banner element for the last event.
   * Shows at bottom-left of map, auto-hides after 5s.
   * @returns {HTMLElement}
   */
  createBanner() {
    this._bannerEl = document.createElement('div');
    this._bannerEl.className = 'his-event-banner';
    this._bannerEl.style.cssText = `
      display: none;
      position: absolute;
      bottom: 8px; left: 8px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      z-index: 10;
      max-width: 320px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      transition: opacity 0.3s;
    `;
    this._bannerEl.addEventListener('click', () => {
      if (this._lastCardNumber) {
        this.showCard(this._lastCardNumber, this._lastPower, this._lastEffects);
      }
    });
    return this._bannerEl;
  }

  /**
   * Show the event modal for a specific card.
   * @param {number} cardNumber
   * @param {string} playedByPower - who played the card
   * @param {Object[]} [effects] - array of log entries related to this event
   */
  showCard(cardNumber, playedByPower, effects) {
    if (!this._overlayEl) return;
    const card = CARD_BY_NUMBER[cardNumber];
    if (!card) return;

    this._lastCardNumber = cardNumber;
    this._lastPower = playedByPower;
    this._lastEffects = effects;

    const modal = this._buildCardModal(card, playedByPower, effects);
    this._overlayEl.innerHTML = '';
    this._overlayEl.appendChild(modal);
    this._overlayEl.style.display = 'flex';
    this._visible = true;
  }

  /** Hide the event modal */
  hide() {
    if (this._overlayEl) {
      this._overlayEl.style.display = 'none';
    }
    this._visible = false;
  }

  get visible() { return this._visible; }

  /**
   * Show the banner for a played event.
   * @param {number} cardNumber
   * @param {string} power
   * @param {Object[]} [effects]
   */
  showBanner(cardNumber, power, effects) {
    if (!this._bannerEl) return;
    const card = CARD_BY_NUMBER[cardNumber];
    if (!card) return;

    this._lastCardNumber = cardNumber;
    this._lastPower = power;
    this._lastEffects = effects;

    const color = POWER_COLORS[power] || '#64748b';
    this._bannerEl.style.display = 'block';
    this._bannerEl.style.borderLeftColor = color;
    this._bannerEl.style.borderLeftWidth = '3px';
    this._bannerEl.style.opacity = '1';
    this._bannerEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-weight:700;color:${color};">#${card.number}</span>
        <span style="font-weight:600;">${card.title}</span>
        <span style="font-size:10px;color:#94a3b8;">${POWER_LABELS[power] || power}</span>
      </div>
      <div style="font-size:10px;color:#64748b;margin-top:2px;">点击查看详情</div>
    `;

    // Auto-hide after 8s
    if (this._autoHideTimer) clearTimeout(this._autoHideTimer);
    this._autoHideTimer = setTimeout(() => {
      if (this._bannerEl) {
        this._bannerEl.style.opacity = '0';
        setTimeout(() => {
          if (this._bannerEl) this._bannerEl.style.display = 'none';
        }, 300);
      }
    }, 8000);
  }

  // ── Private ────────────────────────────────────────────────────

  _buildCardModal(card, power, effects) {
    const color = POWER_COLORS[power] || '#64748b';
    const modal = document.createElement('div');
    modal.className = 'his-event-modal';
    modal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      max-width: 420px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
      position: relative;
    `;
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Header with power color
    const header = document.createElement('div');
    header.style.cssText = `
      background: ${color};
      color: #fff;
      padding: 16px 20px;
      border-radius: 12px 12px 0 0;
      position: relative;
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute; top: 8px; right: 12px;
      background: none; border: none; color: rgba(255,255,255,0.7);
      font-size: 22px; cursor: pointer; padding: 0; line-height: 1;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    // Card number + CP badge
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
    topRow.innerHTML = `
      <span style="font-size:20px;font-weight:800;">#${card.number}</span>
      <span style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;">${card.cp} CP</span>
      <span style="font-size:11px;opacity:0.8;margin-left:auto;">${DECK_LABELS[card.deck] || card.deck || ''}</span>
    `;
    header.appendChild(topRow);

    // Card title
    const title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:700;line-height:1.3;';
    title.textContent = card.title || `Card ${card.number}`;
    header.appendChild(title);

    // Played by
    const playedBy = document.createElement('div');
    playedBy.style.cssText = 'font-size:11px;opacity:0.8;margin-top:4px;';
    playedBy.textContent = `${POWER_LABELS[power] || power} 打出`;
    header.appendChild(playedBy);

    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding: 16px 20px;';

    // Description
    if (card.description) {
      const descSection = document.createElement('div');
      descSection.style.cssText = `
        font-size: 13px; line-height: 1.6; color: #334155;
        padding: 12px; background: #f8fafc; border-radius: 8px;
        border-left: 3px solid ${color};
        margin-bottom: 12px;
      `;
      descSection.textContent = card.description;
      body.appendChild(descSection);
    }

    // Remove after play notice
    if (card.removeAfterPlay) {
      const notice = document.createElement('div');
      notice.style.cssText = `
        font-size: 11px; color: #c62828; font-weight: 600;
        padding: 4px 8px; background: #ffebee; border-radius: 4px;
        display: inline-block; margin-bottom: 12px;
      `;
      notice.textContent = '此卡打出后移除游戏';
      body.appendChild(notice);
    }

    // Effects section
    if (effects && effects.length > 0) {
      const effectsHeader = document.createElement('div');
      effectsHeader.style.cssText = `
        font-size: 12px; font-weight: 700; color: #1e293b;
        margin-bottom: 8px; padding-top: 8px;
        border-top: 1px solid #e2e8f0;
      `;
      effectsHeader.textContent = '事件效果';
      body.appendChild(effectsHeader);

      const effectsList = document.createElement('div');
      effectsList.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

      for (const entry of effects) {
        const line = document.createElement('div');
        line.style.cssText = `
          font-size: 12px; color: #475569; padding: 4px 8px;
          background: #f1f5f9; border-radius: 4px;
          display: flex; align-items: flex-start; gap: 6px;
        `;
        const dot = document.createElement('span');
        dot.textContent = '•';
        dot.style.cssText = `color:${color};font-weight:700;flex-shrink:0;margin-top:1px;`;
        line.appendChild(dot);

        const text = document.createElement('span');
        text.textContent = formatLogEntry(entry);
        line.appendChild(text);

        effectsList.appendChild(line);
      }

      body.appendChild(effectsList);
    }

    // Close button at bottom
    const closeRow = document.createElement('div');
    closeRow.style.cssText = 'text-align:center;margin-top:16px;';
    const closeBtnBottom = document.createElement('button');
    closeBtnBottom.textContent = '关闭';
    closeBtnBottom.style.cssText = `
      padding: 8px 32px; border-radius: 6px; border: 1px solid #cbd5e1;
      background: #fff; color: #64748b; cursor: pointer;
      font-size: 13px; font-weight: 600;
    `;
    closeBtnBottom.addEventListener('click', () => this.hide());
    closeRow.appendChild(closeBtnBottom);
    body.appendChild(closeRow);

    modal.appendChild(body);
    return modal;
  }
}
