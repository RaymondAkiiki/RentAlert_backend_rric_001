const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    ref: 'User',
  },
  eventType: {
    type: String,
    enum: [
      'USER_LOGGED_IN',
      'PROPERTY_ADDED',
      'TENANT_ADDED',
      'TENANT_IMPORTED',
      'RENT_STATUS_UPDATED',
      'REMINDERS_SENT',
      'MONTHLY_REMINDER_SENT',
      'DASHBOARD_VISITED',
      'FEEDBACK_SUBMITTED',
      'FEATURE_FLAG_TOGGLED', 
    ],
    required: true,
    index: true,
  },
  metadata: {
    type: Object,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false,
});

// Compound index for admin analytics
eventLogSchema.index({ eventType: 1, createdAt: -1 });
eventLogSchema.index({ userId: 1, createdAt: -1 });

// Static method to get event counts by type
eventLogSchema.statics.getEventCounts = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

// Static method to get daily active users
eventLogSchema.statics.getDailyActiveUsers = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          userId: '$userId',
        },
      },
    },
    {
      $group: {
        _id: '$_id.date',
        activeUsers: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
};

// Static method to get user activity count
eventLogSchema.statics.getUserActivityCount = async function(userId, startDate, endDate) {
  return this.countDocuments({
    userId,
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  });
};

// Static method to log an event
eventLogSchema.statics.logEvent = async function(userId, eventType, metadata = {}) {
  try {
    await this.create({
      userId,
      eventType,
      metadata,
    });
  } catch (error) {
    // Silent fail - don't block user actions
    console.error('Event logging failed:', error.message);
  }
};

const EventLog = mongoose.model('EventLog', eventLogSchema);

module.exports = EventLog;