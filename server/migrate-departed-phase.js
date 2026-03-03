// Migration script to add DEPARTED phase columns to plateau_runs table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('🔧 Adding DEPARTED phase columns to plateau_runs table...');
    
    // Add departed_start_time column if it doesn't exist
    await pool.query(`
      ALTER TABLE plateau_runs 
      ADD COLUMN IF NOT EXISTS departed_start_time BIGINT
    `);
    
    // Add departed_end_time column if it doesn't exist
    await pool.query(`
      ALTER TABLE plateau_runs 
      ADD COLUMN IF NOT EXISTS departed_end_time BIGINT
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - departed_start_time column added');
    console.log('   - departed_end_time column added');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
