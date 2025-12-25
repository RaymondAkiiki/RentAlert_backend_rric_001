const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
    enum: ['sms_reminders', 'email_reminders', 'csv_import', 'multi_property'],
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  disabledMessage: {
    type: String,
    default: 'This feature is temporarily unavailable.',
  },
  lastModifiedBy: {
    type: String,
    ref: 'User',
    default: null,
  },
  lastModifiedAt: {
    type: Date,
    default: null,
  },
  metadata: {
    type: Object,
    default: {},
  },
}, {
  timestamps: true,
});

// Static method to check if a feature is enabled
featureFlagSchema.statics.isEnabled = async function(key) {
  const feature = await this.findOne({ key });
  if (!feature) {
    // If feature flag doesn't exist, default to enabled
    return true;
  }
  return feature.enabled;
};

// Static method to get all feature flags
featureFlagSchema.statics.getAllFlags = async function() {
  const flags = await this.find().select('-__v');
  return flags.reduce((acc, flag) => {
    acc[flag.key] = {
      enabled: flag.enabled,
      name: flag.name,
      description: flag.description,
      disabledMessage: flag.disabledMessage,
    };
    return acc;
  }, {});
};

// Static method to toggle a feature
featureFlagSchema.statics.toggleFeature = async function(key, enabled, adminId) {
  const feature = await this.findOne({ key });
  
  if (!feature) {
    throw new Error(`Feature flag '${key}' not found`);
  }

  feature.enabled = enabled;
  feature.lastModifiedBy = adminId;
  feature.lastModifiedAt = new Date();
  
  await feature.save();
  return feature;
};

// Instance method to toggle
featureFlagSchema.methods.toggle = function(adminId) {
  this.enabled = !this.enabled;
  this.lastModifiedBy = adminId;
  this.lastModifiedAt = new Date();
  return this.save();
};

const FeatureFlag = mongoose.model('FeatureFlag', featureFlagSchema);

module.exports = FeatureFlag;