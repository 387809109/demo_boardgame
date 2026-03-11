/**
 * Server-side Supabase client (service role key)
 * @module services/supabase
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/** @type {import('@supabase/supabase-js').SupabaseClient|null} */
let supabase = null;

/**
 * Get the Supabase admin client singleton (uses service role key)
 * Bypasses RLS for server-side operations.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 * @throws {Error} If Supabase environment variables are not configured
 */
export function getSupabaseAdmin() {
  if (!supabase) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error(
        'Supabase not configured. Set SUPABASE_URL and '
        + 'SUPABASE_SERVICE_ROLE_KEY environment variables.'
      );
    }
    supabase = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return supabase;
}

/**
 * Check if Supabase is configured
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return !!(config.supabaseUrl && config.supabaseServiceRoleKey);
}

/**
 * Reset the client singleton (for testing)
 */
export function resetSupabaseClient() {
  supabase = null;
}
