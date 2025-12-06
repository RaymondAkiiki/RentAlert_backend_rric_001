const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getProfile, 
  updateProfile,
  requestPasswordReset,
  resetPassword,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);

module.exports = router;