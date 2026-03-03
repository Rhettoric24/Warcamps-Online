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
    
    // Create player_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_messages (
        id SERIAL PRIMARY KEY,
        sender_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        recipient_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT different_users CHECK (sender_id != recipient_id)
      );
    `);
    
    // Create index for faster message queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_recipient 
      ON player_messages(recipient_id, sent_at DESC);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON player_messages(sender_id, recipient_id, sent_at DESC);
    `);
    
    // Create plateau_runs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plateau_runs (
        id SERIAL PRIMARY KEY,
        phase VARCHAR(20) NOT NULL DEFAULT 'WARNING',
        warning_start_time BIGINT NOT NULL,
        warning_end_time BIGINT NOT NULL,
        muster_start_time BIGINT NOT NULL,
        muster_end_time BIGINT NOT NULL,
        departed_start_time BIGINT,
        departed_end_time BIGINT,
        difficulty VARCHAR(20) DEFAULT 'Medium',
        enemy_power INT NOT NULL,
        game_year INT NOT NULL,
        resolved BOOLEAN DEFAULT FALSE,
        victory BOOLEAN DEFAULT FALSE,
        gemheart_winner_id INT REFERENCES players(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create plateau_participants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plateau_participants (
        id SERIAL PRIMARY KEY,
        run_id INT NOT NULL REFERENCES plateau_runs(id) ON DELETE CASCADE,
        player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        signup_time BIGINT NOT NULL,
        signup_index INT NOT NULL,
        power INT NOT NULL,
        speed DECIMAL(10, 4) NOT NULL,
        carry INT NOT NULL,
        bridgemen INT DEFAULT 0,
        chulls INT DEFAULT 0,
        military_snapshot JSONB DEFAULT '{}',
        loot_share INT DEFAULT 0,
        gemheart_won BOOLEAN DEFAULT FALSE,
        
        UNIQUE(run_id, player_id)
      );
    `);
    
    // Create indexes for faster plateau queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_plateau_runs_active 
      ON plateau_runs(resolved, muster_end_time);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_plateau_participants_run 
      ON plateau_participants(run_id, signup_time);
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
 * Update player game state with server-authoritative land/buildings
 * This prevents PvP conquest mutations from being overwritten by client saves
 */
async function updatePlayerState(playerId, gameState) {
  try {
    // Fetch current maxLand and buildings from server as source of truth
    const currentPlayer = await pool.query(
      `SELECT game_data FROM players WHERE id = $1`,
      [playerId]
    );

    let serverMaxLand = 25;
    let serverBuildings = {
      market: 0,
      training_camp: 0,
      monastery: 0,
      soulcaster: 0,
      shelter: 0,
      spy_network: 0,
      research_library: 0,
      stormshelter: 0,
      whisper_tower: 0
    };

    if (currentPlayer.rows.length > 0 && currentPlayer.rows[0].game_data) {
      const serverState = currentPlayer.rows[0].game_data;
      if (Number.isFinite(serverState.maxLand)) {
        serverMaxLand = serverState.maxLand;
      }
      if (serverState.buildings && typeof serverState.buildings === 'object') {
        serverBuildings = { ...serverState.buildings };
      }
    }

    // Use client buildings (buildings are just stored, not server-authoritative)
    const clientBuildings = gameState.buildings || serverBuildings;
    const mergedGameState = { ...gameState };
    mergedGameState.maxLand = serverMaxLand;
    mergedGameState.buildings = { ...clientBuildings };

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
        clientBuildings.market || 0,
        clientBuildings.training_camp || 0,
        clientBuildings.monastery || 0,
        clientBuildings.soulcaster || 0,
        clientBuildings.shelter || 0,
        clientBuildings.spy_network || 0,
        clientBuildings.research_library || 0,
        clientBuildings.stormshelter || 0,
        clientBuildings.whisper_tower || 0,
        gameState.dayCount || 0,
        gameState.lastTickTime || 0,
        JSON.stringify(mergedGameState),
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
 * Merge server-authoritative land and building data into game state
 * Ensures PvP mutations aren't overwritten when client state loads
 */
async function enrichGameStateWithServerLand(gameState, playerId) {
  try {
    // Fetch current player state from database
    const result = await pool.query(
      `SELECT game_data, 
              buildings_market, buildings_training_camp, buildings_monastery,
              buildings_soulcaster, buildings_shelter, buildings_spy_network,
              buildings_research_library, buildings_stormshelter, buildings_whisper_tower
       FROM players WHERE id = $1`,
      [playerId]
    );

    if (result.rows.length === 0) return gameState;

    const serverData = result.rows[0];
    const serverGameData = serverData.game_data || {};
    
    // Ensure server-authoritative maxLand is present
    gameState.maxLand = serverGameData.maxLand || gameState.maxLand || 0;
    
    // Ensure server-authoritative buildings are present
    gameState.buildings = gameState.buildings || {};
    gameState.buildings.market = serverData.buildings_market || 0;
    gameState.buildings.training_camp = serverData.buildings_training_camp || 0;
    gameState.buildings.monastery = serverData.buildings_monastery || 0;
    gameState.buildings.soulcaster = serverData.buildings_soulcaster || 0;
    gameState.buildings.shelter = serverData.buildings_shelter || 0;
    gameState.buildings.spy_network = serverData.buildings_spy_network || 0;
    gameState.buildings.research_library = serverData.buildings_research_library || 0;
    gameState.buildings.stormshelter = serverData.buildings_stormshelter || 0;
    gameState.buildings.whisper_tower = serverData.buildings_whisper_tower || 0;

    return gameState;
  } catch (error) {
    console.error('Enrich game state with server land error:', error);
    return gameState; // Return unmodified state on error
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
        buildings_monastery,
        buildings_soulcaster,
        buildings_spy_network,
        buildings_research_library,
        buildings_stormshelter,
        buildings_whisper_tower,
        game_data,
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
 * Sabotage: Deduct resources from target player
 */
async function sabotagePlayer(targetUsername, resourceType, amount) {
  try {
    let updateQuery;
    if (resourceType === 'spheres') {
      updateQuery = `UPDATE players 
                     SET spheres = GREATEST(0, spheres - $1),
                         last_save_time = CURRENT_TIMESTAMP
                     WHERE username = $2
                     RETURNING spheres`;
    } else if (resourceType === 'gemhearts') {
      updateQuery = `UPDATE players 
                     SET gemhearts = GREATEST(0, gemhearts - $1),
                         last_save_time = CURRENT_TIMESTAMP
                     WHERE username = $2
                     RETURNING gemhearts`;
    } else {
      return { success: false, message: 'Invalid resource type' };
    }

    const result = await pool.query(updateQuery, [amount, targetUsername]);
    
    if (result.rows.length === 0) {
      return { success: false, message: 'Target player not found' };
    }

    return { 
      success: true, 
      message: `Successfully sabotaged ${targetUsername}`,
      remaining: result.rows[0][resourceType]
    };
  } catch (error) {
    console.error('Error sabotaging player:', error);
    return { success: false, message: 'Database error during sabotage' };
  }
}

const BUILDING_LAND_COSTS = {
  market: 1,
  training_camp: 1,
  shelter: 1,
  soulcaster: 2,
  stormshelter: 2,
  monastery: 3,
  research_library: 3,
  whisper_tower: 3,
  spy_network: 2
};

function normalizeGameStateFromRow(row) {
  const gameState = (row.game_data && typeof row.game_data === 'object') ? { ...row.game_data } : {};
  const buildings = {
    market: gameState.buildings?.market ?? row.buildings_market ?? 0,
    training_camp: gameState.buildings?.training_camp ?? row.buildings_training_camp ?? 0,
    shelter: gameState.buildings?.shelter ?? row.buildings_shelter ?? 0,
    monastery: gameState.buildings?.monastery ?? row.buildings_monastery ?? 0,
    soulcaster: gameState.buildings?.soulcaster ?? row.buildings_soulcaster ?? 0,
    spy_network: gameState.buildings?.spy_network ?? row.buildings_spy_network ?? 0,
    research_library: gameState.buildings?.research_library ?? row.buildings_research_library ?? 0,
    stormshelter: gameState.buildings?.stormshelter ?? row.buildings_stormshelter ?? 0,
    whisper_tower: gameState.buildings?.whisper_tower ?? row.buildings_whisper_tower ?? 0
  };

  gameState.buildings = buildings;
  gameState.maxLand = Number.isFinite(gameState.maxLand) ? gameState.maxLand : 25;
  return gameState;
}

function calculateLandUsed(buildings) {
  return Object.entries(BUILDING_LAND_COSTS).reduce((total, [building, landCost]) => {
    return total + ((buildings[building] || 0) * landCost);
  }, 0);
}

function trimBuildingsToMaxLand(buildings, targetMaxLand) {
  const destroyedCounts = {};
  const updated = { ...buildings };

  const trimOrder = [
    ['market', 'soulcaster'],
    ['stormshelter'],
    ['monastery', 'training_camp'],
    ['research_library'],
    ['whisper_tower'],
    ['spy_network'],
    ['shelter']
  ];

  let usedLand = calculateLandUsed(updated);
  if (usedLand <= targetMaxLand) {
    return { updatedBuildings: updated, buildingsDestroyed: [] };
  }

  for (const tier of trimOrder) {
    while (usedLand > targetMaxLand) {
      let removedInPass = false;
      const tierOrder = [...tier].sort(() => Math.random() - 0.5);

      for (const building of tierOrder) {
        while ((updated[building] || 0) > 0 && usedLand > targetMaxLand) {
          updated[building] -= 1;
          usedLand -= (BUILDING_LAND_COSTS[building] || 0);
          destroyedCounts[building] = (destroyedCounts[building] || 0) + 1;
          removedInPass = true;
        }
      }

      if (!removedInPass) break;
    }

    if (usedLand <= targetMaxLand) break;
  }

  const buildingsDestroyed = Object.entries(destroyedCounts).map(([building, count]) => ({ building, count }));
  return { updatedBuildings: updated, buildingsDestroyed };
}

async function transferConquestLand(attackerUsername, targetUsername, requestedLand) {
  const transferAmount = parseInt(requestedLand, 10);
  if (!Number.isInteger(transferAmount) || transferAmount <= 0) {
    return { success: false, message: 'Requested land must be a positive integer' };
  }

  if (attackerUsername === targetUsername) {
    return { success: false, message: 'Cannot conquer land from yourself' };
  }

  console.log(`🗡️  [transferConquestLand] Attacker: ${attackerUsername}, Target: ${targetUsername}, RequestedLand: ${requestedLand}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lockedPlayers = await client.query(
      `SELECT
         id,
         username,
         game_data,
         buildings_market,
         buildings_training_camp,
         buildings_monastery,
         buildings_soulcaster,
         buildings_shelter,
         buildings_spy_network,
         buildings_research_library,
         buildings_stormshelter,
         buildings_whisper_tower
       FROM players
       WHERE username = $1 OR username = $2
       FOR UPDATE`,
      [attackerUsername, targetUsername]
    );

    if (lockedPlayers.rows.length !== 2) {
      await client.query('ROLLBACK');
      console.log(`❌ Players not found (found ${lockedPlayers.rows.length}/2)`);
      return { success: false, message: 'Attacker or target not found' };
    }

    const attackerRow = lockedPlayers.rows.find(p => p.username === attackerUsername);
    const targetRow = lockedPlayers.rows.find(p => p.username === targetUsername);

    if (!attackerRow || !targetRow) {
      await client.query('ROLLBACK');
      console.log(`❌ Attacker or target missing after lookup`);
      return { success: false, message: 'Attacker or target not found' };
    }

    const attackerState = normalizeGameStateFromRow(attackerRow);
    const targetState = normalizeGameStateFromRow(targetRow);

    const targetMaxLand = Math.max(0, Math.floor(targetState.maxLand || 0));
    const actualLandTransferred = Math.min(transferAmount, targetMaxLand);

    console.log(`   TargetMaxLand: ${targetMaxLand}, ActualTransferred: ${actualLandTransferred}`);

    if (actualLandTransferred <= 0) {
      await client.query('ROLLBACK');
      console.log(`❌ No land available (target has 0 land or requestedLand is 0)`);
      return {
        success: false,
        message: `${targetUsername} has no land left to conquer`,
        actualLandTransferred: 0
      };
    }

    const newTargetMaxLand = targetMaxLand - actualLandTransferred;
    const { updatedBuildings, buildingsDestroyed } = trimBuildingsToMaxLand(targetState.buildings, newTargetMaxLand);

    targetState.maxLand = newTargetMaxLand;
    targetState.buildings = updatedBuildings;

    attackerState.maxLand = Math.max(0, Math.floor(attackerState.maxLand || 0) + actualLandTransferred);

    await client.query(
      `UPDATE players
       SET game_data = $1,
           last_save_time = CURRENT_TIMESTAMP
       WHERE username = $2`,
      [JSON.stringify(attackerState), attackerUsername]
    );

    await client.query(
      `UPDATE players
       SET game_data = $1,
           buildings_market = $2,
           buildings_training_camp = $3,
           buildings_monastery = $4,
           buildings_soulcaster = $5,
           buildings_shelter = $6,
           buildings_spy_network = $7,
           buildings_research_library = $8,
           buildings_stormshelter = $9,
           buildings_whisper_tower = $10,
           last_save_time = CURRENT_TIMESTAMP
       WHERE username = $11`,
      [
        JSON.stringify(targetState),
        updatedBuildings.market || 0,
        updatedBuildings.training_camp || 0,
        updatedBuildings.monastery || 0,
        updatedBuildings.soulcaster || 0,
        updatedBuildings.shelter || 0,
        updatedBuildings.spy_network || 0,
        updatedBuildings.research_library || 0,
        updatedBuildings.stormshelter || 0,
        updatedBuildings.whisper_tower || 0,
        targetUsername
      ]
    );

    await client.query('COMMIT');

    const attackRecord = {
      attackerUsername,
      landLost: actualLandTransferred,
      buildingsDestroyed,
      timestamp: new Date().toISOString()
    };

    targetState.attacksReceived = targetState.attacksReceived || [];
    targetState.attacksReceived.push(attackRecord);
    if (targetState.attacksReceived.length > 20) {
      targetState.attacksReceived.shift();
    }

    await pool.query(
      `UPDATE players SET game_data = $1 WHERE username = $2`,
      [JSON.stringify(targetState), targetUsername]
    );

    console.log(`✅ Conquest transfer successful: ${actualLandTransferred} land to ${attackerUsername}. Notification sent to ${targetUsername}.`);
    return {
      success: true,
      actualLandTransferred,
      attackerNewMaxLand: attackerState.maxLand,
      targetNewMaxLand: newTargetMaxLand,
      buildingsDestroyed
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error transferring conquest land:', error);
    return { success: false, message: 'Database error during conquest land transfer' };
  } finally {
    client.release();
  }
}

/**
 * Send a message from one player to another
 */
async function sendPlayerMessage(senderId, recipientUsername, messageText) {
  try {
    // Get recipient player
    const recipientResult = await pool.query(
      'SELECT id FROM players WHERE username = $1',
      [recipientUsername]
    );
    
    if (recipientResult.rows.length === 0) {
      return { success: false, error: 'Recipient not found' };
    }
    
    const recipientId = recipientResult.rows[0].id;
    
    // Check if trying to message self
    if (senderId === recipientId) {
      return { success: false, error: 'Cannot send message to yourself' };
    }
    
    // Insert message
    const result = await pool.query(
      `INSERT INTO player_messages (sender_id, recipient_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, sent_at`,
      [senderId, recipientId, messageText]
    );
    
    return {
      success: true,
      messageId: result.rows[0].id,
      sentAt: result.rows[0].sent_at
    };
  } catch (error) {
    console.error('Send message error:', error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * Get inbox messages for a player
 */
async function getPlayerInbox(playerId, limit = 50) {
  try {
    const result = await pool.query(
      `SELECT 
        m.id,
        m.message,
        m.read,
        m.sent_at,
        p.username as sender_username
       FROM player_messages m
       JOIN players p ON m.sender_id = p.id
       WHERE m.recipient_id = $1
       ORDER BY m.sent_at DESC
       LIMIT $2`,
      [playerId, limit]
    );
    
    return { success: true, messages: result.rows };
  } catch (error) {
    console.error('Get inbox error:', error);
    return { success: false, error: 'Failed to retrieve messages' };
  }
}

/**
 * Get conversation between two users
 */
async function getConversation(playerId, otherUsername, limit = 50) {
  try {
    // Get other player ID
    const otherPlayerResult = await pool.query(
      'SELECT id FROM players WHERE username = $1',
      [otherUsername]
    );
    
    if (otherPlayerResult.rows.length === 0) {
      return { success: false, error: 'Player not found' };
    }
    
    const otherPlayerId = otherPlayerResult.rows[0].id;
    
    // Get conversation messages
    const result = await pool.query(
      `SELECT 
        m.id,
        m.message,
        m.read,
        m.sent_at,
        m.sender_id = $1 as is_mine,
        CASE 
          WHEN m.sender_id = $1 THEN p2.username
          ELSE p1.username
        END as other_username
       FROM player_messages m
       LEFT JOIN players p1 ON m.sender_id = p1.id
       LEFT JOIN players p2 ON m.recipient_id = p2.id
       WHERE (m.sender_id = $1 AND m.recipient_id = $2)
          OR (m.sender_id = $2 AND m.recipient_id = $1)
         ORDER BY m.sent_at DESC
         LIMIT $3`,
      [playerId, otherPlayerId, limit]
    );
    
    return { success: true, messages: result.rows, otherUsername };
  } catch (error) {
    console.error('Get conversation error:', error);
    return { success: false, error: 'Failed to retrieve conversation' };
  }
}

/**
 * Mark messages as read
 */
async function markMessagesAsRead(playerId, messageIds) {
  try {
    await pool.query(
      `UPDATE player_messages 
       SET read = TRUE 
       WHERE recipient_id = $1 AND id = ANY($2::int[])`,
      [playerId, messageIds]
    );
    
    return { success: true };
  } catch (error) {
    console.error('Mark messages read error:', error);
    return { success: false, error: 'Failed to mark messages as read' };
  }
}

/**
 * Get unread message count
 */
async function getUnreadMessageCount(playerId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as unread_count
       FROM player_messages
       WHERE recipient_id = $1 AND read = FALSE`,
      [playerId]
    );
    
    return { success: true, count: parseInt(result.rows[0].unread_count, 10) };
  } catch (error) {
    console.error('Get unread count error:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Spawn a new plateau run
 */
async function spawnPlateauRun(enemyPower, gameYear) {
  try {
    const now = Date.now();
    const warningDuration = 5 * 60 * 1000; // 5 minutes
    const musterDuration = 60 * 60 * 1000; // 60 minutes
    const departedDuration = 60 * 60 * 1000; // 1 game day = 1 hour real time (24x multiplier)
    
    const warningEnd = now + warningDuration;
    const musterStart = warningEnd;
    const musterEnd = musterStart + musterDuration;
    const departedStart = musterEnd;
    const departedEnd = departedStart + departedDuration;
    
    const result = await pool.query(
      `INSERT INTO plateau_runs 
       (phase, warning_start_time, warning_end_time, muster_start_time, muster_end_time, 
        departed_start_time, departed_end_time, enemy_power, game_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        'WARNING',
        now,
        warningEnd,
        musterStart,
        musterEnd,
        departedStart,
        departedEnd,
        enemyPower,
        gameYear
      ]
    );
    
    return { success: true, run: result.rows[0] };
  } catch (error) {
    console.error('Spawn plateau run error:', error);
    return { success: false, error: 'Failed to spawn plateau run' };
  }
}

/**
 * Get active plateau run
 */
async function getActivePlateauRun() {
  try {
    const result = await pool.query(
      `SELECT * FROM plateau_runs 
       WHERE resolved = FALSE 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return { success: true, run: null };
    }
    
    // Get participants for this run
    const participants = await pool.query(
      `SELECT pp.*, p.username 
       FROM plateau_participants pp
       JOIN players p ON pp.player_id = p.id
       WHERE pp.run_id = $1
       ORDER BY pp.speed DESC`,
      [result.rows[0].id]
    );
    
    return { 
      success: true, 
      run: result.rows[0],
      participants: participants.rows
    };
  } catch (error) {
    console.error('Get active plateau run error:', error);
    return { success: false, error: 'Failed to get active run' };
  }
}

/**
 * Join plateau run
 */
async function joinPlateauRun(runId, playerId, militarySnapshot, power, speed, carry, bridgemen, chulls, signupIndex) {
  try {
    // Check if player already joined
    const existing = await pool.query(
      'SELECT id FROM plateau_participants WHERE run_id = $1 AND player_id = $2',
      [runId, playerId]
    );
    
    if (existing.rows.length > 0) {
      return { success: false, error: 'Already joined this run' };
    }
    
    const result = await pool.query(
      `INSERT INTO plateau_participants 
       (run_id, player_id, signup_time, signup_index, power, speed, carry, bridgemen, chulls, military_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        runId,
        playerId,
        Date.now(),
        signupIndex,
        power,
        speed,
        carry,
        bridgemen,
        chulls,
        JSON.stringify(militarySnapshot)
      ]
    );
    
    return { success: true, participant: result.rows[0] };
  } catch (error) {
    console.error('Join plateau run error:', error);
    return { success: false, error: 'Failed to join run' };
  }
}

/**
 * Resolve plateau run
 */
async function resolvePlateauRun(runId) {
  try {
    // Get run and all participants
    const run = await pool.query('SELECT * FROM plateau_runs WHERE id = $1', [runId]);
    if (run.rows.length === 0) {
      return { success: false, error: 'Run not found' };
    }
    
    const participants = await pool.query(
      `SELECT pp.*, p.username 
       FROM plateau_participants pp
       JOIN players p ON pp.player_id = p.id
       WHERE pp.run_id = $1
       ORDER BY pp.speed DESC`,
      [runId]
    );
    
    // Calculate total allied power
    const totalPower = participants.rows.reduce((sum, p) => sum + p.power, 0);
    const victory = totalPower >= run.rows[0].enemy_power;
    
    // Determine gemheart winner (highest speed)
    const gemheartWinner = victory && participants.rows.length > 0 ? participants.rows[0] : null;
    
    // Calculate loot shares
    const totalCarry = participants.rows.reduce((sum, p) => sum + p.carry, 0);
    
    // Update participants with rewards
    for (const participant of participants.rows) {
      let lootShare = 0;
      let gemheartWon = false;
      
      if (victory) {
        if (gemheartWinner && participant.player_id === gemheartWinner.player_id) {
          lootShare = 10000;
          gemheartWon = true;
        } else {
          // Share 100,000 spheres based on carry
          const playerShare = totalCarry > 0 ? (participant.carry / totalCarry) * 100000 : 1000;
          lootShare = Math.floor(playerShare);
        }
      }
      
      await pool.query(
        `UPDATE plateau_participants 
         SET loot_share = $1, gemheart_won = $2
         WHERE id = $3`,
        [lootShare, gemheartWon, participant.id]
      );
      
      // Award gems to winner
      if (gemheartWon) {
        await pool.query(
          'UPDATE players SET gemhearts = gemhearts + 1 WHERE id = $1',
          [participant.player_id]
        );
      }
      
      // Award spheres to all participants
      if (lootShare > 0) {
        await pool.query(
          'UPDATE players SET spheres = spheres + $1 WHERE id = $2',
          [lootShare, participant.player_id]
        );
      }
    }
    
    // Mark run as resolved
    await pool.query(
      `UPDATE plateau_runs 
       SET resolved = TRUE, victory = $1, gemheart_winner_id = $2
       WHERE id = $3`,
      [victory, gemheartWinner ? gemheartWinner.player_id : null, runId]
    );
    
    return { 
      success: true, 
      victory,
      totalPower,
      enemyPower: run.rows[0].enemy_power,
      gemheartWinner: gemheartWinner ? gemheartWinner.username : null,
      participants: participants.rows.map(p => ({
        username: p.username,
        lootShare: p.loot_share,
        gemheartWon: p.gemheart_won
      }))
    };
  } catch (error) {
    console.error('Resolve plateau run error:', error);
    return { success: false, error: 'Failed to resolve run' };
  }
}

/**
 * Update plateau run phase
 */
async function updatePlateauRunPhase(runId, phase) {
  try {
    await pool.query(
      'UPDATE plateau_runs SET phase = $1 WHERE id = $2',
      [phase, runId]
    );
    return { success: true };
  } catch (error) {
    console.error('Update plateau phase error:', error);
    return { success: false };
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
  enrichGameStateWithServerLand,
  searchPlayers,
  getRankings,
  sabotagePlayer,
  transferConquestLand,
  sendPlayerMessage,
  getPlayerInbox,
  getConversation,
  markMessagesAsRead,
  getUnreadMessageCount,
  spawnPlateauRun,
  getActivePlateauRun,
  joinPlateauRun,
  resolvePlateauRun,
  updatePlateauRunPhase,
  closePool
};
