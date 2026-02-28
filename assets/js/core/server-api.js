// Server API communication module
// Handles all communication with the Railway backend server

const SERVER_URL = 'https://warcamps-online-production.up.railway.app';

// Server time state
let serverTimeCache = {
    gameMs: 0,
    serverRealTime: 0,
    localRealTime: 0,
    lastSync: 0,
    syncing: false
};

/**
 * Fetch current game time from the server
 * @returns {Promise<Object>} Server time data
 */
export async function fetchServerTime() {
    try {
        const response = await fetch(`${SERVER_URL}/api/time`);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        const data = await response.json();
        
        // Cache the time data with local timestamp for interpolation
        serverTimeCache = {
            gameMs: data.gameMs,
            serverRealTime: data.serverRealTime,
            localRealTime: Date.now(),
            lastSync: Date.now(),
            syncing: false
        };
        
        return data;
    } catch (error) {
        console.error('Failed to fetch server time:', error);
        serverTimeCache.syncing = false;
        throw error;
    }
}

/**
 * Get current game time (uses cached server time + local interpolation)
 * This allows smooth time updates without hammering the server
 * @returns {number} Current game time in milliseconds
 */
export function getCurrentGameTime() {
    if (serverTimeCache.lastSync === 0) {
        // No server data yet, return 0
        return 0;
    }
    
    // Calculate time elapsed since last sync
    const localElapsed = Date.now() - serverTimeCache.localRealTime;
    
    // Apply 24x multiplier to match server (1 real ms = 24 game ms)
    const gameElapsed = localElapsed * 24;
    
    // Return server time + interpolated time
    return serverTimeCache.gameMs + gameElapsed;
}

/**
 * Convert game milliseconds to day count
 * @param {number} gameMs - Game time in milliseconds
 * @returns {number} Total days elapsed
 */
export function gameMsToDays(gameMs) {
    const GAME_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    return Math.floor(gameMs / GAME_DAY_MS);
}

/**
 * Convert game milliseconds to formatted date
 * @param {number} gameMs - Game time in milliseconds
 * @returns {Object} Formatted date {year, month, day, hour, minute, second}
 */
export function formatGameTime(gameMs) {
    const totalSeconds = Math.floor(gameMs / 1000);
    
    const SECONDS_PER_MINUTE = 60;
    const SECONDS_PER_HOUR = 60 * 60;
    const SECONDS_PER_DAY = 24 * 60 * 60;
    const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;
    const SECONDS_PER_YEAR = 12 * SECONDS_PER_MONTH;

    let remaining = totalSeconds;
    
    const year = Math.floor(remaining / SECONDS_PER_YEAR) + 1;
    remaining %= SECONDS_PER_YEAR;
    
    const month = Math.floor(remaining / SECONDS_PER_MONTH) + 1;
    remaining %= SECONDS_PER_MONTH;
    
    const day = Math.floor(remaining / SECONDS_PER_DAY) + 1;
    remaining %= SECONDS_PER_DAY;
    
    const hour = Math.floor(remaining / SECONDS_PER_HOUR);
    remaining %= SECONDS_PER_HOUR;
    
    const minute = Math.floor(remaining / SECONDS_PER_MINUTE);
    remaining %= SECONDS_PER_MINUTE;
    
    const second = remaining;

    return { year, month, day, hour, minute, second, totalSeconds, gameMs };
}

/**
 * Initialize server connection and sync time
 * @returns {Promise<boolean>} True if successful
 */
export async function initializeServerConnection() {
    try {
        console.log('🌐 Connecting to Warcamps server...');
        const data = await fetchServerTime();
        console.log(`✅ Server connected! Game time: Year ${data.formatted.year}, Month ${data.formatted.month}, Day ${data.formatted.day}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to connect to server:', error);
        return false;
    }
}

/**
 * Sync with server (should be called periodically)
 * @returns {Promise<void>}
 */
export async function syncWithServer() {
    if (serverTimeCache.syncing) return; // Prevent multiple simultaneous syncs
    
    serverTimeCache.syncing = true;
    try {
        await fetchServerTime();
    } catch (error) {
        console.warn('Server sync failed, using local interpolation');
    }
}

/**
 * Get time until next day tick
 * @returns {number} Milliseconds until next day
 */
export function getTimeUntilNextDay() {
    const currentGameMs = getCurrentGameTime();
    const GAME_DAY_MS = 24 * 60 * 60 * 1000;
    const msIntoCurrentDay = currentGameMs % GAME_DAY_MS;
    return GAME_DAY_MS - msIntoCurrentDay;
}

/**
 * Check if server is reachable
 * @returns {Promise<boolean>}
 */
export async function checkServerStatus() {
    try {
        const response = await fetch(`${SERVER_URL}/api/status`, { timeout: 5000 });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Export server URL for reference
export { SERVER_URL };
