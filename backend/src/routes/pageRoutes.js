const path = require('path');
const { FRONTEND_ROOT } = require('../config');

module.exports = function pageRoutes(app) {
  app.get('/', (req, res) => {
    res.redirect('/login');
  });

  app.get('/login', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'login.html'));
  });

  app.get('/signup', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'signup.html'));
  });

  app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'reset-password.html'));
  });

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'admin.html'));
  });

  app.get('/fitness-dashboard', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
  });

  app.get('/food-intake', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'food-intake.html'));
  });

  app.get('/food-catalog', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'food-catalog.html'));
  });

  app.get('/food-catalog-browser', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'food-catalog-browser.html'));
  });

  app.get('/day-details', (req, res) => {
    const filePath = path.join(FRONTEND_ROOT, 'day-details.html');

    console.log('DAY DETAILS REQUEST');
    console.log('Query:', req.query);
    console.log('File:', filePath);

    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('SEND FILE ERROR:', err);
        res.status(err.statusCode || 500).end();
      } else {
        console.log('DAY DETAILS PAGE SENT');
      }
    });
  });

  app.get('/user-details', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'user-details.html'));
  });

  app.get('/progress', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'progress.html'));
  });

  app.get('/progress.html', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'progress.html'));
  });

  app.get('/index', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
  });
};
