const foodService = require('../services/foodService');

async function getFoodCatalog(req, res) {
  const search = req.query.search || '';
  const userEmail = req.user && req.user.email;

  try {
    const foods = await foodService.getFoodCatalog(search, userEmail);
    res.json(foods);
  } catch (err) {
    console.error('Unable to load food catalog:', err);
    res.status(500).json({ error: 'Unable to load food catalog.' });
  }
}

async function addFood(req, res) {
  try {
    const userEmail = req.user && req.user.email;
    const newId = await foodService.addFood(req.body, userEmail);
    res.json({ message: 'Food added', food_id: newId });
  } catch (err) {
    console.error('Unable to add food:', err);
    res.status(500).json({ error: 'Unable to add food.' });
  }
}

async function updateFood(req, res) {
  const foodId = Number(req.params.food_id);

  if (!Number.isFinite(foodId) || foodId <= 0) {
    return res.status(400).json({ error: 'A valid food id is required.' });
  }

  const {
    food_name,
    measurement_type,
    serving_size,
    serving_size_unit,
    calories_per_serving,
    protein_per_serving,
    carbs_per_serving,
    fat_per_serving,
    notes
  } = req.body;

  if (!food_name || !measurement_type || !serving_size || !serving_size_unit) {
    return res.status(400).json({
      error: 'Food name, measurement type, serving size, and serving size unit are required.'
    });
  }

  try {
    const updated = await foodService.updateFood(foodId, {
      food_name,
      measurement_type,
      serving_size,
      serving_size_unit,
      calories_per_serving,
      protein_per_serving,
      carbs_per_serving,
      fat_per_serving,
      notes
    });

    if (!updated) {
      return res.status(404).json({ error: 'Food entry not found.' });
    }

    res.json({ message: 'Food updated successfully.' });
  } catch (err) {
    console.error('Error updating food catalog entry:', err);
    res.status(500).json({ error: err.message || 'Failed to update food catalog entry.' });
  }
}

async function deleteFood(req, res) {
  const foodId = Number(req.params.food_id);

  if (!Number.isFinite(foodId) || foodId <= 0) {
    return res.status(400).json({ error: 'A valid food id is required.' });
  }

  try {
    const deleted = await foodService.deleteFood(foodId);
    if (!deleted) {
      return res.status(404).json({ error: 'Food entry not found.' });
    }

    res.json({ message: 'Food deleted successfully.' });
  } catch (err) {
    console.error('Error deleting food catalog entry:', err);
    res.status(500).json({ error: err.message || 'Failed to delete food catalog entry.' });
  }
}

module.exports = {
  getFoodCatalog,
  addFood,
  updateFood,
  deleteFood
};
