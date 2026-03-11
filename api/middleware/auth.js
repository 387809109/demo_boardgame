/**
 * Supabase JWT authentication middleware
 * @module middleware/auth
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Extract Bearer token from Authorization header
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7);
}

/**
 * Require authentication middleware
 * Verifies Supabase JWT and attaches user to req.user
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(new UnauthorizedError('Missing authorization token'));
  }

  try {
    const supabase = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return next(new UnauthorizedError('Invalid or expired token'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(new UnauthorizedError('Authentication failed'));
  }
}
