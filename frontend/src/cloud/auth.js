/**
 * Authentication Service — Supabase Auth
 * @module cloud/auth
 */

/**
 * AuthService — handles user registration, login, and profile management
 */
export class AuthService {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
   */
  constructor(supabaseClient) {
    /** @type {import('@supabase/supabase-js').SupabaseClient} */
    this._supabase = supabaseClient;

    /** @type {{ id: string, email: string, nickname: string }|null} */
    this._currentUser = null;

    /** @type {boolean} */
    this._initialized = false;
  }

  /**
   * Initialize auth state from existing session
   * Call once on app startup
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    this._initialized = true;

    const { data: { session } } = await this._supabase.auth.getSession();
    if (session?.user) {
      await this._loadUserProfile(session.user);
    }
  }

  /**
   * Register a new user
   * @param {string} email
   * @param {string} password
   * @param {string} nickname
   * @returns {Promise<{ user: Object|null, error: string|null }>}
   */
  async register(email, password, nickname) {
    const { data, error } = await this._supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname }
      }
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (data.user) {
      await this._loadUserProfile(data.user);
    }

    return { user: this._currentUser, error: null };
  }

  /**
   * Login with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user: Object|null, error: string|null }>}
   */
  async login(email, password) {
    const { data, error } = await this._supabase.auth
      .signInWithPassword({ email, password });

    if (error) {
      return { user: null, error: error.message };
    }

    if (data.user) {
      await this._loadUserProfile(data.user);
    }

    return { user: this._currentUser, error: null };
  }

  /**
   * Logout current user
   * @returns {Promise<{ error: string|null }>}
   */
  async logout() {
    const { error } = await this._supabase.auth.signOut();
    this._currentUser = null;

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  /**
   * Update user profile
   * @param {{ nickname?: string, avatarUrl?: string }} fields
   * @returns {Promise<{ profile: Object|null, error: string|null }>}
   */
  async updateProfile(fields) {
    if (!this._currentUser) {
      return { profile: null, error: 'Not logged in' };
    }

    const updates = {};
    if (fields.nickname !== undefined) updates.nickname = fields.nickname;
    if (fields.avatarUrl !== undefined) updates.avatar_url = fields.avatarUrl;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await this._supabase
      .from('profiles')
      .update(updates)
      .eq('id', this._currentUser.id)
      .select()
      .single();

    if (error) {
      return { profile: null, error: error.message };
    }

    this._currentUser.nickname = data.nickname;
    return { profile: data, error: null };
  }

  /**
   * Listen for auth state changes
   * @param {Function} callback - (event: string, session: Object|null) => void
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    const { data: { subscription } } = this._supabase.auth
      .onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          this._currentUser = null;
        }
        callback(event, session);
      });

    return () => subscription.unsubscribe();
  }

  /**
   * Check if user is currently logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return this._currentUser !== null;
  }

  /**
   * Get cached current user info
   * @returns {{ id: string, email: string, nickname: string }|null}
   */
  getCurrentUser() {
    return this._currentUser;
  }

  /**
   * Load user profile from database
   * @private
   * @param {Object} authUser - Supabase auth user object
   */
  async _loadUserProfile(authUser) {
    const { data: profile } = await this._supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', authUser.id)
      .single();

    this._currentUser = {
      id: authUser.id,
      email: authUser.email || '',
      nickname: profile?.nickname
        || authUser.user_metadata?.nickname
        || ''
    };
  }
}
