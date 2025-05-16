/**
 * Сервис для управления разговорами
 * @file server/services/conversation.js
 */

const Conversation = require('../models/conversation');
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
 * @property {number} [skip] - Количество результатов для пропуска
 * @property {boolean} [activeOnly] - Только активные разговоры
 * @property {string} [sort] - Поле для сортировки
 */

/**
 * @class ConversationService
 * @description Сервис для работы с разговорами
 */
class ConversationService {
  /**
   * Создает новый разговор
   * @param {string} userId - ID пользователя
   * @param {Object} options - Дополнительные опции
   * @param {string} [options.source] - Источник разговора
   * @param {string} [options.language] - Язык разговора
   * @param {Object} [options.metadata] - Метаданные
   * @returns {Promise<Object>} Созданный разговор
   */
  async createConversation(userId, options = {}) {
    try {
      const conversation = new Conversation({
        userId,
        source: options.source || 'chat',
        language: options.language || 'en',
        metadata: options.metadata || {},
        startedAt: new Date(),
        messageCount: 0
      });

      const savedConversation = await conversation.save();
      logger.info(`Conversation created: ${savedConversation._id} for user ${userId}`);
      
      return savedConversation;
    } catch (error) {
      logger.error(`Error creating conversation: ${error.message}`);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }

  /**
   * Получает разговор по ID
   * @param {string} conversationId - ID разговора
   * @returns {Promise<Object|null>} Разговор или null
   */
  async getConversationById(conversationId) {
    try {
      const conversation = await Conversation.findById(conversationId);
      return conversation;
    } catch (error) {
      logger.error(`Error fetching conversation ${conversationId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Находит разговоры пользователя
   * @param {string} userId - ID пользователя
   * @param {FindOptions} options - Опции для поиска
   * @returns {Promise<Object[]>} Список разговоров
   */
  async findByUserId(userId, options = {}) {
    try {
      const {
        limit = 10,
        skip = 0,
        activeOnly = false,
        sort = '-startedAt'
      } = options;

      // Строим запрос
      const query = { userId };
      if (activeOnly) {
        query.isActive = true;
      }

      // Выполняем запрос с сортировкой и пагинацией
      const conversations = await Conversation.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      return conversations;
    } catch (error) {
      logger.error(`Error finding conversations for user ${userId}: ${error.message}`);
      throw new Error(`Failed to find conversations: ${error.message}`);
    }
  }

  /**
   * Получает или создает разговор для пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} options - Опции для создания нового разговора
   * @returns {Promise<Object>} Существующий или новый разговор
   */
  async getOrCreateConversation(userId, options = {}) {
    try {
      // Ищем активный разговор пользователя
      let conversation = await Conversation.findOne({
        userId,
        isActive: true
      }).sort({ startedAt: -1 });

      // Если активного разговора нет, создаем новый
      if (!conversation) {
        conversation = await this.createConversation(userId, options);
      }

      return conversation;
    } catch (error) {
      logger.error(`Error getting/creating conversation for user ${userId}: ${error.message}`);
      throw new Error(`Failed to get or create conversation: ${error.message}`);
    }
  }

  /**
   * Увеличивает счетчик сообщений в разговоре
   * @param {string} conversationId - ID разговора
   * @returns {Promise<Object|null>} Обновленный разговор
   */
  async incrementMessageCount(conversationId) {
    try {
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { 
          $inc: { messageCount: 1 },
          lastActivityAt: new Date()
        },
        { new: true }
      );

      return conversation;
    } catch (error) {
      logger.error(`Error incrementing message count for conversation ${conversationId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Обновляет язык разговора
   * @param {string} conversationId - ID разговора
   * @param {string} language - Новый язык
   * @returns {Promise<Object|null>} Обновленный разговор
   */
  async updateLanguage(conversationId, language) {
    try {
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { 
          language,
          lastActivityAt: new Date()
        },
        { new: true }
      );

      if (conversation) {
        logger.info(`Conversation language updated: ${conversationId} -> ${language}`);
      }

      return conversation;
    } catch (error) {
      logger.error(`Error updating conversation language ${conversationId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Завершает разговор
   * @param {string} conversationId - ID разговора
   * @param {string} [reason] - Причина завершения
   * @returns {Promise<Object|null>} Завершенный разговор
   */
  async endConversation(conversationId, reason = 'user_ended') {
    try {
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { 
          isActive: false,
          endedAt: new Date(),
          endReason: reason,
          lastActivityAt: new Date()
        },
        { new: true }
      );

      if (conversation) {
        logger.info(`Conversation ended: ${conversationId}, reason: ${reason}`);
      }

      return conversation;
    } catch (error) {
      logger.error(`Error ending conversation ${conversationId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Проверка здоровья сервиса
   * @returns {Promise<Object>} Статус здоровья
   */
  async healthCheck() {
    try {
      // Проверяем доступность базы данных простым запросом
      const count = await Conversation.countDocuments({});
      
      return {
        status: 'ok',
        message: 'Conversation service is healthy',
        details: {
          totalConversations: count,
          isConnected: true
        }
      };
    } catch (error) {
      logger.error(`Conversation service health check failed: ${error.message}`);
      return {
        status: 'error',
        message: 'Conversation service is unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Получает статистику разговоров
   * @returns {Promise<Object>} Статистика разговоров
   */
  async getConversationStats() {
    try {
      const stats = await Conversation.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { 
              $sum: { $cond: ['$isActive', 1, 0] }
            },
            avgMessageCount: { $avg: '$messageCount' },
            totalMessages: { $sum: '$messageCount' }
          }
        },
        {
          $project: {
            _id: 0,
            total: 1,
            active: 1,
            avgMessageCount: { $round: ['$avgMessageCount', 2] },
            totalMessages: 1
          }
        }
      ]);

      // Статистика по источникам
      const sourceStats = await Conversation.aggregate([
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      // Статистика по языкам
      const languageStats = await Conversation.aggregate([
        {
          $group: {
            _id: '$language',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return {
        overview: stats[0] || {
          total: 0,
          active: 0,
          avgMessageCount: 0,
          totalMessages: 0
        },
        bySource: sourceStats,
        byLanguage: languageStats
      };
    } catch (error) {
      logger.error(`Error fetching conversation stats: ${error.message}`);
      throw new Error(`Failed to fetch conversation statistics: ${error.message}`);
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new ConversationService();