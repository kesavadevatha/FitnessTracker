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
        CALORIES: 0,
        PROTEIN: 0,
        CARBOHYDRATES: 0,
        FAT: 0,
        ENTRY_COUNT: 0
      });
    }

    const groupedEntry = grouped.get(dateKey);
    groupedEntry.CALORIES += safeNumber(entry.CALORIES);
    groupedEntry.PROTEIN += safeNumber(entry.PROTEIN);
    groupedEntry.CARBOHYDRATES += safeNumber(entry.CARBOHYDRATES ?? entry.CARBS);
    groupedEntry.FAT += safeNumber(entry.FAT);
    groupedEntry.ENTRY_COUNT += 1;
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
  summaryText.textContent = 'Add your first intake entry to begin monitoring your average calories, protein, carbs, and fat.';
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
            <a class="${classes.join(' ')}" href="/day-details?date=${encodeURIComponent(day.key)}">
              <div class="calendar-day-date">${day.date.getDate()}</div>
              <div class="calendar-day-protein">${entry ? `${metricFormatter.format(entry.PROTEIN)} g protein` : ''}</div>
            </a>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCards(entries) {
  renderMealShowcase(entries);

  const dailyEntries = groupTrackerEntries(entries);

  if (!dailyEntries.length) {
    renderEmptyState();
    return;
  }

  const totals = dailyEntries.reduce(
    (acc, entry) => {
      acc.calories += safeNumber(entry.CALORIES);
      acc.protein += safeNumber(entry.PROTEIN);
      acc.carbs += safeNumber(entry.CARBOHYDRATES);
      acc.fat += safeNumber(entry.FAT);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const dayCount = dailyEntries.length;
  const avgCalories = totals.calories / dayCount;
  const avgProtein = totals.protein / dayCount;
  const avgCarbs = totals.carbs / dayCount;
  const avgFat = totals.fat / dayCount;

  const firstDate = new Date(dailyEntries[0].TRACK_DATE);
  const lastDate = new Date(dailyEntries[dailyEntries.length - 1].TRACK_DATE);
  const dateLabel = `${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()}`;

  metricsGrid.innerHTML = `
    <article class="metric-card">
      <p class="metric-name">Calories</p>
      <p class="metric-total">${formatUnit('Calories', totals.calories)}</p>
      <p class="metric-average">Avg ${formatUnit('Calories', avgCalories)}/day</p>
      <p class="metric-meta">Tracked across ${dayCount} days</p>
    </article>
    <article class="metric-card">
      <p class="metric-name">Protein</p>
      <p class="metric-total">${formatUnit('Protein', totals.protein)}</p>
      <p class="metric-average">Avg ${formatUnit('Protein', avgProtein)}/day</p>
      <p class="metric-meta">Target-based monitoring</p>
    </article>
    <article class="metric-card">
      <p class="metric-name">Carbs</p>
      <p class="metric-total">${formatUnit('Carbs', totals.carbs)}</p>
      <p class="metric-average">Avg ${formatUnit('Carbs', avgCarbs)}/day</p>
      <p class="metric-meta">Macro balance snapshot</p>
    </article>
    <article class="metric-card">
      <p class="metric-name">Fat</p>
      <p class="metric-total">${formatUnit('Fat', totals.fat)}</p>
      <p class="metric-average">Avg ${formatUnit('Fat', avgFat)}/day</p>
      <p class="metric-meta">Daily intake summary</p>
    </article>
  `;

  const daysCard = document.createElement('article');
  daysCard.className = 'metric-card';
  daysCard.innerHTML = `
    <p class="metric-name">Tracking days</p>
    <p class="metric-total">${dayCount}</p>
    <p class="metric-average">${dayCount === 1 ? '1 day recorded' : `${dayCount} days recorded`}</p>
    <p class="metric-meta">${dateLabel}</p>
  `;

  metricsGrid.appendChild(daysCard);
  dataStatus.textContent = `${dayCount} day${dayCount === 1 ? '' : 's'} of intake available.`;
  dateRange.textContent = dateLabel;
  summaryText.textContent = `Across ${dayCount} tracked day${dayCount === 1 ? '' : 's'}, your average daily intake is ${metricFormatter.format(avgCalories)} kcal, ${metricFormatter.format(avgProtein)} g protein, ${metricFormatter.format(avgCarbs)} g carbs, and ${metricFormatter.format(avgFat)} g fat.`;

  if (reportTrackedDays) {
    reportTrackedDays.textContent = `${dayCount}`;
  }

  if (reportAverageCalories) {
    reportAverageCalories.textContent = `${formatUnit('Calories', avgCalories)}`;
  }

  if (reportAverageProtein) {
    reportAverageProtein.textContent = `${formatUnit('Protein', avgProtein)}`;
  }

  if (reportCarbsFat) {
    reportCarbsFat.textContent = `${formatUnit('Carbs', avgCarbs)} / ${formatUnit('Fat', avgFat)}`;
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
    trackerEntriesCache = entries;
    renderCards(entries);
  } catch (error) {
    console.error(error);
    dataStatus.textContent = 'Unable to load intake history right now.';
    summaryText.textContent = 'Check the backend server connection and try again.';
    renderEmptyState();
  }
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
        calories: (Number(food.calories_per_serving || 0) * quantity),
        protein: (Number(food.protein_per_serving || 0) * quantity),
        carbs: (Number(food.carbs_per_serving || 0) * quantity),
        fat: (Number(food.fat_per_serving || 0) * quantity),

        notes,
        user_id: authUser?.user_id || authUser?.id || null
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
