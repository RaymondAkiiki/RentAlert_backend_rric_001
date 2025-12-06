const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Property = require('../models/property.model');
const EventLog = require('../models/eventlog.model');
const logger = require('../utils/logger');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Register new user
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Name, email, and password are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Validate phone format if provided
    if (phone && !phone.match(/^\+256\d{9}$/)) {
      return res.status(400).json({ 
        error: 'Invalid Uganda phone format. Must be +256XXXXXXXXX' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone || null,
      role: 'landlord',
    });

    logger.info(`✅ New user registered: ${user.email}`);

    // Create default property
    await Property.create({
      userId: user._id,
      name: 'My Property',
      address: '',
    });

    logger.info(`✅ Default property created for user: ${user._id}`);

    // Log registration event
    await EventLog.logEvent(user._id.toString(), 'USER_REGISTERED', {
      hasPhone: !!phone,
    });

    // Generate token
    const token = generateToken(user._id.toString());

    // Return user data and token
    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        hasPhone: !!user.phone,
      },
    });
  } catch (error) {
    logger.error('❌ Registration error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ 
        error: `${field} already registered` 
      });
    }

    return res.status(500).json({ 
      error: 'Failed to register user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info(`✅ User logged in: ${user.email}`);

    // Log login event
    await EventLog.logEvent(user._id.toString(), 'USER_LOGGED_IN', {});

    // Generate token
    const token = generateToken(user._id.toString());

    // Return user data and token
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        hasPhone: !!user.phone,
      },
    });
  } catch (error) {
    logger.error('❌ Login error:', error);
    return res.status(500).json({ 
      error: 'Failed to login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        hasPhone: !!user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.userId).select('+password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update name
    if (name) {
      user.name = name.trim();
    }

    // Update phone
    if (phone !== undefined) {
      if (phone && !phone.match(/^\+256\d{9}$/)) {
        return res.status(400).json({ 
          error: 'Invalid Uganda phone format. Must be +256XXXXXXXXX' 
        });
      }
      
      // Check if phone is already taken by another user
      if (phone) {
        const existingPhone = await User.findOne({ 
          phone, 
          _id: { $ne: user._id } 
        });
        
        if (existingPhone) {
          return res.status(409).json({ 
            error: 'Phone number already registered by another user' 
          });
        }
      }
      
      user.phone = phone || null;
    }

    // Update password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ 
          error: 'Current password is required to set new password' 
        });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        return res.status(400).json({ 
          error: 'New password must be at least 8 characters long' 
        });
      }

      // Hash and update password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    logger.info(`User profile updated: ${user.email}`);

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        hasPhone: !!user.phone,
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'Phone number already registered' 
      });
    }

    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      return res.status(200).json({ 
        message: 'If an account exists, a password reset link has been sent' 
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user._id.toString(), purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TODO: Send email with reset link
    // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    // await sendPasswordResetEmail(user.email, resetLink);

    logger.info(`Password reset requested for: ${user.email}`);

    return res.status(200).json({ 
      message: 'If an account exists, a password reset link has been sent',
      // Only include token in development for testing
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    });
  } catch (error) {
    logger.error('Password reset request error:', error);
    return res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token and new password are required' 
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.purpose !== 'password-reset') {
        return res.status(400).json({ error: 'Invalid reset token' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Find user
    const user = await User.findById(decoded.userId).select('+password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    logger.info(`Password reset successful for: ${user.email}`);

    return res.status(200).json({ 
      message: 'Password reset successful. You can now login with your new password.' 
    });
  } catch (error) {
    logger.error('Password reset error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  requestPasswordReset,
  resetPassword,
};