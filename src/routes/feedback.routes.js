const express = require('express');
const { submitFeedback } = require('../controllers/feedback.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/feedback - Submit feedback
router.post('/', submitFeedback);

module.exports = router;