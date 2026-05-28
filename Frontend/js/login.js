const loginForm = document.getElementById('login-form');
const loginFeedback = document.getElementById('login-feedback');

if (window.auth) {
  window.auth.redirectIfAuthenticated();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginFeedback.textContent = '';

  const formData = new FormData(loginForm);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '').trim();

  if (!email || !password) {
    loginFeedback.textContent = 'Please enter both email and password.';
    return;
  }

  loginFeedback.textContent = 'Signing in...';

  try {
    const response = await fetch('${API_BASE_URL}/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      loginFeedback.textContent = data.error || 'Unable to sign in. Please try again.';
      return;
    }

    auth.setAuth(data.token, data.user);

    if (data.user.passwordResetRequired) {
      window.location.href = '${API_BASE_URL}/reset-password';
      return;
    }

    window.location.href = '${API_BASE_URL}/fitness-dashboard';
  } catch (error) {
    console.error('Login failed:', error);
    loginFeedback.textContent = 'Unable to sign in. Please try again later.';
  }
});
