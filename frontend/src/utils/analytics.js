/**
 * Analytics wrapper (Vercel Web Analytics)
 * @module utils/analytics
 */

import { inject, track } from '@vercel/analytics';
import {
  isKnownAnalyticsEvent,
  sanitizeEventProperties
} from './analytics-events.js';

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

  if (!isKnownAnalyticsEvent(name)) {
    logAnalytics('trackEvent skipped (unknown event)', { name });
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

  const { sanitized, dropped } = sanitizeEventProperties(name, properties);
  if (dropped.length > 0) {
    logAnalytics('trackEvent properties sanitized', {
      name,
      dropped
    });
  }

  try {
    logAnalytics('tracking event', {
      name,
      properties: sanitized
    });
    track(name, sanitized);
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

export default {
  setAnalyticsConsent,
  isAnalyticsEnabled,
  initAnalytics,
  trackEvent
};
