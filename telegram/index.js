/**
 * Основной Telegram бот для проекта Shrooms с грибной тематикой
 * @file telegram/index.js
 * 🍄 Интеграция с существующими сервисами chat API
 */

const { Telegraf, Markup } = require('telegraf');
const logger = require('../server/utils/logger');

/**
 * @typedef {Object} TelegramBotConfig
 * @property {string} token - Токен