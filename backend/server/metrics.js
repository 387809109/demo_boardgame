/**
 * Metrics - simple in-memory counters
 */

export class Metrics {
  constructor() {
    this.startedAt = Date.now();
    this.counters = {
      connectionsTotal: 0,
      messagesReceived: 0,
      messagesSent: 0,
      broadcasts: 0,
      errors: 0
    };
    this.messageTypes = new Map();
  }

  /**
   * Increment a counter
   * @param {string} key
   * @param {number} [value]
   */
  inc(key, value = 1) {
    this.counters[key] = (this.counters[key] || 0) + value;
  }

  /**
   * Increment message type counter
   * @param {string} type
   */
  incMessageType(type) {
    if (!type) return;
    const current = this.messageTypes.get(type) || 0;
    this.messageTypes.set(type, current + 1);
  }

  /**
   * Snapshot metrics
   * @returns {object}
   */
  snapshot() {
    return {
      uptimeMs: Date.now() - this.startedAt,
      counters: { ...this.counters },
      messageTypes: Object.fromEntries(this.messageTypes)
    };
  }
}

export default Metrics;
