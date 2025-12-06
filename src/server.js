require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { validateEmailConfig, testEmailConnection } = require('./config/nodemailer');
const { validateATConfig } = require('./config/africastalking');
const { initializeMonthlyScheduler } = require('./jobs/monthlyReminder.job');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Validate configurations
try {
  // Validate JWT secret
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  if (process.env.JWT_SECRET.length < 32) {
    logger.warn('⚠️ JWT_SECRET should be at least 32 characters long for security');
  }
  
  logger.info('✅ JWT configuration validated');
  
  validateEmailConfig();
  validateATConfig();
  
  // Test email connection (optional, logs warning if fails)
  testEmailConnection().catch(err => {
    logger.warn('Email connection test failed (non-critical):', err.message);
  });
} catch (error) {
  logger.error('Configuration validation failed:', error.message);
  process.exit(1);
}

// Initialize monthly scheduler
if (process.env.NODE_ENV !== 'test') {
  initializeMonthlyScheduler();
  logger.info('Monthly reminder scheduler started');
}

// CORS Configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:7575',
    'http://localhost:7575',
    'http://localhost:5173', // Keep as fallback
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(mongoSanitize());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));
}

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected',
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/properties', require('./routes/property.routes'));
app.use('/api/tenants', require('./routes/tenant.routes'));
app.use('/api/reminders', require('./routes/reminder.routes'));
app.use('/api/feedback', require('./routes/feedback.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'RentAlert API',
    version: '1.0.0',
    status: 'running',
  });
});

// Error handling - MUST be last
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5757;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  logger.info(`CORS enabled for: ${corsOptions.origin.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;