const ACTIVITY_FACTORS = {
  sedentary: 1.15,
  light: 1.3,
  moderate: 1.5,
  active: 1.7,
  athlete: 1.85
};

const GOAL_CALORIE_ADJUST = {
  'lose fat': -0.20,
  'build muscle': 0.10,
  'maintain weight': 0.0,
  'gain weight': 0.15,
  'body recomposition': -0.05,
  'lose fat & build muscle': -0.10,
  'healthy lifestyle': 0.0
};

const PROTEIN_G_PER_KG = {
  'lose fat': 1.6,
  'build muscle': 1.4,
  'gain weight': 1.2,
  'body recomposition': 1.6,
  'lose fat & build muscle': 1.5,
  'maintain weight': 1.2,
  'healthy lifestyle': 1.0
};

const FAT_G_PER_KG = 0.8;

function calcBMR({ sex, weightKg, heightCm, age }) {
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

function getActivityFactor(level) {
  return ACTIVITY_FACTORS[String(level || '').toLowerCase()] || 1.2;
}

function getGoalAdjustment(goal) {
  return GOAL_CALORIE_ADJUST[String(goal || '').toLowerCase()] ?? 0;
}

function getProteinPerKg(goal) {
  return PROTEIN_G_PER_KG[String(goal || '').toLowerCase()] || 1.8;
}

function round(v, digits = 0) {
  const m = Math.pow(10, digits);
  return Math.round(v * m) / m;
}

function calculateTargets({ sex, weightKg, heightCm, age, activityLevel, goal }) {
  if (!sex || !weightKg || !heightCm || !age || !goal) {
    throw new Error('Missing required fields: sex, weightKg, heightCm, age, goal');
  }

  const bmr = calcBMR({ sex: String(sex).toLowerCase(), weightKg, heightCm, age });
  const activityFactor = getActivityFactor(activityLevel);
  const tdee = bmr * activityFactor;

  const adj = getGoalAdjustment(goal);
  const targetCalories = Math.round(tdee * (1 + adj));

  const proteinGPerKg = getProteinPerKg(goal);
  const proteinGrams = round(proteinGPerKg * weightKg, 1);
  const fatGrams = round(FAT_G_PER_KG * weightKg, 1);

  const proteinCalories = proteinGrams * 4;
  const fatCalories = fatGrams * 9;

  const remainingCalories = Math.max(0, targetCalories - proteinCalories - fatCalories);
  const carbsGrams = round(remainingCalories / 4, 1);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    protein: {
      grams: proteinGrams,
      calories: Math.round(proteinCalories)
    },
    fat: {
      grams: fatGrams,
      calories: Math.round(fatCalories)
    },
    carbs: {
      grams: carbsGrams,
      calories: Math.round(remainingCalories)
    }
  };
}

module.exports = {
  calculateTargets
};
