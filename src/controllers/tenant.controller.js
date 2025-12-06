const Tenant = require('../models/tenant.model');
const Property = require('../models/property.model');
const EventLog = require('../models/eventlog.model');
const logger = require('../utils/logger');
const {
  validateTenantName,
  validateUgandaPhone,
  validateEmail,
  validateUnitNumber,
  validateRentAmount,
  validateDueDate,
  sanitizeString,
} = require('../utils/validators');

// Create tenant
const createTenant = async (req, res) => {
  try {
    const { propertyId, name, phone, email, unitNumber, rentAmount, dueDate } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!propertyId || !name || !phone || !unitNumber || !rentAmount || !dueDate) {
      return res.status(400).json({
        error: 'Missing required fields: propertyId, name, phone, unitNumber, rentAmount, dueDate',
      });
    }

    // Validate property ownership (done by middleware, property attached to req)
    const property = req.property;

    // Validate inputs
    if (!validateTenantName(name)) {
      return res.status(400).json({
        error: 'Tenant name must be between 2 and 50 characters',
      });
    }

    if (!validateUgandaPhone(phone)) {
      return res.status(400).json({
        error: 'Phone number must be in Uganda format: +256XXXXXXXXX',
      });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    if (!validateUnitNumber(unitNumber)) {
      return res.status(400).json({
        error: 'Unit number must be between 1 and 20 characters',
      });
    }

    if (!validateRentAmount(rentAmount)) {
      return res.status(400).json({
        error: 'Rent amount must be between 10,000 and 50,000,000 UGX',
      });
    }

    if (!validateDueDate(dueDate)) {
      return res.status(400).json({
        error: 'Due date must be between 1 and 31',
      });
    }

    // Check for duplicate unit number in same property
    const existingTenant = await Tenant.findOne({
      propertyId: property._id,
      unitNumber: sanitizeString(unitNumber),
      deletedAt: null,
    });

    if (existingTenant) {
      return res.status(409).json({
        error: `Unit ${unitNumber} is already occupied in this property`,
      });
    }

    // Create tenant
    const tenant = await Tenant.create({
      userId,
      propertyId: property._id,
      name: sanitizeString(name),
      phone,
      email: email ? sanitizeString(email) : null,
      unitNumber: sanitizeString(unitNumber),
      rentAmount: Number(rentAmount),
      dueDate: Number(dueDate),
      status: 'unpaid',
    });

    // Log event
    await EventLog.logEvent(userId, 'TENANT_ADDED');

    logger.info(`Tenant created: ${tenant._id} by user: ${userId}`);

    return res.status(201).json({
      message: 'Tenant added successfully',
      tenant: {
        id: tenant._id,
        propertyId: tenant.propertyId,
        name: tenant.name,
        phone: tenant.phone,
        email: tenant.email,
        unitNumber: tenant.unitNumber,
        rentAmount: tenant.rentAmount,
        dueDate: tenant.dueDate,
        status: tenant.status,
        createdAt: tenant.createdAt,
      },
    });
  } catch (error) {
    logger.error('Create tenant error:', error);
    return res.status(500).json({ error: 'Failed to create tenant' });
  }
};

// Get all tenants for user
const getTenants = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { propertyId, status, page = 1, limit = 50 } = req.query;

    // Build query
    const query = {
      userId,
      deletedAt: null,
    };

    if (propertyId) {
      query.propertyId = propertyId;
    }

    if (status && ['paid', 'unpaid'].includes(status)) {
      query.status = status;
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get tenants
    const [tenants, total] = await Promise.all([
      Tenant.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('propertyId', 'name'),
      Tenant.countDocuments(query),
    ]);

    return res.status(200).json({
      tenants: tenants.map(tenant => ({
        id: tenant._id,
        propertyId: tenant.propertyId._id,
        propertyName: tenant.propertyId.name,
        name: tenant.name,
        phone: tenant.phone,
        email: tenant.email,
        unitNumber: tenant.unitNumber,
        rentAmount: tenant.rentAmount,
        dueDate: tenant.dueDate,
        status: tenant.status,
        lastReminderSentAt: tenant.lastReminderSentAt,
        createdAt: tenant.createdAt,
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get tenants error:', error);
    return res.status(500).json({ error: 'Failed to fetch tenants' });
  }
};

// Get single tenant
const getTenant = async (req, res) => {
  try {
    const tenant = req.tenant; // Attached by ownership middleware

    // Populate property
    await tenant.populate('propertyId', 'name address');

    return res.status(200).json({
      tenant: {
        id: tenant._id,
        propertyId: tenant.propertyId._id,
        propertyName: tenant.propertyId.name,
        name: tenant.name,
        phone: tenant.phone,
        email: tenant.email,
        unitNumber: tenant.unitNumber,
        rentAmount: tenant.rentAmount,
        dueDate: tenant.dueDate,
        status: tenant.status,
        lastReminderSentAt: tenant.lastReminderSentAt,
        createdAt: tenant.createdAt,
      },
    });
  } catch (error) {
    logger.error('Get tenant error:', error);
    return res.status(500).json({ error: 'Failed to fetch tenant' });
  }
};

// Update tenant
const updateTenant = async (req, res) => {
  try {
    const tenant = req.tenant; // Attached by ownership middleware
    const { name, phone, email, unitNumber, rentAmount, dueDate } = req.body;

    // Validate and update fields
    if (name) {
      if (!validateTenantName(name)) {
        return res.status(400).json({
          error: 'Tenant name must be between 2 and 50 characters',
        });
      }
      tenant.name = sanitizeString(name);
    }

    if (phone) {
      if (!validateUgandaPhone(phone)) {
        return res.status(400).json({
          error: 'Phone number must be in Uganda format: +256XXXXXXXXX',
        });
      }
      tenant.phone = phone;
    }

    if (email !== undefined) {
      if (email && !validateEmail(email)) {
        return res.status(400).json({
          error: 'Invalid email format',
        });
      }
      tenant.email = email ? sanitizeString(email) : null;
    }

    if (unitNumber) {
      if (!validateUnitNumber(unitNumber)) {
        return res.status(400).json({
          error: 'Unit number must be between 1 and 20 characters',
        });
      }

      // Check for duplicate unit number (excluding current tenant)
      const existingTenant = await Tenant.findOne({
        propertyId: tenant.propertyId,
        unitNumber: sanitizeString(unitNumber),
        deletedAt: null,
        _id: { $ne: tenant._id },
      });

      if (existingTenant) {
        return res.status(409).json({
          error: `Unit ${unitNumber} is already occupied in this property`,
        });
      }

      tenant.unitNumber = sanitizeString(unitNumber);
    }

    if (rentAmount) {
      if (!validateRentAmount(rentAmount)) {
        return res.status(400).json({
          error: 'Rent amount must be between 10,000 and 50,000,000 UGX',
        });
      }
      tenant.rentAmount = Number(rentAmount);
    }

    if (dueDate) {
      if (!validateDueDate(dueDate)) {
        return res.status(400).json({
          error: 'Due date must be between 1 and 31',
        });
      }
      tenant.dueDate = Number(dueDate);
    }

    await tenant.save();

    logger.info(`Tenant updated: ${tenant._id}`);

    return res.status(200).json({
      message: 'Tenant updated successfully',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        phone: tenant.phone,
        email: tenant.email,
        unitNumber: tenant.unitNumber,
        rentAmount: tenant.rentAmount,
        dueDate: tenant.dueDate,
        status: tenant.status,
      },
    });
  } catch (error) {
    logger.error('Update tenant error:', error);
    return res.status(500).json({ error: 'Failed to update tenant' });
  }
};

// Update tenant status (Paid/Unpaid toggle)
const updateTenantStatus = async (req, res) => {
  try {
    const tenant = req.tenant; // Attached by ownership middleware
    const { status } = req.body;

    // Validate status
    if (!status || !['paid', 'unpaid'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be either "paid" or "unpaid"',
      });
    }

    const oldStatus = tenant.status;
    tenant.status = status;
    await tenant.save();

    // Log event
    await EventLog.logEvent(req.user.userId, 'RENT_STATUS_UPDATED');

    logger.info(`Tenant status updated: ${tenant._id} from ${oldStatus} to ${status}`);

    return res.status(200).json({
      message: 'Status updated successfully',
      tenant: {
        id: tenant._id,
        status: tenant.status,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Update tenant status error:', error);
    return res.status(500).json({ error: 'Failed to update status' });
  }
};

// Delete tenant (soft delete)
const deleteTenant = async (req, res) => {
  try {
    const tenant = req.tenant; // Attached by ownership middleware

    // Soft delete
    await tenant.softDelete();

    logger.info(`Tenant deleted: ${tenant._id}`);

    return res.status(200).json({
      message: 'Tenant deleted successfully',
    });
  } catch (error) {
    logger.error('Delete tenant error:', error);
    return res.status(500).json({ error: 'Failed to delete tenant' });
  }
};

module.exports = {
  createTenant,
  getTenants,
  getTenant,
  updateTenant,
  updateTenantStatus,
  deleteTenant,
};