/**
 * Player Avatar Component
 * @module components/player-avatar
 */

const AVATAR_COLORS = [
  '#667eea', '#43e97b', '#f093fb', '#f5576c',
  '#4facfe', '#ffecd2', '#a8edea', '#fed6e3'
];

/**
 * Player Avatar component
 */
export class PlayerAvatar {
  /**
   * @param {Object} player - Player object
   * @param {string} player.id - Player ID
   * @param {string} player.nickname - Player nickname
   * @param {boolean} [player.isHost=false] - Whether player is host
   */
  constructor(player) {
    this.player = player;
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

    this.element.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2);
      border-radius: var(--radius-base);
      transition: all var(--transition-fast);
      ${this.isCurrentTurn ? 'background: var(--primary-50); box-shadow: 0 0 0 2px var(--primary-500);' : ''}
    `;

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
        ${!this.isOnline ? 'opacity: 0.5; filter: grayscale(50%);' : ''}
      ">
        ${initial}
        ${this.player.isHost ? `
          <span style="
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
          <span style="
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
        ${this.isOnline ? `
          <span style="
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
      </div>
      <div class="avatar-name" style="
        font-size: var(--text-sm);
        color: var(--text-primary);
        text-align: center;
        word-break: break-word;
      ">${this._escapeHtml(this.player.nickname)}</div>
      ${this.isCurrentTurn ? `
        <div style="
          font-size: var(--text-xs);
          color: var(--primary-600);
          font-weight: var(--font-medium);
        ">当前回合</div>
      ` : ''}
    `;
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
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

/**
 * Create player avatar element
 * @param {Object} player - Player object
 * @returns {HTMLElement}
 */
export function createPlayerAvatar(player) {
  const avatar = new PlayerAvatar(player);
  return avatar.getElement();
}

export default PlayerAvatar;
