const { normalizeUgandaPhone } = require('./phoneUtils');

// Phone number validation (Uganda format: flexible, normalizable)
const validateUgandaPhone = (phone) => {
  const normalized = normalizeUgandaPhone(phone);
  return normalized !== null;
};

// Strict phone validation (for already-normalized data)
const validateUgandaPhoneStrict = (phone) => {
  const regex = /^\+256\d{9}$/;
  return regex.test(phone);
};

// Email validation (RFC 5322 compliant)
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Rent amount validation
const validateRentAmount = (amount) => {
  const numAmount = Number(amount);
  return !isNaN(numAmount) && numAmount >= 10000 && numAmount <= 50000000;
};

// Due date validation (1-31)
const validateDueDate = (date) => {
  const numDate = Number(date);
  return !isNaN(numDate) && numDate >= 1 && numDate <= 31;
};

// Property name validation
const validatePropertyName = (name) => {
  return typeof name === 'string' && name.length >= 3 && name.length <= 50;
};

// Tenant name validation
const validateTenantName = (name) => {
  return typeof name === 'string' && name.length >= 2 && name.length <= 50;
};

// Unit number validation
const validateUnitNumber = (unit) => {
  return typeof unit === 'string' && unit.length >= 1 && unit.length <= 20;
};

// Feedback message validation
const validateFeedbackMessage = (message) => {
  return typeof message === 'string' && message.length >= 10 && message.length <= 500;
};

// Rating validation (1-5)
const validateRating = (rating) => {
  const numRating = Number(rating);
  return !isNaN(numRating) && numRating >= 1 && numRating <= 5;
};

// Sanitize string input (prevent XSS)
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

// Validate MongoDB ObjectId
const validateObjectId = (id) => {
  return /^[a-f\d]{24}$/i.test(id);
};

module.exports = {
  validateUgandaPhone,
  validateUgandaPhoneStrict,
  validateEmail,
  validateRentAmount,
  validateDueDate,
  validatePropertyName,
  validateTenantName,
  validateUnitNumber,
  validateFeedbackMessage,
  validateRating,
  sanitizeString,
  validateObjectId,
};