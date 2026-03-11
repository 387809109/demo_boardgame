/**
 * Analytics wrapper (Vercel Web Analytics)
 * @module utils/analytics
 */

import { inject, track } from '@vercel/analytics';

const ANALYTICS_FLAG = String(import.meta.env.VITE_ANALYTICS_ENABLED || '').toLowerCase();
const ENV_ANALYTICS_ENABLED = ANALYTICS_FLAG === 'true'
  || ANALYTICS_FLAG === '1'
  || ANALYTICS_FLAG === 'yes';
const ANALYTICS_DEBUG = (() => {
  const flag = String(import.meta.env.VITE_ANALYTICS_DEBUG || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
})();

let consentEnabled = false;
let initialized = false;

/**
 * Print analytics logs in dev or explicit debug mode.
 * @param {string} message
 * @param {Record<string, unknown>} [payload]
 */
function logAnalytics(message, payload = {}) {
  if (!(import.meta.env.DEV || ANALYTICS_DEBUG)) {
    return;
  }
  console.debug(`[analytics] ${message}`, payload);
}

/**
 * Set user analytics consent state.
 * @param {boolean} enabled
 */
export function setAnalyticsConsent(enabled) {
  consentEnabled = enabled === true;
  logAnalytics('consent updated', {
    consentEnabled
  });
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
  logAnalytics('init requested', {
    initialized,
    envAnalyticsEnabled: ENV_ANALYTICS_ENABLED
  });

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
  logAnalytics('initialized', {
    consentEnabled,
    mode: import.meta.env.DEV ? 'development' : 'production'
  });
  return true;
}

/**
 * Track a custom analytics event.
 * @param {string} name
 * @param {Record<string, string|number|boolean|null|undefined>} [properties]
 */
export function trackEvent(name, properties = {}) {
  logAnalytics('trackEvent called', {
    name,
    hasProperties: !!properties && Object.keys(properties || {}).length > 0,
    consentEnabled,
    initialized
  });

  if (!name || typeof name !== 'string') {
    return;
  }

  if (!isAnalyticsEnabled()) {
    logAnalytics('trackEvent skipped (disabled)', {
      name,
      reason: 'analytics_disabled_or_no_consent'
    });
    return;
  }

  if (!initialized) {
    initAnalytics();
  }

  if (!initialized) {
    logAnalytics('trackEvent skipped (not initialized)', { name });
    return;
  }

  try {
    logAnalytics('tracking event', {
      name,
      properties: sanitizeProperties(properties)
    });
    track(name, sanitizeProperties(properties));
  } catch (err) {
    if (import.meta.env.DEV) {
      logAnalytics('tracking failed', {
        name,
        error: err?.message || err
      });
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
