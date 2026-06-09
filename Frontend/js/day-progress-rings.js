(function (global) {
  function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getBatteryStateClass(percent) {
    if (percent >= 120) return 'battery-overflow';
    if (percent >= 100) return 'battery-warning';
    if (percent >= 80) return 'battery-highlight';
    return 'battery-normal';
  }

  function getMetricColorClass(label) {
    return `battery-${String(label || '').toLowerCase()}`;
  }

  function createBatteryHTML(label, percent, valueLabel, remainingLabel) {
    const raw = safeNumber(percent);
    const displayPct = Math.round(raw);
    const clampedPercent = Math.max(0, Math.min(200, raw));
    const fillHeight = (clampedPercent / 100) * 78;
    const fillOffset = Math.round(6 + 78 - fillHeight);
    const stateClass = getBatteryStateClass(raw);
    const metricClass = getMetricColorClass(label);
    const sanitizedId = String(label || 'metric').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const clipPathId = `battery-clip-${sanitizedId}`;

    const iconMap = {
      'Calories': '⚡',
      'Protein': '🥩',
      'Carbs': '🍞',
      'Fat': '🥑'
    };

    const icon = iconMap[label] || '';

    return `
      <div class="progress-ring-card battery-card ${metricClass} ${stateClass}">
        <div class="battery-wrapper">
          <div class="battery-graphic">
            <svg class="progress-ring battery-svg" viewBox="0 0 40 100" aria-hidden="true" role="img">
              <defs>
                <clipPath id="${clipPathId}">
                  <rect x="8" y="6" width="24" height="78" rx="6" ry="6" />
                </clipPath>
              </defs>

              <rect class="battery-shell" x="8" y="6" width="24" height="78" rx="6" ry="6" />
              <rect class="battery-cap" x="14" y="0" width="12" height="5" rx="2" ry="2" />

              <g clip-path="url(#${clipPathId})">
                <rect class="battery-fill-bg" x="8" y="6" width="24" height="78" />
                <g class="battery-liquid" transform="translate(0, ${fillOffset})">
                  <rect x="8" y="0" width="24" height="78" />
                  <path class="wave wave-back" d="M8 14 C12 10 16 18 20 14 S28 10 32 14 S36 18 40 14 V 78 H 8 Z" />
                  <path class="wave wave-front" d="M8 13 C12 9 16 17 20 13 S28 9 32 13 S36 17 40 13 V 78 H 8 Z" />
                </g>
              </g>
            </svg>
            <div class="battery-center-label">
              <div class="progress-ring-percent">${displayPct}%</div>
            </div>
          </div>
          <div class="battery-info">
            <div class="battery-title"><span class="metric-icon">${icon}</span> ${label}</div>
            <div class="battery-value">${valueLabel}</div>
            <div class="battery-value">${remainingLabel}</div>
          </div>
        </div>
      </div>
    `;
  }

  function formatValueLabel(consumed, target, unit) {
    if (!Number.isFinite(target) || target <= 0) {
      return `${Math.round(consumed)} ${unit}`;
    }
    return `${Math.round(consumed)} / ${Math.round(target)} ${unit}`;
  }

  function formatRemainingTarget(consumed, target, unit) {
    if (!Number.isFinite(target) || target <= 0) {
      return `${Math.round(consumed)} ${unit}`;
    }
    return `${Math.round(target) - Math.round(consumed)} ${unit}`;
  }

  function renderProgressRings(container, totals = {}, targets = {}) {
    if (!container) return;

    const todayCalories = safeNumber(totals.calories);
    const todayProtein = safeNumber(totals.protein);
    const todayCarbs = safeNumber(totals.carbs);
    const todayFat = safeNumber(totals.fat);

    const hasTargets = Boolean(
      targets &&
      (
        Number.isFinite(targets.targetCalories) ||
        Number.isFinite(targets.protein?.grams) ||
        Number.isFinite(targets.carbs?.grams) ||
        Number.isFinite(targets.fat?.grams)
      )
    );

    if (!hasTargets) {
      container.innerHTML = `
        ${createBatteryHTML('Calories', 0, formatValueLabel(todayCalories, 0, 'kcal'),formatRemainingTarget(todayCalories, 0, 'kcal'))}
        ${createBatteryHTML('Protein', 0, formatValueLabel(todayProtein, 0, 'g'),formatRemainingTarget(todayProtein, 0, 'g'))}
        ${createBatteryHTML('Carbs', 0, formatValueLabel(todayCarbs, 0, 'g'),formatRemainingTarget(todayCarbs, 0, 'g'))}
        ${createBatteryHTML('Fat', 0, formatValueLabel(todayFat, 0, 'g'),formatRemainingTarget(todayFat, 0, 'g'))}
      `;
      return;
    }

    const targetCalories = safeNumber(targets.targetCalories);
    const targetProtein = safeNumber(targets.protein?.grams);
    const targetCarbs = safeNumber(targets.carbs?.grams);
    const targetFat = safeNumber(targets.fat?.grams);

    const pctCalories = targetCalories ? (todayCalories / targetCalories) * 100 : 0;
    const pctProtein = targetProtein ? (todayProtein / targetProtein) * 100 : 0;
    const pctCarbs = targetCarbs ? (todayCarbs / targetCarbs) * 100 : 0;
    const pctFat = targetFat ? (todayFat / targetFat) * 100 : 0;

    container.innerHTML = `
      ${createBatteryHTML('Calories', pctCalories, formatValueLabel(todayCalories, targetCalories, 'kcal'), formatRemainingTarget(todayCalories, targetCalories, 'kcal'))}
      ${createBatteryHTML('Protein', pctProtein, formatValueLabel(todayProtein, targetProtein, 'g'), formatRemainingTarget(todayProtein, targetProtein, 'g'))}
      ${createBatteryHTML('Carbs', pctCarbs, formatValueLabel(todayCarbs, targetCarbs, 'g'), formatRemainingTarget(todayCarbs, targetCarbs, 'g'))}
      ${createBatteryHTML('Fat', pctFat, formatValueLabel(todayFat, targetFat, 'g'), formatRemainingTarget(todayFat, targetFat, 'g'))}
    `;
  }

  global.renderProgressRings = renderProgressRings;

  // Rating calculation based on how close the intake is to the target, with a buffer for slight overages/underages 
  function getRating(intake, target) {

    const diff =
      ((intake - target) / target) * 100;

    // UNDER target (deficit)
    if (diff >= 0) {
      if (diff <= 10) return 5;      // Ideal deficit
      if (diff <= 20) return 4;      // Good deficit
      if (diff <= 30) return 3;      // Aggressive deficit
      if (diff <= 40) return 2;      // Too aggressive
      return 1;                      // Extreme deficit
    }

    // OVER target (surplus)
    const surplus = Math.abs(diff);

    if (surplus <= 5) return 4;      // Small miss
    if (surplus <= 10) return 3;     // Moderate miss
    if (surplus <= 20) return 2;     // Significant miss
    if (surplus <= 30) return 1;     // Large miss

    return 0;                        // Very large surplus
  }

  const GOAL_WEIGHTS = {
    'lose fat':                { cal: 0.50, pro: 0.30, carb: 0.10, fat: 0.10 },
    'body recomposition':      { cal: 0.40, pro: 0.40, carb: 0.10, fat: 0.10 },
    'lose fat & build muscle': { cal: 0.35, pro: 0.45, carb: 0.10, fat: 0.10 },
    'build muscle':            { cal: 0.35, pro: 0.35, carb: 0.20, fat: 0.10 },
    'gain weight':             { cal: 0.45, pro: 0.25, carb: 0.20, fat: 0.10 },
    'maintain weight':         { cal: 0.30, pro: 0.30, carb: 0.20, fat: 0.20 },
    'healthy lifestyle':       { cal: 0.25, pro: 0.25, carb: 0.25, fat: 0.25 }
  };

  async function calculateOverallRatingWithFetch(calorieRating, proteinRating, carbRating, fatRating) {
    try {
      // Fetch user profile to get their goal
      const profileResponse = await auth.authFetch(`${API_BASE_URL}/api/user/profile`);
      let goal = 'maintain weight'; // default fallback

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        goal = profile.goal || 'maintain weight';
      }

      const w = GOAL_WEIGHTS[goal.toLowerCase()] || GOAL_WEIGHTS['maintain weight'];

      let rating = calorieRating * w.cal;
      rating = rating + proteinRating * w.pro;
      rating = rating + carbRating * w.carb;
      rating = rating + fatRating * w.fat;

      return Number.isFinite(rating) ? Number(rating.toFixed(1)) : 0;
    } catch (error) {
      console.error('Error calculating overall rating:', error);
      // Fallback to average if fetch fails
      return (calorieRating + proteinRating + carbRating + fatRating) / 4;
    }
  }

  async function renderRatingStrip(container, totals = {}, targets = {}) {
    if (!container) return;

    const todayCalories = safeNumber(totals.calories);
    const todayProtein = safeNumber(totals.protein);
    const todayCarbs = safeNumber(totals.carbs);
    const todayFat = safeNumber(totals.fat);

    const hasTargets = Boolean(
      targets &&
      (
        Number.isFinite(targets.targetCalories) ||
        Number.isFinite(targets.protein?.grams) ||
        Number.isFinite(targets.carbs?.grams) ||
        Number.isFinite(targets.fat?.grams)
      )
    );

    if (!hasTargets) {
      container.innerHTML = '';
      return;
    }

    const targetCalories = safeNumber(targets.targetCalories);
    const targetProtein = safeNumber(targets.protein?.grams);
    const targetCarbs = safeNumber(targets.carbs?.grams);
    const targetFat = safeNumber(targets.fat?.grams);

    // Calculate ratings (0-5 scale)
    const calorieRating = getRating(todayCalories, targetCalories);
    const proteinRating = targetProtein > 0 ? Math.min((todayProtein / targetProtein) * 5, 5) : 0;
    const carbsRating = getRating(todayCarbs, targetCarbs);
    const fatRating = getRating(todayFat, targetFat);

    // Overall rating is calculated based on user's goal fetched from database
    const overallRating = await calculateOverallRatingWithFetch(calorieRating, proteinRating, carbsRating, fatRating);

    function formatRating(rating) {
      return Number.isFinite(rating) ? rating.toFixed(1) : '0.0';
    }

    container.innerHTML = `
      <div class="rating-strip">
        <div class="rating-box rating-label">
          <div class="rating-box-content">Rating</div>
        </div>
        <div class="rating-box rating-overall">
          <div class="rating-box-top">${formatRating(overallRating)}⭐</div>
        </div>
        <div class="rating-box rating-macro">
          <div class="rating-box-top">${formatRating(calorieRating)}⭐</div>
          <div class="rating-box-bottom">Calorie</div>
        </div>
        <div class="rating-box rating-macro">
          <div class="rating-box-top">${formatRating(proteinRating)}⭐</div>
          
          <div class="rating-box-bottom">Protein</div>
        </div>
        <div class="rating-box rating-macro">
          <div class="rating-box-top">${formatRating(carbsRating)}⭐</div>
          <div class="rating-box-bottom">Carbs</div>
        </div>
        <div class="rating-box rating-macro">
          <div class="rating-box-top">${formatRating(fatRating)}⭐</div>
          <div class="rating-box-bottom">Fat</div>
        </div>
      </div>
    `;
  }

  global.renderRatingStrip = renderRatingStrip;
})(window);
