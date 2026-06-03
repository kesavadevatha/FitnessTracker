const metricsGrid = document.getElementById('metrics-grid');
const dataStatus = document.getElementById('data-status');
const dateRange = document.getElementById('date-range');
const summaryText = document.getElementById('summary-text');
const mealShowcaseGrid = document.getElementById('meal-showcase-grid');
const modal = document.getElementById('intake-modal');
const intakeForm = document.getElementById('intake-form');
const openModalButton = document.getElementById('open-intake-modal');
const closeModalButton = document.getElementById('close-intake-modal');
const reportTrackedDays = document.getElementById('report-tracked-days');
const reportAverageCalories = document.getElementById('report-average-calories');
const reportAverageProtein = document.getElementById('report-average-protein');
const reportCarbsFat = document.getElementById('report-carbs-fat');

const API_ENDPOINTS = {
  tracker: `${API_BASE_URL}/api/tracker`,
  foodCatalog: `${API_BASE_URL}/api/food-catalog`,
  mealLog: `${API_BASE_URL}/api/meal-log`
};

API_ENDPOINTS.targets = `${API_BASE_URL}/api/targets`;

if (window.auth) {
  auth.requireLogin();
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

const metricFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1
});

const calendarMonthSelect = document.getElementById('calendar-month-select');
const calendarYearSelect = document.getElementById('calendar-year-select');
const calendarPrevButton = document.getElementById('calendar-prev-btn');
const calendarNextButton = document.getElementById('calendar-next-btn');
const calendarStatus = document.getElementById('calendar-status');

const calendarState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth()
};

let trackerEntriesCache = [];
let catalogItems = [];
let isSavingIntake = false;

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUnit(label, value) {
  if (label === 'Calories') {
    return `${currencyFormatter.format(value)} kcal`;
  }

  return `${metricFormatter.format(value)} g`;
}

function formatMealLabel(mealName) {
  if (!mealName) {
    return 'Meal';
  }

  return mealName
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function getTrackerDateKey(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (dateOnlyMatch) {
      return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
    }

    const parsedDate = new Date(trimmed);

    if (!Number.isNaN(parsedDate.getTime())) {
      return formatDateKey(parsedDate);
    }

    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateKey(value);
  }

  return null;
}

function getCalendarMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const todayKey = formatDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, 1 - startOffset + index);
    const key = formatDateKey(date);

    return {
      date,
      key,
      inMonth: date.getMonth() === month,
      isToday: key === todayKey
    };
  });
}

function populateCalendarSelectors(entries) {
  const years = new Set(entries.map((entry) => new Date(entry.TRACK_DATE).getFullYear()));
  years.add(calendarState.year);
  const sortedYears = [...years].sort((a, b) => a - b);
  const minYear = sortedYears[0] || calendarState.year;
  const maxYear = sortedYears[sortedYears.length - 1] || calendarState.year;

  calendarYearSelect.innerHTML = '';
  for (let year = minYear; year <= maxYear; year += 1) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    calendarYearSelect.appendChild(option);
  }

  calendarMonthSelect.innerHTML = '';
  for (let month = 0; month < 12; month += 1) {
    const option = document.createElement('option');
    option.value = String(month);
    option.textContent = new Date(2000, month, 1).toLocaleDateString('en-US', { month: 'long' });
    calendarMonthSelect.appendChild(option);
  }

  if (!calendarYearSelect.querySelector(`option[value="${calendarState.year}"]`)) {
    calendarState.year = minYear;
  }

  calendarMonthSelect.value = String(calendarState.month);
  calendarYearSelect.value = String(calendarState.year);
}

function syncCalendarControls() {
  calendarMonthSelect.value = String(calendarState.month);
  calendarYearSelect.value = String(calendarState.year);
  calendarStatus.textContent = getCalendarMonthLabel(calendarState.year, calendarState.month);
}

function updateCalendarMonth(deltaMonths) {
  const nextMonth = new Date(calendarState.year, calendarState.month + deltaMonths, 1);
  calendarState.year = nextMonth.getFullYear();
  calendarState.month = nextMonth.getMonth();
  syncCalendarControls();
  renderMealShowcase(trackerEntriesCache);
}

function groupTrackerEntries(entries) {
  const grouped = new Map();

  entries.forEach((entry) => {
    const dateKey = getTrackerDateKey(entry.TRACK_DATE);

    if (!dateKey) {
      return;
    }

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, {
        TRACK_DATE: dateKey,
        calories: 0,
        protein: 0,
        carbohydrates: 0,
        fat: 0,
        entry_count: 0
      });
    }

    const groupedEntry = grouped.get(dateKey);
    groupedEntry.calories += safeNumber(entry.calories);
    groupedEntry.protein += safeNumber(entry.protein);
    groupedEntry.carbohydrates += safeNumber(entry.carbohydrates ?? entry.CARBS);
    groupedEntry.fat += safeNumber(entry.fat);
    groupedEntry.entry_count += 1;
  });

  return [...grouped.values()].sort((a, b) => a.TRACK_DATE.localeCompare(b.TRACK_DATE));
}

function renderEmptyState() {
  metricsGrid.innerHTML = `
    <div class="empty-state">
      No intake history yet. Use the <strong>add Intake</strong> button to log your first day.
    </div>
  `;
  dataStatus.textContent = 'No intake data available yet.';
  dateRange.textContent = 'No tracked dates';
  summaryText.textContent = 'Add your first intake entry to begin monitoring your calorie and macro totals.';
}

function renderTodayEmptyState() {
  metricsGrid.innerHTML = `
    <div class="empty-state">
      No intake recorded for today. Log your first meal to see today's progress.
    </div>
  `;
  dataStatus.textContent = 'No intake recorded for today.';
  const today = new Date();
  dateRange.textContent = today.toLocaleDateString();
  summaryText.textContent = 'Track today’s calories, protein, carbs, and fat to stay on target.';
}

function renderMealShowcase(entries) {
  const dailyEntries = groupTrackerEntries(entries);
  const entryMap = new Map(dailyEntries.map((entry) => [entry.TRACK_DATE, entry]));

  populateCalendarSelectors(dailyEntries);
  syncCalendarControls();

  const calendarDays = buildCalendarDays(calendarState.year, calendarState.month);

  mealShowcaseGrid.innerHTML = `
    <div class="calendar-grid">
      <div class="calendar-header-row">
        <div class="calendar-cell calendar-header">Mon</div>
        <div class="calendar-cell calendar-header">Tue</div>
        <div class="calendar-cell calendar-header">Wed</div>
        <div class="calendar-cell calendar-header">Thu</div>
        <div class="calendar-cell calendar-header">Fri</div>
        <div class="calendar-cell calendar-header">Sat</div>
        <div class="calendar-cell calendar-header">Sun</div>
      </div>
      <div class="calendar-grid-body">
        ${calendarDays.map((day) => {
          const entry = entryMap.get(day.key);
          const classes = ['calendar-cell', 'calendar-day'];

          if (!day.inMonth) {
            classes.push('calendar-day--out-month');
          }

          if (entry) {
            classes.push('calendar-day--hasdata');
          }

          if (day.isToday) {
            classes.push('calendar-day--today');
          }

          return `
            <a class="${classes.join(' ')}" href="/day-details.html?date=${encodeURIComponent(day.key)}">
              <div class="calendar-day-date">${day.date.getDate()}</div>
              <div class="calendar-day-protein">${entry ? `${metricFormatter.format(entry.protein)} g protein` : ''}</div>
            </a>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCards(entries) {
  renderMealShowcase(entries);

  // renderCards may be called with entries and a pre-fetched targets object
  // If targets are not available, we'll render plain metric cards as before.
  const args = Array.from(arguments);
  const targets = args.length > 1 ? args[1] : null;

  const todayKey = formatDateKey(new Date());
  const todayEntries = entries.filter((entry) => getTrackerDateKey(entry.TRACK_DATE) === todayKey);
  const todayTotals = todayEntries.reduce((totals, entry) => {
    totals.calories += safeNumber(entry.calories);
    totals.protein += safeNumber(entry.protein);
    totals.carbohydrates += safeNumber(entry.carbohydrates ?? entry.CARBS);
    totals.fat += safeNumber(entry.fat);
    totals.entry_count += 1;
    return totals;
  }, { TRACK_DATE: todayKey, calories: 0, protein: 0, carbohydrates: 0, fat: 0, entry_count: 0 });

  if (!entries.length) {
    renderEmptyState();
    return;
  }

  const todayCalories = safeNumber(todayTotals.calories);
  const todayProtein = safeNumber(todayTotals.protein);
  const todayCarbs = safeNumber(todayTotals.carbohydrates);
  const todayFat = safeNumber(todayTotals.fat);
  const mealsToday = todayTotals.entry_count || 0;
  const todayDate = new Date(todayKey);
  const dateLabel = todayDate.toLocaleDateString();

  // If targets exist, render progress rings for each macro and calories
  if (targets) {
    function createRingHTML(label, percent, valueLabel, color = 'var(--accent)') {
      const pct = Math.max(0, Math.min(100, Math.round(percent)));
      const radius = 56;
      const stroke = 12;
      const circumference = 2 * Math.PI * radius;
      const dash = (pct / 100) * circumference;

      const iconMap = {
        'Calories': '🔥',
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

    const pctCalories = targets.targetCalories ? (todayCalories / targets.targetCalories) * 100 : 0;
    const pctProtein = targets.protein?.grams ? (todayProtein / targets.protein.grams) * 100 : 0;
    const pctCarbs = targets.carbs?.grams ? (todayCarbs / targets.carbs.grams) * 100 : 0;
    const pctFat = targets.fat?.grams ? (todayFat / targets.fat.grams) * 100 : 0;

    metricsGrid.innerHTML = `
      ${createRingHTML('Calories', pctCalories, `${Math.round(todayCalories)} / ${targets.targetCalories} kcal`, 'var(--accent)')}
      ${createRingHTML('Protein', pctProtein, `${Math.round(todayProtein)} / ${targets.protein?.grams || 0} g`, 'var(--accent-2)')}
      ${createRingHTML('Carbs', pctCarbs, `${Math.round(todayCarbs)} / ${targets.carbs?.grams || 0} g`, 'var(--success)')}
      ${createRingHTML('Fat', pctFat, `${Math.round(todayFat)} / ${targets.fat?.grams || 0} g`, 'var(--danger)')}
    `;
  } else {
    // fallback to legacy metric cards when targets not available
    metricsGrid.innerHTML = `
      <article class="metric-card">
        <p class="metric-name"><span class="metric-icon">🔥</span>Calories</p>
        <p class="metric-total">${formatUnit('Calories', todayCalories)}</p>
        <p class="metric-average">Today's total</p>
        <p class="metric-meta">${mealsToday === 0 ? 'No meals logged today' : `${mealsToday} meal${mealsToday === 1 ? '' : 's'} today`}</p>
      </article>
      <article class="metric-card">
        <p class="metric-name"><span class="metric-icon">🥩</span>Protein</p>
        <p class="metric-total">${formatUnit('Protein', todayProtein)}</p>
        <p class="metric-average">Today's total</p>
        <p class="metric-meta">Current day intake</p>
      </article>
      <article class="metric-card">
        <p class="metric-name"><span class="metric-icon">🍞</span>Carbs</p>
        <p class="metric-total">${formatUnit('Carbs', todayCarbs)}</p>
        <p class="metric-average">Today's total</p>
        <p class="metric-meta">Current day intake</p>
      </article>
      <article class="metric-card">
        <p class="metric-name"><span class="metric-icon">🥑</span>Fat</p>
        <p class="metric-total">${formatUnit('Fat', todayFat)}</p>
        <p class="metric-average">Today's total</p>
        <p class="metric-meta">Current day intake</p>
      </article>
    `;
  }

  dataStatus.textContent = mealsToday > 0
    ? 'Displaying today’s intake progress.'
    : 'No intake recorded for today.';
  dateRange.textContent = dateLabel;

  if (mealsToday === 0) {
    summaryText.textContent = 'No intake logged for today yet. Add a meal to see today’s nutrition progress.';
  } else {
    summaryText.textContent = `Today’s intake totals are ${metricFormatter.format(todayCalories)} kcal, ${metricFormatter.format(todayProtein)} g protein, ${metricFormatter.format(todayCarbs)} g carbs, and ${metricFormatter.format(todayFat)} g fat.`;
  }

  if (reportTrackedDays) {
    reportTrackedDays.textContent = `${mealsToday}`;
  }

  if (reportAverageCalories) {
    reportAverageCalories.textContent = `${formatUnit('Calories', todayCalories)}`;
  }

  if (reportAverageProtein) {
    reportAverageProtein.textContent = `${formatUnit('Protein', todayProtein)}`;
  }

  if (reportCarbsFat) {
    reportCarbsFat.textContent = `${formatUnit('Carbs', todayCarbs)} / ${formatUnit('Fat', todayFat)}`;
  }
}

async function loadTrackerData() {
  try {
    //const response = await auth.authFetch('/api/tracker');
    const response = await auth.authFetch(API_ENDPOINTS.tracker);

    if (!response.ok) {
      throw new Error(`Unable to fetch tracker data (${response.status})`);
    }

    const entries = await response.json();
	console.log("TRACKER DATA:", entries);
	const normalizedEntries = entries.map(normalizeTrackerEntry);
    trackerEntriesCache = normalizedEntries;
      // attempt to fetch user profile and targets to render progress rings
      try {
        const profileResp = await auth.authFetch(`${API_BASE_URL}/api/user/profile`);
        let targets = null;

        if (profileResp.ok) {
          const profile = await profileResp.json();

          const weightKg = Number(profile.weight) || 0;
          const heightCm = Number(profile.height) || 0;
          const dob = profile.dateOfBirth || profile.date_of_birth || null;
          let age = 30;
          if (dob) {
            const yy = new Date(dob);
            if (!Number.isNaN(yy.getTime())) {
              age = new Date().getFullYear() - yy.getFullYear();
            }
          }

          const payload = {
            sex: (profile.gender || profile.sex || 'male'),
            weightKg: weightKg,
            heightCm: heightCm,
            age,
            activityLevel: profile.activityLevel || profile.activity || 'sedentary',
            goal: profile.goal || 'maintain weight'
          };

          const targetsResp = await auth.authFetch(API_ENDPOINTS.targets, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (targetsResp.ok) {
            targets = await targetsResp.json();
          }
        }

        renderCards(normalizedEntries, targets);
      } catch (err) {
        console.error('Targets/profile fetch failed:', err);
        renderCards(normalizedEntries);
      }
  } catch (error) {
    console.error(error);
    dataStatus.textContent = 'Unable to load intake history right now.';
    summaryText.textContent = 'Check the backend server connection and try again.';
    renderEmptyState();
  }
}

function normalizeTrackerEntry(entry) {
  return {
    TRACK_DATE: entry.TRACK_DATE || entry.track_date,
    calories: safeNumber(entry.calories ?? entry.calories),
    protein: safeNumber(entry.protein ?? entry.protein),
    carbohydrates: safeNumber(
      entry.carbohydrates ??
      entry.carbohydrates ??
      entry.CARBS ??
      entry.carbs
    ),
    fat: safeNumber(entry.fat ?? entry.fat)
  };
}

function normalizeUnitForSelect(unit) {
  const normalized = String(unit || 'g').toLowerCase();

  if (['g', 'gram', 'grams'].includes(normalized)) {
    return 'g';
  }

  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) {
    return 'kg';
  }

  if (['oz', 'ounce', 'ounces'].includes(normalized)) {
    return 'oz';
  }

  if (['ml', 'milliliter', 'milliliters'].includes(normalized)) {
    return 'ml';
  }

  if (['unit', 'units', 'quantity'].includes(normalized)) {
    return 'unit';
  }

  return 'g';
}

async function loadCatalogItems() {
  try {
    //const response = await auth.authFetch('/api/food-catalog');
    const response = await auth.authFetch(API_ENDPOINTS.foodCatalog);

    if (!response.ok) {
      throw new Error(`Unable to load food catalog (${response.status})`);
    }

    catalogItems = await response.json();
  } catch (error) {
    console.error(error);
    catalogItems = [];
  }
}

function updateCatalogPreview() {
  const select = document.getElementById('food-select');
  const preview = document.getElementById('catalog-preview');
  const summary = document.getElementById('catalog-summary');
  const selectedItem = catalogItems.find((item) => String(item.food_id) === String(select.value));

  if (!selectedItem) {
    summary.classList.add('hidden');
    return;
  }

  const quantityInput = document.getElementById('quantity');
  const unitSelect = document.getElementById('unit');

  quantityInput.value = Number(selectedItem.serving_size) || 1;
  unitSelect.value = normalizeUnitForSelect(selectedItem.serving_size_unit || 'g');
  summary.classList.remove('hidden');
  preview.innerHTML = `
    ${selectedItem.food_name} • ${currencyFormatter.format(Number(selectedItem.calories_per_serving || 0))} kcal, ${metricFormatter.format(Number(selectedItem.protein_per_serving || 0))} g protein, ${metricFormatter.format(Number(selectedItem.carbs_per_serving || 0))} g carbs, ${metricFormatter.format(Number(selectedItem.fat_per_serving || 0))} g fat per serving.
    ${selectedItem.notes ? `<br />${selectedItem.notes}` : ''}
  `;
}

async function openModal() {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  const dateInput = document.getElementById('track-date');
  dateInput.value = new Date().toISOString().split('T')[0];

  const feedback = document.getElementById('intake-feedback');
  feedback.textContent = 'Loading food catalog...';

  if (!catalogItems.length) {
    await loadCatalogItems();
  }

  const foodSelect = document.getElementById('food-select');

  if (!catalogItems.length) {
    foodSelect.innerHTML = '<option value="">No food items available</option>';
    foodSelect.disabled = true;
    feedback.textContent = 'No food catalog items are available right now.';
    return;
  }

  foodSelect.innerHTML = catalogItems.map((item) => `
    <option value="${item.food_id}">${item.food_name}</option>
  `).join('');
  foodSelect.disabled = false;
  updateCatalogPreview();
  feedback.textContent = 'Choose the food item, meal, and quantity to add to the day.';
}

function closeModal() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  intakeForm.reset();
  document.getElementById('catalog-summary').classList.add('hidden');
  document.getElementById('intake-feedback').textContent = '';
  isSavingIntake = false;
}

async function handleSubmit(event) {
  event.preventDefault();

  if (isSavingIntake) return;

  const formData = new FormData(intakeForm);

  const foodId = Number(formData.get('foodId'));
  const quantity = Number(formData.get('quantity'));
  const trackDate = String(formData.get('trackDate') || '').trim();
  const mealName = String(formData.get('mealName') || '').trim();
  const unit = formData.get('unit') || null;
  const notes = formData.get('notes') || null;

  if (!foodId || !trackDate || !mealName || !Number.isFinite(quantity) || quantity <= 0) {
    document.getElementById('intake-feedback').textContent =
      'Please choose food, date, meal, and valid quantity.';
    return;
  }

  // 🔥 find selected food details
  const food = catalogItems.find(f => String(f.food_id) === String(foodId));

  if (!food) {
    document.getElementById('intake-feedback').textContent =
      'Invalid food selection.';
    return;
  }

  isSavingIntake = true;
  document.getElementById('intake-feedback').textContent = 'Saving item...';
  const authUser = window.auth.getAuthUser();
  console.log("Auth User:", authUser);

  try {
    const response = await auth.authFetch(API_ENDPOINTS.mealLog, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        food_id: food.food_id,
        food_name: food.food_name,

        track_date: trackDate,
        meal_name: mealName,

        quantity,
        unit,

        // 🔥 calculate macros based on quantity
        calories: (Number(food.calories_per_serving || 0) * (quantity / food.serving_size)),
        protein: (Number(food.protein_per_serving || 0) * (quantity / food.serving_size)),
        carbs: (Number(food.carbs_per_serving || 0) * (quantity / food.serving_size)),
        fat: (Number(food.fat_per_serving || 0) * (quantity / food.serving_size)),

        notes,
        user_id: authUser?.email || null
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Unable to save meal entry.');
    }

    closeModal();
    await loadTrackerData();

  } catch (error) {
    console.error(error);
    document.getElementById('intake-feedback').textContent =
      error.message || 'Failed to save intake.';
    isSavingIntake = false;
  }
}

openModalButton.addEventListener('click', openModal);
closeModalButton.addEventListener('click', closeModal);
modal.querySelectorAll('[data-close-modal]').forEach((element) => {
  element.addEventListener('click', closeModal);
});
intakeForm.addEventListener('submit', handleSubmit);
document.getElementById('food-select').addEventListener('change', updateCatalogPreview);
calendarPrevButton.addEventListener('click', () => updateCalendarMonth(-1));
calendarNextButton.addEventListener('click', () => updateCalendarMonth(1));
calendarMonthSelect.addEventListener('change', (event) => {
  calendarState.month = Number(event.target.value);
  syncCalendarControls();
  renderMealShowcase(trackerEntriesCache);
});
calendarYearSelect.addEventListener('change', (event) => {
  calendarState.year = Number(event.target.value);
  syncCalendarControls();
  renderMealShowcase(trackerEntriesCache);
});

loadCatalogItems();
loadTrackerData();
