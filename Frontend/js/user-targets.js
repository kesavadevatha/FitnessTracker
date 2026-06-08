const messageContainer = document.getElementById('message-container');
const contentContainer = document.getElementById('content');

if (window.auth) {
  auth.requireLogin();
}

function showMessage(message, type = 'loading') {
  messageContainer.innerHTML = '';
  if (!message) return;

  const className = type === 'error' ? 'error-message' : type === 'success' ? 'success-message' : 'loading';
  const div = document.createElement('div');
  div.className = className;
  div.textContent = message;
  messageContainer.appendChild(div);
}

function formatNumber(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '—';
}

function formatDecimal(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—';
}

function capitalizeFirst(str) {
  return String(str || '')
    .charAt(0)
    .toUpperCase() + String(str || '').slice(1).toLowerCase();
}

async function loadTargets() {
  try {
    showMessage('Loading your profile...', 'loading');

    // Fetch user profile
    const profileResponse = await auth.authFetch(`${API_BASE_URL}/api/user/profile`);
    if (!profileResponse.ok) {
      const data = await profileResponse.json();
      throw new Error(data.error || 'Unable to load profile');
    }

    const profile = await profileResponse.json();

    // Validate required fields
    if (!profile.gender || !profile.weight || !profile.height || !profile.dateOfBirth || !profile.goal) {
      showMessage('Your profile is incomplete. Please complete your profile details first.', 'error');
      return;
    }

    // Calculate age from date of birth
    const dob = new Date(profile.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    // Fetch nutrition targets
    showMessage('Calculating your nutrition targets...', 'loading');
    const targetsResponse = await auth.authFetch(`${API_BASE_URL}/api/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sex: profile.gender,
        weightKg: Number(profile.weight),
        heightCm: Number(profile.height),
        age: age,
        activityLevel: profile.activityLevel || 'sedentary',
        goal: profile.goal
      })
    });

    if (!targetsResponse.ok) {
      const data = await targetsResponse.json();
      throw new Error(data.error || 'Unable to calculate targets');
    }

    const targets = await targetsResponse.json();

    // Display profile information
    document.getElementById('profile-age').textContent = age;
    document.getElementById('profile-weight').textContent = `${profile.weight} ${profile.weightUnit || 'kg'}`;
    document.getElementById('profile-height').textContent = `${profile.height} ${profile.heightUnit || 'cm'}`;
    document.getElementById('profile-gender').textContent = capitalizeFirst(profile.gender);
    document.getElementById('profile-activity').textContent = capitalizeFirst(profile.activityLevel || 'sedentary');
    document.getElementById('profile-goal').textContent = profile.goal;

    // Display BMR, TDEE, Target Calories
    document.getElementById('bmr-value').textContent = formatNumber(targets.bmr);
    document.getElementById('tdee-value').textContent = formatNumber(targets.tdee);
    document.getElementById('target-calories-value').textContent = formatNumber(targets.targetCalories);

    // Display macro targets
    document.getElementById('protein-grams').textContent = formatDecimal(targets.protein.grams);
    document.getElementById('protein-calories').textContent = `${formatNumber(targets.protein.calories)} calories`;

    document.getElementById('carbs-grams').textContent = formatDecimal(targets.carbs.grams);
    document.getElementById('carbs-calories').textContent = `${formatNumber(targets.carbs.calories)} calories`;

    document.getElementById('fat-grams').textContent = formatDecimal(targets.fat.grams);
    document.getElementById('fat-calories').textContent = `${formatNumber(targets.fat.calories)} calories`;

    // Show content and clear message
    contentContainer.style.display = 'block';
    showMessage('', 'success');
  } catch (error) {
    console.error('Error loading targets:', error);
    showMessage(`Error: ${error.message}`, 'error');
  }
}

document.getElementById('edit-profile-btn').addEventListener('click', () => {
  window.location.href = '/user-details.html';
});

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = '/index.html';
});

// Load targets when page loads
loadTargets();
