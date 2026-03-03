// Database Seed Script
// Populates the database with test accounts

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const TEST_ACCOUNTS = [
    { username: 'testy1', password: 'test123' },
    { username: 'testy2', password: 'test123' },
    { username: 'alice', password: 'test123' },
    { username: 'bob', password: 'test123' }
];

async function seedDatabase() {
    try {
        console.log('🌱 Seeding database with test accounts...\n');
        
        for (const account of TEST_ACCOUNTS) {
            // Check if user already exists
            const existing = await pool.query(
                'SELECT username FROM players WHERE username = $1',
                [account.username]
            );
            
            if (existing.rows.length > 0) {
                console.log(`⏭️  ${account.username} already exists, skipping...`);
                continue;
            }
            
            // Hash password and create account
            const hashedPassword = await bcrypt.hash(account.password, 10);
            await pool.query(
                `INSERT INTO players (username, password_hash, created_at) 
                 VALUES ($1, $2, NOW())`,
                [account.username, hashedPassword]
            );
            
            console.log(`✅ Created account: ${account.username}`);
        }
        
        console.log('\n✨ Database seeding complete!');
        console.log('📝 Test accounts use password: test123\n');
        
    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
    } finally {
        await pool.end();
    }
}

seedDatabase();
