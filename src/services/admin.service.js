/**
 * Admin Service - Helper Functions
 * Reusable functions for admin analytics
 */

const ReminderLog = require('../models/reminderlog.model');
const EventLog = require('../models/eventlog.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');

/**
 * Calculate retention rate
 */
async function calculateRetentionRate(startDate, endDate) {
  try {
    // Get users who were active in the period
    const activeUsers = await EventLog.distinct('userId', {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    // Get users who joined before this period
    const existingUsers = await User.find({
      role: 'landlord',
      createdAt: { $lt: startDate },
    }).distinct('_id');

    // Calculate how many existing users were active
    const retainedUsers = activeUsers.filter(userId =>
      existingUsers.some(id => id.toString() === userId)
    );

    const retentionRate = existingUsers.length > 0
      ? ((retainedUsers.length / existingUsers.length) * 100).toFixed(1)
      : 0;

    return {
      total: existingUsers.length,
      retained: retainedUsers.length,
      rate: parseFloat(retentionRate),
    };
  } catch (error) {
    logger.error('Calculate retention rate error:', error);
    return { total: 0, retained: 0, rate: 0 };
  }
}

/**
 * Get monthly reminder trend for a landlord
 */
async function getMonthlyReminderTrend(userId, months = 6) {
  try {
    const now = new Date();
    const results = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const [smsCount, emailCount, totalCost] = await Promise.all([
        ReminderLog.countDocuments({
          userId,
          type: 'sms',
          status: 'sent',
          timestamp: { $gte: monthStart, $lte: monthEnd },
        }),
        ReminderLog.countDocuments({
          userId,
          type: 'email',
          status: 'sent',
          timestamp: { $gte: monthStart, $lte: monthEnd },
        }),
        ReminderLog.aggregate([
          {
            $match: {
              userId,
              status: 'sent',
              timestamp: { $gte: monthStart, $lte: monthEnd },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$cost' },
            },
          },
        ]).then(result => result[0]?.total || 0),
      ]);

      results.push({
        month: monthStart.toISOString().slice(0, 7), // YYYY-MM format
        sms: smsCount,
        email: emailCount,
        total: smsCount + emailCount,
        cost: totalCost,
      });
    }

    return results;
  } catch (error) {
    logger.error('Get monthly reminder trend error:', error);
    return [];
  }
}

/**
 * Get cost analysis for a landlord
 */
async function getCostAnalysis(userId) {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalCostAllTime, totalCostMonth, avgCostPerReminder, costByType] =
      await Promise.all([
        ReminderLog.aggregate([
          {
            $match: {
              userId,
              status: 'sent',
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
              userId,
              status: 'sent',
              timestamp: { $gte: thirtyDaysAgo },
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
              userId,
              status: 'sent',
            },
          },
          {
            $group: {
              _id: null,
              avg: { $avg: '$cost' },
            },
          },
        ]).then(result => result[0]?.avg || 0),
        ReminderLog.aggregate([
          {
            $match: {
              userId,
              status: 'sent',
            },
          },
          {
            $group: {
              _id: '$type',
              total: { $sum: '$cost' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    return {
      totalCostAllTime: totalCostAllTime.toFixed(2),
      totalCostMonth: totalCostMonth.toFixed(2),
      avgCostPerReminder: avgCostPerReminder.toFixed(2),
      byType: {
        sms: {
          cost: costByType.find(t => t._id === 'sms')?.total.toFixed(2) || '0.00',
          count: costByType.find(t => t._id === 'sms')?.count || 0,
        },
        email: {
          cost: '0.00', // Email is free
          count: costByType.find(t => t._id === 'email')?.count || 0,
        },
      },
    };
  } catch (error) {
    logger.error('Get cost analysis error:', error);
    return {
      totalCostAllTime: '0.00',
      totalCostMonth: '0.00',
      avgCostPerReminder: '0.00',
      byType: {
        sms: { cost: '0.00', count: 0 },
        email: { cost: '0.00', count: 0 },
      },
    };
  }
}

/**
 * Get system health metrics
 */
async function getSystemHealthMetrics() {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // SMS delivery stats
    const [smsTotal, smsSuccess, smsFailed] = await Promise.all([
      ReminderLog.countDocuments({
        type: 'sms',
        timestamp: { $gte: last24Hours },
      }),
      ReminderLog.countDocuments({
        type: 'sms',
        status: 'sent',
        timestamp: { $gte: last24Hours },
      }),
      ReminderLog.countDocuments({
        type: 'sms',
        status: 'failed',
        timestamp: { $gte: last24Hours },
      }),
    ]);

    // Email delivery stats
    const [emailTotal, emailSuccess, emailFailed] = await Promise.all([
      ReminderLog.countDocuments({
        type: 'email',
        timestamp: { $gte: last24Hours },
      }),
      ReminderLog.countDocuments({
        type: 'email',
        status: 'sent',
        timestamp: { $gte: last24Hours },
      }),
      ReminderLog.countDocuments({
        type: 'email',
        status: 'failed',
        timestamp: { $gte: last24Hours },
      }),
    ]);

    // Database stats
    const dbStats = {
      users: await User.countDocuments(),
      landlords: await User.countDocuments({ role: 'landlord' }),
      admins: await User.countDocuments({ role: 'admin' }),
      properties: await require('../models/property.model').countDocuments({
        deletedAt: null,
      }),
      tenants: await require('../models/tenant.model').countDocuments({
        deletedAt: null,
      }),
      reminders: await ReminderLog.countDocuments(),
      events: await EventLog.countDocuments(),
      feedback: await require('../models/feedback.model').countDocuments(),
    };

    // Calculate success rates
    const smsSuccessRate = smsTotal > 0 
      ? ((smsSuccess / smsTotal) * 100).toFixed(1) 
      : 0;
    
    const emailSuccessRate = emailTotal > 0 
      ? ((emailSuccess / emailTotal) * 100).toFixed(1) 
      : 0;

    // Determine health status
    const overallHealth = {
      sms: parseFloat(smsSuccessRate) >= 95 ? 'healthy' : 
            parseFloat(smsSuccessRate) >= 80 ? 'warning' : 'critical',
      email: parseFloat(emailSuccessRate) >= 95 ? 'healthy' : 
              parseFloat(emailSuccessRate) >= 80 ? 'warning' : 'critical',
    };

    return {
      sms: {
        total: smsTotal,
        successful: smsSuccess,
        failed: smsFailed,
        successRate: parseFloat(smsSuccessRate),
        status: overallHealth.sms,
      },
      email: {
        total: emailTotal,
        successful: emailSuccess,
        failed: emailFailed,
        successRate: parseFloat(emailSuccessRate),
        status: overallHealth.email,
      },
      database: dbStats,
      overall: {
        status: overallHealth.sms === 'healthy' && overallHealth.email === 'healthy' 
          ? 'healthy' 
          : 'warning',
      },
      timestamp: now,
    };
  } catch (error) {
    logger.error('Get system health metrics error:', error);
    return {
      sms: { total: 0, successful: 0, failed: 0, successRate: 0, status: 'unknown' },
      email: { total: 0, successful: 0, failed: 0, successRate: 0, status: 'unknown' },
      database: {},
      overall: { status: 'error' },
      timestamp: new Date(),
    };
  }
}

/**
 * Get platform-wide statistics
 */
async function getPlatformStats(startDate, endDate) {
  try {
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    const [
      totalUsers,
      totalProperties,
      totalTenants,
      totalReminders,
      totalEvents,
      totalFeedback,
    ] = await Promise.all([
      User.countDocuments({ role: 'landlord', ...dateQuery }),
      require('../models/property.model').countDocuments({
        deletedAt: null,
        ...dateQuery,
      }),
      require('../models/tenant.model').countDocuments({
        deletedAt: null,
        ...dateQuery,
      }),
      ReminderLog.countDocuments({
        status: 'sent',
        ...(dateQuery.createdAt && { timestamp: dateQuery.createdAt }),
      }),
      EventLog.countDocuments(dateQuery),
      require('../models/feedback.model').countDocuments(dateQuery),
    ]);

    return {
      users: totalUsers,
      properties: totalProperties,
      tenants: totalTenants,
      reminders: totalReminders,
      events: totalEvents,
      feedback: totalFeedback,
    };
  } catch (error) {
    logger.error('Get platform stats error:', error);
    return {
      users: 0,
      properties: 0,
      tenants: 0,
      reminders: 0,
      events: 0,
      feedback: 0,
    };
  }
}

module.exports = {
  calculateRetentionRate,
  getMonthlyReminderTrend,
  getCostAnalysis,
  getSystemHealthMetrics,
  getPlatformStats,
};