/**
 * Direct MongoDB connection test for Docker setup
 * @file test-mongodb-docker.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function testDockerMongoDB() {
  console.log('🐳 Testing MongoDB in Docker container...\n');
  
  // Try different connection strings
  const connectionStrings = [
    process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support',
    'mongodb://localhost:27017/shrooms-support',
    'mongodb://127.0.0.1:27017/shrooms-support',
    'mongodb://host.docker.internal:27017/shrooms-support'
  ];
  
  for (const uri of connectionStrings) {
    console.log(`\n📡 Trying: ${uri}`);
    
    try {
      // Close any existing connections
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      // Set connection options with shorter timeout
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 5000,
        connectTimeoutMS: 3000,
        maxPoolSize: 1
      };
      
      // Try to connect
      await mongoose.connect(uri, options);
      
      // Test ping
      await mongoose.connection.db.admin().ping();
      
      console.log('✅ SUCCESS! Connected to MongoDB');
      console.log(`✅ Database: ${mongoose.connection.name}`);
      console.log(`✅ Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      
      // Test write operation
      const testDoc = {
        _id: 'docker-test',
        timestamp: new Date(),
        message: 'Docker connection successful'
      };
      
      const testCollection = mongoose.connection.db.collection('connection_test');
      await testCollection.insertOne(testDoc);
      console.log('✅ Write test successful');
      
      // Cleanup
      await testCollection.deleteOne({ _id: 'docker-test' });
      console.log('✅ Cleanup successful');
      
      await mongoose.disconnect();
      console.log('\n🎉 MongoDB connection working perfectly!');
      return true;
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Container might be stopped or port not exposed');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   💡 Hostname resolution failed');
      }
    }
  }
  
  console.log('\n❌ All connection attempts failed');
  
  // Provide Docker-specific troubleshooting
  console.log('\n🔧 Docker troubleshooting steps:');
  console.log('1. Check if MongoDB container is running:');
  console.log('   docker ps');
  console.log('2. Check container logs:');
  console.log('   docker logs <container_name>');
  console.log('3. Restart the container:');
  console.log('   docker restart <container_name>');
  console.log('4. Make sure port 27017 is exposed:');
  console.log('   docker run -d --name mongodb -p 27017:27017 mongo:latest');
  console.log('5. Check container network:');
  console.log('   docker inspect <container_name>');
  
  return false;
}

// Quick Docker status check
async function checkDockerMongoDB() {
  console.log('🐳 Checking Docker MongoDB setup...\n');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    // Check if Docker is running
    await execPromise('docker version');
    console.log('✅ Docker is running');
    
    // Check for MongoDB containers
    const { stdout } = await execPromise('docker ps --filter name=mongo --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
    
    if (stdout.trim()) {
      console.log('📦 MongoDB containers found:');
      console.log(stdout);
    } else {
      console.log('❌ No running MongoDB containers found');
      
      // Check stopped containers
      const { stdout: stopped } = await execPromise('docker ps -a --filter name=mongo --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
      if (stopped.trim()) {
        console.log('⚠️ Stopped MongoDB containers:');
        console.log(stopped);
        console.log('\n💡 Start with: docker start <container_name>');
      }
    }
    
  } catch (error) {
    console.log('❌ Docker not available or error:', error.message);
  }
}

async function main() {
  await checkDockerMongoDB();
  console.log('\n' + '='.repeat(50) + '\n');
  await testDockerMongoDB();
}

main().catch(console.error);