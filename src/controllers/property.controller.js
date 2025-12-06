const Property = require('../models/property.model');
const Tenant = require('../models/tenant.model');
const EventLog = require('../models/eventlog.model');
const logger = require('../utils/logger');
const { validatePropertyName, sanitizeString } = require('../utils/validators');

// Create property
const createProperty = async (req, res) => {
  try {
    const { name, address } = req.body;
    const userId = req.user.userId;

    // Validate name
    if (!validatePropertyName(name)) {
      return res.status(400).json({
        error: 'Property name must be between 3 and 50 characters',
      });
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(name);
    const sanitizedAddress = address ? sanitizeString(address) : '';

    // Create property
    const property = await Property.create({
      userId,
      name: sanitizedName,
      address: sanitizedAddress,
    });

    // Log event
    await EventLog.logEvent(userId, 'PROPERTY_ADDED');

    logger.info(`Property created: ${property._id} by user: ${userId}`);

    return res.status(201).json({
      message: 'Property created successfully',
      property: {
        id: property._id,
        userId: property.userId,
        name: property.name,
        address: property.address,
        createdAt: property.createdAt,
      },
    });
  } catch (error) {
    logger.error('Create property error:', error);
    return res.status(500).json({ error: 'Failed to create property' });
  }
};

// Get all properties for user
const getProperties = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find all active properties
    const properties = await Property.find({
      userId,
      deletedAt: null,
    }).sort({ createdAt: -1 });

    // Get tenant count for each property
    const propertiesWithCount = await Promise.all(
      properties.map(async (property) => {
        const tenantCount = await Tenant.countDocuments({
          propertyId: property._id,
          deletedAt: null,
        });

        return {
          id: property._id,
          name: property.name,
          address: property.address,
          tenantCount,
          createdAt: property.createdAt,
        };
      })
    );

    return res.status(200).json({
      properties: propertiesWithCount,
      total: propertiesWithCount.length,
    });
  } catch (error) {
    logger.error('Get properties error:', error);
    return res.status(500).json({ error: 'Failed to fetch properties' });
  }
};

// Get single property with tenants
const getProperty = async (req, res) => {
  try {
    const property = req.property; // Attached by ownership middleware

    // Get all tenants for this property
    const tenants = await Tenant.find({
      propertyId: property._id,
      deletedAt: null,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      property: {
        id: property._id,
        name: property.name,
        address: property.address,
        createdAt: property.createdAt,
      },
      tenants: tenants.map(tenant => ({
        id: tenant._id,
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
    });
  } catch (error) {
    logger.error('Get property error:', error);
    return res.status(500).json({ error: 'Failed to fetch property' });
  }
};

// Update property
const updateProperty = async (req, res) => {
  try {
    const property = req.property; // Attached by ownership middleware
    const { name, address } = req.body;

    // Validate name if provided
    if (name && !validatePropertyName(name)) {
      return res.status(400).json({
        error: 'Property name must be between 3 and 50 characters',
      });
    }

    // Update fields
    if (name) property.name = sanitizeString(name);
    if (address !== undefined) property.address = sanitizeString(address);

    await property.save();

    logger.info(`Property updated: ${property._id}`);

    return res.status(200).json({
      message: 'Property updated successfully',
      property: {
        id: property._id,
        name: property.name,
        address: property.address,
        createdAt: property.createdAt,
      },
    });
  } catch (error) {
    logger.error('Update property error:', error);
    return res.status(500).json({ error: 'Failed to update property' });
  }
};

// Delete property (soft delete)
const deleteProperty = async (req, res) => {
  try {
    const property = req.property; // Attached by ownership middleware

    // Check if property has tenants
    const tenantCount = await Tenant.countDocuments({
      propertyId: property._id,
      deletedAt: null,
    });

    if (tenantCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete property with tenants. Please delete or move all tenants first.',
        tenantCount,
      });
    }

    // Soft delete
    await property.softDelete();

    logger.info(`Property deleted: ${property._id}`);

    return res.status(200).json({
      message: 'Property deleted successfully',
    });
  } catch (error) {
    logger.error('Delete property error:', error);
    return res.status(500).json({ error: 'Failed to delete property' });
  }
};

module.exports = {
  createProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty,
};