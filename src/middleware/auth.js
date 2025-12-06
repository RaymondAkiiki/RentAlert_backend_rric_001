const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const logger = require('../utils/logger');

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('⚠️ No Authorization header or invalid format');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      logger.warn('⚠️ No token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        logger.warn('⚠️ Token expired');
        return res.status(401).json({ error: 'Token expired' });
      }
      
      logger.warn('⚠️ Invalid token:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Find user in database
    const user = await User.findById(decoded.userId);

    if (!user) {
      logger.warn(`⚠️ User not found for token: ${decoded.userId}`);
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request
    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      dbId: user._id,
    };

    logger.info(`✅ Authenticated user: ${user.email} (${user._id})`);
    next();
  } catch (error) {
    logger.error('❌ Authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional authentication - doesn't block if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, continue without user
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user) {
        req.user = {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          dbId: user._id,
        };
      }
    } catch (err) {
      // Invalid token, but don't block request
      logger.debug('Optional auth failed:', err.message);
    }

    next();
  } catch (error) {
    logger.error('Optional auth error:', error);
    next();
  }
};

// Admin-only middleware
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      logger.warn(`🚫 Admin access denied for user: ${req.user.email}`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    logger.info(`✅ Admin access granted: ${req.user.email}`);
    next();
  } catch (error) {
    logger.error('Admin check error:', error);
    return res.status(500).json({ error: 'Authorization error' });
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
};