require('dotenv').config();
const { Pool } = require('pg');

async function checkRhettoricLand() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(
      `SELECT username, game_data, 
              buildings_market, buildings_training_camp, buildings_shelter,
              buildings_monastery, buildings_soulcaster, buildings_spy_network,
              buildings_research_library, buildings_stormshelter, buildings_whisper_tower
       FROM players WHERE username = 'Rhettoric'`
    );
    
    if (result.rows.length > 0) {
      const player = result.rows[0];
      console.log('=== Rhettoric Data ===');
      console.log('Buildings from DB columns:');
      console.log('  market:', player.buildings_market);
      console.log('  training_camp:', player.buildings_training_camp);
      console.log('  shelter:', player.buildings_shelter);
      console.log('  monastery:', player.buildings_monastery);
      console.log('  soulcaster:', player.buildings_soulcaster);
      console.log('  spy_network:', player.buildings_spy_network);
      console.log('  research_library:', player.buildings_research_library);
      console.log('  stormshelter:', player.buildings_stormshelter);
      console.log('  whisper_tower:', player.buildings_whisper_tower);
      console.log('\ngame_data JSONB:');
      console.log(JSON.stringify(player.game_data, null, 2));
    } else {
      console.log('Player not found');
    }
  } finally {
    await pool.end();
  }
}

checkRhettoricLand().catch(console.error);
