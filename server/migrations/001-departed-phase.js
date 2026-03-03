/**
 * Migration: Add departed phase to plateau runs
 * Added: March 3, 2026
 * 
 * Adds two columns to plateau_runs table for 1-day travel mission phase:
 * - departed_start_time: when forces depart for the plateau
 * - departed_end_time: when forces return home (1 game day later)
 */

module.exports = {
  name: '001-departed-phase',
  
  async up(pool) {
    console.log('  🚀 Running migration: Add departed phase columns...');
    
    try {
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
      
      console.log('  ✅ Migration complete: departed_start_time and departed_end_time added');
      return true;
    } catch (error) {
      console.error('  ❌ Migration failed:', error.message);
      return false;
    }
  }
};
