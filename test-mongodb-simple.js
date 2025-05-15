/**
 * Simple MongoDB connection test script
 * @file test-mongodb-simple.js
 */

const mongoose = require('mongoose');

async function testMongoConnection() {
  console.log('🔍 Testing MongoDB connection...');
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support';
  console.log(`📡 Connecting to: ${uri}`);
  
  try {
    // Set a shorter timeout for testing
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 10000,
      maxPoolSize: 1
    };
    
    console.log('⏳ Attempting connection...');
    await mongoose.connect(uri, options);
    
    console.log('✅ Successfully connected to MongoDB!');
    
    // Test database operations
    console.log('🔍 Testing database operations...');
    const db = mongoose.connection.db;
    
    // Ping the database
    await db.admin().ping();
    console.log('✅ Database ping successful');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`📁 Found ${collections.length} collections:`, 
                collections.map(c => c.name).join(', ') || 'none');
    
    // Test writing
    const testCollection = db.collection('connection_test');
    const testDoc = { 
      _id: 'test-connection',
      timestamp: new Date(),
      message: 'Connection test successful' 
    };
    
    await testCollection.insertOne(testDoc);
    console.log('✅ Test document inserted');
    
    // Test reading
    const retrievedDoc = await testCollection.findOne({ _id: 'test-connection' });
    console.log('✅ Test document retrieved:', retrievedDoc ? 'Found' : 'Not found');
    
    // Cleanup
    await testCollection.deleteOne({ _id: 'test-connection' });
    console.log('✅ Test document cleaned up');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
    console.log('\n🎉 All tests passed! MongoDB is working correctly.');
    
  } catch (error) {
    console.error('\n❌ MongoDB connection failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Suggestions:');
      console.error('1. Make sure MongoDB is running:');
      console.error('   sudo systemctl start mongodb');
      console.error('2. Check if MongoDB is installed:');
      console.error('   mongosh --version');
      console.error('3. Try using MongoDB Atlas (cloud):');
      console.error('   https://www.mongodb.com/atlas');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Suggestions:');
      console.error('1. Check your MONGODB_URI in .env file');
      console.error('2. Make sure the hostname/port are correct');
    } else if (error.code === 'EAUTH') {
      console.error('\n💡 Suggestions:');
      console.error('1. Check your username/password in MONGODB_URI');
      console.error('2. Make sure the user has proper permissions');
    }
    
    process.exit(1);
  }
}

// Check for MongoDB installation
async function checkMongoInstallation() {
  console.log('🔍 Checking MongoDB installation...');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    const { stdout } = await execPromise('mongosh --version');
    console.log('✅ MongoDB Shell found:', stdout.trim());
  } catch (error) {
    console.log('⚠️ MongoDB Shell not found. Installing MongoDB...');
    console.log('Please run: sudo apt update && sudo apt install mongodb');
  }
}

// Run the test
async function main() {
  console.log('🍄 Shrooms Support Bot - MongoDB Connection Test\n');
  
  await checkMongoInstallation();
  console.log('');
  await testMongoConnection();
}

main().catch(console.error);