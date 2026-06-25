const { getConnection } = require('../db');
const { hashPassword } = require('../utils/authPurse');

async function initTablesPurse() {
  const conn = await getConnection();

  try {
    await conn.query(`CREATE SCHEMA IF NOT EXISTS custom;`);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS custom.purse_users (
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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS custom.user_tpin (
        tpin_id                 BIGINT GENERATED ALWAYS AS IDENTITY,
        user_id                 BIGINT NOT NULL,
        tpin_hash               VARCHAR(500) NOT NULL,
        tpin_status             VARCHAR(20) DEFAULT 'ACTIVE',
        failed_attempts         INTEGER DEFAULT 0,
        is_locked               BOOLEAN DEFAULT FALSE,
        locked_until            TIMESTAMP,
        created_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_date            TIMESTAMP,
        CONSTRAINT pk_user_tpin PRIMARY KEY (tpin_id),
        CONSTRAINT uk_user_tpin_user UNIQUE (user_id),
        CONSTRAINT fk_user_tpin_user FOREIGN KEY (user_id) REFERENCES custom.purse_users(user_id)
      );
    `);

    console.log('Tables initialized');
  } finally {
    conn.release();
  }
}

module.exports = {
  initTablesPurse
};
