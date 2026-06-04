(function (global) {
  function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function createRingHTML(label, percent, valueLabel, color = 'var(--accent)') {
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    const radius = 56;
    const stroke = 12;
    const circumference = 2 * Math.PI * radius;
    const dash = (pct / 100) * circumference;

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
            <circle r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
              stroke-dasharray="${dash} ${circumference - dash}" transform="rotate(-90)" />
          </g>
        </svg>
        <div class="progress-ring-label">
          <div class="progress-ring-percent">${pct}%</div>
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
        ${createRingHTML('Calories', 0, `${Math.round(todayCalories)} kcal`, 'rgba(148,163,184,0.7)')}
        ${createRingHTML('Protein', 0, `${Math.round(todayProtein)} g`, 'rgba(148,163,184,0.7)')}
        ${createRingHTML('Carbs', 0, `${Math.round(todayCarbs)} g`, 'rgba(148,163,184,0.7)')}
        ${createRingHTML('Fat', 0, `${Math.round(todayFat)} g`, 'rgba(148,163,184,0.7)')}
      `;
      return;
    }

    const pctCalories = targets.targetCalories ? (todayCalories / targets.targetCalories) * 100 : 0;
    const pctProtein = targets.protein?.grams ? (todayProtein / targets.protein.grams) * 100 : 0;
    const pctCarbs = targets.carbs?.grams ? (todayCarbs / targets.carbs.grams) * 100 : 0;
    const pctFat = targets.fat?.grams ? (todayFat / targets.fat.grams) * 100 : 0;

    container.innerHTML = `
      ${createRingHTML('Calories', pctCalories, `${Math.round(todayCalories)} / ${targets.targetCalories} kcal`, 'var(--accent)')}
      ${createRingHTML('Protein', pctProtein, `${Math.round(todayProtein)} / ${targets.protein?.grams || 0} g`, 'var(--accent-2)')}
      ${createRingHTML('Carbs', pctCarbs, `${Math.round(todayCarbs)} / ${targets.carbs?.grams || 0} g`, 'var(--success)')}
      ${createRingHTML('Fat', pctFat, `${Math.round(todayFat)} / ${targets.fat?.grams || 0} g`, 'var(--danger)')}
    `;
  }

  global.renderProgressRings = renderProgressRings;
})(window);
