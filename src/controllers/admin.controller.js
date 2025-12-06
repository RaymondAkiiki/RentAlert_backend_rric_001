const User = require('../models/user.model');
const Property = require('../models/property.model');
const Tenant = require('../models/tenant.model');
const ReminderLog = require('../models/reminderlog.model');
const EventLog = require('../models/eventlog.model');
const Feedback = require('../models/feedback.model');
const logger = require('../utils/logger');

/**
 * Get admin dashboard overview
 */
const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Overview metrics
    const [
      totalLandlords,
      totalProperties,
      totalTenants,
      remindersThisMonth,
      activeLandlordsThisMonth,
      newLandlordsThisMonth,
    ] = await Promise.all([
      User.countDocuments({ role: 'landlord' }),
      Property.countDocuments({ deletedAt: null }),
      Tenant.countDocuments({ deletedAt: null }),
      ReminderLog.countDocuments({
        timestamp: { $gte: startOfMonth },
        status: 'sent',
      }),
      EventLog.distinct('userId', {
        createdAt: { $gte: startOfMonth },
      }).then(users => users.length),
      User.countDocuments({
        role: 'landlord',
        createdAt: { $gte: startOfMonth },
      }),
    ]);

    // Engagement over last 30 days (daily active users)
    const engagement = await EventLog.getDailyActiveUsers(thirtyDaysAgo, now);

    // Usage breakdown (SMS vs Email)
    const reminderStats = await ReminderLog.aggregate([
      {
        $match: {
          timestamp: { $gte: startOfMonth },
          status: 'sent',
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalCost: { $sum: '$cost' },
        },
      },
    ]);

    const usageBreakdown = {
      sms: reminderStats.find(s => s._id === 'sms')?.count || 0,
      email: reminderStats.find(s => s._id === 'email')?.count || 0,
      totalCost: reminderStats.reduce((sum, s) => sum + (s.totalCost || 0), 0),
    };

    // Calculate averages
    const avgTenantsPerLandlord = totalLandlords > 0 
      ? (totalTenants / totalLandlords).toFixed(1) 
      : 0;
    
    const avgRemindersPerLandlord = activeLandlordsThisMonth > 0
      ? (remindersThisMonth / activeLandlordsThisMonth).toFixed(1)
      : 0;

    // Recent activity (last 10 events)
    const recentActivity = await EventLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name email');

    return res.status(200).json({
      overview: {
        totalLandlords,
        totalProperties,
        totalTenants,
        remindersThisMonth,
        activeLandlordsThisMonth,
        newLandlordsThisMonth,
        avgTenantsPerLandlord: parseFloat(avgTenantsPerLandlord),
        avgRemindersPerLandlord: parseFloat(avgRemindersPerLandlord),
      },
      engagement: engagement.map(e => ({
        date: e._id,
        activeUsers: e.activeUsers,
      })),
      usageBreakdown,
      recentActivity: recentActivity.map(event => ({
        id: event._id,
        userId: event.userId,
        eventType: event.eventType,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Get admin dashboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

/**
 * Get all landlords with stats
 */
const getLandlords = async (req, res) => {
  try {
    const { active, sortBy = 'createdAt', page = 1, limit = 50 } = req.query;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build query
    const query = { role: 'landlord' };

    // Fetch landlords
    const skip = (Number(page) - 1) * Number(limit);
    const landlords = await User.find(query)
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Get stats for each landlord
    const landlordsWithStats = await Promise.all(
      landlords.map(async (landlord) => {
        // Use MongoDB _id instead of clerkId
        const landlordId = landlord._id.toString();
        
        const [propertyCount, tenantCount, reminderCount, lastActive] = await Promise.all([
          Property.countDocuments({ userId: landlordId, deletedAt: null }),
          Tenant.countDocuments({ userId: landlordId, deletedAt: null }),
          ReminderLog.countDocuments({
            userId: landlordId,
            status: 'sent',
            timestamp: { $gte: thirtyDaysAgo },
          }),
          EventLog.findOne({ userId: landlordId })
            .sort({ createdAt: -1 })
            .select('createdAt'),
        ]);

        const isActive = lastActive && lastActive.createdAt >= thirtyDaysAgo;

        return {
          id: landlordId,
          name: landlord.name,
          email: landlord.email,
          phone: landlord.phone,
          propertyCount,
          tenantCount,
          reminderCount,
          lastActive: lastActive?.createdAt || null,
          isActive,
          createdAt: landlord.createdAt,
        };
      })
    );

    // Filter by active if requested
    let filteredLandlords = landlordsWithStats;
    if (active === 'true') {
      filteredLandlords = landlordsWithStats.filter(l => l.isActive);
    } else if (active === 'false') {
      filteredLandlords = landlordsWithStats.filter(l => !l.isActive);
    }

    const total = await User.countDocuments(query);

    return res.status(200).json({
      landlords: filteredLandlords,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get landlords error:', error);
    return res.status(500).json({ error: 'Failed to fetch landlords' });
  }
};

/**
 * Get single landlord details
 */
const getLandlordDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Find by MongoDB _id instead of clerkId
    const landlord = await User.findOne({ _id: id, role: 'landlord' });
    if (!landlord) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    const landlordId = landlord._id.toString();

    const [properties, tenants, reminderStats, eventCounts] = await Promise.all([
      Property.find({ userId: landlordId, deletedAt: null }),
      Tenant.find({ userId: landlordId, deletedAt: null }),
      ReminderLog.aggregate([
        { $match: { userId: landlordId } },
        {
          $group: {
            _id: { type: '$type', status: '$status' },
            count: { $sum: 1 },
            totalCost: { $sum: '$cost' },
          },
        },
      ]),
      EventLog.aggregate([
        { $match: { userId: landlordId } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      landlord: {
        id: landlordId,
        name: landlord.name,
        email: landlord.email,
        phone: landlord.phone,
        createdAt: landlord.createdAt,
      },
      properties: properties.map(p => ({
        id: p._id,
        name: p.name,
        address: p.address,
        createdAt: p.createdAt,
      })),
      tenants: tenants.map(t => ({
        id: t._id,
        name: t.name,
        unitNumber: t.unitNumber,
        rentAmount: t.rentAmount,
        status: t.status,
        createdAt: t.createdAt,
      })),
      reminderStats: reminderStats.reduce((acc, stat) => {
        const key = `${stat._id.type}_${stat._id.status}`;
        acc[key] = {
          count: stat.count,
          totalCost: stat.totalCost || 0,
        };
        return acc;
      }, {}),
      eventCounts: eventCounts.reduce((acc, event) => {
        acc[event._id] = event.count;
        return acc;
      }, {}),
    });
  } catch (error) {
    logger.error('Get landlord details error:', error);
    return res.status(500).json({ error: 'Failed to fetch landlord details' });
  }
};

/**
 * Get usage patterns
 */
const getUsagePatterns = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    // Reminder frequency (how many reminders per landlord)
    const reminderFrequency = await ReminderLog.aggregate([
      {
        $match: {
          status: 'sent',
          ...(dateQuery.createdAt && { timestamp: dateQuery.createdAt }),
        },
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ['$count', 5] }, then: '1-5' },
                { case: { $lte: ['$count', 10] }, then: '6-10' },
                { case: { $lte: ['$count', 20] }, then: '11-20' },
              ],
              default: '20+',
            },
          },
          landlordCount: { $sum: 1 },
        },
      },
    ]);

    // Feature adoption
    const [csvImportUsers, multiPropertyUsers, emailUsers] = await Promise.all([
      EventLog.distinct('userId', {
        eventType: 'TENANT_IMPORTED',
        ...dateQuery,
      }).then(users => users.length),
      Property.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: 'total' },
      ]).then(result => result[0]?.total || 0),
      ReminderLog.distinct('userId', {
        type: 'email',
        status: 'sent',
        ...(dateQuery.createdAt && { timestamp: dateQuery.createdAt }),
      }).then(users => users.length),
    ]);

    const totalLandlords = await User.countDocuments({ role: 'landlord' });

    // Tenant status patterns
    const tenantPatterns = await Tenant.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$userId',
          total: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          unpaid: { $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] } },
        },
      },
      {
        $project: {
          userId: '$_id',
          total: 1,
          paid: 1,
          unpaid: 1,
          paidRatio: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$paid', '$total'] }, 100] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgPaidRatio: { $avg: '$paidRatio' },
          fullyPaid: {
            $sum: { $cond: [{ $eq: ['$paidRatio', 100] }, 1, 0] },
          },
          mostlyUnpaid: {
            $sum: { $cond: [{ $lt: ['$paidRatio', 50] }, 1, 0] },
          },
        },
      },
    ]);

    return res.status(200).json({
      reminderFrequency: reminderFrequency.reduce((acc, item) => {
        acc[item._id] = item.landlordCount;
        return acc;
      }, {}),
      featureAdoption: {
        csvImport: totalLandlords > 0 ? Math.round((csvImportUsers / totalLandlords) * 100) : 0,
        multipleProperties: totalLandlords > 0 ? Math.round((multiPropertyUsers / totalLandlords) * 100) : 0,
        emailPreference: totalLandlords > 0 ? Math.round((emailUsers / totalLandlords) * 100) : 0,
      },
      tenantStatusPatterns: tenantPatterns[0] || {
        avgPaidRatio: 0,
        fullyPaid: 0,
        mostlyUnpaid: 0,
      },
    });
  } catch (error) {
    logger.error('Get usage patterns error:', error);
    return res.status(500).json({ error: 'Failed to fetch usage patterns' });
  }
};

/**
 * Get system health metrics
 */
const getSystemHealth = async (req, res) => {
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
      properties: await Property.countDocuments({ deletedAt: null }),
      tenants: await Tenant.countDocuments({ deletedAt: null }),
      reminders: await ReminderLog.countDocuments(),
      events: await EventLog.countDocuments(),
    };

    return res.status(200).json({
      sms: {
        total: smsTotal,
        successful: smsSuccess,
        failed: smsFailed,
        successRate: smsTotal > 0 ? ((smsSuccess / smsTotal) * 100).toFixed(1) : 0,
      },
      email: {
        total: emailTotal,
        successful: emailSuccess,
        failed: emailFailed,
        successRate: emailTotal > 0 ? ((emailSuccess / emailTotal) * 100).toFixed(1) : 0,
      },
      database: dbStats,
      timestamp: now,
    });
  } catch (error) {
    logger.error('Get system health error:', error);
    return res.status(500).json({ error: 'Failed to fetch system health' });
  }
};

module.exports = {
  getDashboard,
  getLandlords,
  getLandlordDetails,
  getUsagePatterns,
  getSystemHealth,
};