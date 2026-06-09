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

  function renderRatingStrip(container, totals = {}, targets = {}) {
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
    const calorieRating = targetCalories > 0 ? Math.min((todayCalories / targetCalories) * 5, 5) : 0;
    const proteinRating = targetProtein > 0 ? Math.min((todayProtein / targetProtein) * 5, 5) : 0;
    const carbsRating = targetCarbs > 0 ? Math.min((todayCarbs / targetCarbs) * 5, 5) : 0;
    const fatRating = targetFat > 0 ? Math.min((todayFat / targetFat) * 5, 5) : 0;

    // Overall rating is average of all macro ratings
    const overallRating = (calorieRating + proteinRating + carbsRating + fatRating) / 4;

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
