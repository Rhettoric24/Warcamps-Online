require('dotenv').config();
const { Pool } = require('pg');

async function inspectBuildings() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(`
      SELECT 
        username, 
        spheres, 
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
         buildings_research_library + buildings_stormshelter + buildings_whisper_tower) as total_buildings,
        game_data
      FROM players 
      WHERE username IN ('Rhettoric', 'seed_alpha', 'seed_bravo')
      ORDER BY username
    `);
    
    console.log('=== Buildings Inspection ===\n');
    result.rows.forEach(player => {
      console.log(`Player: ${player.username}`);
      console.log(`  Spheres: ${player.spheres}`);
      console.log(`  Day: ${player.day_count}`);
      console.log(`  Total Buildings (DB columns): ${player.total_buildings}`);
      console.log(`  Buildings breakdown:`);
      console.log(`    - Markets: ${player.buildings_market}`);
      console.log(`    - Training Camps: ${player.buildings_training_camp}`);
      console.log(`    - Shelters: ${player.buildings_shelter}`);
      console.log(`    - Monasteries: ${player.buildings_monastery}`);
      console.log(`    - Soulcasters: ${player.buildings_soulcaster}`);
      console.log(`    - Spy Networks: ${player.buildings_spy_network}`);
      console.log(`    - Research Libraries: ${player.buildings_research_library}`);
      console.log(`    - Stormshelters: ${player.buildings_stormshelter}`);
      console.log(`    - Whisper Towers: ${player.buildings_whisper_tower}`);
      
      if (player.game_data && player.game_data.buildings) {
        const gdBuildings = player.game_data.buildings;
        const gdTotal = Object.values(gdBuildings).reduce((sum, val) => sum + (val || 0), 0);
        console.log(`  Total Buildings (game_data JSONB): ${gdTotal}`);
        console.log(`  game_data.buildings:`, JSON.stringify(gdBuildings));
      } else {
        console.log(`  game_data.buildings: NOT SET`);
      }
      
      if (player.game_data && player.game_data.land !== undefined) {
        console.log(`  Land used (game_data): ${player.game_data.land}`);
      }
      
      console.log('');
    });
  } finally {
    await pool.end();
  }
}

inspectBuildings().catch(console.error);
