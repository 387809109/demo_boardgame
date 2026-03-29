/**
 * Here I Stand — Bot UI Helpers (Phase F6)
 *
 * Provides UI utilities for Bot-controlled powers:
 *   - Bot badge generation for power panels and status bar
 *   - "Bot thinking..." overlay during action delay
 *   - Action log formatting with Bot decision rationale
 */

import { isBotPower, getBotPowers, botPlayerId } from './bot-controller.js';
import { POWER_LABELS } from '../ui/his-theme.js';
import { getActiveBehaviorCard } from './behavior-cards.js';
import { BOT_DIFFICULTY } from './bot-rules.js';

// ── Constants ────────────────────────────────────────────────────────

const BOT_BADGE_STYLES = {
  badge: `
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    border-radius: 3px;
    background: #4a5568;
    color: #e2e8f0;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
  `,
  thinking: `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    border-radius: 6px;
    background: rgba(74, 85, 104, 0.9);
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 500;
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 100;
    pointer-events: none;
    animation: hisBotPulse 1.5s ease-in-out infinite;
  `,
  dots: `
    display: inline-flex;
    gap: 2px;
  `,
  dot: `
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #e2e8f0;
    animation: hisBotDot 1.4s ease-in-out infinite;
  `
};

const DIFFICULTY_LABELS = {
  [BOT_DIFFICULTY.NORMAL]: '普通',
  [BOT_DIFFICULTY.HARD]: '困难',
  [BOT_DIFFICULTY.EXPERT]: '专家'
};

const DIFFICULTY_COLORS = {
  [BOT_DIFFICULTY.NORMAL]: '#4a5568',
  [BOT_DIFFICULTY.HARD]: '#c05621',
  [BOT_DIFFICULTY.EXPERT]: '#c53030'
};

// ── CSS Injection ────────────────────────────────────────────────────

let _stylesInjected = false;

/**
 * Inject Bot UI animation styles (once).
 */
export function injectBotStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes hisBotPulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    @keyframes hisBotDot {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.2); }
    }
  `;
  document.head.appendChild(style);
}

// ── Bot Badge ────────────────────────────────────────────────────────

/**
 * Create a "BOT" badge element.
 *
 * @param {Object} [opts]
 * @param {string} [opts.difficulty] - Bot difficulty level
 * @param {boolean} [opts.small=false] - Compact badge for tight spaces
 * @returns {HTMLElement}
 */
export function createBotBadge(opts = {}) {
  const el = document.createElement('span');
  el.className = 'his-bot-badge';

  const difficulty = opts.difficulty || BOT_DIFFICULTY.NORMAL;
  const bgColor = DIFFICULTY_COLORS[difficulty] || '#4a5568';

  el.style.cssText = BOT_BADGE_STYLES.badge;
  el.style.background = bgColor;

  if (opts.small) {
    el.style.fontSize = '9px';
    el.style.padding = '0 4px';
  }

  // Robot icon + text
  el.textContent = 'BOT';

  if (difficulty !== BOT_DIFFICULTY.NORMAL) {
    const diffLabel = DIFFICULTY_LABELS[difficulty] || '';
    el.textContent = `BOT ${diffLabel}`;
  }

  return el;
}

// ── Thinking Indicator ───────────────────────────────────────────────

/**
 * Create a "Bot is thinking..." overlay element.
 *
 * @param {string} powerLabel - Display name for the power
 * @returns {HTMLElement}
 */
export function createThinkingIndicator(powerLabel) {
  injectBotStyles();

  const el = document.createElement('div');
  el.className = 'his-bot-thinking';
  el.style.cssText = BOT_BADGE_STYLES.thinking;

  const text = document.createElement('span');
  text.textContent = `${powerLabel} 思考中`;
  el.appendChild(text);

  // Animated dots
  const dots = document.createElement('span');
  dots.style.cssText = BOT_BADGE_STYLES.dots;
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.style.cssText = BOT_BADGE_STYLES.dot;
    dot.style.animationDelay = `${i * 0.2}s`;
    dots.appendChild(dot);
  }
  el.appendChild(dots);

  return el;
}

/**
 * Show thinking indicator on a container element.
 *
 * @param {HTMLElement} container
 * @param {string} powerLabel
 * @returns {HTMLElement} The indicator (call remove() to hide)
 */
export function showThinkingIndicator(container, powerLabel) {
  hideThinkingIndicator(container);
  const indicator = createThinkingIndicator(powerLabel);
  container.style.position = container.style.position || 'relative';
  container.appendChild(indicator);
  return indicator;
}

/**
 * Hide any active thinking indicator on a container.
 *
 * @param {HTMLElement} container
 */
export function hideThinkingIndicator(container) {
  const existing = container.querySelector('.his-bot-thinking');
  if (existing) existing.remove();
}

// ── Action Log Formatting ────────────────────────────────────────────


const ACTION_LABELS = {
  PLAY_CARD_EVENT: '打出事件',
  PLAY_CARD_CP: '打出CP',
  PASS: '跳过',
  DECLARE_WAR: '宣战',
  SUE_FOR_PEACE: '求和',
  RAISE_REGULAR: '征召正规军',
  BUY_MERCENARY: '雇佣兵',
  MOVE_FORMATION: '移动编队',
  ASSAULT: '突击',
  NAVAL_MOVE: '海军移动',
  BUILD_SQUADRON: '建造舰队',
  CONTROL_UNFORTIFIED: '控制',
  PUBLISH_TREATISE: '出版论文',
  TRANSLATE_SCRIPTURE: '翻译圣经',
  CALL_DEBATE: '发起辩论',
  EXPLORE: '探索',
  COLONIZE: '殖民',
  AVOID_BATTLE: '避战',
  WITHDRAW_INTO_FORTIFICATION: '退入堡垒',
  RESOLVE_BATTLE: '战斗',
  RESOLVE_INTERCEPTION: '拦截判定'
};

/**
 * Format a Bot action for the action log.
 *
 * @param {Object} state - Game state at time of action
 * @param {string} power - Bot power
 * @param {{ actionType: string, actionData: Object }} action
 * @returns {{ label: string, detail: string, power: string }}
 */
export function formatBotAction(state, power, action) {
  const powerLabel = POWER_LABELS[power] || power;
  const actionLabel = ACTION_LABELS[action.actionType] || action.actionType;
  const data = action.actionData || {};

  let detail = '';

  switch (action.actionType) {
    case 'PLAY_CARD_EVENT':
    case 'PLAY_CARD_CP':
      detail = data.cardNumber ? `#${data.cardNumber}` : '';
      if (data.forTreaty) detail += ' (条约)';
      if (data.gangingUp) detail += ' (围攻)';
      break;

    case 'MOVE_FORMATION':
      detail = data.from && data.to ? `${data.from} → ${data.to}` : '';
      break;

    case 'ASSAULT':
      detail = data.target || '';
      if (data.free) detail += ' (免费)';
      if (data.foreignWar) detail += ' (外战)';
      break;

    case 'DECLARE_WAR':
    case 'SUE_FOR_PEACE':
      detail = data.target ? (POWER_LABELS[data.target] || data.target) : '';
      break;

    case 'RAISE_REGULAR':
    case 'CONTROL_UNFORTIFIED':
      detail = data.target || '';
      if (data.free) detail += ' (免费)';
      break;

    case 'AVOID_BATTLE':
      detail = data.destination ? `→ ${data.destination}` : '';
      break;

    default:
      if (data.target) detail = data.target;
      break;
  }

  return {
    label: `[BOT] ${powerLabel}: ${actionLabel}`,
    detail,
    power
  };
}

/**
 * Check if the active power is a Bot and return display info.
 *
 * @param {Object} state
 * @returns {{ isBot: boolean, power: string|null, label: string|null, difficulty: string }}
 */
export function getActiveBotInfo(state) {
  const power = state.activePower;
  if (!power || !isBotPower(state, power)) {
    return { isBot: false, power: null, label: null, difficulty: 'normal' };
  }

  return {
    isBot: true,
    power,
    label: POWER_LABELS[power] || power,
    difficulty: state.botDifficulty || BOT_DIFFICULTY.NORMAL
  };
}

/**
 * Get Bot powers summary for UI display.
 *
 * @param {Object} state
 * @returns {Array<{ power: string, label: string, isBot: boolean }>}
 */
export function getPowerDisplayList(state) {
  const powers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];
  return powers.map(p => ({
    power: p,
    label: POWER_LABELS[p] || p,
    isBot: isBotPower(state, p)
  }));
}
