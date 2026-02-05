/**
 * Authentication Page — Login / Register
 * @module layout/auth-page
 */

import { showToast } from '../components/notification.js';

/**
 * AuthPage — login and registration UI
 */
export class AuthPage {
  /**
   * @param {Object} options
   * @param {import('../cloud/auth.js').AuthService} options.authService
   * @param {Function} options.onLoginSuccess - Called after successful login/register
   * @param {Function} options.onBack - Called when user clicks back
   */
  constructor(options = {}) {
    this.options = options;
    this.authService = options.authService;
    this.element = null;
    this._activeTab = 'login'; // 'login' | 'register'
    this._loading = false;

    this._create();
  }

  /**
   * Create the auth page DOM
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'auth-page';
    this.element.style.cssText = `
      min-height: 100vh;
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-4);
    `;
    this._render();
  }

  /**
   * Render the auth page
   * @private
   */
  _render() {
    const isLogin = this._activeTab === 'login';

    this.element.innerHTML = `
      <div class="auth-card card" style="
        width: 100%;
        max-width: 400px;
      ">
        <div class="card-body" style="padding: var(--spacing-6);">
          <h2 style="
            text-align: center;
            margin: 0 0 var(--spacing-6) 0;
            font-size: var(--text-2xl);
          ">
            ${isLogin ? '登录' : '注册'}
          </h2>

          <div class="auth-tabs" style="
            display: flex;
            margin-bottom: var(--spacing-6);
            border-bottom: 2px solid var(--border-color);
          ">
            <button class="auth-tab ${isLogin ? 'active' : ''}"
              data-tab="login"
              style="
                flex: 1;
                padding: var(--spacing-3);
                background: none;
                border: none;
                font-size: var(--text-base);
                cursor: pointer;
                color: ${isLogin ? 'var(--primary-600)' : 'var(--text-secondary)'};
                border-bottom: 2px solid ${isLogin ? 'var(--primary-600)' : 'transparent'};
                margin-bottom: -2px;
                font-weight: ${isLogin ? '600' : '400'};
              ">
              登录
            </button>
            <button class="auth-tab ${!isLogin ? 'active' : ''}"
              data-tab="register"
              style="
                flex: 1;
                padding: var(--spacing-3);
                background: none;
                border: none;
                font-size: var(--text-base);
                cursor: pointer;
                color: ${!isLogin ? 'var(--primary-600)' : 'var(--text-secondary)'};
                border-bottom: 2px solid ${!isLogin ? 'var(--primary-600)' : 'transparent'};
                margin-bottom: -2px;
                font-weight: ${!isLogin ? '600' : '400'};
              ">
              注册
            </button>
          </div>

          <form class="auth-form">
            ${!isLogin ? `
              <div class="input-group" style="margin-bottom: var(--spacing-4);">
                <label class="input-label">昵称</label>
                <input type="text" class="input nickname-input"
                  placeholder="游戏中显示的名字"
                  maxlength="20" required>
              </div>
            ` : ''}

            <div class="input-group" style="margin-bottom: var(--spacing-4);">
              <label class="input-label">邮箱</label>
              <input type="email" class="input email-input"
                placeholder="your@email.com" required>
            </div>

            <div class="input-group" style="margin-bottom: var(--spacing-4);">
              <label class="input-label">密码</label>
              <input type="password" class="input password-input"
                placeholder="${isLogin ? '输入密码' : '至少 6 位'}"
                minlength="6" required>
            </div>

            ${!isLogin ? `
              <div class="input-group" style="margin-bottom: var(--spacing-4);">
                <label class="input-label">确认密码</label>
                <input type="password" class="input confirm-input"
                  placeholder="再次输入密码"
                  minlength="6" required>
              </div>
            ` : ''}

            <button type="submit" class="btn btn-primary submit-btn" style="
              width: 100%;
              margin-top: var(--spacing-2);
              padding: var(--spacing-3);
            " ${this._loading ? 'disabled' : ''}>
              ${this._loading
                ? '处理中...'
                : (isLogin ? '登录' : '注册')}
            </button>
          </form>

          <button class="btn btn-ghost back-btn" style="
            width: 100%;
            margin-top: var(--spacing-4);
          ">
            返回大厅
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * Bind event handlers
   * @private
   */
  _bindEvents() {
    // Tab switching
    this.element.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.tab;
        this._render();
      });
    });

    // Form submit
    const form = this.element.querySelector('.auth-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSubmit();
    });

    // Back button
    this.element.querySelector('.back-btn')?.addEventListener('click', () => {
      this.options.onBack?.();
    });
  }

  /**
   * Handle form submission
   * @private
   */
  async _handleSubmit() {
    if (this._loading) return;

    const email = this.element.querySelector('.email-input')?.value.trim();
    const password = this.element.querySelector('.password-input')?.value;

    if (!email || !password) {
      showToast('请填写所有字段');
      return;
    }

    if (password.length < 6) {
      showToast('密码至少 6 位');
      return;
    }

    if (this._activeTab === 'register') {
      const nickname = this.element.querySelector('.nickname-input')
        ?.value.trim();
      const confirm = this.element.querySelector('.confirm-input')?.value;

      if (!nickname) {
        showToast('请输入昵称');
        return;
      }

      if (password !== confirm) {
        showToast('两次输入的密码不一致');
        return;
      }

      await this._doRegister(email, password, nickname);
    } else {
      await this._doLogin(email, password);
    }
  }

  /**
   * Perform login
   * @private
   */
  async _doLogin(email, password) {
    this._setLoading(true);

    const { user, error } = await this.authService.login(email, password);

    this._setLoading(false);

    if (error) {
      showToast(`登录失败: ${error}`);
      return;
    }

    showToast(`欢迎回来, ${user.nickname || user.email}`);
    this.options.onLoginSuccess?.(user);
  }

  /**
   * Perform registration
   * @private
   */
  async _doRegister(email, password, nickname) {
    this._setLoading(true);

    const { user, error } = await this.authService
      .register(email, password, nickname);

    this._setLoading(false);

    if (error) {
      showToast(`注册失败: ${error}`);
      return;
    }

    showToast(`注册成功, 欢迎 ${nickname}`);
    this.options.onLoginSuccess?.(user);
  }

  /**
   * Set loading state and re-render submit button
   * @private
   * @param {boolean} loading
   */
  _setLoading(loading) {
    this._loading = loading;
    const btn = this.element.querySelector('.submit-btn');
    if (btn) {
      btn.disabled = loading;
      btn.textContent = loading
        ? '处理中...'
        : (this._activeTab === 'login' ? '登录' : '注册');
    }
  }

  /**
   * Mount to container
   * @param {HTMLElement} container
   */
  mount(container) {
    container.appendChild(this.element);
  }

  /**
   * Unmount from DOM
   */
  unmount() {
    this.element?.remove();
  }

  /**
   * Get element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}

export default AuthPage;
