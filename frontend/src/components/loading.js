/**
 * Loading Indicator Component
 * @module components/loading
 */

let loadingOverlay = null;
let loadingCount = 0;

/**
 * Show loading indicator
 * @param {string} [message='加载中...'] - Loading message
 */
export function showLoading(message = '加载中...') {
  loadingCount++;

  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-overlay);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      animation: fadeIn var(--transition-fast) forwards;
    `;

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.style.cssText = `
      width: 48px;
      height: 48px;
      border: 4px solid var(--neutral-200);
      border-top-color: var(--primary-500);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    const messageEl = document.createElement('div');
    messageEl.className = 'loading-message';
    messageEl.style.cssText = `
      margin-top: var(--spacing-4);
      color: white;
      font-size: var(--text-base);
    `;
    messageEl.textContent = message;

    loadingOverlay.appendChild(spinner);
    loadingOverlay.appendChild(messageEl);
    document.body.appendChild(loadingOverlay);
    document.body.style.overflow = 'hidden';
  } else {
    const messageEl = loadingOverlay.querySelector('.loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
    loadingOverlay.style.display = 'flex';
  }
}

/**
 * Hide loading indicator
 * @param {boolean} [force=false] - Force hide regardless of count
 */
export function hideLoading(force = false) {
  if (force) {
    loadingCount = 0;
  } else {
    loadingCount = Math.max(0, loadingCount - 1);
  }

  if (loadingCount === 0 && loadingOverlay) {
    loadingOverlay.style.animation = 'fadeOut var(--transition-fast) forwards';
    setTimeout(() => {
      if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
        document.body.style.overflow = '';
      }
    }, 150);
  }
}

/**
 * Update loading message
 * @param {string} message - New loading message
 */
export function updateLoadingMessage(message) {
  if (loadingOverlay) {
    const messageEl = loadingOverlay.querySelector('.loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }
}

/**
 * Check if loading is shown
 * @returns {boolean}
 */
export function isLoading() {
  return loadingCount > 0;
}

/**
 * Create an inline spinner element
 * @param {string} [size='16px'] - Spinner size
 * @returns {HTMLElement}
 */
export function createSpinner(size = '16px') {
  const spinner = document.createElement('span');
  spinner.className = 'inline-spinner';
  spinner.style.cssText = `
    display: inline-block;
    width: ${size};
    height: ${size};
    border: 2px solid var(--neutral-300);
    border-top-color: var(--primary-500);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
  `;
  return spinner;
}

/**
 * Wrap an async function with loading indicator
 * @param {Function} fn - Async function to wrap
 * @param {string} [message] - Loading message
 * @returns {Function}
 */
export function withLoading(fn, message) {
  return async (...args) => {
    showLoading(message);
    try {
      return await fn(...args);
    } finally {
      hideLoading();
    }
  };
}

export default {
  showLoading,
  hideLoading,
  updateLoadingMessage,
  isLoading,
  createSpinner,
  withLoading
};
