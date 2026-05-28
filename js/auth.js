const AUTH_TOKEN_KEY = 'fitnessTrackerAuthToken';
const AUTH_USER_KEY = 'fitnessTrackerAuthUser';

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function redirectToLogin() {
  clearAuth();
  window.location.href = '/login';
}

async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    redirectToLogin();
  }

  return response;
}

function requireLogin() {
  const token = getAuthToken();
  const user = getAuthUser();

  if (!token || !user) {
    redirectToLogin();
    return false;
  }

  if (user.passwordResetRequired && window.location.pathname !== '/reset-password') {
    window.location.href = '/reset-password';
    return false;
  }

  return true;
}

function requireAdmin() {
  const user = getAuthUser();
  if (!user?.isAdmin) {
    window.location.href = '/fitness-dashboard';
    return false;
  }
  return true;
}

function redirectIfAuthenticated() {
  const token = getAuthToken();
  const user = getAuthUser();

  if (!token || !user) {
    return false;
  }

  if (user.passwordResetRequired && window.location.pathname !== '/reset-password') {
    window.location.href = '/reset-password';
    return true;
  }

  if (window.location.pathname === '/login') {
    window.location.href = '/fitness-dashboard';
    return true;
  }

  return false;
}

function parseAuthToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch (error) {
    return null;
  }
}

function getAuthPayload() {
  const token = getAuthToken();
  return parseAuthToken(token);
}

function logout() {
  clearAuth();
  window.location.href = '/login';
}

window.auth = {
  getAuthToken,
  getAuthUser,
  setAuth,
  clearAuth,
  authFetch,
  requireLogin,
  requireAdmin,
  redirectIfAuthenticated,
  logout
};
