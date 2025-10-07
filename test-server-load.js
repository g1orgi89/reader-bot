// Test that server module loads without errors
console.log('🧪 Testing server module loading...\n');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test_key';
process.env.ENABLE_SIMPLE_BOT = 'true';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
process.env.APP_WEBAPP_URL = 'https://test.example.com/mini-app/';

try {
  console.log('1️⃣ Loading server module...');
  
  // Prevent actual server startup
  const originalMain = require.main;
  require.main = null;
  
  const serverModule = require('./server/index.js');
  
  require.main = originalMain;
  
  console.log('   ✅ Server module loaded successfully\n');
  
  console.log('2️⃣ Checking exported objects...');
  if (serverModule.app) {
    console.log('   ✅ Express app exported');
  } else {
    console.log('   ❌ Express app NOT exported');
    process.exit(1);
  }
  
  if (serverModule.server) {
    console.log('   ✅ HTTP server exported');
  } else {
    console.log('   ❌ HTTP server NOT exported');
    process.exit(1);
  }
  
  if (serverModule.io) {
    console.log('   ✅ Socket.IO exported');
  } else {
    console.log('   ❌ Socket.IO NOT exported');
    process.exit(1);
  }
  
  if (typeof serverModule.startServer === 'function') {
    console.log('   ✅ startServer function exported');
  } else {
    console.log('   ❌ startServer function NOT exported');
    process.exit(1);
  }
  
  console.log('\n3️⃣ Checking app middleware stack...');
  const app = serverModule.app;
  const middlewareCount = app._router.stack.length;
  console.log(`   ✅ App has ${middlewareCount} middleware/routes registered`);
  
  // Find webhook middleware
  const webhookMiddleware = app._router.stack.find(layer => {
    return layer.regexp && layer.regexp.test('/api/reader/telegram/webhook');
  });
  
  if (webhookMiddleware) {
    console.log('   ✅ Webhook route is registered in middleware stack');
  } else {
    console.log('   ⚠️  Webhook route not yet in stack (bot may still be initializing)');
  }
  
  console.log('\n✅ All basic checks passed!');
  console.log('📝 Note: Bot initialization is async and may still be in progress');
  
  // Give it a moment for async init, then exit
  setTimeout(() => process.exit(0), 100);
  
} catch (error) {
  console.error('\n❌ Failed to load server module:', error.message);
  console.error(error.stack);
  process.exit(1);
}
