const userEmailInput = document.getElementById('user-email-input');
const openUserModalBtn = document.getElementById('open-user-modal');
const fetchProgressBtn = document.getElementById('fetch-progress-btn');
const statusMessage = document.getElementById('status-message');
const progressResults = document.getElementById('progress-results');

if (window.auth) {
  auth.requireLogin();
}

let selectedUserEmail = '';
let allUsers = [];

function showStatus(message, type = 'loading') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function clearStatus() {
  statusMessage.className = 'status-message';
  statusMessage.textContent = '';
}

function createUserModal(users) {
  const modal = document.createElement('div');
  modal.className = 'catalog-modal-overlay';
  modal.innerHTML = `
    <div class="catalog-modal">
      <div class="catalog-modal-header">
        <div>
          <p class="eyebrow">Select User</p>
          <h2>Choose a User</h2>
        </div>
        <button type="button" class="icon-button" data-close-modal aria-label="Close modal">✕</button>
      </div>
      <div style="padding: 24px; max-height: 60vh; overflow-y: auto;">
        <input type="text" id="user-filter-input" placeholder="Filter users by email..." style="width: 100%; padding: 10px; margin-bottom: 16px; border: 1px solid #475569; border-radius: 6px; background: #0f172a; color: #e2e8f0;" />
        <div id="users-list" style="display: flex; flex-direction: column; gap: 8px;">
          ${users
            .map(
              (user) => `
                <button type="button" class="user-item" data-email="${user.email}" style="padding: 12px 16px; text-align: left; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; cursor: pointer; transition: all 0.2s;">
                  <strong>${user.email}</strong>
                  <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Admin: ${user.is_admin === 'Y' ? 'Yes' : 'No'}</div>
                </button>
              `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;

  const filterInput = modal.querySelector('#user-filter-input');
  const usersList = modal.querySelector('#users-list');
  const userItems = usersList.querySelectorAll('.user-item');

  filterInput.addEventListener('input', (e) => {
    const filterText = e.target.value.toLowerCase();
    userItems.forEach((item) => {
      const email = item.dataset.email.toLowerCase();
      const shouldShow = email.includes(filterText);
      item.style.display = shouldShow ? 'block' : 'none';
    });
  });

  userItems.forEach((item) => {
    item.addEventListener('click', () => {
      selectedUserEmail = item.dataset.email;
      userEmailInput.value = selectedUserEmail;
      fetchProgressBtn.disabled = false;
      modal.remove();
      clearStatus();
    });

    item.addEventListener('mouseover', () => {
      item.style.background = '#334155';
      item.style.borderColor = '#4f46e5';
    });

    item.addEventListener('mouseout', () => {
      item.style.background = '#1e293b';
      item.style.borderColor = '#334155';
    });
  });

  modal.querySelector('[data-close-modal]').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

async function fetchAllUsers() {
  try {
    showStatus('Loading users...', 'loading');
    const response = await auth.authFetch(`${API_BASE_URL}/api/users`);

    if (!response.ok) {
      throw new Error(`Failed to fetch users (${response.status})`);
    }

    const users = await response.json();
    allUsers = Array.isArray(users) ? users : [];

    if (allUsers.length === 0) {
      showStatus('No users found', 'error');
      return;
    }

    clearStatus();
    createUserModal(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    showStatus(`Error loading users: ${error.message}`, 'error');
  }
}

async function fetchUserProgress(userEmail) {
  try {
    showStatus('Fetching progress data...', 'loading');

    // Get user profile for macro targets
    console.log('Fetching profile for:', userEmail);
    const profileResponse = await auth.authFetch(`${API_BASE_URL}/api/user/profile?email=${encodeURIComponent(userEmail)}`);
    
    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      console.error('Profile fetch failed:', profileResponse.status, errorData);
      throw new Error(`Could not fetch user profile (${profileResponse.status}): ${errorData.error || 'Unknown error'}`);
    }
    const userData = await profileResponse.json();
    console.log('User data:', userData);

    // Validate user has required profile data
    if (!userData.gender || !userData.weight || !userData.height || !userData.dateOfBirth || !userData.goal) {
      throw new Error('User profile is incomplete. Please ensure user has filled in gender, weight, height, date of birth, and fitness goal.');
    }

    // Calculate user's nutrition targets
    const nutritionPayload = {
      sex: userData.gender,
      weightKg: Number(userData.weight),
      heightCm: Number(userData.height),
      age: Math.max(1, new Date().getFullYear() - new Date(userData.dateOfBirth).getFullYear()),
      activityLevel: userData.activityLevel || 'sedentary',
      goal: userData.goal
    };

    console.log('Sending nutrition targets request:', nutritionPayload);
    const nutritionResponse = await auth.authFetch(`${API_BASE_URL}/api/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nutritionPayload)
    });

    let targets = {
      targetCalories: 2000,
      protein: { grams: 100 },
      carbs: { grams: 250 },
      fat: { grams: 65 }
    };

    if (nutritionResponse.ok) {
      targets = await nutritionResponse.json();
      console.log('Nutrition targets:', targets);
    } else {
      const errorData = await nutritionResponse.json().catch(() => ({}));
      console.warn('Nutrition targets calculation failed, using defaults:', errorData);
    }

    // Fetch user's tracker data (excluding today, up to t-1)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log('Fetching tracker data for:', userEmail, 'up to:', yesterdayStr);
    const trackerResponse = await auth.authFetch(`${API_BASE_URL}/api/tracker?email=${encodeURIComponent(userEmail)}&endDate=${yesterdayStr}`);
    
    if (!trackerResponse.ok) {
      const errorData = await trackerResponse.json().catch(() => ({}));
      console.error('Tracker fetch failed:', trackerResponse.status, errorData);
      throw new Error(`Could not fetch tracker data (${trackerResponse.status}): ${errorData.error || 'Unknown error'}`);
    }
    const trackerData = await trackerResponse.json();
    console.log('Tracker data count:', trackerData.length);

    if (!Array.isArray(trackerData) || trackerData.length === 0) {
      showStatus(`No tracking data found for ${userEmail}`, 'error');
      progressResults.innerHTML = '<div class="empty-state"><p>No data available for this user</p></div>';
      return;
    }

    // Calculate metrics
    const totalCalories = trackerData.reduce((sum, item) => sum + Number(item.calories || 0), 0);
    const totalProtein = trackerData.reduce((sum, item) => sum + Number(item.protein || 0), 0);
    const totalCarbs = trackerData.reduce((sum, item) => sum + Number(item.carbs || item.carbohydrates || 0), 0);
    const totalFat = trackerData.reduce((sum, item) => sum + Number(item.fat || 0), 0);

    const dates = new Set(
      trackerData
        .map((entry) => {
          const dateStr = String(entry.TRACK_DATE || entry.track_date || entry.date || '').trim();
          if (!dateStr) return null;
          return new Date(dateStr).toISOString().split('T')[0];
        })
        .filter(Boolean)
    );
    const days = dates.size || 1;

    const averageCalories = days > 0 ? totalCalories / days : 0;
    const averageProtein = days > 0 ? totalProtein / days : 0;
    const averageCarbs = days > 0 ? totalCarbs / days : 0;
    const averageFat = days > 0 ? totalFat / days : 0;

    const targetCalories = targets.targetCalories || 2000;
    const totalTargetCalories = days * targetCalories;
    const totalDeficit = totalTargetCalories - totalCalories;
    const averageDeficit = days > 0 ? totalDeficit / days : 0;

    // Calculate progress rating
    const targetProtein = targets.protein?.grams || 100;
    const targetCarbs = targets.carbs?.grams || 250;
    const targetFat = targets.fat?.grams || 65;

    const calorieRating = Math.min((averageCalories / targetCalories) * 5, 5);
    const proteinRating = Math.min((averageProtein / targetProtein) * 5, 5);
    const carbsRating = Math.min((averageCarbs / targetCarbs) * 5, 5);
    const fatRating = Math.min((averageFat / targetFat) * 5, 5);
    const progressRating = (calorieRating + proteinRating + carbsRating + fatRating) / 4;

    function formatNumber(value) {
      return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '0';
    }

    clearStatus();
    progressResults.innerHTML = `
      <div class="progress-card">
        <div class="metric-icon">⚡</div>
        <div class="metric-label">Avg Calories</div>
        <div class="metric-value">${formatNumber(averageCalories)}</div>
        <div class="metric-subtext">kcal/day (Target: ${targetCalories})</div>
      </div>
      <div class="progress-card">
        <div class="metric-icon">🥩</div>
        <div class="metric-label">Avg Protein</div>
        <div class="metric-value">${formatNumber(averageProtein)}</div>
        <div class="metric-subtext">g/day (Target: ${targetProtein})</div>
      </div>
      <div class="progress-card">
        <div class="metric-icon">🍞</div>
        <div class="metric-label">Avg Carbs</div>
        <div class="metric-value">${formatNumber(averageCarbs)}</div>
        <div class="metric-subtext">g/day (Target: ${targetCarbs})</div>
      </div>
      <div class="progress-card">
        <div class="metric-icon">🥑</div>
        <div class="metric-label">Avg Fat</div>
        <div class="metric-value">${formatNumber(averageFat)}</div>
        <div class="metric-subtext">g/day (Target: ${targetFat})</div>
      </div>
      <div class="progress-card">
        <div class="metric-icon">⬇️</div>
        <div class="metric-label">Calorie Deficit</div>
        <div class="metric-value">${formatNumber(averageDeficit)}</div>
        <div class="metric-subtext">kcal/day</div>
      </div>
      <div class="progress-card">
        <div class="metric-icon">🔥</div>
        <div class="metric-label">Tracking Streak</div>
        <div class="metric-value">${days}</div>
        <div class="metric-subtext">days</div>
      </div>
      <div class="progress-card">
        <div class="metric-icon">⭐</div>
        <div class="metric-label">Progress Rating</div>
        <div class="metric-value">${formatNumber(progressRating)}</div>
        <div class="metric-subtext">out of 5</div>
      </div>
    `;

    showStatus(`Progress data loaded for ${userEmail}`, 'success');
  } catch (error) {
    console.error('Error fetching progress:', error);
    showStatus(`Error: ${error.message}`, 'error');
    progressResults.innerHTML = '';
  }
}

openUserModalBtn.addEventListener('click', (event) => {
  event.preventDefault();
  fetchAllUsers();
});

fetchProgressBtn.addEventListener('click', (event) => {
  event.preventDefault();
  if (selectedUserEmail) {
    fetchUserProgress(selectedUserEmail);
  }
});
