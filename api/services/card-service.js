/**
 * Card data query service
 * @module services/card-service
 */

import { getSupabaseAdmin } from './supabase.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * List card categories for a game
 * @param {string} gameId
 * @returns {Promise<object[]>}
 */
export async function listCategories(gameId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('card_categories')
    .select('*')
    .eq('game_id', gameId)
    .order('sort_order');

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Create a card category
 * @param {string} gameId
 * @param {object} categoryData
 * @returns {Promise<object>}
 */
export async function createCategory(gameId, categoryData) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('card_categories')
    .insert({ ...categoryData, game_id: gameId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * List cards for a game with optional filtering
 * @param {string} gameId
 * @param {object} [options]
 * @param {string} [options.category] - Filter by category name
 * @param {string} [options.search] - Search in name/description
 * @param {number} [options.limit] - Page size
 * @param {number} [options.offset] - Page offset
 * @returns {Promise<{ data: object[], total: number }>}
 */
export async function listCards(gameId, options = {}) {
  const { category, search, limit = 20, offset = 0 } = options;
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('cards')
    .select(
      '*, card_categories!cards_category_id_fkey(name, display_name)',
      { count: 'exact' }
    )
    .eq('game_id', gameId);

  if (category) {
    // Join filter: category name matches
    query = query.eq('card_categories.name', category);
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,display_name.ilike.%${search}%,`
      + `description.ilike.%${search}%`
    );
  }

  query = query
    .order('name')
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  // Filter out cards where category join didn't match (when filtering)
  let filtered = data || [];
  if (category) {
    filtered = filtered.filter(c => c.card_categories !== null);
  }

  return { data: filtered, total: count || 0 };
}

/**
 * Get a single card by ID
 * @param {string} gameId
 * @param {string} cardId
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
export async function getCard(gameId, cardId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('cards')
    .select('*, card_categories!cards_category_id_fkey(name, display_name)')
    .eq('id', cardId)
    .eq('game_id', gameId)
    .single();

  if (error || !data) {
    throw new NotFoundError(`Card '${cardId}' not found`);
  }

  return data;
}

/**
 * Create a card
 * @param {string} gameId
 * @param {object} cardData
 * @returns {Promise<object>}
 */
export async function createCard(gameId, cardData) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('cards')
    .insert({ ...cardData, game_id: gameId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Update a card
 * @param {string} gameId
 * @param {string} cardId
 * @param {object} updates
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
export async function updateCard(gameId, cardId, updates) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', cardId)
    .eq('game_id', gameId)
    .select()
    .single();

  if (error || !data) {
    throw new NotFoundError(`Card '${cardId}' not found`);
  }

  return data;
}
