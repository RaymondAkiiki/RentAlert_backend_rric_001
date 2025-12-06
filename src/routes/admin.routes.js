const express = require('express');
const {
  getDashboard,
  getLandlords,
  getLandlordDetails,
  getUsagePatterns,
  getSystemHealth,
} = require('../controllers/admin.controller');
const {
  getAllFeedback,
  updateFeedbackStatus,
  getFeedbackStats,
} = require('../controllers/feedback.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', getDashboard);

// Landlords
router.get('/landlords', getLandlords);
router.get('/landlords/:id', getLandlordDetails);

// Usage patterns
router.get('/usage-patterns', getUsagePatterns);

// System health
router.get('/system-health', getSystemHealth);

// Feedback
router.get('/feedback', getAllFeedback);
router.patch('/feedback/:id', updateFeedbackStatus);
router.get('/feedback/stats', getFeedbackStats);

module.exports = router;