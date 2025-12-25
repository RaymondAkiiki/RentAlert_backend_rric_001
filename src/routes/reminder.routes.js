const express = require('express');
const {
  sendReminders,
  getJobStatus,
  getJobDetails,
  getReminderLogs,
  getReminderStats,
  getAvailableMethods, // ✅ NEW
} = require('../controllers/reminder.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ✅ NEW: Check which reminder methods are currently available
// GET /api/reminders/methods - Check SMS/Email availability
router.get('/methods', getAvailableMethods);

// POST /api/reminders/send - Send reminders to tenants
// Now includes automatic feature flag checking
router.post('/send', sendReminders);

// GET /api/reminders/jobs/:jobId - Get job status
router.get('/jobs/:jobId', getJobStatus);

// GET /api/reminders/jobs/:jobId/details - Get detailed job results
router.get('/jobs/:jobId/details', getJobDetails);

// GET /api/reminders/logs - Get reminder logs
router.get('/logs', getReminderLogs);

// GET /api/reminders/stats - Get reminder statistics
router.get('/stats', getReminderStats);

module.exports = router;