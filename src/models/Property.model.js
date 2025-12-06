const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    ref: 'User',
  },
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50,
    trim: true,
  },
  address: {
    type: String,
    maxlength: 200,
    trim: true,
    default: '',
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

// Compound index for efficient queries
propertySchema.index({ userId: 1, deletedAt: 1 });

// Virtual for tenant count
propertySchema.virtual('tenantCount', {
  ref: 'Tenant',
  localField: '_id',
  foreignField: 'propertyId',
  count: true,
});

// Instance method to soft delete
propertySchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to check if deleted
propertySchema.methods.isDeleted = function() {
  return this.deletedAt !== null;
};

// Static method to find active properties for a user
propertySchema.statics.findActiveByUser = function(userId) {
  return this.find({ userId, deletedAt: null }).sort({ createdAt: -1 });
};

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;