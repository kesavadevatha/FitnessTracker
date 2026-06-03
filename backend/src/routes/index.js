const pageRoutes = require('./pageRoutes');
const apiRoutes = require('./apiRoutes');

module.exports = function setupRoutes(app) {
  pageRoutes(app);
  app.use(apiRoutes);
};
