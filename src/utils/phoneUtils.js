/**
 * Phone number utilities for Uganda phone numbers
 * Handles various input formats and normalizes to +256XXXXXXXXX
 */

/**
 * Normalize Uganda phone number to standard format (+256XXXXXXXXX)
 * @param {string|number} phone - Phone number in various formats
 * @returns {string|null} - Normalized phone number or null if invalid
 */
const normalizeUgandaPhone = (phone) => {
  if (!phone) return null;
  
  // Convert to string and remove all whitespace and special characters except +
  let cleaned = String(phone)
    .trim()
    .replace(/[\s\-\(\)\.]/g, '');
  
  // Handle scientific notation (e.g., 2.56702E+11 or 2.56702E11)
  if (cleaned.includes('E') || cleaned.includes('e')) {
    try {
      // Convert scientific notation to full number
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        cleaned = num.toFixed(0); // Convert to string without decimals
      }
    } catch (e) {
      console.warn('Failed to parse scientific notation:', phone);
    }
  }
  
  // Remove any remaining non-digit characters except leading +
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.substring(1).replace(/\D/g, '');
  } else {
    cleaned = cleaned.replace(/\D/g, '');
  }
  
  // Handle different formats:
  // 1. +256XXXXXXXXX (already correct)
  // 2. 256XXXXXXXXX (missing +)
  // 3. 0XXXXXXXXX (local format)
  // 4. 7XXXXXXXX (without 0 or 256)
  
  if (cleaned.startsWith('+256')) {
    // Already in correct format
    if (cleaned.length === 13) {
      return cleaned;
    }
  } else if (cleaned.startsWith('256')) {
    // Missing +
    if (cleaned.length === 12) {
      return '+' + cleaned;
    }
  } else if (cleaned.startsWith('0')) {
    // Local format (0XXXXXXXXX)
    if (cleaned.length === 10) {
      return '+256' + cleaned.substring(1);
    }
  } else if (cleaned.length === 9) {
    // Without leading 0 or 256 (7XXXXXXXX)
    return '+256' + cleaned;
  }
  
  // If we got here, format is invalid
  return null;
};

/**
 * Validate Uganda phone number (flexible - accepts various formats)
 * @param {string|number} phone - Phone number to validate
 * @returns {boolean} - True if valid (can be normalized)
 */
const validateUgandaPhone = (phone) => {
  const normalized = normalizeUgandaPhone(phone);
  return normalized !== null;
};

/**
 * Validate strict Uganda phone format (+256XXXXXXXXX only)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if in strict format
 */
const validateUgandaPhoneStrict = (phone) => {
  const regex = /^\+256\d{9}$/;
  return regex.test(phone);
};

/**
 * Format phone number for display
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  
  const normalized = normalizeUgandaPhone(phone);
  if (!normalized) return phone;
  
  // Format as +256 7XX XXX XXX
  const match = normalized.match(/^\+256(\d{3})(\d{3})(\d{3})$/);
  if (match) {
    return `+256 ${match[1]} ${match[2]} ${match[3]}`;
  }
  
  return normalized;
};

/**
 * Extract phone numbers from text (useful for parsing)
 * @param {string} text - Text containing phone number
 * @returns {string|null} - Extracted and normalized phone number
 */
const extractPhoneFromText = (text) => {
  if (!text) return null;
  
  // Try to find phone number patterns
  const patterns = [
    /\+256\d{9}/,
    /256\d{9}/,
    /0\d{9}/,
    /\d{9}/,
  ];
  
  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    if (match) {
      return normalizeUgandaPhone(match[0]);
    }
  }
  
  return null;
};

module.exports = {
  normalizeUgandaPhone,
  validateUgandaPhone,
  validateUgandaPhoneStrict,
  formatPhoneDisplay,
  extractPhoneFromText,
};