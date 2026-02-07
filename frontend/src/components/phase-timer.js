/**
 * Phase Timer Component
 * Visual countdown timer for game phases (reminder only, no game effect)
 * @module components/phase-timer
 */

import { showToast } from './notification.js';

/**
 * Timer states
 */
const TIMER_STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  EXPIRED: 'expired'
};

/**
 * PhaseTimer Component
 * Displays a countdown timer with visual feedback
 */
export class PhaseTimer {
  /**
   * @param {Object} options
   * @param {Function} [options.onExpire] - Callback when timer expires
   * @param {Function} [options.onTick] - Callback on each second tick
   * @param {boolean} [options.showLabel=true] - Whether to show phase label
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.state = TIMER_STATE.IDLE;
    this.totalSeconds = 0;
    this.remainingSeconds = 0;
    this.label = '';
    this.intervalId = null;
    this.hasNotified = false;

    this._create();
  }

  /**
   * Create the timer element
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'phase-timer';
    this._render();
  }

  /**
   * Render the timer display
   * @private
   */
  _render() {
    const isVisible = this.state !== TIMER_STATE.IDLE;

    this.element.style.cssText = `
      display: ${isVisible ? 'flex' : 'none'};
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-2) var(--spacing-4);
      background: var(--bg-secondary);
      border-radius: var(--radius-base);
      min-width: 100px;
    `;

    if (!isVisible) {
      this.element.innerHTML = '';
      return;
    }

    const timeColor = this._getTimeColor();
    const isExpired = this.state === TIMER_STATE.EXPIRED;
    const isPaused = this.state === TIMER_STATE.PAUSED;

    this.element.innerHTML = `
      ${this.label && this.options.showLabel !== false ? `
        <span class="phase-timer__label" style="
          font-size: var(--text-xs);
          color: var(--text-secondary);
          font-weight: var(--font-medium);
        ">${this.label}</span>
      ` : ''}
      <span class="phase-timer__time" style="
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        font-family: 'Consolas', 'Monaco', monospace;
        color: ${timeColor};
        ${isExpired ? 'animation: timer-pulse 0.5s ease-in-out infinite;' : ''}
        ${isPaused ? 'opacity: 0.6;' : ''}
      ">${this._formatTime(this.remainingSeconds)}</span>
      ${isPaused ? `
        <span class="phase-timer__paused" style="
          font-size: var(--text-xs);
          color: var(--text-tertiary);
        ">暂停中</span>
      ` : ''}
    `;

    // Add pulse animation style if not already present
    if (!document.getElementById('phase-timer-styles')) {
      const style = document.createElement('style');
      style.id = 'phase-timer-styles';
      style.textContent = `
        @keyframes timer-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Get color based on remaining time
   * @private
   * @returns {string} CSS color value
   */
  _getTimeColor() {
    if (this.state === TIMER_STATE.EXPIRED) {
      return 'var(--error-500)';
    }

    const ratio = this.remainingSeconds / this.totalSeconds;

    if (ratio > 0.5) {
      return 'var(--success-500)'; // Green: > 50%
    } else if (ratio > 0.2) {
      return 'var(--warning-500)'; // Yellow: 20-50%
    } else {
      return 'var(--error-500)'; // Red: < 20%
    }
  }

  /**
   * Format seconds to mm:ss
   * @private
   * @param {number} seconds
   * @returns {string}
   */
  _formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Timer tick handler
   * @private
   */
  _tick() {
    if (this.state !== TIMER_STATE.RUNNING) return;

    this.remainingSeconds--;
    this.options.onTick?.(this.remainingSeconds);
    this._render();

    if (this.remainingSeconds <= 0) {
      this._expire();
    }
  }

  /**
   * Handle timer expiry
   * @private
   */
  _expire() {
    this._clearInterval();
    this.state = TIMER_STATE.EXPIRED;
    this.remainingSeconds = 0;
    this._render();

    // Show notification only once
    if (!this.hasNotified) {
      this.hasNotified = true;
      const message = this.label ? `${this.label} - 时间已到` : '时间已到';
      showToast(message, 3000);
      this.options.onExpire?.();
    }
  }

  /**
   * Clear the interval
   * @private
   */
  _clearInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Start the timer
   * @param {number} seconds - Duration in seconds
   * @param {string} [label] - Phase label to display
   */
  start(seconds, label = '') {
    if (seconds <= 0) return;

    this._clearInterval();
    this.totalSeconds = seconds;
    this.remainingSeconds = seconds;
    this.label = label;
    this.state = TIMER_STATE.RUNNING;
    this.hasNotified = false;

    this._render();
    this.intervalId = setInterval(() => this._tick(), 1000);
  }

  /**
   * Pause the timer
   */
  pause() {
    if (this.state !== TIMER_STATE.RUNNING) return;

    this._clearInterval();
    this.state = TIMER_STATE.PAUSED;
    this._render();
  }

  /**
   * Resume the timer
   */
  resume() {
    if (this.state !== TIMER_STATE.PAUSED) return;

    this.state = TIMER_STATE.RUNNING;
    this._render();
    this.intervalId = setInterval(() => this._tick(), 1000);
  }

  /**
   * Stop and hide the timer
   */
  stop() {
    this._clearInterval();
    this.state = TIMER_STATE.IDLE;
    this.remainingSeconds = 0;
    this.label = '';
    this.hasNotified = false;
    this._render();
  }

  /**
   * Check if timer is running
   * @returns {boolean}
   */
  isRunning() {
    return this.state === TIMER_STATE.RUNNING;
  }

  /**
   * Check if timer is expired
   * @returns {boolean}
   */
  isExpired() {
    return this.state === TIMER_STATE.EXPIRED;
  }

  /**
   * Get remaining seconds
   * @returns {number}
   */
  getRemainingSeconds() {
    return this.remainingSeconds;
  }

  /**
   * Get the element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Destroy the component
   */
  destroy() {
    this._clearInterval();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

export default PhaseTimer;
