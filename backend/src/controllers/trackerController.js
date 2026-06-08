const { getConnection } = require('../db');
const { MEAL_ORDER } = require('../config');

async function getTracker(req, res) {
  const conn = await getConnection();
  // Allow admins to fetch data for other users
  const isAdmin = req.user?.isAdmin === 'Y';
  const userEmail = isAdmin && req.query.email ? req.query.email : req.user.email;
  const startDate = req.query.startDate || null;
  const endDate = req.query.endDate || null;

  try {
    let query = `
      SELECT *
      FROM custom.meal_log
      WHERE LOWER(user_id) = LOWER($1)
    `;
    const params = [userEmail];

    if (startDate) {
      query += ` AND track_date::date >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND track_date::date <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY track_date DESC`;

    const result = await conn.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load tracker data' });
  } finally {
    conn.release();
  }
}

function loginStatus(req, res) {
  res.send('Login API working');
}

async function getAdminDayDetail(req, res) {
  const { date } = req.query;
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        SELECT *
        FROM custom.meal_log
        WHERE track_date::date = $1
          AND LOWER(user_id) = 'admin'
        ORDER BY meal_name
      `,
      [date]
    );

    const rows = result.rows;
    const totals = rows.reduce(
      (acc, row) => {
        acc.calories += Number(row.calories || 0);
        acc.protein += Number(row.protein || 0);
        acc.carbs += Number(row.carbs || 0);
        acc.fat += Number(row.fat || 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const mealMap = new Map();
    rows.forEach((row) => {
      if (!mealMap.has(row.meal_name)) {
        mealMap.set(row.meal_name, {
          mealName: row.meal_name,
          label: row.meal_name.charAt(0).toUpperCase() + row.meal_name.slice(1),
          totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          items: []
        });
      }

      const meal = mealMap.get(row.meal_name);
      meal.items.push({
        mealLogId: row.meal_log_id,
        foodName: row.food_name,
        quantity: row.quantity,
        unit: row.unit,
        notes: row.notes,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat
      });

      meal.totals.calories += Number(row.calories || 0);
      meal.totals.protein += Number(row.protein || 0);
      meal.totals.carbs += Number(row.carbs || 0);
      meal.totals.fat += Number(row.fat || 0);
    });

    res.json({
      totals,
      meals: Array.from(mealMap.values())
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load day details' });
  } finally {
    conn.release();
  }
}

async function getDayDetails(req, res) {
  const { date } = req.query;
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        SELECT *
        FROM custom.meal_log
        WHERE track_date::date = $1
          AND LOWER(user_id) = LOWER($2)
        ORDER BY meal_name
      `,
      [date, req.user.email]
    );

    const rows = result.rows;
    const totals = rows.reduce(
      (acc, row) => {
        acc.calories += Number(row.calories || 0);
        acc.protein += Number(row.protein || 0);
        acc.carbs += Number(row.carbs || 0);
        acc.fat += Number(row.fat || 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const mealMap = new Map();
    rows.forEach((row) => {
      const key = row.meal_name;
      if (!mealMap.has(key)) {
        mealMap.set(key, {
          mealName: key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          items: []
        });
      }

      const meal = mealMap.get(key);
      meal.items.push({
        mealLogId: row.meal_log_id,
        foodName: row.food_name,
        quantity: row.quantity,
        unit: row.unit,
        notes: row.notes,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat
      });

      meal.totals.calories += Number(row.calories || 0);
      meal.totals.protein += Number(row.protein || 0);
      meal.totals.carbs += Number(row.carbs || 0);
      meal.totals.fat += Number(row.fat || 0);
    });

    const meals = MEAL_ORDER.map((mealName) => {
      if (mealMap.has(mealName)) {
        return mealMap.get(mealName);
      }
      return {
        mealName,
        label: mealName
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        items: []
      };
    });

    res.json({ totals, meals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load day details' });
  } finally {
    conn.release();
  }
}

module.exports = {
  getTracker,
  loginStatus,
  getAdminDayDetail,
  getDayDetails
};
