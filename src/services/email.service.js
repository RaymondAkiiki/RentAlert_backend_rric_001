const { createTransporter } = require('../config/nodemailer');
const logger = require('../utils/logger');

/**
 * Send email via Gmail/Nodemailer
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML email content
 * @param {string} params.text - Plain text fallback (optional)
 * @returns {Promise<Object>} - Result with status
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `RentAlert <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML as fallback
    };

    logger.info(`Sending email to ${to}`);
    
    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent successfully to ${to}: ${info.messageId}`);
    
    return {
      success: true,
      status: 'sent',
      messageId: info.messageId,
      recipient: to,
      cost: 0, // Email is free
    };
  } catch (error) {
    logger.error('Email service error:', error);
    return {
      success: false,
      status: 'failed',
      error: error.message || 'Email sending failed',
      recipient: to,
      cost: 0,
    };
  }
};

/**
 * Send bulk emails to multiple recipients
 * @param {Array} emails - Array of email objects
 * @returns {Promise<Array>} - Array of results
 */
const sendBulkEmail = async (emails) => {
  const results = [];
  
  for (const email of emails) {
    const result = await sendEmail(email);
    results.push(result);
    
    // Small delay between sends (100ms)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid format
 */
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  validateEmail,
};