/**
 * Here I Stand — Game Log Panel
 *
 * Scrollable panel showing the event log in human-readable form.
 * Each entry is formatted via formatLogEntry from event-display.js.
 * Card event entries are highlighted and clickable (opens event detail).
 */

import { formatLogEntry } from './event-display.js';
import { CARD_BY_NUMBER } from '../data/cards.js';

const POWER_COLORS = {
  ottoman: '#2e7d32', hapsburg: '#c6873e', england: '#c62828',
  france: '#1565c0', papacy: '#7b1fa2', protestant: '#2c3e50'
};

const POWER_LABELS = {
  ottoman: '奥斯曼', hapsburg: '哈布斯堡', england: '英格兰',
  france: '法兰西', papacy: '教廷', protestant: '新教'
};

// Entry types that get a colored power badge
const POWER_ENTRY_TYPES = new Set([
  'play_card_event', 'play_card', 'pass', 'move', 'units_raised',
  'units_lost', 'spring_deploy', 'card_draw', 'vp_change', 'retreat'
]);

// Entry types that are "major" events and get visual emphasis
const MAJOR_TYPES = new Set([
  'play_card_event', 'play_card', 'war_declared', 'peace_made',
  'field_battle', 'immediate_victory', 'debate_result',
  'ruler_replaced', 'action_phase_end', 'conclave'
]);

export class GameLog {
  constructor() {
    this._el = null;
    this._listEl = null;
    this._lastLength = 0;
    this._onCardClick = null;
  }

  /**
   * Set a callback for when card event entries are clicked.
   * @param {Function} cb - (cardNumber, power) => void
   */
  setOnCardClick(cb) {
    this._onCardClick = cb;
  }

  /**
   * Create the log panel element.
   * @returns {HTMLElement}
   */
  render() {
    this._el = document.createElement('div');
    this._el.className = 'his-game-log';
    this._el.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight: 700; font-size: 12px; padding: 8px 10px;
      color: #1e293b; border-bottom: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
      flex-shrink: 0;
    `;
    header.textContent = '游戏日志';

    // Filter toggle (compact view)
    const filterBtn = document.createElement('button');
    filterBtn.textContent = '仅大事';
    filterBtn.style.cssText = `
      font-size: 9px; padding: 2px 6px; border-radius: 3px;
      border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer;
      color: #64748b;
    `;
    this._filterMajor = false;
    filterBtn.addEventListener('click', () => {
      this._filterMajor = !this._filterMajor;
      filterBtn.style.background = this._filterMajor ? '#5c6bc0' : '#f8fafc';
      filterBtn.style.color = this._filterMajor ? '#fff' : '#64748b';
      this._rebuildList();
    });
    header.appendChild(filterBtn);
    this._el.appendChild(header);

    // Scrollable list
    this._listEl = document.createElement('div');
    this._listEl.style.cssText = `
      flex: 1; overflow-y: auto; padding: 4px 0;
      font-size: 11px;
    `;
    this._el.appendChild(this._listEl);

    return this._el;
  }

  /**
   * Update the log with new entries.
   * @param {Object[]} eventLog - array of { type, data, timestamp }
   */
  update(eventLog) {
    if (!this._listEl) return;
    this._entries = eventLog || [];

    // Incremental append for performance
    if (this._entries.length > this._lastLength) {
      const newEntries = this._entries.slice(this._lastLength);
      for (const entry of newEntries) {
        if (this._filterMajor && !MAJOR_TYPES.has(entry.type)) continue;
        const el = this._renderEntry(entry);
        this._listEl.appendChild(el);
      }
      this._lastLength = this._entries.length;

      // Auto-scroll to bottom
      this._listEl.scrollTop = this._listEl.scrollHeight;
    } else if (this._entries.length < this._lastLength) {
      // Log was reset (new game) — full rebuild
      this._lastLength = 0;
      this._rebuildList();
    }
  }

  _rebuildList() {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';
    this._lastLength = 0;
    if (this._entries) {
      this.update(this._entries);
    }
  }

  _renderEntry(entry) {
    const el = document.createElement('div');
    const isMajor = MAJOR_TYPES.has(entry.type);
    const isCardEvent = entry.type === 'play_card_event' ||
                        entry.type === 'play_card';
    const power = entry.data?.power || entry.data?.attacker ||
                  entry.data?.initiator || null;
    const color = power ? (POWER_COLORS[power] || '#64748b') : '#64748b';

    el.style.cssText = `
      padding: 3px 10px;
      border-left: 2px solid ${isMajor ? color : 'transparent'};
      ${isMajor ? 'background: #f8fafc;' : ''}
      ${isCardEvent ? 'cursor: pointer;' : ''}
      transition: background 0.15s;
      line-height: 1.4;
    `;

    // Power badge for relevant entries
    if (POWER_ENTRY_TYPES.has(entry.type) && power) {
      const badge = document.createElement('span');
      badge.style.cssText = `
        display: inline-block;
        font-size: 9px; font-weight: 700;
        color: ${color}; margin-right: 4px;
      `;
      badge.textContent = (POWER_LABELS[power] || power).slice(0, 3);
      el.appendChild(badge);
    }

    // Text
    const text = document.createElement('span');
    text.style.color = isMajor ? '#1e293b' : '#64748b';
    text.style.fontWeight = isMajor ? '600' : '400';
    text.textContent = formatLogEntry(entry);
    el.appendChild(text);

    // Hover effect
    if (isCardEvent) {
      el.addEventListener('mouseenter', () => {
        el.style.background = '#e8eaf6';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = isMajor ? '#f8fafc' : '';
      });
      el.addEventListener('click', () => {
        if (this._onCardClick && entry.data?.cardNumber) {
          this._onCardClick(entry.data.cardNumber, entry.data.power);
        }
      });
    }

    return el;
  }
}
