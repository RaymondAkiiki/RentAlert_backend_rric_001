const logger = require('../utils/logger');

// Not found middleware (404)
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.userId || 'unauthenticated',
  });

  // Default to 500 if status code not set
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      details: err.message,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      error: `Duplicate value for ${field}`,
      details: `${field} already exists`,
    });
  }

  // Clerk authentication error
  if (err.message && err.message.includes('Clerk')) {
    return res.status(401).json({
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Invalid or expired token',
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
    });
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
    });
  }

  // Default error response
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  notFound,
  errorHandler,
};