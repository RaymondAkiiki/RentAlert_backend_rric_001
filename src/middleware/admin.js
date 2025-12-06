const logger = require('../utils/logger');

// Middleware to check if user has admin role
const requireAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      logger.warn(`Unauthorized admin access attempt by user: ${req.user.id}`);
      return res.status(403).json({ 
        error: 'Admin access required. You do not have permission to access this resource.',
      });
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    return res.status(500).json({ error: 'Authorization error' });
  }
};

// Middleware to check if user is landlord (not admin)
const requireLandlord = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'landlord') {
      return res.status(403).json({ 
        error: 'Landlord access required',
      });
    }

    next();
  } catch (error) {
    logger.error('Landlord middleware error:', error);
    return res.status(500).json({ error: 'Authorization error' });
  }
};

module.exports = {
  requireAdmin,
  requireLandlord,
};