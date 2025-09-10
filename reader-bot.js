/**
 * Main entry point for Reader Bot - Telegram bot for Anna Busel's book club
 * @file reader-bot.js
 * 🔧 UPDATED: Now using ModernReaderBot with menu button navigation
 */

require('dotenv').config();

// Use simpleLogger to avoid winston configuration issues
const logger = require('./server/utils/simpleLogger');

// Import Reader bot services
const { initializeModels } = require('./server/models');
const ModernReaderBot = require('./telegram/modernBot'); // 🔧 FIXED: Use ModernReaderBot
const { CronService } = require('./server/services/cronService');
const WeeklyReportService = require('./server/services/weeklyReportService');
const MonthlyReportService = require('./server/services/monthlyReportService');
const { ReminderService } = require('./server/services/reminderService');
const { AnnouncementService } = require('./server/services/announcementService');
const CommandHandler = require('./server/services/commandHandler');

/**
 * Reader Bot configuration
 */
const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    environment: process.env.NODE_ENV || 'development',
    maxMessageLength: 4096,
    enableModernUX: true // 🔧 Enable modern UX with menu button
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-bot'
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  anna: {
    websiteUrl: process.env.ANNA_WEBSITE_URL || 'https://anna-busel.com',
    adminTelegramId: process.env.ADMIN_TELEGRAM_ID
  }
};

/**
 * Validate required environment variables based on AI provider
 */
function validateConfig() {
  // Normalize provider name: anthropic -> claude
  const aiProvider = (process.env.AI_PROVIDER || 'claude').toLowerCase();
  const normalizedProvider = aiProvider === 'anthropic' ? 'claude' : aiProvider;
  
  const baseRequired = [
    'TELEGRAM_BOT_TOKEN',
    'MONGODB_URI'
  ];
  
  // Add provider-specific API key requirements
  if (normalizedProvider === 'claude') {
    baseRequired.push('ANTHROPIC_API_KEY');
  } else if (normalizedProvider === 'openai') {
    baseRequired.push('OPENAI_API_KEY');
  } else {
    logger.error(`❌ Invalid AI_PROVIDER: ${aiProvider}. Must be 'claude', 'anthropic', or 'openai'`);
    process.exit(1);
  }

  const missing = baseRequired.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    logger.error(`📝 Please create a .env file with these variables.`);
    logger.error(`🔧 Current AI_PROVIDER: ${normalizedProvider}`);
    process.exit(1);
  }

  // Warn about optional but recommended variables
  const recommended = [
    'ANNA_WEBSITE_URL',
    'ADMIN_TELEGRAM_ID'
  ];

  const missingRecommended = recommended.filter(key => !process.env[key]);
  if (missingRecommended.length > 0) {
    logger.warn(`⚠️  Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }

  logger.info(`✅ Environment configuration validated for provider: ${normalizedProvider}`);
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
 * 📖 UPDATED: Initialize all services including ReminderService and AnnouncementService
 */
async function initializeServices(telegramBot) {
  try {
    logger.info('📖 Initializing all Reader Bot services...');
    
    // Initialize Weekly Report Service
    const weeklyReportService = new WeeklyReportService();
    logger.info('📖 WeeklyReportService initialized');
    
    // Initialize Monthly Report Service
    logger.info('📈 Initializing MonthlyReportService...');
    const monthlyReportService = new MonthlyReportService();
    await monthlyReportService.initialize(telegramBot);
    logger.info('📈 MonthlyReportService initialized and ready');
    
    // 📖 NEW: Initialize ReminderService
    logger.info('🔔 Initializing ReminderService...');
    const reminderService = new ReminderService();
    reminderService.initialize({ bot: telegramBot });
    logger.info('🔔 ReminderService initialized');
    
    // 📖 NEW: Initialize AnnouncementService  
    logger.info('📢 Initializing AnnouncementService...');
    const announcementService = new AnnouncementService();
    announcementService.initialize({ bot: telegramBot });
    logger.info('📢 AnnouncementService initialized');
    
    // 📖 NEW: Initialize CommandHandler with reminder service
    logger.info('⚙️ Initializing CommandHandler...');
    const commandHandler = new CommandHandler();
    commandHandler.initialize({ reminderService });
    logger.info('⚙️ CommandHandler initialized');
    
    // Note: ModernReaderBot handles its own command routing, no need to update
    logger.info('🤖 ModernReaderBot uses its own command routing system');
    
    return {
      weeklyReportService,
      monthlyReportService,
      reminderService,
      announcementService,
      commandHandler
    };
    
  } catch (error) {
    logger.error(`❌ Failed to initialize services: ${error.message}`);
    throw error;
  }
}

/**
 * 📖 UPDATED: Initialize Cron Service with all services
 */
async function initializeCronService(telegramBot, services) {
  try {
    logger.info('📖 Initializing CronService with all services...');
    
    // Log service diagnostics
    const reminderDiagnostics = services.reminderService.getDiagnostics();
    const announcementDiagnostics = services.announcementService.getDiagnostics();
    const monthlyDiagnostics = services.monthlyReportService.getDiagnostics();
    
    logger.info(`🔔 ReminderService ready: ${reminderDiagnostics.initialized}`);
    logger.info(`📢 AnnouncementService ready: ${announcementDiagnostics.initialized}`);
    logger.info(`📈 MonthlyReportService ready: ${monthlyDiagnostics.status === 'ready'}`);
    
    // Initialize CronService with all services
    const cronService = new CronService();
    cronService.initialize({
      bot: telegramBot,
      weeklyReportHandler: services.weeklyReportService,
      monthlyReportService: services.monthlyReportService,
      reminderService: services.reminderService,
      announcementService: services.announcementService
    });
    
    const started = cronService.start();
    
    if (started) {
      logger.info('📖 CronService initialized and started');
      
      // Log schedule
      const schedule = cronService.getSchedule();
      Object.entries(schedule).forEach(([job, time]) => {
        logger.info(`⏰ ${job}: ${time}`);
      });
      
      // Log next run times
      const diagnostics = cronService.getDiagnostics();
      logger.info('🔍 Service statuses:');
      Object.entries(diagnostics.serviceStatuses).forEach(([service, status]) => {
        logger.info(`  ${service}: ${status ? '✅' : '❌'}`);
      });
      
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
      logger.info('🎨 Starting ModernReaderBot (with 30s timeout)...');
      await readerBot.start();
      clearTimeout(timeout);
      logger.info('🎨 ModernReaderBot started successfully with menu button!');
      resolve();
    } catch (error) {
      clearTimeout(timeout);
      logger.error(`❌ ModernReaderBot start failed: ${error.message}`);
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
    
    // Create Modern Telegram bot
    logger.info('🎨 Creating ModernReaderBot instance with menu button...');
    const readerBot = new ModernReaderBot(config.telegram);
    
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
    
    // Initialize all services
    logger.info('📖 Initializing Reader Bot services...');
    const services = await initializeServices(readerBot);
    
    // Initialize CronService for automated reports and reminders
    logger.info('📖 Initializing automated systems...');
    const cronService = await initializeCronService(readerBot, services);
    
    logger.info('🎉 Reader Bot started successfully!');
    logger.info('🎨 Modern UX with menu button navigation enabled');
    logger.info('📖 Users can now start conversations with /start');
    logger.info('📋 Menu button available next to attachment button');
    logger.info('📊 Automated weekly reports enabled');
    logger.info('📈 Automated monthly reports enabled');
    logger.info('🔔 Smart reminder system enabled');
    logger.info('📢 Monthly announcements enabled (25th of each month)');
    
    // Store services for graceful shutdown
    global.readerBotServices = {
      telegramBot: readerBot,
      cronService: cronService,
      ...services
    };
    
    // Log helpful information for development
    if (config.telegram.environment === 'development') {
      logger.info('🔧 Development mode active');
      logger.info('📝 Send /start to your bot to begin onboarding');
      logger.info('📋 Use menu button for navigation');
      logger.info('💡 Test commands: /help, /stats, /search, /settings');
      logger.info('📊 Test reports with: npm run test:reports');
      logger.info('🔔 Test reminders with: npm run test:reminders');
      logger.info('📢 Test announcements with: npm run test:announcements');
    }
    
    // 🧪 UPDATED TEST: Test all new services
    setTimeout(async () => {
      logger.info('🧪 Testing all services...');
      try {
        // Test ModernReaderBot health
        logger.info('🎨 Testing ModernReaderBot health...');
        const botHealth = await readerBot.healthCheck();
        logger.info(`✅ ModernReaderBot health: ${botHealth.status}`);
        logger.info(`📋 Menu button: ${botHealth.modernHandlers.modernUXEnabled ? 'enabled' : 'disabled'}`);
        
        // Test ReminderService
        logger.info('🔔 Testing ReminderService...');
        const reminderStats = await services.reminderService.getReminderStats();
        logger.info(`✅ ReminderService test completed. Users with reminders: ${reminderStats?.enabledUsers || 0}`);
        
        // Test AnnouncementService
        logger.info('📢 Testing AnnouncementService...');
        const announcementStats = await services.announcementService.getAnnouncementStats();
        logger.info(`✅ AnnouncementService test completed. Eligible users: ${announcementStats?.eligibleUsers || 0}`);
        
        // Test Monthly Service
        logger.info('📈 Testing MonthlyReportService...');
        const monthlyDiagnostics = services.monthlyReportService.getDiagnostics();
        logger.info(`✅ MonthlyReportService test completed. Status: ${monthlyDiagnostics.status}`);
        
        // Test CronService integration
        if (cronService) {
          logger.info('⏰ Testing CronService integration...');
          const allStats = await cronService.getAllServicesStats();
          logger.info(`✅ CronService integration test completed. Active jobs: ${allStats.cron.totalJobs}`);
        }
        
        logger.info('🎉 All service tests completed successfully!');
        logger.info('🎨 ModernReaderBot ready with elegant menu button navigation!');
        
      } catch (error) {
        logger.error(`❌ Service tests failed: ${error.message}`);
      }
    }, 5000);
    
  } catch (error) {
    logger.error(`❌ Failed to start Reader Bot: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

/**
 * 📖 NEW: Test individual services manually
 */
async function testServices() {
  logger.info('🧪 Manual service testing...');
  
  try {
    // Test the new test file
    const testRunner = require('./test-reminder-announcement-services');
    await testRunner.runAllTests();
    
  } catch (error) {
    logger.error(`❌ Manual tests failed: ${error.message}`);
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
      logger.info('✅ ModernReaderBot stopped');
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

// CLI commands
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      testServices();
      break;
    case 'start':
    default:
      startReaderBot();
      break;
  }
}

module.exports = {
  startReaderBot,
  testServices,
  config
};
