const { v4: uuidv4 } = require('uuid');
const Tenant = require('../models/tenant.model');
const ReminderLog = require('../models/reminderlog.model');
const EventLog = require('../models/eventlog.model');
const User = require('../models/user.model');
const FeatureFlag = require('../models/featureflag.model');
const { getCurrentMonth } = require('../utils/formatters');
const logger = require('../utils/logger');
const {
  createReminderJob,
  getJobStatus: getJobStatusFromService,
  processRemindersInBackground,
} = require('../services/reminderJob.service');

/**
 * Send reminders to tenants (background job)
 */
const sendReminders = async (req, res) => {
  try {
    const { tenantIds, method, month } = req.body;
    const userId = req.user.userId;

    logger.info(`Send reminders request from userId: ${userId}`);

    // Validate inputs
    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({
        error: 'Tenant IDs are required (array)',
      });
    }

    if (!method || !['sms', 'email'].includes(method)) {
      return res.status(400).json({
        error: 'Method must be either "sms" or "email"',
      });
    }

    // ✅ CHECK FEATURE FLAGS
    const featureKey = method === 'sms' ? 'sms_reminders' : 'email_reminders';
    const isEnabled = await FeatureFlag.isEnabled(featureKey);
    
    if (!isEnabled) {
      const feature = await FeatureFlag.findOne({ key: featureKey });
      const message = feature?.disabledMessage || `${method.toUpperCase()} reminders are temporarily unavailable.`;
      
      logger.warn(`${method.toUpperCase()} reminders blocked - feature disabled for user: ${userId}`);
      
      return res.status(403).json({
        error: 'Feature unavailable',
        message,
        method,
        enabled: false,
        suggestion: method === 'sms' ? 'Try using email reminders instead' : null,
      });
    }

    const targetMonth = month || getCurrentMonth();

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Quick validation of tenants
    const tenants = await Tenant.find({
      _id: { $in: tenantIds },
      userId,
      deletedAt: null,
    });

    if (tenants.length === 0) {
      return res.status(404).json({
        error: 'No valid tenants found',
      });
    }

    // Filter by method
    let eligibleCount = tenants.length;
    if (method === 'email') {
      eligibleCount = tenants.filter(t => t.email).length;
      if (eligibleCount === 0) {
        return res.status(400).json({
          error: 'None of the selected tenants have email addresses',
        });
      }
    }

    // Create background job
    const jobId = uuidv4();
    createReminderJob(jobId, eligibleCount);

    // Start processing in background (don't await)
    processRemindersInBackground(jobId, userId, tenantIds, method, targetMonth)
      .catch(error => {
        logger.error('Background job error:', error);
      });

    logger.info(`Job ${jobId} created for ${eligibleCount} tenants (method: ${method})`);

    // Return immediately with job ID
    return res.status(202).json({
      message: 'Reminders are being sent in the background',
      jobId,
      total: eligibleCount,
      method,
    });
  } catch (error) {
    logger.error('Send reminders error:', error);
    return res.status(500).json({ error: 'Failed to send reminders' });
  }
};

/**
 * Get job status
 */
const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = getJobStatusFromService(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json({
      job: {
        id: job.id,
        status: job.status,
        total: job.total,
        sent: job.sent,
        failed: job.failed,
        totalCost: job.totalCost || 0,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.total > 0 ? Math.round(((job.sent + job.failed) / job.total) * 100) : 0,
      },
    });
  } catch (error) {
    logger.error('Get job status error:', error);
    return res.status(500).json({ error: 'Failed to get job status' });
  }
};

/**
 * Get job details (including all results)
 */
const getJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = getJobStatusFromService(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json({
      job: {
        id: job.id,
        status: job.status,
        total: job.total,
        sent: job.sent,
        failed: job.failed,
        totalCost: job.totalCost || 0,
        details: job.details,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.total > 0 ? Math.round(((job.sent + job.failed) / job.total) * 100) : 0,
      },
    });
  } catch (error) {
    logger.error('Get job details error:', error);
    return res.status(500).json({ error: 'Failed to get job details' });
  }
};

/**
 * Get reminder logs for user
 */
const getReminderLogs = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tenantId, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = { userId };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      ReminderLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('tenantId', 'name phone email unitNumber'),
      ReminderLog.countDocuments(query),
    ]);

    return res.status(200).json({
      logs: logs.map(log => ({
        id: log._id,
        tenantId: log.tenantId?._id,
        tenantName: log.tenantId?.name,
        tenantUnit: log.tenantId?.unitNumber,
        type: log.type,
        status: log.status,
        cost: log.cost,
        errorMessage: log.errorMessage,
        timestamp: log.timestamp,
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get reminder logs error:', error);
    return res.status(500).json({ error: 'Failed to fetch reminder logs' });
  }
};

/**
 * Get reminder statistics for user
 */
const getReminderStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.timestamp = {};
      if (startDate) dateQuery.timestamp.$gte = new Date(startDate);
      if (endDate) dateQuery.timestamp.$lte = new Date(endDate);
    }

    const [totalSent, totalFailed, totalCost, byType] = await Promise.all([
      ReminderLog.countDocuments({ userId, status: 'sent', ...dateQuery }),
      ReminderLog.countDocuments({ userId, status: 'failed', ...dateQuery }),
      ReminderLog.aggregate([
        { $match: { userId, status: 'sent', ...dateQuery } },
        { $group: { _id: null, total: { $sum: '$cost' } } },
      ]),
      ReminderLog.aggregate([
        { $match: { userId, ...dateQuery } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    const stats = {
      totalSent,
      totalFailed,
      totalCost: totalCost[0]?.total || 0,
      byType: {
        sms: byType.find(t => t._id === 'sms')?.count || 0,
        email: byType.find(t => t._id === 'email')?.count || 0,
      },
    };

    return res.status(200).json({ stats });
  } catch (error) {
    logger.error('Get reminder stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch reminder stats' });
  }
};

/**
 * ✅ NEW: Check available reminder methods
 */
const getAvailableMethods = async (req, res) => {
  try {
    const [smsEnabled, emailEnabled] = await Promise.all([
      FeatureFlag.isEnabled('sms_reminders'),
      FeatureFlag.isEnabled('email_reminders'),
    ]);

    const [smsFeature, emailFeature] = await Promise.all([
      FeatureFlag.findOne({ key: 'sms_reminders' }),
      FeatureFlag.findOne({ key: 'email_reminders' }),
    ]);

    return res.status(200).json({
      methods: {
        sms: {
          enabled: smsEnabled,
          available: smsEnabled,
          message: !smsEnabled ? smsFeature?.disabledMessage : null,
        },
        email: {
          enabled: emailEnabled,
          available: emailEnabled,
          message: !emailEnabled ? emailFeature?.disabledMessage : null,
        },
      },
      hasAnyMethod: smsEnabled || emailEnabled,
      recommendedMethod: smsEnabled ? 'sms' : emailEnabled ? 'email' : null,
    });
  } catch (error) {
    logger.error('Get available methods error:', error);
    return res.status(500).json({ error: 'Failed to check available methods' });
  }
};

module.exports = {
  sendReminders,
  getJobStatus,
  getJobDetails,
  getReminderLogs,
  getReminderStats,
  getAvailableMethods, // ✅ NEW
};