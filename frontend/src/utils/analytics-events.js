/**
 * Analytics event schema and property sanitization helpers.
 * Centralizes event/field governance for production compliance.
 * @module utils/analytics-events
 */

/**
 * Event schema: event name -> allowed property keys.
 * Keep this list in sync with docs/prd/api/ANALYTICS_MVP_PLAN.md.
 */
export const ANALYTICS_EVENT_SCHEMA = Object.freeze({
  app_opened: Object.freeze(['mode']),
  lobby_viewed: Object.freeze(['mode']),
  mode_selected: Object.freeze(['mode']),
  game_selected: Object.freeze(['game_id', 'mode']),
  room_create_attempted: Object.freeze(['mode', 'game_id', 'player_count']),
  room_create_succeeded: Object.freeze(['mode', 'game_id', 'player_count']),
  room_join_attempted: Object.freeze(['mode']),
  room_join_succeeded: Object.freeze(['mode', 'game_id']),
  game_started: Object.freeze(['game_id', 'mode', 'player_count']),
  game_ended: Object.freeze([
    'game_id',
    'mode',
    'duration_sec',
    'ended_reason',
    'result_type'
  ]),
  network_disconnected: Object.freeze(['mode', 'reason', 'error_code']),
  reconnect_attempted: Object.freeze(['mode', 'attempt']),
  reconnect_succeeded: Object.freeze(['mode']),
  reconnect_failed: Object.freeze(['mode', 'error_code']),
  chat_panel_opened: Object.freeze(['game_id']),
  chat_message_sent: Object.freeze(['game_id']),
  query_panel_opened: Object.freeze([]),
  query_card_opened_chat: Object.freeze(['game_id', 'source'])
});

const FORBIDDEN_PROPERTY_PATTERNS = [
  /(^|_)message($|_)/i,
  /content/i,
  /nickname/i,
  /email/i,
  /room(id)?/i,
  /^player_id$/i,
  /^playerid$/i,
  /(^|_)state($|_)/i,
  /(^|_)cards?($|_)/i,
  /(^|_)hands?($|_)/i,
  /(^|_)roles?($|_)/i
];

const ALLOWED_VALUE_TYPES = new Set(['string', 'number', 'boolean']);

const EVENT_ALLOWED_KEYS = Object.freeze(
  Object.fromEntries(
    Object.entries(ANALYTICS_EVENT_SCHEMA).map(([eventName, keys]) => [
      eventName,
      new Set(keys)
    ])
  )
);

/**
 * Whether the analytics event is known and allowed.
 * @param {string} name
 * @returns {boolean}
 */
export function isKnownAnalyticsEvent(name) {
  return typeof name === 'string' && !!EVENT_ALLOWED_KEYS[name];
}

/**
 * Get allowed property keys for an event.
 * @param {string} eventName
 * @returns {string[]}
 */
export function getAllowedPropertyKeys(eventName) {
  if (!isKnownAnalyticsEvent(eventName)) {
    return [];
  }
  return [...EVENT_ALLOWED_KEYS[eventName]];
}

/**
 * Sanitize analytics event properties according to schema + privacy constraints.
 * @param {string} eventName
 * @param {Record<string, unknown>} input
 * @returns {{
 *   sanitized: Record<string, string|number|boolean|null|undefined>,
 *   dropped: Array<{key: string, reason: string}>
 * }}
 */
export function sanitizeEventProperties(eventName, input) {
  if (!input || typeof input !== 'object') {
    return { sanitized: {}, dropped: [] };
  }

  if (!isKnownAnalyticsEvent(eventName)) {
    return {
      sanitized: {},
      dropped: Object.keys(input).map((key) => ({
        key,
        reason: 'unknown_event'
      }))
    };
  }

  const allowedKeys = EVENT_ALLOWED_KEYS[eventName];
  const sanitized = {};
  const dropped = [];

  for (const [key, value] of Object.entries(input)) {
    if (!allowedKeys.has(key)) {
      dropped.push({ key, reason: 'key_not_whitelisted' });
      continue;
    }
    if (isForbiddenPropertyKey(key)) {
      dropped.push({ key, reason: 'forbidden_key' });
      continue;
    }
    if (!isAllowedValue(value)) {
      dropped.push({ key, reason: 'invalid_value_type' });
      continue;
    }
    sanitized[key] = value;
  }

  return { sanitized, dropped };
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isForbiddenPropertyKey(key) {
  return FORBIDDEN_PROPERTY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isAllowedValue(value) {
  return value === null
    || value === undefined
    || ALLOWED_VALUE_TYPES.has(typeof value);
}

