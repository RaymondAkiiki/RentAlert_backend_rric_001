const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const logger = require('../utils/logger');

// Validate Clerk configuration
const validateClerkConfig = () => {
  if (!process.env.CLERK_SECRET_KEY) {
    logger.error('CLERK_SECRET_KEY is not defined in environment variables');
    throw new Error('Missing Clerk configuration');
  }
  
  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    logger.error('CLERK_PUBLISHABLE_KEY is not defined in environment variables');
    throw new Error('Missing Clerk configuration');
  }

  logger.info('Clerk configuration validated');
  logger.info(`Clerk Secret Key starts with: ${process.env.CLERK_SECRET_KEY.substring(0, 15)}...`);
};

// Clerk middleware for all routes (IMPORTANT: This must be used in server.js)
const clerkAuth = clerkMiddleware();

// Custom require auth middleware for APIs (NO REDIRECT)
const requireAuthWithLogging = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  logger.info('=== INCOMING AUTH REQUEST ===');
  logger.info(`URL: ${req.method} ${req.originalUrl}`);
  logger.info(`Auth Header Present: ${!!authHeader}`);
  
  if (authHeader) {
    logger.info(`Auth Header starts with: ${authHeader.substring(0, 30)}...`);
  } else {
    logger.warn('⚠️ No Authorization header found');
  }
  
  // Get auth from request (set by clerkMiddleware)
  const auth = getAuth(req);
  
  if (!auth || !auth.userId) {
    logger.error('❌ No valid Clerk auth found');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  logger.info(`✅ Clerk auth successful - User ID: ${auth.userId}`);
  req.auth = auth; // Attach auth to request
  next();
};

module.exports = {
  validateClerkConfig,
  clerkAuth,
  requireAuth: requireAuthWithLogging,
  getAuth,
};