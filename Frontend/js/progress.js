const progressForm = document.getElementById('progress-form');
const progressCards = document.getElementById('progress-cards');
const progressFeedback = document.getElementById('progress-feedback');
const weekReportCard = document.getElementById('week-report-card');
const bestRecordCard = document.getElementById('best-report-card');
const startDateInput = progressForm.querySelector('input[name="startDate"]');
const endDateInput = progressForm.querySelector('input[name="endDate"]');
const status = document.getElementById('catalog-status');

if (window.auth) {
  auth.requireLogin();
}

let userGoal = 'Lose Fat & Build Muscle'; // default fallback
let userTdee = 2000; // default fallback
let calorieAsynRating = 5; // default fallback
let userTargetDailyCalorie = 2000; // default fallback
let userTargetProtein = 100; // default fallback
let userTargetCarbs = 250; // default fallback
let userTargetFat = 65; // default fallback

async function fetchUserTargets() {
  try {
    // Fetch user profile
    const profileResponse = await auth.authFetch(`${API_BASE_URL}/api/user/profile`);
    if (!profileResponse.ok) {
      console.warn('Failed to fetch user profile for nutrition targets');
      return;
    }
    const userData = await profileResponse.json();

    // Calculate targets based on user profile
    const nutritionResponse = await auth.authFetch(`${API_BASE_URL}/api/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sex: userData.gender,
        weightKg: userData.weight,
        heightCm: userData.height,
        age: new Date().getFullYear() - new Date(userData.dateOfBirth).getFullYear(),
        activityLevel: userData.activityLevel,
        goal: userData.goal
      })
    });

    if (nutritionResponse.ok) {
      const targets = await nutritionResponse.json();
      userGoal = userData.goal;
      userTdee = targets.tdee || 2000;
      userTargetDailyCalorie = targets.targetCalories || 2000;
      userTargetDailyCaloriePublic = targets.targetCaloriesPublic || 2000;
      userTargetProtein = targets.protein?.grams || 100;
      userTargetCarbs = targets.carbs?.grams || 250;
      userTargetFat = targets.fat?.grams || 65;
    } else {
      console.warn('Failed to calculate nutrition targets');
    }
  } catch (error) {
    console.error('Failed to fetch user targets:', error);
  }
}

function formatInputDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function formatValue(label, value, unit = '') {
  return `${label}: <strong>${value}${unit}</strong>`;
}

function buildCard(title, value, subtext, icon = '') {
  return `
    <article class="metric-card">
      <p class="metric-name">${icon ? `<span class="metric-icon">${icon}</span> ` : ''}${title}</p>
      <p class="metric-total">${subtext}</p>
      <p class="metric-meta">${value}</p>
    </article>
  `;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '0';
}

function getRating(intake, target) {

  const deficit =
    ((target - intake) / target) * 100;

  // UNDER target (deficit)
  if (deficit >= 0) {
    if (deficit <= 10) return 5;      // Ideal deficit
    if (deficit <= 20) return 4;      // Good deficit
    if (deficit <= 30) return 3;      // Aggressive deficit
    if (deficit <= 40) return 2;      // Too aggressive
    return 1;                      // Extreme deficit
  }

  // OVER target (surplus)
  const surplus = Math.abs(deficit);

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

function calculateProgressRating(averageCalories, averageProtein, averageCarbs, averageFat) {
  // Rate each macro as (average / target) * 5, capped at 5
  const calorieRating = getRating(averageCalories, userTargetDailyCalorie);
  const proteinRating = userTargetProtein > 0 ? Math.min((averageProtein / userTargetProtein) * 5, 5) : 0;
  const carbsRating = getRating(averageCarbs, userTargetCarbs);
  const fatRating = getRating(averageFat, userTargetFat);

  const w = GOAL_WEIGHTS[userGoal.toLowerCase()] || GOAL_WEIGHTS['maintain weight'];

  let rating = calorieRating * w.cal +
  proteinRating * w.pro +
  carbsRating * w.carb +
  fatRating * w.fat;

  // Average all four ratings and round to 1 decimal place
  return Number.isFinite(rating) ? Number(rating.toFixed(1)) : 0;
}

function getRangeFromData(data) {
  const dates = data
    .map((entry) => formatInputDate(String(entry.TRACK_DATE || entry.track_date || entry.date || '').trim()))
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
    <table class="report-table">
      <tbody>
        ${rows.map(([label, value]) => `<tr><td class="report-label">${label}</td><td class="report-value">${value}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

function buildMetricCardGrid(title, rows) {
  // enforce an explicit 2x2 grid in the returned HTML (inline fallback) and ensure
  // the value is presented prominently. CSS still controls the final look.
  return `
    <h3 class="report-card-title">${title}</h3>
    <div class="report-item-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;grid-auto-rows:1fr;">
      ${rows
        .map(([label, value, date]) => {
          const [icon, ...labelText] = String(label).split(' ');
          return `
            <div class="report-item-card">
              <div class="report-item-label">
                <span class="report-item-icon">${icon}</span>
                <span class="report-item-name">${date}</span>
              </div>
              <div class="report-item-value" aria-hidden="false">   ${value}</div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function buildWeekMetricGrid(title, rows) {
  return `
    <h3 class="report-card-title">${title}</h3>
    <div class="report-item-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;grid-auto-rows:1fr;">
      ${rows
        .map(([label, value]) => {
          const [icon, ...labelText] = String(label).split(' ');
          return `
            <div class="report-item-card">
              <div class="report-item-label">
                <span class="report-item-icon">${icon}</span>
                <span class="report-item-name">${labelText.join(' ')}</span>
              </div>
              <div class="report-item-value">${value}</div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderReportCards(dailyTotals) {
  if (dailyTotals.length === 0) {
    weekReportCard.innerHTML = buildWeekMetricGrid('📈 Past Week Progress', [
      ['⚡ Total calories', '—'],
      ['🥩 Total protein', '—'],
      ['🍞 Total carbs', '—'],
      ['🥑 Total fat', '—'],
    ]);
    bestRecordCard.innerHTML = buildMetricCardGrid('🏆 All Time Best Records', [
      ['⚡ Highest calories', '—'],
      ['🥩 Highest protein', '—'],
      ['🍞 Highest carbs', '—'],
      ['🥑 Highest fat', '—'],
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

  const bestCaloriesDay = dailyTotals.reduce((best, day) => {
    if (!best) return day;

    if(userTargetDailyCalorie - day.calories < 0 && userTargetDailyCalorie - best.calories < 0) {
      // both over target, pick the one closer to target
      return (userTargetDailyCalorie - day.calories) > (userTargetDailyCalorie - best.calories) ? day : best;
    }

    return (userTargetDailyCalorie - day.calories) >= 0 && (userTargetDailyCalorie - day.calories) < (userTargetDailyCalorie - best.calories) ? day : best;
  }, null);
  
  const bestProteinDay = dailyTotals.reduce((best, day) => {
    if (!best) return day;
    return day.protein > best.protein ? day : best;
  }, null);

  const bestCarbsDay = dailyTotals.reduce((best, day) => {
    if (!best) return day;

    if(userTargetCarbs - day.carbs < 0 && userTargetCarbs - best.carbs < 0) {
      // both over target, pick the one closer to target
      return (userTargetCarbs - day.carbs) > (userTargetCarbs - best.carbs) ? day : best;
    }

    return (userTargetCarbs - day.carbs) >= 0 && (userTargetCarbs - day.carbs) < (userTargetCarbs - best.carbs) ? day : best;
  }, null);

  const bestFatDay = dailyTotals.reduce((best, day) => {
    if (!best) return day;

    if(userTargetFat - day.fat < 0 && userTargetFat - best.fat < 0) {
      // both over target, pick the one closer to target
      return (userTargetFat - day.fat) > (userTargetFat - best.fat) ? day : best;
    }

    return (userTargetFat - day.fat) >= 0 && (userTargetFat - day.fat) < (userTargetFat - best.fat) ? day : best;
  }, null);

  weekReportCard.innerHTML = buildWeekMetricGrid('📈 Past Week Progress', [
    ['⚡ Total calories', `${formatNumber(weekTotals.calories)} kcal`],
    ['🥩 Total protein', `${formatNumber(weekTotals.protein)} g`],
    ['🍞 Total carbs', `${formatNumber(weekTotals.carbs)} g`],
    ['🥑 Total fat', `${formatNumber(weekTotals.fat)} g`],
  ]);

  bestRecordCard.innerHTML = buildMetricCardGrid('🏆 All Time Best Records', [
    ['⚡ Best calories', `${formatNumber(bestCaloriesDay.calories)} kcal`, `${formatDisplayDate(bestCaloriesDay.date)}`],
    ['🥩 Highest protein', `${formatNumber(bestProteinDay.protein)} g`, `${formatDisplayDate(bestProteinDay.date)}`],
    ['🍞 Best carbs', `${formatNumber(bestCarbsDay.carbs)} g`, `${formatDisplayDate(bestCarbsDay.date)}`],
    ['🥑 Best fat', `${formatNumber(bestFatDay.fat)} g`, `${formatDisplayDate(bestFatDay.date)}`],
  ]);
}

function nonProtienMacroProgressRating(intake, target) {
  return intake >= target ? (2 - intake/target) * 4 : (intake/target * 5);
}

function protienProgressRating(intake, target) {
  return intake >= target ? 5 : (intake / target) * 5;
}


function renderProgress(data, startDate, endDate) {
  const totalCalories = data.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const totalProtein = data.reduce((sum, item) => sum + Number(item.protein || 0), 0);
  const totalCarbs = data.reduce((sum, item) => sum + Number(item.carbs || item.carbohydrates || 0), 0);
  const totalFat = data.reduce((sum, item) => sum + Number(item.fat || 0), 0);
  const days = new Set(
    data
      .map((entry) => formatInputDate(String(entry.TRACK_DATE || entry.track_date || entry.date || '').trim()))
      .filter(Boolean)
  ).size;
  const dailyTotals = summarizeByDate(data);

  const averageCalories = days > 0 ? totalCalories / days : 0;
  const averageProtein = days > 0 ? totalProtein / days : 0;
  const averageCarbs = days > 0 ? totalCarbs / days : 0;
  const averageFat = days > 0 ? totalFat / days : 0;
  const totalDeficit = (userTdee * days) - totalCalories;
  const averageDeficit = days > 0 ? totalDeficit / days : 0;

  // Calculate progress rating
  const progressRating = calculateProgressRating(averageCalories, averageProtein, averageCarbs, averageFat);
  
  progressCards.innerHTML = `
    ${buildCard('Calories | kcal/day', 
      `Target ${formatNumber(userTargetDailyCalorie)} kcal | ${formatNumber(nonProtienMacroProgressRating(averageCalories,userTargetDailyCalorie))}☆`, 
      `${formatNumber(averageCalories)}`,'⚡')}
    ${buildCard('Protein | g/day', 
      `Target ${formatNumber(userTargetProtein)} g | ${formatNumber(protienProgressRating(averageProtein, userTargetProtein))}☆`, 
      `${formatNumber(averageProtein)}`, '🥩')}
    ${buildCard('Carbs | g/day', 
      `Target ${formatNumber(userTargetCarbs)} g | ${formatNumber(nonProtienMacroProgressRating(averageCarbs, userTargetCarbs))}☆`, 
      `${formatNumber(averageCarbs)}`, '🍞')}
    ${buildCard('Fat | g/day', 
      `Target ${formatNumber(userTargetFat)} g | ${formatNumber(nonProtienMacroProgressRating(averageFat, userTargetFat))}☆`, 
      `${formatNumber(averageFat)}`, '🥑')}
    ${buildCard('Streak | days','Active tracking streak', `${days}`,  '🔥')}
    ${buildCard('Maintained Calorie Deficit | kcal/day', `Target ${formatNumber(userTdee - userTargetDailyCalorie)} kcal`, `${formatNumber(averageDeficit)}`, '⬇️')}
    ${buildCard('Rating', `${formatNumber(progressRating)}/5`, `${formatNumber(progressRating)}`, '⭐')}
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
  await fetchUserTargets();
  
  // Set endDate to yesterday (t-1) to exclude today's incomplete data
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  await fetchProgress(null, yesterdayStr);
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

/* -------------------- EXPORT/DOWNLOAD -------------------- */
function showStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#fca5a5' : '#cbd5e1';
}

async function fetchAllCatalogItems() {
  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/food-catalog`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Unable to fetch catalog');
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch catalog:', error);
    showStatus('Failed to download catalog: ' + error.message, true);
    return [];
  }
}

function exportToExcel(catalogData) {
  if (!catalogData || catalogData.length === 0) {
    showStatus('No catalog items to export', true);
    return;
  }

  // Check if XLSX library is loaded
  if (typeof XLSX === 'undefined') {
    showStatus('Excel export library is not loaded. Please refresh the page and try again.', true);
    console.error('XLSX library not found. Check that the CDN script is loaded.');
    return;
  }

  // Prepare data for Excel
  const worksheetData = [
    ['Food Name', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Serving Size', 'Serving Unit'],
    ...catalogData.map(food => [
      food.food_name,
      food.calories_per_serving,
      food.protein_per_serving,
      food.carbs_per_serving,
      food.fat_per_serving,
      food.serving_size,
      food.serving_size_unit
    ])
  ];

  try {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Food Name
      { wch: 12 }, // Calories
      { wch: 14 }, // Protein
      { wch: 12 }, // Carbs
      { wch: 10 }, // Fat
      { wch: 14 }, // Serving Size
      { wch: 14 }  // Serving Unit
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Food Catalog');
    
    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Food_Catalog_${dateStr}.xlsx`);
    
    showStatus(`Downloaded Excel report with ${catalogData.length} food items.`);
  } catch (error) {
    console.error('Excel export error:', error);
    showStatus('Failed to export Excel file: ' + error.message, true);
  }
}

function exportToPDF(catalogData) {
  if (!catalogData || catalogData.length === 0) {
    showStatus('No catalog items to export', true);
    return;
  }

  const doc = new window.jspdf.jsPDF();
  console.log(window.jspdf);
  
  // Set title
  doc.setFontSize(16);
  doc.text('Food Catalog Report', 14, 22);
  
  // Add date
  doc.setFontSize(10);
  const dateStr = new Date().toLocaleDateString();
  doc.text(`Generated: ${dateStr}`, 14, 30);
  
  // Create table data
  const tableData = catalogData.map(food => [
    food.food_name,
    food.calories_per_serving,
    food.protein_per_serving,
    food.carbs_per_serving,
    food.fat_per_serving,
    food.serving_size,
    food.serving_size_unit
  ]);

  console.log(typeof doc.autoTable);
  if (typeof doc.autoTable !== 'function') {
    alert('AutoTable plugin not loaded');
    return;
  }
  // Add table to PDF
  doc.autoTable({
    head: [['Food Name', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Serving Size', 'Serving Unit']],
    body: tableData,
    startY: 38,
    theme: 'grid',
    styles: {
      fontSize: 9,
      halign: 'center',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [66, 133, 244],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 }
  });

  // Save PDF
  const dateStr2 = new Date().toISOString().split('T')[0];
  doc.save(`Food_Catalog_${dateStr2}.pdf`);
  
  showStatus(`Downloaded PDF report with ${catalogData.length} food items.`);
}

async function handleDownloadClick() {
  showStatus('Preparing catalog for download...');
  
  const catalogData = await fetchAllCatalogItems();
  
  if (!catalogData || catalogData.length === 0) {
    return;
  }

  // Create a modal with format options
  const formatModal = document.createElement('div');
  formatModal.className = 'catalog-modal-overlay';
  formatModal.innerHTML = `
    <div class="catalog-modal">
      <div class="catalog-modal-header">
        <div>
          <p class="eyebrow">Download Options</p>
          <h2>Select Report Format</h2>
        </div>
        <button type="button" class="icon-button" data-close-format-modal aria-label="Close modal">✕</button>
      </div>
      <div class="catalog-modal-body" style="padding: 24px;">
        <p style="margin-bottom: 20px;">Choose the format for your food catalog report:</p>
        <div style="display: flex; gap: 12px;">
          <button type="button" id="export-excel-btn" class="primary-btn" style="flex: 1;">📊 Export as Excel</button>
          <button type="button" id="export-pdf-btn" class="primary-btn" style="flex: 1;">📄 Export as PDF</button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => {
    formatModal.remove();
  };

  formatModal.querySelector('[data-close-format-modal]').addEventListener('click', closeModal);
  
  formatModal.querySelector('#export-excel-btn').addEventListener('click', () => {
    exportToExcel(catalogData);
    closeModal();
  });
  
  formatModal.querySelector('#export-pdf-btn').addEventListener('click', () => {
    exportToPDF(catalogData);
    closeModal();
  });

  document.body.appendChild(formatModal);
}

const downloadButton = document.getElementById('download-report');
if (downloadButton) {
  downloadButton.addEventListener('click', (event) => {
    event.preventDefault();
    handleDownloadClick();
  });
}

loadInitialProgress();
