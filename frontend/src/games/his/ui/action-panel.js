/**
 * Here I Stand — Action Panel
 *
 * Context-aware action panel that shows available actions
 * based on the current phase, active power, and game state.
 *
 * Actions that need target selection call `startSelection(actionType)`
 * instead of emitting directly. The parent UI handles the selection flow.
 */

import { CARD_BY_NUMBER } from '../data/cards.js';
import {
  isActionPanelActive, cpActionsFor,
  responsePanelModel, battlePanelModel, interceptionPanelModel
} from './ui-gating.js';
import { POWER_COLORS, POWER_LABELS } from './his-theme.js';

// ── Action Presentation ─────────────────────────────────────────
// Which actions exist per group (and their per-power cost gate) is owned by
// ui-gating's CP_ACTION_CATALOG / cpActionsFor — the single source of truth.
// This map only carries display (label/icon) keyed by engine action key.

const CP_ACTION_PRESENTATION = {
  MOVE_FORMATION: { label: '移动编队', icon: '⚔' },
  RAISE_REGULAR: { label: '征募正规军', icon: '🛡' },
  BUY_MERCENARY: { label: '雇佣兵', icon: '💰' },
  RAISE_CAVALRY: { label: '骑兵', icon: '🐎' },
  BUILD_SQUADRON: { label: '建造舰队', icon: '⛵' },
  BUILD_CORSAIR: { label: '建造海盗船', icon: '🏴' },
  NAVAL_MOVE: { label: '海军移动', icon: '⚓' },
  CONTROL_UNFORTIFIED: { label: '控制空间', icon: '🏳' },
  ASSAULT: { label: '突击', icon: '🗡' },
  PIRACY: { label: '海盗行动', icon: '☠' },
  PUBLISH_TREATISE: { label: '发表论文', icon: '📜' },
  TRANSLATE_SCRIPTURE: { label: '翻译圣经', icon: '📖' },
  CALL_DEBATE: { label: '召集辩论', icon: '🎭' },
  BUILD_ST_PETERS: { label: '建造圣彼得', icon: '⛪' },
  BURN_BOOKS: { label: '烧书', icon: '🔥' },
  FOUND_JESUIT: { label: '创立耶稣会', icon: '✝' },
  EXPLORE: { label: '探索', icon: '🧭' },
  COLONIZE: { label: '殖民', icon: '🏗' },
  CONQUER: { label: '征服', icon: '⚔' }
};

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

    // Response window takes priority — can be for non-active player
    if (state.pendingResponse) {
      this._renderResponsePanel(state, playerPower);
      return;
    }

    const phase = state.phase;

    // Whether this power has controls right now (vs. waiting on opponents).
    if (!isActionPanelActive(state, playerPower)) {
      this._el.appendChild(this._infoText('等待对手行动...'));
      return;
    }

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

    const groups = cpActionsFor(power, cpRemaining);
    this._renderCpGroup('军事', groups.military, power);
    this._renderCpGroup('宗教', groups.religious, power);
    this._renderCpGroup('新世界', groups.newWorld, power);

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
    const selectedCard = state._uiSelectedCard;
    this._el.appendChild(this._infoText(
      selectedCard != null
        ? `已选择卡牌 #${selectedCard} — 点击提交`
        : '请先从手牌中选择一张卡牌'
    ));
    const btn = this._actionButton('提交卡牌', () => {
      if (selectedCard == null) return;
      this._emit({ type: 'SUBMIT_DIET_CARD', data: { cardNumber: selectedCard } });
    }, 'primary');
    if (selectedCard == null) btn.disabled = true;
    this._el.appendChild(btn);
  }

  // ── Pending Sub-Interactions ────────────────────────────────

  _renderReformationPanel(state) {
    const ref = state.pendingReformation;
    // Support both schemas: type-based (religious-actions.js) and playedBy-based (event-actions.js)
    const isReform = !ref.type || ref.type === 'reformation';
    const attemptsLeft = ref.attemptsLeft ?? ref.attemptsRemaining ?? 0;
    const zone = ref.zone || (ref.zones && ref.zones !== 'all' ? ref.zones : null);
    this._el.appendChild(this._sectionHeader(
      isReform ? '宗教改革' : '反宗教改革'
    ));
    this._el.appendChild(this._infoText(
      `剩余尝试: ${attemptsLeft}` +
      (zone ? ` | 区域: ${zone}` : ' | 任意区域')
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
    const model = battlePanelModel(state);
    if (!model) return;
    this._el.appendChild(this._sectionHeader(model.type));
    this._el.appendChild(this._infoText(
      `地点: ${model.space} | ` +
      `进攻: ${model.attackerPower} vs 防守: ${model.defenderPower}`
    ));

    // Withdraw/fight choices render as a row; resolve/retreat stack below.
    if (model.canWithdraw) {
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;';
      btnRow.appendChild(this._controlButton(model.controls[0], 'default'));
      btnRow.appendChild(this._controlButton(model.controls[1], 'danger'));
      this._el.appendChild(btnRow);
    } else {
      this._el.appendChild(this._controlButton(model.controls[0], 'primary'));
    }

    if (model.needsRetreat) {
      this._el.appendChild(this._infoText('选择撤退目的地'));
      const retreat = model.controls[model.controls.length - 1];
      this._el.appendChild(this._controlButton(retreat, 'secondary'));
    }
  }

  _renderResponsePanel(state, playerPower) {
    const model = responsePanelModel(state, playerPower);
    if (!model) return;
    const respPower = model.respondingPower;
    const respPowerName = POWER_LABELS[respPower] || respPower;

    // Window header
    this._el.appendChild(this._sectionHeader(`${model.label} — ${model.hint}`));

    // Context info (battle space, attacker vs defender)
    const ctx = model.context;
    if (ctx) {
      const parts = [];
      if (ctx.space) parts.push(`地点: ${ctx.space}`);
      if (ctx.attackerPower && ctx.defenderPower) {
        const atkName = POWER_LABELS[ctx.attackerPower] || ctx.attackerPower;
        const defName = POWER_LABELS[ctx.defenderPower] || ctx.defenderPower;
        parts.push(`${atkName} vs ${defName}`);
      }
      if (parts.length > 0) {
        this._el.appendChild(this._infoText(parts.join(' | ')));
      }
    }

    // Responding power indicator
    const powerIndicator = document.createElement('div');
    powerIndicator.style.cssText = `
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 600; margin: 4px 0;
      background: ${POWER_COLORS[respPower] || '#94a3b8'}22;
      color: ${POWER_COLORS[respPower] || '#64748b'};
      border: 1px solid ${POWER_COLORS[respPower] || '#94a3b8'};
    `;
    powerIndicator.textContent = `响应方: ${respPowerName}`;
    this._el.appendChild(powerIndicator);

    if (!model.isMyResponse) {
      // Not this player's response turn — show waiting message
      this._el.appendChild(this._infoText(`等待 ${respPowerName} 响应...`));
      return;
    }

    // Player's response turn — show valid cards and decline button
    if (model.cards.length > 0) {
      this._el.appendChild(this._groupLabel('可用响应卡'));
      const grid = this._actionGrid();
      for (const c of model.cards) {
        const card = CARD_BY_NUMBER[c.cardNumber];
        const cardName = card ? card.name : `Card #${c.cardNumber}`;
        const btn = this._actionButton(
          `#${c.cardNumber} ${cardName}`,
          () => { this._onAction(c.move); },
          'primary'
        );
        btn.style.fontSize = '11px';
        btn.style.textAlign = 'left';
        grid.appendChild(btn);
      }
      this._el.appendChild(grid);
    } else {
      this._el.appendChild(this._infoText('没有可用的响应卡'));
    }

    // Decline button
    const declineRow = document.createElement('div');
    declineRow.style.cssText = 'margin-top: 8px;';
    declineRow.appendChild(this._actionButton('放弃响应', () => {
      this._onAction(model.declineMove);
    }, 'secondary'));
    this._el.appendChild(declineRow);
  }

  _renderInterceptionPanel(state) {
    const model = interceptionPanelModel(state);
    if (!model) return;
    this._el.appendChild(this._sectionHeader('拦截'));
    this._el.appendChild(this._infoText(
      `${model.interceptorPower} 尝试从 ${model.interceptorSpace} ` +
      `拦截进入 ${model.targetSpace} 的编队`
    ));

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;';
    model.controls.forEach((ctrl, i) => {
      btnRow.appendChild(this._controlButton(ctrl, i === 0 ? 'primary' : 'secondary'));
    });
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

  /** Render a labeled grid of CP-action buttons (skips empty groups). */
  _renderCpGroup(label, actions, power) {
    if (!actions || actions.length === 0) return;
    this._el.appendChild(this._groupLabel(label));
    const grid = this._actionGrid();
    for (const action of actions) {
      grid.appendChild(this._cpActionButton(action, power));
    }
    this._el.appendChild(grid);
  }

  _cpActionButton(action, power) {
    const present = CP_ACTION_PRESENTATION[action.key] || { label: action.key, icon: '•' };
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
      <span style="font-size:13px">${present.icon}</span>
      <span>${present.label}</span>
      <span style="font-size:9px;color:#94a3b8;margin-left:2px">${action.cost}CP</span>
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = POWER_COLORS[power] + '18';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.9)';
    });
    btn.addEventListener('click', () => {
      this._select(action.key);
    });
    return btn;
  }

  /**
   * Build a button from a panel-model control: `{ label, move }` emits the move
   * directly, `{ label, select }` starts a target-selection flow.
   */
  _controlButton(ctrl, variant = 'default') {
    return this._actionButton(ctrl.label, () => {
      if (ctrl.move) this._onAction(ctrl.move);
      else if (ctrl.select) this._select(ctrl.select);
    }, variant);
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
