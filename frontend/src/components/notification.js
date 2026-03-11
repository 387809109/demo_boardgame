/**
 * Notification/Toast Component
 * @module components/notification
 */

/**
 * Notification types and their styles
 */
const NOTIFICATION_STYLES = {
  info: {
    bg: 'var(--primary-500)',
    icon: 'i'
  },
  success: {
    bg: 'var(--success-500)',
    icon: '✓'
  },
  warning: {
    bg: 'var(--warning-500)',
    icon: '⚠'
  },
  error: {
    bg: 'var(--error-500)',
    icon: '✕'
  }
};

let notificationContainer = null;
let toastContainer = null;

/**
 * Initialize notification containers
 */
function ensureContainers() {
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.cssText = `
      position: fixed;
      top: var(--spacing-4);
      right: var(--spacing-4);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
      pointer-events: none;
    `;
    document.body.appendChild(notificationContainer);
  }

  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
      align-items: center;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
}

/**
 * Show a notification
 * @param {string} message - Notification message
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Notification type
 * @param {number} [duration=5000] - Duration in ms (0 for persistent)
 * @returns {HTMLElement} Notification element
 */
export function showNotification(message, type = 'info', duration = 5000) {
  ensureContainers();

  const style = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.info;

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.style.cssText = `
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--bg-primary);
    border-radius: var(--radius-base);
    box-shadow: var(--shadow-lg);
    border-left: 4px solid ${style.bg};
    pointer-events: auto;
    animation: slideDown var(--transition-base) forwards;
    max-width: 400px;
  `;

  const icon = document.createElement('span');
  icon.textContent = style.icon;
  icon.style.cssText = `
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${style.bg};
    color: white;
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    flex-shrink: 0;
  `;

  const content = document.createElement('span');
  content.textContent = message;
  content.style.cssText = `
    flex: 1;
    font-size: var(--text-sm);
    color: var(--text-primary);
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: var(--text-lg);
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  `;
  closeBtn.addEventListener('click', () => removeNotification(notification));

  notification.appendChild(icon);
  notification.appendChild(content);
  notification.appendChild(closeBtn);
  notificationContainer.appendChild(notification);

  if (duration > 0) {
    setTimeout(() => removeNotification(notification), duration);
  }

  return notification;
}

/**
 * Remove a notification
 * @param {HTMLElement} notification - Notification element to remove
 */
function removeNotification(notification) {
  notification.style.animation = 'fadeOut var(--transition-fast) forwards';
  setTimeout(() => {
    notification.remove();
  }, 150);
}

/**
 * Show a toast message
 * @param {string} message - Toast message
 * @param {number} [duration=3000] - Duration in ms
 * @returns {HTMLElement} Toast element
 */
export function showToast(message, duration = 3000) {
  ensureContainers();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    padding: var(--spacing-3) var(--spacing-5);
    background: var(--neutral-800);
    color: white;
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
    animation: fadeIn var(--transition-fast) forwards;
  `;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut var(--transition-fast) forwards';
    setTimeout(() => toast.remove(), 150);
  }, duration);

  return toast;
}

/**
 * Clear all notifications
 */
export function clearNotifications() {
  if (notificationContainer) {
    notificationContainer.innerHTML = '';
  }
}

/**
 * Clear all toasts
 */
export function clearToasts() {
  if (toastContainer) {
    toastContainer.innerHTML = '';
  }
}

export default {
  showNotification,
  showToast,
  clearNotifications,
  clearToasts
};
