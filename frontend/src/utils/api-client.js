/**
 * API Client for REST API queries
 * @module utils/api-client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * API request error
 */
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Make an API request
 * @param {string} endpoint - API endpoint (e.g., '/api/v1/games')
 * @param {Object} [options] - Fetch options
 * @returns {Promise<Object>} Response data
 * @throws {ApiError}
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      const error = data.error || {};
      throw new ApiError(
        error.message || `Request failed with status ${response.status}`,
        response.status,
        error.code || 'UNKNOWN_ERROR'
      );
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network error or JSON parse error
    throw new ApiError(
      err.message || 'Network error',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * GET request
 * @param {string} endpoint
 * @param {Object} [params] - Query parameters
 * @returns {Promise<Object>}
 */
export async function get(endpoint, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  }
  const queryString = query.toString();
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;

  return request(url, { method: 'GET' });
}

/**
 * POST request
 * @param {string} endpoint
 * @param {Object} body
 * @returns {Promise<Object>}
 */
export async function post(endpoint, body) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Check if API is configured
 * @returns {boolean}
 */
export function isApiConfigured() {
  return !!API_BASE_URL;
}

/**
 * Get API base URL
 * @returns {string}
 */
export function getApiBaseUrl() {
  return API_BASE_URL;
}

// Game-specific API functions

/**
 * Fetch games list
 * @param {Object} [options]
 * @param {string} [options.category] - Filter by category
 * @param {string} [options.search] - Search term
 * @param {number} [options.limit] - Page size
 * @param {number} [options.offset] - Page offset
 * @returns {Promise<{ data: Object[], meta: Object }>}
 */
export async function fetchGames(options = {}) {
  return get('/api/v1/games', options);
}

/**
 * Fetch single game
 * @param {string} gameId
 * @returns {Promise<{ data: Object }>}
 */
export async function fetchGame(gameId) {
  return get(`/api/v1/games/${gameId}`);
}

/**
 * Fetch cards for a game
 * @param {string} gameId
 * @param {Object} [options]
 * @returns {Promise<{ data: Object[], meta: Object }>}
 */
export async function fetchCards(gameId, options = {}) {
  return get(`/api/v1/games/${gameId}/cards`, options);
}

export default {
  get,
  post,
  isApiConfigured,
  getApiBaseUrl,
  fetchGames,
  fetchGame,
  fetchCards,
  ApiError
};
