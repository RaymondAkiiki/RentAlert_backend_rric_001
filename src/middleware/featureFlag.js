const FeatureFlag = require('../models/featureflag.model');
const logger = require('../utils/logger');

/**
 * Middleware to check if a feature is enabled
 * @param {string} featureKey - The feature key to check
 * @returns {Function} Express middleware
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const isEnabled = await FeatureFlag.isEnabled(featureKey);
      
      if (!isEnabled) {
        const feature = await FeatureFlag.findOne({ key: featureKey });
        const message = feature?.disabledMessage || 'This feature is temporarily unavailable.';
        
        logger.warn(`Feature '${featureKey}' is disabled - request blocked for user: ${req.user?.userId}`);
        
        return res.status(403).json({
          error: 'Feature unavailable',
          message,
          featureKey,
          enabled: false,
        });
      }
      
      next();
    } catch (error) {
      logger.error('Feature flag check error:', error);
      // On error, allow request to proceed (fail-open)
      next();
    }
  };
};

/**
 * Middleware to attach all feature flags to request
 * Useful for endpoints that need to know multiple feature states
 */
const attachFeatureFlags = async (req, res, next) => {
  try {
    const flags = await FeatureFlag.getAllFlags();
    req.featureFlags = flags;
    next();
  } catch (error) {
    logger.error('Failed to attach feature flags:', error);
    req.featureFlags = {};
    next();
  }
};

/**
 * Check if SMS reminders are enabled (specific helper)
 */
const requireSMSEnabled = requireFeature('sms_reminders');

/**
 * Check if email reminders are enabled (specific helper)
 */
const requireEmailEnabled = requireFeature('email_reminders');

module.exports = {
  requireFeature,
  attachFeatureFlags,
  requireSMSEnabled,
  requireEmailEnabled,
};