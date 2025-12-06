const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // Don't return password by default
    minlength: 8,
  },
  phone: {
    type: String,
    required: false,
    match: /^\+256\d{9}$/,
    default: null,
    sparse: true, // Allow multiple null values but unique non-null values
  },
  role: {
    type: String,
    enum: ['landlord', 'admin'],
    default: 'landlord',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Update the updatedAt timestamp before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

// Instance method to check if user has phone
userSchema.methods.hasPhone = function() {
  return this.phone && this.phone !== null;
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', userSchema);

module.exports = User;