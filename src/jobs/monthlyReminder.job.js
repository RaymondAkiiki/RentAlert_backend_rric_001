const cron = require('node-cron');
const User = require('../models/user.model');
const Tenant = require('../models/tenant.model');
const EventLog = require('../models/eventlog.model');
const { sendEmail } = require('../services/email.service');
const { renderMonthlyReminderEmail } = require('../services/template.service');
const { getCurrentMonth } = require('../utils/formatters');
const logger = require('../utils/logger');

/**
 * Send monthly reminder emails to landlords
 * Runs daily at 6am EAT (3am UTC)
 * Checks if any tenants have rent due in 3 days
 */
const sendMonthlyReminders = async () => {
  try {
    logger.info('Starting monthly reminder job...');

    const today = new Date();
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);
    
    const targetDay = threeDaysLater.getDate();
    const currentMonth = getCurrentMonth();

    logger.info(`Checking for tenants with due date: ${targetDay}`);

    // Find all landlords
    const landlords = await User.find({ role: 'landlord' });
    
    let emailsSent = 0;

    for (const landlord of landlords) {
      // Find unpaid tenants with upcoming due date
      const unpaidTenants = await Tenant.find({
        userId: landlord.clerkId,
        dueDate: targetDay,
        status: 'unpaid',
        deletedAt: null,
      }).populate('propertyId', 'name');

      if (unpaidTenants.length === 0) {
        continue; // No unpaid tenants for this landlord
      }

      logger.info(`Landlord ${landlord.email} has ${unpaidTenants.length} unpaid tenants due on ${targetDay}`);

      // Prepare tenant data for email
      const tenantData = unpaidTenants.map(tenant => ({
        name: tenant.name,
        unitNumber: tenant.unitNumber,
        rentAmount: tenant.rentAmount,
        dueDate: tenant.dueDate,
        propertyName: tenant.propertyId.name,
      }));

      // Render email
      const html = renderMonthlyReminderEmail({
        landlordName: landlord.name,
        month: currentMonth,
        unpaidCount: unpaidTenants.length,
        unpaidTenants: tenantData,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
      });

      // Send email
      const result = await sendEmail({
        to: landlord.email,
        subject: `⏰ Rent Review: ${unpaidTenants.length} tenant${unpaidTenants.length === 1 ? '' : 's'} due soon`,
        html,
      });

      if (result.success) {
        emailsSent++;
        
        // Log event
        await EventLog.logEvent(landlord.clerkId, 'MONTHLY_REMINDER_SENT', {
          unpaidCount: unpaidTenants.length,
          targetDay,
        });

        logger.info(`Monthly reminder sent to ${landlord.email}`);
      } else {
        logger.error(`Failed to send monthly reminder to ${landlord.email}: ${result.error}`);
      }

      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.info(`Monthly reminder job completed. Emails sent: ${emailsSent}`);
  } catch (error) {
    logger.error('Monthly reminder job error:', error);
  }
};

/**
 * Initialize the monthly reminder scheduler
 * Runs daily at 6am EAT (3am UTC)
 */
const initializeMonthlyScheduler = () => {
  const timezone = process.env.SCHEDULER_TIMEZONE || 'Africa/Kampala';
  
  // Cron format: minute hour day month day-of-week
  // 0 3 * * * = Every day at 3am UTC (6am EAT)
  const cronSchedule = '0 3 * * *';

  const task = cron.schedule(cronSchedule, sendMonthlyReminders, {
    scheduled: true,
    timezone,
  });

  logger.info(`Monthly reminder scheduler initialized (${cronSchedule} in ${timezone})`);
  
  return task;
};

/**
 * Test function to manually trigger monthly reminders
 * Use this for testing without waiting for the scheduled time
 */
const testMonthlyReminders = async () => {
  logger.info('Manual test of monthly reminders triggered');
  await sendMonthlyReminders();
};

module.exports = {
  initializeMonthlyScheduler,
  testMonthlyReminders,
};