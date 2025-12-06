const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: {
    type: String,
    ref: 'User',
    default: null,
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },
  message: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 500,
    trim: true,
  },
  anonymous: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['new', 'reviewed', 'resolved'],
    default: 'new',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for filtering
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ rating: 1, createdAt: -1 });
feedbackSchema.index({ userId: 1, createdAt: -1 });

// Instance method to mark as reviewed
feedbackSchema.methods.markAsReviewed = function() {
  this.status = 'reviewed';
  return this.save();
};

// Instance method to mark as resolved
feedbackSchema.methods.markAsResolved = function() {
  this.status = 'resolved';
  return this.save();
};

// Static method to get average rating
feedbackSchema.statics.getAverageRating = async function(startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        rating: { $ne: null },
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);
  
  return result.length > 0 ? result[0] : { avgRating: 0, count: 0 };
};

// Static method to get feedback stats
feedbackSchema.statics.getStats = async function(startDate, endDate) {
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
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
};

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;