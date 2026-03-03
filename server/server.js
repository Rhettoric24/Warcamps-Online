const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const { runMigrations } = require('./migrations/runner');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'warcamps-dev-secret-change-me';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET is not set. Using development fallback secret. Set JWT_SECRET in production.');
}

// Import database
const { pool, initializeDatabase, registerPlayer, loginPlayer, getPlayerByUsername, getPlayerById, updatePlayerState, enrichGameStateWithServerLand, searchPlayers, getRankings, sabotagePlayer, transferConquestLand, sendPlayerMessage, getPlayerInbox, getConversation, markMessagesAsRead, getUnreadMessageCount, spawnPlateauRun, getActivePlateauRun, joinPlateauRun, resolvePlateauRun, updatePlateauRunPhase } = require('./database');

// Middleware
app.use(cors({
  origin: [
    'https://rhettoric24.github.io',        // GitHub Pages deployment (lowercase!)
    'http://localhost:3000',                 // Local dev (if needed)
    'http://localhost:3001',                 // Local dev server
    'http://localhost:5500',                 // VS Code Live Server
    'http://127.0.0.1:3001',                 // Localhost alias
    'http://127.0.0.1:5500'                  // Live Server on 127.0.0.1
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
}));
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

const LEADERBOARD_SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LEADERBOARD_METRICS = ['spheres', 'military', 'land', 'days'];
let leaderboardSnapshot = {
  generatedAt: 0,
  nextUpdateAt: 0,
  data: {}
};

function toLeaderboardRows(rankings) {
  return rankings.map((p) => ({
    username: p.username,
    spheres: p.spheres,
    totalMilitary: (p.military_spearmen || 0) + (p.military_archers || 0) + (p.military_chulls || 0) + (p.military_shardbearers || 0),
    totalLand: (p.buildings_market || 0) + (p.buildings_training_camp || 0) + (p.buildings_shelter || 0) + (p.buildings_monastery || 0) + (p.buildings_soulcaster || 0) + (p.buildings_spy_network || 0) + (p.buildings_research_library || 0) + (p.buildings_stormshelter || 0) + (p.buildings_whisper_tower || 0),
    dayCount: p.day_count,
    rankValue: p.rank_value
  }));
}

function isLeaderboardSnapshotExpired() {
  return !leaderboardSnapshot.generatedAt || Date.now() >= leaderboardSnapshot.nextUpdateAt;
}

async function refreshLeaderboardSnapshot() {
  const nextData = {};

  for (const metric of LEADERBOARD_METRICS) {
    const rankings = await getRankings(metric, 100);
    nextData[metric] = toLeaderboardRows(rankings);
  }

  const now = Date.now();
  leaderboardSnapshot = {
    generatedAt: now,
    nextUpdateAt: now + LEADERBOARD_SNAPSHOT_INTERVAL_MS,
    data: nextData
  };
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
// STATIC FILE SERVING (Frontend)
// ============================================

// Serve static files from the assets directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../assets')));

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

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
  const fabrials = player.game_data?.fabrials || {};
  res.json({
    success: true,
    player: {
      username: player.username,
      created_at: player.created_at,
      spheres: player.spheres,
      gemhearts: player.gemhearts,
      military_bridgecrews: player.military_bridgecrews,
      military_spearmen: player.military_spearmen,
      military_archers: player.military_archers,
      military_shardbearers: player.military_shardbearers,
      military_chulls: player.military_chulls,
      military_noble: player.military_noble,
      military_spy: player.military_spy,
      military_ghostblood: player.military_ghostblood,
      buildings_market: player.buildings_market,
      buildings_training_camp: player.buildings_training_camp,
      buildings_shelter: player.buildings_shelter,
      buildings_monastery: player.buildings_monastery,
      buildings_soulcaster: player.buildings_soulcaster,
      buildings_spy_network: player.buildings_spy_network,
      buildings_research_library: player.buildings_research_library,
      buildings_stormshelter: player.buildings_stormshelter,
      buildings_whisper_tower: player.buildings_whisper_tower,
      fabrials: {
        heatrial: fabrials.heatrial || 0,
        ledger: fabrials.ledger || 0,
        gravity_lift: fabrials.gravity_lift || 0,
        regen_plate: fabrials.regen_plate || 0,
        thrill_amp: fabrials.thrill_amp || 0,
        half_shard: fabrials.half_shard || 0
      },
      max_land: player.game_data?.maxLand ?? 25,
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

  // Fix land desync: recalculate from actual building counts (DB columns are source of truth)
  let gameState = player.game_data || null;
  if (gameState && gameState.buildings) {
    const actualBuildingCount = 
      (player.buildings_market || 0) +
      (player.buildings_training_camp || 0) +
      (player.buildings_shelter || 0) +
      (player.buildings_monastery || 0) +
      (player.buildings_soulcaster || 0) +
      (player.buildings_spy_network || 0) +
      (player.buildings_research_library || 0) +
      (player.buildings_stormshelter || 0) +
      (player.buildings_whisper_tower || 0);
    
    // Correct land to match actual building count
    gameState.land = actualBuildingCount;
    
    // Sync buildings from DB columns to game_data
    gameState.buildings = {
      market: player.buildings_market || 0,
      training_camp: player.buildings_training_camp || 0,
      shelter: player.buildings_shelter || 0,
      monastery: player.buildings_monastery || 0,
      soulcaster: player.buildings_soulcaster || 0,
      spy_network: player.buildings_spy_network || 0,
      research_library: player.buildings_research_library || 0,
      stormshelter: player.buildings_stormshelter || 0,
      whisper_tower: player.buildings_whisper_tower || 0
    };
  }

  res.json({
    success: true,
    player: {
      id: player.id,
      username: player.username,
      day_count: player.day_count,
      last_save_time: player.last_save_time
    },
    gameState
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
 * POST /api/sabotage
 * Execute sabotage mission - deduct resources from target player
 */
app.post('/api/sabotage', requireAuth, async (req, res) => {
  const { targetUsername, resourceType, amount } = req.body || {};

  if (!targetUsername || !resourceType || !amount) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: targetUsername, resourceType, amount' 
    });
  }

  // Validate resource type
  if (resourceType !== 'spheres' && resourceType !== 'gemhearts') {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid resource type. Must be "spheres" or "gemhearts"' 
    });
  }

  // Validate amount
  const parsedAmount = parseInt(amount, 10);
  if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Amount must be a positive integer' 
    });
  }

  // Prevent self-sabotage
  if (targetUsername === req.auth.username) {
    return res.status(400).json({ 
      success: false, 
      error: 'Cannot sabotage yourself' 
    });
  }

  // Check if target exists
  const targetPlayer = await getPlayerByUsername(targetUsername);
  if (!targetPlayer) {
    return res.status(404).json({ 
      success: false, 
      error: 'Target player not found' 
    });
  }

  // Execute sabotage
  const result = await sabotagePlayer(targetUsername, resourceType, parsedAmount);
  
  if (!result.success) {
    return res.status(500).json({ 
      success: false, 
      error: result.message 
    });
  }

  res.json({
    success: true,
    message: result.message,
    targetUsername,
    resourceType,
    amountStolen: parsedAmount,
    targetRemaining: result.remaining
  });
});

/**
 * POST /api/conquest-land
 * Execute PvP land transfer for conquest victory
 */
app.post('/api/conquest-land', requireAuth, async (req, res) => {
  const { targetUsername, landAmount } = req.body || {};

  if (!targetUsername || !landAmount) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: targetUsername, landAmount'
    });
  }

  const parsedLand = parseInt(landAmount, 10);
  if (!Number.isInteger(parsedLand) || parsedLand <= 0) {
    return res.status(400).json({
      success: false,
      error: 'landAmount must be a positive integer'
    });
  }

  if (targetUsername === req.auth.username) {
    return res.status(400).json({
      success: false,
      error: 'Cannot conquer land from yourself'
    });
  }

  const targetPlayer = await getPlayerByUsername(targetUsername);
  if (!targetPlayer) {
    return res.status(404).json({
      success: false,
      error: 'Target player not found'
    });
  }

  const result = await transferConquestLand(req.auth.username, targetUsername, parsedLand);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.message || 'Land transfer failed',
      actualLandTransferred: result.actualLandTransferred || 0
    });
  }

  res.json({
    success: true,
    attackerUsername: req.auth.username,
    targetUsername,
    landRequested: parsedLand,
    landTransferred: result.actualLandTransferred,
    attackerNewMaxLand: result.attackerNewMaxLand,
    targetNewMaxLand: result.targetNewMaxLand,
    buildingsDestroyed: result.buildingsDestroyed || []
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
    totalMilitary: (p.military_bridgecrews || 0) + (p.military_spearmen || 0) + (p.military_archers || 0) + (p.military_chulls || 0) + (p.military_shardbearers || 0),
    totalLand: (p.buildings_market || 0) + (p.buildings_training_camp || 0) + (p.buildings_shelter || 0) + (p.buildings_monastery || 0) + (p.buildings_soulcaster || 0) + (p.buildings_spy_network || 0) + (p.buildings_research_library || 0) + (p.buildings_stormshelter || 0) + (p.buildings_whisper_tower || 0),
    maxLand: p.game_data?.maxLand ?? 25,
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
  const requestedMetric = typeof req.query.metric === 'string' ? req.query.metric : 'spheres';
  const metric = LEADERBOARD_METRICS.includes(requestedMetric) ? requestedMetric : 'spheres';
  const requestedLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 20;

  if (isLeaderboardSnapshotExpired()) {
    await refreshLeaderboardSnapshot();
  }

  const metricRows = leaderboardSnapshot.data[metric] || [];
  const leaderboard = metricRows.slice(0, limit);

  res.json({
    success: true,
    metric,
    leaderboard,
    snapshotGeneratedAt: leaderboardSnapshot.generatedAt,
    nextSnapshotAt: leaderboardSnapshot.nextUpdateAt
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

/**
 * GET /api/config
 * Returns configuration including the correct server URL for API calls
 * This allows the frontend to work in both local development and production
 */
app.get('/api/config', (req, res) => {
  // Determine the correct server URL based on the request hostname
  let serverUrl;
  const host = req.get('host');
  const protocol = req.protocol;
  
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    // Local development
    serverUrl = `${protocol}://${host}`;
  } else {
    // Production deployment (e.g., Railway)
    serverUrl = `${protocol}://${host}`;
  }
  
  res.json({
    success: true,
    serverUrl,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// ============================================
// MESSAGING ENDPOINTS
// ============================================

/**
 * POST /api/messages/send
 * Send a message to another player
 */
app.post('/api/messages/send', requireAuth, async (req, res) => {
  try {
    const { recipientUsername, message } = req.body;
    const senderId = req.auth.playerId;

    if (!recipientUsername || !message) {
      return res.status(400).json({ success: false, error: 'recipientUsername and message are required' });
    }

    if (message.length > 500) {
      return res.status(400).json({ success: false, error: 'Message too long (max 500 characters)' });
    }

    const result = await sendPlayerMessage(senderId, recipientUsername, message);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

/**
 * GET /api/messages/inbox
 * Get player's inbox (received messages)
 */
app.get('/api/messages/inbox', requireAuth, async (req, res) => {
  try {
    const playerId = req.auth.playerId;
    const limit = parseInt(req.query.limit) || 50;

    const result = await getPlayerInbox(playerId, limit);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch inbox' });
  }
});

/**
 * GET /api/messages/conversation/:username
 * Get conversation with a specific player
 */
app.get('/api/messages/conversation/:username', requireAuth, async (req, res) => {
  try {
    const playerId = req.auth.playerId;
    const otherUsername = req.params.username;
    const limit = parseInt(req.query.limit) || 50;

    const result = await getConversation(playerId, otherUsername, limit);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversation' });
  }
});

/**
 * POST /api/messages/mark-read
 * Mark messages as read
 */
app.post('/api/messages/mark-read', requireAuth, async (req, res) => {
  try {
    const playerId = req.auth.playerId;
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ success: false, error: 'messageIds must be a non-empty array' });
    }

    const result = await markMessagesAsRead(playerId, messageIds);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark messages as read' });
  }
});

/**
 * GET /api/messages/unread-count
 * Get count of unread messages
 */
app.get('/api/messages/unread-count', requireAuth, async (req, res) => {
  try {
    const playerId = req.auth.playerId;

    const result = await getUnreadMessageCount(playerId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
  }
});

// ============================================
// PLATEAU RUNS
// ============================================

/**
 * GET /api/plateau/active
 * Get the currently active plateau run
 */
app.get('/api/plateau/active', async (req, res) => {
  try {
    const result = await getActivePlateauRun();
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching active plateau run:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active run' });
  }
});

/**
 * POST /api/plateau/join
 * Join the active plateau run
 */
app.post('/api/plateau/join', requireAuth, async (req, res) => {
  try {
    const playerId = req.auth.playerId;
    const { runId, militarySnapshot, power, speed, carry, bridgemen, chulls, signupIndex } = req.body;
    
    if (!runId || !militarySnapshot || power === undefined || speed === undefined || carry === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await joinPlateauRun(
      runId,
      playerId,
      militarySnapshot,
      power,
      speed,
      carry,
      bridgemen || 0,
      chulls || 0,
      signupIndex || 0
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error joining plateau run:', error);
    res.status(500).json({ success: false, error: 'Failed to join run' });
  }
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
// PLATEAU RUN MANAGER
// ============================================

function calculateEnemyPower(gameYear) {
  const year = Math.max(1, gameYear || 1);
  const base = 300;
  const scaled = base * Math.pow(1.15, year - 1);
  return Math.floor(scaled);
}

let plateauRunManagerInterval = null;

async function startPlateauRunManager() {
  // Run check immediately
  await managePlateauRuns();
  
  // Check every 30 seconds
  plateauRunManagerInterval = setInterval(async () => {
    await managePlateauRuns();
  }, 30000);
}

async function managePlateauRuns() {
  try {
    const now = Date.now();
    const result = await getActivePlateauRun();
    
    if (!result.success) return;
    
    const activeRun = result.run;
    
    if (activeRun) {
      // Update phase if needed
      if (activeRun.phase === 'WARNING' && now >= activeRun.warning_end_time) {
        await updatePlateauRunPhase(activeRun.id, 'MUSTER');
        console.log(`🎖️  Plateau Run #${activeRun.id}: Muster phase started`);
      }
      
      // Transition from MUSTER to DEPARTED (forces embark on mission)
      if (activeRun.phase === 'MUSTER' && now >= activeRun.muster_end_time) {
        await updatePlateauRunPhase(activeRun.id, 'DEPARTED');
        console.log(`🚶 Plateau Run #${activeRun.id}: Forces have departed for the plateau (1 day travel)...`);
      }
      
      // Resolve run after DEPARTED phase ends (forces return home)
      if (activeRun.phase === 'DEPARTED' && now >= activeRun.departed_end_time && !activeRun.resolved) {
        console.log(`⚔️  Plateau Run #${activeRun.id}: Forces returning home, resolving...`);
        const resolution = await resolvePlateauRun(activeRun.id);
        if (resolution.success) {
          const status = resolution.victory ? '✅ VICTORY' : '❌ DEFEAT';
          console.log(`${status} - Plateau Run #${activeRun.id} resolved`);
          if (resolution.gemheartWinner) {
            console.log(`   💎 Gemheart won by: ${resolution.gemheartWinner}`);
          }
        }
      }
    } else {
      // No active run, check if we should spawn one
      const gameMs = getGameTime();
      const totalDays = Math.floor(gameMs / (1000 * 60 * 60 * 24));
      const dayOfMonth = (totalDays % 24) + 1;
      const gameYear = Math.floor(totalDays / 168) + 1;
      
      // Spawn runs on days 10-22 with 20% chance every check (30 seconds)
      // This works out to roughly ~1 run per day in the window
      const canSpawn = dayOfMonth >= 10 && dayOfMonth <= 22;
      
      if (canSpawn && Math.random() < 0.01) { // ~0.6% chance per 30s = ~1.2% per minute = reasonable spawn rate
        const enemyPower = calculateEnemyPower(gameYear);
        const spawnResult = await spawnPlateauRun(enemyPower, gameYear);
        if (spawnResult.success) {
          console.log(`🏔️  Plateau Run spawned! Enemy Power: ${enemyPower}, Year: ${gameYear}`);
        }
      }
    }
  } catch (error) {
    console.error('Plateau run manager error:', error);
  }
}

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
  
  // Run pending database migrations
  const migrationsOk = await runMigrations(pool);
  if (!migrationsOk) {
    console.error('❌ Database migrations failed.');
    process.exit(1);
  }
  
  // Start plateau run manager
  startPlateauRunManager();
  
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
  console.log(`📊 Database: Connected and ready`);
  console.log(`🏔️  Plateau Run Manager: Active\n`);
});
