const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_ROOT = path.join(PROJECT_ROOT, 'Frontend');

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'fitness-tracker-secret';
const AUTH_TOKEN_EXPIRY_SECONDS = 60 * 60;
const API_BASE_URL = '';

const MEAL_ORDER = [
  'morning drink',
  'breakfast',
  'lunch',
  '1st snack',
  '2nd snack',
  'dinner'
];

module.exports = {
  PROJECT_ROOT,
  FRONTEND_ROOT,
  AUTH_TOKEN_SECRET,
  AUTH_TOKEN_EXPIRY_SECONDS,
  API_BASE_URL,
  MEAL_ORDER
};
