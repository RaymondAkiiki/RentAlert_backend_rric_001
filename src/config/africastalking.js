const AfricasTalking = require('africastalking');
const logger = require('../utils/logger');

// Initialize Africa's Talking
let africasTalkingClient = null;

const initializeAfricasTalking = () => {
  try {
    if (!process.env.AT_USERNAME || !process.env.AT_API_KEY) {
      logger.error('Africa\'s Talking credentials not configured');
      throw new Error('Missing Africa\'s Talking configuration');
    }

    africasTalkingClient = AfricasTalking({
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME,
    });

    logger.info('Africa\'s Talking client initialized successfully');
    return africasTalkingClient;
  } catch (error) {
    logger.error('Failed to initialize Africa\'s Talking:', error.message);
    throw error;
  }
};

// Get SMS service
const getSmsService = () => {
  if (!africasTalkingClient) {
    africasTalkingClient = initializeAfricasTalking();
  }
  return africasTalkingClient.SMS;
};

// Validate Africa's Talking configuration
const validateATConfig = () => {
  if (!process.env.AT_USERNAME) {
    logger.error('AT_USERNAME is not defined in environment variables');
    throw new Error('Missing Africa\'s Talking configuration');
  }

  if (!process.env.AT_API_KEY) {
    logger.error('AT_API_KEY is not defined in environment variables');
    throw new Error('Missing Africa\'s Talking configuration');
  }

  if (!process.env.AT_SENDER_ID) {
    logger.error('AT_SENDER_ID is not defined in environment variables');
    throw new Error('Missing Africa\'s Talking configuration');
  }

  logger.info('Africa\'s Talking configuration validated');
};

module.exports = {
  initializeAfricasTalking,
  getSmsService,
  validateATConfig,
};