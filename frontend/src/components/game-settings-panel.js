/**
 * Game Settings Panel Component
 * @module components/game-settings-panel
 *
 * Displays game settings in read-only or editable mode.
 * Supports grouped collapsible sections when settingsGroups is defined.
 * Used in WaitingRoom (editable for host) and GameBoard (read-only).
 */

/**
 * Game Settings Panel - Display and optionally edit game settings
 */
export class GameSettingsPanel {
  /**
   * @param {Object} options
   * @param {Object} options.gameConfig - Game configuration with settingsSchema
   * @param {Object} options.settings - Current settings values
   * @param {boolean} options.editable - Whether settings can be edited
   * @param {boolean} options.compact - Use compact display mode
   * @param {Function} options.onChange - Called when a setting changes (editable mode only)
   */
  constructor(options = {}) {
    this.gameConfig = options.gameConfig || {};
    this.settings = options.settings || {};
    this.editable = options.editable || false;
    this.compact = options.compact || false;
    this.onChange = options.onChange;
    this.element = null;
    /** @type {Object<string, boolean>} Track collapsed state per group */
    this._collapsedGroups = {};

    this._create();
  }

  /**
   * Create the panel DOM
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'game-settings-panel';
    this._render();
  }

  /**
   * Render the panel
   * @private
   */
  _render() {
    const schema = this.gameConfig.settingsSchema || {};
    const hasSettings = Object.keys(schema).length > 0;

    if (!hasSettings) {
      this.element.innerHTML = `
        <p style="color: var(--text-tertiary); font-size: var(--text-sm); text-align: center; margin: 0;">
          使用默认设置
        </p>
      `;
      return;
    }

    const groups = this.gameConfig.settingsGroups;
    const settingsHtml = groups
      ? this._renderGrouped(schema, groups)
      : this._renderFlat(schema);

    this.element.innerHTML = `
      <div class="settings-list" style="
        display: flex;
        flex-direction: column;
        gap: ${this.compact ? 'var(--spacing-2)' : 'var(--spacing-3)'};
      ">
        ${settingsHtml}
      </div>
    `;

    if (groups) {
      this._bindGroupToggle();
    }
    if (this.editable) {
      this._bindEvents();
    }
  }

  /**
   * Render settings as a flat list (no groups)
   * @private
   */
  _renderFlat(schema) {
    return Object.entries(schema).map(([key, config]) => {
      return this._renderSetting(key, config);
    }).join('');
  }

  /**
   * Render settings grouped into collapsible sections
   * @private
   */
  _renderGrouped(schema, groups) {
    const grouped = new Map();
    for (const g of groups) {
      grouped.set(g.id, { label: g.label, settings: [] });
    }
    grouped.set('_ungrouped', { label: '其他', settings: [] });

    for (const [key, config] of Object.entries(schema)) {
      const groupId = config.group || '_ungrouped';
      const bucket = grouped.get(groupId) || grouped.get('_ungrouped');
      bucket.settings.push({ key, config });
    }

    let html = '';
    for (const [groupId, { label, settings }] of grouped) {
      if (settings.length === 0) continue;

      const collapsed = this._collapsedGroups[groupId] ?? true;
      const arrowChar = collapsed ? '▶' : '▼';

      const settingsInnerHtml = settings.map(
        ({ key, config }) => this._renderSetting(key, config)
      ).join('');

      html += `
        <div class="settings-group" data-group-id="${groupId}">
          <div class="settings-group-header" data-group-toggle="${groupId}" style="
            display: flex;
            align-items: center;
            gap: var(--spacing-2);
            padding: var(--spacing-2) var(--spacing-1);
            cursor: pointer;
            user-select: none;
            border-bottom: 1px solid var(--border-primary);
            margin-bottom: ${collapsed ? '0' : 'var(--spacing-2)'};
          ">
            <span class="group-arrow" style="
              font-size: var(--text-xs);
              color: var(--text-tertiary);
              width: 12px;
              text-align: center;
              transition: transform 0.15s;
            ">${arrowChar}</span>
            <span style="
              font-weight: var(--font-semibold);
              font-size: var(--text-sm);
              color: var(--text-primary);
            ">${label}</span>
            <span style="
              font-size: var(--text-xs);
              color: var(--text-tertiary);
              margin-left: auto;
            ">${settings.length} 项</span>
          </div>
          <div class="settings-group-body" style="
            display: ${collapsed ? 'none' : 'flex'};
            flex-direction: column;
            gap: ${this.compact ? 'var(--spacing-1)' : 'var(--spacing-2)'};
            padding-left: var(--spacing-4);
          ">
            ${settingsInnerHtml}
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Bind click events for group toggle headers
   * @private
   */
  _bindGroupToggle() {
    this.element.querySelectorAll('[data-group-toggle]').forEach(header => {
      header.addEventListener('click', () => {
        const groupId = header.dataset.groupToggle;
        const wasCollapsed = this._collapsedGroups[groupId] ?? true;
        this._collapsedGroups[groupId] = !wasCollapsed;

        const group = header.closest('.settings-group');
        const body = group?.querySelector('.settings-group-body');
        const arrow = header.querySelector('.group-arrow');

        if (body) {
          body.style.display = wasCollapsed ? 'flex' : 'none';
        }
        if (arrow) {
          arrow.textContent = wasCollapsed ? '▼' : '▶';
        }
        header.style.marginBottom = wasCollapsed ? 'var(--spacing-2)' : '0';
      });
    });
  }

  /**
   * Render a single setting
   * @private
   */
  _renderSetting(key, config) {
    const { type, label, description } = config;
    const value = this.settings[key] ?? config.default;

    if (this.editable) {
      return this._renderEditableSetting(key, config, value);
    }

    // Read-only display
    let displayValue = '';
    if (type === 'boolean') {
      displayValue = value ? '开启' : '关闭';
    } else if (type === 'select') {
      const option = config.options?.find(o => o.value === value);
      displayValue = option?.label || value;
    } else {
      displayValue = String(value);
    }

    return `
      <div class="setting-item" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        ${this.compact ? 'font-size: var(--text-sm);' : ''}
      ">
        <span style="color: var(--text-secondary);" title="${description || ''}">${label}</span>
        <span style="
          font-weight: var(--font-medium);
          color: ${type === 'boolean' ? (value ? 'var(--success-500)' : 'var(--text-tertiary)') : 'var(--text-primary)'};
        ">${displayValue}</span>
      </div>
    `;
  }

  /**
   * Render an editable setting
   * @private
   */
  _renderEditableSetting(key, config, value) {
    const { type, label, description, min, max, options } = config;

    let inputHtml = '';

    switch (type) {
      case 'boolean':
        inputHtml = `
          <label class="setting-toggle" style="display: flex; align-items: center; gap: var(--spacing-2); cursor: pointer;">
            <input type="checkbox" data-key="${key}" ${value ? 'checked' : ''} style="
              width: 18px;
              height: 18px;
              cursor: pointer;
            ">
            <span>${label}</span>
          </label>
        `;
        break;

      case 'number':
        inputHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="color: var(--text-secondary);">${label}</label>
            <div style="display: flex; align-items: center; gap: var(--spacing-2);">
              <input type="range" data-key="${key}" min="${min || 1}" max="${max || 100}" value="${value}" style="width: 80px;">
              <span class="value-display-${key}" style="
                min-width: 30px;
                text-align: center;
                font-weight: var(--font-medium);
              ">${value}</span>
            </div>
          </div>
        `;
        break;

      case 'select':
        inputHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="color: var(--text-secondary);">${label}</label>
            <select data-key="${key}" class="input" style="width: auto; padding: var(--spacing-1) var(--spacing-2);">
              ${options.map(opt => `
                <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                  ${opt.label}
                </option>
              `).join('')}
            </select>
          </div>
        `;
        break;

      default:
        inputHtml = `<p>Unknown: ${type}</p>`;
    }

    return `
      <div class="setting-item" style="${this.compact ? 'font-size: var(--text-sm);' : ''}">
        ${inputHtml}
        ${description && !this.compact ? `
          <p style="margin: 2px 0 0; font-size: var(--text-xs); color: var(--text-tertiary);">${description}</p>
        ` : ''}
      </div>
    `;
  }

  /**
   * Bind events for editable mode
   * @private
   */
  _bindEvents() {
    this.element.querySelectorAll('[data-key]').forEach(input => {
      const key = input.dataset.key;
      const schema = this.gameConfig.settingsSchema?.[key];
      if (!schema) return;

      const handleChange = (e) => {
        const target = e.target;
        let newValue;

        if (schema.type === 'boolean') {
          newValue = target.checked;
        } else if (schema.type === 'number') {
          newValue = parseInt(target.value);
          const display = this.element.querySelector(`.value-display-${key}`);
          if (display) display.textContent = target.value;
        } else if (schema.type === 'select') {
          newValue = target.value;
        }

        this.settings[key] = newValue;
        this.onChange?.(key, newValue, { ...this.settings });
      };

      input.addEventListener('input', handleChange);
      input.addEventListener('change', handleChange);
    });
  }

  /**
   * Update settings and re-render
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    this.settings = { ...settings };
    this._render();
  }

  /**
   * Get current settings
   * @returns {Object}
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Destroy the panel
   */
  destroy() {
    this.element?.remove();
    this.element = null;
  }
}

export default GameSettingsPanel;
