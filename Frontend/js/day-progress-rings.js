(function (global) {
  function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getProgressRingColor(metricType, percentage) {
    // Access from global window object where config is exposed
    const config = typeof window !== 'undefined' && window.PROGRESS_RING_CONFIG 
      ? window.PROGRESS_RING_CONFIG 
      : {};
    
    const ranges = metricType === 'protein' 
      ? config.protein?.ranges 
      : config.macro?.ranges;

    if (!ranges || !Array.isArray(ranges)) {
      return 'rgba(148,163,184,0.7)';
    }

    for (const range of ranges) {
      if (percentage >= range.min && percentage < range.max) {
        return range.color;
      }
    }

    return ranges[ranges.length - 1]?.color || 'rgba(148,163,184,0.7)';
  }

  function createRingHTML(label, percent, valueLabel, metricType = 'macro') {
    const raw = safeNumber(percent);
    const displayPct = Math.round(raw); // show exact percentage (can be >100)
    const drawPct = Math.max(0, Math.min(100, raw)); // cap arc drawing at 100%
    const radius = 56;
    const stroke = 12;
    const circumference = 2 * Math.PI * radius;
    const dash = (drawPct / 100) * circumference;
    const ringColor = getProgressRingColor(metricType, raw);

    const iconMap = {
      'Calories': '⚡',
      'Protein': '🥩',
      'Carbs': '🍞',
      'Fat': '🥑'
    };

    const icon = iconMap[label] || '';

    return `
      <div class="progress-ring-card">
        <svg class="progress-ring" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
          <g transform="translate(70,70)">
            <circle r="${radius}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}" />
            <circle r="${radius}" fill="none" stroke="${ringColor}" stroke-width="${stroke}" stroke-linecap="round"
              stroke-dasharray="${dash} ${circumference - dash}" transform="rotate(-90)" />
          </g>
        </svg>
        <div class="progress-ring-label">
          <div class="progress-ring-percent">${displayPct}%</div>
          <div class="progress-ring-title"><span class="metric-icon">${icon}</span> ${label}</div>
          <div class="progress-ring-sub">${valueLabel}</div>
        </div>
      </div>
    `;
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
        ${createRingHTML('Calories', 0, `${Math.round(todayCalories)} kcal`, 'macro')}
        ${createRingHTML('Protein', 0, `${Math.round(todayProtein)} g`, 'protein')}
        ${createRingHTML('Carbs', 0, `${Math.round(todayCarbs)} g`, 'macro')}
        ${createRingHTML('Fat', 0, `${Math.round(todayFat)} g`, 'macro')}
      `;
      return;
    }

    const pctCalories = targets.targetCalories ? (todayCalories / targets.targetCalories) * 100 : 0;
    const pctProtein = targets.protein?.grams ? (todayProtein / targets.protein.grams) * 100 : 0;
    const pctCarbs = targets.carbs?.grams ? (todayCarbs / targets.carbs.grams) * 100 : 0;
    const pctFat = targets.fat?.grams ? (todayFat / targets.fat.grams) * 100 : 0;

    container.innerHTML = `
      ${createRingHTML('Calories', pctCalories, `${Math.round(todayCalories)} Kcal Completed / ${Math.round(targets.targetCalories - todayCalories)} kcal more to go`, 'macro')}
      ${createRingHTML('Protein', pctProtein, `${Math.round(todayProtein)} g Completed / ${Math.round(targets.protein?.grams || 0 - todayProtein)} g more to go`, 'protein')}
      ${createRingHTML('Carbs', pctCarbs, `${Math.round(todayCarbs)} g Completed / ${Math.round(targets.carbs?.grams || 0 - todayCarbs)} g more to go`, 'macro')}
      ${createRingHTML('Fat', pctFat, `${Math.round(todayFat)} g Completed / ${Math.round(targets.fat?.grams || 0 - todayFat)} g more to go`, 'macro')}
    `;
  }

  global.renderProgressRings = renderProgressRings;
})(window);
