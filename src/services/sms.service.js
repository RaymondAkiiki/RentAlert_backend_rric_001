const { getSmsService } = require('../config/africastalking');
const logger = require('../utils/logger');

// SMS cost per message (UGX)
const SMS_COST = 50;

/**
 * Send SMS via Africa's Talking
 * @param {Object} params - SMS parameters
 * @param {string} params.to - Phone number (+256XXXXXXXXX)
 * @param {string} params.message - SMS message content
 * @returns {Promise<Object>} - Result with status and cost
 */
const sendSMS = async ({ to, message }) => {
  try {
    const smsService = getSmsService();
    
    const options = {
      to: [to],
      message,
      from: process.env.AT_SENDER_ID || 'RentAlert',
    };

    logger.info(`Sending SMS to ${to}`);
    
    const response = await smsService.send(options);
    
    // Check response status
    if (response.SMSMessageData && response.SMSMessageData.Recipients) {
      const recipient = response.SMSMessageData.Recipients[0];
      
      if (recipient.status === 'Success' || recipient.statusCode === 101) {
        logger.info(`SMS sent successfully to ${to}`);
        return {
          success: true,
          status: 'sent',
          messageId: recipient.messageId,
          cost: SMS_COST,
          recipient: to,
        };
      } else {
        logger.error(`SMS failed to ${to}: ${recipient.status}`);
        return {
          success: false,
          status: 'failed',
          error: recipient.status,
          cost: 0,
          recipient: to,
        };
      }
    }
    
    // Unexpected response format
    logger.error('Unexpected SMS response format:', response);
    return {
      success: false,
      status: 'failed',
      error: 'Unexpected response format',
      cost: 0,
      recipient: to,
    };
  } catch (error) {
    logger.error('SMS service error:', error);
    return {
      success: false,
      status: 'failed',
      error: error.message || 'SMS sending failed',
      cost: 0,
      recipient: to,
    };
  }
};

/**
 * Send bulk SMS to multiple recipients
 * @param {Array} messages - Array of {to, message} objects
 * @returns {Promise<Array>} - Array of results
 */
const sendBulkSMS = async (messages) => {
  const results = [];
  
  for (const msg of messages) {
    const result = await sendSMS(msg);
    results.push(result);
    
    // Small delay to avoid rate limiting (100ms)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid Uganda format
 */
const validatePhone = (phone) => {
  return /^\+256\d{9}$/.test(phone);
};

module.exports = {
  sendSMS,
  sendBulkSMS,
  validatePhone,
  SMS_COST,
};