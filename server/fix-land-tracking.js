// Fix land tracking for all players
// Recalculates land usage based on actual building land costs

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const BUILDING_LAND_COSTS = {
  market: 1,
  soulcaster: 1,
  training_camp: 5,
  monastery: 5,
  shelter: 1,
  stormshelter: 4,
  spy_network: 2,
  research_library: 3,
  whisper_tower: 5
};

async function fixLandTracking() {
  try {
    console.log('🔧 Fixing land tracking for all players...\n');
    
    const result = await pool.query(`
      SELECT 
        id,
        username,
        buildings_market,
        buildings_training_camp,
        buildings_shelter,
        buildings_monastery,
        buildings_soulcaster,
        buildings_spy_network,
        buildings_research_library,
        buildings_stormshelter,
        buildings_whisper_tower,
        game_data
      FROM players
      ORDER BY username
    `);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const player of result.rows) {
      const buildings = {
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
      
      // Calculate correct land usage
      const correctLand = Object.entries(buildings).reduce((total, [building, qty]) => {
        return total + (qty || 0) * (BUILDING_LAND_COSTS[building] || 0);
      }, 0);
      
      const gameData = player.game_data || {};
      const currentLand = gameData.land || 0;
      
      if (currentLand !== correctLand) {
        console.log(`📝 ${player.username}:`);
        console.log(`   Old land: ${currentLand}, Correct land: ${correctLand}`);
        
        // Update game_data with correct land value
        gameData.land = correctLand;
        gameData.buildings = buildings;
        
        try {
          await pool.query(
            'UPDATE players SET game_data = $1 WHERE id = $2',
            [JSON.stringify(gameData), player.id]
          );
          
          // Verify the update
          const verify = await pool.query(
            'SELECT game_data FROM players WHERE id = $1',
            [player.id]
          );
          const updated = verify.rows[0]?.game_data?.land;
          console.log(`   ✅ Updated and verified: land is now ${updated}`);
          
          fixed++;
        } catch (error) {
          console.error(`   ❌ Failed to update ${player.username}:`, error.message);
        }
      } else {
        skipped++;
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} players`);
    console.log(`⏭️  Skipped ${skipped} players (already correct)`);
    
  } catch (error) {
    console.error('❌ Error fixing land tracking:', error);
  } finally {
    await pool.end();
  }
}

fixLandTracking();
