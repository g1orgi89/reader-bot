/**
 * Quick MongoDB diagnosis script
 * @file diagnose-mongodb.js
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function diagnoseSystem() {
  console.log('🔍 Diagnosing MongoDB setup...\n');
  
  // Check if we're on Windows
  const isWindows = process.platform === 'win32';
  console.log(`🖥️ Platform: ${process.platform} (${isWindows ? 'Windows' : 'Unix-like'})`);
  
  // Check Node.js version
  console.log(`🟢 Node.js version: ${process.version}`);
  
  // Check if MongoDB is installed
  console.log('\n📦 Checking MongoDB installation...');
  
  try {
    if (isWindows) {
      try {
        await execPromise('where mongosh');
        console.log('✅ MongoDB Shell (mongosh) found');
      } catch (error) {
        console.log('❌ MongoDB Shell (mongosh) not found');
        console.log('💡 Install from: https://www.mongodb.com/try/download/compass');
      }
      
      try {
        await execPromise('where mongo');
        console.log('✅ Legacy MongoDB Client (mongo) found');
      } catch (error) {
        console.log('❌ Legacy MongoDB Client (mongo) not found');
      }
    } else {
      // Linux/Mac commands
      try {
        await execPromise('which mongosh');
        console.log('✅ MongoDB Shell (mongosh) found');
      } catch (error) {
        console.log('❌ MongoDB Shell (mongosh) not found');
      }
    }
  } catch (error) {
    console.error('Error checking MongoDB:', error.message);
  }
  
  // Check if MongoDB service is running
  console.log('\n🔄 Checking MongoDB service status...');
  
  if (isWindows) {
    try {
      const { stdout } = await execPromise('sc query MongoDB');
      if (stdout.includes('RUNNING')) {
        console.log('✅ MongoDB service is running');
      } else {
        console.log('❌ MongoDB service is not running');
        console.log('💡 Try: net start MongoDB');
      }
    } catch (error) {
      console.log('❌ MongoDB service not found or not running');
      console.log('💡 MongoDB might not be installed as a Windows service');
    }
  } else {
    try {
      await execPromise('systemctl is-active --quiet mongod');
      console.log('✅ MongoDB service is running');
    } catch (error) {
      console.log('❌ MongoDB service is not running');
      console.log('💡 Try: sudo systemctl start mongod');
    }
  }
  
  // Test connection to default MongoDB port
  console.log('\n🔌 Testing MongoDB port accessibility...');
  
  const net = require('net');
  const testPort = (host, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(3000);
      
      socket.on('connect', () => {
        console.log(`✅ Port ${port} on ${host} is accessible`);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        console.log(`❌ Timeout connecting to ${host}:${port}`);
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', (error) => {
        console.log(`❌ Error connecting to ${host}:${port} - ${error.message}`);
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  };
  
  await testPort('localhost', 27017);
  
  // Suggest solutions
  console.log('\n💡 Suggested solutions:');
  console.log('1. Install MongoDB Community Server:');
  console.log('   https://www.mongodb.com/try/download/community');
  
  if (isWindows) {
    console.log('\n2. For Windows:');
    console.log('   - Download MongoDB Installer');
    console.log('   - Install with "Install MongoDB as a Service" option');
    console.log('   - Start service: net start MongoDB');
  } else {
    console.log('\n2. For Linux:');
    console.log('   sudo apt update && sudo apt install mongodb');
    console.log('   sudo systemctl start mongod');
    console.log('   sudo systemctl enable mongod');
  }
  
  console.log('\n3. Alternative: Use MongoDB Docker:');
  console.log('   docker run -d --name mongodb -p 27017:27017 mongo:latest');
  
  console.log('\n4. Alternative: Use MongoDB Atlas (Cloud):');
  console.log('   https://www.mongodb.com/atlas');
  console.log('   Update MONGODB_URI in .env with Atlas connection string');
}

diagnoseSystem().catch(console.error);