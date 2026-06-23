const app = require('./src/app');
const { initTables, seedData } = require('./src/services/databaseService');
const { initTablesPurse } = require('./src/services/databaseServicePurse');
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await initTables();
    await initTablesPurse();
    await seedData();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup Error:', err);
  }
})();

module.exports = app;
