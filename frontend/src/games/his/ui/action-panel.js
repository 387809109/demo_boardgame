/**
 * Here I Stand — Action Panel
 *
 * Context-aware action panel that shows available actions
 * based on the current phase, active power, and game state.
 *
 * Actions that need target selection call `startSelection(actionType)`
 * instead of emitting directly. The parent UI handles the selection flow.
 */

import { ACTION_COSTS } from '../constants.js';

// ── Action Definitions ──────────────────────────────────────────

const MILITARY_ACTIONS = [
  { key: 'MOVE_FORMATION', cost: 'move_formation', label: '移动编队', icon: '⚔' },
  { key: 'RAISE_REGULAR', cost: 'raise_regular', label: '征募正规军', icon: '🛡' },
  { key: 'BUY_MERCENARY', cost: 'buy_mercenary', label: '雇佣兵', icon: '💰' },
  { key: 'RAISE_CAVALRY', cost: 'raise_cavalry', label: '骑兵', icon: '🐎' },
  { key: 'BUILD_SQUADRON', cost: 'build_squadron', label: '建造舰队', icon: '⛵' },
  { key: 'BUILD_CORSAIR', cost: 'build_corsair', label: '建造海盗船', icon: '🏴' },
  { key: 'NAVAL_MOVE', cost: 'naval_move', label: '海军移动', icon: '⚓' },
  { key: 'CONTROL_UNFORTIFIED', cost: 'control_unfortified', label: '控制空间', icon: '🏳' },
  { key: 'ASSAULT', cost: 'assault', label: '突击', icon: '🗡' },
  { key: 'PIRACY', cost: 'initiate_piracy', label: '海盗行动', icon: '☠' }
];

const RELIGIOUS_ACTIONS = [
  { key: 'PUBLISH_TREATISE', cost: 'publish_treatise', label: '发表论文', icon: '📜' },
  { key: 'TRANSLATE_SCRIPTURE', cost: 'translate_scripture', label: '翻译圣经', icon: '📖' },
  { key: 'CALL_DEBATE', cost: 'call_debate', label: '召集辩论', icon: '🎭' },
  { key: 'BUILD_ST_PETERS', cost: 'build_st_peters', label: '建造圣彼得', icon: '⛪' },
  { key: 'BURN_BOOKS', cost: 'burn_books', label: '烧书', icon: '🔥' },
  { key: 'FOUND_JESUIT', cost: 'found_jesuit', label: '创立耶稣会', icon: '✝' }
];

const NEW_WORLD_ACTIONS = [
  { key: 'EXPLORE', cost: 'explore', label: '探索', icon: '🧭' },
  { key: 'COLONIZE', cost: 'colonize', label: '殖民', icon: '🏗' },
  { key: 'CONQUER', cost: 'conquer', label: '征服', icon: '⚔' }
];

// Actions that need a multi-step selection flow
const NEEDS_SELECTION = new Set([
  'MOVE_FORMATION', 'RAISE_REGULAR', 'BUY_MERCENARY', 'RAISE_CAVALRY',
  'BUILD_SQUADRON', 'BUILD_CORSAIR', 'CONTROL_UNFORTIFIED', 'ASSAULT',
  'NAVAL_MOVE', 'PIRACY',
  'PUBLISH_TREATISE', 'TRANSLATE_SCRIPTURE', 'CALL_DEBATE', 'BURN_BOOKS',
  'FOUND_JESUIT',
  'DECLARE_WAR', 'SUE_FOR_PEACE', 'NEGOTIATE', 'RANSOM_LEADER',
  'SPRING_DEPLOY', 'SELECT_LUTHER95_TARGET',
  'RESOLVE_REFORMATION_ATTEMPT', 'RESOLVE_RETREAT'
]);

// ── Power Colors ──────────────────────────────────────────────

const POWER_COLORS = {
  ottoman: '#4a7c59',
  hapsburg: '#c6873e',
  england: '#c0392b',
  france: '#2980b9',
  papacy: '#8e44ad',
  protestant: '#2c3e50'
};

export class ActionPanel {
  constructor() {
    this._el = null;
    this._onAction = null;
    this._startSelection = null;
  }

  /**
   * Render action panel.
   * @param {Object} state
   * @param {string} playerPower
   * @param {Function} onAction - for direct actions (PASS, PLAY_CARD_CP, etc.)
   * @param {Function} startSelection - for actions needing target selection
   * @returns {HTMLElement}
   */
  render(state, playerPower, onAction, startSelection) {
    this._onAction = onAction;
    this._startSelection = startSelection || onAction;
    this._el = document.createElement('div');
    this._el.className = 'his-action-panel';
    this._el.style.cssText = `
      display: flex; flex-direction: column; gap: 6px;
      padding: 8px; background: var(--bg-secondary, #f8fafc);
      border-radius: 6px; border: 1px solid var(--border-default, #cbd5e1);
      max-height: 60vh; overflow-y: auto;
    `;

    this.update(state, playerPower);
    return this._el;
  }

  /**
   * Update the action panel content.
   */
  update(state, playerPower) {
    if (!this._el) return;
    this._el.innerHTML = '';

    const isActive = state.activePower === playerPower;
    if (!isActive) {
      this._el.appendChild(this._infoText('等待对手行动...'));
      return;
    }

    const phase = state.phase;

    // Pending sub-interactions take priority
    if (state.pendingReformation) {
      this._renderReformationPanel(state);
      return;
    }
    if (state.pendingDebate) {
      this._renderDebatePanel(state);
      return;
    }
    if (state.pendingBattle) {
      this._renderBattlePanel(state);
      return;
    }
    if (state.pendingInterception) {
      this._renderInterceptionPanel(state);
      return;
    }

    switch (phase) {
      case 'diplomacy':
        this._renderDiplomacyPanel(state, playerPower);
        break;
      case 'spring_deployment':
        this._renderSpringDeployPanel(state, playerPower);
        break;
      case 'luther_95':
        this._renderLuther95Panel(state);
        break;
      case 'diet_of_worms':
        this._renderDietPanel(state);
        break;
      case 'action':
        this._renderActionPhase(state, playerPower);
        break;
      case 'card_draw':
        this._el.appendChild(this._infoText('抽牌阶段 — 自动处理'));
        this._addPhaseAdvanceBtn();
        break;
      case 'winter':
        this._el.appendChild(this._infoText('冬季阶段 — 自动处理'));
        this._addPhaseAdvanceBtn();
        break;
      default:
        this._el.appendChild(this._infoText(`当前阶段: ${phase}`));
        this._addPhaseAdvanceBtn();
    }
  }

  // ── Action Phase ────────────────────────────────────────────

  _renderActionPhase(state, power) {
    // If spending CP from a played card
    if (state.cpRemaining > 0) {
      this._renderCpActions(state, power);
      return;
    }

    // Card play choice
    this._el.appendChild(this._sectionHeader('行动阶段 — 选择出牌'));
    this._el.appendChild(this._infoText(
      '点击手牌选择一张卡牌，然后选择使用方式'
    ));

    // If a card is selected (tracked via state._uiSelectedCard)
    if (state._uiSelectedCard != null) {
      this._renderCardPlayChoice(state, power);
    }

    // Pass and end impulse buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;';

    btnRow.appendChild(this._actionButton('跳过 (PASS)', () => {
      this._emit({ type: 'PASS' });
    }, 'secondary'));

    if (state.impulseActions && state.impulseActions.length > 0) {
      btnRow.appendChild(this._actionButton('结束脉冲', () => {
        this._emit({ type: 'END_IMPULSE' });
      }, 'secondary'));
    }

    this._el.appendChild(btnRow);
  }

  _renderCardPlayChoice(state, power) {
    const cardNum = state._uiSelectedCard;
    const box = document.createElement('div');
    box.style.cssText = `
      background: #fff; border: 2px solid #5c6bc0; border-radius: 6px;
      padding: 8px; margin: 6px 0;
    `;
    box.appendChild(this._sectionHeader(`卡牌 #${cardNum}`));

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;';

    btnRow.appendChild(this._actionButton('用作 CP', () => {
      this._emit({ type: 'PLAY_CARD_CP', data: { cardNumber: cardNum } });
    }, 'primary'));

    btnRow.appendChild(this._actionButton('触发事件', () => {
      this._emit({ type: 'PLAY_CARD_EVENT', data: { cardNumber: cardNum } });
    }, 'event'));

    box.appendChild(btnRow);
    this._el.appendChild(box);
  }

  // ── CP Actions ──────────────────────────────────────────────

  _renderCpActions(state, power) {
    const cpRemaining = state.cpRemaining;
    this._el.appendChild(this._sectionHeader(`CP 行动 (剩余: ${cpRemaining})`));

    const costs = ACTION_COSTS[power];
    if (!costs) return;

    // Military actions
    const milAvail = MILITARY_ACTIONS.filter(a =>
      costs[a.cost] != null && costs[a.cost] <= cpRemaining
    );
    if (milAvail.length > 0) {
      this._el.appendChild(this._groupLabel('军事'));
      const grid = this._actionGrid();
      for (const action of milAvail) {
        grid.appendChild(this._cpActionButton(
          action, costs[action.cost], power
        ));
      }
      this._el.appendChild(grid);
    }

    // Religious actions
    const relAvail = RELIGIOUS_ACTIONS.filter(a =>
      costs[a.cost] != null && costs[a.cost] <= cpRemaining
    );
    if (relAvail.length > 0) {
      this._el.appendChild(this._groupLabel('宗教'));
      const grid = this._actionGrid();
      for (const action of relAvail) {
        grid.appendChild(this._cpActionButton(
          action, costs[action.cost], power
        ));
      }
      this._el.appendChild(grid);
    }

    // New World actions
    const nwAvail = NEW_WORLD_ACTIONS.filter(a =>
      costs[a.cost] != null && costs[a.cost] <= cpRemaining
    );
    if (nwAvail.length > 0) {
      this._el.appendChild(this._groupLabel('新世界'));
      const grid = this._actionGrid();
      for (const action of nwAvail) {
        grid.appendChild(this._cpActionButton(
          action, costs[action.cost], power
        ));
      }
      this._el.appendChild(grid);
    }

    // End impulse
    const endRow = document.createElement('div');
    endRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;';
    endRow.appendChild(this._actionButton('结束脉冲', () => {
      this._emit({ type: 'END_IMPULSE' });
    }, 'secondary'));
    this._el.appendChild(endRow);
  }

  // ── Diplomacy Phase ─────────────────────────────────────────

  _renderDiplomacyPanel(state, power) {
    this._el.appendChild(this._sectionHeader('外交阶段'));

    const grid = this._actionGrid();

    grid.appendChild(this._actionButton('宣战', () => {
      this._select('DECLARE_WAR');
    }, 'danger'));

    grid.appendChild(this._actionButton('求和', () => {
      this._select('SUE_FOR_PEACE');
    }));

    grid.appendChild(this._actionButton('谈判', () => {
      this._select('NEGOTIATE');
    }));

    grid.appendChild(this._actionButton('赎回将领', () => {
      this._select('RANSOM_LEADER');
    }));

    this._el.appendChild(grid);

    // Pass
    const passRow = document.createElement('div');
    passRow.style.cssText = 'margin-top:8px;';
    passRow.appendChild(this._actionButton('跳过外交', () => {
      this._emit({ type: 'PASS' });
    }, 'secondary'));
    this._el.appendChild(passRow);
  }

  // ── Spring Deployment ───────────────────────────────────────

  _renderSpringDeployPanel(state, power) {
    this._el.appendChild(this._sectionHeader('春季部署'));
    this._el.appendChild(this._infoText(
      '从首都选择部队部署到相邻空间'
    ));

    const grid = this._actionGrid();
    grid.appendChild(this._actionButton('部署部队', () => {
      this._select('SPRING_DEPLOY');
    }, 'primary'));

    grid.appendChild(this._actionButton('跳过部署', () => {
      this._emit({ type: 'PASS' });
    }, 'secondary'));

    this._el.appendChild(grid);
  }

  // ── Luther's 95 Theses ──────────────────────────────────────

  _renderLuther95Panel(state) {
    this._el.appendChild(this._sectionHeader('路德九十五条论纲'));
    this._el.appendChild(this._infoText(
      '选择一个天主教空间作为改革目标'
    ));
    this._el.appendChild(this._actionButton('选择目标空间', () => {
      this._select('SELECT_LUTHER95_TARGET');
    }, 'primary'));
  }

  // ── Diet of Worms ───────────────────────────────────────────

  _renderDietPanel(state) {
    this._el.appendChild(this._sectionHeader('沃尔姆斯帝国会议'));
    this._el.appendChild(this._infoText(
      '提交一张卡牌进行帝国会议裁决'
    ));
    this._el.appendChild(this._actionButton('提交卡牌', () => {
      this._emit({ type: 'SUBMIT_DIET_CARD', data: { _needCard: true } });
    }, 'primary'));
  }

  // ── Pending Sub-Interactions ────────────────────────────────

  _renderReformationPanel(state) {
    const ref = state.pendingReformation;
    const isReform = ref.type === 'reformation';
    this._el.appendChild(this._sectionHeader(
      isReform ? '宗教改革' : '反宗教改革'
    ));
    this._el.appendChild(this._infoText(
      `剩余尝试: ${ref.attemptsLeft}` +
      (ref.zone ? ` | 区域: ${ref.zone}` : ' | 任意区域')
    ));

    if (ref.autoFlip) {
      this._el.appendChild(this._infoText('选择地图上的目标空间进行翻转'));
    }

    this._el.appendChild(this._actionButton(
      ref.autoFlip ? '翻转选中空间' : '掷骰尝试', () => {
        this._select('RESOLVE_REFORMATION_ATTEMPT');
      }, 'primary'
    ));
  }

  _renderDebatePanel(state) {
    const debate = state.pendingDebate;
    this._el.appendChild(this._sectionHeader('神学辩论'));

    const phaseLabel = debate.phase === 'roll' ? '掷骰'
      : debate.phase === 'resolve' ? '结算' : debate.phase;
    this._el.appendChild(this._infoText(
      `第 ${debate.round} 轮 | 阶段: ${phaseLabel}`
    ));

    if (debate.attackerRolls) {
      this._el.appendChild(this._infoText(
        `进攻方命中: ${debate.attackerHits} | 防守方命中: ${debate.defenderHits}`
      ));
    }

    this._el.appendChild(this._actionButton('继续', () => {
      this._emit({ type: 'RESOLVE_DEBATE_STEP' });
    }, 'primary'));
  }

  _renderBattlePanel(state) {
    const battle = state.pendingBattle;
    this._el.appendChild(this._sectionHeader(
      battle.type === 'field_battle' ? '野战' : '战斗'
    ));
    this._el.appendChild(this._infoText(
      `地点: ${battle.space} | ` +
      `进攻: ${battle.attackerPower} vs 防守: ${battle.defenderPower}`
    ));

    if (battle.canWithdraw) {
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;';

      btnRow.appendChild(this._actionButton('退入工事', () => {
        this._emit({
          type: 'WITHDRAW_INTO_FORTIFICATION',
          data: { space: battle.space }
        });
      }));

      btnRow.appendChild(this._actionButton('应战', () => {
        this._emit({ type: 'RESOLVE_BATTLE' });
      }, 'danger'));

      this._el.appendChild(btnRow);
    } else {
      this._el.appendChild(this._actionButton('解决战斗', () => {
        this._emit({ type: 'RESOLVE_BATTLE' });
      }, 'primary'));
    }

    // Retreat option (after battle)
    if (battle.needsRetreat) {
      this._el.appendChild(this._infoText('选择撤退目的地'));
      this._el.appendChild(this._actionButton('撤退到选中空间', () => {
        this._select('RESOLVE_RETREAT');
      }, 'secondary'));
    }
  }

  _renderInterceptionPanel(state) {
    const interc = state.pendingInterception;
    this._el.appendChild(this._sectionHeader('拦截'));
    this._el.appendChild(this._infoText(
      `${interc.interceptorPower} 尝试从 ${interc.interceptorSpace} ` +
      `拦截进入 ${interc.targetSpace} 的编队`
    ));

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;';

    btnRow.appendChild(this._actionButton('尝试拦截', () => {
      this._emit({ type: 'RESOLVE_INTERCEPTION' });
    }, 'primary'));

    if (interc.canAvoid) {
      btnRow.appendChild(this._actionButton('避战', () => {
        this._emit({ type: 'AVOID_BATTLE' });
      }, 'secondary'));
    }

    this._el.appendChild(btnRow);
  }

  // ── Shared Helpers ──────────────────────────────────────────

  _addPhaseAdvanceBtn() {
    this._el.appendChild(this._actionButton('进入下一阶段', () => {
      this._emit({ type: 'PHASE_ADVANCE' });
    }, 'secondary'));
  }

  _emit(action) {
    // Normalize to engine format: { actionType, actionData }
    const move = {
      actionType: action.type,
      actionData: action.data || {}
    };
    if (this._onAction) this._onAction(move);
  }

  /** Start a selection flow for the given action type */
  _select(actionType) {
    if (this._startSelection) this._startSelection(actionType);
  }

  _sectionHeader(text) {
    const h = document.createElement('div');
    h.textContent = text;
    h.style.cssText = `
      font-weight: 700; font-size: 13px; color: var(--text-primary, #1e293b);
      padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; margin-bottom: 4px;
    `;
    return h;
  }

  _groupLabel(text) {
    const l = document.createElement('div');
    l.textContent = text;
    l.style.cssText = `
      font-size: 10px; font-weight: 600; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px;
    `;
    return l;
  }

  _infoText(text) {
    const p = document.createElement('div');
    p.textContent = text;
    p.style.cssText = 'font-size: 12px; color: #64748b; line-height: 1.4;';
    return p;
  }

  _actionGrid() {
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;
    `;
    return grid;
  }

  _cpActionButton(actionDef, cost, power) {
    const btn = document.createElement('button');
    btn.style.cssText = `
      display: flex; align-items: center; gap: 4px;
      padding: 4px 8px; border-radius: 4px;
      border: 1px solid ${POWER_COLORS[power] || '#94a3b8'};
      background: rgba(255,255,255,0.9); cursor: pointer;
      font-size: 11px; color: var(--text-primary, #1e293b);
      transition: background 0.15s;
    `;
    btn.innerHTML = `
      <span style="font-size:13px">${actionDef.icon}</span>
      <span>${actionDef.label}</span>
      <span style="font-size:9px;color:#94a3b8;margin-left:2px">${cost}CP</span>
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = POWER_COLORS[power] + '18';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.9)';
    });
    btn.addEventListener('click', () => {
      this._select(actionDef.key);
    });
    return btn;
  }

  _actionButton(text, onClick, variant = 'default') {
    const btn = document.createElement('button');
    const styles = {
      primary: 'background:#5c6bc0;color:#fff;border:none;',
      secondary: 'background:#fff;color:#64748b;border:1px solid #cbd5e1;',
      danger: 'background:#c62828;color:#fff;border:none;',
      event: 'background:#f59e0b;color:#fff;border:none;',
      default: 'background:#fff;color:#1e293b;border:1px solid #cbd5e1;'
    };
    btn.style.cssText = `
      padding: 6px 12px; border-radius: 5px; cursor: pointer;
      font-size: 12px; font-weight: 600; transition: opacity 0.15s;
      ${styles[variant] || styles.default}
    `;
    btn.textContent = text;
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
    btn.addEventListener('click', onClick);
    return btn;
  }
}
