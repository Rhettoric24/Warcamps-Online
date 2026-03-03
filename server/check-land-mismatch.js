require('dotenv').config();
const { Pool } = require('pg');

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

async function checkLandMismatch() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(`
      SELECT 
        username,
        day_count,
        buildings_market,
        buildings_training_camp,
        buildings_shelter,
        buildings_monastery,
        buildings_soulcaster,
        buildings_spy_network,
        buildings_research_library,
        buildings_stormshelter,
        buildings_whisper_tower,
        (buildings_market + buildings_training_camp + buildings_shelter + 
         buildings_monastery + buildings_soulcaster + buildings_spy_network + 
         buildings_research_library + buildings_stormshelter + buildings_whisper_tower) as total_buildings_columns,
        game_data
      FROM players 
      WHERE username IN ('Rhettoric', 'seed_alpha', 'seed_bravo')
      ORDER BY username
    `);
    
    console.log('=== Land & Buildings Mismatch Check ===\n');
    
    result.rows.forEach(player => {
      const gdBuildings = player.game_data?.buildings || {};
      const gdLand = player.game_data?.land || 0;
      const gdMaxLand = player.game_data?.maxLand || 25;
      
      const gdBuildingTotal = Object.values(gdBuildings).reduce((sum, val) => sum + (val || 0), 0);
      
      // Calculate correct land usage from buildings
      const correctLandUsage = Object.entries(gdBuildings).reduce((total, [building, qty]) => {
        return total + (qty || 0) * (BUILDING_LAND_COSTS[building] || 0);
      }, 0);
      
      console.log(`Player: ${player.username} (Day ${player.day_count})`);
      console.log(`  DB Columns Total: ${player.total_buildings_columns} buildings`);
      console.log(`  game_data.buildings Total: ${gdBuildingTotal} buildings`);
      console.log(`  game_data.land: ${gdLand}`);
      console.log(`  Calculated land usage: ${correctLandUsage}`);
      console.log(`  game_data.maxLand: ${gdMaxLand}`);
      console.log(`  Available land: ${gdMaxLand - correctLandUsage}`);
      
      if (player.total_buildings_columns !== gdBuildingTotal) {
        console.log(`  ⚠️  MISMATCH: DB columns (${player.total_buildings_columns}) != game_data (${gdBuildingTotal})`);
      }
      
      if (gdLand !== correctLandUsage) {
        console.log(`  ⚠️  LAND DESYNC: stored land=${gdLand} but calculated=${correctLandUsage} (diff: ${gdLand - correctLandUsage})`);
      }
      
      console.log('');
    });
    
    console.log('\n=== Issue Summary ===');
    console.log('If stored land != calculated: Land tracking out of sync with buildings');
    console.log('If DB columns != game_data: Data corruption between save systems');
    
  } finally {
    await pool.end();
  }
}

checkLandMismatch().catch(console.error);
