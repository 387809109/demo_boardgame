/**
 * Player Ring Component - Circular layout for players
 * @module components/player-ring
 */

import { PlayerAvatar } from './player-avatar.js';

/**
 * Calculate position on a circle
 * Self is always at bottom (90 degrees in screen coords where Y increases downward)
 * Player positions are FIXED regardless of game direction - direction only affects the indicator
 *
 * Screen coordinate system:
 * - 0° = right, 90° = bottom, 180° = left, 270° = top
 * - Players are arranged counterclockwise on screen (bottom → left → top → right)
 * - This matches game "clockwise" direction (play passes to your left at a physical table)
 *
 * @param {number} index - Player index (0 = self at bottom)
 * @param {number} total - Total number of players
 * @param {number} radius - Circle radius in pixels
 * @returns {{x: number, y: number, angle: number}}
 */
function calculatePosition(index, total, radius) {
  // Start at bottom (90 degrees in screen coords where Y+ is down)
  const startAngle = 90;
  // Step between players
  const step = 360 / total;
  // Arrange counterclockwise on screen (add angle = go left visually)
  // This matches game clockwise (next player is to your left)
  const angle = (startAngle + index * step) % 360;
  // Convert to radians
  const radians = (angle * Math.PI) / 180;

  return {
    x: Math.cos(radians) * radius,
    y: Math.sin(radians) * radius,
    angle
  };
}

/**
 * Reorder players array so self is first (index 0)
 * @param {Array} players - All players
 * @param {string} selfId - Self player ID
 * @returns {Array} Reordered players with self first
 */
function reorderPlayers(players, selfId) {
  const selfIndex = players.findIndex(p => p.id === selfId);
  if (selfIndex === -1) return players;

  // Self first, then others in original order
  return [
    players[selfIndex],
    ...players.slice(selfIndex + 1),
    ...players.slice(0, selfIndex)
  ];
}

/**
 * Player Ring Component
 * Displays players in a circular layout around a center area
 */
export class PlayerRing {
  /**
   * @param {Object} options
   * @param {Array} options.players - Player list
   * @param {string} options.selfPlayerId - Current player's ID (fixed at bottom)
   * @param {string} [options.currentPlayerId] - Current turn player ID
   * @param {number} [options.direction=1] - 1 for clockwise, -1 for counterclockwise
   * @param {Function} [options.onPlayerSelect] - Called when a player is selected
   * @param {Array<string>} [options.selectableIds] - Player IDs that can be selected
   * @param {Array<string>} [options.disabledIds] - Player IDs that are disabled
   * @param {Array<string>} [options.deadIds] - Dead player IDs
   * @param {Object} [options.badges] - Badges by player ID: {playerId: [{type, text, color}]}
   * @param {HTMLElement} [options.centerContent] - Content to place in center
   * @param {number} [options.minRadius=120] - Minimum ring radius
   * @param {number} [options.maxRadius=200] - Maximum ring radius
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.avatars = new Map();
    this._skipBadgeTimeouts = new Map();

    this._create();
  }

  /**
   * Create the ring container
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'player-ring';
    this._render();
  }

  /**
   * Render the ring
   * @private
   */
  _render() {
    const {
      players = [],
      selfPlayerId,
      currentPlayerId,
      direction = 1,
      onPlayerSelect,
      selectableIds = [],
      disabledIds = [],
      deadIds = [],
      badges = {},
      centerContent,
      minRadius = 120,
      maxRadius = 200,
      selectedId = null
    } = this.options;

    // Clean up old avatars
    this.avatars.forEach(avatar => avatar.destroy());
    this.avatars.clear();

    // Calculate optimal radius based on player count
    const playerCount = players.length;
    const radius = this._calculateRadius(playerCount, minRadius, maxRadius);

    // Container needs to be sized to fit the ring
    const containerSize = radius * 2 + 120; // Extra space for avatars

    this.element.style.cssText = `
      position: relative;
      width: ${containerSize}px;
      height: ${containerSize}px;
      margin: 0 auto;
    `;

    this.element.innerHTML = '';

    // Reorder players so self is first (at bottom)
    const orderedPlayers = reorderPlayers(players, selfPlayerId);

    // Create avatar container
    const ringContainer = document.createElement('div');
    ringContainer.className = 'player-ring__container';
    ringContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
    `;

    // Place each player (positions are fixed, direction only affects indicator)
    orderedPlayers.forEach((player, index) => {
      const pos = calculatePosition(index, playerCount, radius);
      const isSelf = player.id === selfPlayerId;
      const isCurrent = player.id === currentPlayerId;
      const isSelectable = selectableIds.includes(player.id);
      const isDisabled = disabledIds.includes(player.id);
      const isDead = deadIds.includes(player.id);
      const selectedIdsSet = this.options.selectedIds;
      const isSelected = selectedIdsSet
        ? selectedIdsSet.includes(player.id)
        : player.id === selectedId;
      const playerBadges = badges[player.id] || [];

      // Add display suffix for self
      const displayPlayer = { ...player };
      if (isSelf) {
        displayPlayer.nickname = `${player.nickname}（我）`;
      }

      const avatar = new PlayerAvatar(displayPlayer, {
        selectable: isSelectable && !isDisabled && !isDead,
        disabled: isDisabled,
        selected: isSelected,
        isDead,
        badges: playerBadges,
        onClick: isSelectable ? (playerId) => {
          onPlayerSelect?.(playerId);
        } : null
      });

      avatar.setCurrentTurn(isCurrent);

      const avatarEl = avatar.getElement();
      avatarEl.className += ' player-ring__avatar';
      avatarEl.style.cssText += `
        position: absolute;
        left: ${pos.x}px;
        top: ${pos.y}px;
        transform: translate(-50%, -50%);
        z-index: ${isSelf ? 10 : 5};
      `;

      this.avatars.set(player.id, avatar);
      ringContainer.appendChild(avatarEl);
    });

    this.element.appendChild(ringContainer);

    // Center content area
    const centerEl = document.createElement('div');
    centerEl.className = 'player-ring__center';
    centerEl.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
      z-index: 1;
    `;

    // Direction indicator
    const dirIndicator = this._renderDirectionIndicator(direction);
    centerEl.appendChild(dirIndicator);

    // Custom center content
    if (centerContent) {
      centerEl.appendChild(centerContent);
    }

    this.element.appendChild(centerEl);
  }

  /**
   * Calculate optimal radius based on player count
   * @private
   */
  _calculateRadius(playerCount, minRadius, maxRadius) {
    // More players = larger radius to prevent overlap
    // Minimum 2 players, max around 12 for comfortable display
    const minPlayers = 2;
    const maxPlayers = 12;

    if (playerCount <= minPlayers) return minRadius;
    if (playerCount >= maxPlayers) return maxRadius;

    const ratio = (playerCount - minPlayers) / (maxPlayers - minPlayers);
    return minRadius + ratio * (maxRadius - minRadius);
  }

  /**
   * Render direction indicator
   * @private
   */
  _renderDirectionIndicator(direction) {
    const el = document.createElement('div');
    el.className = 'player-ring__direction';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-1);
    `;

    const isClockwise = direction === 1;
    const arrow = isClockwise ? '↻' : '↺';
    const label = isClockwise ? '顺时针' : '逆时针';

    el.innerHTML = `
      <span class="player-ring__direction-arrow" style="
        font-size: 48px;
        color: var(--primary-500);
        line-height: 1;
      ">${arrow}</span>
      <span class="player-ring__direction-label" style="
        font-size: var(--text-sm);
        color: var(--text-secondary);
        font-weight: var(--font-medium);
      ">${label}</span>
    `;

    return el;
  }

  /**
   * Update ring with new options
   * @param {Object} options - New options to merge
   */
  update(options) {
    this.options = { ...this.options, ...options };
    this._render();
  }

  /**
   * Show a skip badge on a player
   * @param {string} playerId - Player to show badge on
   * @param {number} [duration=0] - Duration in ms (0 = no auto-remove, caller must call removeSkipBadge)
   */
  showSkipBadge(playerId, duration = 0) {
    // Clear existing timeout for this player
    if (this._skipBadgeTimeouts.has(playerId)) {
      clearTimeout(this._skipBadgeTimeouts.get(playerId));
      this._skipBadgeTimeouts.delete(playerId);
    }

    // Add skip badge
    const currentBadges = this.options.badges || {};
    const playerBadges = currentBadges[playerId] || [];
    const hasSkipBadge = playerBadges.some(b => b.type === 'skip');

    if (!hasSkipBadge) {
      this.options.badges = {
        ...currentBadges,
        [playerId]: [...playerBadges, { type: 'skip', text: '跳过' }]
      };
      this._render();
    }

    // Set timeout to remove badge if duration > 0
    if (duration > 0) {
      const timeout = setTimeout(() => {
        this.removeSkipBadge(playerId);
        this._skipBadgeTimeouts.delete(playerId);
      }, duration);

      this._skipBadgeTimeouts.set(playerId, timeout);
    }
  }

  /**
   * Remove skip badge from player
   * @param {string} playerId - Player to remove badge from
   */
  removeSkipBadge(playerId) {
    // Clear any pending timeout
    if (this._skipBadgeTimeouts.has(playerId)) {
      clearTimeout(this._skipBadgeTimeouts.get(playerId));
      this._skipBadgeTimeouts.delete(playerId);
    }

    const currentBadges = this.options.badges || {};
    const playerBadges = currentBadges[playerId] || [];
    const filtered = playerBadges.filter(b => b.type !== 'skip');

    if (filtered.length !== playerBadges.length) {
      this.options.badges = {
        ...currentBadges,
        [playerId]: filtered
      };
      this._render();
    }
  }

  /**
   * Enable selection mode
   * @param {Object} config
   * @param {Array<string>} config.selectableIds - IDs that can be selected
   * @param {Array<string>} [config.disabledIds] - IDs that are disabled
   * @param {Function} config.onSelect - Selection callback
   * @param {string} [config.selectedId] - Currently selected player ID
   * @param {Array<string>} [config.selectedIds] - Multiple selected player IDs
   */
  enableSelection(config) {
    this.options.selectableIds = config.selectableIds || [];
    this.options.disabledIds = config.disabledIds || [];
    this.options.onPlayerSelect = config.onSelect;
    this.options.selectedId = config.selectedId || null;
    this.options.selectedIds = config.selectedIds || null;
    this._render();
  }

  /**
   * Disable selection mode
   */
  disableSelection() {
    this.options.selectableIds = [];
    this.options.disabledIds = [];
    this.options.onPlayerSelect = null;
    this._render();
  }

  /**
   * Get the element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Get center element for adding content
   * @returns {HTMLElement|null}
   */
  getCenterElement() {
    return this.element.querySelector('.player-ring__center');
  }

  /**
   * Destroy the component
   */
  destroy() {
    // Clear all timeouts
    this._skipBadgeTimeouts.forEach(timeout => clearTimeout(timeout));
    this._skipBadgeTimeouts.clear();

    // Destroy all avatars
    this.avatars.forEach(avatar => avatar.destroy());
    this.avatars.clear();

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

export default PlayerRing;
