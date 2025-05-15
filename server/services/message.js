/**
 * Сервис для работы с сообщениями
 * @file server/services/message.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Схема сообщения
 */
const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  metadata: {
    language: String,
    tokensUsed: Number,
    sentiment: String,
    source: {
      type: String,
      enum: ['http', 'socket', 'telegram'],
      default: 'http'
    },
    ticketCreated: Boolean,
    ticketId: String
  }
}, {
  timestamps: true
});

// Индексы для оптимизации запросов
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ role: 1 });

// Модель сообщения
const Message = mongoose.model('Message', messageSchema);

/**
 * @class MessageService
 * @description Сервис для работы с сообщениями
 */
class MessageService {
  /**
   * Создает новое сообщение
   * @param {Object} messageData - Данные сообщения
   * @param {string} messageData.text - Текст сообщения
   * @param {string} messageData.role - Роль отправителя
   * @param {string} messageData.userId - ID пользователя
   * @param {string} messageData.conversationId - ID разговора
   * @param {Object} [messageData.metadata] - Дополнительные метаданные
   * @returns {Promise<Object>} Созданное сообщение
   */
  async create(messageData) {
    try {
      const message = new Message(messageData);
      await message.save();
      
      logger.info(`Message created: ${message._id} for conversation ${messageData.conversationId}`);
      return message;
    } catch (error) {
      logger.error('Error creating message:', error);
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  /**
   * Находит сообщение по ID
   * @param {string} messageId - ID сообщения
   * @returns {Promise<Object|null>} Сообщение или null
   */
  async findById(messageId) {
    try {
      const message = await Message.findById(messageId);
      return message;
    } catch (error) {
      logger.error('Error finding message by ID:', error);
      throw new Error(`Failed to find message: ${error.message}`);
    }
  }

  /**
   * Получает последние сообщения разговора
   * @param {string} conversationId - ID разговора
   * @param {number} [limit=50] - Количество сообщений
   * @returns {Promise<Object[]>} Массив сообщений
   */
  async getRecentMessages(conversationId, limit = 50) {
    try {
      const messages = await Message
        .find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();

      // Возвращаем в хронологическом порядке (от старых к новым)
      return messages.reverse();
    } catch (error) {
      logger.error('Error getting recent messages:', error);
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  }

  /**
   * Получает сообщения разговора с пагинацией
   * @param {string} conversationId - ID разговора
   * @param {Object} [options] - Опции поиска
   * @param {number} [options.page=1] - Номер страницы
   * @param {number} [options.limit=50] - Количество на страницу
   * @returns {Promise<Object[]>} Массив сообщений
   */
  async getMessagesByConversationId(conversationId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50
      } = options;

      const messages = await Message
        .find({ conversationId })
        .sort({ createdAt: 1 }) // От старых к новым
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      return messages;
    } catch (error) {
      logger.error('Error getting messages by conversation ID:', error);
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  }

  /**
   * Получает сообщения пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} [options] - Опции поиска
   * @param {number} [options.page=1] - Номер страницы
   * @param {number} [options.limit=50] - Количество на страницу
   * @param {string} [options.role] - Фильтр по роли
   * @returns {Promise<Object[]>} Массив сообщений
   */
  async getMessagesByUserId(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        role
      } = options;

      const query = { userId };
      if (role) {
        query.role = role;
      }

      const messages = await Message
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      return messages;
    } catch (error) {
      logger.error('Error getting messages by user ID:', error);
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  }

  /**
   * Обновляет сообщение
   * @param {string} messageId - ID сообщения
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Обновленное сообщение
   */
  async update(messageId, updateData) {
    try {
      const message = await Message.findByIdAndUpdate(
        messageId,
        updateData,
        { new: true }
      );

      if (!message) {
        throw new Error('Message not found');
      }

      logger.info(`Message updated: ${messageId}`);
      return message;
    } catch (error) {
      logger.error('Error updating message:', error);
      throw new Error(`Failed to update message: ${error.message}`);
    }
  }

  /**
   * Удаляет сообщение
   * @param {string} messageId - ID сообщения
   * @returns {Promise<boolean>} Успешность удаления
   */
  async delete(messageId) {
    try {
      const result = await Message.findByIdAndDelete(messageId);
      
      if (!result) {
        throw new Error('Message not found');
      }

      logger.info(`Message deleted: ${messageId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting message:', error);
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Получает статистику сообщений
   * @param {Object} [filters] - Фильтры для статистики
   * @param {string} [filters.userId] - ID пользователя
   * @param {string} [filters.conversationId] - ID разговора
   * @param {Date} [filters.startDate] - Начальная дата
   * @param {Date} [filters.endDate] - Конечная дата
   * @returns {Promise<Object>} Статистика сообщений
   */
  async getStats(filters = {}) {
    try {
      const query = {};
      
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      if (filters.conversationId) {
        query.conversationId = filters.conversationId;
      }
      
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.createdAt.$lte = filters.endDate;
        }
      }

      const [stats] = await Message.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            userMessages: {
              $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] }
            },
            assistantMessages: {
              $sum: { $cond: [{ $eq: ['$role', 'assistant'] }, 1, 0] }
            },
            systemMessages: {
              $sum: { $cond: [{ $eq: ['$role', 'system'] }, 1, 0] }
            },
            totalTokens: { $sum: '$metadata.tokensUsed' },
            languages: { $push: '$metadata.language' }
          }
        }
      ]);

      return stats || {
        total: 0,
        userMessages: 0,
        assistantMessages: 0,
        systemMessages: 0,
        totalTokens: 0,
        languages: []
      };
    } catch (error) {
      logger.error('Error getting message stats:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new MessageService();