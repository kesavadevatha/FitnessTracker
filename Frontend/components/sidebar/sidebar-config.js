export const sidebarItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '⌂',
    action: 'route',
    href: '/index.html'
  },
  {
    id: 'profile',
    label: 'My Profile',
    icon: '👤',
    action: 'route',
    href: '/user-details.html'
  },
  {
    id: 'reports',
    label: 'Progress',
    icon: '↗',
    action: 'route',
    href: '/progress.html'
  },
  // progress-rings removed
  {
    id: 'admin',
    label: 'Admin',
    icon: '⚙️',
    action: 'route',
    href: '/admin.html'
  },
  {
    id: 'admin-progress',
    label: 'User Progress',
    icon: '📊',
    action: 'route',
    href: '/admin-progress.html'
  },
  {
    id: 'food-catalog',
    label: 'Food Catalog',
    icon: '🗂',
    action: 'route',
    href: '/food-catalog.html'
  },
  {
    id: 'food-catalog-browser',
    label: 'Browse Catalog',
    icon: '🔎',
    action: 'route',
    href: '/food-catalog-browser.html'
  }
];
