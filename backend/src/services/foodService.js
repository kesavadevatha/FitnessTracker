const { getConnection } = require('../db');

async function getFoodCatalog(search = '') {
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        SELECT *
        FROM custom.food_catalog
        WHERE $1 = ''
          OR LOWER(food_name)
          LIKE LOWER('%' || $1 || '%')
        ORDER BY food_name
      `,
      [search]
    );
    return result.rows;
  } finally {
    conn.release();
  }
}

async function addFood(foodData) {
  const conn = await getConnection();

  try {
    await conn.query(
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

async function findFoodCatalogById(foodId) {
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        SELECT 
          food_id,
          food_name,
          measurement_type,
          serving_size,
          serving_size_unit,
          calories_per_serving,
          protein_per_serving,
          carbs_per_serving,
          fat_per_serving,
          notes
        FROM custom.food_catalog
        WHERE food_id = $1
      `,
      [foodId]
    );

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
