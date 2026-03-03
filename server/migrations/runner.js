/**
 * Database migration runner
 * Automatically runs pending migrations on server startup
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = __dirname;

/**
 * Initialize migrations tracking table
 */
async function initializeMigrationsTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('Error creating schema_migrations table:', error);
    throw error;
  }
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations(pool) {
  try {
    const result = await pool.query(
      'SELECT name FROM schema_migrations ORDER BY applied_at'
    );
    return result.rows.map(row => row.name);
  } catch (error) {
    console.error('Error fetching applied migrations:', error);
    return [];
  }
}

/**
 * Get list of available migrations from filesystem
 */
function getAvailableMigrations() {
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.match(/^\d+-.*\.js$/)) // Only numbered migration files
      .sort();
    return files.map(f => f.replace('.js', ''));
  } catch (error) {
    console.error('Error reading migrations directory:', error);
    return [];
  }
}

/**
 * Load a migration module
 */
function loadMigration(name) {
  try {
    const migrationPath = path.join(MIGRATIONS_DIR, `${name}.js`);
    delete require.cache[require.resolve(migrationPath)]; // Clear cache for fresh load
    return require(migrationPath);
  } catch (error) {
    console.error(`Error loading migration ${name}:`, error);
    return null;
  }
}

/**
 * Run pending migrations
 */
async function runMigrations(pool) {
  try {
    console.log('\n📦 Database Migration System');
    console.log('=' .repeat(50));
    
    // Initialize tracking table
    await initializeMigrationsTable(pool);
    
    // Get applied and available migrations
    const applied = await getAppliedMigrations(pool);
    const available = getAvailableMigrations();
    const pending = available.filter(m => !applied.includes(m));
    
    console.log(`   Applied: ${applied.length} | Pending: ${pending.length}`);
    
    if (pending.length === 0) {
      console.log('   ✅ All migrations applied, database is up to date\n');
      return true;
    }
    
    // Run pending migrations
    for (const migrationName of pending) {
      console.log(`\n   Running: ${migrationName}`);
      
      const migration = loadMigration(migrationName);
      if (!migration || !migration.up) {
        console.error(`   ❌ Invalid migration: ${migrationName}`);
        return false;
      }
      
      // Run the migration
      const success = await migration.up(pool);
      if (!success) {
        console.error(`   ❌ Migration failed: ${migrationName}`);
        return false;
      }
      
      // Record as applied
      await pool.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [migrationName]
      );
    }
    
    console.log('\n   ✅ All pending migrations completed successfully\n');
    return true;
  } catch (error) {
    console.error('Fatal migration error:', error);
    return false;
  }
}

module.exports = { runMigrations };
