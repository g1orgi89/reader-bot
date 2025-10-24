/**
 * Test script to verify Telegram bot webhook configuration
 * @file test-webhook-bot.js
 */

require('dotenv').config();
const SimpleTelegramBot = require('./bot/simpleBot');
const logger = require('./server/utils/logger');

async function testWebhookBot() {
  console.log('🧪 Testing Telegram Bot Webhook Configuration...\n');

  try {
    // Check required environment variables
    console.log('1️⃣ Checking environment variables...');
    
    const requiredVars = {
      'TELEGRAM_BOT_TOKEN': process.env.TELEGRAM_BOT_TOKEN,
      'ENABLE_SIMPLE_BOT': process.env.ENABLE_SIMPLE_BOT,
      'APP_WEBAPP_URL': process.env.APP_WEBAPP_URL
    };

    const optionalVars = {
      'TELEGRAM_WEBHOOK_URL': process.env.TELEGRAM_WEBHOOK_URL,
      'TELEGRAM_WEBHOOK_PATH': process.env.TELEGRAM_WEBHOOK_PATH,
      'ENABLE_REMINDER_CRON': process.env.ENABLE_REMINDER_CRON
    };

    let hasErrors = false;
    
    for (const [key, value] of Object.entries(requiredVars)) {
      if (!value) {
        console.log(`   ❌ ${key} is not set (REQUIRED)`);
        hasErrors = true;
      } else {
        const displayValue = key === 'TELEGRAM_BOT_TOKEN' 
          ? `${value.substring(0, 10)}...` 
          : value;
        console.log(`   ✅ ${key}: ${displayValue}`);
      }
    }

    console.log('\n   Optional variables:');
    for (const [key, value] of Object.entries(optionalVars)) {
      if (!value) {
        console.log(`   ⚠️  ${key}: not set (optional)`);
      } else {
        console.log(`   ✅ ${key}: ${value}`);
      }
    }

    if (hasErrors) {
      console.log('\n❌ Missing required environment variables. Please check your .env file.');
      process.exit(1);
    }

    // Test bot initialization
    console.log('\n2️⃣ Initializing bot...');
    const bot = new SimpleTelegramBot({
      token: process.env.TELEGRAM_BOT_TOKEN,
      environment: process.env.NODE_ENV || 'development',
      appWebAppUrl: process.env.APP_WEBAPP_URL
    });

    await bot.initialize();
    console.log('   ✅ Bot initialized successfully');

    // Test bot info
    console.log('\n3️⃣ Getting bot info...');
    const botInfo = bot.getBotInfo();
    console.log(`   ✅ Bot initialized: ${botInfo.initialized}`);
    console.log(`   ✅ Environment: ${botInfo.environment}`);
    console.log(`   ✅ App URL: ${botInfo.appWebAppUrl}`);

    // Test health check
    console.log('\n4️⃣ Running health check...');
    const health = await bot.healthCheck();
    console.log(`   ✅ Status: ${health.status}`);
    console.log(`   ✅ Bot username: @${health.botInfo.username}`);
    console.log(`   ✅ Bot ID: ${health.botInfo.id}`);
    console.log(`   ✅ Bot name: ${health.botInfo.firstName}`);

    // Test webhook methods availability
    console.log('\n5️⃣ Checking webhook methods...');
    if (typeof bot.webhookCallback === 'function') {
      console.log('   ✅ webhookCallback method available');
    } else {
      console.log('   ❌ webhookCallback method not found');
      hasErrors = true;
    }

    if (typeof bot.setWebhook === 'function') {
      console.log('   ✅ setWebhook method available');
    } else {
      console.log('   ❌ setWebhook method not found');
      hasErrors = true;
    }

    if (typeof bot.getWebhookInfo === 'function') {
      console.log('   ✅ getWebhookInfo method available');
    } else {
      console.log('   ❌ getWebhookInfo method not found');
      hasErrors = true;
    }

    if (typeof bot.deleteWebhook === 'function') {
      console.log('   ✅ deleteWebhook method available');
    } else {
      console.log('   ❌ deleteWebhook method not found');
      hasErrors = true;
    }

    // Check current webhook status
    console.log('\n6️⃣ Checking current webhook status...');
    try {
      const webhookInfo = await bot.getWebhookInfo();
      console.log('   📊 Current webhook info:');
      console.log(`      URL: ${webhookInfo.url || '(not set)'}`);
      console.log(`      Has certificate: ${webhookInfo.has_custom_certificate}`);
      console.log(`      Pending updates: ${webhookInfo.pending_update_count}`);
      console.log(`      Last error: ${webhookInfo.last_error_message || 'none'}`);
      
      if (webhookInfo.url) {
        console.log('   ⚠️  Webhook is already set. To use webhook mode in server:');
        console.log('      1. Make sure TELEGRAM_WEBHOOK_URL is set in .env');
        console.log('      2. Start server with: npm start');
      } else {
        console.log('   ℹ️  No webhook is currently set (polling mode or not started)');
      }
    } catch (error) {
      console.log(`   ❌ Failed to get webhook info: ${error.message}`);
      hasErrors = true;
    }

    // Stop the bot
    await bot.stop('test');

    if (hasErrors) {
      console.log('\n❌ Some tests failed. Please check the errors above.');
      process.exit(1);
    }

    console.log('\n✅ All tests passed!');
    console.log('\n📚 Next steps:');
    console.log('   1. Set TELEGRAM_WEBHOOK_URL in your .env file');
    console.log('   2. Set ENABLE_SIMPLE_BOT=true in your .env file');
    console.log('   3. Start the server: npm start');
    console.log('   4. The server will automatically set up the webhook');
    console.log('\n💡 For more info, see: WEBHOOK_SETUP_GUIDE.md');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testWebhookBot();
