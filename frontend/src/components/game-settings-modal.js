/**
 * Game Settings Modal Component
 * @module components/game-settings-modal
 */

/**
 * Game Settings Modal - Configure game options before starting
 */
export class GameSettingsModal {
  /**
   * @param {Object} options
   * @param {Object} options.gameConfig - Game configuration with settingsSchema
   * @param {string} options.mode - 'offline' or 'online'
   * @param {Function} options.onConfirm - Called with settings when confirmed
   * @param {Function} options.onCancel - Called when cancelled
   */
  constructor(options = {}) {
    this.options = options;
    this.gameConfig = options.gameConfig || {};
    this.mode = options.mode || 'offline';
    this.element = null;
    this.settings = this._getDefaultSettings();

    this._create();
  }

  /**
   * Get default settings from schema
   * @private
   */
  _getDefaultSettings() {
    const schema = this.gameConfig.settingsSchema || {};
    const defaults = {};

    Object.entries(schema).forEach(([key, config]) => {
      defaults[key] = config.default;
    });

    return defaults;
  }

  /**
   * Create the modal DOM
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'game-settings-modal';
    this.element.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    `;

    this._render();
  }

  /**
   * Render the modal content
   * @private
   */
  _render() {
    const schema = this.gameConfig.settingsSchema || {};
    const hasSettings = Object.keys(schema).length > 0;

    this.element.innerHTML = `
      <div class="modal-content card" style="
        width: 100%;
        max-width: 480px;
        max-height: 90vh;
        overflow-y: auto;
        animation: slideUp 0.3s ease;
      ">
        <div class="card-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h3 style="margin: 0;">${this.gameConfig.name || '游戏'} - 设置</h3>
          <button class="btn btn-ghost btn-sm close-btn" style="font-size: 1.5em; line-height: 1;">&times;</button>
        </div>

        <div class="card-body">
          <div style="
            display: flex;
            gap: var(--spacing-2);
            margin-bottom: var(--spacing-4);
          ">
            <span style="
              padding: var(--spacing-1) var(--spacing-3);
              background: ${this.mode === 'offline' ? 'var(--primary-500)' : 'var(--success-500)'};
              color: white;
              border-radius: var(--radius-full);
              font-size: var(--text-sm);
            ">
              ${this.mode === 'offline' ? '单机模式' : '联机模式'}
            </span>
            <span style="
              padding: var(--spacing-1) var(--spacing-3);
              background: var(--bg-tertiary);
              color: var(--text-secondary);
              border-radius: var(--radius-full);
              font-size: var(--text-sm);
            ">
              ${this.gameConfig.minPlayers}-${this.gameConfig.maxPlayers} 人
            </span>
          </div>

          ${hasSettings ? `
            <div class="settings-form" style="display: flex; flex-direction: column; gap: var(--spacing-4);">
              ${Object.entries(schema).map(([key, config]) => this._renderSettingField(key, config)).join('')}
            </div>
          ` : `
            <p style="color: var(--text-secondary); text-align: center; padding: var(--spacing-4);">
              此游戏暂无可配置选项
            </p>
          `}

          ${this.mode === 'offline' && this.gameConfig.supportsAI !== false ? `
            <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--border-light);">
              <label style="display: block; margin-bottom: var(--spacing-2); font-weight: var(--font-medium);">
                AI 玩家数量
              </label>
              <div style="display: flex; align-items: center; gap: var(--spacing-3);">
                <input type="range" class="ai-count-slider" min="1" max="${(this.gameConfig.maxPlayers || 4) - 1}" value="1" style="flex: 1;">
                <span class="ai-count-display" style="
                  min-width: 60px;
                  text-align: center;
                  padding: var(--spacing-1) var(--spacing-2);
                  background: var(--bg-tertiary);
                  border-radius: var(--radius-sm);
                ">1 个</span>
              </div>
            </div>
          ` : ''}
          ${this.mode === 'offline' && this.gameConfig.supportsAI === false ? `
            <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--border-light);">
              <p style="color: var(--text-tertiary); font-size: var(--text-sm); text-align: center;">
                ⚠️ 此游戏暂不支持 AI 玩家，请创建房间进行联机游戏
              </p>
            </div>
          ` : ''}
        </div>

        <div class="card-footer" style="display: flex; gap: var(--spacing-3); justify-content: flex-end;">
          <button class="btn btn-secondary cancel-btn">取消</button>
          <button class="btn btn-primary confirm-btn">
            ${this.mode === 'offline' ? '开始游戏' : '创建房间'}
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * Render a single setting field
   * @private
   */
  _renderSettingField(key, config) {
    const { type, label, description, default: defaultValue, min, max, options } = config;
    const currentValue = this.settings[key];

    let inputHtml = '';

    switch (type) {
      case 'boolean':
        inputHtml = `
          <label class="toggle-switch" style="display: flex; align-items: center; gap: var(--spacing-3); cursor: pointer;">
            <input type="checkbox" data-key="${key}" ${currentValue ? 'checked' : ''} style="
              width: 20px;
              height: 20px;
              cursor: pointer;
            ">
            <span>${label}</span>
          </label>
          ${description ? `<p style="margin: var(--spacing-1) 0 0; font-size: var(--text-sm); color: var(--text-tertiary);">${description}</p>` : ''}
        `;
        break;

      case 'number':
        inputHtml = `
          <label style="display: block; margin-bottom: var(--spacing-2); font-weight: var(--font-medium);">
            ${label}
          </label>
          <div style="display: flex; align-items: center; gap: var(--spacing-3);">
            <input type="range" data-key="${key}" min="${min || 1}" max="${max || 100}" value="${currentValue}" style="flex: 1;">
            <span class="value-display-${key}" style="
              min-width: 50px;
              text-align: center;
              padding: var(--spacing-1) var(--spacing-2);
              background: var(--bg-tertiary);
              border-radius: var(--radius-sm);
            ">${currentValue}</span>
          </div>
          ${description ? `<p style="margin: var(--spacing-1) 0 0; font-size: var(--text-sm); color: var(--text-tertiary);">${description}</p>` : ''}
        `;
        break;

      case 'select':
        inputHtml = `
          <label style="display: block; margin-bottom: var(--spacing-2); font-weight: var(--font-medium);">
            ${label}
          </label>
          <select data-key="${key}" class="input" style="width: 100%;">
            ${options.map(opt => `
              <option value="${opt.value}" ${currentValue === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
          ${description ? `<p style="margin: var(--spacing-1) 0 0; font-size: var(--text-sm); color: var(--text-tertiary);">${description}</p>` : ''}
        `;
        break;

      default:
        inputHtml = `<p>Unknown setting type: ${type}</p>`;
    }

    return `<div class="setting-field">${inputHtml}</div>`;
  }

  /**
   * Bind event handlers
   * @private
   */
  _bindEvents() {
    // Close button
    this.element.querySelector('.close-btn')?.addEventListener('click', () => {
      this.options.onCancel?.();
      this.destroy();
    });

    // Cancel button
    this.element.querySelector('.cancel-btn')?.addEventListener('click', () => {
      this.options.onCancel?.();
      this.destroy();
    });

    // Confirm button
    this.element.querySelector('.confirm-btn')?.addEventListener('click', () => {
      const aiCount = this.mode === 'offline'
        ? parseInt(this.element.querySelector('.ai-count-slider')?.value || '1')
        : 0;

      this.options.onConfirm?.({
        settings: { ...this.settings },
        aiCount
      });
      this.destroy();
    });

    // Click outside to close
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.options.onCancel?.();
        this.destroy();
      }
    });

    // AI count slider
    const aiSlider = this.element.querySelector('.ai-count-slider');
    const aiDisplay = this.element.querySelector('.ai-count-display');
    if (aiSlider && aiDisplay) {
      aiSlider.addEventListener('input', (e) => {
        aiDisplay.textContent = `${e.target.value} 个`;
      });
    }

    // Setting inputs
    this.element.querySelectorAll('[data-key]').forEach(input => {
      const key = input.dataset.key;
      const schema = this.gameConfig.settingsSchema?.[key];

      if (!schema) return;

      input.addEventListener('input', (e) => {
        const target = e.target;

        if (schema.type === 'boolean') {
          this.settings[key] = target.checked;
        } else if (schema.type === 'number') {
          this.settings[key] = parseInt(target.value);
          const display = this.element.querySelector(`.value-display-${key}`);
          if (display) display.textContent = target.value;
        } else if (schema.type === 'select') {
          this.settings[key] = target.value;
        }
      });

      // Also handle change event for checkboxes and selects
      input.addEventListener('change', (e) => {
        const target = e.target;

        if (schema.type === 'boolean') {
          this.settings[key] = target.checked;
        } else if (schema.type === 'select') {
          this.settings[key] = target.value;
        }
      });
    });
  }

  /**
   * Mount to container
   * @param {HTMLElement} container
   */
  mount(container = document.body) {
    container.appendChild(this.element);
  }

  /**
   * Destroy and remove from DOM
   */
  destroy() {
    this.element?.remove();
    this.element = null;
  }

  /**
   * Get current settings
   * @returns {Object}
   */
  getSettings() {
    return { ...this.settings };
  }
}

export default GameSettingsModal;
