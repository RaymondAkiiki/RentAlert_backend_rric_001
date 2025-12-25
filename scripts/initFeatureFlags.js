/**
 * Script to initialize feature flags in the database
 * Run this once: node src/scripts/initFeatureFlags.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const FeatureFlag = require('../src/models/featureflag.model');
const logger = require('../src/utils/logger');

const defaultFeatureFlags = [
  {
    key: 'sms_reminders',
    name: 'SMS Reminders',
    description: 'Send rent reminders via SMS using Africa\'s Talking',
    enabled: true,
    disabledMessage: 'SMS reminders are temporarily unavailable due to high costs. Please use email reminders instead.',
    metadata: {
      costPerSMS: 50,
      provider: 'AfricasTalking',
    },
  },
  {
    key: 'email_reminders',
    name: 'Email Reminders',
    description: 'Send rent reminders via email using Gmail',
    enabled: true,
    disabledMessage: 'Email reminders are temporarily unavailable. Please try again later.',
    metadata: {
      costPerEmail: 0,
      provider: 'Gmail/Nodemailer',
    },
  },
  {
    key: 'csv_import',
    name: 'CSV Import',
    description: 'Bulk import tenants from CSV files',
    enabled: true,
    disabledMessage: 'CSV import is temporarily disabled for maintenance.',
    metadata: {
      maxRowsPerImport: 500,
    },
  },
  {
    key: 'multi_property',
    name: 'Multiple Properties',
    description: 'Allow landlords to manage multiple properties',
    enabled: true,
    disabledMessage: 'Multiple property management is temporarily unavailable.',
    metadata: {},
  },
];

const initializeFeatureFlags = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Check if feature flags already exist
    const existingCount = await FeatureFlag.countDocuments();
    
    if (existingCount > 0) {
      logger.info(`Found ${existingCount} existing feature flags`);
      
      // Update existing flags without overwriting custom settings
      for (const flag of defaultFeatureFlags) {
        const existing = await FeatureFlag.findOne({ key: flag.key });
        
        if (!existing) {
          await FeatureFlag.create(flag);
          logger.info(`✅ Created new feature flag: ${flag.key}`);
        } else {
          logger.info(`ℹ️  Feature flag '${flag.key}' already exists (skipped)`);
        }
      }
    } else {
      // Create all default flags
      await FeatureFlag.insertMany(defaultFeatureFlags);
      logger.info(`✅ Created ${defaultFeatureFlags.length} feature flags`);
    }

    // Display current state
    const allFlags = await FeatureFlag.find();
    console.log('\n📋 Current Feature Flags:');
    console.log('─'.repeat(80));
    allFlags.forEach(flag => {
      const status = flag.enabled ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`${status} | ${flag.name} (${flag.key})`);
      console.log(`   ${flag.description}`);
      if (!flag.enabled) {
        console.log(`   Message: "${flag.disabledMessage}"`);
      }
      console.log('');
    });

    await mongoose.connection.close();
    logger.info('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to initialize feature flags:', error);
    process.exit(1);
  }
};

// Run the script
initializeFeatureFlags();