const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const foodController = require('../controllers/foodController');
const mealController = require('../controllers/mealController');
const trackerController = require('../controllers/trackerController');
const nutritionController = require('../controllers/nutritionController');
const { authenticateRequest } = require('../utils/auth');

const router = express.Router();

router.post('/api/login', authController.login);
router.post('/api/register', authController.register);
router.get('/api/user/profile', authenticateRequest, userController.getProfile);
router.put('/api/user/profile', authenticateRequest, userController.updateProfile);
router.get('/api/me', userController.getCurrentUser);
router.get('/api/users', authenticateRequest, userController.getAllUsers);
router.post('/api/users', userController.createUser);
router.put('/api/user/password', authenticateRequest, userController.changePassword);

router.get('/api/food-catalog', authenticateRequest, foodController.getFoodCatalog);
router.post('/api/food-catalog', authenticateRequest, foodController.addFood);
router.put('/api/food-catalog/:food_id', authenticateRequest, foodController.updateFood);
router.delete('/api/food-catalog/:food_id', authenticateRequest, foodController.deleteFood);

router.post('/api/meal-log', authenticateRequest, mealController.addMeal);
router.put('/api/meal-log/:mealLogId', authenticateRequest, mealController.updateMeal);
router.delete('/api/meal-log/:mealLogId', authenticateRequest, mealController.deleteMeal);

router.get('/api/tracker', authenticateRequest, trackerController.getTracker);
router.get('/api/login', trackerController.loginStatus);
router.get('/api/day-detail', trackerController.getAdminDayDetail);
router.get('/api/day-details', authenticateRequest, trackerController.getDayDetails);

// Nutrition targets
router.post('/api/targets', authenticateRequest, nutritionController.calculateTargets);
router.post('/api/macro-analysis', nutritionController.analyzeMacroIntake);
router.get('/api/macro-analysis', nutritionController.analyzeMacroIntake);

module.exports = router;
