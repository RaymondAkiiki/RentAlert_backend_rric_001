/**
 * Admin Seeder Script
 * Creates 3 default admin accounts
 * 
 * Usage: node scripts/seedAdmins.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/user.model');
const logger = require('../src/utils/logger');


const ADMIN_ACCOUNTS = [
  {
    name: 'Napokolibt',
    email: 'napokolibt@threalty.site',
    password: 'Np8&vT3!zH6$yR9#',
    phone: '+256758526889',
    role: 'admin',
  },
  {
    name: 'Berinde AK',
    email: 'berindeak@threalty.site',
    password: 'Bk5!qN7@xM4$jP2&',
    phone: '+256753793631',
    role: 'admin',
  },
  {
    name: 'Raymond Kirungi',
    email: 'raymondk@thealty.site',
    password: 'RaymondK@2025!Admin',
    phone: '+256702061889',
    role: 'admin',
  },
];

async function seedAdmins() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info('✅ Connected to MongoDB');

    // Check if admins already exist
    const existingAdmins = await User.find({ role: 'admin' });
    
    if (existingAdmins.length > 0) {
      logger.warn('⚠️  Admin accounts already exist. Skipping seed.');
      logger.info(`Found ${existingAdmins.length} existing admin(s):`);
      existingAdmins.forEach(admin => {
        logger.info(`  - ${admin.name} (${admin.email})`);
      });
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise(resolve => {
        rl.question('Do you want to recreate admin accounts? This will DELETE existing admins. (yes/no): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        logger.info('Seeding cancelled.');
        process.exit(0);
      }

      // Delete existing admins
      await User.deleteMany({ role: 'admin' });
      logger.info('🗑️  Deleted existing admin accounts');
    }

    // Create admin accounts
    logger.info('Creating admin accounts...');

    for (const adminData of ADMIN_ACCOUNTS) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminData.password, salt);

      // Create admin
      const admin = await User.create({
        name: adminData.name,
        email: adminData.email,
        password: hashedPassword,
        phone: adminData.phone,
        role: 'admin',
      });

      logger.info(`✅ Created admin: ${admin.name} (${admin.email})`);
    }

    logger.info('\n🎉 Admin seeding completed successfully!\n');
    logger.info('📋 Admin Credentials:');
    logger.info('─────────────────────────────────────────────────');
    
    ADMIN_ACCOUNTS.forEach(admin => {
      logger.info(`\nName: ${admin.name}`);
      logger.info(`Email: ${admin.email}`);
      logger.info(`Password: ${admin.password}`);
    });
    
    logger.info('\n─────────────────────────────────────────────────');
    logger.info('⚠️  IMPORTANT: Change these passwords immediately in production!');
    logger.info('🔒 Store credentials securely and never commit them to version control.');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Admin seeding failed:', error);
    process.exit(1);
  }
}

// Run seeder
seedAdmins();