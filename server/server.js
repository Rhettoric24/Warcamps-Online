const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// GAME CLOCK SYSTEM
// ============================================

// Game clock configuration
// 1 real second = 24 game seconds (24x speed)
// This means: 1 real hour = 1 game day
const TIME_MULTIPLIER = 24;

// Game start time: January 1, Year 1, 00:00 (represented in milliseconds)
const GAME_EPOCH = 0; // We'll use 0 as the starting point

// Track when the server started in real time
let serverStartRealTime = Date.now();
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
// API ENDPOINTS
// ============================================

/**
 * GET /api/time
 * Returns current game time to client
 */
app.get('/api/time', (req, res) => {
  const gameMs = getGameTime();
  const formattedTime = formatGameTime(gameMs);
  
  res.json({
    success: true,
    gameMs,
    formatted: formattedTime,
    serverRealTime: Date.now(),
    timeMultiplier: TIME_MULTIPLIER
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

app.listen(PORT, () => {
  console.log(`\n🎮 Warcamps Server Running`);
  console.log(`📍 Listening on http://localhost:${PORT}`);
  console.log(`⚙️  Time Multiplier: ${TIME_MULTIPLIER}x`);
  console.log(`🕐 Current Game Time: ${JSON.stringify(formatGameTime(getGameTime()), null, 2)}\n`);
});
