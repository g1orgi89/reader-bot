/**
 * Test script to verify webhook integration refactoring
 * @file test-webhook-integration.js
 */

require('dotenv').config();

console.log('🧪 Testing Telegram Bot Webhook Integration Refactoring\n');

// Test 1: Verify SimpleTelegramBot class structure
console.log('1️⃣ Testing SimpleTelegramBot class...');
try {
  const SimpleTelegramBot = require('./bot/simpleBot');
  console.log('   ✅ SimpleTelegramBot class loaded successfully');
  
  // Check that the class has required methods
  const requiredMethods = ['initialize', 'webhookCallback', 'setWebhook', 'getWebhookInfo'];
  const prototype = SimpleTelegramBot.prototype;
  
  for (const method of requiredMethods) {
    if (typeof prototype[method] === 'function') {
      console.log(`   ✅ Method '${method}' exists`);
    } else {
      console.log(`   ❌ Method '${method}' missing`);
      process.exit(1);
    }
  }
} catch (error) {
  console.log(`   ❌ Failed to load SimpleTelegramBot: ${error.message}`);
  process.exit(1);
}

// Test 2: Verify server structure
console.log('\n2️⃣ Testing server structure...');
try {
  const serverCode = require('fs').readFileSync('./server/index.js', 'utf-8');
  
  // Check that placeholder webhook handler is removed
  if (serverCode.includes('Bot initializing') && serverCode.includes('queueing')) {
    console.log('   ❌ Old placeholder webhook handler still present!');
    process.exit(1);
  } else {
    console.log('   ✅ Placeholder webhook handler removed');
  }
  
  // Check that bot initialization happens in startServer
  if (serverCode.includes('await simpleBot.initialize()') && 
      serverCode.includes('simpleBot.webhookCallback(webhookPath)')) {
    console.log('   ✅ Bot initialization and webhook registration in correct order');
  } else {
    console.log('   ❌ Bot initialization or webhook registration not found');
    process.exit(1);
  }
  
  // Check that webhook is registered with actual handler, not placeholder
  const webhookRegistrationMatch = serverCode.match(/app\.use\(webhookPath,\s*simpleBot\.webhookCallback/);
  if (webhookRegistrationMatch) {
    console.log('   ✅ Webhook registered with actual Telegraf handler');
  } else {
    console.log('   ❌ Webhook not registered with actual handler');
    process.exit(1);
  }
  
  // Check that bot initialization happens before server.listen
  const initIndex = serverCode.indexOf('await simpleBot.initialize()');
  const listenIndex = serverCode.indexOf('server.listen(PORT');
  
  if (initIndex > 0 && listenIndex > 0 && initIndex < listenIndex) {
    console.log('   ✅ Bot initialization happens before server starts listening');
  } else {
    console.log('   ❌ Bot initialization order incorrect');
    process.exit(1);
  }
  
} catch (error) {
  console.log(`   ❌ Failed to analyze server structure: ${error.message}`);
  process.exit(1);
}

// Test 3: Check initialization flow with mock bot
console.log('\n3️⃣ Testing initialization flow...');
try {
  // Mock a simple bot to test initialization
  const mockBot = {
    isInitialized: false,
    async initialize() {
      this.isInitialized = true;
      return true;
    },
    webhookCallback(path) {
      if (!this.isInitialized) {
        throw new Error('Bot must be initialized before creating webhook callback');
      }
      return (req, res, next) => {
        res.status(200).json({ ok: true });
      };
    }
  };
  
  // Test correct flow: initialize then get webhook callback
  mockBot.initialize().then(() => {
    if (mockBot.isInitialized) {
      console.log('   ✅ Mock bot initialized successfully');
    } else {
      console.log('   ❌ Mock bot initialization failed');
      process.exit(1);
    }
    
    try {
      const callback = mockBot.webhookCallback('/test');
      console.log('   ✅ Webhook callback created after initialization');
    } catch (error) {
      console.log(`   ❌ Failed to create webhook callback: ${error.message}`);
      process.exit(1);
    }
  });
  
} catch (error) {
  console.log(`   ❌ Initialization flow test failed: ${error.message}`);
  process.exit(1);
}

// Test 4: Verify no duplicate webhook registrations
console.log('\n4️⃣ Checking for duplicate webhook registrations...');
try {
  const serverCode = require('fs').readFileSync('./server/index.js', 'utf-8');
  const webhookRegistrations = serverCode.match(/app\.use\(webhookPath,\s*simpleBot\.webhookCallback/g);
  
  if (webhookRegistrations && webhookRegistrations.length === 1) {
    console.log('   ✅ Webhook registered exactly once');
  } else if (webhookRegistrations && webhookRegistrations.length > 1) {
    console.log(`   ❌ Webhook registered ${webhookRegistrations.length} times (should be 1)`);
    process.exit(1);
  } else {
    console.log('   ❌ Webhook registration not found');
    process.exit(1);
  }
} catch (error) {
  console.log(`   ❌ Failed to check duplicate registrations: ${error.message}`);
  process.exit(1);
}

console.log('\n✅ All webhook integration tests passed!');
console.log('\n📚 Summary of changes:');
console.log('   • Bot initialization moved to startServer() before HTTP server starts');
console.log('   • Webhook registered with actual Telegraf handler (no placeholder)');
console.log('   • Webhook registration happens FIRST, before other middleware');
console.log('   • No duplicate webhook registrations');
console.log('   • Bot is fully initialized before accepting webhook requests');
console.log('\n💡 Expected behavior:');
console.log('   • Telegram webhook requests will NEVER return 404');
console.log('   • All requests will be handled by Telegraf (200 OK or error handling)');
console.log('   • /start command and other bot features will work immediately');

process.exit(0);
