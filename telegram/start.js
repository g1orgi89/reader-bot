/**
 * Точка входа для запуска Telegram бота Reader
 * @file telegram/start.js
 * 📖 Инициализация и запуск бота с подключением к базе данных
 * 📖 UPDATED: Интеграция с CronService и WeeklyReportHandler
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../server/utils/logger');
const ReaderTelegramBot = require('./index');
const { WeeklyReportHandler } = require('./handlers/weeklyReportHandler');
const { CronService } = require('../server/services/cronService');

/**
 * Основная функция запуска бота
 * @returns {Promise<void>}
 */
async function startTelegramBot() {
  try {
    // Проверяем наличие токена
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }

    logger.info('📖 Starting Reader Telegram Bot...');

    // Подключаемся к MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-support';
    
    logger.info('📖 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    logger.info('📖 MongoDB connected successfully');

    // Создаем и инициализируем бота
    const bot = new ReaderTelegramBot({
      token: telegramToken,
      environment: process.env.NODE_ENV || 'production',
      maxMessageLength: parseInt(process.env.TELEGRAM_MAX_MESSAGE_LENGTH) || 4096
    });

    // Запускаем бота
    await bot.start();

    // Создаем обработчик еженедельных отчетов
    const weeklyReportHandler = new WeeklyReportHandler(bot.bot);

    // Создаем и инициализируем CronService
    const cronService = new CronService();
    cronService.initialize(bot.bot, weeklyReportHandler);

    // Запускаем cron задачи
    cronService.start();

    logger.info('📖 Reader Telegram Bot is running with scheduled tasks!');
    logger.info('📖 Bot info:', await bot.getStats());

    // Добавляем методы для внешнего доступа
    bot.weeklyReportHandler = weeklyReportHandler;
    bot.cronService = cronService;

    // Обработка сигналов остановки
    process.on('SIGINT', async () => {
      logger.info('📖 Received SIGINT, shutting down gracefully...');
      cronService.stop();
      await bot.stop('SIGINT');
      await mongoose.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('📖 Received SIGTERM, shutting down gracefully...');
      cronService.stop();
      await bot.stop('SIGTERM');
      await mongoose.disconnect();
      process.exit(0);
    });

    // Возвращаем экземпляр бота для использования в других модулях
    return {
      bot,
      weeklyReportHandler,
      cronService
    };

  } catch (error) {
    logger.error(`📖 Failed to start Telegram bot: ${error.message}`);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  logger.error('📖 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('📖 Uncaught Exception:', error);
  process.exit(1);
});

// Запускаем бота
if (require.main === module) {
  startTelegramBot();
}

module.exports = startTelegramBot;