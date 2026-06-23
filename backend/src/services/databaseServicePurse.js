const { getConnection } = require('../db');
const { hashPassword } = require('../utils/authPurse');

async function initTables() {
  const conn = await getConnection();

  try {
    await conn.query(`CREATE SCHEMA IF NOT EXISTS custom;`);

    await conn.query(`
      CREATE TABLE custom.purse_users (
          user_id         BIGINT GENERATED ALWAYS AS IDENTITY,
          first_name      VARCHAR(100) NOT NULL,
          last_name       VARCHAR(100),
          email           VARCHAR(255) NOT NULL,
          password_hash   VARCHAR(500) NOT NULL,
          mobile_number   VARCHAR(20),
          status          VARCHAR(20) DEFAULT 'ACTIVE',
          created_date    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_date    TIMESTAMP,

          CONSTRAINT pk_users
              PRIMARY KEY (user_id),

          CONSTRAINT uk_users_email
              UNIQUE (email)
      );
    `);

    console.log('Tables initialized');
  } finally {
    conn.release();
  }
}

module.exports = {
  initTables
};
