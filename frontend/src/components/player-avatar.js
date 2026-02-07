/**
 * Player Avatar Component
 * @module components/player-avatar
 */

const AVATAR_COLORS = [
  '#667eea', '#43e97b', '#f093fb', '#f5576c',
  '#4facfe', '#ffecd2', '#a8edea', '#fed6e3'
];

/**
 * Player Avatar component with enhanced states and badges
 */
export class PlayerAvatar {
  /**
   * @param {Object} player - Player object
   * @param {string} player.id - Player ID
   * @param {string} player.nickname - Player nickname
   * @param {boolean} [player.isHost=false] - Whether player is host
   * @param {boolean} [player.isAI=false] - Whether player is AI
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.selectable=false] - Can be clicked to select
   * @param {boolean} [options.disabled=false] - Disabled state (grayed out, non-interactive)
   * @param {boolean} [options.selected=false] - Currently selected
   * @param {boolean} [options.isDead=false] - Dead state (for Werewolf)
   * @param {Function} [options.onClick] - Click callback
   * @param {Array<{type: string, text: string, color?: string}>} [options.badges] - Badge array
   */
  constructor(player, options = {}) {
    this.player = player;
    this.options = options;
    this.element = null;
    this.isOnline = true;
    this.isCurrentTurn = false;

    this._create();
  }

  /**
   * Create DOM element
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'player-avatar';
    this._render();
  }

  /**
   * Render the avatar
   * @private
   */
  _render() {
    const color = this._getColor();
    const initial = this._getInitial();
    const {
      selectable = false,
      disabled = false,
      selected = false,
      isDead = false,
      badges = []
    } = this.options;

    // Build CSS classes
    const classes = ['player-avatar'];
    if (selectable && !disabled && !isDead) classes.push('player-avatar--selectable');
    if (selected) classes.push('player-avatar--selected');
    if (disabled) classes.push('player-avatar--disabled');
    if (isDead) classes.push('player-avatar--dead');
    if (this.isCurrentTurn) classes.push('player-avatar--current');
    this.element.className = classes.join(' ');

    // Base styles
    this.element.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2);
      border-radius: var(--radius-base);
      transition: all var(--transition-fast);
      position: relative;
    `;

    // Build badges HTML
    const badgesHtml = badges.map((badge, index) => {
      const bgColor = badge.color || this._getBadgeColor(badge.type);
      return `
        <span class="player-avatar__badge player-avatar__badge--${badge.type}" style="
          position: absolute;
          ${index === 0 ? 'bottom: -6px;' : `bottom: ${-6 - (index * 20)}px;`}
          left: 50%;
          transform: translateX(-50%);
          padding: 2px 6px;
          background: ${bgColor};
          color: white;
          border-radius: var(--radius-sm);
          font-size: 9px;
          font-weight: var(--font-bold);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          white-space: nowrap;
          z-index: ${10 - index};
        ">${this._escapeHtml(badge.text)}</span>
      `;
    }).join('');

    this.element.innerHTML = `
      <div class="avatar-circle" style="
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: white;
        position: relative;
      ">
        ${initial}
        ${this.player.isHost ? `
          <span class="avatar-badge avatar-badge--host" style="
            position: absolute;
            top: -4px;
            right: -4px;
            width: 16px;
            height: 16px;
            background: var(--warning-500);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
          ">👑</span>
        ` : ''}
        ${this.player.isAI ? `
          <span class="avatar-badge avatar-badge--ai" style="
            position: absolute;
            top: -4px;
            left: -4px;
            width: 18px;
            height: 18px;
            background: var(--neutral-600);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: white;
          ">🤖</span>
        ` : ''}
        ${this.isOnline && !isDead ? `
          <span class="avatar-online-indicator" style="
            position: absolute;
            bottom: 0;
            right: 0;
            width: 12px;
            height: 12px;
            background: var(--success-500);
            border-radius: 50%;
            border: 2px solid white;
          "></span>
        ` : ''}
        ${isDead ? `
          <span class="avatar-dead-marker" style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 32px;
            color: var(--error-500);
            text-shadow: 0 0 4px white;
          ">✕</span>
        ` : ''}
        ${badgesHtml}
      </div>
      <div class="avatar-name" style="
        font-size: var(--text-sm);
        color: var(--text-primary);
        text-align: center;
        word-break: break-word;
        max-width: 80px;
      ">${this._escapeHtml(this.player.nickname)}</div>
      ${this.isCurrentTurn && !isDead ? `
        <div class="avatar-turn-indicator" style="
          font-size: var(--text-xs);
          color: var(--primary-600);
          font-weight: var(--font-medium);
        ">当前回合</div>
      ` : ''}
    `;

    // Bind click event if selectable
    if (selectable && !disabled && !isDead && this.options.onClick) {
      this.element.style.cursor = 'pointer';
      this.element.onclick = (e) => {
        e.stopPropagation();
        this.options.onClick(this.player.id);
      };
    }
  }

  /**
   * Get badge background color based on type
   * @private
   * @param {string} type
   * @returns {string}
   */
  _getBadgeColor(type) {
    const colors = {
      uno: 'linear-gradient(135deg, var(--uno-red) 0%, var(--error-600) 100%)',
      skip: 'var(--warning-500)',
      wolf: 'var(--error-500)',
      seer: 'var(--primary-500)',
      protected: 'var(--success-500)',
      order: 'var(--neutral-400)',
      speaking: 'var(--success-500)',
      voting: 'var(--primary-500)'
    };
    return colors[type] || 'var(--neutral-500)';
  }

  /**
   * Get consistent color for player
   * @private
   * @returns {string}
   */
  _getColor() {
    let hash = 0;
    const str = this.player.id;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  /**
   * Get initial letter from nickname
   * @private
   * @returns {string}
   */
  _getInitial() {
    const name = this.player.nickname || 'P';
    return name.charAt(0).toUpperCase();
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Render with new player data
   * @param {Object} player - Player data
   */
  render(player) {
    this.player = player;
    this._render();
  }

  /**
   * Update options
   * @param {Object} options - New options
   */
  updateOptions(options) {
    this.options = { ...this.options, ...options };
    this._render();
  }

  /**
   * Set online status
   * @param {boolean} isOnline
   */
  setOnline(isOnline) {
    this.isOnline = isOnline;
    this._render();
  }

  /**
   * Set current turn status
   * @param {boolean} isCurrent
   */
  setCurrentTurn(isCurrent) {
    this.isCurrentTurn = isCurrent;
    this._render();
  }

  /**
   * Get DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.element) {
      this.element.onclick = null;
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
    this.element = null;
  }
}

/**
 * Create player avatar element
 * @param {Object} player - Player object
 * @param {Object} [options] - Additional options
 * @returns {HTMLElement}
 */
export function createPlayerAvatar(player, options = {}) {
  const avatar = new PlayerAvatar(player, options);
  return avatar.getElement();
}

export default PlayerAvatar;
