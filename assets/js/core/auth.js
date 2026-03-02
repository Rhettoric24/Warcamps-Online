// Authentication Module
// Handles login, registration, and session management

// SERVER_URL is determined by fetching /api/config from wherever the app is hosted
// This allows the same code to work in development (localhost) and production (Railway, etc)
let SERVER_URL = null;

export async function initializeServerUrl() {
  if (SERVER_URL) return SERVER_URL;
  
  try {
    // First, try to get config from current origin
    const currentOrigin = window.location.origin;
    const response = await fetch(`${currentOrigin}/api/config`);
    const data = await response.json();
    SERVER_URL = data.serverUrl || currentOrigin;
  } catch (error) {
    // Fallback: use current origin
    console.warn('Failed to fetch server config, using current origin');
    SERVER_URL = window.location.origin;
  }
  
  return SERVER_URL;
}

export function getServerUrl() {
  if (!SERVER_URL) {
    // Emergency fallback if initializeServerUrl wasn't called
    return window.location.origin;
  }
  return SERVER_URL;
}

export function getApiUrl() {
  return `${getServerUrl()}/api`;
}

const TOKEN_REFRESH_THRESHOLD_MS = 15 * 60 * 1000;

// Store current player session
let currentPlayer = null;
let authToken = null;

function parseJwtPayload(token) {
    try {
        const payload = token.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(atob(normalized).split('').map(c => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function getTokenExpiryMs(token) {
    const payload = parseJwtPayload(token);
    if (!payload || !payload.exp) return 0;
    return payload.exp * 1000;
}

function isTokenExpiringSoon(token) {
    const expiresAt = getTokenExpiryMs(token);
    if (!expiresAt) return false;
    return (expiresAt - Date.now()) <= TOKEN_REFRESH_THRESHOLD_MS;
}

async function refreshAuthToken() {
    if (!authToken) {
        return { success: false, error: 'Missing auth token' };
    }

    try {
        const response = await fetch(`${getApiUrl()}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();

        if (!response.ok || !data.token) {
            throw new Error(data.error || 'Token refresh failed');
        }

        authToken = data.token;
        if (currentPlayer) {
            saveSession(currentPlayer, authToken);
        }

        return { success: true, token: authToken };
    } catch (error) {
        logoutPlayer();
        return { success: false, error: error.message };
    }
}

export async function authFetch(url, options = {}, retryOn401 = true) {
    if (!authToken) {
        throw new Error('Missing auth token');
    }

    if (isTokenExpiringSoon(authToken)) {
        const refreshed = await refreshAuthToken();
        if (!refreshed.success) {
            throw new Error(refreshed.error || 'Token refresh failed');
        }
    }

    const headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${authToken}`
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401 && retryOn401) {
        const refreshed = await refreshAuthToken();
        if (refreshed.success) {
            return authFetch(url, options, false);
        }
    }

    return response;
}

/**
 * Register a new player account
 */
export async function registerPlayer(username, password) {
    try {
        const response = await fetch(`${getApiUrl()}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Store player data and session
        currentPlayer = data.player;
        authToken = data.token || null;
        saveSession(data.player, authToken);

        console.log('✅ Registration successful:', username);
        return { success: true, player: data.player };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Login existing player
 */
export async function loginPlayer(username, password) {
    try {
        const response = await fetch(`${getApiUrl()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store player data and session
        currentPlayer = data.player;
        authToken = data.token || null;
        saveSession(data.player, authToken);

        console.log('✅ Login successful:', username);
        return { success: true, player: data.player };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Logout current player
 */
export function logoutPlayer() {
    currentPlayer = null;
    authToken = null;
    localStorage.removeItem('warcamps_session');
    console.log('👋 Player logged out');
}

/**
 * Get current logged-in player
 */
export function getCurrentPlayer() {
    return currentPlayer;
}

/**
 * Check if player is logged in
 */
export function isLoggedIn() {
    return currentPlayer !== null;
}

/**
 * Save session to localStorage
 */
function saveSession(player, token) {
    const session = {
        playerId: player.id,
        username: player.username,
        token,
        timestamp: Date.now()
    };
    localStorage.setItem('warcamps_session', JSON.stringify(session));
}

/**
 * Load session from localStorage
 */
export function loadSession() {
    const sessionData = localStorage.getItem('warcamps_session');
    if (!sessionData) return null;

    try {
        const session = JSON.parse(sessionData);
        // Session expires after 24 hours
        if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('warcamps_session');
            return null;
        }
        if (!session.token || !session.playerId || !session.username) {
            localStorage.removeItem('warcamps_session');
            return null;
        }
        return session;
    } catch (error) {
        console.error('Error loading session:', error);
        return null;
    }
}

/**
 * Restore player session on page load
 */
export async function restoreSession() {
    const session = loadSession();
    if (!session) return null;

    try {
        authToken = session.token;
        currentPlayer = {
            id: session.playerId,
            username: session.username
        };

        const response = await authFetch(`${getApiUrl()}/auth/me`, { method: 'GET' });
        const data = await response.json();

        if (response.ok && data.player) {
            currentPlayer = {
                id: data.player.id,
                username: data.player.username
            };
            saveSession(currentPlayer, authToken);
            console.log('✅ Session restored:', session.username);
            return currentPlayer;
        }
    } catch (error) {
        console.error('Error restoring session:', error);
    }

    authToken = null;
    currentPlayer = null;
    localStorage.removeItem('warcamps_session');
    return null;
}

/**
 * Load persisted player game state from server
 */
export async function loadPlayerState(playerId, username) {
    try {
        const response = await authFetch(`${getApiUrl()}/player/${playerId}/state`, {
            method: 'GET'
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load player state');
        }

        return {
            success: true,
            player: data.player,
            gameState: data.gameState || null
        };
    } catch (error) {
        console.error('Load player state error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save player game state to server
 */
export async function savePlayerState(playerId, username, gameState) {
    try {
        const response = await authFetch(`${getApiUrl()}/player/${playerId}/state`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, gameState })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save player state');
        }

        return { success: true, message: data.message };
    } catch (error) {
        console.error('Save player state error:', error);
        return { success: false, error: error.message };
    }
}
