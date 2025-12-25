const express = require('express');
const {
  getFeatureFlags,
  getFeatureFlagsAdmin,
  toggleFeatureFlag,
  updateFeatureMessage,
  getFeatureStats,
} = require('../controllers/feature.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

// ============================================
// PUBLIC ROUTES - No authentication required
// ============================================

/**
 * @route   GET /api/features
 * @desc    Get all feature flags (public availability check)
 * @access  Public
 * @returns {Object} Feature flags with enabled status
 */
router.get('/', getFeatureFlags);

// ============================================
// ADMIN ROUTES - Authentication + Admin required
// ============================================

router.use(authenticate);
router.use(requireAdmin);

/**
 * @route   GET /api/features/admin
 * @desc    Get all feature flags with admin details
 * @access  Admin
 * @returns {Object} Complete feature flag data including modification history
 */
router.get('/admin', getFeatureFlagsAdmin);

/**
 * @route   POST /api/features/:key/toggle
 * @desc    Toggle a feature flag on/off
 * @access  Admin
 * @param   {string} key - Feature key (sms_reminders, email_reminders, etc.)
 * @body    {boolean} enabled - New enabled state
 * @body    {string} disabledMessage - Optional message when disabled
 * @returns {Object} Updated feature flag
 */
router.post('/:key/toggle', toggleFeatureFlag);

/**
 * @route   PATCH /api/features/:key/message
 * @desc    Update the disabled message for a feature
 * @access  Admin
 * @param   {string} key - Feature key
 * @body    {string} disabledMessage - New message to display when disabled
 * @returns {Object} Updated feature flag
 */
router.patch('/:key/message', updateFeatureMessage);

/**
 * @route   GET /api/features/:key/stats
 * @desc    Get usage statistics for a specific feature
 * @access  Admin
 * @param   {string} key - Feature key
 * @query   {string} startDate - Filter start date (optional)
 * @query   {string} endDate - Filter end date (optional)
 * @returns {Object} Feature usage statistics
 */
router.get('/:key/stats', getFeatureStats);

module.exports = router;