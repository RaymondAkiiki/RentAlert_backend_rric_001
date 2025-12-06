const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    ref: 'User',
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Property',
  },
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 50,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    match: /^\+256\d{9}$/,
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    default: null,
  },
  unitNumber: {
    type: String,
    required: true,
    maxlength: 20,
    trim: true,
  },
  rentAmount: {
    type: Number,
    required: true,
    min: 10000,
    max: 50000000,
  },
  dueDate: {
    type: Number,
    required: true,
    min: 1,
    max: 31,
  },
  status: {
    type: String,
    enum: ['paid', 'unpaid'],
    default: 'unpaid',
  },
  lastReminderSentAt: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
tenantSchema.index({ userId: 1, status: 1, deletedAt: 1 });
tenantSchema.index({ userId: 1, dueDate: 1, status: 1 });
tenantSchema.index({ propertyId: 1, deletedAt: 1 });

// Instance method to soft delete
tenantSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to check if deleted
tenantSchema.methods.isDeleted = function() {
  return this.deletedAt !== null;
};

// Instance method to toggle status
tenantSchema.methods.toggleStatus = function() {
  this.status = this.status === 'paid' ? 'unpaid' : 'paid';
  return this.save();
};

// Static method to find active tenants for a user
tenantSchema.statics.findActiveByUser = function(userId, filters = {}) {
  const query = { userId, deletedAt: null, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find unpaid tenants with upcoming due date
tenantSchema.statics.findUnpaidDueSoon = function(userId, daysAhead = 3) {
  const today = new Date();
  const targetDay = new Date();
  targetDay.setDate(today.getDate() + daysAhead);
  
  return this.find({
    userId,
    status: 'unpaid',
    dueDate: targetDay.getDate(),
    deletedAt: null,
  });
};

const Tenant = mongoose.model('Tenant', tenantSchema);

module.exports = Tenant;