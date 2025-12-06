const express = require('express');
const {
  createTenant,
  getTenants,
  getTenant,
  updateTenant,
  updateTenantStatus,
  deleteTenant,
} = require('../controllers/tenant.controller');
const { validateCSV, importCSV } = require('../controllers/csv.controller');
const { authenticate } = require('../middleware/auth');
const {
  verifyTenantOwnership,
  verifyPropertyOwnershipFromBody,
} = require('../middleware/ownership');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// CSV Import routes
router.post('/import/validate', verifyPropertyOwnershipFromBody, validateCSV);
router.post('/import/confirm', verifyPropertyOwnershipFromBody, importCSV);

// POST /api/tenants - Create tenant (verify property ownership from body)
router.post('/', verifyPropertyOwnershipFromBody, createTenant);

// GET /api/tenants - Get all tenants for user
router.get('/', getTenants);

// GET /api/tenants/:id - Get single tenant
router.get('/:id', verifyTenantOwnership, getTenant);

// PATCH /api/tenants/:id - Update tenant
router.patch('/:id', verifyTenantOwnership, updateTenant);

// PATCH /api/tenants/:id/status - Update tenant status (Paid/Unpaid)
router.patch('/:id/status', verifyTenantOwnership, updateTenantStatus);

// DELETE /api/tenants/:id - Delete tenant
router.delete('/:id', verifyTenantOwnership, deleteTenant);

module.exports = router;