/**
 * Render Scheduler - Batch DOM updates with requestAnimationFrame
 * @module utils/render-scheduler
 */

/**
 * Pending render operations keyed by identifier
 * @type {Map<string, Function>}
 */
const pendingRenders = new Map();

/**
 * Whether a render frame is scheduled
 * @type {boolean}
 */
let frameScheduled = false;

/**
 * Process all pending renders
 * @private
 */
function processPendingRenders() {
  const renders = Array.from(pendingRenders.values());
  pendingRenders.clear();
  frameScheduled = false;

  renders.forEach(fn => {
    try {
      fn();
    } catch (err) {
      console.error('[RenderScheduler] Error in render callback:', err);
    }
  });
}

/**
 * Schedule a render operation to run in the next animation frame.
 * Multiple calls with the same key will deduplicate, keeping only the latest.
 *
 * @param {Function} fn - Render function to execute
 * @param {string} [key='default'] - Unique key for deduplication
 * @example
 * // Schedule a hand update (later calls with same key replace earlier ones)
 * scheduleRender(() => this._updateHand(), 'hand');
 * scheduleRender(() => this._updateTable(), 'table');
 */
export function scheduleRender(fn, key = 'default') {
  pendingRenders.set(key, fn);

  if (!frameScheduled) {
    frameScheduled = true;
    requestAnimationFrame(processPendingRenders);
  }
}

/**
 * Cancel a pending render by key
 * @param {string} key - Key of the render to cancel
 */
export function cancelRender(key) {
  pendingRenders.delete(key);
}

/**
 * Cancel all pending renders
 */
export function cancelAllRenders() {
  pendingRenders.clear();
}

/**
 * Active debounce timers
 * @type {Map<Function, number>}
 */
const debounceTimers = new WeakMap();

/**
 * Create a debounced version of a function.
 * The debounced function will delay invoking fn until after delay ms
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function with cancel() method
 * @example
 * const debouncedSearch = debounce((term) => {
 *   this._filterAndRender(term);
 * }, 150);
 *
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 *
 * // Cancel pending invocation
 * debouncedSearch.cancel();
 */
export function debounce(fn, delay) {
  let timerId = null;

  const debounced = function(...args) {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      fn.apply(this, args);
    }, delay);
  };

  /**
   * Cancel any pending invocation
   */
  debounced.cancel = function() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  /**
   * Check if there's a pending invocation
   * @returns {boolean}
   */
  debounced.isPending = function() {
    return timerId !== null;
  };

  return debounced;
}

/**
 * Create a throttled version of a function.
 * The throttled function will only invoke fn at most once per delay ms.
 *
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Minimum time between invocations in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  let timerId = null;

  const throttled = function(...args) {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (timerId === null) {
      timerId = setTimeout(() => {
        lastCall = Date.now();
        timerId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };

  throttled.cancel = function() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return throttled;
}

export default {
  scheduleRender,
  cancelRender,
  cancelAllRenders,
  debounce,
  throttle
};
