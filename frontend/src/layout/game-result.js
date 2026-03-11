/**
 * Game Result Component
 * @module layout/game-result
 */

/**
 * Game Result - End game summary screen
 */
export class GameResult {
  /**
   * @param {Object} options
   * @param {Object} options.result - Game result data
   * @param {string} options.result.winner - Winner player ID
   * @param {Array} options.result.rankings - Player rankings
   * @param {Object} options.result.stats - Game statistics
   * @param {string} options.playerId - Current player ID
   * @param {Function} options.onPlayAgain - Called to play again
   * @param {Function} options.onBackToLobby - Called to return to lobby
   * @param {string} [options.playAgainLabel='再来一局'] - Label for the primary action
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.result = options.result || {};
    this.playerId = options.playerId || '';
    this.playAgainLabel = options.playAgainLabel || '再来一局';

    this._create();
  }

  /**
   * Create the result screen DOM
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'game-result';
    this.element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      animation: fadeIn var(--transition-fast) forwards;
    `;

    this._render();
  }

  /**
   * Render the result screen
   * @private
   */
  _render() {
    const { winner, rankings = [], stats = {} } = this.result;
    const isWinner = winner === this.playerId;

    this.element.innerHTML = `
      <div class="result-container card" style="
        width: 450px;
        max-width: 90vw;
        text-align: center;
        animation: slideUp var(--transition-slow) forwards;
      ">
        <div class="card-body" style="padding: var(--spacing-8);">
          <!-- Victory/Defeat banner -->
          <div style="
            font-size: 64px;
            margin-bottom: var(--spacing-4);
          ">${isWinner ? '🏆' : '💫'}</div>

          <h2 style="
            margin: 0 0 var(--spacing-2) 0;
            font-size: var(--text-3xl);
            color: ${isWinner ? 'var(--success-500)' : 'var(--text-primary)'};
          ">${isWinner ? '胜利!' : '游戏结束'}</h2>

          ${winner && !isWinner ? `
            <p style="color: var(--text-secondary); margin-bottom: var(--spacing-6);">
              ${this._getPlayerName(winner)} 获胜
            </p>
          ` : ''}

          <!-- Rankings -->
          ${rankings.length > 0 ? `
            <div style="
              background: var(--bg-secondary);
              border-radius: var(--radius-base);
              padding: var(--spacing-4);
              margin-bottom: var(--spacing-6);
            ">
              <h3 style="margin: 0 0 var(--spacing-3) 0; font-size: var(--text-base); color: var(--text-secondary);">
                排名
              </h3>
              <div style="display: flex; flex-direction: column; gap: var(--spacing-2);">
                ${rankings.map((player, i) => `
                  <div style="
                    display: flex;
                    align-items: center;
                    padding: var(--spacing-2) var(--spacing-3);
                    background: ${player.playerId === this.playerId ? 'var(--primary-50)' : 'var(--bg-primary)'};
                    border-radius: var(--radius-sm);
                    ${player.playerId === this.playerId ? 'border: 1px solid var(--primary-200);' : ''}
                  ">
                    <span style="
                      width: 24px;
                      height: 24px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      background: ${this._getRankColor(i)};
                      color: white;
                      border-radius: 50%;
                      font-size: var(--text-sm);
                      font-weight: var(--font-bold);
                      margin-right: var(--spacing-3);
                    ">${i + 1}</span>
                    <span style="flex: 1; text-align: left;">
                      ${this._escapeHtml(player.nickname || player.playerId)}
                      ${player.playerId === this.playerId ? ' (你)' : ''}
                    </span>
                    <span style="color: var(--text-secondary); font-weight: var(--font-medium);">
                      ${player.score ?? '-'} 分
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Stats -->
          ${Object.keys(stats).length > 0 ? `
            <div style="
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: var(--spacing-3);
              margin-bottom: var(--spacing-6);
            ">
              ${stats.duration !== undefined ? `
                <div style="
                  padding: var(--spacing-3);
                  background: var(--bg-secondary);
                  border-radius: var(--radius-base);
                ">
                  <div style="font-size: var(--text-xs); color: var(--text-tertiary);">游戏时长</div>
                  <div style="font-size: var(--text-lg); font-weight: var(--font-semibold);">
                    ${this._formatDuration(stats.duration)}
                  </div>
                </div>
              ` : ''}
              ${stats.totalTurns !== undefined ? `
                <div style="
                  padding: var(--spacing-3);
                  background: var(--bg-secondary);
                  border-radius: var(--radius-base);
                ">
                  <div style="font-size: var(--text-xs); color: var(--text-tertiary);">总回合数</div>
                  <div style="font-size: var(--text-lg); font-weight: var(--font-semibold);">
                    ${stats.totalTurns}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Actions -->
          <div style="display: flex; gap: var(--spacing-3); justify-content: center;">
            <button class="btn btn-secondary back-btn">返回大厅</button>
            <button class="btn btn-primary play-again-btn">${this._escapeHtml(this.playAgainLabel)}</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * Get player name by ID
   * @private
   */
  _getPlayerName(playerId) {
    const player = this.result.rankings?.find(p => p.playerId === playerId);
    return player?.nickname || playerId;
  }

  /**
   * Get rank color
   * @private
   */
  _getRankColor(index) {
    const colors = ['#ffd700', '#c0c0c0', '#cd7f32', 'var(--neutral-400)'];
    return colors[index] || colors[3];
  }

  /**
   * Format duration
   * @private
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Bind events
   * @private
   */
  _bindEvents() {
    this.element.querySelector('.back-btn')?.addEventListener('click', () => {
      this.close();
      this.options.onBackToLobby?.();
    });

    this.element.querySelector('.play-again-btn')?.addEventListener('click', () => {
      this.close();
      this.options.onPlayAgain?.();
    });

    // Click outside closes
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.close();
        this.options.onBackToLobby?.();
      }
    });
  }

  /**
   * Show the result screen
   */
  show() {
    document.body.appendChild(this.element);
  }

  /**
   * Close the result screen
   */
  close() {
    this.element.style.animation = 'fadeOut var(--transition-fast) forwards';
    setTimeout(() => {
      this.element.remove();
    }, 150);
  }

  /**
   * Get element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}

export default GameResult;
