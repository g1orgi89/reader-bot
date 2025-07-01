/**
 * Main entry point for Reader Bot - Telegram bot for Anna Busel's book club
 * @file reader-bot.js
 */

require('dotenv').config();

// Use simpleLogger to avoid winston configuration issues
const logger = require('./server/utils/simpleLogger');

// Import Reader bot services
const { initializeModels } = require('./server/models');
const ReaderTelegramBot = require('./telegram');
const CronService = require('./server/services/cronService');
const WeeklyReportHandler = require('./telegram/handlers/weeklyReportHandler');

/**
 * Reader Bot configuration
 */
const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    environment: process.env.NODE_ENV || 'development',
    maxMessageLength: 4096
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-bot'
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY
  }
};

/**
 * Validate required environment variables
 */
function validateConfig() {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'MONGODB_URI', 
    'ANTHROPIC_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    logger.error(`📝 Please create a .env file with these variables.`);
    process.exit(1);
  }

  logger.info('✅ Environment configuration validated');
}

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  const mongoose = require('mongoose');
  
  try {
    logger.info(`📡 Connecting to MongoDB: ${config.database.uri}`);
    
    await mongoose.connect(config.database.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    logger.info('✅ MongoDB connected successfully');
    
    // Initialize models and create indexes
    await initializeModels();
    logger.info('✅ Database models initialized');
    
  } catch (error) {
    logger.error(`❌ Database connection failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Initialize Cron Service with Weekly Reports
 */
async function initializeCronService(telegramBot) {
  try {
    logger.info('📖 Initializing CronService...');
    
    // Initialize WeeklyReportHandler
    const weeklyReportHandler = new WeeklyReportHandler(telegramBot);
    logger.info('📖 WeeklyReportHandler initialized');
    
    // Initialize CronService with report handler
    const cronService = new CronService(weeklyReportHandler);
    await cronService.start();
    
    logger.info('📖 CronService initialized and started');
    logger.info('📖 Weekly reports scheduled for Sundays at 11:00 MSK');
    
    return cronService;
    
  } catch (error) {
    logger.error(`❌ Failed to initialize CronService: ${error.message}`);
    throw error;
  }
}

/**
 * Main startup function
 */
async function startReaderBot() {
  try {
    logger.info('📖 Starting Reader Bot for Anna Busel...');
    logger.info(`Environment: ${config.telegram.environment}`);
    
    // Validate configuration
    validateConfig();
    
    // Initialize database
    await initializeDatabase();
    
    // Create Telegram bot
    logger.info('📖 Creating ReaderTelegramBot instance...');
    const readerBot = new ReaderTelegramBot(config.telegram);
    
    // Start Telegram bot
    logger.info('📖 Starting Telegram bot...');
    await readerBot.start();
    logger.info('📖 Telegram bot started successfully!');
    
    // Initialize CronService for automated reports
    logger.info('📖 Initializing automated reporting system...');
    const cronService = await initializeCronService(readerBot);
    
    logger.info('🎉 Reader Bot started successfully!');
    logger.info('📖 Users can now start conversations with /start');
    logger.info('📊 Automated weekly reports enabled');
    
    // Log helpful information for development
    if (config.telegram.environment === 'development') {
      logger.info('🔧 Development mode active');
      logger.info('📝 Send /start to your bot to begin onboarding');
      logger.info('💡 Use /help to see available commands');
      logger.info('📊 Test reports with: npm run test:reports');
    }
    
    // Store services for graceful shutdown
    global.readerBotServices = {
      telegramBot: readerBot,
      cronService: cronService
    };
    
  } catch (error) {
    logger.error(`❌ Failed to start Reader Bot: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`📖 Received ${signal}, shutting down Reader Bot...`);
  
  try {
    // Stop cron service if available
    if (global.readerBotServices?.cronService) {
      await global.readerBotServices.cronService.stop();
      logger.info('✅ CronService stopped');
    }
    
    // Stop Telegram bot if available
    if (global.readerBotServices?.telegramBot) {
      await global.readerBotServices.telegramBot.stop();
      logger.info('✅ Telegram bot stopped');
    }
    
    // Close database connection
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    logger.info('✅ Database disconnected');
    
    logger.info('✅ Reader Bot shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error(`❌ Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('📖 Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('📖 Uncaught Exception:', error.message);
  logger.error(error.stack);
  process.exit(1);
});

// Start the bot if this file is run directly
if (require.main === module) {
  startReaderBot();
}

module.exports = {
  startReaderBot,
  config
};