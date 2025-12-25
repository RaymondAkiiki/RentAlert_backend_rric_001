const FeatureFlag = require('../models/featureflag.model');
const EventLog = require('../models/eventlog.model');
const logger = require('../utils/logger');

/**
 * Get all feature flags (public - for users to check availability)
 */
const getFeatureFlags = async (req, res) => {
  try {
    const flags = await FeatureFlag.getAllFlags();
    
    return res.status(200).json({
      features: flags,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Get feature flags error:', error);
    return res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
};

/**
 * Get all feature flags with admin details (admin only)
 */
const getFeatureFlagsAdmin = async (req, res) => {
  try {
    const flags = await FeatureFlag.find()
      .populate('lastModifiedBy', 'name email')
      .sort({ key: 1 });
    
    return res.status(200).json({
      features: flags.map(flag => ({
        id: flag._id,
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        disabledMessage: flag.disabledMessage,
        lastModifiedBy: flag.lastModifiedBy ? {
          id: flag.lastModifiedBy._id,
          name: flag.lastModifiedBy.name,
          email: flag.lastModifiedBy.email,
        } : null,
        lastModifiedAt: flag.lastModifiedAt,
        metadata: flag.metadata,
        createdAt: flag.createdAt,
        updatedAt: flag.updatedAt,
      })),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Get feature flags admin error:', error);
    return res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
};

/**
 * Toggle a feature flag (admin only)
 */
const toggleFeatureFlag = async (req, res) => {
  try {
    const { key } = req.params;
    const { enabled, disabledMessage } = req.body;
    const adminId = req.user.userId;

    // Validate
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Enabled must be a boolean value',
      });
    }

    // Find and update feature flag
    const feature = await FeatureFlag.findOne({ key });
    
    if (!feature) {
      return res.status(404).json({
        error: 'Feature flag not found',
        key,
      });
    }

    const oldState = feature.enabled;
    feature.enabled = enabled;
    feature.lastModifiedBy = adminId;
    feature.lastModifiedAt = new Date();
    
    if (disabledMessage) {
      feature.disabledMessage = disabledMessage;
    }

    await feature.save();

    // Log the change
    await EventLog.logEvent(adminId, 'FEATURE_FLAG_TOGGLED', {
      featureKey: key,
      featureName: feature.name,
      oldState,
      newState: enabled,
      changedBy: req.user.email,
    });

    logger.info(`Feature '${key}' ${enabled ? 'enabled' : 'disabled'} by admin: ${req.user.email}`);

    return res.status(200).json({
      message: `Feature '${feature.name}' ${enabled ? 'enabled' : 'disabled'} successfully`,
      feature: {
        key: feature.key,
        name: feature.name,
        enabled: feature.enabled,
        disabledMessage: feature.disabledMessage,
        lastModifiedAt: feature.lastModifiedAt,
      },
    });
  } catch (error) {
    logger.error('Toggle feature flag error:', error);
    return res.status(500).json({ error: 'Failed to toggle feature flag' });
  }
};

/**
 * Update feature flag message (admin only)
 */
const updateFeatureMessage = async (req, res) => {
  try {
    const { key } = req.params;
    const { disabledMessage } = req.body;
    const adminId = req.user.userId;

    if (!disabledMessage || typeof disabledMessage !== 'string') {
      return res.status(400).json({
        error: 'Valid disabledMessage is required',
      });
    }

    const feature = await FeatureFlag.findOne({ key });
    
    if (!feature) {
      return res.status(404).json({
        error: 'Feature flag not found',
        key,
      });
    }

    feature.disabledMessage = disabledMessage.trim();
    feature.lastModifiedBy = adminId;
    feature.lastModifiedAt = new Date();
    
    await feature.save();

    logger.info(`Feature '${key}' message updated by admin: ${req.user.email}`);

    return res.status(200).json({
      message: 'Feature message updated successfully',
      feature: {
        key: feature.key,
        name: feature.name,
        disabledMessage: feature.disabledMessage,
        lastModifiedAt: feature.lastModifiedAt,
      },
    });
  } catch (error) {
    logger.error('Update feature message error:', error);
    return res.status(500).json({ error: 'Failed to update feature message' });
  }
};

/**
 * Get feature flag usage statistics (admin only)
 */
const getFeatureStats = async (req, res) => {
  try {
    const { key } = req.params;
    const { startDate, endDate } = req.query;

    const feature = await FeatureFlag.findOne({ key });
    
    if (!feature) {
      return res.status(404).json({
        error: 'Feature flag not found',
        key,
      });
    }

    // Build date query
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    // Get relevant stats based on feature type
    let stats = {};

    if (key === 'sms_reminders') {
      const ReminderLog = require('../models/reminderlog.model');
      
      const [totalSent, totalFailed, totalCost, usageByDay] = await Promise.all([
        ReminderLog.countDocuments({
          type: 'sms',
          status: 'sent',
          ...(dateQuery.createdAt && { timestamp: dateQuery.createdAt }),
        }),
        ReminderLog.countDocuments({
          type: 'sms',
          status: 'failed',
          ...(dateQuery.createdAt && { timestamp: dateQuery.createdAt }),
        }),
        ReminderLog.aggregate([
          {
            $match: {
              type: 'sms',
              status: 'sent',
              ...(dateQuery.createdAt && { timestamp: dateQuery.createdAt }),
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$cost' },
            },
          },
        ]).then(result => result[0]?.total || 0),
        ReminderLog.aggregate([
          {
            $match: {
              type: 'sms',
              status: 'sent',
              ...(dateQuery.createdAt && { timestamp: dateQuery.createdAt }),
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              count: { $sum: 1 },
              cost: { $sum: '$cost' },
            },
          },
          {
            $sort: { _id: 1 },
          },
          {
            $limit: 30,
          },
        ]),
      ]);

      stats = {
        totalSent,
        totalFailed,
        totalCost: totalCost.toFixed(2),
        successRate: totalSent + totalFailed > 0 
          ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1)
          : 0,
        usageByDay: usageByDay.map(d => ({
          date: d._id,
          count: d.count,
          cost: d.cost.toFixed(2),
        })),
      };
    }

    return res.status(200).json({
      feature: {
        key: feature.key,
        name: feature.name,
        enabled: feature.enabled,
      },
      stats,
      period: {
        startDate: startDate || 'all',
        endDate: endDate || 'all',
      },
    });
  } catch (error) {
    logger.error('Get feature stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch feature statistics' });
  }
};

module.exports = {
  getFeatureFlags,
  getFeatureFlagsAdmin,
  toggleFeatureFlag,
  updateFeatureMessage,
  getFeatureStats,
};