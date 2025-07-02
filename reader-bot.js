/**
 * Main entry point for Reader Bot - Telegram bot for Anna Busel's book club
 * @file reader-bot.js
 * 🔧 FIX: Added MonthlyReportService integration with proper logging
 */

require('dotenv').config();

// Use simpleLogger to avoid winston configuration issues
const logger = require('./server/utils/simpleLogger');

// Import Reader bot services
const { initializeModels } = require('./server/models');
const ReaderTelegramBot = require('./telegram');
const { CronService } = require('./server/services/cronService');
const WeeklyReportService = require('./server/services/weeklyReportService');
const MonthlyReportService = require('./server/services/monthlyReportService');

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
 * 📈 UPDATED: Initialize Cron Service with both Weekly and Monthly Reports + proper logging
 */
async function initializeCronService(telegramBot) {
  try {
    logger.info('📖 Initializing CronService with report services...');
    
    // Initialize Weekly Report Service
    const weeklyReportService = new WeeklyReportService();
    logger.info('📖 WeeklyReportService initialized');
    
    // 📈 Initialize Monthly Report Service with detailed logging
    logger.info('📈 Initializing MonthlyReportService...');
    const monthlyReportService = new MonthlyReportService();
    await monthlyReportService.initialize(telegramBot);
    logger.info('📈 MonthlyReportService initialized and ready');
    
    // Log diagnostics
    const monthlyDiagnostics = monthlyReportService.getDiagnostics();
    logger.info(`📈 Monthly service status: ${monthlyDiagnostics.status}`);
    logger.info(`📈 Available themes: ${monthlyDiagnostics.themesAvailable}`);
    
    // Initialize CronService with both services
    const cronService = new CronService();
    cronService.initialize({
      bot: telegramBot,
      weeklyReportHandler: weeklyReportService, // For weekly reports
      monthlyReportService: monthlyReportService, // For monthly reports
      reminderService: null // TODO: Add ReminderService when implemented
    });
    
    const started = cronService.start();
    
    if (started) {
      logger.info('📖 CronService initialized and started');
      logger.info('📖 Weekly reports scheduled for Sundays at 11:00 MSK');
      logger.info('📈 Monthly reports scheduled for 1st day of month at 12:00 MSK');
      
      // Log next run times
      const diagnostics = cronService.getDiagnostics();
      if (diagnostics.nextRuns.monthly_reports) {
        logger.info(`📈 Next monthly report: ${diagnostics.nextRuns.monthly_reports}`);
      }
    } else {
      logger.error('❌ Failed to start CronService');
    }
    
    return cronService;
    
  } catch (error) {
    logger.error(`❌ Failed to initialize CronService: ${error.message}`);
    throw error;
  }
}

/**
 * Start Telegram bot with timeout
 */
async function startTelegramBotWithTimeout(readerBot, timeoutMs = 30000) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Telegram bot start timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      logger.info('📖 Starting Telegram bot (with 30s timeout)...');
      await readerBot.start();
      clearTimeout(timeout);
      logger.info('📖 Telegram bot started successfully!');
      resolve();
    } catch (error) {
      clearTimeout(timeout);
      logger.error(`❌ Telegram bot start failed: ${error.message}`);
      reject(error);
    }
  });
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
    
    // Start Telegram bot with timeout
    try {
      await startTelegramBotWithTimeout(readerBot, 30000);
    } catch (error) {
      if (error.message.includes('timeout')) {
        logger.error('❌ Telegram bot startup timed out. This usually means:');
        logger.error('   - Network connectivity issues');
        logger.error('   - Telegram API is unreachable');
        logger.error('   - Bot token issues');
        logger.error('   - Firewall blocking connections');
        
        // Try to continue without Telegram bot for debugging
        logger.warn('⚠️  Continuing without Telegram bot for debugging...');
      } else {
        throw error;
      }
    }
    
    // Initialize CronService for automated reports
    logger.info('📖 Initializing automated reporting system...');
    const cronService = await initializeCronService(readerBot);
    
    logger.info('🎉 Reader Bot started successfully!');
    logger.info('📖 Users can now start conversations with /start');
    logger.info('📊 Automated weekly reports enabled');
    logger.info('📈 Automated monthly reports enabled'); // 📈 NEW
    
    // 📈 Log monthly reports functionality
    if (cronService) {
      const diagnostics = cronService.getDiagnostics();
      logger.info(`📈 Monthly report service: ${diagnostics.hasMonthlyReportService ? 'Ready' : 'Not available'}`);
    }
    
    // Log helpful information for development
    if (config.telegram.environment === 'development') {
      logger.info('🔧 Development mode active');
      logger.info('📝 Send /start to your bot to begin onboarding');
      logger.info('💡 Use /help to see available commands');
      logger.info('📊 Test reports with: npm run test:reports');
      logger.info('📈 Test monthly reports with: npm run test:monthly'); // 📈 NEW
    }
    
    // Store services for graceful shutdown
    global.readerBotServices = {
      telegramBot: readerBot,
      cronService: cronService
    };
    
    // 🧪 ВРЕМЕННЫЙ ТЕСТ RAG + Monthly Service (удалите после проверки)
    setTimeout(async () => {
      logger.info('🧪 Testing RAG behavior...');
      try {
        const claudeService = require('./server/services/claude');
        
        // Тест без RAG
        logger.info('📖 Test 1: useRag=false');
        const response1 = await claudeService.generateResponse('Привет!', { 
          useRag: false,
          platform: 'telegram',
          userId: 'test_user'
        });
        logger.info('✅ Test 1 (useRag=false) completed');
        
        // Тест с RAG  
        logger.info('📖 Test 2: useRag=true');
        const response2 = await claudeService.generateResponse('Привет!', { 
          useRag: true,
          platform: 'telegram', 
          userId: 'test_user'
        });
        logger.info('✅ Test 2 (useRag=true) completed');
        
        // Тест WeeklyReportService
        logger.info('📖 Test 3: WeeklyReportService');
        const weeklyService = new WeeklyReportService();
        const mockQuotes = [{ text: "Тест", author: "Автор", createdAt: new Date() }];
        const mockUser = { userId: 'test', name: 'Тест', testResults: {} };
        
        const analysis = await weeklyService.analyzeWeeklyQuotes(mockQuotes, mockUser);
        logger.info('✅ Test 3 (WeeklyReportService) completed');
        logger.info(`📊 Analysis summary: ${analysis.summary}`);
        
        // 📈 NEW: Тест MonthlyReportService
        logger.info('📈 Test 4: MonthlyReportService');
        const monthlyService = new MonthlyReportService();
        monthlyService.initialize(readerBot);
        const monthlyDiagnostics = monthlyService.getDiagnostics();
        logger.info('✅ Test 4 (MonthlyReportService) completed');
        logger.info(`📈 Monthly service ready: ${monthlyDiagnostics.status === 'ready'}`);
        logger.info(`📈 Available themes: ${monthlyDiagnostics.themesAvailable}`);
        
      } catch (error) {
        logger.error(`❌ RAG test failed: ${error.message}`);
      }
    }, 3000);
    
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