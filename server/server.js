const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'warcamps-dev-secret-change-me';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET is not set. Using development fallback secret. Set JWT_SECRET in production.');
}

// Import database
const { initializeDatabase, registerPlayer, loginPlayer, getPlayerByUsername, getPlayerById, updatePlayerState, searchPlayers, getRankings } = require('./database');

// Middleware
app.use(cors());
app.use(express.json());

function generateAuthToken(player) {
  return jwt.sign(
    { playerId: player.id, username: player.username, nonce: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ============================================
// GAME CLOCK SYSTEM
// ============================================

// Game clock configuration
// 1 real second = 24 game seconds (24x speed)
// This means: 1 real hour = 1 game day
const TIME_MULTIPLIER = 24;

// Game start time: January 1, Year 1, 00:00 (represented in milliseconds)
const GAME_EPOCH = 0; // We'll use 0 as the starting point

// Align server start time to the most recent hour boundary
// This ensures daily ticks happen at :00 of every hour (1:00, 2:00, 3:00, etc)
function getAlignedServerStartTime() {
  const now = new Date();
  
  // Create a date for the current hour boundary (top of the hour)
  const currentHourBoundary = new Date(now);
  currentHourBoundary.setMinutes(0);
  currentHourBoundary.setSeconds(0);
  currentHourBoundary.setMilliseconds(0);
  
  // If we haven't reached this hour's boundary yet, use the previous hour
  const boundaryTime = currentHourBoundary.getTime();
  if (boundaryTime > now.getTime()) {
    return boundaryTime - (60 * 60 * 1000); // Go back to previous hour
  }
  
  return boundaryTime;
}

// Track when the server started in real time (aligned to hour boundary)
let serverStartRealTime = getAlignedServerStartTime();
let serverStartGameTime = GAME_EPOCH;

/**
 * Get the current game time in milliseconds since GAME_EPOCH
 * @returns {number} Game timestamp in milliseconds
 */
function getGameTime() {
  const realElapsedMs = Date.now() - serverStartRealTime;
  const gameElapsedMs = realElapsedMs * TIME_MULTIPLIER;
  return serverStartGameTime + gameElapsedMs;
}

/**
 * Convert game milliseconds to human-readable format
 * @param {number} gameMs - Game time in milliseconds
 * @returns {object} Object with year, month, day, hour, minute, second
 */
function formatGameTime(gameMs) {
  // Assume 30 days per month, 12 months per year
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

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    totalSeconds,
    gameMs
  };
}

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

/**
 * POST /api/auth/register
 * Register a new player account
 */
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required'
    });
  }
  
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({
      success: false,
      error: 'Username must be 3-30 characters'
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters'
    });
  }
  
  const result = await registerPlayer(username, password);
  
  if (result.success) {
    const token = generateAuthToken(result.player);
    res.status(201).json({
      success: true,
      message: result.message,
      player: result.player,
      token
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

/**
 * POST /api/auth/login
 * Login to an existing account
 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required'
    });
  }
  
  const result = await loginPlayer(username, password);
  
  if (result.success) {
    const token = generateAuthToken(result.player);
    res.json({
      success: true,
      message: `Welcome back, ${username}!`,
      player: result.player,
      token
    });
  } else {
    res.status(401).json({
      success: false,
      error: result.error
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT for currently authenticated player
 */
app.post('/api/auth/refresh', requireAuth, async (req, res) => {
  const player = await getPlayerById(req.auth.playerId);

  if (!player || player.username !== req.auth.username) {
    return res.status(401).json({ success: false, error: 'Invalid auth session' });
  }

  const token = generateAuthToken({ id: player.id, username: player.username });
  res.json({
    success: true,
    token,
    player: {
      id: player.id,
      username: player.username
    }
  });
});

/**
 * GET /api/auth/me
 * Return current authenticated player identity
 */
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const player = await getPlayerById(req.auth.playerId);

  if (!player || player.username !== req.auth.username) {
    return res.status(401).json({ success: false, error: 'Invalid auth session' });
  }

  res.json({
    success: true,
    player: {
      id: player.id,
      username: player.username
    }
  });
});

/**
 * GET /api/player/:username
 * Get public player data (for espionage/info viewing)
 */
app.get('/api/player/:username', async (req, res) => {
  const player = await getPlayerByUsername(req.params.username);
  
  if (!player) {
    return res.status(404).json({
      success: false,
      error: 'Player not found'
    });
  }
  
  // Return only public data
  res.json({
    success: true,
    player: {
      username: player.username,
      created_at: player.created_at,
      military_spearmen: player.military_spearmen,
      military_archers: player.military_archers,
      military_shardbearers: player.military_shardbearers,
      military_chulls: player.military_chulls,
      buildings_market: player.buildings_market,
      day_count: player.day_count
    }
  });
});

/**
 * GET /api/player/:playerId/state
 * Get private saved state for the logged-in player
 */
app.get('/api/player/:playerId/state', requireAuth, async (req, res) => {
  const playerId = parseInt(req.params.playerId, 10);

  if (!Number.isInteger(playerId) || playerId <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid player ID' });
  }

  if (req.auth.playerId !== playerId) {
    return res.status(403).json({ success: false, error: 'Access denied for this player state' });
  }

  const player = await getPlayerById(playerId);
  if (!player) {
    return res.status(404).json({ success: false, error: 'Player not found' });
  }

  if (player.username !== req.auth.username) {
    return res.status(403).json({ success: false, error: 'Access denied for this player state' });
  }

  res.json({
    success: true,
    player: {
      id: player.id,
      username: player.username,
      day_count: player.day_count,
      last_save_time: player.last_save_time
    },
    gameState: player.game_data || null
  });
});

/**
 * POST /api/player/:playerId/state
 * Save private game state for the logged-in player
 */
app.post('/api/player/:playerId/state', requireAuth, async (req, res) => {
  const playerId = parseInt(req.params.playerId, 10);
  const { username, gameState } = req.body || {};

  if (!Number.isInteger(playerId) || playerId <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid player ID' });
  }

  if (req.auth.playerId !== playerId) {
    return res.status(403).json({ success: false, error: 'Access denied for this player state' });
  }

  if (username && username !== req.auth.username) {
    return res.status(403).json({ success: false, error: 'Username does not match auth token' });
  }

  if (!gameState || typeof gameState !== 'object') {
    return res.status(400).json({ success: false, error: 'gameState payload required' });
  }

  const player = await getPlayerById(playerId);
  if (!player) {
    return res.status(404).json({ success: false, error: 'Player not found' });
  }

  if (player.username !== req.auth.username) {
    return res.status(403).json({ success: false, error: 'Access denied for this player state' });
  }

  const saved = await updatePlayerState(playerId, gameState);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'Failed to save player state' });
  }

  res.json({
    success: true,
    message: 'Player state saved',
    savedAt: Date.now()
  });
});

/**
 * GET /api/players
 * Search and list players (optionally exclude current user)
 */
app.get('/api/players', async (req, res) => {
  const { search = '', limit = 50, offset = 0, excludeSelf = 'false' } = req.query;
  
  let excludePlayerId = null;
  if (excludeSelf === 'true') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        excludePlayerId = decoded.playerId;
      } catch (error) {
        // If token invalid, just don't exclude anyone
      }
    }
  }

  const players = await searchPlayers({
    search,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    excludePlayerId
  });

  // Return public player data only
  const publicPlayers = players.map(p => ({
    id: p.id,
    username: p.username,
    spheres: p.spheres,
    totalMilitary: (p.military_spearmen || 0) + (p.military_archers || 0) + (p.military_chulls || 0) + (p.military_shardbearers || 0),
    totalLand: (p.buildings_market || 0) + (p.buildings_training_camp || 0) + (p.buildings_shelter || 0),
    dayCount: p.day_count
  }));

  res.json({
    success: true,
    players: publicPlayers,
    count: publicPlayers.length
  });
});

/**
 * GET /api/rankings
 * Get top players leaderboard by metric
 */
app.get('/api/rankings', async (req, res) => {
  const { metric = 'spheres', limit = 20 } = req.query;
  
  const rankings = await getRankings(metric, parseInt(limit, 10));

  // Calculate composite stats for each player
  const leaderboard = rankings.map(p => ({
    username: p.username,
    spheres: p.spheres,
    totalMilitary: (p.military_spearmen || 0) + (p.military_archers || 0) + (p.military_chulls || 0) + (p.military_shardbearers || 0),
    totalLand: (p.buildings_market || 0) + (p.buildings_training_camp || 0) + (p.buildings_shelter || 0) + (p.buildings_monastery || 0) + (p.buildings_soulcaster || 0) + (p.buildings_spy_network || 0) + (p.buildings_research_library || 0) + (p.buildings_stormshelter || 0) + (p.buildings_whisper_tower || 0),
    dayCount: p.day_count,
    rankValue: p.rank_value
  }));

  res.json({
    success: true,
    metric,
    leaderboard
  });
});

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /api/time
 * Returns current game time to client with next tick info
 */
app.get('/api/time', (req, res) => {
  const now = Date.now();
  const gameMs = getGameTime();
  const formattedTime = formatGameTime(gameMs);
  
  // Calculate next hour boundary
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1);
  nextHour.setMinutes(0);
  nextHour.setSeconds(0);
  nextHour.setMilliseconds(0);
  
  const msUntilNextHour = nextHour.getTime() - now;
  
  res.json({
    success: true,
    gameMs,
    formatted: formattedTime,
    serverRealTime: Date.now(),
    timeMultiplier: TIME_MULTIPLIER,
    nextTickTime: nextHour.getTime(),
    msUntilNextTick: msUntilNextHour
  });
});

/**
 * GET /api/time/formatted
 * Returns only the formatted game time (easier to display)
 */
app.get('/api/time/formatted', (req, res) => {
  const gameMs = getGameTime();
  const formatted = formatGameTime(gameMs);
  
  res.json(formatted);
});

/**
 * GET /api/status
 * Simple health check
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Warcamps server is running',
    uptime: Date.now() - serverStartRealTime
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// ============================================
// SERVER STARTUP
// ============================================

app.listen(PORT, async () => {
  // Initialize database
  const dbReady = await initializeDatabase();
  
  if (!dbReady) {
    console.error('❌ Failed to initialize database. Check your DATABASE_URL.');
    process.exit(1);
  }
  
  const nextHourBoundary = new Date();
  nextHourBoundary.setHours(nextHourBoundary.getHours() + 1);
  nextHourBoundary.setMinutes(0);
  nextHourBoundary.setSeconds(0);
  nextHourBoundary.setMilliseconds(0);
  
  const currentGameTime = formatGameTime(getGameTime());
  const nextTickTime = nextHourBoundary.toLocaleTimeString();
  
  console.log(`\n🎮 Warcamps Server Running`);
  console.log(`📍 Listening on http://localhost:${PORT}`);
  console.log(`⚙️  Time Multiplier: ${TIME_MULTIPLIER}x`);
  console.log(`🕐 Current Game Time: Year ${currentGameTime.year}, Month ${currentGameTime.month}, Day ${currentGameTime.day}`);
  console.log(`📅 Next Day Tick: ${nextTickTime} (top of the hour)`);
  console.log(`📊 Database: Connected and ready\n`);
});
