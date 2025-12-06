/**
 * Test script to verify all Phase 1 configurations
 * Run: node test-connections.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

console.log('🔍 Testing RentAlert Phase 1 Connections...\n');

// Test 1: Environment Variables
console.log('1️⃣ Checking environment variables...');
const requiredEnvVars = [
  'MONGODB_URI',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'AT_USERNAME',
  'AT_API_KEY',
  'AT_SENDER_ID',
];

let envCheck = true;
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.log(`   ❌ Missing: ${varName}`);
    envCheck = false;
  } else {
    console.log(`   ✅ ${varName} is set`);
  }
});

if (!envCheck) {
  console.log('\n❌ Environment variables check failed!\n');
  process.exit(1);
}

console.log('   ✅ All environment variables present\n');

// Test 2: MongoDB Connection
async function testMongoDB() {
  console.log('2️⃣ Testing MongoDB connection...');
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`   ✅ MongoDB connected: ${mongoose.connection.host}`);
    console.log(`   ✅ Database: ${mongoose.connection.name}\n`);
    await mongoose.connection.close();
  } catch (error) {
    console.log(`   ❌ MongoDB connection failed: ${error.message}\n`);
    throw error;
  }
}

// Test 3: Gmail/Nodemailer
async function testEmail() {
  console.log('3️⃣ Testing Gmail/Nodemailer connection...');
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    
    await transporter.verify();
    console.log(`   ✅ Gmail connection verified`);
    console.log(`   ✅ Sender: ${process.env.GMAIL_USER}\n`);
  } catch (error) {
    console.log(`   ❌ Gmail connection failed: ${error.message}`);
    console.log('   💡 Ensure 2FA is enabled and app password is correct\n');
    throw error;
  }
}

// Test 4: Africa's Talking (basic validation)
async function testAfricasTalking() {
  console.log('4️⃣ Checking Africa\'s Talking configuration...');
  
  if (process.env.AT_USERNAME && process.env.AT_API_KEY) {
    console.log(`   ✅ Username: ${process.env.AT_USERNAME}`);
    console.log(`   ✅ Sender ID: ${process.env.AT_SENDER_ID}`);
    console.log(`   ℹ️  Note: SMS functionality will be tested in Phase 3\n`);
  } else {
    console.log(`   ❌ Africa's Talking credentials missing\n`);
    throw new Error('Missing AT credentials');
  }
}

// Test 5: Clerk Configuration
async function testClerk() {
  console.log('5️⃣ Checking Clerk configuration...');
  
  if (process.env.CLERK_SECRET_KEY.startsWith('sk_')) {
    console.log(`   ✅ Clerk secret key format valid`);
  } else {
    console.log(`   ❌ Invalid Clerk secret key format`);
    throw new Error('Invalid Clerk key');
  }
  
  if (process.env.CLERK_PUBLISHABLE_KEY.startsWith('pk_')) {
    console.log(`   ✅ Clerk publishable key format valid`);
  } else {
    console.log(`   ❌ Invalid Clerk publishable key format`);
    throw new Error('Invalid Clerk key');
  }
  
  console.log(`   ℹ️  Test Clerk authentication via frontend\n`);
}

// Run all tests
async function runTests() {
  try {
    await testMongoDB();
    await testEmail();
    await testAfricasTalking();
    await testClerk();
    
    console.log('✅ All Phase 1 configurations verified successfully!\n');
    console.log('🚀 You can now start the development servers:');
    console.log('   Backend:  npm run dev');
    console.log('   Frontend: cd ../frontend && npm run dev\n');
    
    process.exit(0);
  } catch (error) {
    console.log('\n❌ Configuration test failed!');
    console.log('Please fix the errors above and try again.\n');
    process.exit(1);
  }
}

runTests();