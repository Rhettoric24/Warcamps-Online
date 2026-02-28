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
  console.log(`📅 Next Day Tick: ${nextTickTime} (top of the hour)\n`);
});
