const { formatCurrency, getMonthName, formatOrdinal } = require('../utils/formatters');

/**
 * Render SMS template for rent reminder
 * @param {Object} data - Template data
 * @param {string} data.tenantName - Tenant's name
 * @param {string} data.month - Month string (e.g., "2025-11")
 * @param {number} data.rentAmount - Rent amount in UGX
 * @param {number} data.dueDate - Due date (1-31)
 * @param {string} data.landlordName - Landlord's name (optional)
 * @returns {string} - Rendered SMS message
 */
const renderSMSTemplate = (data) => {
  const { tenantName, month, rentAmount, dueDate, landlordName } = data;
  
  const monthName = getMonthName(month);
  const formattedRent = formatCurrency(rentAmount);
  const ordinalDate = formatOrdinal(dueDate);
  
  // Default SMS template
  let message = `Hello ${tenantName}, your rent for ${monthName} (${formattedRent}) is due on the ${ordinalDate}. Kindly clear to avoid penalties. Thank you.`;
  
  // Add landlord signature if provided
  if (landlordName) {
    message += ` - ${landlordName}`;
  }
  
  return message;
};

/**
 * Render HTML email template for rent reminder
 * @param {Object} data - Template data
 * @returns {string} - Rendered HTML email
 */
const renderEmailTemplate = (data) => {
  const { tenantName, month, rentAmount, dueDate, unitNumber, landlordName, landlordPhone } = data;
  
  const monthName = getMonthName(month);
  const formattedRent = formatCurrency(rentAmount);
  const ordinalDate = formatOrdinal(dueDate);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      color: #333; 
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container { 
      max-width: 600px; 
      margin: 20px auto; 
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header { 
      background: #2563EB; 
      color: white; 
      padding: 30px 20px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content { 
      padding: 30px 20px; 
      background: white;
    }
    .amount { 
      font-size: 32px; 
      font-weight: bold; 
      color: #2563EB;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-label {
      color: #6b7280;
      font-weight: 500;
    }
    .info-value {
      color: #111827;
      font-weight: 600;
    }
    .footer { 
      text-align: center; 
      padding: 20px; 
      background: #f9fafb;
      color: #6b7280; 
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
    }
    .notice {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏠 Rent Reminder</h1>
    </div>
    
    <div class="content">
      <p style="font-size: 16px; color: #111827;">Dear <strong>${tenantName}</strong>,</p>
      
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
        This is a friendly reminder that your rent for <strong>${monthName}</strong> is due soon.
      </p>
      
      <div class="amount">${formattedRent}</div>
      
      <div style="margin: 20px 0;">
        <div class="info-row">
          <span class="info-label">Unit Number:</span>
          <span class="info-value">${unitNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Due Date:</span>
          <span class="info-value">${ordinalDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Month:</span>
          <span class="info-value">${monthName}</span>
        </div>
      </div>
      
      <div class="notice">
        <strong>⚠️ Important:</strong> Kindly clear your rent by the due date to avoid late payment penalties.
      </div>
      
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
        If you have already paid, please disregard this message.
      </p>
      
      <p style="font-size: 14px; color: #111827; margin-top: 30px;">
        Thank you,<br>
        <strong>${landlordName || 'Your Landlord'}</strong><br>
        ${landlordPhone ? `<span style="color: #6b7280;">${landlordPhone}</span>` : ''}
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0;">Sent via RentAlert - Rent Management Made Simple</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Render monthly reminder email for landlords
 * @param {Object} data - Template data
 * @returns {string} - Rendered HTML email
 */
const renderMonthlyReminderEmail = (data) => {
  const { landlordName, month, unpaidCount, unpaidTenants, dashboardUrl } = data;
  
  const monthName = getMonthName(month);
  
  const tenantRows = unpaidTenants.map(tenant => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${tenant.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${tenant.unitNumber}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(tenant.rentAmount)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${formatOrdinal(tenant.dueDate)}</td>
    </tr>
  `).join('');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container { 
      max-width: 650px; 
      margin: 20px auto; 
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header { 
      background: #2563EB; 
      color: white; 
      padding: 30px 20px; 
      text-align: center; 
    }
    .content { padding: 30px 20px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #d1d5db;
    }
    .cta-button {
      display: inline-block;
      background: #2563EB;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .footer { 
      text-align: center; 
      padding: 20px; 
      background: #f9fafb;
      color: #6b7280; 
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Monthly Rent Review</h1>
    </div>
    
    <div class="content">
      <h2 style="color: #111827;">Hi ${landlordName},</h2>
      
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
        It's time to review rent status for <strong>${monthName}</strong>.
      </p>
      
      <p style="font-size: 16px; color: #111827; margin: 20px 0;">
        You have <strong style="color: #dc2626;">${unpaidCount}</strong> tenant${unpaidCount === 1 ? '' : 's'} with upcoming rent due dates:
      </p>
      
      <table>
        <thead>
          <tr>
            <th>Tenant Name</th>
            <th style="text-align: center;">Unit</th>
            <th style="text-align: right;">Rent Amount</th>
            <th style="text-align: center;">Due Date</th>
          </tr>
        </thead>
        <tbody>
          ${tenantRows}
        </tbody>
      </table>
      
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="cta-button">
          Review & Send Reminders
        </a>
      </div>
      
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
        You can update rent statuses and send reminders directly from your dashboard.
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0;">RentAlert - Simplifying Rent Collection</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

module.exports = {
  renderSMSTemplate,
  renderEmailTemplate,
  renderMonthlyReminderEmail,
};