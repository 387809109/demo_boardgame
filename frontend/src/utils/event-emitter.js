/**
 * Simple Event Emitter for pub/sub pattern
 * @module utils/event-emitter
 */

export class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._events = new Map();
    /** @type {Map<string, Set<Function>>} */
    this._onceEvents = new Map();
  }

  /**
   * Register an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);

    return () => this.off(event, handler);
  }

  /**
   * Register a one-time event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  once(event, handler) {
    if (!this._onceEvents.has(event)) {
      this._onceEvents.set(event, new Set());
    }
    this._onceEvents.get(event).add(handler);

    return () => {
      const handlers = this._onceEvents.get(event);
      if (handlers) handlers.delete(handler);
    };
  }

  /**
   * Remove an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    const handlers = this._events.get(event);
    if (handlers) handlers.delete(handler);

    const onceHandlers = this._onceEvents.get(event);
    if (onceHandlers) onceHandlers.delete(handler);
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to handlers
   */
  emit(event, ...args) {
    // Regular handlers
    const handlers = this._events.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error in event handler for "${event}":`, err);
        }
      });
    }

    // Once handlers
    const onceHandlers = this._onceEvents.get(event);
    if (onceHandlers) {
      onceHandlers.forEach(handler => {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error in once handler for "${event}":`, err);
        }
      });
      this._onceEvents.delete(event);
    }
  }

  /**
   * Clear all handlers for an event or all events
   * @param {string} [event] - Specific event to clear, or all if omitted
   */
  clear(event) {
    if (event) {
      this._events.delete(event);
      this._onceEvents.delete(event);
    } else {
      this._events.clear();
      this._onceEvents.clear();
    }
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number}
   */
  listenerCount(event) {
    const regular = this._events.get(event)?.size || 0;
    const once = this._onceEvents.get(event)?.size || 0;
    return regular + once;
  }
}

export default EventEmitter;
