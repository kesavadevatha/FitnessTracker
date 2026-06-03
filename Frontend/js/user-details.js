const profileForm = document.getElementById('user-profile-form');
const profileFeedback = document.getElementById('profile-feedback');
const profileEmail = document.getElementById('profile-email');

const API_ENDPOINTS = {
  dashboard: `/index.html`
};

async function initProfilePage() {
  if (!auth.requireLogin()) {
    return;
  }

  const currentUser = auth.getAuthUser();
  if (currentUser?.isAdmin) {
    window.location.href = `${API_BASE_URL}/fitness-dashboard`;
    return;
  }

  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/user/profile`);
    if (!response.ok) {
      const data = await response.json();
      profileFeedback.textContent = data.error || 'Unable to load profile.';
      return;
    }

    const profile = await response.json();
    profileEmail.textContent = profile.email || 'Unknown user';
    profileForm.gender.value = profile.gender || '';
    profileForm.weightValue.value = profile.weight ?? '';
    profileForm.weightUnit.value = profile.weightUnit || '';
    profileForm.heightValue.value = profile.height ?? '';
    profileForm.heightUnit.value = profile.heightUnit || '';
    profileForm.dateOfBirth.value = profile.dateOfBirth || '';
    profileForm.goal.value = profile.goal || '';
    profileForm.activityLevel.value = profile.activityLevel || '';
  } catch (error) {
    console.error('Unable to load profile:', error);
    profileFeedback.textContent = 'Unable to load profile. Please refresh the page.';
  }
}

function validateProfileForm({ gender, weightValue, weightUnit, heightValue, heightUnit, dateOfBirth, goal, activityLevel }) {
  if (weightValue !== '' && (Number.isNaN(Number(weightValue)) || Number(weightValue) <= 0)) {
    return 'Weight must be a positive number.';
  }

  if (weightValue !== '' && !weightUnit) {
    return 'Please select a weight unit.';
  }

  if (heightValue !== '' && (Number.isNaN(Number(heightValue)) || Number(heightValue) <= 0)) {
    return 'Height must be a positive number.';
  }

  if (heightValue !== '' && !heightUnit) {
    return 'Please select a height unit.';
  }

  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return 'Please enter a valid date of birth.';
  }

  const validGoals = [
    'Body recomposition',
    'Lose Fat',
    'Build Muscle',
    'Lose Fat & Build Muscle',
    'Maintain Weight',
    'Gain Weight',
    'Healthy Lifestyle'
  ];

  const validActivityLevels = [
    'sedentary',
    'light',
    'moderate',
    'active',
    'athlete'
  ];

  if (goal && !validGoals.includes(goal)) {
    return 'Please select a valid goal.';
  }

  if (activityLevel && !validActivityLevels.includes(activityLevel)) {
    return 'Please select a valid activity level.';
  }

  return null;
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  profileFeedback.textContent = '';

  const formData = new FormData(profileForm);
  const gender = String(formData.get('gender') || '').trim();
  const weightValue = String(formData.get('weightValue') || '').trim();
  const weightUnit = String(formData.get('weightUnit') || '').trim();
  const heightValue = String(formData.get('heightValue') || '').trim();
  const heightUnit = String(formData.get('heightUnit') || '').trim();
  const dateOfBirth = String(formData.get('dateOfBirth') || '').trim();
  const goal = String(formData.get('goal') || '').trim();
  const activityLevel = String(formData.get('activityLevel') || '').trim();

  const validationError = validateProfileForm({
    gender,
    weightValue,
    weightUnit,
    heightValue,
    heightUnit,
    dateOfBirth,
    goal,
    activityLevel
  });
  if (validationError) {
    profileFeedback.textContent = validationError;
    return;
  }

  profileFeedback.textContent = 'Saving details...';

  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gender: gender || null,
        weight: weightValue ? Number(weightValue) : null,
        weightUnit: weightUnit || null,
        height: heightValue ? Number(heightValue) : null,
        heightUnit: heightUnit || null,
        dateOfBirth: dateOfBirth || null,
        goal: goal || null,
        activityLevel: activityLevel || null
      })
    });

    const data = await response.json();
    if (!response.ok) {
      profileFeedback.textContent = data.error || 'Unable to save details.';
      return;
    }

    profileFeedback.textContent = 'Profile saved successfully.';
  } catch (error) {
    console.error('Error saving profile:', error);
    profileFeedback.textContent = 'Unable to save details. Please try again.';
  }
});

const backButton = document.getElementById('profile-back-button');
if (backButton) {
  backButton.addEventListener('click', () => {
    window.location.href = APP_ROUTES.dashboard;
  });
}

initProfilePage();
