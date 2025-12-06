const express = require('express');
const {
  createProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty,
} = require('../controllers/property.controller');
const { authenticate } = require('../middleware/auth');
const { verifyPropertyOwnership } = require('../middleware/ownership');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/properties - Create property
router.post('/', createProperty);

// GET /api/properties - Get all properties for user
router.get('/', getProperties);

// GET /api/properties/:id - Get single property with tenants
router.get('/:id', verifyPropertyOwnership, getProperty);

// PATCH /api/properties/:id - Update property
router.patch('/:id', verifyPropertyOwnership, updateProperty);

// DELETE /api/properties/:id - Delete property
router.delete('/:id', verifyPropertyOwnership, deleteProperty);

module.exports = router;