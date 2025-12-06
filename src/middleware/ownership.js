const Property = require('../models/property.model');
const Tenant = require('../models/tenant.model');
const logger = require('../utils/logger');
const { validateObjectId } = require('../utils/validators');

// Middleware to verify property ownership
const verifyPropertyOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Validate ObjectId format
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid property ID format' });
    }

    // Find property by MongoDB _id and check if it belongs to the user
    const property = await Property.findOne({ 
      _id: id, 
      userId: userId, // This now matches the user's MongoDB _id
      deletedAt: null,
    });

    if (!property) {
      logger.warn(`Property access denied: ${id} by user: ${userId}`);
      return res.status(404).json({ 
        error: 'Property not found or you do not have permission to access it',
      });
    }

    // Attach property to request for use in controller
    req.property = property;
    next();
  } catch (error) {
    logger.error('Property ownership verification error:', error);
    return res.status(500).json({ error: 'Ownership verification failed' });
  }
};

// Middleware to verify tenant ownership
const verifyTenantOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Validate ObjectId format
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tenant ID format' });
    }

    const tenant = await Tenant.findOne({ 
      _id: id, 
      userId: userId,
      deletedAt: null,
    });

    if (!tenant) {
      logger.warn(`Tenant access denied: ${id} by user: ${userId}`);
      return res.status(404).json({ 
        error: 'Tenant not found or you do not have permission to access it',
      });
    }

    // Attach tenant to request for use in controller
    req.tenant = tenant;
    next();
  } catch (error) {
    logger.error('Tenant ownership verification error:', error);
    return res.status(500).json({ error: 'Ownership verification failed' });
  }
};

// Middleware to verify property ownership when propertyId is in body
const verifyPropertyOwnershipFromBody = async (req, res, next) => {
  try {
    const { propertyId } = req.body;
    const userId = req.user.userId;

    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    // Validate ObjectId format
    if (!validateObjectId(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID format' });
    }

    const property = await Property.findOne({ 
      _id: propertyId, 
      userId: userId,
      deletedAt: null,
    });

    if (!property) {
      logger.warn(`Property access denied: ${propertyId} by user: ${userId}`);
      return res.status(404).json({ 
        error: 'Property not found or you do not have permission to access it',
      });
    }

    // Attach property to request
    req.property = property;
    next();
  } catch (error) {
    logger.error('Property ownership verification error:', error);
    return res.status(500).json({ error: 'Ownership verification failed' });
  }
};

module.exports = {
  verifyPropertyOwnership,
  verifyTenantOwnership,
  verifyPropertyOwnershipFromBody,
};