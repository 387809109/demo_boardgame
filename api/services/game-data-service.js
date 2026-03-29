/**
 * Generic game data query service
 * Queries game-specific static data tables (leaders, debaters, explorers)
 * @module services/game-data-service
 */

import { getSupabaseAdmin } from './supabase.js';

/**
 * Allowed game-specific tables and their Supabase table names.
 * Keys are the public endpoint names; values are the actual table names.
 */
const TABLE_MAP = {
  leaders:   'his_leaders',
  debaters:  'his_debaters',
  explorers: 'his_explorers',
};

/**
 * List rows from a game-specific data table
 * @param {string} gameId
 * @param {string} tableKey - One of: leaders, debaters, explorers
 * @param {object} [options]
 * @param {string} [options.search] - Search in name/display_name
 * @param {number} [options.limit]
 * @param {number} [options.offset]
 * @returns {Promise<{ data: object[], total: number }>}
 * @throws {Error} If table key is not allowed
 */
export async function listTableData(gameId, tableKey, options = {}) {
  const tableName = TABLE_MAP[tableKey];
  if (!tableName) {
    const err = new Error(`Unknown table: ${tableKey}`);
    err.status = 400;
    err.code = 'INVALID_TABLE';
    throw err;
  }

  const { search, limit = 20, offset = 0 } = options;
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .eq('game_id', gameId);

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,display_name.ilike.%${search}%`
    );
  }

  query = query
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name')
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return { data: data || [], total: count || 0 };
}
