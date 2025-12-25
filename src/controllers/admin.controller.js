const User = require('../models/user.model');
const Property = require('../models/property.model');
const Tenant = require('../models/tenant.model');
const ReminderLog = require('../models/reminderlog.model');
const EventLog = require('../models/eventlog.model');
const Feedback = require('../models/feedback.model');
const logger = require('../utils/logger');
const {
  calculateRetentionRate,
  getMonthlyReminderTrend,
  getCostAnalysis,
  getSystemHealthMetrics,
} = require('../services/admin.service');

/**
 * Get comprehensive admin dashboard overview
 */
const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ===== OVERVIEW METRICS =====
    const [
      totalLandlords,
      totalProperties,
      totalTenants,
      totalTenantsLastMonth,
      remindersThisMonth,
      remindersLastMonth,
      activeLandlordsThisMonth,
      activeLandlordsLastMonth,
      newLandlordsThisMonth,
      newLandlordsLastWeek,
    ] = await Promise.all([
      User.countDocuments({ role: 'landlord' }),
      Property.countDocuments({ deletedAt: null }),
      Tenant.countDocuments({ deletedAt: null }),
      Tenant.countDocuments({ 
        deletedAt: null, 
        createdAt: { $lte: endOfLastMonth } 
      }),
      ReminderLog.countDocuments({
        timestamp: { $gte: startOfMonth },
        status: 'sent',
      }),
      ReminderLog.countDocuments({
        timestamp: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        status: 'sent',
      }),
      EventLog.distinct('userId', {
        createdAt: { $gte: startOfMonth },
      }).then(users => users.length),
      EventLog.distinct('userId', {
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }).then(users => users.length),
      User.countDocuments({
        role: 'landlord',
        createdAt: { $gte: startOfMonth },
      }),
      User.countDocuments({
        role: 'landlord',
        createdAt: { $gte: sevenDaysAgo },
      }),
    ]);

    // Calculate growth rates
    const landlordGrowth = totalLandlords > 0 
      ? ((newLandlordsThisMonth / totalLandlords) * 100).toFixed(1)
      : 0;
    
    const tenantGrowth = totalTenantsLastMonth > 0
      ? (((totalTenants - totalTenantsLastMonth) / totalTenantsLastMonth) * 100).toFixed(1)
      : 0;
    
    const reminderGrowth = remindersLastMonth > 0
      ? (((remindersThisMonth - remindersLastMonth) / remindersLastMonth) * 100).toFixed(1)
      : 0;

    const activeUserGrowth = activeLandlordsLastMonth > 0
      ? (((activeLandlordsThisMonth - activeLandlordsLastMonth) / activeLandlordsLastMonth) * 100).toFixed(1)
      : 0;

    // ===== ENGAGEMENT METRICS =====
    const [dailyActiveUsers, weeklyRetention] = await Promise.all([
      EventLog.getDailyActiveUsers(thirtyDaysAgo, now),
      calculateRetentionRate(sevenDaysAgo, now),
    ]);

    // ===== USAGE BREAKDOWN =====
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
      smsCost: reminderStats.find(s => s._id === 'sms')?.totalCost || 0,
      emailCost: 0,
    };

    // ===== TENANT STATUS DISTRIBUTION =====
    const tenantStatusStats = await Tenant.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const tenantStatus = {
      paid: tenantStatusStats.find(s => s._id === 'paid')?.count || 0,
      unpaid: tenantStatusStats.find(s => s._id === 'unpaid')?.count || 0,
      paymentRate: totalTenants > 0 
        ? ((tenantStatusStats.find(s => s._id === 'paid')?.count || 0) / totalTenants * 100).toFixed(1)
        : 0,
    };

    // ===== TOP LANDLORDS BY ACTIVITY =====
    const topLandlords = await EventLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: '$userId',
          activityCount: { $sum: 1 },
        },
      },
      {
        $sort: { activityCount: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    const topLandlordsWithDetails = await Promise.all(
      topLandlords.map(async (item) => {
        const user = await User.findById(item._id).select('name email');
        const [propertyCount, tenantCount, reminderCount] = await Promise.all([
          Property.countDocuments({ userId: item._id, deletedAt: null }),
          Tenant.countDocuments({ userId: item._id, deletedAt: null }),
          ReminderLog.countDocuments({ 
            userId: item._id, 
            status: 'sent',
            timestamp: { $gte: startOfMonth } 
          }),
        ]);

        return {
          userId: item._id,
          name: user?.name || 'Unknown',
          email: user?.email || 'Unknown',
          activityCount: item.activityCount,
          properties: propertyCount,
          tenants: tenantCount,
          reminders: reminderCount,
        };
      })
    );

    // ===== FEATURE ADOPTION =====
    const [csvImportUsers, multiPropertyUsers, emailUsers] = await Promise.all([
      EventLog.distinct('userId', { eventType: 'TENANT_IMPORTED' }).then(u => u.length),
      Property.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: 'total' },
      ]).then(result => result[0]?.total || 0),
      ReminderLog.distinct('userId', { 
        type: 'email', 
        status: 'sent' 
      }).then(u => u.length),
    ]);

    const featureAdoption = {
      csvImport: {
        users: csvImportUsers,
        percentage: totalLandlords > 0 ? ((csvImportUsers / totalLandlords) * 100).toFixed(1) : 0,
      },
      multipleProperties: {
        users: multiPropertyUsers,
        percentage: totalLandlords > 0 ? ((multiPropertyUsers / totalLandlords) * 100).toFixed(1) : 0,
      },
      emailReminders: {
        users: emailUsers,
        percentage: totalLandlords > 0 ? ((emailUsers / totalLandlords) * 100).toFixed(1) : 0,
      },
    };

    // ===== RECENT FEEDBACK =====
    const recentFeedback = await Feedback.find({ status: 'new' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name email');

    // ===== SYSTEM HEALTH =====
    const systemHealth = await getSystemHealthMetrics();

    // Calculate averages
    const avgTenantsPerLandlord = totalLandlords > 0 
      ? (totalTenants / totalLandlords).toFixed(1) 
      : 0;
    
    const avgPropertiesPerLandlord = totalLandlords > 0
      ? (totalProperties / totalLandlords).toFixed(1)
      : 0;
    
    const avgRemindersPerActiveLandlord = activeLandlordsThisMonth > 0
      ? (remindersThisMonth / activeLandlordsThisMonth).toFixed(1)
      : 0;

    return res.status(200).json({
      overview: {
        totalLandlords,
        totalProperties,
        totalTenants,
        remindersThisMonth,
        activeLandlordsThisMonth,
        newLandlordsThisMonth,
        newLandlordsLastWeek,
        avgTenantsPerLandlord: parseFloat(avgTenantsPerLandlord),
        avgPropertiesPerLandlord: parseFloat(avgPropertiesPerLandlord),
        avgRemindersPerActiveLandlord: parseFloat(avgRemindersPerActiveLandlord),
      },
      growth: {
        landlords: parseFloat(landlordGrowth),
        tenants: parseFloat(tenantGrowth),
        reminders: parseFloat(reminderGrowth),
        activeUsers: parseFloat(activeUserGrowth),
      },
      engagement: {
        dailyActiveUsers: dailyActiveUsers.map(e => ({
          date: e._id,
          count: e.activeUsers,
        })),
        weeklyRetention: weeklyRetention,
        totalActiveUsers: activeLandlordsThisMonth,
      },
      usageBreakdown,
      tenantStatus,
      topLandlords: topLandlordsWithDetails,
      featureAdoption,
      recentFeedback: recentFeedback.map(f => ({
        id: f._id,
        userName: f.userId?.name || 'Anonymous',
        rating: f.rating,
        message: f.message.substring(0, 100),
        createdAt: f.createdAt,
      })),
      systemHealth,
    });
  } catch (error) {
    logger.error('Get admin dashboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

/**
 * Get all landlords with comprehensive stats
 */
const getLandlords = async (req, res) => {
  try {
    const { 
      active, 
      sortBy = 'createdAt', 
      order = 'desc',
      search,
      page = 1, 
      limit = 50 
    } = req.query;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build query
    const query = { role: 'landlord' };

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Sorting
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };

    // Fetch landlords with pagination
    const skip = (Number(page) - 1) * Number(limit);
    const landlords = await User.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    // Get comprehensive stats for each landlord
    const landlordsWithStats = await Promise.all(
      landlords.map(async (landlord) => {
        const landlordId = landlord._id.toString();
        
        const [
          propertyCount, 
          tenantCount, 
          reminderCountMonth,
          reminderCountTotal,
          lastActive,
          totalCostMonth,
        ] = await Promise.all([
          Property.countDocuments({ userId: landlordId, deletedAt: null }),
          Tenant.countDocuments({ userId: landlordId, deletedAt: null }),
          ReminderLog.countDocuments({
            userId: landlordId,
            status: 'sent',
            timestamp: { $gte: thirtyDaysAgo },
          }),
          ReminderLog.countDocuments({
            userId: landlordId,
            status: 'sent',
          }),
          EventLog.findOne({ userId: landlordId })
            .sort({ createdAt: -1 })
            .select('createdAt'),
          ReminderLog.aggregate([
            {
              $match: {
                userId: landlordId,
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
        ]);

        const isActive = lastActive && lastActive.createdAt >= thirtyDaysAgo;
        const daysSinceActive = lastActive 
          ? Math.floor((now - lastActive.createdAt) / (1000 * 60 * 60 * 24))
          : null;

        return {
          id: landlordId,
          name: landlord.name,
          email: landlord.email,
          phone: landlord.phone,
          propertyCount,
          tenantCount,
          reminderCountMonth,
          reminderCountTotal,
          totalCostMonth: totalCostMonth.toFixed(2),
          lastActive: lastActive?.createdAt || null,
          daysSinceActive,
          isActive,
          createdAt: landlord.createdAt,
        };
      })
    );

    // Filter by active status if requested
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
 * Get single landlord with detailed analytics
 */
const getLandlordDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const landlord = await User.findOne({ _id: id, role: 'landlord' });
    if (!landlord) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    const landlordId = landlord._id.toString();

    // Get comprehensive data
    const [
      properties, 
      tenants, 
      reminderStats, 
      eventCounts,
      activityTimeline,
      monthlyReminderTrend,
      costAnalysis,
    ] = await Promise.all([
      Property.find({ userId: landlordId, deletedAt: null }),
      Tenant.find({ userId: landlordId, deletedAt: null }).populate('propertyId', 'name'),
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
        { $sort: { count: -1 } },
      ]),
      EventLog.find({ userId: landlordId })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('eventType metadata createdAt'),
      getMonthlyReminderTrend(landlordId, 6),
      getCostAnalysis(landlordId),
    ]);

    // Tenant status breakdown
    const tenantStatusBreakdown = {
      paid: tenants.filter(t => t.status === 'paid').length,
      unpaid: tenants.filter(t => t.status === 'unpaid').length,
    };

    // Property with tenant counts
    const propertiesWithTenants = properties.map(p => {
      const propertyTenants = tenants.filter(t => 
        t.propertyId._id.toString() === p._id.toString()
      );
      return {
        id: p._id,
        name: p.name,
        address: p.address,
        tenantCount: propertyTenants.length,
        paidTenants: propertyTenants.filter(t => t.status === 'paid').length,
        unpaidTenants: propertyTenants.filter(t => t.status === 'unpaid').length,
        createdAt: p.createdAt,
      };
    });

    return res.status(200).json({
      landlord: {
        id: landlordId,
        name: landlord.name,
        email: landlord.email,
        phone: landlord.phone,
        createdAt: landlord.createdAt,
      },
      summary: {
        totalProperties: properties.length,
        totalTenants: tenants.length,
        ...tenantStatusBreakdown,
      },
      properties: propertiesWithTenants,
      tenants: tenants.map(t => ({
        id: t._id,
        name: t.name,
        phone: t.phone,
        email: t.email,
        unitNumber: t.unitNumber,
        rentAmount: t.rentAmount,
        dueDate: t.dueDate,
        status: t.status,
        propertyName: t.propertyId.name,
        lastReminderSentAt: t.lastReminderSentAt,
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
      activityTimeline: activityTimeline.map(event => ({
        id: event._id,
        type: event.eventType,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
      monthlyReminderTrend,
      costAnalysis,
    });
  } catch (error) {
    logger.error('Get landlord details error:', error);
    return res.status(500).json({ error: 'Failed to fetch landlord details' });
  }
};

/**
 * Get usage patterns and insights
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

    // Reminder frequency distribution
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
                { case: { $lte: ['$count', 50] }, then: '21-50' },
              ],
              default: '50+',
            },
          },
          landlordCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Feature adoption rates
    const [
      csvImportUsers,
      multiPropertyUsers,
      emailUsers,
      bothMethodsUsers,
      totalLandlords,
    ] = await Promise.all([
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
      ReminderLog.aggregate([
        {
          $match: {
            status: 'sent',
            ...(dateQuery.createdAt && { timestamp: dateQuery.createdAt }),
          },
        },
        {
          $group: {
            _id: '$userId',
            types: { $addToSet: '$type' },
          },
        },
        {
          $match: {
            types: { $all: ['sms', 'email'] },
          },
        },
        {
          $count: 'total',
        },
      ]).then(result => result[0]?.total || 0),
      User.countDocuments({ role: 'landlord' }),
    ]);

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
        $facet: {
          summary: [
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
                partiallyPaid: {
                  $sum: { $cond: [
                    { $and: [
                      { $gte: ['$paidRatio', 50] },
                      { $lt: ['$paidRatio', 100] }
                    ]},
                    1,
                    0
                  ]},
                },
              },
            },
          ],
        },
      },
    ]);

    return res.status(200).json({
      reminderFrequency: reminderFrequency.reduce((acc, item) => {
        acc[item._id] = item.landlordCount;
        return acc;
      }, {}),
      featureAdoption: {
        csvImport: {
          users: csvImportUsers,
          percentage: totalLandlords > 0 ? ((csvImportUsers / totalLandlords) * 100).toFixed(1) : 0,
        },
        multipleProperties: {
          users: multiPropertyUsers,
          percentage: totalLandlords > 0 ? ((multiPropertyUsers / totalLandlords) * 100).toFixed(1) : 0,
        },
        emailPreference: {
          users: emailUsers,
          percentage: totalLandlords > 0 ? ((emailUsers / totalLandlords) * 100).toFixed(1) : 0,
        },
        bothMethods: {
          users: bothMethodsUsers,
          percentage: totalLandlords > 0 ? ((bothMethodsUsers / totalLandlords) * 100).toFixed(1) : 0,
        },
      },
      tenantStatusPatterns: tenantPatterns[0].summary[0] || {
        avgPaidRatio: 0,
        fullyPaid: 0,
        mostlyUnpaid: 0,
        partiallyPaid: 0,
      },
    });
  } catch (error) {
    logger.error('Get usage patterns error:', error);
    return res.status(500).json({ error: 'Failed to fetch usage patterns' });
  }
};

/**
 * Get system health and performance metrics
 */
const getSystemHealth = async (req, res) => {
  try {
    const health = await getSystemHealthMetrics();
    return res.status(200).json(health);
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