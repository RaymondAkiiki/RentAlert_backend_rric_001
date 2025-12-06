const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create transporter with Gmail
const createTransporter = () => {
  try {
    // FIX: Change createTransporter to createTransport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    logger.info('Gmail transporter created successfully');
    return transporter;
  } catch (error) {
    logger.error('Failed to create Gmail transporter:', error.message);
    throw error;
  }
};

// Validate email configuration
const validateEmailConfig = () => {
  if (!process.env.GMAIL_USER) {
    logger.error('GMAIL_USER is not defined in environment variables');
    throw new Error('Missing Gmail configuration');
  }

  if (!process.env.GMAIL_APP_PASSWORD) {
    logger.error('GMAIL_APP_PASSWORD is not defined in environment variables');
    throw new Error('Missing Gmail configuration');
  }

  logger.info('Email configuration validated');
};

// Test email connection
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Gmail connection verified successfully');
    return true;
  } catch (error) {
    logger.error('Gmail connection verification failed:', error.message);
    return false;
  }
};

module.exports = {
  createTransporter,
  validateEmailConfig,
  testEmailConnection,
};