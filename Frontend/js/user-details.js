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
  if (!gender) {
    return 'Gender is required.';
  }

  if (weightValue === '') {
    return 'Weight is required.';
  }

  const parsedWeight = Number(weightValue);
  if (Number.isNaN(parsedWeight) || parsedWeight <= 0) {
    return 'Weight must be a positive number.';
  }

  if (!weightUnit) {
    return 'Please select a weight unit.';
  }

  if (heightValue === '') {
    return 'Height is required.';
  }

  const parsedHeight = Number(heightValue);
  if (Number.isNaN(parsedHeight) || parsedHeight <= 0) {
    return 'Height must be a positive number.';
  }

  if (!heightUnit) {
    return 'Please select a height unit.';
  }

  const heightUnitNormalized = heightUnit.toLowerCase();
  if (heightUnitNormalized === 'cm' && (parsedHeight < 10 || parsedHeight > 300)) {
    return 'Height must be between 10 cm and 300 cm.';
  }

  if (heightUnitNormalized === 'in' && (parsedHeight < 4 || parsedHeight > 118)) {
    return 'Height must be between 4 in and 118 in.';
  }

  if (!dateOfBirth) {
    return 'Date of birth is required.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return 'Please enter a valid date of birth.';
  }

  const dob = new Date(dateOfBirth);
  const today = new Date();
  const maxPast = new Date();
  maxPast.setFullYear(today.getFullYear() - 100);

  if (Number.isNaN(dob.getTime())) {
    return 'Please enter a valid date of birth.';
  }

  if (dob > today) {
    return 'Date of birth cannot be in the future.';
  }

  if (dob < maxPast) {
    return 'Date of birth cannot be more than 100 years ago.';
  }

  if (!goal) {
    return 'Fitness goal is required.';
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

  if (!validGoals.includes(goal)) {
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
