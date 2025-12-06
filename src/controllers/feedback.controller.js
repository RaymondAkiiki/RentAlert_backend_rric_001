const Feedback = require('../models/feedback.model');
const EventLog = require('../models/eventlog.model');
const logger = require('../utils/logger');
const { validateFeedbackMessage, validateRating } = require('../utils/validators');

/**
 * Submit feedback (landlord)
 */
const submitFeedback = async (req, res) => {
  try {
    const { rating, message, anonymous } = req.body;
    const userId = req.user.userId;

    // Validate message
    if (!message || !validateFeedbackMessage(message)) {
      return res.status(400).json({
        error: 'Feedback message must be between 10 and 500 characters',
      });
    }

    // Validate rating if provided
    if (rating && !validateRating(rating)) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5',
      });
    }

    // Create feedback
    const feedback = await Feedback.create({
      userId: anonymous ? null : userId,
      rating: rating || null,
      message,
      anonymous: anonymous || false,
      status: 'new',
    });

    // Log event
    await EventLog.logEvent(userId, 'FEEDBACK_SUBMITTED');

    logger.info(`Feedback submitted by user: ${userId}`);

    return res.status(201).json({
      message: 'Thank you for your feedback!',
      feedback: {
        id: feedback._id,
        rating: feedback.rating,
        message: feedback.message,
        anonymous: feedback.anonymous,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    logger.error('Submit feedback error:', error);
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

/**
 * Get all feedback (admin only)
 */
const getAllFeedback = async (req, res) => {
  try {
    const { rating, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    // Build query
    const query = {};

    if (rating) {
      query.rating = Number(rating);
    }

    if (status && ['new', 'reviewed', 'resolved'].includes(status)) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Fetch feedback
    const [feedback, total] = await Promise.all([
      Feedback.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email'),
      Feedback.countDocuments(query),
    ]);

    return res.status(200).json({
      feedback: feedback.map(f => ({
        id: f._id,
        userId: f.userId?._id || null,
        userName: f.userId?.name || 'Anonymous',
        userEmail: f.userId?.email || null,
        rating: f.rating,
        message: f.message,
        anonymous: f.anonymous,
        status: f.status,
        createdAt: f.createdAt,
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get feedback error:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};

/**
 * Update feedback status (admin only)
 */
const updateFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['new', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be "new", "reviewed", or "resolved"',
      });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    feedback.status = status;
    await feedback.save();

    logger.info(`Feedback ${id} status updated to ${status}`);

    return res.status(200).json({
      message: 'Feedback status updated',
      feedback: {
        id: feedback._id,
        status: feedback.status,
      },
    });
  } catch (error) {
    logger.error('Update feedback status error:', error);
    return res.status(500).json({ error: 'Failed to update feedback status' });
  }
};

/**
 * Get feedback statistics (admin only)
 */
const getFeedbackStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    const [avgRating, statusCounts, ratingDistribution] = await Promise.all([
      Feedback.aggregate([
        { $match: { rating: { $ne: null }, ...dateQuery } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $match: dateQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $match: { rating: { $ne: null }, ...dateQuery } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return res.status(200).json({
      stats: {
        avgRating: avgRating[0]?.avg.toFixed(1) || 0,
        totalRatings: avgRating[0]?.count || 0,
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        ratingDistribution: ratingDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    logger.error('Get feedback stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback stats' });
  }
};

module.exports = {
  submitFeedback,
  getAllFeedback,
  updateFeedbackStatus,
  getFeedbackStats,
};