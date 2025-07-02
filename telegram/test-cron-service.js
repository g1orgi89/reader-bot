/**
 * Скрипт для тестирования CronService и еженедельных отчетов
 * @file telegram/test-cron-service.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../server/utils/logger');
const { CronService } = require('../server/services/cronService');
const telegramReportService = require('../server/services/telegramReportService');

/**
 * Тестирование функциональности CronService
 */
async function testCronService() {
  try {
    logger.info('🧪 Starting CronService test...');

    // Подключаемся к MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-support';
    await mongoose.connect(mongoUri);
    logger.info('✅ MongoDB connected');

    // Создаем экземпляр CronService
    const cronService = new CronService();
    
    // Инициализируем с зависимостями
    cronService.initialize(null, telegramReportService, null);
    logger.info('✅ CronService initialized');

    // Проверяем статус
    const status = cronService.getJobsStatus();
    logger.info('📊 CronService status:', JSON.stringify(status, null, 2));

    // Тест 1: Проверяем, что методы доступны
    if (typeof telegramReportService.sendReportsToAllUsers === 'function') {
      logger.info('✅ telegramReportService.sendReportsToAllUsers method exists');
    } else {
      logger.error('❌ telegramReportService.sendReportsToAllUsers method missing');
    }

    // Тест 2: Попробуем запустить CronService
    try {
      cronService.start();
      logger.info('✅ CronService started successfully');
      
      const statusAfterStart = cronService.getJobsStatus();
      logger.info('📊 CronService status after start:', JSON.stringify(statusAfterStart, null, 2));
      
      if (statusAfterStart.totalJobs > 0) {
        logger.info(`✅ CronService has ${statusAfterStart.totalJobs} active jobs`);
      } else {
        logger.warn('⚠️ CronService has no active jobs');
      }
      
    } catch (startError) {
      logger.error('❌ Error starting CronService:', startError.message);
    }

    // Тест 3: Ручной запуск еженедельных отчетов (только если есть пользователи)
    const { UserProfile } = require('../server/models');
    const userCount = await UserProfile.countDocuments({ isOnboardingComplete: true });
    
    if (userCount > 0) {
      logger.info(`📖 Found ${userCount} users, testing manual weekly report generation...`);
      
      try {
        const stats = await telegramReportService.sendReportsToAllUsers();
        logger.info('✅ Manual weekly reports test completed:', JSON.stringify(stats, null, 2));
      } catch (reportError) {
        logger.error('❌ Error in manual weekly reports:', reportError.message);
      }
    } else {
      logger.info('📖 No users found for testing weekly reports');
    }

    // Тест 4: Проверяем получение статистики
    try {
      const reportStats = await telegramReportService.getReportStats(7);
      logger.info('✅ Report stats retrieved:', JSON.stringify(reportStats, null, 2));
    } catch (statsError) {
      logger.error('❌ Error getting report stats:', statsError.message);
    }

    // Тест 5: Проверяем расписание задач
    const nextRuns = {
      weeklyReports: cronService.getNextRunTime('weekly_reports'),
      dailyReminders: cronService.getNextRunTime('daily_reminders'),
      monthlyReports: cronService.getNextRunTime('monthly_reports'),
      dailyCleanup: cronService.getNextRunTime('daily_cleanup')
    };
    
    logger.info('📅 Next scheduled runs:', JSON.stringify(nextRuns, null, 2));

    // Останавливаем CronService
    cronService.stop();
    logger.info('✅ CronService stopped');

    await mongoose.disconnect();
    logger.info('✅ MongoDB disconnected');

    logger.info('🎉 CronService test completed successfully!');

  } catch (error) {
    logger.error('💥 CronService test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Создание тестовых данных для проверки отчетов
 */
async function createTestData() {
  try {
    logger.info('🛠️ Creating test data...');

    const { UserProfile, Quote } = require('../server/models');

    // Создаем тестового пользователя (если не существует)
    const testUserId = '123456789'; // Тестовый Telegram ID
    
    let testUser = await UserProfile.findOne({ userId: testUserId });
    
    if (!testUser) {
      testUser = new UserProfile({
        userId: testUserId,
        telegramUsername: 'test_reader',
        name: 'Тестовый Читатель',
        email: 'test@example.com',
        testResults: {
          name: 'Тестовый Читатель',
          lifestyle: 'Замужем, балансирую дом/работу/себя',
          timeForSelf: 'Нахожу время вечером',
          priorities: 'Саморазвитие',
          readingFeelings: 'Вдохновение',
          closestPhrase: 'Жизнь - это путешествие',
          readingTime: '1-2 часа в неделю'
        },
        source: 'Instagram',
        preferences: {
          mainThemes: ['Саморазвитие', 'Мудрость'],
          personalityType: 'reflective',
          recommendationStyle: 'psychological'
        },
        isOnboardingComplete: true,
        settings: {
          reminderEnabled: true,
          reminderTimes: ['09:00', '19:00']
        }
      });
      
      await testUser.save();
      logger.info('✅ Test user created');
    } else {
      logger.info('✅ Test user already exists');
    }

    // Создаем тестовые цитаты за эту неделю
    const existingQuotes = await Quote.countDocuments({ userId: testUserId });
    
    if (existingQuotes === 0) {
      const testQuotes = [
        {
          userId: testUserId,
          text: 'В каждом слове — целая жизнь',
          author: 'Марина Цветаева',
          category: 'Мудрость',
          createdAt: new Date()
        },
        {
          userId: testUserId,
          text: 'Счастье внутри нас',
          author: 'Будда', 
          category: 'Философия',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // вчера
        },
        {
          userId: testUserId,
          text: 'Хорошая жизнь строится, а не дается по умолчанию',
          author: 'Анна Бусел',
          category: 'Саморазвитие',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // позавчера
        }
      ];

      await Quote.insertMany(testQuotes);
      logger.info(`✅ Created ${testQuotes.length} test quotes`);
    } else {
      logger.info(`✅ Found ${existingQuotes} existing quotes for test user`);
    }

    logger.info('🎉 Test data creation completed!');
    
  } catch (error) {
    logger.error('💥 Failed to create test data:', error.message);
    throw error;
  }
}

// Функция для запуска всех тестов
async function runAllTests() {
  try {
    await createTestData();
    await testCronService();
  } catch (error) {
    logger.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);

if (args.includes('--create-data')) {
  createTestData().then(() => process.exit(0));
} else if (args.includes('--test-only')) {
  testCronService().then(() => process.exit(0));
} else {
  runAllTests().then(() => process.exit(0));
}

module.exports = {
  testCronService,
  createTestData,
  runAllTests
};