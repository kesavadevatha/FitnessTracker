if (window.auth) {
  auth.requireLogin();
}

const ringsContainer = document.getElementById('rings-container');
const ringsFeedback = document.getElementById('rings-feedback');
const progressDateInput = document.getElementById('progress-date');

function pad(n) { return String(n).padStart(2, '0'); }
function formatDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function createRingHTML(label, percent, valueLabel, color = 'var(--accent)') {
  const pct = Math.max(0, Math.min(100, Math.round(percent))); 
  const radius = 56;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

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
        <div class="progress-ring-title">${label}</div>
        <div class="progress-ring-sub">${valueLabel}</div>
      </div>
    </div>
  `;
}

function toKg(weight, unit) {
  if (!weight) return 0;
  const u = String(unit || '').toLowerCase();
  if (u === 'kg') return Number(weight);
  if (u === 'lb' || u === 'lbs' || u === 'pound') return Number(weight) * 0.45359237;
  return Number(weight);
}

function toCm(height, unit) {
  if (!height) return 0;
  const u = String(unit || '').toLowerCase();
  if (u === 'cm') return Number(height);
  if (u === 'in' || u === 'inch' || u === 'inches') return Number(height) * 2.54;
  return Number(height);
}

async function loadAndRender(dateKey) {
  try {
    ringsFeedback.textContent = 'Loading profile and targets...';

    // Get profile
    const profileRes = await auth.authFetch(`${API_BASE_URL}/api/user/profile`);
    if (!profileRes.ok) throw new Error('Unable to load user profile.');
    const profile = await profileRes.json();

    // Build target payload
    const weightKg = toKg(profile.weight, profile.weightUnit);
    const heightCm = toCm(profile.height, profile.heightUnit);
    const dob = profile.dateOfBirth || profile.date_of_birth || null;
    let age = 30;
    if (dob) {
      const yy = new Date(dob);
      if (!Number.isNaN(yy.getTime())) {
        const now = new Date();
        age = now.getFullYear() - yy.getFullYear();
      }
    }

    const targetPayload = {
      sex: (profile.gender || profile.sex || 'male'),
      weightKg: Math.round(weightKg * 10) / 10,
      heightCm: Math.round(heightCm),
      age,
      activityLevel: profile.activityLevel || 'sedentary',
      goal: profile.goal || 'maintain weight'
    };

    const targetRes = await auth.authFetch(`${API_BASE_URL}/api/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetPayload)
    });

    if (!targetRes.ok) throw new Error('Unable to fetch targets.');
    const targets = await targetRes.json();

    ringsFeedback.textContent = 'Loading today intake...';

    // fetch tracker for date
    const url = new URL(`${API_BASE_URL}/api/tracker`);
    url.searchParams.set('startDate', dateKey);
    url.searchParams.set('endDate', dateKey);

    const trackerRes = await auth.authFetch(url.toString());
    if (!trackerRes.ok) throw new Error('Unable to load tracker data.');
    const trackerData = await trackerRes.json();

    // compute totals
    const totals = trackerData.reduce((sum, item) => {
      sum.calories += Number(item.calories || 0);
      sum.protein += Number(item.protein || 0);
      sum.carbs += Number(item.carbs || item.carbohydrates || 0);
      sum.fat += Number(item.fat || 0);
      return sum;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    // compute percentages
    const pctCalories = targets && targets.targetCalories ? (totals.calories / targets.targetCalories) * 100 : 0;
    const pctProtein = targets && targets.protein?.grams ? (totals.protein / targets.protein.grams) * 100 : 0;
    const pctCarbs = targets && targets.carbs?.grams ? (totals.carbs / targets.carbs.grams) * 100 : 0;
    const pctFat = targets && targets.fat?.grams ? (totals.fat / targets.fat.grams) * 100 : 0;

    ringsContainer.innerHTML = `
      ${createRingHTML('Calories', pctCalories, `${Math.round(totals.calories)} / ${targets.targetCalories} kcal`, 'var(--accent)')}
      ${createRingHTML('Protein', pctProtein, `${Math.round(totals.protein)} / ${targets.protein?.grams || 0} g`, 'var(--accent-2)')}
      ${createRingHTML('Carbs', pctCarbs, `${Math.round(totals.carbs)} / ${targets.carbs?.grams || 0} g`, 'var(--success)')}
      ${createRingHTML('Fat', pctFat, `${Math.round(totals.fat)} / ${targets.fat?.grams || 0} g`, 'var(--danger)')}
    `;

    ringsFeedback.textContent = `Updated for ${dateKey}`;
  } catch (err) {
    console.error(err);
    ringsFeedback.textContent = err.message || 'Unable to load progress rings.';
    ringsContainer.innerHTML = '';
  }
}

// initialize date to today
const today = new Date();
progressDateInput.value = today.toISOString().slice(0,10);
progressDateInput.addEventListener('change', () => {
  const d = progressDateInput.value || formatDateKey(new Date());
  loadAndRender(d);
});

// initial load
loadAndRender(progressDateInput.value || formatDateKey(new Date()));
