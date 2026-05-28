import { sidebarItems } from './sidebar-config.js';

const sidebarRoot = document.getElementById('sidebar-root');

if (!sidebarRoot) {
  throw new Error('Sidebar root element not found');
}

sidebarRoot.classList.add('collapsed');

const dashboardView = document.getElementById('dashboard-view');
const reportsView = document.getElementById('reports-view');
let currentView = dashboardView ? 'dashboard' : 'food-intake';

function toggleView(viewId) {
  if (!dashboardView || !reportsView) {
    return;
  }

  currentView = viewId;

  const views = [dashboardView, reportsView];

  views.forEach((view) => {
    if (!view) {
      return;
    }

    const shouldShow = view.id === `${viewId}-view`;

    view.classList.toggle('hidden', !shouldShow);
    view.setAttribute('aria-hidden', String(!shouldShow));
  });

  renderSidebar();
}

function isActiveItem(item) {
  if (item.href) {
    return window.location.pathname === item.href;
  }

  if (item.id === 'dashboard' && !dashboardView) {
    return window.location.pathname === '/fitness-dashboard';
  }

  if (item.id === 'reports' && !dashboardView) {
    return window.location.pathname === '/fitness-dashboard';
  }

  return item.id === currentView;
}

function renderSidebar() {
  const collapsed = sidebarRoot.classList.contains('collapsed');
  const appShell = sidebarRoot.closest('.app-shell');

  if (appShell) {
    appShell.style.setProperty('--sidebar-width', collapsed ? '88px' : '280px');
  }

  sidebarRoot.innerHTML = `
    <div class="sidebar-inner">
      <div class="sidebar-top">
        <button class="sidebar-toggle" type="button" aria-label="Toggle sidebar">
          ${collapsed ? '☰' : '←'}
        </button>
        <div class="sidebar-brand">
          <span class="sidebar-brand-mark">FT</span>
          <div class="sidebar-brand-copy">
            <strong>Fitness Tracker</strong>
            <span>Control panel</span>
          </div>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="Sidebar">
        ${sidebarItems
          .filter((item) => {
            const authUser = window.auth?.getAuthUser();
            const isAdmin = authUser?.isAdmin;
            const isLoggedIn = Boolean(authUser?.email);

            if (item.id === 'admin' || item.id === 'food-catalog') {
              return isAdmin;
            }
            if (item.id === 'profile') {
              return isLoggedIn && !isAdmin;
            }
            return true;
          })
          .map(
            (item) => `
              <button
                type="button"
                class="sidebar-link ${isActiveItem(item) ? 'active' : ''}"
                data-view="${item.action === 'view' ? item.id : ''}"
                data-href="${item.href || ''}"
                aria-current="${isActiveItem(item) ? 'page' : 'false'}"
              >
                <span class="sidebar-link-icon">${item.icon}</span>
                <span class="sidebar-link-text">${item.label}</span>
              </button>
            `
          )
          .join('')}
      </nav>

      <div class="sidebar-footer">
        <button type="button" class="sidebar-logout-btn">
          <span class="sidebar-logout-icon">⏻</span>
          <span class="sidebar-logout-text">Logout</span>
        </button>
        <div class="sidebar-user-summary">
          <span class="sidebar-user-label">Logged in as</span>
          <strong class="sidebar-user-email">${window.auth?.getAuthUser()?.email || 'Unknown user'}</strong>
        </div>
        <p class="sidebar-footer-copy">Use the sidebar to switch between daily monitoring and report snapshots.</p>
      </div>
    </div>
  `;

  const toggleButton = sidebarRoot.querySelector('.sidebar-toggle');
  toggleButton.addEventListener('click', () => {
    sidebarRoot.classList.toggle('collapsed');
    renderSidebar();
  });

  sidebarRoot.querySelectorAll('.sidebar-link').forEach((button) => {
    button.addEventListener('click', () => {
      const item = sidebarItems.find((entry) => entry.id === button.dataset.view || entry.href === button.dataset.href);

      if (!item) {
        return;
      }

      if (item.action === 'route' && item.href) {
        window.location.href = item.href;
        return;
      }

      toggleView(item.id);
    });
  });

  const logoutButton = sidebarRoot.querySelector('.sidebar-logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      window.auth?.logout();
    });
  }
}

renderSidebar();

if (dashboardView && reportsView) {
  toggleView('dashboard');
}
