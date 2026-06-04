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

  function createBatteryHTML(label, percent, valueLabel) {
    const raw = safeNumber(percent);
    const displayPct = Math.round(raw);
    const clampedPercent = Math.max(0, Math.min(200, raw));
    const fillHeight = (clampedPercent / 100) * 156;
    const fillOffset = Math.round(12 + 156 - fillHeight);
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
        <div class="battery-graphic">
          <svg class="progress-ring battery-svg" viewBox="0 0 80 190" aria-hidden="true" role="img">
            <defs>
              <clipPath id="${clipPathId}">
                <rect x="16" y="12" width="48" height="156" rx="12" ry="12" />
              </clipPath>
            </defs>

            <rect class="battery-shell" x="16" y="12" width="48" height="156" rx="12" ry="12" />
            <rect class="battery-cap" x="28" y="0" width="24" height="10" rx="3" ry="3" />

            <g clip-path="url(#${clipPathId})">
              <rect class="battery-fill-bg" x="16" y="12" width="48" height="156" />
              <g class="battery-liquid" transform="translate(0, ${fillOffset})">
                <rect x="16" y="0" width="48" height="156" />
                <path class="wave wave-back" d="M16 28 C24 20 32 36 40 28 S56 20 64 28 S72 36 80 28 V 156 H 16 Z" />
                <path class="wave wave-front" d="M16 26 C24 18 32 34 40 26 S56 18 64 26 S72 34 80 26 V 156 H 16 Z" />
              </g>
            </g>
          </svg>
          <div class="battery-center-label">
            <div class="progress-ring-percent">${displayPct}%</div>
          </div>
        </div>
        <div class="progress-ring-label">
          <div class="progress-ring-title"><span class="metric-icon">${icon}</span> ${label}</div>
          <div class="progress-ring-sub">${valueLabel}</div>
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
        ${createBatteryHTML('Calories', 0, formatValueLabel(todayCalories, 0, 'kcal'))}
        ${createBatteryHTML('Protein', 0, formatValueLabel(todayProtein, 0, 'g'))}
        ${createBatteryHTML('Carbs', 0, formatValueLabel(todayCarbs, 0, 'g'))}
        ${createBatteryHTML('Fat', 0, formatValueLabel(todayFat, 0, 'g'))}
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
      ${createBatteryHTML('Calories', pctCalories, formatValueLabel(todayCalories, targetCalories, 'kcal'))}
      ${createBatteryHTML('Protein', pctProtein, formatValueLabel(todayProtein, targetProtein, 'g'))}
      ${createBatteryHTML('Carbs', pctCarbs, formatValueLabel(todayCarbs, targetCarbs, 'g'))}
      ${createBatteryHTML('Fat', pctFat, formatValueLabel(todayFat, targetFat, 'g'))}
    `;
  }

  global.renderProgressRings = renderProgressRings;
})(window);
