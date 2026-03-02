require('dotenv').config();
const { Pool } = require('pg');

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
      
      console.log(`Player: ${player.username} (Day ${player.day_count})`);
      console.log(`  DB Columns Total: ${player.total_buildings_columns} buildings`);
      console.log(`  game_data.buildings Total: ${gdBuildingTotal} buildings`);
      console.log(`  game_data.land: ${gdLand}`);
      console.log(`  game_data.maxLand: ${gdMaxLand}`);
      console.log(`  Available land: ${gdMaxLand - gdLand}`);
      
      if (player.total_buildings_columns !== gdBuildingTotal) {
        console.log(`  ⚠️  MISMATCH: DB columns (${player.total_buildings_columns}) != game_data (${gdBuildingTotal})`);
      }
      
      if (gdLand !== gdBuildingTotal) {
        console.log(`  ⚠️  LAND DESYNC: land=${gdLand} but buildings=${gdBuildingTotal} (diff: ${gdLand - gdBuildingTotal})`);
      }
      
      console.log('');
    });
    
    console.log('\n=== Issue Summary ===');
    console.log('If land > buildings: Ghost land (occupied but no buildings)');
    console.log('If land < buildings: Buildings not counting as land (should be impossible)');
    console.log('If DB columns != game_data: Data corruption between save systems');
    
  } finally {
    await pool.end();
  }
}

checkLandMismatch().catch(console.error);
