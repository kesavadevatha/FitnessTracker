const createUserForm = document.getElementById('create-user-form');
const resetUserForm = document.getElementById('reset-user-form');
const searchUsersButton = document.getElementById('search-users-button');
const resetUserEmailInput = resetUserForm.querySelector('input[name="email"]');
const createUserFeedback = document.getElementById('create-user-feedback');
const resetUserFeedback = document.getElementById('reset-user-feedback');
const userSearchModal = document.getElementById('user-search-modal');
const userSearchOverlay = document.getElementById('user-search-overlay');
const userSearchList = document.getElementById('user-search-list');
const closeSearchModalButton = document.getElementById('close-search-modal');
const backButton = document.getElementById('back-button');
const logoutButton = document.getElementById('logout-button');

function renderUserSearchResults(users) {
  userSearchModal.classList.remove('hidden');
  userSearchOverlay.classList.remove('hidden');

  if (!users || users.length === 0) {
    userSearchList.innerHTML = '<li class="user-search-empty">No users found.</li>';
    return;
  }

  userSearchList.innerHTML = users
    .map(
      (user) => `
        <li class="user-search-item">
          <button type="button" class="user-search-button" data-email="${user.email}">
            <span class="user-search-email">${user.email}</span>
            <span class="user-search-meta">${user.isAdmin ? 'Admin' : 'User'} · ${user.passwordResetRequired ? 'Password reset required' : 'Ready'}</span>
          </button>
        </li>
      `
    )
    .join('');
}

async function searchUsers(query = '') {
  if (!auth.requireAdmin()) {
    return;
  }

  try {
    const response = await auth.authFetch(`/api/admin/users?search=${encodeURIComponent(String(query || '').trim())}`);
    if (!response.ok) {
      throw new Error('Failed to load users.');
    }

    const users = await response.json();
    renderUserSearchResults(users);
  } catch (error) {
    console.error(error);
    userSearchModal.classList.remove('hidden');
    userSearchOverlay.classList.remove('hidden');
    userSearchList.innerHTML = '<li class="user-search-error">Unable to load users at the moment.</li>';
  }
}

createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  createUserFeedback.textContent = '';

  const formData = new FormData(createUserForm);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '').trim();
  const isAdmin = String(formData.get('isAdmin')) === 'true';

  if (!email || !password) {
    createUserFeedback.textContent = 'Please enter an email and a password.';
    return;
  }

  createUserFeedback.textContent = 'Creating user...';

  try {
    const response = await auth.authFetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, isAdmin })
    });

    const data = await response.json();
    if (!response.ok) {
      createUserFeedback.textContent = data.error || 'Unable to create user.';
      return;
    }

    createUserFeedback.textContent = 'User created successfully.';
    createUserForm.reset();
    await searchUsers('');
  } catch (error) {
    console.error(error);
    createUserFeedback.textContent = 'Unable to create user. Please try again.';
  }
});

resetUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  resetUserFeedback.textContent = '';

  const formData = new FormData(resetUserForm);
  const email = String(formData.get('email') || '').trim();
  const newPassword = String(formData.get('newPassword') || '').trim();

  if (!email || !newPassword) {
    resetUserFeedback.textContent = 'Please provide the user email and a new password.';
    return;
  }

  resetUserFeedback.textContent = 'Resetting password...';

  try {
    const response = await auth.authFetch('/api/admin/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, newPassword })
    });

    const data = await response.json();
    if (!response.ok) {
      resetUserFeedback.textContent = data.error || 'Unable to reset password.';
      return;
    }

    resetUserFeedback.textContent = 'Password reset successfully.';
    resetUserForm.reset();
    await searchUsers('');
  } catch (error) {
    console.error(error);
    resetUserFeedback.textContent = 'Unable to reset password. Please try again.';
  }
});

searchUsersButton.addEventListener('click', () => searchUsers(resetUserEmailInput.value));

resetUserEmailInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchUsers(resetUserEmailInput.value);
  }
});

userSearchList.addEventListener('click', (event) => {
  const target = event.target.closest('.user-search-button');
  if (!target) {
    return;
  }

  const email = target.dataset.email;
  if (email) {
    resetUserEmailInput.value = email;
    closeSearchModal();
  }
});

closeSearchModalButton.addEventListener('click', closeSearchModal);
userSearchOverlay.addEventListener('click', closeSearchModal);

function closeSearchModal() {
  userSearchModal.classList.add('hidden');
  userSearchOverlay.classList.add('hidden');
}

backButton.addEventListener('click', () => {
  window.location.href = '/fitness-dashboard';
});

logoutButton.addEventListener('click', () => auth.logout());
