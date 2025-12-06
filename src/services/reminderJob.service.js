const Tenant = require('../models/tenant.model');
const ReminderLog = require('../models/reminderlog.model');
const EventLog = require('../models/eventlog.model');
const User = require('../models/user.model');
const { sendSMS } = require('./sms.service');
const { sendEmail } = require('./email.service');
const { renderSMSTemplate, renderEmailTemplate } = require('./template.service');
const { getCurrentMonth } = require('../utils/formatters');
const logger = require('../utils/logger');

// In-memory job storage (for simple implementation)
// In production, use Redis or a proper job queue
const jobs = new Map();

/**
 * Create a new reminder job
 */
const createReminderJob = (jobId, totalCount) => {
  jobs.set(jobId, {
    id: jobId,
    status: 'processing',
    total: totalCount,
    sent: 0,
    failed: 0,
    details: [],
    totalCost: 0,
    startedAt: new Date(),
    completedAt: null,
  });
  return jobs.get(jobId);
};

/**
 * Update job progress
 */
const updateJobProgress = (jobId, update) => {
  const job = jobs.get(jobId);
  if (job) {
    Object.assign(job, update);
    jobs.set(jobId, job);
  }
};

/**
 * Get job status
 */
const getJobStatus = (jobId) => {
  return jobs.get(jobId) || null;
};

/**
 * Clean up old jobs (older than 1 hour)
 */
const cleanupOldJobs = () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [jobId, job] of jobs.entries()) {
    if (job.completedAt && job.completedAt < oneHourAgo) {
      jobs.delete(jobId);
      logger.info(`Cleaned up old job: ${jobId}`);
    }
  }
};

// Clean up every 5 minutes
setInterval(cleanupOldJobs, 5 * 60 * 1000);

/**
 * Process reminders in background
 */
const processRemindersInBackground = async (jobId, userId, tenantIds, method, targetMonth) => {
  try {
    logger.info(`Starting background job ${jobId} for ${tenantIds.length} tenants`);

    // Fetch user details
    const user = await User.findById(userId);
    if (!user) {
      updateJobProgress(jobId, {
        status: 'failed',
        error: 'User not found',
        completedAt: new Date(),
      });
      return;
    }

    // Fetch tenants
    const tenants = await Tenant.find({
      _id: { $in: tenantIds },
      userId,
      deletedAt: null,
    }).populate('propertyId', 'name');

    if (tenants.length === 0) {
      updateJobProgress(jobId, {
        status: 'failed',
        error: 'No valid tenants found',
        completedAt: new Date(),
      });
      return;
    }

    // Filter by method
    let eligibleTenants = tenants;
    if (method === 'email') {
      eligibleTenants = tenants.filter(t => t.email);
    }

    updateJobProgress(jobId, {
      total: eligibleTenants.length,
    });

    let totalCost = 0;

    // Process each tenant
    for (let i = 0; i < eligibleTenants.length; i++) {
      const tenant = eligibleTenants[i];
      
      try {
        let result;

        if (method === 'sms') {
          const message = renderSMSTemplate({
            tenantName: tenant.name,
            month: targetMonth,
            rentAmount: tenant.rentAmount,
            dueDate: tenant.dueDate,
            landlordName: user.name,
          });

          result = await sendSMS({
            to: tenant.phone,
            message,
          });
        } else {
          const html = renderEmailTemplate({
            tenantName: tenant.name,
            month: targetMonth,
            rentAmount: tenant.rentAmount,
            dueDate: tenant.dueDate,
            unitNumber: tenant.unitNumber,
            landlordName: user.name,
            landlordPhone: user.phone,
          });

          result = await sendEmail({
            to: tenant.email,
            subject: `Rent Reminder - ${tenant.propertyId.name}`,
            html,
          });
        }

        // Log reminder
        await ReminderLog.create({
          userId,
          tenantId: tenant._id,
          type: method,
          status: result.success ? 'sent' : 'failed',
          cost: result.cost || 0,
          errorMessage: result.error || null,
        });

        // Update tenant
        if (result.success) {
          tenant.lastReminderSentAt = new Date();
          await tenant.save();
        }

        totalCost += result.cost || 0;

        const job = jobs.get(jobId);
        const detail = {
          tenantId: tenant._id.toString(),
          tenantName: tenant.name,
          status: result.success ? 'sent' : 'failed',
          cost: result.cost || 0,
          error: result.error || null,
        };

        updateJobProgress(jobId, {
          sent: result.success ? job.sent + 1 : job.sent,
          failed: result.success ? job.failed : job.failed + 1,
          details: [...job.details, detail],
          totalCost: totalCost,
        });

        logger.info(`Job ${jobId}: Processed ${i + 1}/${eligibleTenants.length} - ${tenant.name}`);
      } catch (error) {
        logger.error(`Job ${jobId}: Failed to process tenant ${tenant._id}:`, error);

        await ReminderLog.create({
          userId,
          tenantId: tenant._id,
          type: method,
          status: 'failed',
          cost: 0,
          errorMessage: error.message,
        });

        const job = jobs.get(jobId);
        updateJobProgress(jobId, {
          failed: job.failed + 1,
          details: [...job.details, {
            tenantId: tenant._id.toString(),
            tenantName: tenant.name,
            status: 'failed',
            cost: 0,
            error: error.message,
          }],
        });
      }
    }

    const job = jobs.get(jobId);

    // Log event
    await EventLog.logEvent(userId, 'REMINDERS_SENT', {
      method,
      sent: job.sent,
      failed: job.failed,
      totalCost,
    });

    // Mark as complete
    updateJobProgress(jobId, {
      status: 'completed',
      totalCost,
      completedAt: new Date(),
    });

    logger.info(`Job ${jobId} completed: ${job.sent} sent, ${job.failed} failed, total cost: ${totalCost}`);
  } catch (error) {
    logger.error(`Job ${jobId} failed:`, error);
    updateJobProgress(jobId, {
      status: 'failed',
      error: error.message,
      completedAt: new Date(),
    });
  }
};

module.exports = {
  createReminderJob,
  updateJobProgress,
  getJobStatus,
  processRemindersInBackground,
};