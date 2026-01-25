/**
 * Modal Component
 * @module components/modal
 */

/**
 * Modal component for dialogs
 */
export class Modal {
  constructor() {
    this._container = null;
    this._backdrop = null;
    this._content = null;
    this._isOpen = false;
    this._onClose = null;

    this._init();
  }

  /**
   * Initialize modal DOM structure
   * @private
   */
  _init() {
    // Create backdrop
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'modal-backdrop';
    this._backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-overlay);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      animation: fadeIn var(--transition-fast) forwards;
    `;

    // Create container
    this._container = document.createElement('div');
    this._container.className = 'modal-container';
    this._container.style.cssText = `
      background: var(--bg-primary);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
      animation: slideUp var(--transition-base) forwards;
    `;

    // Create content wrapper
    this._content = document.createElement('div');
    this._content.className = 'modal-content';
    this._container.appendChild(this._content);

    this._backdrop.appendChild(this._container);
    document.body.appendChild(this._backdrop);

    // Close on backdrop click
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) {
        this.hide();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        this.hide();
      }
    });
  }

  /**
   * Show modal with content
   * @param {string|HTMLElement} content - Content to display
   * @param {Object} [options={}] - Options
   * @param {string} [options.title] - Modal title
   * @param {boolean} [options.showClose=true] - Show close button
   * @param {string} [options.width='400px'] - Modal width
   * @param {Function} [options.onClose] - Close callback
   */
  show(content, options = {}) {
    const { title, showClose = true, width = '400px', onClose } = options;

    this._onClose = onClose;
    this._container.style.width = width;
    this._content.innerHTML = '';

    // Add header if title provided
    if (title) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-4) var(--spacing-6);
        border-bottom: 1px solid var(--border-light);
      `;

      const titleEl = document.createElement('h3');
      titleEl.textContent = title;
      titleEl.style.cssText = `
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
      `;
      header.appendChild(titleEl);

      if (showClose) {
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
          background: none;
          border: none;
          font-size: var(--text-2xl);
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0;
          line-height: 1;
        `;
        closeBtn.addEventListener('click', () => this.hide());
        header.appendChild(closeBtn);
      }

      this._content.appendChild(header);
    }

    // Add body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = 'padding: var(--spacing-6);';

    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }

    this._content.appendChild(body);

    this._backdrop.style.display = 'flex';
    this._isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide modal
   */
  hide() {
    this._backdrop.style.display = 'none';
    this._isOpen = false;
    document.body.style.overflow = '';

    if (this._onClose) {
      this._onClose();
      this._onClose = null;
    }
  }

  /**
   * Show confirmation dialog
   * @param {string} title - Dialog title
   * @param {string} message - Confirmation message
   * @param {Object} [options={}] - Options
   * @returns {Promise<boolean>} User's choice
   */
  confirm(title, message, options = {}) {
    return new Promise((resolve) => {
      const {
        confirmText = '确定',
        cancelText = '取消',
        confirmClass = 'btn-primary',
        cancelClass = 'btn-secondary'
      } = options;

      const content = document.createElement('div');

      const msgEl = document.createElement('p');
      msgEl.textContent = message;
      msgEl.style.cssText = 'margin: 0 0 var(--spacing-6) 0;';
      content.appendChild(msgEl);

      const buttons = document.createElement('div');
      buttons.style.cssText = 'display: flex; gap: var(--spacing-3); justify-content: flex-end;';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = `btn ${cancelClass}`;
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener('click', () => {
        this.hide();
        resolve(false);
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.className = `btn ${confirmClass}`;
      confirmBtn.textContent = confirmText;
      confirmBtn.addEventListener('click', () => {
        this.hide();
        resolve(true);
      });

      buttons.appendChild(cancelBtn);
      buttons.appendChild(confirmBtn);
      content.appendChild(buttons);

      this.show(content, { title, showClose: false, width: '360px' });
    });
  }

  /**
   * Show alert dialog
   * @param {string} title - Dialog title
   * @param {string} message - Alert message
   * @returns {Promise<void>}
   */
  alert(title, message) {
    return new Promise((resolve) => {
      const content = document.createElement('div');

      const msgEl = document.createElement('p');
      msgEl.textContent = message;
      msgEl.style.cssText = 'margin: 0 0 var(--spacing-6) 0;';
      content.appendChild(msgEl);

      const buttons = document.createElement('div');
      buttons.style.cssText = 'display: flex; justify-content: flex-end;';

      const okBtn = document.createElement('button');
      okBtn.className = 'btn btn-primary';
      okBtn.textContent = '确定';
      okBtn.addEventListener('click', () => {
        this.hide();
        resolve();
      });

      buttons.appendChild(okBtn);
      content.appendChild(buttons);

      this.show(content, { title, showClose: false, width: '320px' });
    });
  }

  /**
   * Check if modal is open
   * @returns {boolean}
   */
  isOpen() {
    return this._isOpen;
  }
}

// Singleton instance
let modalInstance = null;

/**
 * Get or create modal instance
 * @returns {Modal}
 */
export function getModal() {
  if (!modalInstance) {
    modalInstance = new Modal();
  }
  return modalInstance;
}

export default Modal;
