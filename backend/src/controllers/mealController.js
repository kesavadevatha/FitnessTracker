const mealService = require('../services/mealService');

async function addMeal(req, res) {
  try {
    await mealService.addMeal(req.user.email, req.body);
    res.json({ message: 'Meal added successfully' });
  } catch (err) {
    console.error('Error adding meal:', err);
    res.status(err.status || 500).json({ error: err.message || 'Unable to add meal.' });
  }
}

async function updateMeal(req, res) {
  const mealLogId = Number(req.params.mealLogId);
  const { quantity, unit } = req.body;

  if (!Number.isFinite(mealLogId) || mealLogId <= 0) {
    return res.status(400).json({ error: 'Valid meal log ID is required.' });
  }

  if (!quantity || !unit) {
    return res.status(400).json({ error: 'Quantity and unit are required.' });
  }

  try {
    await mealService.updateMeal(mealLogId, req.user.email, quantity, unit);
    res.json({ message: 'Meal entry updated successfully.' });
  } catch (err) {
    console.error('Error updating meal entry:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update meal entry.' });
  }
}

async function deleteMeal(req, res) {
  const mealLogId = Number(req.params.mealLogId);

  if (!Number.isFinite(mealLogId) || mealLogId <= 0) {
    return res.status(400).json({ error: 'Valid meal log ID is required.' });
  }

  try {
    await mealService.deleteMeal(mealLogId, req.user.email);
    res.json({ message: 'Meal entry deleted successfully.' });
  } catch (err) {
    console.error('Error deleting meal entry:', err);
    res.status(500).json({ error: err.message || 'Failed to delete meal entry.' });
  }
}

module.exports = {
  addMeal,
  updateMeal,
  deleteMeal
};
