/**
 * Сервис для работы с разговорами
 * @file server/services/conversation.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Схема разговора
 */
const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  language: {
    type: String,
    enum: ['en', 'es', 'ru'],
    default: 'en'
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'archived'],
    default: 'active'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    source: {
      type: String,
      enum: ['http', 'socket', 'telegram'],
      default: 'http'
    },
    userAgent: String,
    ip: String
  }
}, {
  timestamps: true
});

// Индексы для оптимизации запросов
conversationSchema.index({ userId: 1, startedAt: -1 });
conversationSchema.index({ status: 1, lastActivityAt: -1 });

// Модель разговора
const Conversation = mongoose.model('Conversation', conversationSchema);

/**
 * @class ConversationService
 * @description Сервис для работы с разговорами
 */
class ConversationService {
  /**
   * Создает новый разговор
   * @param {Object} conversationData - Данные разговора
   * @param {string} conversationData.userId - ID пользователя
   * @param {string} [conversationData.language] - Язык разговора
   * @param {string} [conversationData.status] - Статус разговора
   * @param {Object} [conversationData.metadata] - Дополнительные метаданные
   * @returns {Promise<Object>} Созданный разговор
   */
  async create(conversationData) {
    try {
      const conversation = new Conversation(conversationData);
      await conversation.save();
      
      logger.info(`Conversation created: ${conversation._id} for user ${conversationData.userId}`);
      return conversation;
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }

  /**
   * Находит разговор по ID
   * @param {string} conversationId - ID разговора
   * @returns {Promise<Object|null>} Разговор или null
   */
  async findById(conversationId) {
    try {
      const conversation = await Conversation.findById(conversationId);
      return conversation;
    } catch (error) {
      logger.error('Error finding conversation by ID:', error);
      throw new Error(`Failed to find conversation: ${error.message}`);
    }
  }

  /**
   * Находит разговоры пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} [options] - Опции поиска
   * @param {number} [options.page=1] - Номер страницы
   * @param {number} [options.limit=10] - Количество на страницу
   * @param {string} [options.status] - Фильтр по статусу
   * @returns {Promise<Object[]>} Массив разговоров
   */
  async findByUserId(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status
      } = options;

      const query = { userId };
      if (status) {
        query.status = status;
      }

      const conversations = await Conversation
        .find(query)
        .sort({ lastActivityAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      return conversations;
    } catch (error) {
      logger.error('Error finding conversations by user ID:', error);
      throw new Error(`Failed to find conversations: ${error.message}`);
    }
  }

  /**
   * Обновляет время последней активности разговора
   * @param {string} conversationId - ID разговора
   * @returns {Promise<Object>} Обновленный разговор
   */
  async updateLastActivity(conversationId) {
    try {
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { lastActivityAt: new Date() },
        { new: true }
      );

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return conversation;
    } catch (error) {
      logger.error('Error updating conversation activity:', error);
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  /**
   * Обновляет статус разговора
   * @param {string} conversationId - ID разговора
   * @param {string} status - Новый статус
   * @returns {Promise<Object>} Обновленный разговор
   */
  async updateStatus(conversationId, status) {
    try {
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { 
          status,
          lastActivityAt: new Date()
        },
        { new: true }
      );

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      logger.info(`Conversation ${conversationId} status updated to ${status}`);
      return conversation;
    } catch (error) {
      logger.error('Error updating conversation status:', error);
      throw new Error(`Failed to update conversation status: ${error.message}`);
    }
  }

  /**
   * Удаляет разговор
   * @param {string} conversationId - ID разговора
   * @returns {Promise<boolean>} Успешность удаления
   */
  async delete(conversationId) {
    try {
      const result = await Conversation.findByIdAndDelete(conversationId);
      
      if (!result) {
        throw new Error('Conversation not found');
      }

      logger.info(`Conversation deleted: ${conversationId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }

  /**
   * Получает статистику разговоров
   * @param {Object} [filters] - Фильтры для статистики
   * @param {string} [filters.userId] - ID пользователя
   * @param {Date} [filters.startDate] - Начальная дата
   * @param {Date} [filters.endDate] - Конечная дата
   * @returns {Promise<Object>} Статистика разговоров
   */
  async getStats(filters = {}) {
    try {
      const query = {};
      
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      if (filters.startDate || filters.endDate) {
        query.startedAt = {};
        if (filters.startDate) {
          query.startedAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.startedAt.$lte = filters.endDate;
        }
      }

      const [stats] = await Conversation.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            closed: {
              $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
            },
            archived: {
              $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] }
            },
            languages: {
              $push: '$language'
            }
          }
        },
        {
          $project: {
            _id: 0,
            total: 1,
            active: 1,
            closed: 1,
            archived: 1,
            languageStats: {
              $reduce: {
                input: '$languages',
                initialValue: { en: 0, es: 0, ru: 0 },
                in: {
                  en: {
                    $cond: [
                      { $eq: ['$$this', 'en'] },
                      { $add: ['$$value.en', 1] },
                      '$$value.en'
                    ]
                  },
                  es: {
                    $cond: [
                      { $eq: ['$$this', 'es'] },
                      { $add: ['$$value.es', 1] },
                      '$$value.es'
                    ]
                  },
                  ru: {
                    $cond: [
                      { $eq: ['$$this', 'ru'] },
                      { $add: ['$$value.ru', 1] },
                      '$$value.ru'
                    ]
                  }
                }
              }
            }
          }
        }
      ]);

      return stats || {
        total: 0,
        active: 0,
        closed: 0,
        archived: 0,
        languageStats: { en: 0, es: 0, ru: 0 }
      };
    } catch (error) {
      logger.error('Error getting conversation stats:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  /**
   * Архивирует старые неактивные разговоры
   * @param {number} [daysInactive=30] - Количество дней неактивности
   * @returns {Promise<number>} Количество архивированных разговоров
   */
  async archiveOldConversations(daysInactive = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

      const result = await Conversation.updateMany(
        {
          status: 'active',
          lastActivityAt: { $lt: cutoffDate }
        },
        {
          status: 'archived',
          lastActivityAt: new Date()
        }
      );

      logger.info(`Archived ${result.modifiedCount} conversations older than ${daysInactive} days`);
      return result.modifiedCount;
    } catch (error) {
      logger.error('Error archiving old conversations:', error);
      throw new Error(`Failed to archive conversations: ${error.message}`);
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new ConversationService();