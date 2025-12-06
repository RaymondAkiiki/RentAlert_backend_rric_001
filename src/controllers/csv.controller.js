const Tenant = require('../models/tenant.model');
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
const { normalizeUgandaPhone } = require('../utils/phoneUtils');

// Validate CSV data
const validateCSV = async (req, res) => {
  try {
    const { propertyId, tenants } = req.body;
    const userId = req.user.userId;

    if (!Array.isArray(tenants) || tenants.length === 0) {
      return res.status(400).json({
        error: 'No tenant data provided',
      });
    }

    if (tenants.length > 500) {
      return res.status(400).json({
        error: 'Maximum 500 tenants allowed per import',
      });
    }

    // Property ownership verified by middleware
    const property = req.property;

    // Get existing unit numbers to check for duplicates
    const existingUnits = await Tenant.find({
      propertyId: property._id,
      deletedAt: null,
    }).select('unitNumber');

    const existingUnitSet = new Set(
      existingUnits.map(t => t.unitNumber.toLowerCase())
    );

    const validTenants = [];
    const errors = [];
    const unitNumbersInImport = new Set();

    // Validate each tenant
    tenants.forEach((tenant, index) => {
      const rowErrors = [];
      const rowNumber = index + 2; // +2 because index starts at 0 and header is row 1

      // Required fields
      if (!tenant.name) {
        rowErrors.push('Name is required');
      } else if (!validateTenantName(tenant.name)) {
        rowErrors.push('Name must be 2-50 characters');
      }

      // Phone validation and normalization
      let normalizedPhone = null;
      if (!tenant.phone) {
        rowErrors.push('Phone is required');
      } else {
        normalizedPhone = normalizeUgandaPhone(tenant.phone);
        if (!normalizedPhone) {
          rowErrors.push(`Invalid phone format. Original: "${tenant.phone}". Expected: +256XXXXXXXXX or 0XXXXXXXXX`);
        }
      }

      if (!tenant.unitNumber) {
        rowErrors.push('Unit number is required');
      } else if (!validateUnitNumber(tenant.unitNumber)) {
        rowErrors.push('Unit number must be 1-20 characters');
      } else {
        // Check for duplicate within import
        const unitLower = String(tenant.unitNumber).toLowerCase();
        if (unitNumbersInImport.has(unitLower)) {
          rowErrors.push(`Duplicate unit ${tenant.unitNumber} in import`);
        } else if (existingUnitSet.has(unitLower)) {
          rowErrors.push(`Unit ${tenant.unitNumber} already exists in property`);
        } else {
          unitNumbersInImport.add(unitLower);
        }
      }

      if (!tenant.rentAmount) {
        rowErrors.push('Rent amount is required');
      } else if (!validateRentAmount(tenant.rentAmount)) {
        rowErrors.push('Rent must be 10,000 - 50,000,000 UGX');
      }

      if (!tenant.dueDate) {
        rowErrors.push('Due date is required');
      } else if (!validateDueDate(tenant.dueDate)) {
        rowErrors.push('Due date must be 1-31');
      }

      // Optional email validation
      if (tenant.email && !validateEmail(tenant.email)) {
        rowErrors.push('Invalid email format');
      }

      // If errors, add to errors array
      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          data: {
            ...tenant,
            phone: normalizedPhone || tenant.phone, // Show normalized if available
          },
          errors: rowErrors,
        });
      } else {
        // Valid tenant - use normalized phone
        validTenants.push({
          ...tenant,
          name: sanitizeString(tenant.name),
          phone: normalizedPhone, // Use normalized phone
          email: tenant.email ? sanitizeString(tenant.email) : null,
          unitNumber: sanitizeString(String(tenant.unitNumber)),
          rentAmount: Number(tenant.rentAmount),
          dueDate: Number(tenant.dueDate),
        });
      }
    });

    logger.info(`CSV validation: ${validTenants.length} valid, ${errors.length} invalid`);

    // Return validation results
    return res.status(200).json({
      valid: validTenants.length,
      invalid: errors.length,
      preview: validTenants.slice(0, 10), // First 10 valid tenants
      errors: errors.slice(0, 50), // First 50 errors
      totalErrors: errors.length,
    });
  } catch (error) {
    logger.error('CSV validation error:', error);
    return res.status(500).json({ error: 'Failed to validate CSV' });
  }
};

// Import CSV (confirmed after validation)
const importCSV = async (req, res) => {
  try {
    const { propertyId, tenants } = req.body;
    const userId = req.user.userId;

    if (!Array.isArray(tenants) || tenants.length === 0) {
      return res.status(400).json({
        error: 'No tenant data provided',
      });
    }

    // Property ownership verified by middleware
    const property = req.property;

    const imported = [];
    const failed = [];

    // Import each tenant
    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      
      try {
        // Normalize phone again just to be safe
        const normalizedPhone = normalizeUgandaPhone(tenant.phone);
        
        if (!normalizedPhone) {
          failed.push({
            row: i + 1,
            data: tenant,
            error: 'Invalid phone number format',
          });
          continue;
        }

        // Create tenant
        const newTenant = await Tenant.create({
          userId,
          propertyId: property._id,
          name: sanitizeString(tenant.name),
          phone: normalizedPhone, // Use normalized phone
          email: tenant.email ? sanitizeString(tenant.email) : null,
          unitNumber: sanitizeString(String(tenant.unitNumber)),
          rentAmount: Number(tenant.rentAmount),
          dueDate: Number(tenant.dueDate),
          status: 'unpaid',
        });

        imported.push({
          row: i + 1,
          tenantId: newTenant._id,
          name: newTenant.name,
          unitNumber: newTenant.unitNumber,
          phone: newTenant.phone,
        });
      } catch (error) {
        failed.push({
          row: i + 1,
          data: tenant,
          error: error.message,
        });
      }
    }

    // Log event
    await EventLog.logEvent(userId, 'TENANT_IMPORTED', {
      propertyId: property._id,
      propertyName: property.name,
      count: imported.length,
      failed: failed.length,
    });

    logger.info(
      `CSV import completed: ${imported.length} imported, ${failed.length} failed by user: ${userId}`
    );

    return res.status(201).json({
      message: `Import completed: ${imported.length} tenants added`,
      imported: imported.length,
      failed: failed.length,
      details: {
        imported: imported.slice(0, 10), // First 10
        failed: failed.slice(0, 10), // First 10 failures
      },
    });
  } catch (error) {
    logger.error('CSV import error:', error);
    return res.status(500).json({ error: 'Failed to import CSV' });
  }
};

module.exports = {
  validateCSV,
  importCSV,
};