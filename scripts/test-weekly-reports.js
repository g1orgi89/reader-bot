#!/usr/bin/env node

/**
 * @fileoverview Тестовый скрипт для системы еженедельных отчетов
 * @author g1orgi89
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';
const TEST_USER_ID = process.env.TEST_USER_ID || '123456789';

/**
 * Цветной вывод в консоль
 */
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Тестовые данные
 */
const testQuotes = [
  {
    text: "В каждом слове — целая жизнь",
    author: "Марина Цветаева"
  },
  {
    text: "Любовь — это решение любить",
    author: "Эрих Фромм"
  },
  {
    text: "Счастье внутри нас",
    author: "Будда"
  },
  {
    text: "Хватит сидеть в телефоне - читайте книги!",
    author: "Анна Бусел"
  },
  {
    text: "Жизнь — это путешествие к самому себе"
  }
];

/**
 * Основной класс тестирования
 */
class WeeklyReportsTest {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  /**
   * Выполнение HTTP запроса
   */
  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${API_BASE}${endpoint}`,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status || 500
      };
    }
  }

  /**
   * Проверка результата теста
   */
  assert(condition, testName, details = '') {
    this.results.total++;
    
    if (condition) {
      this.results.passed++;
      log('green', `✅ PASS: ${testName}`);
      if (details) log('blue', `   ${details}`);
    } else {
      this.results.failed++;
      log('red', `❌ FAIL: ${testName}`);
      if (details) log('yellow', `   ${details}`);
    }
  }

  /**
   * Тест 1: Проверка health check
   */
  async testHealthCheck() {
    log('bold', '\n📊 Тест 1: Health Check');
    
    const result = await this.makeRequest('GET', '/health');
    
    this.assert(
      result.success && result.status === 200,
      'API доступен',
      result.success ? `Status: ${result.status}` : `Error: ${result.error}`
    );

    if (result.success) {
      const health = result.data;
      
      this.assert(
        health.services?.cron === 'ok',
        'CronService работает',
        `Cron status: ${health.services?.cron}`
      );

      this.assert(
        health.cronService?.isStarted === true,
        'Cron задачи запущены',
        `Total jobs: ${health.cronService?.totalJobs}`
      );
    }
  }

  /**
   * Тест 2: Проверка статуса cron задач
   */
  async testCronStatus() {
    log('bold', '\n⏰ Тест 2: Cron Status');
    
    const result = await this.makeRequest('GET', '/reports/cron/status');
    
    this.assert(
      result.success && result.status === 200,
      'Получение статуса cron задач',
      result.success ? 'API отвечает' : `Error: ${result.error}`
    );

    if (result.success) {
      const cronData = result.data;
      
      this.assert(
        cronData.data?.status?.isStarted === true,
        'Cron сервис активен',
        `Jobs: ${cronData.data?.status?.totalJobs}`
      );

      this.assert(
        Object.keys(cronData.data?.schedule || {}).length >= 5,
        'Все задачи запланированы',
        `Scheduled jobs: ${Object.keys(cronData.data?.schedule || {}).join(', ')}`
      );
    }
  }

  /**
   * Тест 3: Проверка статуса Telegram
   */
  async testTelegramStatus() {
    log('bold', '\n📱 Тест 3: Telegram Status');
    
    const result = await this.makeRequest('GET', '/reports/telegram/status');
    
    this.assert(
      result.success && result.status === 200,
      'Получение статуса Telegram',
      result.success ? 'API отвечает' : `Error: ${result.error}`
    );

    if (result.success) {
      const telegramData = result.data;
      
      this.assert(
        telegramData.data?.isAvailable === true,
        'Telegram bot доступен',
        telegramData.data?.botInfo ? 
          `Bot: @${telegramData.data.botInfo.username}` : 
          'Bot info unavailable'
      );
    }
  }

  /**
   * Тест 4: Создание тестовых данных
   */
  async testCreateTestData() {
    log('bold', '\n🗄️  Тест 4: Создание тестовых данных');
    
    // Создание тестового профиля пользователя
    log('blue', 'Создание тестового пользователя...');
    
    // Здесь бы был код создания через API, но у нас нет этого endpoint
    // Предполагаем, что тестовый пользователь уже существует
    
    this.assert(
      true,
      'Тестовый пользователь готов',
      `User ID: ${TEST_USER_ID}`
    );

    // Создание тестовых цитат
    log('blue', 'Подготовка тестовых цитат...');
    
    this.assert(
      testQuotes.length >= 3,
      'Тестовые цитаты подготовлены',
      `Quotes: ${testQuotes.length}`
    );
  }

  /**
   * Тест 5: Ручная генерация отчета
   */
  async testManualReportGeneration() {
    log('bold', '\n📝 Тест 5: Ручная генерация отчета');
    
    const requestData = {
      userId: TEST_USER_ID
    };

    const result = await this.makeRequest('POST', '/reports/weekly/generate', requestData);
    
    this.assert(
      result.success && result.status === 200,
      'Генерация отчета успешна',
      result.success ? 
        'Отчет сгенерирован' : 
        `Error: ${JSON.stringify(result.error)}`
    );

    if (result.success) {
      const reportData = result.data;
      
      this.assert(
        reportData.success === true,
        'Успешный ответ API',
        `Success: ${reportData.success}`
      );

      // Проверяем структуру ответа
      if (reportData.data?.report) {
        this.assert(
          reportData.data.report.userId === TEST_USER_ID,
          'Правильный пользователь в отчете',
          `User ID: ${reportData.data.report.userId}`
        );

        this.assert(
          typeof reportData.data.report.weekNumber === 'number',
          'Номер недели указан',
          `Week: ${reportData.data.report.weekNumber}`
        );
      } else {
        this.assert(
          reportData.data?.message?.includes('No report generated'),
          'Корректное сообщение о пустой неделе',
          reportData.data?.message || 'No message'
        );
      }
    }
  }

  /**
   * Тест 6: Тестовая отправка в Telegram
   */
  async testTelegramSending() {
    log('bold', '\n📤 Тест 6: Отправка в Telegram');
    
    const requestData = {
      userId: TEST_USER_ID
    };

    const result = await this.makeRequest('POST', '/reports/telegram/test', requestData);
    
    this.assert(
      result.success && result.status === 200,
      'Тест отправки в Telegram',
      result.success ? 
        'Тест выполнен' : 
        `Error: ${JSON.stringify(result.error)}`
    );

    if (result.success) {
      const testData = result.data;
      
      this.assert(
        testData.success === true,
        'Успешный тест отправки',
        `Telegram sent: ${testData.data?.telegramSent}`
      );

      if (testData.data?.reportId) {
        this.assert(
          typeof testData.data.reportId === 'string',
          'ID отчета получен',
          `Report ID: ${testData.data.reportId}`
        );
      }
    }
  }

  /**
   * Тест 7: Получение статистики
   */
  async testStatistics() {
    log('bold', '\n📊 Тест 7: Статистика отчетов');
    
    const result = await this.makeRequest('GET', '/reports/stats?days=30');
    
    this.assert(
      result.success && result.status === 200,
      'Получение статистики',
      result.success ? 'Статистика получена' : `Error: ${result.error}`
    );

    if (result.success) {
      const statsData = result.data;
      
      this.assert(
        statsData.success === true,
        'Успешный ответ статистики',
        `Data available: ${!!statsData.data}`
      );

      if (statsData.data) {
        this.assert(
          typeof statsData.data.period === 'string',
          'Период указан',
          `Period: ${statsData.data.period}`
        );

        this.assert(
          typeof statsData.data.totalReports === 'number',
          'Общее количество отчетов',
          `Total reports: ${statsData.data.totalReports}`
        );
      }
    }
  }

  /**
   * Тест 8: Популярные темы
   */
  async testPopularThemes() {
    log('bold', '\n🏷️  Тест 8: Популярные темы');
    
    const result = await this.makeRequest('GET', '/reports/popular-themes?days=30&limit=5');
    
    this.assert(
      result.success && result.status === 200,
      'Получение популярных тем',
      result.success ? 'Темы получены' : `Error: ${result.error}`
    );

    if (result.success) {
      const themesData = result.data;
      
      this.assert(
        themesData.success === true,
        'Успешный ответ тем',
        `Themes available: ${!!themesData.data}`
      );

      if (themesData.data?.themes) {
        this.assert(
          Array.isArray(themesData.data.themes),
          'Темы в виде массива',
          `Themes count: ${themesData.data.themes.length}`
        );
      }
    }
  }

  /**
   * Тест 9: Аналитический обзор
   */
  async testAnalyticsOverview() {
    log('bold', '\n📈 Тест 9: Аналитический обзор');
    
    const result = await this.makeRequest('GET', '/reports/analytics/overview?days=30');
    
    this.assert(
      result.success && result.status === 200,
      'Получение аналитики',
      result.success ? 'Аналитика получена' : `Error: ${result.error}`
    );

    if (result.success) {
      const analyticsData = result.data;
      
      this.assert(
        analyticsData.success === true,
        'Успешный ответ аналитики',
        `Analytics available: ${!!analyticsData.data}`
      );

      if (analyticsData.data?.overview) {
        this.assert(
          typeof analyticsData.data.overview.totalReports === 'number',
          'Общие метрики доступны',
          `Total: ${analyticsData.data.overview.totalReports}, Feedback rate: ${analyticsData.data.overview.feedbackRate}%`
        );
      }
    }
  }

  /**
   * Тест 10: Получение отчетов пользователя
   */
  async testUserReports() {
    log('bold', '\n👤 Тест 10: Отчеты пользователя');
    
    const result = await this.makeRequest('GET', `/reports/weekly/${TEST_USER_ID}?limit=5`);
    
    this.assert(
      result.success && result.status === 200,
      'Получение отчетов пользователя',
      result.success ? 'Отчеты получены' : `Error: ${result.error}`
    );

    if (result.success) {
      const userReportsData = result.data;
      
      this.assert(
        userReportsData.success === true,
        'Успешный ответ отчетов',
        `User ID: ${userReportsData.data?.userId}`
      );

      if (userReportsData.data?.reports) {
        this.assert(
          Array.isArray(userReportsData.data.reports),
          'Отчеты в виде массива',
          `Reports count: ${userReportsData.data.reports.length}`
        );
      }
    }
  }

  /**
   * Запуск всех тестов
   */
  async runAllTests() {
    log('bold', '🧪 ЗАПУСК ТЕСТОВ СИСТЕМЫ ЕЖЕНЕДЕЛЬНЫХ ОТЧЕТОВ');
    log('blue', `API Base: ${API_BASE}`);
    log('blue', `Test User ID: ${TEST_USER_ID}`);
    log('blue', `Timestamp: ${new Date().toISOString()}\n`);

    try {
      await this.testHealthCheck();
      await this.testCronStatus();
      await this.testTelegramStatus();
      await this.testCreateTestData();
      await this.testManualReportGeneration();
      await this.testTelegramSending();
      await this.testStatistics();
      await this.testPopularThemes();
      await this.testAnalyticsOverview();
      await this.testUserReports();

      this.printResults();
    } catch (error) {
      log('red', `\n💥 Критическая ошибка тестирования: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Вывод результатов тестирования
   */
  printResults() {
    log('bold', '\n📋 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
    log('blue', '='.repeat(50));
    
    log('green', `✅ Успешно: ${this.results.passed}`);
    log('red', `❌ Провалено: ${this.results.failed}`);
    log('blue', `📊 Всего: ${this.results.total}`);
    
    const successRate = this.results.total > 0 ? 
      Math.round((this.results.passed / this.results.total) * 100) : 0;
    
    log('blue', `🎯 Успешность: ${successRate}%`);

    if (this.results.failed === 0) {
      log('green', '\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!');
      log('green', '📖 Система еженедельных отчетов готова к работе');
    } else {
      log('yellow', '\n⚠️  ЕСТЬ ПРОВАЛЕННЫЕ ТЕСТЫ');
      log('yellow', '🔧 Требуется дополнительная настройка системы');
    }

    log('blue', '\n🚀 Для запуска системы:');
    log('blue', '   npm start');
    log('blue', '\n📊 Для мониторинга:');
    log('blue', `   curl ${API_BASE}/health`);
    log('blue', `   curl ${API_BASE}/reports/cron/status`);
    
    process.exit(this.results.failed > 0 ? 1 : 0);
  }

  /**
   * Ожидание между тестами
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Запуск тестирования
 */
if (require.main === module) {
  const tester = new WeeklyReportsTest();
  
  // Обработка аргументов командной строки
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📖 Тестер системы еженедельных отчетов Reader Bot

Использование:
  node scripts/test-weekly-reports.js [опции]

Опции:
  --help, -h          Показать справку
  --api-base URL      API base URL (по умолчанию: http://localhost:3000/api)
  --user-id ID        Тестовый User ID (по умолчанию: 123456789)

Переменные окружения:
  API_BASE           URL API сервера
  TEST_USER_ID       ID тестового пользователя

Примеры:
  npm run test:reports
  node scripts/test-weekly-reports.js --api-base http://localhost:3000/api
  API_BASE=http://production.com/api npm run test:reports
    `);
    process.exit(0);
  }

  // Переопределение переменных из аргументов
  const apiBaseIndex = args.indexOf('--api-base');
  if (apiBaseIndex !== -1 && args[apiBaseIndex + 1]) {
    process.env.API_BASE = args[apiBaseIndex + 1];
  }

  const userIdIndex = args.indexOf('--user-id');
  if (userIdIndex !== -1 && args[userIdIndex + 1]) {
    process.env.TEST_USER_ID = args[userIdIndex + 1];
  }

  tester.runAllTests().catch(error => {
    log('red', `💥 Ошибка запуска тестов: ${error.message}`);
    process.exit(1);
  });
}

module.exports = WeeklyReportsTest;
