/**
 * @fileoverview Скрипт для тестирования еженедельных отчетов
 * @author g1orgi89
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../server/utils/logger');

// Импорт сервисов
const { UserProfile, Quote } = require('../server/models');
const weeklyReportService = require('../server/services/weeklyReportService');
const ReaderTelegramBot = require('./index');

/**
 * Тестирование генерации еженедельного отчета
 */
async function testWeeklyReport() {
  try {
    console.log('📖 Starting weekly report test...\n');

    // Подключение к БД
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-support';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Инициализация Telegram бота для отправки
    const bot = new ReaderTelegramBot({
      token: process.env.TELEGRAM_BOT_TOKEN,
      environment: 'test'
    });
    await bot.initialize();
    console.log('✅ Telegram bot initialized\n');

    // Поиск пользователей с цитатами
    const usersWithQuotes = await UserProfile.find({ 
      isOnboardingComplete: true 
    }).limit(5);

    if (usersWithQuotes.length === 0) {
      console.log('❌ Нет пользователей с завершенным онбордингом');
      console.log('   Сначала пройдите онбординг в боте!');
      return;
    }

    console.log(`📊 Найдено пользователей: ${usersWithQuotes.length}\n`);

    // Тестируем отчет для каждого пользователя
    for (const user of usersWithQuotes) {
      console.log(`\n🔍 Тестируем отчет для: ${user.name} (${user.userId})`);
      
      // Проверяем есть ли цитаты у пользователя
      const userQuotes = await Quote.find({ userId: user.userId });
      console.log(`   Цитат в базе: ${userQuotes.length}`);

      if (userQuotes.length === 0) {
        console.log('   ⚠️ У пользователя нет цитат, создаем тестовые...');
        
        // Создаем тестовые цитаты для демонстрации
        const testQuotes = [
          { text: 'Жизнь прекрасна', author: 'Толстой', category: 'Философия' },
          { text: 'Любовь - это выбор', author: 'Фромм', category: 'Любовь' },
          { text: 'Знание - сила', author: 'Бэкон', category: 'Мудрость' }
        ];

        for (const quoteData of testQuotes) {
          const quote = new Quote({
            userId: user.userId,
            text: quoteData.text,
            author: quoteData.author,
            category: quoteData.category,
            weekNumber: getWeekNumber(),
            monthNumber: new Date().getMonth() + 1,
            yearNumber: new Date().getFullYear()
          });
          await quote.save();
        }
        
        console.log(`   ✅ Создано ${testQuotes.length} тестовых цитат`);
      }

      try {
        // Генерируем отчет
        console.log('   📝 Генерируем еженедельный отчет...');
        
        const report = await weeklyReportService.generateWeeklyReport(user.userId);
        
        if (report) {
          console.log('   ✅ Отчет сгенерирован успешно!');
          console.log(`   📊 Цитат в отчете: ${report.quotes.length}`);
          console.log(`   🎯 Категория: ${report.analysis?.dominantThemes?.[0] || 'Не определена'}`);
          console.log(`   📚 Рекомендаций: ${report.recommendations?.length || 0}`);
          console.log(`   🎁 Промокод: ${report.promoCode?.code || 'Не создан'}`);
          
          // Проверяем был ли отчет отправлен в Telegram
          console.log('   📱 Отчет должен быть отправлен в Telegram боту');
          
        } else {
          console.log('   ⚠️ Отчет не создан (возможно пустая неделя)');
        }
        
      } catch (error) {
        console.log(`   ❌ Ошибка генерации отчета: ${error.message}`);
        console.log(`   Stack: ${error.stack}`);
      }
    }

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Тест завершен, подключение к БД закрыто');
    process.exit(0);
  }
}

/**
 * Получить номер недели ISO 8601
 */
function getWeekNumber() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Создание тестового пользователя с цитатами
 */
async function createTestUser() {
  try {
    console.log('👤 Создаем тестового пользователя...');

    const testUserId = `test_user_${Date.now()}`;
    
    // Создаем профиль пользователя
    const userProfile = new UserProfile({
      userId: testUserId,
      telegramUsername: 'test_user',
      name: 'Тестовый Пользователь',
      email: 'test@example.com',
      testResults: {
        question1_name: 'Тестовый Пользователь',
        question2_lifestyle: 'Замужем, балансирую дом/работу/себя',
        question3_time: 'Рано утром, пока все спят',
        question4_priorities: 'Найти внутренний баланс',
        question5_reading_feeling: 'Нахожу ответы на свои вопросы',
        question6_phrase: 'Счастье — это выбор',
        question7_reading_time: '3-7 часов (несколько раз в неделю)'
      },
      source: 'test',
      isOnboardingComplete: true,
      statistics: {
        totalQuotes: 0,
        currentStreak: 1,
        longestStreak: 1,
        favoriteAuthors: [],
        monthlyQuotes: []
      }
    });

    await userProfile.save();

    // Создаем несколько цитат для отчета
    const quotes = [
      { text: 'В каждом слове — целая жизнь', author: 'Марина Цветаева', category: 'Творчество' },
      { text: 'Любовь — это решение любить', author: 'Эрих Фромм', category: 'Любовь' },
      { text: 'Счастье внутри нас', author: 'Будда', category: 'Мудрость' },
      { text: 'Знание — сила', author: 'Фрэнсис Бэкон', category: 'Мудрость' },
      { text: 'Жизнь — это путешествие', author: null, category: 'Философия' }
    ];

    for (const quoteData of quotes) {
      const quote = new Quote({
        userId: testUserId,
        text: quoteData.text,
        author: quoteData.author,
        category: quoteData.category,
        weekNumber: getWeekNumber(),
        monthNumber: new Date().getMonth() + 1,
        yearNumber: new Date().getFullYear(),
        sentiment: 'positive',
        themes: ['жизнь', 'мудрость']
      });
      await quote.save();
    }

    console.log(`✅ Создан тестовый пользователь: ${testUserId}`);
    console.log(`✅ Создано цитат: ${quotes.length}`);
    
    return testUserId;
    
  } catch (error) {
    console.error('❌ Ошибка создания тестового пользователя:', error);
    throw error;
  }
}

// Запуск тестирования
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--create-test-user')) {
    // Создаем тестового пользователя
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-support')
      .then(createTestUser)
      .then(() => {
        console.log('\n🎯 Теперь запустите: npm run test:weekly-report');
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Ошибка:', error);
        process.exit(1);
      });
  } else {
    // Обычное тестирование
    testWeeklyReport();
  }
}

module.exports = { testWeeklyReport, createTestUser };