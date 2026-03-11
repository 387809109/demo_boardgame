/**
 * Game metadata query service
 * @module services/game-service
 */

import { getSupabaseAdmin } from './supabase.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * List games with optional filtering
 * @param {object} [options]
 * @param {string} [options.category] - Filter by category
 * @param {string} [options.search] - Full-text search
 * @param {number} [options.limit] - Page size
 * @param {number} [options.offset] - Page offset
 * @returns {Promise<{ data: object[], total: number }>}
 */
export async function listGames(options = {}) {
  const { category, search, limit = 20, offset = 0 } = options;
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('games')
    .select('*', { count: 'exact' });

  if (category) {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  query = query
    .order('name')
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return { data: data || [], total: count || 0 };
}

/**
 * List games that support single-player mode.
 * A game supports single-player if:
 * - metadata.gameType is "singleplayer", or
 * - metadata.supportsAI is true (multiplayer game with AI opponents)
 * @param {object} [options]
 * @param {number} [options.limit] - Page size
 * @param {number} [options.offset] - Page offset
 * @returns {Promise<{ data: object[], total: number }>}
 */
export async function listSinglePlayerGames(options = {}) {
  const { limit = 20, offset = 0 } = options;
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('games')
    .select('*', { count: 'exact' })
    .or('metadata->>gameType.eq.singleplayer,metadata->>supportsAI.eq.true');

  query = query
    .order('name')
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return { data: data || [], total: count || 0 };
}

/**
 * Get a single game by ID
 * @param {string} gameId
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
export async function getGame(gameId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error || !data) {
    throw new NotFoundError(`Game '${gameId}' not found`);
  }

  return data;
}

/**
 * Create a new game
 * @param {object} gameData
 * @returns {Promise<object>}
 */
export async function createGame(gameData) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('games')
    .insert(gameData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Update a game
 * @param {string} gameId
 * @param {object} updates
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
export async function updateGame(gameId, updates) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single();

  if (error || !data) {
    throw new NotFoundError(`Game '${gameId}' not found`);
  }

  return data;
}
