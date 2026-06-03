const progressForm = document.getElementById('progress-form');
const progressCards = document.getElementById('progress-cards');
const progressFeedback = document.getElementById('progress-feedback');
const weekReportCard = document.getElementById('week-report-card');
const bestRecordCard = document.getElementById('best-report-card');
const startDateInput = progressForm.querySelector('input[name="startDate"]');
const endDateInput = progressForm.querySelector('input[name="endDate"]');

if (window.auth) {
  auth.requireLogin();
}

function formatValue(label, value, unit = '') {
  return `${label}: <strong>${value}${unit}</strong>`;
}

function buildCard(title, value, subtext) {
  return `
    <article class="metric-card">
      <p class="metric-name">${title}</p>
      <p class="metric-total">${value}</p>
      <p class="metric-meta">${subtext}</p>
    </article>
  `;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '0';
}

function getRangeFromData(data) {
  const dates = data
    .map((entry) => String(entry.TRACK_DATE || entry.track_date || entry.date || '').trim())
    .filter(Boolean)
    .sort();

  if (!dates.length) {
    return null;
  }

  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  };
}

function setRangeInputs(startDate, endDate) {
  if (startDateInput && endDateInput) {
    startDateInput.value = startDate;
    endDateInput.value = endDate;
  }
}

function summarizeByDate(data) {
  const grouped = data.reduce((acc, entry) => {
    const date = String(entry.TRACK_DATE || entry.track_date || entry.date || '').trim();
    if (!date) {
      return acc;
    }

    if (!acc[date]) {
      acc[date] = { date, calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    acc[date].calories += Number(entry.calories || 0);
    acc[date].protein += Number(entry.protein || 0);
    acc[date].carbs += Number(entry.carbs || entry.carbohydrates || 0);
    acc[date].fat += Number(entry.fat || 0);
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

function buildReportBlock(title, rows) {
  return `
    <h3 class="report-card-title">${title}</h3>
    <div class="report-card-list">
      ${rows.map(([label, value]) => `<p><strong>${label}:</strong> ${value}</p>`).join('')}
    </div>
  `;
}

function renderReportCards(dailyTotals) {
  if (dailyTotals.length === 0) {
    weekReportCard.innerHTML = buildReportBlock('Past week progress report', [
      ['Total calories', '—'],
      ['Total protein', '—'],
      ['Total carbs', '—'],
      ['Total fat', '—'],
    ]);
    bestRecordCard.innerHTML = buildReportBlock('All time best records', [
      ['Highest calories/day', '—'],
      ['Highest protein/day', '—'],
      ['Highest carbs/day', '—'],
      ['Highest fat/day', '—'],
    ]);
    return;
  }

  const recentDays = dailyTotals.slice(-7);
  const weekTotals = recentDays.reduce(
    (sum, day) => {
      sum.calories += day.calories;
      sum.protein += day.protein;
      sum.carbs += day.carbs;
      sum.fat += day.fat;
      return sum;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const bestDay = dailyTotals.reduce((best, day) => {
    if (!best) {
      return day;
    }
    const currentBestScore = best.calories + best.protein + best.carbs + best.fat;
    const dayScore = day.calories + day.protein + day.carbs + day.fat;
    return dayScore > currentBestScore ? day : best;
  }, null);

  weekReportCard.innerHTML = buildReportBlock('Past week progress report', [
    ['Total calories', `${formatNumber(weekTotals.calories)} kcal`],
    ['Total protein', `${formatNumber(weekTotals.protein)} g`],
    ['Total carbs', `${formatNumber(weekTotals.carbs)} g`],
    ['Total fat', `${formatNumber(weekTotals.fat)} g`],
  ]);

  bestRecordCard.innerHTML = buildReportBlock('All time best records', [
    ['Highest calories/day', `${formatNumber(bestDay.calories)} kcal`],
    ['Highest protein/day', `${formatNumber(bestDay.protein)} g`],
    ['Highest carbs/day', `${formatNumber(bestDay.carbs)} g`],
    ['Highest fat/day', `${formatNumber(bestDay.fat)} g`],
  ]);
}

function renderProgress(data, startDate, endDate) {
  const totalCalories = data.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const totalProtein = data.reduce((sum, item) => sum + Number(item.protein || 0), 0);
  const totalCarbs = data.reduce((sum, item) => sum + Number(item.carbs || item.carbohydrates || 0), 0);
  const totalFat = data.reduce((sum, item) => sum + Number(item.fat || 0), 0);
  const days = new Set(data.map((entry) => String(entry.TRACK_DATE || entry.track_date || entry.date || ''))).size;
  const dailyTotals = summarizeByDate(data);

  const averageCalories = days > 0 ? formatNumber(totalCalories / days) : '0';
  const averageProtein = days > 0 ? formatNumber(totalProtein / days) : '0';
  const averageCarbs = days > 0 ? formatNumber(totalCarbs / days) : '0';
  const averageFat = days > 0 ? formatNumber(totalFat / days) : '0';

  progressCards.innerHTML = `
    ${buildCard('Total calories', `${formatNumber(totalCalories)} kcal`, `Average ${averageCalories} kcal/day`)}
    ${buildCard('Protein', `${formatNumber(totalProtein)} g`, `Average ${averageProtein} g/day`)}
    ${buildCard('Carbs', `${formatNumber(totalCarbs)} g`, `Average ${averageCarbs} g/day`)}
    ${buildCard('Fat', `${formatNumber(totalFat)} g`, `Average ${averageFat} g/day`)}
    ${buildCard('🔥 Streak', `${days} days`, 'Active tracking streak')}
  `;

  renderReportCards(dailyTotals);
  progressFeedback.textContent = 'Progress updated for the selected range.';
}

function validateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return 'Please select both start date and end date.';
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Please enter valid dates.';
  }

  if (start > end) {
    return 'Start date cannot be after end date.';
  }

  return null;
}

async function fetchProgress(startDate, endDate) {
  try {
    const url = new URL(`${API_BASE_URL}/api/tracker`);
    if (startDate) {
      url.searchParams.set('startDate', startDate);
    }
    if (endDate) {
      url.searchParams.set('endDate', endDate);
    }

    const response = await auth.authFetch(url.toString());
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `Unable to fetch progress (${response.status})`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Unexpected progress response.');
    }

    const rawRange = getRangeFromData(data);
    if (rawRange && !startDate && !endDate) {
      setRangeInputs(rawRange.startDate, rawRange.endDate);
      startDate = rawRange.startDate;
      endDate = rawRange.endDate;
    }

    renderProgress(data, startDate || 'All available', endDate || 'All available');
    return data;
  } catch (error) {
    console.error('Progress fetch failed:', error);
    progressFeedback.textContent = error.message;
    progressCards.innerHTML = '';
    return [];
  }
}

async function loadInitialProgress() {
  progressFeedback.textContent = 'Loading available progress...';
  await fetchProgress();
}

progressForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  progressFeedback.textContent = '';

  const formData = new FormData(progressForm);
  const startDate = String(formData.get('startDate') || '').trim();
  const endDate = String(formData.get('endDate') || '').trim();

  const validationError = validateRange(startDate, endDate);
  if (validationError) {
    progressFeedback.textContent = validationError;
    return;
  }

  progressFeedback.textContent = 'Fetching progress...';
  await fetchProgress(startDate, endDate);
});

loadInitialProgress();
