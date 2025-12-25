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

// ============================================
// MIDDLEWARE - All routes require admin access
// ============================================
router.use(authenticate);
router.use(requireAdmin);

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get comprehensive platform overview
 * @access  Admin
 * @returns {Object} Dashboard data with metrics, growth, engagement, usage
 */
router.get('/dashboard', getDashboard);

/**
 * @route   GET /api/admin/usage-patterns
 * @desc    Get detailed usage patterns and insights
 * @access  Admin
 * @query   {string} startDate - Filter start date (optional)
 * @query   {string} endDate - Filter end date (optional)
 * @returns {Object} Reminder frequency, feature adoption, tenant patterns
 */
router.get('/usage-patterns', getUsagePatterns);

/**
 * @route   GET /api/admin/system-health
 * @desc    Get system health and performance metrics
 * @access  Admin
 * @returns {Object} SMS/Email delivery stats, database stats, health status
 */
router.get('/system-health', getSystemHealth);

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * @route   GET /api/admin/landlords
 * @desc    Get all landlords with statistics
 * @access  Admin
 * @query   {string} active - Filter by active status (true/false)
 * @query   {string} search - Search by name or email
 * @query   {string} sortBy - Sort field (default: createdAt)
 * @query   {string} order - Sort order (asc/desc, default: desc)
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 50)
 * @returns {Object} Landlords array with stats and pagination
 */
router.get('/landlords', getLandlords);

/**
 * @route   GET /api/admin/landlords/:id
 * @desc    Get detailed analytics for a single landlord
 * @access  Admin
 * @param   {string} id - Landlord user ID
 * @returns {Object} Complete landlord profile with properties, tenants, analytics
 */
router.get('/landlords/:id', getLandlordDetails);

// ============================================
// FEEDBACK MANAGEMENT
// ============================================

/**
 * @route   GET /api/admin/feedback
 * @desc    Get all user feedback
 * @access  Admin
 * @query   {number} rating - Filter by rating (1-5)
 * @query   {string} status - Filter by status (new/reviewed/resolved)
 * @query   {string} startDate - Filter start date
 * @query   {string} endDate - Filter end date
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 50)
 * @returns {Object} Feedback array with pagination
 */
router.get('/feedback', getAllFeedback);

/**
 * @route   GET /api/admin/feedback/stats
 * @desc    Get feedback statistics
 * @access  Admin
 * @query   {string} startDate - Filter start date
 * @query   {string} endDate - Filter end date
 * @returns {Object} Average rating, count, distribution by status and rating
 */
router.get('/feedback/stats', getFeedbackStats);

/**
 * @route   PATCH /api/admin/feedback/:id
 * @desc    Update feedback status
 * @access  Admin
 * @param   {string} id - Feedback ID
 * @body    {string} status - New status (new/reviewed/resolved)
 * @returns {Object} Updated feedback
 */
router.patch('/feedback/:id', updateFeedbackStatus);

// ============================================
// FUTURE ENDPOINTS (Placeholder)
// ============================================

/**
 * @route   POST /api/admin/announcements
 * @desc    Send platform-wide announcement
 * @access  Admin
 * @future  To be implemented
 */
// router.post('/announcements', createAnnouncement);

/**
 * @route   GET /api/admin/reports/export
 * @desc    Export platform data as CSV
 * @access  Admin
 * @future  To be implemented
 */
// router.get('/reports/export', exportPlatformData);

/**
 * @route   POST /api/admin/users/:id/suspend
 * @desc    Suspend a user account
 * @access  Admin
 * @future  To be implemented
 */
// router.post('/users/:id/suspend', suspendUser);

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get admin activity audit logs
 * @access  Admin
 * @future  To be implemented
 */
// router.get('/audit-logs', getAuditLogs);

// ============================================
// ERROR HANDLING
// ============================================

// Handle 404 for admin routes
router.use((req, res) => {
  res.status(404).json({
    error: 'Admin endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

module.exports = router;