const registerForm = document.getElementById('register-form');
const registerFeedback = document.getElementById('register-feedback');

if (window.auth) {
  window.auth.redirectIfAuthenticated();
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  registerFeedback.textContent = '';

  const formData = new FormData(registerForm);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '').trim();
  const confirmPassword = String(formData.get('confirmPassword') || '').trim();

  if (!email || !password || !confirmPassword) {
    registerFeedback.textContent = 'Please enter email, password, and confirm password.';
    return;
  }

  if (password !== confirmPassword) {
    registerFeedback.textContent = 'Passwords do not match.';
    return;
  }

  registerFeedback.textContent = 'Creating account...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, confirmPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      registerFeedback.textContent = data.error || 'Unable to create account. Please try again.';
      return;
    }

    auth.setAuth(data.token, data.user);
    window.location.href = APP_ROUTES.dashboard;
  } catch (error) {
    console.error('Registration failed:', error);
    registerFeedback.textContent = 'Unable to create account. Please try again later.';
  }
});
