/**
 * Analytics wrapper (Vercel Web Analytics)
 * @module utils/analytics
 */

import { inject, track } from '@vercel/analytics';

const ANALYTICS_FLAG = String(import.meta.env.VITE_ANALYTICS_ENABLED || '').toLowerCase();
const ENV_ANALYTICS_ENABLED = ANALYTICS_FLAG === 'true'
  || ANALYTICS_FLAG === '1'
  || ANALYTICS_FLAG === 'yes';

let consentEnabled = false;
let initialized = false;

/**
 * Set user analytics consent state.
 * @param {boolean} enabled
 */
export function setAnalyticsConsent(enabled) {
  consentEnabled = enabled === true;
}

/**
 * Whether analytics should send data.
 * @returns {boolean}
 */
export function isAnalyticsEnabled() {
  return ENV_ANALYTICS_ENABLED && consentEnabled;
}

/**
 * Initialize analytics script once.
 * @returns {boolean} true when script is active
 */
export function initAnalytics() {
  if (initialized || typeof window === 'undefined' || !ENV_ANALYTICS_ENABLED) {
    return initialized;
  }

  inject({
    mode: import.meta.env.DEV ? 'development' : 'production',
    debug: !!import.meta.env.DEV,
    // Gate all events (including auto pageviews) by runtime consent.
    beforeSend: (event) => (consentEnabled ? event : null)
  });

  initialized = true;
  return true;
}

/**
 * Track a custom analytics event.
 * @param {string} name
 * @param {Record<string, string|number|boolean|null|undefined>} [properties]
 */
export function trackEvent(name, properties = {}) {
  if (!name || typeof name !== 'string') {
    return;
  }

  if (!isAnalyticsEnabled()) {
    return;
  }

  if (!initialized) {
    initAnalytics();
  }

  if (!initialized) {
    return;
  }

  try {
    track(name, sanitizeProperties(properties));
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('Analytics track failed:', err);
    }
  }
}

/**
 * Keep only top-level primitive properties supported by Vercel Analytics.
 * @param {Record<string, unknown>} input
 * @returns {Record<string, string|number|boolean|null|undefined>}
 */
function sanitizeProperties(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (isAllowedValue(value)) {
      output[key] = value;
    }
  }
  return output;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isAllowedValue(value) {
  return value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean';
}

export default {
  setAnalyticsConsent,
  isAnalyticsEnabled,
  initAnalytics,
  trackEvent
};
