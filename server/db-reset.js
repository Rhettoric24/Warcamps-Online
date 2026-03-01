// Database Reset Script
// Clears all test data from the database

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetDatabase() {
    try {
        console.log('🔄 Connecting to database...');
        
        // Option 1: Delete all players (keeps table structure)
        const result = await pool.query('DELETE FROM players');
        console.log(`✅ Deleted ${result.rowCount} player records`);
        
        // Reset the ID sequence so next player starts at 1
        await pool.query('ALTER SEQUENCE players_id_seq RESTART WITH 1');
        console.log('✅ Reset player ID sequence to 1');
        
        console.log('\n✨ Database reset complete! Ready for launch.');
        
    } catch (error) {
        console.error('❌ Error resetting database:', error.message);
    } finally {
        await pool.end();
    }
}

resetDatabase();
