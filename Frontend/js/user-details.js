const profileForm = document.getElementById('user-profile-form');
const profileFeedback = document.getElementById('profile-feedback');
const profileEmail = document.getElementById('profile-email');
const API_BASE_URL = 'https://fitnesstrackerwebservices.onrender.com';

async function initProfilePage() {
  if (!auth.requireLogin()) {
    return;
  }

  const currentUser = auth.getAuthUser();
  if (currentUser?.isAdmin) {
    window.location.href = '${API_BASE_URL}/fitness-dashboard';
    return;
  }

  try {
    const response = await auth.authFetch('${API_BASE_URL}/api/user/profile');
    if (!response.ok) {
      const data = await response.json();
      profileFeedback.textContent = data.error || 'Unable to load profile.';
      return;
    }

    const profile = await response.json();
    profileEmail.textContent = profile.email || 'Unknown user';
    profileForm.gender.value = profile.gender || '';
    profileForm.weight.value = profile.weight ?? '';
    profileForm.height.value = profile.height ?? '';
    profileForm.dateOfBirth.value = profile.dateOfBirth || '';
    profileForm.goal.value = profile.goal || '';
  } catch (error) {
    console.error('Unable to load profile:', error);
    profileFeedback.textContent = 'Unable to load profile. Please refresh the page.';
  }
}

function validateProfileForm({ gender, weight, height, dateOfBirth, goal }) {
  if (weight !== '' && (Number.isNaN(Number(weight)) || Number(weight) <= 0)) {
    return 'Weight must be a positive number.';
  }

  if (height !== '' && (Number.isNaN(Number(height)) || Number(height) <= 0)) {
    return 'Height must be a positive number.';
  }

  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return 'Please enter a valid date of birth.';
  }

  if (goal && !['Fat loss', 'Muscle gain', 'Maintenance'].includes(goal)) {
    return 'Please select a valid goal.';
  }

  return null;
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  profileFeedback.textContent = '';

  const formData = new FormData(profileForm);
  const gender = String(formData.get('gender') || '').trim();
  const weightValue = String(formData.get('weight') || '').trim();
  const heightValue = String(formData.get('height') || '').trim();
  const dateOfBirth = String(formData.get('dateOfBirth') || '').trim();
  const goal = String(formData.get('goal') || '').trim();

  const validationError = validateProfileForm({ gender, weight: weightValue, height: heightValue, dateOfBirth, goal });
  if (validationError) {
    profileFeedback.textContent = validationError;
    return;
  }

  profileFeedback.textContent = 'Saving details...';

  try {
    const response = await auth.authFetch('${API_BASE_URL}/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gender: gender || null,
        weight: weightValue ? Number(weightValue) : null,
        height: heightValue ? Number(heightValue) : null,
        dateOfBirth: dateOfBirth || null,
        goal: goal || null
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

initProfilePage();
