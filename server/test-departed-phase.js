// Test script to manually spawn a plateau run with short durations for testing
// Run this with: node test-departed-phase.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testSpawnRun() {
  try {
    const now = Date.now();
    const warningDuration = 10 * 1000; // 10 seconds for testing
    const musterDuration = 20 * 1000; // 20 seconds for testing
    const departedDuration = 30 * 1000; // 30 seconds for testing (simulates 1 day travel)
    
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
        500, // enemy power
        1 // game year
      ]
    );
    
    console.log('✅ Test plateau run spawned successfully!');
    console.log(JSON.stringify(result.rows[0], null, 2));
    console.log('\n📅 Timeline:');
    console.log(`  WARNING phase:  10 seconds`);
    console.log(`  MUSTER phase:   20 seconds`);
    console.log(`  DEPARTED phase: 30 seconds`);
    console.log(`  Total duration: 60 seconds`);
    console.log('\n🔍 Watch the server console for phase transitions!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSpawnRun();
