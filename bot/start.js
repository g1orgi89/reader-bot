/**
 * Standalone startup script for Simple Telegram Bot (DEPRECATED - use server/index.js)
 * @file bot/start.js
 * @author Reader Bot Team
 * 
 * ⚠️ DEPRECATED: This file is deprecated in favor of webhook integration in server/index.js
 * 
 * The bot now runs in webhook mode integrated with the main server.
 * To start the bot, use: npm start (with ENABLE_SIMPLE_BOT=true in .env)
 * 
 * This file is kept for reference and backwards compatibility only.
 * DO NOT use this file for production deployments.
 */

/* DEPRECATED - Polling mode startup (kept for reference)

setInterval(() => {
  console.log('[DEBUG] PROCESS ALIVE', new Date().toISOString());
}, 60000);
// Set timezone to Moscow
process.env.TZ = process.env.TZ || 'Europe/Moscow';

// Load environment variables
require('dotenv').config();

const dbService = require('../server/services/database');
const logger = require('../server/utils/logger');
const SimpleTelegramBot = require('./simpleBot');
const { ReminderService } = require('../server/services/reminderService');
const { initReminderCron, stopReminderCron } = require('../server/scheduler/reminderJobs');

/**
 * Start Simple Telegram Bot
 * @returns {Promise<Object>}
 */
async function startSimpleBot() {
  try {
    logger.info('🚀 Starting Simple Telegram Bot...');

    logger.info('📡 Connecting to MongoDB from bot process...');
    await dbService.connect();
    logger.info('✅ MongoDB connected (bot process)');
    
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
    logger.info(`🌍 Timezone: ${process.env.TZ}`);
    
    // Create and start bot
    const bot = new SimpleTelegramBot(config);
    await bot.start();
    console.log('DEBUG: после await bot.start()');
    
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
    
    // Initialize ReminderService
    logger.info('🔔 Initializing ReminderService...');
    const reminderService = new ReminderService();
    reminderService.initialize({ bot: bot.bot });
    global.reminderService = reminderService;
    logger.info('✅ ReminderService initialized and available globally');
    
    // Initialize reminder cron jobs if enabled
    let reminderJobs = null;
    const enableCron = process.env.ENABLE_REMINDER_CRON !== 'false';
    
    if (enableCron) {
      logger.info('🔔 Initializing reminder cron jobs...');
      reminderJobs = initReminderCron({ reminderService });
      console.log('DEBUG: initReminderCron вызван ИЗ bot/start.js');

      console.log('DEBUG: reminderJobs:', reminderJobs);
      if (reminderJobs && reminderJobs.morning) {
      console.log('DEBUG: typeof morning:', typeof reminderJobs.morning);
      console.log('DEBUG: morning.start:', reminderJobs.morning.start ? 'yes' : 'no');
      console.log('DEBUG: morning.stop:', reminderJobs.morning.stop ? 'yes' : 'no');
        try {
        reminderJobs.morning.start();
        console.log('DEBUG: Forced morning.start() called');
      } catch (e) {
        console.error('ERROR: calling morning.start()', e);
      }
    }
      if (reminderJobs) {
        logger.info('✅ Reminder cron jobs started successfully');
      } else {
        logger.warn('⚠️ Failed to initialize reminder cron jobs');
      }
    } else {
      logger.info('⏸️ Reminder cron jobs disabled (ENABLE_REMINDER_CRON=false)');
    }
    
    return { bot, reminderService, reminderJobs };
    
  } catch (error) {
    logger.error(`❌ Failed to start Simple Telegram Bot: ${error.message}`);
    console.error('Error details:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 * @param {Object} services - Services to stop
 * @param {SimpleTelegramBot} services.bot - Bot instance to stop
 * @param {Object} services.reminderJobs - Cron jobs to stop
 * @param {string} signal - Signal received
 */
async function gracefulShutdown(services, signal) {
  logger.info(`🔄 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Stop reminder cron jobs
    if (services.reminderJobs) {
      stopReminderCron(services.reminderJobs);
    }
    
    // Stop bot
    if (services.bot) {
      await services.bot.stop(signal);
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

*/ // End of deprecated polling mode code

// Show deprecation warning
console.warn('⚠️⚠️⚠️ WARNING: bot/start.js is DEPRECATED ⚠️⚠️⚠️');
console.warn('');
console.warn('This standalone bot startup is no longer the recommended way to run the bot.');
console.warn('The bot now runs in webhook mode integrated with the main server.');
console.warn('');
console.warn('To start the bot properly:');
console.warn('  1. Set ENABLE_SIMPLE_BOT=true in your .env file');
console.warn('  2. Set TELEGRAM_WEBHOOK_URL to your public webhook URL');
console.warn('  3. Run: npm start (starts server with webhook bot)');
console.warn('');
console.warn('Exiting...');
console.warn('');

process.exit(1);

// Export for module usage (kept for backwards compatibility)
module.exports = {
  // Functions are commented out as this file is deprecated
  // startSimpleBot,
  // SimpleTelegramBot
};
