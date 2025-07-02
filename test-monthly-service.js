/**
 * Test script for Monthly Report Service
 * Тестирование месячных отчетов Reader Bot
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MonthlyReportService = require('./server/services/monthlyReportService');
const { initializeModels } = require('./server/models');

/**
 * Тестовый Telegram bot mock
 */
class MockTelegramBot {
  constructor() {
    this.sentMessages = [];
  }

  get telegram() {
    return {
      sendMessage: async (userId, message, options) => {
        console.log(`📤 Mock Telegram message to ${userId}:`);
        console.log(message);
        console.log('---');
        this.sentMessages.push({ userId, message, options });
        return { message_id: Date.now() };
      }
    };
  }

  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clearMessages() {
    this.sentMessages = [];
  }
}

/**
 * Основная функция тестирования
 */
async function testMonthlyReports() {
  try {
    console.log('📈 Starting Monthly Report Service Test...\n');

    // Подключение к базе данных
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await initializeModels();
    console.log('✅ Database connected and models initialized\n');

    // Создание mock bot
    const mockBot = new MockTelegramBot();
    console.log('🤖 Mock Telegram bot created\n');

    // Инициализация Monthly Report Service
    console.log('📈 Initializing MonthlyReportService...');
    const monthlyService = new MonthlyReportService();
    monthlyService.initialize(mockBot);
    
    console.log('✅ MonthlyReportService initialized');
    console.log('📊 Diagnostics:', monthlyService.getDiagnostics());
    console.log('');

    // Тест 1: Проверка готовности
    console.log('🧪 Test 1: Service readiness');
    const isReady = monthlyService.isReady();
    console.log(`Service ready: ${isReady ? '✅ Yes' : '❌ No'}`);
    console.log('');

    // Тест 2: Генерация отчетов для всех пользователей
    console.log('🧪 Test 2: Generate monthly reports for all users');
    const stats = await monthlyService.generateMonthlyReportsForAllUsers();
    console.log('📊 Generation stats:', stats);
    console.log('');

    // Тест 3: Получение статистики
    console.log('🧪 Test 3: Get monthly report statistics');
    const reportStats = await monthlyService.getMonthlyReportStats(30);
    console.log('📈 Report statistics:', reportStats);
    console.log('');

    // Тест 4: Тест тем для опроса
    console.log('🧪 Test 4: Monthly themes');
    const diagnostics = monthlyService.getDiagnostics();
    console.log(`Available themes: ${diagnostics.themesAvailable}`);
    console.log('Themes:', diagnostics.themes);
    console.log('');

    // Тест 5: Проверка отправленных сообщений
    console.log('🧪 Test 5: Check sent messages');
    console.log(`Mock bot sent ${mockBot.sentMessages.length} messages`);
    
    if (mockBot.sentMessages.length > 0) {
      console.log('📧 Last message preview:');
      const lastMsg = mockBot.getLastMessage();
      console.log(`To: ${lastMsg.userId}`);
      console.log(`Message: ${lastMsg.message.substring(0, 200)}...`);
    }
    console.log('');

    // Заключение
    console.log('🎉 Monthly Report Service test completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`✅ Service initialized: ${isReady}`);
    console.log(`📊 Eligible users found: ${stats.total}`);
    console.log(`📈 Reports generated: ${stats.generated}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`📤 Messages sent: ${mockBot.sentMessages.length}`);
    console.log(`🎯 Available themes: ${diagnostics.themesAvailable}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. User ${error.userId}: ${error.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Закрытие подключения к базе данных
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    console.log('📈 Monthly reports test completed');
    process.exit(0);
  }
}

// Запуск тестов
if (require.main === module) {
  testMonthlyReports().catch(console.error);
}

module.exports = { testMonthlyReports };
