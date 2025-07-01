/**
 * @fileoverview Тестовый скрипт для проверки еженедельных отчетов
 * @author g1orgi89
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../server/utils/logger');
const { WeeklyReportService } = require('../server/services/weeklyReportService');
const { UserProfile, Quote, WeeklyReport } = require('../server/models');

/**
 * Создание тестового пользователя с цитатами
 * @param {string} userId - ID пользователя  
 * @returns {Promise<UserProfile>} Созданный пользователь
 */
async function createTestUser(userId) {
  const testUser = new UserProfile({
    userId,
    telegramUsername: 'test_user',
    name: 'Тестовый пользователь',
    email: 'test@example.com',
    testResults: {
      name: 'Мария',
      lifestyle: 'Замужем, балансирую дом/работу/себя',
      timeForSelf: 'Читаю перед сном',
      priorities: 'Саморазвитие и семья',
      readingFeelings: 'Вдохновение и умиротворение',
      closestPhrase: 'Жизнь - это путешествие',
      readingTime: '1-2 часа в неделю'
    },
    source: 'Instagram',
    preferences: {
      mainThemes: ['Саморазвитие', 'Любовь', 'Философия'],
      personalityType: 'introspective_seeker',
      recommendationStyle: 'deep_analysis'
    },
    isOnboardingComplete: true,
    registeredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Неделю назад
  });

  await testUser.save();
  logger.info(`📖 Test user created: ${userId}`);
  return testUser;
}

/**
 * Создание тестовых цитат для пользователя
 * @param {string} userId - ID пользователя
 * @returns {Promise<Array<Quote>>} Созданные цитаты
 */
async function createTestQuotes(userId) {
  const testQuotes = [
    {
      text: 'В каждом слове — целая жизнь',
      author: 'Марина Цветаева',
      category: 'Творчество',
      themes: ['поэзия', 'выражение', 'глубина'],
      sentiment: 'positive'
    },
    {
      text: 'Любовь — это решение любить',
      author: 'Эрих Фромм',
      category: 'Любовь',
      themes: ['отношения', 'выбор', 'осознанность'],
      sentiment: 'positive'
    },
    {
      text: 'Счастье внутри нас',
      author: 'Будда',
      category: 'Философия',
      themes: ['внутренний мир', 'самопознание', 'мудрость'],
      sentiment: 'positive'
    },
    {
      text: 'Жизнь — это путешествие, а не пункт назначения',
      author: null,
      category: 'Мудрость',
      themes: ['жизненный путь', 'процесс', 'ценности'],
      sentiment: 'neutral'
    },
    {
      text: 'Время лечит раны, но оставляет шрамы мудрости',
      author: null,
      category: 'Философия', 
      themes: ['время', 'опыт', 'исцеление'],
      sentiment: 'neutral'
    }
  ];

  const currentWeek = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  
  const savedQuotes = [];

  for (const [index, quoteData] of testQuotes.entries()) {
    const quote = new Quote({
      userId,
      text: quoteData.text,
      author: quoteData.author,
      category: quoteData.category,
      themes: quoteData.themes,
      sentiment: quoteData.sentiment,
      weekNumber: currentWeek,
      monthNumber: new Date().getMonth() + 1,
      yearNumber: currentYear,
      createdAt: new Date(Date.now() - (4 - index) * 24 * 60 * 60 * 1000) // Распределяем по дням недели
    });

    await quote.save();
    savedQuotes.push(quote);
  }

  logger.info(`📖 Created ${savedQuotes.length} test quotes for user ${userId}`);
  return savedQuotes;
}

/**
 * Получение номера текущей недели
 * @returns {number} Номер недели
 */
function getCurrentWeekNumber() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Тестирование генерации еженедельного отчета
 * @param {string} userId - ID пользователя
 * @returns {Promise<void>}
 */
async function testWeeklyReportGeneration(userId) {
  logger.info(`📖 Testing weekly report generation for user ${userId}`);
  
  const weeklyReportService = new WeeklyReportService();
  
  try {
    // Генерируем отчет
    const report = await weeklyReportService.generateWeeklyReport(userId);
    
    if (!report) {
      logger.error('📖 Failed to generate weekly report');
      return;
    }

    logger.info('📖 Weekly report generated successfully:');
    console.log(JSON.stringify({
      reportId: report._id,
      weekNumber: report.weekNumber,
      year: report.year,
      quotesCount: report.quotes.length,
      analysis: {
        summary: report.analysis.summary,
        dominantThemes: report.analysis.dominantThemes,
        emotionalTone: report.analysis.emotionalTone
      },
      recommendationsCount: report.recommendations.length,
      promoCode: report.promoCode?.code
    }, null, 2));

    return report;

  } catch (error) {
    logger.error(`📖 Error testing weekly report generation: ${error.message}`, error);
  }
}

/**
 * Очистка тестовых данных
 * @param {string} userId - ID пользователя
 * @returns {Promise<void>}
 */
async function cleanupTestData(userId) {
  try {
    await Quote.deleteMany({ userId });
    await WeeklyReport.deleteMany({ userId });
    await UserProfile.deleteOne({ userId });
    
    logger.info(`📖 Test data cleaned up for user ${userId}`);
  } catch (error) {
    logger.error(`📖 Error cleaning up test data: ${error.message}`);
  }
}

/**
 * Основная функция тестирования
 * @returns {Promise<void>}
 */
async function runWeeklyReportTest() {
  try {
    // Подключаемся к MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-support';
    await mongoose.connect(mongoUri);
    logger.info('📖 Connected to MongoDB');

    const testUserId = 'test_weekly_report_user';

    // Очищаем старые тестовые данные
    await cleanupTestData(testUserId);

    // Создаем тестового пользователя
    const testUser = await createTestUser(testUserId);

    // Создаем тестовые цитаты
    const testQuotes = await createTestQuotes(testUserId);

    // Обновляем статистику пользователя
    testUser.statistics.totalQuotes = testQuotes.length;
    testUser.statistics.currentStreak = 3;
    testUser.statistics.longestStreak = 5;
    testUser.statistics.favoriteAuthors = ['Марина Цветаева', 'Эрих Фромм', 'Будда'];
    await testUser.save();

    // Тестируем генерацию отчета
    const report = await testWeeklyReportGeneration(testUserId);

    if (report) {
      logger.info('📖 Weekly report test completed successfully!');
      logger.info('📖 Report preview:');
      console.log(`
📊 Ваш отчет за неделю

За эту неделю вы сохранили ${testQuotes.length} цитат:
${testQuotes.map((q, i) => `✅ "${q.text}" ${q.author ? `(${q.author})` : ''}`).join('\n')}

🎯 Анализ недели:
${report.analysis.insights}

💎 Рекомендации от Анны:
${report.recommendations.map((r, i) => `${i + 1}. ${r.title} - ${r.price}\n   ${r.description}`).join('\n')}

${report.promoCode ? `🎁 Промокод ${report.promoCode.code} - скидка ${report.promoCode.discount}%!` : ''}
      `);
    }

    // Очищаем тестовые данные
    await cleanupTestData(testUserId);

  } catch (error) {
    logger.error(`📖 Weekly report test failed: ${error.message}`, error);
  } finally {
    await mongoose.disconnect();
    logger.info('📖 Disconnected from MongoDB');
  }
}

/**
 * Парсинг аргументов командной строки
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
📖 Тестирование еженедельных отчетов

Использование:
  node telegram/test-weekly-reports.js [опции]

Опции:
  --help                 Показать эту справку
  --create-test-user     Создать тестового пользователя без запуска тестов
  --cleanup-only         Только очистить тестовые данные

Примеры:
  npm run test:reports                    # Полный тест
  npm run test:reports:create-user        # Создать тестового пользователя
  npm run test:reports:help               # Справка
    `);
    process.exit(0);
  }

  return {
    createTestUserOnly: args.includes('--create-test-user'),
    cleanupOnly: args.includes('--cleanup-only')
  };
}

// Запуск тестирования
if (require.main === module) {
  const options = parseArgs();
  
  if (options.createTestUserOnly) {
    logger.info('📖 Creating test user only...');
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-support')
      .then(() => createTestUser('test_weekly_report_user'))
      .then(() => createTestQuotes('test_weekly_report_user'))
      .then(() => logger.info('📖 Test user and quotes created successfully'))
      .catch(error => logger.error('📖 Error creating test user:', error))
      .finally(() => mongoose.disconnect());
  } else if (options.cleanupOnly) {
    logger.info('📖 Cleaning up test data only...');
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-support')
      .then(() => cleanupTestData('test_weekly_report_user'))
      .then(() => logger.info('📖 Test data cleaned up successfully'))
      .catch(error => logger.error('📖 Error cleaning up test data:', error))
      .finally(() => mongoose.disconnect());
  } else {
    runWeeklyReportTest();
  }
}

module.exports = {
  runWeeklyReportTest,
  createTestUser,
  createTestQuotes,
  testWeeklyReportGeneration,
  cleanupTestData
};