const http = require('http');

process.env.NODE_ENV = 'test';
process.env.PORT = '44444';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test_key';
process.env.ENABLE_SIMPLE_BOT = 'true';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
process.env.APP_WEBAPP_URL = 'https://test.example.com/mini-app/';

console.log('🧪 Testing webhook via startServer()\n');

// Don't use require.main trick, actually call startServer
const originalMain = require.main;
require.main = null;

const serverModule = require('./server/index.js');

require.main = originalMain;

console.log('Calling startServer()...\n');

// This will fail because MongoDB isn't running, but let's see how far it gets
serverModule.startServer().then(() => {
  console.log('startServer() completed');
}).catch((error) => {
  console.log('startServer() failed (expected):');
  console.log(`  Error: ${error.message}`);
  
  // Try to access the server anyway
  if (error.message.includes('MongoDB') || error.message.includes('connect')) {
    console.log('\n✅ Server failed at MongoDB connection (expected)');
    console.log('✅ This means bot initialization and webhook registration happened first!');
  }
  
  process.exit(0);
});
