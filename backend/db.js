const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl:
        process.env.NODE_ENV === 'production'
            ? {
                  rejectUnauthorized: false
              }
            : false
});

/*
=====================================================
GET CONNECTION
=====================================================
Returns a PostgreSQL client connection
that supports:
- query()
- release()
=====================================================
*/

async function getConnection() {

    const client = await pool.connect();

    return client;
}

/*
=====================================================
OPTIONAL TEST
=====================================================
*/

pool.on('connect', () => {
    console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
    console.error('PostgreSQL Pool Error:', err);
});

module.exports = {
    getConnection,
    pool
};