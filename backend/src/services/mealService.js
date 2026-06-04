const { getConnection } = require('../db');
const foodService = require('./foodService');
const { calculateScale, roundTo } = require('../utils/helpers');

async function addMeal(userEmail, mealData) {
  const conn = await getConnection();

  try {
    const food = await foodService.findFoodCatalogById(Number(mealData.food_id), userEmail);
    if (!food) {
      const error = new Error('Food not found.');
      error.status = 404;
      throw error;
    }

    const scale = calculateScale(food, mealData.quantity, mealData.unit);
    const calories = roundTo(Number(food.calories_per_serving) * scale, 1);
    const protein = roundTo(Number(food.protein_per_serving) * scale, 1);
    const carbs = roundTo(Number(food.carbs_per_serving) * scale, 1);
    const fat = roundTo(Number(food.fat_per_serving) * scale, 1);

    await conn.query(
      `
        INSERT INTO custom.meal_log
        (
          food_id,
          food_name,
          track_date,
          meal_name,
          quantity,
          unit,
          calories,
          protein,
          carbs,
          fat,
          notes,
          user_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,
      [
        Number(mealData.food_id),
        food.food_name,
        mealData.track_date,
        mealData.meal_name,
        Number(mealData.quantity),
        mealData.unit,
        calories,
        protein,
        carbs,
        fat,
        mealData.notes,
        userEmail
      ]
    );
  } finally {
    conn.release();
  }
}

async function updateMeal(mealLogId, userEmail, quantity, unit) {
  const conn = await getConnection();

  try {
    const mealResult = await conn.query(
      `
        SELECT food_id
        FROM custom.meal_log
        WHERE meal_log_id = $1
          AND LOWER(user_id) = LOWER($2)
      `,
      [mealLogId, userEmail]
    );

    if (!mealResult.rows.length) {
      const error = new Error('Meal log entry not found.');
      error.status = 404;
      throw error;
    }

    const foodId = mealResult.rows[0].food_id;
    const food = await foodService.findFoodCatalogById(foodId, userEmail);

    if (!food) {
      const error = new Error('Food entry not found.');
      error.status = 404;
      throw error;
    }

    const scale = calculateScale(food, quantity, unit);
    const newCalories = roundTo(Number(food.calories_per_serving) * scale, 1);
    const newProtein = roundTo(Number(food.protein_per_serving) * scale, 1);
    const newCarbs = roundTo(Number(food.carbs_per_serving) * scale, 1);
    const newFat = roundTo(Number(food.fat_per_serving) * scale, 1);

    await conn.query(
      `
        UPDATE custom.meal_log
        SET quantity = $1,
            unit = $2,
            calories = $3,
            protein = $4,
            carbs = $5,
            fat = $6,
            modified_date = NOW()
        WHERE meal_log_id = $7
          AND LOWER(user_id) = LOWER($8)
      `,
      [
        Number(quantity),
        String(unit).toLowerCase(),
        newCalories,
        newProtein,
        newCarbs,
        newFat,
        mealLogId,
        userEmail
      ]
    );
  } finally {
    conn.release();
  }
}

async function deleteMeal(mealLogId, userEmail) {
  const conn = await getConnection();

  try {
    await conn.query(
      `
        DELETE FROM custom.meal_log
        WHERE meal_log_id = $1
          AND LOWER(user_id) = LOWER($2)
      `,
      [mealLogId, userEmail]
    );
  } finally {
    conn.release();
  }
}

module.exports = {
  addMeal,
  updateMeal,
  deleteMeal
};
