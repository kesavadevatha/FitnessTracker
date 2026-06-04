const { getConnection } = require('../db');

async function getFoodCatalog(search = '', userEmail = null) {
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        SELECT DISTINCT fc.*
        FROM custom.food_catalog fc
        WHERE ($1 = '' OR LOWER(fc.food_name) LIKE LOWER('%' || $1 || '%'))
          AND (
            LOWER(fc.user_id) = LOWER('admin')
            OR LOWER(fc.user_id) = LOWER($2)
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
          notes,
          user_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
        foodData.notes,
        String(userEmail || 'admin').trim().toLowerCase()
      ]
    );

    return result.rows?.[0]?.food_id;
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
    let query = `
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
      WHERE fc.food_id = $1
    `;

    const params = [foodId];

    if (userEmail) {
      query += `
        AND (
          LOWER(fc.user_id) = LOWER('admin')
          OR LOWER(fc.user_id) = LOWER($2)
        )
      `;
      params.push(userEmail);
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
