/**
 * Request validation helpers
 * @module utils/validator
 */

import { ValidationError } from './errors.js';

/**
 * Validate pagination parameters from query string
 * @param {object} query - Express req.query
 * @param {number} defaultLimit - Default page size
 * @param {number} maxLimit - Maximum page size
 * @returns {{ limit: number, offset: number }}
 */
export function validatePagination(query, defaultLimit = 20, maxLimit = 100) {
  let limit = parseInt(query.limit, 10);
  let offset = parseInt(query.offset, 10);

  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }
  if (limit > maxLimit) {
    limit = maxLimit;
  }
  if (isNaN(offset) || offset < 0) {
    offset = 0;
  }

  return { limit, offset };
}

/**
 * Validate that required fields are present in body
 * @param {object} body - Request body
 * @param {string[]} fields - Required field names
 * @throws {ValidationError} If any field is missing
 */
export function validateRequired(body, fields) {
  const missing = fields.filter(
    f => body[f] === undefined || body[f] === null || body[f] === ''
  );
  if (missing.length > 0) {
    throw new ValidationError(
      'Missing required fields',
      missing.map(f => ({ field: f, message: `${f} is required` }))
    );
  }
}

/**
 * Validate a string field
 * @param {*} value - Value to check
 * @param {string} name - Field name for error message
 * @param {object} [opts] - Options
 * @param {number} [opts.minLength] - Minimum length
 * @param {number} [opts.maxLength] - Maximum length
 * @returns {string} Trimmed string
 * @throws {ValidationError}
 */
export function validateString(value, name, opts = {}) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string`);
  }
  const trimmed = value.trim();
  if (opts.minLength && trimmed.length < opts.minLength) {
    throw new ValidationError(
      `${name} must be at least ${opts.minLength} characters`
    );
  }
  if (opts.maxLength && trimmed.length > opts.maxLength) {
    throw new ValidationError(
      `${name} must be at most ${opts.maxLength} characters`
    );
  }
  return trimmed;
}

/**
 * Validate an integer field
 * @param {*} value - Value to check
 * @param {string} name - Field name for error message
 * @param {object} [opts] - Options
 * @param {number} [opts.min] - Minimum value
 * @param {number} [opts.max] - Maximum value
 * @returns {number}
 * @throws {ValidationError}
 */
export function validateInteger(value, name, opts = {}) {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new ValidationError(`${name} must be an integer`);
  }
  if (opts.min !== undefined && num < opts.min) {
    throw new ValidationError(`${name} must be at least ${opts.min}`);
  }
  if (opts.max !== undefined && num > opts.max) {
    throw new ValidationError(`${name} must be at most ${opts.max}`);
  }
  return num;
}
