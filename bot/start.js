/**
 * Standalone startup script for Simple Telegram Bot
 * @file bot/start.js
 * @author Reader Bot Team
 */

// Load environment variables
require('dotenv').config();

const logger = require('../server/utils/logger');
const SimpleTelegramBot = require('./simpleBot');

/**
 * Start Simple Telegram Bot
 * @returns {Promise<SimpleTelegramBot>}
 */
async function startSimpleBot() {
  try {
    logger.info('🚀 Starting Simple Telegram Bot...');
    
    // Validate required environment variables
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }
    
    // Get configuration from environment
    const config = {
      token: process.env.TELEGRAM_BOT_TOKEN,
      environment: process.env.NODE_ENV || 'production',
      appWebAppUrl: process.env.APP_WEBAPP_URL || 'https://app.unibotz.com/mini-app/'
    };
    
    logger.info(`🤖 Environment: ${config.environment}`);
    logger.info(`📱 Mini App URL: ${config.appWebAppUrl}`);
    
    // Create and start bot
    const bot = new SimpleTelegramBot(config);
    await bot.start();
    
    logger.info('✅ Simple Telegram Bot started successfully');
    logger.info('🤖 Bot is ready to receive messages');
    
    // Log bot info
    const botInfo = bot.getBotInfo();
    logger.info('📋 Bot configuration:', {
      initialized: botInfo.initialized,
      environment: botInfo.environment,
      appWebAppUrl: botInfo.appWebAppUrl,
      hasToken: botInfo.hasToken
    });
    
    return bot;
    
  } catch (error) {
    logger.error(`❌ Failed to start Simple Telegram Bot: ${error.message}`);
    console.error('Error details:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 * @param {SimpleTelegramBot} bot - Bot instance to stop
 * @param {string} signal - Signal received
 */
async function gracefulShutdown(bot, signal) {
  logger.info(`🔄 Received ${signal}, shutting down gracefully...`);
  
  try {
    if (bot) {
      await bot.stop(signal);
    }
    
    logger.info('✅ Simple Telegram Bot shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error(`❌ Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Export for module usage
module.exports = {
  startSimpleBot,
  SimpleTelegramBot
};

// Run if called directly
if (require.main === module) {
  startSimpleBot()
    .then((bot) => {
      // Setup graceful shutdown
      process.on('SIGTERM', () => gracefulShutdown(bot, 'SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown(bot, 'SIGINT'));
      
      logger.info('🔗 Simple Telegram Bot process is running...');
      logger.info('💡 Use Ctrl+C to stop the bot');
    })
    .catch((error) => {
      logger.error('❌ Startup failed:', error);
      process.exit(1);
    });
}