/**
 * AuthService unit tests
 * @module cloud/auth.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.js';

/**
 * Create a mock Supabase client with all methods AuthService depends on
 */
function createMockSupabase() {
  const mockSingle = vi.fn().mockResolvedValue({
    data: { nickname: 'TestUser', avatar_url: null },
    error: null
  });
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockUpdate = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { nickname: 'Updated', avatar_url: null, updated_at: '2026-01-01' },
          error: null
        })
      }))
    }))
  }));

  const mockUnsubscribe = vi.fn();

  const supabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: 'u-1', email: 'a@b.com', user_metadata: { nickname: 'NewUser' } } },
        error: null
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: { id: 'u-1', email: 'a@b.com', user_metadata: { nickname: 'TestUser' } } },
        error: null
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn((cb) => {
        supabase._authCallback = cb;
        return {
          data: { subscription: { unsubscribe: mockUnsubscribe } }
        };
      })
    },
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate
    })),
    _authCallback: null,
    _mockUnsubscribe: mockUnsubscribe,
    _mockProfileSingle: mockSingle
  };

  return supabase;
}

describe('AuthService', () => {
  let supabase;
  let auth;

  beforeEach(() => {
    supabase = createMockSupabase();
    auth = new AuthService(supabase);
  });

  describe('constructor', () => {
    it('initializes with null user and not initialized', () => {
      expect(auth.isLoggedIn()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
    });
  });

  describe('initialize', () => {
    it('loads profile from existing session', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'u-1', email: 'a@b.com', user_metadata: {} } } }
      });

      await auth.initialize();

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(auth.isLoggedIn()).toBe(true);
      expect(auth.getCurrentUser()).toEqual({
        id: 'u-1',
        email: 'a@b.com',
        nickname: 'TestUser'
      });
    });

    it('does nothing when no existing session', async () => {
      await auth.initialize();

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(supabase.from).not.toHaveBeenCalled();
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('is idempotent — second call is a no-op', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'u-1', email: 'a@b.com', user_metadata: {} } } }
      });

      await auth.initialize();
      await auth.initialize();

      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('register', () => {
    it('registers user and loads profile', async () => {
      const result = await auth.register('a@b.com', 'pass123', 'NewUser');

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'pass123',
        options: { data: { nickname: 'NewUser' } }
      });
      expect(result.error).toBeNull();
      expect(result.user).toEqual({
        id: 'u-1',
        email: 'a@b.com',
        nickname: 'TestUser'
      });
      expect(auth.isLoggedIn()).toBe(true);
    });

    it('returns error on Supabase failure', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Email already registered' }
      });

      const result = await auth.register('a@b.com', 'pass123', 'NewUser');

      expect(result.user).toBeNull();
      expect(result.error).toBe('Email already registered');
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('handles response with no user (e.g. email confirmation pending)', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await auth.register('a@b.com', 'pass123', 'NewUser');

      expect(result.user).toBeNull();
      expect(result.error).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('logs in and loads profile', async () => {
      const result = await auth.login('a@b.com', 'pass123');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'pass123'
      });
      expect(result.error).toBeNull();
      expect(result.user).toEqual({
        id: 'u-1',
        email: 'a@b.com',
        nickname: 'TestUser'
      });
      expect(auth.isLoggedIn()).toBe(true);
    });

    it('returns error on invalid credentials', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' }
      });

      const result = await auth.login('a@b.com', 'wrong');

      expect(result.user).toBeNull();
      expect(result.error).toBe('Invalid login credentials');
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('handles response with no user', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await auth.login('a@b.com', 'pass123');

      expect(result.user).toBeNull();
      expect(result.error).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears current user on success', async () => {
      await auth.login('a@b.com', 'pass123');
      expect(auth.isLoggedIn()).toBe(true);

      const result = await auth.logout();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
      expect(auth.isLoggedIn()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
    });

    it('clears current user even on error', async () => {
      await auth.login('a@b.com', 'pass123');
      supabase.auth.signOut.mockResolvedValue({
        error: { message: 'Network error' }
      });

      const result = await auth.logout();

      expect(result.error).toBe('Network error');
      expect(auth.isLoggedIn()).toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('returns error when not logged in', async () => {
      const result = await auth.updateProfile({ nickname: 'New' });

      expect(result.profile).toBeNull();
      expect(result.error).toBe('Not logged in');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('updates nickname and refreshes local state', async () => {
      await auth.login('a@b.com', 'pass123');

      const result = await auth.updateProfile({ nickname: 'Updated' });

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(result.error).toBeNull();
      expect(result.profile).toBeDefined();
      expect(auth.getCurrentUser().nickname).toBe('Updated');
    });

    it('handles partial update with only avatarUrl', async () => {
      await auth.login('a@b.com', 'pass123');

      await auth.updateProfile({ avatarUrl: 'https://example.com/pic.png' });

      // Verify from('profiles') was called for the update
      // The second call to from() is for updateProfile (first was _loadUserProfile)
      const updateCall = supabase.from.mock.calls.find(
        (_, i) => i >= 1
      );
      expect(updateCall).toBeDefined();
    });

    it('returns error on Supabase failure', async () => {
      auth._currentUser = { id: 'u-1', email: 'a@b.com', nickname: 'TestUser' };

      supabase.from = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' }
              })
            }))
          }))
        }))
      }));

      const result = await auth.updateProfile({ nickname: 'New' });

      expect(result.profile).toBeNull();
      expect(result.error).toBe('Update failed');
    });
  });

  describe('onAuthStateChange', () => {
    it('registers callback and returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = auth.onAuthStateChange(callback);

      expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('forwards events to callback', () => {
      const callback = vi.fn();
      auth.onAuthStateChange(callback);

      const session = { user: { id: 'u-1' } };
      supabase._authCallback('SIGNED_IN', session);

      expect(callback).toHaveBeenCalledWith('SIGNED_IN', session);
    });

    it('clears current user on SIGNED_OUT event', async () => {
      await auth.login('a@b.com', 'pass123');
      expect(auth.isLoggedIn()).toBe(true);

      const callback = vi.fn();
      auth.onAuthStateChange(callback);
      supabase._authCallback('SIGNED_OUT', null);

      expect(auth.isLoggedIn()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
      expect(callback).toHaveBeenCalledWith('SIGNED_OUT', null);
    });

    it('unsubscribe function calls subscription.unsubscribe', () => {
      const unsubscribe = auth.onAuthStateChange(vi.fn());
      unsubscribe();

      expect(supabase._mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('isLoggedIn', () => {
    it('returns false before login', () => {
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('returns true after login', async () => {
      await auth.login('a@b.com', 'pass123');
      expect(auth.isLoggedIn()).toBe(true);
    });
  });

  describe('getCurrentUser', () => {
    it('returns null before login', () => {
      expect(auth.getCurrentUser()).toBeNull();
    });

    it('returns user object after login', async () => {
      await auth.login('a@b.com', 'pass123');
      const user = auth.getCurrentUser();

      expect(user).toEqual({
        id: 'u-1',
        email: 'a@b.com',
        nickname: 'TestUser'
      });
    });
  });

  describe('_loadUserProfile', () => {
    it('falls back to user_metadata nickname when profile is null', async () => {
      supabase._mockProfileSingle.mockResolvedValue({
        data: null,
        error: { message: 'No profile' }
      });

      await auth.login('a@b.com', 'pass123');

      expect(auth.getCurrentUser().nickname).toBe('TestUser');
    });

    it('falls back to empty string when no nickname source', async () => {
      supabase._mockProfileSingle.mockResolvedValue({
        data: null,
        error: { message: 'No profile' }
      });
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'u-1', email: 'a@b.com' } },
        error: null
      });

      await auth.login('a@b.com', 'pass123');

      expect(auth.getCurrentUser().nickname).toBe('');
    });

    it('falls back to empty string for email when undefined', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'u-1' } },
        error: null
      });

      await auth.login('a@b.com', 'pass123');

      expect(auth.getCurrentUser().email).toBe('');
    });
  });
});
