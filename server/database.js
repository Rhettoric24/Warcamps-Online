// Database connection and operations
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Add it to server/.env for local use or Railway Variables in production.');
}

// Create connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // Required for Railway
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Initialize database schema
 */
async function initializeDatabase() {
  try {
    console.log('📊 Initializing database schema...');
    
    // Create players table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        
        spheres BIGINT DEFAULT 15000,
        gemhearts INT DEFAULT 2,
        
        military_bridgecrews INT DEFAULT 20,
        military_spearmen INT DEFAULT 100,
        military_archers INT DEFAULT 0,
        military_chulls INT DEFAULT 0,
        military_shardbearers INT DEFAULT 0,
        military_noble INT DEFAULT 0,
        military_spy INT DEFAULT 0,
        military_ghostblood INT DEFAULT 0,
        
        buildings_market INT DEFAULT 0,
        buildings_training_camp INT DEFAULT 0,
        buildings_monastery INT DEFAULT 0,
        buildings_soulcaster INT DEFAULT 0,
        buildings_shelter INT DEFAULT 0,
        buildings_spy_network INT DEFAULT 0,
        buildings_research_library INT DEFAULT 0,
        buildings_stormshelter INT DEFAULT 0,
        buildings_whisper_tower INT DEFAULT 0,
        
        day_count INT DEFAULT 0,
        last_tick_time BIGINT DEFAULT 0,
        last_save_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        game_data JSONB DEFAULT '{}'
      );
    `);
    
    console.log('✅ Database schema initialized');
    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    return false;
  }
}

/**
 * Register a new player
 */
async function registerPlayer(username, password) {
  try {
    // Check if username exists
    const existing = await pool.query('SELECT id FROM players WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return { success: false, error: 'Username already exists' };
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert player
    const result = await pool.query(
      'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );
    
    return { 
      success: true, 
      player: result.rows[0],
      message: `Welcome, ${username}!`
    };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Login a player
 */
async function loginPlayer(username, password) {
  try {
    const result = await pool.query('SELECT * FROM players WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Username not found' };
    }
    
    const player = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, player.password_hash);
    
    if (!isValidPassword) {
      return { success: false, error: 'Invalid password' };
    }
    
    // Update last login
    await pool.query('UPDATE players SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [player.id]);
    
    // Return player data (without password)
    const { password_hash, ...playerData } = player;
    return { success: true, player: playerData };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get player by username
 */
async function getPlayerByUsername(username) {
  try {
    const result = await pool.query('SELECT * FROM players WHERE username = $1', [username]);
    if (result.rows.length === 0) return null;
    
    const { password_hash, ...playerData } = result.rows[0];
    return playerData;
  } catch (error) {
    console.error('Get player error:', error);
    return null;
  }
}

/**
 * Get player by ID
 */
async function getPlayerById(playerId) {
  try {
    const result = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (result.rows.length === 0) return null;

    const { password_hash, ...playerData } = result.rows[0];
    return playerData;
  } catch (error) {
    console.error('Get player by id error:', error);
    return null;
  }
}

/**
 * Update player game state
 */
async function updatePlayerState(playerId, gameState) {
  try {
    await pool.query(
      `UPDATE players SET 
        spheres = $1,
        gemhearts = $2,
        military_bridgecrews = $3,
        military_spearmen = $4,
        military_archers = $5,
        military_chulls = $6,
        military_shardbearers = $7,
        military_noble = $8,
        military_spy = $9,
        military_ghostblood = $10,
        buildings_market = $11,
        buildings_training_camp = $12,
        buildings_monastery = $13,
        buildings_soulcaster = $14,
        buildings_shelter = $15,
        buildings_spy_network = $16,
        buildings_research_library = $17,
        buildings_stormshelter = $18,
        buildings_whisper_tower = $19,
        day_count = $20,
        last_tick_time = $21,
        last_save_time = CURRENT_TIMESTAMP,
        game_data = $22
      WHERE id = $23`,
      [
        gameState.spheres || 0,
        gameState.gemhearts || 0,
        gameState.military?.bridgecrews || 0,
        gameState.military?.spearmen || 0,
        gameState.military?.archers || 0,
        gameState.military?.chulls || 0,
        gameState.military?.shardbearers || 0,
        gameState.military?.noble || 0,
        gameState.military?.spy || 0,
        gameState.military?.ghostblood || 0,
        gameState.buildings?.market || 0,
        gameState.buildings?.training_camp || 0,
        gameState.buildings?.monastery || 0,
        gameState.buildings?.soulcaster || 0,
        gameState.buildings?.shelter || 0,
        gameState.buildings?.spy_network || 0,
        gameState.buildings?.research_library || 0,
        gameState.buildings?.stormshelter || 0,
        gameState.buildings?.whisper_tower || 0,
        gameState.dayCount || 0,
        gameState.lastTickTime || 0,
        JSON.stringify(gameState),
        playerId
      ]
    );
    return true;
  } catch (error) {
    console.error('Update player state error:', error);
    return false;
  }
}

/**
 * Search players with pagination and filtering
 */
async function searchPlayers(options = {}) {
  try {
    const {
      search = '',
      limit = 50,
      offset = 0,
      excludePlayerId = null
    } = options;

    let query = `
      SELECT 
        id,
        username,
        spheres,
        gemhearts,
        military_spearmen,
        military_archers,
        military_chulls,
        military_shardbearers,
        military_bridgecrews,
        buildings_market,
        buildings_training_camp,
        buildings_shelter,
        day_count,
        created_at
      FROM players
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND username ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (excludePlayerId) {
      query += ` AND id != $${paramIndex}`;
      params.push(excludePlayerId);
      paramIndex++;
    }

    query += ` ORDER BY username ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Search players error:', error);
    return [];
  }
}

/**
 * Get top players by various metrics (leaderboard)
 */
async function getRankings(metric = 'spheres', limit = 20) {
  try {
    const validMetrics = {
      spheres: 'spheres',
      military: '(military_spearmen + military_archers + military_chulls + military_shardbearers)',
      land: '(buildings_market + buildings_training_camp + buildings_shelter + buildings_monastery + buildings_soulcaster + buildings_spy_network + buildings_research_library + buildings_stormshelter + buildings_whisper_tower)',
      days: 'day_count'
    };

    const orderBy = validMetrics[metric] || validMetrics.spheres;

    const query = `
      SELECT 
        id,
        username,
        spheres,
        gemhearts,
        military_spearmen,
        military_archers,
        military_chulls,
        military_shardbearers,
        military_bridgecrews,
        buildings_market,
        buildings_training_camp,
        buildings_shelter,
        buildings_monastery,
        buildings_soulcaster,
        buildings_spy_network,
        buildings_research_library,
        buildings_stormshelter,
        buildings_whisper_tower,
        day_count,
        created_at,
        ${orderBy} as rank_value
      FROM players
      ORDER BY rank_value DESC, username ASC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Get rankings error:', error);
    return [];
  }
}

/**
 * Close database connection
 */
async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  initializeDatabase,
  registerPlayer,
  loginPlayer,
  getPlayerByUsername,
  getPlayerById,
  updatePlayerState,
  searchPlayers,
  getRankings,
  closePool
};
