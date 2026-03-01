require('dotenv').config();
const { Pool } = require('pg');

async function inspectDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('Tables:', tables.rows.map((row) => row.table_name));

    const players = await pool.query('SELECT id, username, created_at, day_count, spheres, gemhearts FROM players ORDER BY id LIMIT 20');
    console.log('Players rows:', players.rows);
  } finally {
    await pool.end();
  }
}

inspectDb().catch((error) => {
  console.error('DB inspect failed:', error.message);
  process.exit(1);
});
