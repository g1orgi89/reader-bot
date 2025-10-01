/**
 * Standalone startup script for Simple Telegram Bot
 * @file bot/start.js
 * @author Reader Bot Team
 */

// Set timezone to Moscow
process.env.TZ = process.env.TZ || 'Europe/Moscow';

// Load environment variables
require('dotenv').config();

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

// Export for module usage
module.exports = {
  startSimpleBot,
  SimpleTelegramBot
};

// Run if called directly
if (require.main === module) {
  startSimpleBot()
    .then((services) => {
      // Setup graceful shutdown
      process.on('SIGTERM', () => gracefulShutdown(services, 'SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown(services, 'SIGINT'));
      
      logger.info('🔗 Simple Telegram Bot process is running...');
      logger.info('💡 Use Ctrl+C to stop the bot');
    })
    .catch((error) => {
      logger.error('❌ Startup failed:', error);
      process.exit(1);
    });
}