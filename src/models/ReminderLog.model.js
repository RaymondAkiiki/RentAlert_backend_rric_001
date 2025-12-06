const mongoose = require('mongoose');

const reminderLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    ref: 'User',
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Tenant',
  },
  type: {
    type: String,
    enum: ['sms', 'email'],
    required: true,
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    required: true,
  },
  cost: {
    type: Number,
    default: 0,
    min: 0,
  },
  errorMessage: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false,
});

// Compound indexes for analytics queries
reminderLogSchema.index({ userId: 1, timestamp: -1 });
reminderLogSchema.index({ type: 1, status: 1, timestamp: -1 });
reminderLogSchema.index({ tenantId: 1, timestamp: -1 });

// Static method to get reminder stats for a user
reminderLogSchema.statics.getStatsForUser = async function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId,
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          type: '$type',
          status: '$status',
        },
        count: { $sum: 1 },
        totalCost: { $sum: '$cost' },
      },
    },
  ]);
};

// Static method to get total cost for a user
reminderLogSchema.statics.getTotalCost = async function(userId, startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        userId,
        status: 'sent',
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$cost' },
      },
    },
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

const ReminderLog = mongoose.model('ReminderLog', reminderLogSchema);

module.exports = ReminderLog;