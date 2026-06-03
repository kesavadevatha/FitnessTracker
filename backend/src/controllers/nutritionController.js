const { calculateTargets } = require('../services/nutritionService');

async function calculateTargetsHandler(req, res) {
  try {
    const payload = req.body || req.query || {};

    // Accept both body (POST) or query (GET)
    const data = {
      sex: String(payload.sex || '').toLowerCase(),
      weightKg: Number(payload.weightKg || payload.weight || 0),
      heightCm: Number(payload.heightCm || payload.height || 0),
      age: Number(payload.age || 0),
      activityLevel: payload.activityLevel || payload.activity || 'sedentary',
      goal: payload.goal || ''
    };

    const result = calculateTargets(data);
    res.json(result);
  } catch (err) {
    console.error('Nutrition targets error:', err.message || err);
    res.status(400).json({ error: err.message || 'Invalid input' });
  }
}

module.exports = {
  calculateTargets: calculateTargetsHandler
};
