const { getConnection } = require('../db');
const { hashPassword } = require('../utils/auth');

async function initTables() {
  const conn = await getConnection();

  try {
    await conn.query(`CREATE SCHEMA IF NOT EXISTS custom;`);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS custom.app_user (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        is_admin CHAR(1),
        password_reset_required CHAR(1),
        gender TEXT,
        weight NUMERIC,
        weight_unit TEXT,
        height NUMERIC,
        height_unit TEXT,
        date_of_birth DATE,
        goal TEXT,
        created_date TIMESTAMP DEFAULT NOW(),
        modified_date TIMESTAMP DEFAULT NOW()
      );
    `);

    await conn.query(`ALTER TABLE custom.app_user ADD COLUMN IF NOT EXISTS weight_unit TEXT;`);
    await conn.query(`ALTER TABLE custom.app_user ADD COLUMN IF NOT EXISTS height_unit TEXT;`);
    await conn.query(`ALTER TABLE custom.app_user ADD COLUMN IF NOT EXISTS activity_level TEXT;`);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS custom.food_catalog (
        food_id SERIAL PRIMARY KEY,
        food_name TEXT,
        measurement_type TEXT,
        serving_size NUMERIC,
        serving_size_unit TEXT,
        calories_per_serving NUMERIC,
        protein_per_serving NUMERIC,
        carbs_per_serving NUMERIC,
        fat_per_serving NUMERIC,
        notes TEXT,
        created_date TIMESTAMP DEFAULT NOW(),
        modified_date TIMESTAMP DEFAULT NOW()
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS custom.meal_log (
        meal_log_id SERIAL PRIMARY KEY,
        food_id INT,
        food_name TEXT,
        track_date DATE,
        meal_name TEXT,
        quantity NUMERIC,
        unit TEXT,
        calories NUMERIC,
        protein NUMERIC,
        carbs NUMERIC,
        fat NUMERIC,
        notes TEXT,
        user_id TEXT,
        created_date TIMESTAMP DEFAULT NOW(),
        modified_date TIMESTAMP DEFAULT NOW()
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS custom.activity_levels (
        value TEXT PRIMARY KEY,
        display_text TEXT NOT NULL,
        multiplier NUMERIC NOT NULL
      );
    `);

    console.log('Tables initialized');
  } finally {
    conn.release();
  }
}

async function seedData() {
  const conn = await getConnection();

  try {
    const result = await conn.query(`SELECT * FROM custom.app_user WHERE email=$1`, ['admin']);

    if (result.rows.length === 0) {
      const hashPass = hashPassword('manager');
      await conn.query(
        `INSERT INTO custom.app_user
          (user_id, email, password_hash, is_admin, created_date, modified_date)
         VALUES ($1,$2,$3,$4,NOW(),NOW())`,
        ['admin', 'admin', hashPass, 'Y']
      );
      console.log('Admin user created');
    }

    await conn.query(
      `INSERT INTO custom.activity_levels (value, display_text, multiplier)
         VALUES
           ('sedentary', 'Sedentary (little or no exercise)', 1.2),
           ('light', 'Lightly Active (exercise 1–3 days/week)', 1.375),
           ('moderate', 'Moderately Active (exercise 3–5 days/week)', 1.55),
           ('active', 'Very Active (exercise 6–7 days/week)', 1.725),
           ('athlete', 'Athlete / Extremely Active (intense training twice daily or physical job)', 1.9)
         ON CONFLICT (value) DO NOTHING;
      `
    );
  } finally {
    conn.release();
  }
}

module.exports = {
  initTables,
  seedData
};
