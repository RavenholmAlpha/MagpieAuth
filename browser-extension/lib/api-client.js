/**
 * MagpieAuth API Client
 * 
 * Communicates with the MagpieAuth desktop app via local HTTP API.
 * Handles token management, request timeouts, and automatic 401 handling.
 */

const API_BASE = 'http://127.0.0.1:19826';
const REQUEST_TIMEOUT = 5000; // 5 seconds

class MagpieAPI {
  constructor() {
    this._token = null;
    this._tokenLoaded = false;
  }

  // ── Token Management ──────────────────────────────────────────────

  /**
   * Load the auth token from chrome.storage.session.
   * Caches locally so we only read storage once per popup lifecycle.
   */
  async _loadToken() {
    if (this._tokenLoaded) return;
    try {
      const result = await chrome.storage.session.get('authToken');
      this._token = result.authToken || null;
    } catch (e) {
      // session storage may not be available in all contexts
      this._token = null;
    }
    this._tokenLoaded = true;
  }

  /**
   * Persist token to chrome.storage.session (survives popup close,
   * cleared when browser closes).
   */
  async _saveToken(token) {
    this._token = token;
    this._tokenLoaded = true;
    try {
      await chrome.storage.session.set({ authToken: token });
    } catch (e) {
      console.warn('[MagpieAPI] Failed to save token:', e);
    }
  }

  /**
   * Clear stored token (called on 401 or explicit logout).
   */
  async _clearToken() {
    this._token = null;
    this._tokenLoaded = true;
    try {
      await chrome.storage.session.remove('authToken');
    } catch (e) {
      console.warn('[MagpieAPI] Failed to clear token:', e);
    }
  }

  // ── HTTP Helpers ──────────────────────────────────────────────────

  /**
   * Make an authenticated fetch request with timeout and 401 handling.
   * @param {string} path - API path (e.g. '/api/status')
   * @param {object} options - fetch options override
   * @returns {Promise<Response>}
   */
  async _request(path, options = {}) {
    await this._loadToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Attach bearer token if available
    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      // Handle 401 – token expired or invalid
      if (response.status === 401) {
        await this._clearToken();
        const error = new Error('Unauthorized');
        error.status = 401;
        throw error;
      }

      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convenience: make a request and parse JSON response.
   */
  async _json(path, options = {}) {
    const response = await this._request(path, options);
    return response.json();
  }

  // ── Public API Methods ────────────────────────────────────────────

  /**
   * Check the status of the MagpieAuth desktop app.
   * @returns {Promise<{status: string, locked: boolean}>}
   */
  async getStatus() {
    return this._json('/api/status');
  }

  /**
   * Authenticate with a pattern array.
   * On success, stores the returned auth token.
   * @param {number[]} patternArray - Array of dot indices, e.g. [0,1,2,5,8]
   * @returns {Promise<{success: boolean, token?: string, error?: string}>}
   */
  async authenticatePattern(patternArray) {
    const patternString = JSON.stringify(patternArray);
    const result = await this._json('/api/auth/pattern', {
      method: 'POST',
      body: JSON.stringify({ pattern: patternString }),
    });

    if (result.token) {
      await this._saveToken(result.token);
    }

    return result;
  }

  /**
   * Get all vault items (summary list, no secrets).
   * @returns {Promise<Array>}
   */
  async getVaultItems() {
    return this._json('/api/vault/items');
  }

  /**
   * Search vault items by query string.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async searchItems(query) {
    const encoded = encodeURIComponent(query);
    return this._json(`/api/vault/search?q=${encoded}`);
  }

  /**
   * Get the decrypted password for a vault item.
   * @param {string} id - Item ID
   * @returns {Promise<{password: string}>}
   */
  async getPassword(id) {
    return this._json(`/api/vault/items/${encodeURIComponent(id)}/password`);
  }

  /**
   * Get the current TOTP code for a vault item.
   * @param {string} id - Item ID
   * @returns {Promise<{code: string, remaining: number}>}
   */
  async getTotpCode(id) {
    return this._json(`/api/vault/items/${encodeURIComponent(id)}/totp`);
  }

  /**
   * Get remaining seconds until next TOTP rotation.
   * @returns {Promise<{remaining: number}>}
   */
  async getRemainingSeconds() {
    return this._json('/api/totp/remaining');
  }

  /**
   * Check if a valid token is currently stored.
   */
  async hasToken() {
    await this._loadToken();
    return !!this._token;
  }
}

// Export singleton instance
const magpieAPI = new MagpieAPI();
