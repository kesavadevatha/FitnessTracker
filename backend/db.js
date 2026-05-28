const oracledb = require('oracledb');

const dbConfig = {
    user: 'system',
    password: 'manager',
    connectString: '192.168.1.82:1521/TNDDB'
};

async function getConnection() {
    try {
        const connection = await oracledb.getConnection(dbConfig);
        console.log('Connected to Oracle DB');
        return connection;
    } catch (err) {
        console.error('DB Connection Error:', err);
    }
}

module.exports = { getConnection };