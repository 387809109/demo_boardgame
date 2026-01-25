/**
 * Settings Panel Component
 * @module layout/settings-panel
 */

import { loadConfig, saveConfig, exportConfig, importConfig } from '../utils/storage.js';

/**
 * Settings Panel - User preferences and configuration
 */
export class SettingsPanel {
  /**
   * @param {Object} options
   * @param {Function} options.onClose - Called when closing panel
   * @param {Function} options.onSave - Called when settings are saved
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.config = loadConfig();

    this._create();
  }

  /**
   * Create the panel DOM
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'settings-panel';
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
   * Render the panel
   * @private
   */
  _render() {
    this.element.innerHTML = `
      <div class="settings-container card" style="
        width: 500px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: auto;
        animation: slideUp var(--transition-base) forwards;
      ">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0;">设置</h2>
          <button class="close-btn" style="
            background: none;
            border: none;
            font-size: var(--text-2xl);
            color: var(--text-secondary);
            cursor: pointer;
            line-height: 1;
          ">&times;</button>
        </div>

        <div class="card-body">
          <!-- Graphics Settings -->
          <section style="margin-bottom: var(--spacing-6);">
            <h3 style="margin: 0 0 var(--spacing-4) 0; font-size: var(--text-lg); color: var(--text-primary);">
              图形设置
            </h3>

            <div class="input-group" style="margin-bottom: var(--spacing-4);">
              <label class="input-label">分辨率</label>
              <select class="input resolution-select">
                <option value="auto" ${this.config.graphics.resolution === 'auto' ? 'selected' : ''}>自动</option>
                <option value="1920x1080" ${this.config.graphics.resolution === '1920x1080' ? 'selected' : ''}>1920x1080</option>
                <option value="1280x720" ${this.config.graphics.resolution === '1280x720' ? 'selected' : ''}>1280x720</option>
              </select>
            </div>

            <div class="input-group" style="margin-bottom: var(--spacing-4);">
              <label class="input-label">画质</label>
              <select class="input quality-select">
                <option value="high" ${this.config.graphics.quality === 'high' ? 'selected' : ''}>高</option>
                <option value="medium" ${this.config.graphics.quality === 'medium' ? 'selected' : ''}>中</option>
                <option value="low" ${this.config.graphics.quality === 'low' ? 'selected' : ''}>低</option>
              </select>
            </div>

            <label style="display: flex; align-items: center; gap: var(--spacing-2); cursor: pointer;">
              <input type="checkbox" class="fullscreen-checkbox" ${this.config.graphics.fullscreen ? 'checked' : ''}>
              <span>全屏模式</span>
            </label>
          </section>

          <!-- Audio Settings -->
          <section style="margin-bottom: var(--spacing-6);">
            <h3 style="margin: 0 0 var(--spacing-4) 0; font-size: var(--text-lg); color: var(--text-primary);">
              音频设置
            </h3>

            <div class="input-group" style="margin-bottom: var(--spacing-4);">
              <label class="input-label">主音量: <span class="master-value">${this.config.audio.master}</span>%</label>
              <input type="range" class="master-slider" min="0" max="100" value="${this.config.audio.master}" style="width: 100%;">
            </div>

            <div class="input-group" style="margin-bottom: var(--spacing-4);">
              <label class="input-label">音效: <span class="sfx-value">${this.config.audio.sfx}</span>%</label>
              <input type="range" class="sfx-slider" min="0" max="100" value="${this.config.audio.sfx}" style="width: 100%;">
            </div>

            <div class="input-group">
              <label class="input-label">音乐: <span class="music-value">${this.config.audio.music}</span>%</label>
              <input type="range" class="music-slider" min="0" max="100" value="${this.config.audio.music}" style="width: 100%;">
            </div>
          </section>

          <!-- Game Settings -->
          <section style="margin-bottom: var(--spacing-6);">
            <h3 style="margin: 0 0 var(--spacing-4) 0; font-size: var(--text-lg); color: var(--text-primary);">
              游戏设置
            </h3>

            <div class="input-group" style="margin-bottom: var(--spacing-4);">
              <label class="input-label">默认昵称</label>
              <input type="text" class="input nickname-input" value="${this.config.game.defaultNickname}" maxlength="20">
            </div>

            <div class="input-group">
              <label class="input-label">语言</label>
              <select class="input language-select">
                <option value="zh-CN" ${this.config.game.language === 'zh-CN' ? 'selected' : ''}>简体中文</option>
                <option value="en" ${this.config.game.language === 'en' ? 'selected' : ''}>English</option>
              </select>
            </div>
          </section>

          <!-- Import/Export -->
          <section>
            <h3 style="margin: 0 0 var(--spacing-4) 0; font-size: var(--text-lg); color: var(--text-primary);">
              数据管理
            </h3>

            <div style="display: flex; gap: var(--spacing-3);">
              <button class="btn btn-secondary export-btn">导出配置</button>
              <label class="btn btn-secondary" style="cursor: pointer;">
                导入配置
                <input type="file" class="import-input" accept=".json" style="display: none;">
              </label>
            </div>
          </section>
        </div>

        <div class="card-footer" style="display: flex; justify-content: flex-end; gap: var(--spacing-3);">
          <button class="btn btn-secondary cancel-btn">取消</button>
          <button class="btn btn-primary save-btn">保存</button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * Bind events
   * @private
   */
  _bindEvents() {
    // Close/cancel buttons
    this.element.querySelector('.close-btn')?.addEventListener('click', () => this.close());
    this.element.querySelector('.cancel-btn')?.addEventListener('click', () => this.close());

    // Click outside to close
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.close();
    });

    // Volume sliders
    const masterSlider = this.element.querySelector('.master-slider');
    const sfxSlider = this.element.querySelector('.sfx-slider');
    const musicSlider = this.element.querySelector('.music-slider');

    masterSlider?.addEventListener('input', (e) => {
      this.config.audio.master = parseInt(e.target.value);
      this.element.querySelector('.master-value').textContent = e.target.value;
    });

    sfxSlider?.addEventListener('input', (e) => {
      this.config.audio.sfx = parseInt(e.target.value);
      this.element.querySelector('.sfx-value').textContent = e.target.value;
    });

    musicSlider?.addEventListener('input', (e) => {
      this.config.audio.music = parseInt(e.target.value);
      this.element.querySelector('.music-value').textContent = e.target.value;
    });

    // Save button
    this.element.querySelector('.save-btn')?.addEventListener('click', () => {
      this._collectValues();
      saveConfig(this.config);
      this.options.onSave?.(this.config);
      this.close();
    });

    // Export
    this.element.querySelector('.export-btn')?.addEventListener('click', () => {
      exportConfig();
    });

    // Import
    this.element.querySelector('.import-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          this.config = await importConfig(file);
          this._render();
        } catch (err) {
          alert('导入失败: ' + err.message);
        }
      }
    });
  }

  /**
   * Collect form values
   * @private
   */
  _collectValues() {
    this.config.graphics.resolution = this.element.querySelector('.resolution-select')?.value || 'auto';
    this.config.graphics.quality = this.element.querySelector('.quality-select')?.value || 'high';
    this.config.graphics.fullscreen = this.element.querySelector('.fullscreen-checkbox')?.checked || false;

    this.config.game.defaultNickname = this.element.querySelector('.nickname-input')?.value || '';
    this.config.game.language = this.element.querySelector('.language-select')?.value || 'zh-CN';
  }

  /**
   * Show the panel
   */
  show() {
    document.body.appendChild(this.element);
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close the panel
   */
  close() {
    this.element.style.animation = 'fadeOut var(--transition-fast) forwards';
    setTimeout(() => {
      this.element.remove();
      document.body.style.overflow = '';
      this.options.onClose?.();
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

export default SettingsPanel;
