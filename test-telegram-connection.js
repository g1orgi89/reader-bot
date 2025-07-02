/**
 * @fileoverview Тест подключения к Telegram API для Reader Bot
 * @author g1orgi89
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');

/**
 * Простой тест подключения к Telegram API
 */
async function testTelegramConnection() {
  console.log('🧪 Testing Telegram Bot Connection...\n');

  // Проверяем наличие токена
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env file');
    console.log('📋 Steps to fix:');
    console.log('  1. Copy .env.example to .env');
    console.log('  2. Create a bot with @BotFather');
    console.log('  3. Set TELEGRAM_BOT_TOKEN in .env');
    return;
  }

  console.log(`🔑 Token found: ${token.substring(0, 10)}...`);

  try {
    // Создаем экземпляр бота
    const bot = new Telegraf(token);
    
    // Тестируем getMe
    console.log('📡 Testing getMe API call...');
    const me = await bot.telegram.getMe();
    
    console.log('✅ Bot connection successful!');
    console.log(`📖 Bot Info:`);
    console.log(`   ID: ${me.id}`);
    console.log(`   Name: ${me.first_name}`);
    console.log(`   Username: @${me.username}`);
    console.log(`   Is Bot: ${me.is_bot}`);
    
    // Проверяем webhook статус
    console.log('\n📡 Checking webhook status...');
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log(`   Webhook URL: ${webhookInfo.url || 'Not set (polling mode)'}`);
    console.log(`   Pending updates: ${webhookInfo.pending_update_count}`);
    
    console.log('\n🎉 Telegram bot is ready for Reader Bot!');
    console.log('\n📋 Next steps:');
    console.log('  1. Run: npm run telegram');
    console.log('  2. Find your bot: @' + me.username);
    console.log('  3. Send /start to test');
    
  } catch (error) {
    console.error('❌ Bot connection failed:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n🔧 Fix: Invalid token');
      console.log('  1. Check TELEGRAM_BOT_TOKEN in .env');
      console.log('  2. Create new bot with @BotFather');
      console.log('  3. Make sure token format: 123456789:ABC-DEF...');
    } 
    else if (error.message.includes('404')) {
      console.log('\n🔧 Fix: Network/API issue');
      console.log('  1. Check internet connection');
      console.log('  2. Try VPN if Telegram is blocked');
      console.log('  3. Verify token is not revoked');
    }
    else if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNRESET')) {
      console.log('\n🔧 Fix: Connection timeout');
      console.log('  1. Check firewall settings');
      console.log('  2. Try different network');
      console.log('  3. Use VPN service');
    }
    
    console.log('\n🌐 Test token manually:');
    console.log(`curl https://api.telegram.org/bot${token}/getMe`);
  }
}

// Дополнительная диагностика
async function diagnostics() {
  console.log('\n🔍 System Diagnostics:');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Проверяем сетевое соединение
  const https = require('https');
  
  return new Promise((resolve) => {
    console.log('\n🌐 Testing network connection to Telegram...');
    
    const req = https.request('https://api.telegram.org/', (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
      resolve();
    });
    
    req.on('error', (error) => {
      console.log(`   Network Error: ${error.message}`);
      resolve();
    });
    
    req.setTimeout(5000, () => {
      console.log('   Network Timeout: Cannot reach Telegram API');
      req.destroy();
      resolve();
    });
    
    req.end();
  });
}

// Запуск тестов
async function main() {
  await testTelegramConnection();
  await diagnostics();
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testTelegramConnection, diagnostics };