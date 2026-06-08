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

const GOAL_CALORIE_ADJUST_PUBLIC = {
  'lose fat': -500,
  'build muscle': 250,
  'maintain weight': 0,
  'gain weight': 500,
  'body recomposition': -200,
  'lose fat & build muscle': -300,
  'healthy lifestyle': 0
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

function getGoalAdjustmentPublic(goal) {
  return GOAL_CALORIE_ADJUST_PUBLIC[String(goal || '').toLowerCase()] ?? 0;
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

  const adjPublic = getGoalAdjustmentPublic(goal);
  const targetCaloriesPublic = Math.round(tdee + adjPublic);

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
    targetCaloriesPublic,
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
  calculateTargets,
  analyzeMacroIntake
};

function analyzeMacroIntake({
  intakeCalories = 0,
  targetCalories = 2000,
  intakeProtein = 0,
  targetProtein = 100,
  intakeCarbs = 0,
  targetCarbs = 250,
  intakeFat = 0,
  targetFat = 65
}) {
  // Validate inputs
  const intake = {
    calories: Math.max(0, Number(intakeCalories) || 0),
    protein: Math.max(0, Number(intakeProtein) || 0),
    carbs: Math.max(0, Number(intakeCarbs) || 0),
    fat: Math.max(0, Number(intakeFat) || 0)
  };

  const target = {
    calories: Math.max(1, Number(targetCalories) || 2000),
    protein: Math.max(1, Number(targetProtein) || 100),
    carbs: Math.max(1, Number(targetCarbs) || 250),
    fat: Math.max(1, Number(targetFat) || 65)
  };

  // Calculate remaining
  const remaining = {
    calories: Math.max(0, target.calories - intake.calories),
    protein: Math.max(0, target.protein - intake.protein),
    carbs: Math.max(0, target.carbs - intake.carbs),
    fat: Math.max(0, target.fat - intake.fat)
  };

  // Calculate ratings (0-10 scale)
  // Ideal: 100% of target
  // Rating penalizes both under-intake and over-intake
  function calculateMacroRating(intakeVal, targetVal) {
    if (targetVal <= 0) return 10;
    
    const percentage = (intakeVal / targetVal) * 100;
    
    if (percentage >= 90 && percentage <= 110) {
      // Excellent: 90-110% is considered perfect
      return 10;
    }
    
    if (percentage >= 75 && percentage < 90) {
      // Good: 75-90%
      return 8;
    }
    
    if (percentage > 110 && percentage <= 125) {
      // Good: 110-125% (slightly over)
      return 8;
    }
    
    if (percentage >= 60 && percentage < 75) {
      // Fair: 60-75%
      return 6;
    }
    
    if (percentage > 125 && percentage <= 150) {
      // Fair: 125-150% (moderately over)
      return 6;
    }
    
    if (percentage >= 50 && percentage < 60) {
      // Poor: 50-60%
      return 4;
    }
    
    if (percentage > 150 && percentage <= 175) {
      // Poor: 150-175% (significantly over)
      return 4;
    }
    
    // Very poor: below 50% or above 175%
    return 2;
  }

  const ratings = {
    calories: calculateMacroRating(intake.calories, target.calories),
    protein: calculateMacroRating(intake.protein, target.protein),
    carbs: calculateMacroRating(intake.carbs, target.carbs),
    fat: calculateMacroRating(intake.fat, target.fat)
  };

  // Calculate percentage completion for each macro
  const percentages = {
    calories: round((intake.calories / target.calories) * 100, 1),
    protein: round((intake.protein / target.protein) * 100, 1),
    carbs: round((intake.carbs / target.carbs) * 100, 1),
    fat: round((intake.fat / target.fat) * 100, 1)
  };

  // Overall rating: average of all macro ratings
  const overallRating = round(
    (ratings.calories + ratings.protein + ratings.carbs + ratings.fat) / 4,
    1
  );

  return {
    intake,
    target,
    remaining,
    percentages,
    ratings,
    overallRating
  };
}
