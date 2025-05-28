/**
 * Сервис для управления разговорами
 * @file server/services/conversation.js
 */

const Conversation = require('../models/conversation');
const Message = require('../models/message');
const logger = require('../utils/logger');

/**
 * @typedef {Object} ConversationData
 * @property {string} userId - ID пользователя
 * @property {string} [source] - Источник разговора (chat, ticket, telegram)
 * @property {string} [language] - Язык разговора
 * @property {Object} [metadata] - Дополнительные метаданные
 */

/**
 * @typedef {Object} FindOptions
 * @property {number} [limit] - Максимальное количество результатов
 * @property {number}