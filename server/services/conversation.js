/**
 * Сервис для управления разговорами
 * @file server/services/conversation.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @typedef {Object} ConversationData
 * @property {string} userId - ID пользователя
 * @property {string} [language] - Язык разговора
 * @property {Date} [startedAt] - Время начала разговора
 * @property {Object} [metadata] - Дополнительные метаданные
 */

/**
 * @typedef {Object} ConversationDoc
 * @property {string} _id - ID разговора
 * @property {string} userId - ID пользователя
 * @property {string} language - Язык разговора
 * @property {Date} startedAt - Время начала разговора
 * @property {Date} lastActivityAt - Время последней активности
 * @property {number} messageCount - Количество сообщений
 * @property {Object} metadata - Дополнительные метаданные
 * @property {Date} createdAt - Время создания
 * @property {Date} updatedAt - Время обновления
 */

/**
 * @class ConversationService
 * @description Сервис для управления разговорами в чате
 */
class ConversationService {
  constructor() {
    this.model = null;
    this.initialized = false;
    this.initializeModel();
  }

  /**
   * Инициализирует модель разговора
   */
  initializeModel() {
    try {
      // Схема для разговора
      const conversationSchema = new mongoose.Schema({
        userId: {
          type: String,
          required: true,
          index: true
        },
        language: {
          type: String,
          enum: ['en', 'es', 'ru'],
          default: 'en',
          index: true
        },
        startedAt: {
          type: Date,
          default: Date.now,
          index: true
        },
        lastActivityAt: {
          type: Date,
          default: Date.now,
          index: true
        },
        messageCount: {
          type: Number,
          default: 0
        },
        metadata: {
          type: Object,
          default: {}
        },
        // Флаг активности разговора
        isActive: {
          type: Boolean,
          default: true,
          index: true
        },
        // Источник разговора (socket, api, telegram)
        source: {
          type: String,
          enum: ['socket', 'api', 'telegram'],
          default: 'socket'
        }
      }, {
        timestamps: true,
        collection: 'conversations'
      });

      // Составные индексы для оптимизации
      conversationSchema.index({ userId: 1, lastActivityAt: -1 });
      conversationSchema.index({ lastActivityAt: -1, isActive: 1 });
      conversationSchema.index({ startedAt: -1, language: 1 });

      // Виртуальное поле для продолжительности разговора
      conversationSchema.virtual('duration').get(function() {
        return this.lastActivityAt - this.startedAt;
      });

      // Методы модели
      conversationSchema.methods.updateActivity = function() {
        this.lastActivityAt = new Date();
        return this.save();
      };

      conversationSchema.methods.incrementMessageCount = function() {
        this.messageCount += 1;
        this.lastActivityAt = new Date();
        return this.save();
      };

      conversationSchema.methods.setInactive = function() {
        this.isActive = false;
        return this.save();
      };

      // Статические методы
      conversationSchema.statics.findByUserId = function(userId, limit = 10) {
        return this.find({ userId })
          .sort({ lastActivityAt: -1 })
          .limit(limit);
      };

      conversationSchema.statics.findActiveByUserId = function(userId) {
        return this.findOne({ 
          userId, 
          isActive: true 
        }).sort({ lastActivityAt: -1 });
      };

      // Проверяем, не существует ли уже модель
      if (mongoose.models.Conversation) {
        this.model = mongoose.models.Conversation;
      } else {
        this.model = mongoose.model('Conversation', conversationSchema);
      }

      this.initialized = true;
      logger.info('✅ ConversationService initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize ConversationService:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Создает новый разговор
   * @param {ConversationData} data - Данные для создания разговора
   * @returns {Promise<ConversationDoc>} Созданный разговор
   */
  async create(data) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      const conversationData = {
        userId: data.userId,
        language: data.language || 'en',
        startedAt: data.startedAt || new Date(),
        lastActivityAt: new Date(),
        metadata: data.metadata || {},
        source: data.source || 'socket'
      };

      // Деактивируем предыдущие активные разговоры пользователя
      await this.model.updateMany(
        { userId: data.userId, isActive: true },
        { isActive: false }
      );

      const conversation = new this.model(conversationData);
      const savedConversation = await conversation.save();

      logger.info(`✅ Conversation created: ${savedConversation._id} for user: ${data.userId}`);
      return savedConversation;
    } catch (error) {
      logger.error('❌ Failed to create conversation:', error.message);
      throw error;
    }
  }

  /**
   * Находит разговор по ID
   * @param {string} conversationId - ID разговора
   * @returns {Promise<ConversationDoc|null>} Найденный разговор или null
   */
  async findById(conversationId) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        logger.warn(`Invalid conversation ID: ${conversationId}`);
        return null;
      }

      const conversation = await this.model.findById(conversationId);
      return conversation;
    } catch (error) {
      logger.error('❌ Failed to find conversation by ID:', error.message);
      throw error;
    }
  }

  /**
   * Находит активный разговор пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<ConversationDoc|null>} Активный разговор или null
   */
  async findActiveByUserId(userId) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      const conversation = await this.model.findActiveByUserId(userId);
      return conversation;
    } catch (error) {
      logger.error('❌ Failed to find active conversation:', error.message);
      throw error;
    }
  }

  /**
   * Находит все разговоры пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} options - Опции поиска
   * @param {number} [options.limit=10] - Лимит результатов
   * @param {number} [options.skip=0] - Количество пропускаемых записей
   * @param {boolean} [options.activeOnly=false] - Только активные разговоры
   * @returns {Promise<ConversationDoc[]>} Массив разговоров
   */
  async findByUserId(userId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      const { limit = 10, skip = 0, activeOnly = false } = options;

      let query = { userId };
      if (activeOnly) {
        query.isActive = true;
      }

      const conversations = await this.model
        .find(query)
        .sort({ lastActivityAt: -1 })
        .limit(limit)
        .skip(skip);

      return conversations;
    } catch (error) {
      logger.error('❌ Failed to find conversations by user ID:', error.message);
      throw error;
    }
  }

  /**
   * Обновляет время последней активности разговора
   * @param {string} conversationId - ID разговора
   * @returns {Promise<ConversationDoc>} Обновленный разговор
   */
  async updateLastActivity(conversationId) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error(`Invalid conversation ID: ${conversationId}`);
      }

      const conversation = await this.model.findByIdAndUpdate(
        conversationId,
        { 
          lastActivityAt: new Date(),
          isActive: true 
        },
        { new: true }
      );

      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      return conversation;
    } catch (error) {
      logger.error('❌ Failed to update conversation activity:', error.message);
      throw error;
    }
  }

  /**
   * Обновляет язык разговора
   * @param {string} conversationId - ID разговора
   * @param {string} language - Новый язык (en, es, ru)
   * @returns {Promise<ConversationDoc>} Обновленный разговор
   */
  async updateLanguage(conversationId, language) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error(`Invalid conversation ID: ${conversationId}`);
      }

      if (!['en', 'es', 'ru'].includes(language)) {
        throw new Error(`Invalid language: ${language}`);
      }

      const conversation = await this.model.findByIdAndUpdate(
        conversationId,
        { 
          language,
          lastActivityAt: new Date()
        },
        { new: true }
      );

      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      logger.info(`Updated conversation ${conversationId} language to: ${language}`);
      return conversation;
    } catch (error) {
      logger.error('❌ Failed to update conversation language:', error.message);
      throw error;
    }
  }

  /**
   * Увеличивает счетчик сообщений в разговоре
   * @param {string} conversationId - ID разговора
   * @returns {Promise<ConversationDoc>} Обновленный разговор
   */
  async incrementMessageCount(conversationId) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error(`Invalid conversation ID: ${conversationId}`);
      }

      const conversation = await this.model.findByIdAndUpdate(
        conversationId,
        { 
          $inc: { messageCount: 1 },
          lastActivityAt: new Date()
        },
        { new: true }
      );

      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      return conversation;
    } catch (error) {
      logger.error('❌ Failed to increment message count:', error.message);
      throw error;
    }
  }

  /**
   * Помечает разговор как неактивный
   * @param {string} conversationId - ID разговора
   * @returns {Promise<ConversationDoc>} Обновленный разговор
   */
  async setInactive(conversationId) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error(`Invalid conversation ID: ${conversationId}`);
      }

      const conversation = await this.model.findByIdAndUpdate(
        conversationId,
        { isActive: false },
        { new: true }
      );

      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      logger.info(`Conversation set as inactive: ${conversationId}`);
      return conversation;
    } catch (error) {
      logger.error('❌ Failed to set conversation inactive:', error.message);
      throw error;
    }
  }

  /**
   * Обновляет метаданные разговора
   * @param {string} conversationId - ID разговора
   * @param {Object} metadata - Новые метаданные
   * @returns {Promise<ConversationDoc>} Обновленный разговор
   */
  async updateMetadata(conversationId, metadata) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error(`Invalid conversation ID: ${conversationId}`);
      }

      const conversation = await this.model.findByIdAndUpdate(
        conversationId,
        { 
          $set: { metadata },
          lastActivityAt: new Date()
        },
        { new: true }
      );

      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      return conversation;
    } catch (error) {
      logger.error('❌ Failed to update conversation metadata:', error.message);
      throw error;
    }
  }

  /**
   * Удаляет старые неактивные разговоры
   * @param {number} daysOld - Количество дней для определения старых разговоров
   * @returns {Promise<number>} Количество удаленных разговоров
   */
  async cleanupOldConversations(daysOld = 30) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.model.deleteMany({
        isActive: false,
        lastActivityAt: { $lte: cutoffDate }
      });

      logger.info(`Cleaned up ${result.deletedCount} old conversations`);
      return result.deletedCount;
    } catch (error) {
      logger.error('❌ Failed to cleanup old conversations:', error.message);
      throw error;
    }
  }

  /**
   * Получает статистику разговоров
   * @param {Object} filter - Фильтр для статистики
   * @returns {Promise<Object>} Статистика разговоров
   */
  async getStats(filter = {}) {
    try {
      if (!this.initialized) {
        throw new Error('ConversationService not initialized');
      }

      const [total, active, byLanguage, avgDuration] = await Promise.all([
        // Общее количество разговоров
        this.model.countDocuments(filter),
        
        // Активные разговоры
        this.model.countDocuments({ ...filter, isActive: true }),
        
        // Разбивка по языкам
        this.model.aggregate([
          { $match: filter },
          { $group: { _id: '$language', count: { $sum: 1 } } }
        ]),
        
        // Средняя продолжительность разговоров
        this.model.aggregate([
          { $match: { ...filter, isActive: false } },
          {
            $project: {
              duration: { $subtract: ['$lastActivityAt', '$startedAt'] }
            }
          },
          {
            $group: {
              _id: null,
              avgDuration: { $avg: '$duration' }
            }
          }
        ])
      ]);

      return {
        total,
        active,
        inactive: total - active,
        byLanguage: byLanguage.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        avgDurationMs: avgDuration[0]?.avgDuration || 0,
        avgDurationMinutes: Math.round((avgDuration[0]?.avgDuration || 0) / 60000)
      };
    } catch (error) {
      logger.error('❌ Failed to get conversation stats:', error.message);
      throw error;
    }
  }

  /**
   * Проверяет здоровье сервиса
   * @returns {Promise<Object>} Результат проверки здоровья
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          status: 'error',
          message: 'ConversationService not initialized'
        };
      }

      // Попытка выполнить простой запрос
      await this.model.findOne().limit(1);

      return {
        status: 'ok',
        message: 'ConversationService is healthy'
      };
    } catch (error) {
      logger.error('ConversationService health check failed:', error.message);
      return {
        status: 'error',
        message: 'ConversationService health check failed',
        error: error.message
      };
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new ConversationService();