// Format currency (UGX)
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Format phone number for display
const formatPhoneNumber = (phone) => {
  // Convert +256700123456 to +256 700 123 456
  if (phone && phone.startsWith('+256')) {
    return phone.replace(/(\+256)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
  }
  return phone;
};

// Format date to readable string
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Format date with time
const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-UG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get month name from month number or date
const getMonthName = (monthOrDate = new Date()) => {
  let date;
  
  if (typeof monthOrDate === 'string') {
    // Handle "2025-11" format
    date = new Date(monthOrDate + '-01');
  } else if (typeof monthOrDate === 'number') {
    // Handle month number (1-12)
    date = new Date();
    date.setMonth(monthOrDate - 1);
  } else {
    date = new Date(monthOrDate);
  }
  
  return date.toLocaleDateString('en-UG', { month: 'long', year: 'numeric' });
};

// Format ordinal date (1st, 2nd, 3rd, etc.)
const formatOrdinal = (num) => {
  const n = Number(num);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Calculate days until date
const daysUntil = (dayOfMonth) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let targetDate = new Date(currentYear, currentMonth, dayOfMonth);
  
  // If target day has passed this month, use next month
  if (dayOfMonth < currentDay) {
    targetDate = new Date(currentYear, currentMonth + 1, dayOfMonth);
  }
  
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Get current month string (YYYY-MM)
const getCurrentMonth = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// Parse month string to start and end dates
const getMonthDateRange = (monthString) => {
  const [year, month] = monthString.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
  return { startDate, endDate };
};

module.exports = {
  formatCurrency,
  formatPhoneNumber,
  formatDate,
  formatDateTime,
  getMonthName,
  formatOrdinal,
  daysUntil,
  getCurrentMonth,
  getMonthDateRange,
};