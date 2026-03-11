/**
 * Supabase Client Initialization
 * @module cloud/supabase-client
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** @type {import('@supabase/supabase-js').SupabaseClient|null} */
let supabase = null;

/**
 * Get the Supabase client singleton
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 * @throws {Error} If Supabase environment variables are not configured
 */
export function getSupabaseClient() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase not configured. Set VITE_SUPABASE_URL and '
        + 'VITE_SUPABASE_ANON_KEY in frontend/.env'
      );
    }
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

/**
 * Check if Supabase cloud backend is available
 * @returns {boolean}
 */
export function isCloudAvailable() {
  return !!(supabaseUrl && supabaseAnonKey);
}
