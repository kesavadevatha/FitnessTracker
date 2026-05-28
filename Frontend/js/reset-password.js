const resetForm = document.getElementById('reset-password-form');
const resetFeedback = document.getElementById('reset-feedback');
const resetUserEmail = document.getElementById('reset-user-email');
const resetSuccessModal = document.getElementById('reset-success-modal');

if (!auth.requireLogin()) {
  // requireLogin already redirects unauthenticated users.
  // Continue script execution only if auth is valid.
}

let resetPageUser = null;

async function loadResetUser() {
  let currentUser = auth.getAuthUser();

  if (!currentUser?.email) {
    const payload = auth.getAuthPayload();
    if (payload?.email) {
      currentUser = {
        email: payload.email,
        isAdmin: payload.isAdmin || false,
        passwordResetRequired: payload.passwordResetRequired ?? true
      };
    }

    try {
      const response = await auth.authFetch('${API_BASE_URL}/api/me');
      if (response.ok) {
        const data = await response.json();
        currentUser = data;
        const token = auth.getAuthToken();
        if (token && currentUser) {
          auth.setAuth(token, currentUser);
        }
      }
    } catch (error) {
      console.error('Unable to load current user:', error);
    }
  }

  if (currentUser?.email) {
    resetUserEmail.textContent = currentUser.email;
    return currentUser;
  }

  auth.redirectToLogin();
  return null;
}

async function updateLocalUserOnSuccess() {
  const token = auth.getAuthToken();
  const user = auth.getAuthUser();

  if (token && user) {
    auth.setAuth(token, {
      ...user,
      email: user.email || resetUserEmail.textContent,
      passwordResetRequired: false
    });
  }
}

(async () => {
  resetPageUser = await loadResetUser();
})();

function validatePasswordFields(password, confirmPassword) {
  if (!password || !confirmPassword) {
    return 'Please enter and confirm your new password.';
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  return null;
}

function showSuccessModal() {
  resetSuccessModal.classList.remove('hidden');
}

loadResetUser();

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  resetFeedback.textContent = '';

  const formData = new FormData(resetForm);
  const password = String(formData.get('password') || '').trim();
  const confirmPassword = String(formData.get('confirmPassword') || '').trim();

  if (!resetPageUser) {
    resetFeedback.textContent = 'Unable to identify the signed-in user. Please sign in again.';
    return;
  }

  const validationError = validatePasswordFields(password, confirmPassword);
  if (validationError) {
    resetFeedback.textContent = validationError;
    return;
  }

  resetFeedback.textContent = 'Updating password...';

  try {
    const response = await auth.authFetch('${API_BASE_URL}/api/user/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    let data = {};
    try {
      data = await response.json();
    } catch (jsonError) {
      console.warn('Expected JSON response from password update.', jsonError);
    }

    if (!response.ok) {
      resetFeedback.textContent = data.error || 'Unable to update password.';
      return;
    }

    updateLocalUserOnSuccess();
    showSuccessModal();
    window.location.replace('${API_BASE_URL}/fitness-dashboard');
  } catch (error) {
    console.error('Password reset failed:', error);
    resetFeedback.textContent = 'Unable to update password. Please try again.';
  }
});
