const { getConnection } = require('../db');

async function getFoodCatalog(search = '') {
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        SELECT DISTINCT fc.*
        FROM custom.food_catalog fc
        JOIN custom.food_catalog_used fcu ON fcu.food_id = fc.food_id
        LEFT JOIN custom.app_user au ON LOWER(au.email) = LOWER(fcu.user_email)
        WHERE ($1 = '' OR LOWER(fc.food_name) LIKE LOWER('%' || $1 || '%'))
          AND (
            LOWER(fcu.user_email) = LOWER($2)
            OR au.is_admin = 'Y'
          )
        ORDER BY fc.food_name
      `,
      [search, userEmail || '']
    );
    return result.rows;
  } finally {
    conn.release();
  }
}

async function addFood(foodData, userEmail) {
  const conn = await getConnection();

  try {
    await conn.query('BEGIN');

    const result = await conn.query(
      `
        INSERT INTO custom.food_catalog
        (
          food_name,
          measurement_type,
          serving_size,
          serving_size_unit,
          calories_per_serving,
          protein_per_serving,
          carbs_per_serving,
          fat_per_serving,
          notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING food_id
      `,
      [
        foodData.food_name,
        foodData.measurement_type,
        foodData.serving_size,
        foodData.serving_size_unit,
        foodData.calories_per_serving,
        foodData.protein_per_serving,
        foodData.carbs_per_serving,
        foodData.fat_per_serving,
        foodData.notes
      ]
    );

    const newId = result.rows?.[0]?.food_id;

    if (userEmail && newId) {
      await conn.query(
        `
          INSERT INTO custom.food_catalog_used (food_id, user_email)
          VALUES ($1, $2)
        `,
        [newId, String(userEmail).trim().toLowerCase()]
      );
    }

    await conn.query('COMMIT');
    return newId;
  } catch (err) {
    await conn.query('ROLLBACK');
    throw err;
  } finally {
    conn.release();
  }
}

async function updateFood(foodId, foodData) {
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        UPDATE custom.food_catalog
        SET
          food_name = $1,
          measurement_type = $2,
          serving_size = $3,
          serving_size_unit = $4,
          calories_per_serving = $5,
          protein_per_serving = $6,
          carbs_per_serving = $7,
          fat_per_serving = $8,
          notes = $9,
          modified_date = NOW()
        WHERE food_id = $10
      `,
      [
        String(foodData.food_name).trim(),
        String(foodData.measurement_type).toLowerCase(),
        Number(foodData.serving_size),
        String(foodData.serving_size_unit).toLowerCase(),
        Number(foodData.calories_per_serving || 0),
        Number(foodData.protein_per_serving || 0),
        Number(foodData.carbs_per_serving || 0),
        Number(foodData.fat_per_serving || 0),
        foodData.notes || null,
        foodId
      ]
    );

    return result.rowCount;
  } finally {
    conn.release();
  }
}

async function deleteFood(foodId) {
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        DELETE FROM custom.food_catalog
        WHERE food_id = $1
      `,
      [foodId]
    );
    return result.rowCount;
  } finally {
    conn.release();
  }
}

async function findFoodCatalogById(foodId, userEmail = null) {
  const conn = await getConnection();

  try {
    const baseSelect = `
      SELECT
        fc.food_id,
        fc.food_name,
        fc.measurement_type,
        fc.serving_size,
        fc.serving_size_unit,
        fc.calories_per_serving,
        fc.protein_per_serving,
        fc.carbs_per_serving,
        fc.fat_per_serving,
        fc.notes
      FROM custom.food_catalog fc
    `;

    let query;
    const params = [foodId];

    if (userEmail) {
      query = `${baseSelect}
        JOIN custom.food_catalog_used fcu ON fcu.food_id = fc.food_id
        LEFT JOIN custom.app_user au ON LOWER(au.email) = LOWER(fcu.user_email)
        WHERE fc.food_id = $1
          AND (LOWER(fcu.user_email) = LOWER($2) OR au.is_admin = 'Y')
      `;
      params.push(userEmail);
    } else {
      query = `${baseSelect}
        WHERE fc.food_id = $1
      `;
    }

    const result = await conn.query(query, params);

    return result.rows[0] || null;
  } finally {
    conn.release();
  }
}

module.exports = {
  getFoodCatalog,
  addFood,
  updateFood,
  deleteFood,
  findFoodCatalogById
};
