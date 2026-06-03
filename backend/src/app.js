const express = require('express');
const path = require('path');
const cors = require('cors');
const { FRONTEND_ROOT } = require('./config');
const setupRoutes = require('./routes');

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json());
app.use('/css', express.static(path.join(FRONTEND_ROOT, 'css')));
app.use('/js', express.static(path.join(FRONTEND_ROOT, 'js')));
app.use('/components', express.static(path.join(FRONTEND_ROOT, 'components')));

setupRoutes(app);

module.exports = app;
