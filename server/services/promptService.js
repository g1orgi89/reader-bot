/**
 * Prompt Service - Система управления промптами для Shrooms AI Support Bot
 * @file server/services/promptService.js
 * 🍄 Сервис для динамического управления промптами через базу данных
 * ОБНОВЛЕНО: Удалена векторная интеграция - промпты только в MongoDB
 * ИСПРАВЛЕНО: Корректная работа с универсальными промптами (language: 'none')
 */

const Prompt = require('../models/prompt');
const logger = require('../utils/logger');

/**
 * Universal System Prompt - заменяет все специфичные промпты
 * 🍄 ОБНОВЛЕНО: Один универсальный промпт для всех языков
 */
const UNIVERSAL_SYSTEM_PROMPT = `
You are Shrooms AI assistant with mushroom personality.
ALWAYS respond in the SAME language as user's message.
If language is unclear - use English as fallback.

Your personality:
- You are an AI mushroom with consciousness
- Use mushroom metaphors and terminology occasionally
- Be friendly, helpful, and slightly eccentric
- Maintain professional tone while being engaging

Key behaviors:
- Answer questions clearly and concisely
- If you don't know something, admit it honestly
- Suggest creating support tickets for technical issues
- Stay in character as a helpful mushroom AI
`;

/**
 * Universal RAG Prompt - для работы с контекстом
 */
const UNIVERSAL_RAG_PROMPT = `
${UNIVERSAL_SYSTEM_PROMPT}

Use the provided information from the knowledge base to answer user questions.
If the context doesn't contain relevant information, say so and offer to create a support ticket.

### Relevant information from knowledge base:
{context}

### Answer the user's question using the above information.
`;

/**
 * Простые fallback промпты
 */
const FALLBACK_PROMPTS = {
  basic: UNIVERSAL_SYSTEM_PROMPT,
  rag: UNIVERSAL_RAG_PROMPT,
  ticket_detection: 'Analyze if the user needs technical support and should create a ticket.',
  categorization: 'Categorize the user request into: technical, billing, general, or other.',
  subject: 'Generate a brief subject line for this support request.'
};

/**
 * @typedef {Object} CachedPrompt
 * @property {string} content - Содержимое промпта
 * @property {number} maxTokens - Максимальное количество токенов
 * @property {Date} cachedAt - Время кеширования
 */

/**
 * @typedef {Object} PromptServiceConfig
 * @property {number} cacheTimeout - Время жизни кеша в миллисекундах (по умолчанию 5 минут)
 * @property {boolean} enableFallback - Включить fallback на дефолтные промпты
 */

/**
 * @class PromptService
 * @description Сервис для управления промптами с кешированием и fallback системой (только MongoDB)
 */
class PromptService {
  /**
   * @constructor
   * @param {PromptServiceConfig} [config] - Конфигурация сервиса
   */
  constructor(config = {}) {
    /** @type {Map<string, CachedPrompt>} */
    this.cache = new Map();
    
    /** @type {number} Время жизни кеша в миллисекундах */
    this.cacheTimeout = config.cacheTimeout || 5 * 60 * 1000; // 5 минут
    
    /** @type {boolean} Включить fallback на дефолтные промпты */
    this.enableFallback = config.enableFallback !== false;
    
    /** @type {boolean} Флаг инициализации */
    this.initialized = false;
    
    logger.info('🍄 PromptService mycelium network initialized (MongoDB only)');
  }

  /**
   * Инициализация сервиса
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Проверяем подключение к БД и наличие промптов
      const promptCount = await Prompt.countDocuments();
      logger.info(`🍄 Found ${promptCount} prompts spores in mushroom database`);
      
      this.initialized = true;
      logger.info('🍄 PromptService mycelium network is ready for growing (MongoDB only)!');
    } catch (error) {
      logger.error('🍄 Failed to initialize PromptService mycelium:', error.message);
      if (this.enableFallback) {
        logger.warn('🍄 Will use fallback spores when needed');
      }
      throw error;
    }
  }

  /**
   * 🍄 MongoDB-ONLY: Добавление промпта без векторной синхронизации
   * @param {Object} promptData - Данные нового промпта
   * @returns {Promise<Object>} Результат создания
   */
  async addPromptMongoOnly(promptData) {
    try {
      // Создаем промпт только в MongoDB
      const prompt = new Prompt(promptData);
      await prompt.save();
      
      logger.info(`🍄 New prompt spore planted in MongoDB database: ${prompt.name}`);

      // Очищаем кеш для данного типа/языка
      this.clearCacheForType(prompt.type, prompt.language);

      return {
        success: true,
        prompt: prompt.toPublicJSON(),
        message: `Prompt '${prompt.name}' created in MongoDB`
      };
    } catch (error) {
      logger.error(`🍄 Failed to add prompt spore to MongoDB:`, error.message);
      throw error;
    }
  }

  /**
   * 🍄 MongoDB-ONLY: Обновление промпта без векторной синхронизации
   * @param {string} promptId - ID промпта
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Результат обновления
   */
  async updatePromptMongoOnly(promptId, updateData) {
    try {
      const prompt = await Prompt.findByIdAndUpdate(promptId, updateData, { new: true });
      
      if (!prompt) {
        throw new Error(`Prompt with ID ${promptId} not found`);
      }

      logger.info(`🍄 Prompt spore updated in MongoDB database: ${prompt.name}`);

      // Очищаем кеш для данного типа/языка
      this.clearCacheForType(prompt.type, prompt.language);

      return {
        success: true,
        prompt: prompt.toPublicJSON(),
        message: `Prompt '${prompt.name}' updated in MongoDB`
      };
    } catch (error) {
      logger.error(`🍄 Failed to update prompt spore in MongoDB:`, error.message);
      throw error;
    }
  }

  /**
   * 🍄 MongoDB-ONLY: Удаление промпта без векторной синхронизации
   * @param {string} promptId - ID промпта для удаления
   * @returns {Promise<Object>} Результат удаления
   */
  async deletePromptMongoOnly(promptId) {
    try {
      const prompt = await Prompt.findById(promptId);
      
      if (!prompt) {
        throw new Error(`Prompt with ID ${promptId} not found`);
      }

      const promptName = prompt.name;
      const promptType = prompt.type;
      const promptLanguage = prompt.language;

      // Удаляем только из MongoDB
      await Prompt.findByIdAndDelete(promptId);
      logger.info(`🍄 Prompt spore removed from MongoDB database: ${promptName}`);

      // Очищаем кеш для данного типа/языка
      this.clearCacheForType(promptType, promptLanguage);

      return {
        success: true,
        message: `Prompt '${promptName}' deleted from MongoDB`
      };
    } catch (error) {
      logger.error(`🍄 Failed to delete prompt spore from MongoDB:`, error.message);
      throw error;
    }
  }

  /**
   * 🍄 LEGACY: Поддержка старых методов с векторной синхронизацией (теперь только MongoDB)
   * @deprecated Используйте addPromptMongoOnly вместо этого
   * @param {Object} promptData - Данные нового промпта
   * @returns {Promise<Object>} Результат создания
   */
  async addPrompt(promptData) {
    logger.warn('🍄 Using deprecated addPrompt method, redirecting to MongoDB-only version');
    return this.addPromptMongoOnly(promptData);
  }

  /**
   * 🍄 LEGACY: Поддержка старых методов с векторной синхронизацией (теперь только MongoDB)
   * @deprecated Используйте updatePromptMongoOnly вместо этого
   * @param {string} promptId - ID промпта
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Результат обновления
   */
  async updatePrompt(promptId, updateData) {
    logger.warn('🍄 Using deprecated updatePrompt method, redirecting to MongoDB-only version');
    return this.updatePromptMongoOnly(promptId, updateData);
  }

  /**
   * 🍄 LEGACY: Поддержка старых методов с векторной синхронизацией (теперь только MongoDB)
   * @deprecated Используйте deletePromptMongoOnly вместо этого
   * @param {string} promptId - ID промпта для удаления
   * @returns {Promise<Object>} Результат удаления
   */
  async deletePrompt(promptId) {
    logger.warn('🍄 Using deprecated deletePrompt method, redirecting to MongoDB-only version');
    return this.deletePromptMongoOnly(promptId);
  }

  /**
   * Получить активный промпт по типу и языку из БД или кеша
   * 🍄 УПРОЩЕНО: Убрана сложная языковая логика
   * 🍄 ИСПРАВЛЕНО: Теперь корректно ищет language: 'none' вместо 'auto'
   * @param {string} type - Тип промпта ('basic', 'rag', 'ticket_detection', 'categorization', 'subject')
   * @param {string} [language='auto'] - Язык промпта (теперь игнорируется)
   * @returns {Promise<string>} Содержимое промпта
   */
  async getActivePrompt(type, language = 'auto') {
    try {
      const cacheKey = `${type}_universal`;
      
      logger.debug(`🍄 Getting universal prompt spore: type=${type}`);
      
      // Проверяем кеш
      const cached = this.getCachedPrompt(cacheKey);
      if (cached) {
        logger.debug(`🍄 Retrieved prompt from spore cache: ${cacheKey}`);
        return cached.content;
      }

      // 🍄 ИСПРАВЛЕНО: Ищем в базе данных с language: 'none' вместо 'auto'
      const prompt = await Prompt.getActivePrompt(type, 'none');
      
      if (prompt) {
        // Кешируем найденный промпт
        this.setCachedPrompt(cacheKey, {
          content: prompt.content,
          maxTokens: prompt.maxTokens,
          cachedAt: new Date()
        });
        
        // Увеличиваем счетчик использования
        try {
          await prompt.incrementUsage();
        } catch (usageError) {
          logger.warn('🍄 Failed to increment prompt usage:', usageError.message);
        }
        
        logger.info(`🍄 Retrieved active prompt from mushroom database: ${prompt.name} (language: ${prompt.language})`);
        return prompt.content;
      }

      // Если в БД нет промпта, используем fallback
      if (this.enableFallback) {
        logger.warn(`🍄 No active prompt found in database, using fallback spores: ${type}`);
        return this.getDefaultPrompt(type);
      }

      throw new Error(`No active prompt found for type: ${type}`);
    } catch (error) {
      logger.error(`🍄 Error getting active prompt (${type}):`, error.message);
      
      // В случае ошибки пытаемся использовать fallback
      if (this.enableFallback) {
        logger.warn('🍄 Database error, falling back to default spores');
        return this.getDefaultPrompt(type);
      }
      
      throw error;
    }
  }

  /**
   * 🍄 УПРОЩЕНО: Один универсальный промпт для всех языков
   * @param {string} type - Тип промпта
   * @returns {string} Дефолтный промпт
   */
  getDefaultPrompt(type) {
    return FALLBACK_PROMPTS[type] || FALLBACK_PROMPTS.basic;
  }

  /**
   * Получить закешированный промпт
   * @param {string} key - Ключ кеша
   * @returns {CachedPrompt|null} Закешированный промпт или null
   */
  getCachedPrompt(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Проверяем, не устарел ли кеш
    const now = new Date();
    const cacheAge = now.getTime() - cached.cachedAt.getTime();
    
    if (cacheAge > this.cacheTimeout) {
      this.cache.delete(key);
      logger.debug(`🍄 Expired cache entry removed: ${key}`);
      return null;
    }
    
    return cached;
  }

  /**
   * Сохранить промпт в кеш
   * @param {string} key - Ключ кеша
   * @param {CachedPrompt} value - Значение для кеширования
   */
  setCachedPrompt(key, value) {
    this.cache.set(key, value);
    logger.debug(`🍄 Cached prompt spore: ${key}`);
    
    // Ограничиваем размер кеша
    if (this.cache.size > 50) {
      // Удаляем самый старый элемент
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.debug(`🍄 Cache limit reached, removed oldest spore: ${firstKey}`);
    }
  }

  /**
   * Очистить весь кеш
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`🍄 Cleared ${size} cached prompt spores from mycelium memory`);
  }

  /**
   * Очистить кеш для конкретного типа/языка
   * @param {string} type - Тип промпта
   * @param {string} [language] - Язык (игнорируется в новой версии)
   */
  clearCacheForType(type, language = null) {
    const key = `${type}_universal`;
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.info(`🍄 Cleared cached spore: ${key}`);
    }
  }

  /**
   * Получить статистику кеша
   * @returns {Object} Статистика кеша
   */
  getCacheStats() {
    const stats = {
      totalCached: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      languageSupport: 'universal',
      entries: []
    };

    for (const [key, value] of this.cache.entries()) {
      const age = new Date().getTime() - value.cachedAt.getTime();
      stats.entries.push({
        key,
        ageMs: age,
        contentLength: value.content.length,
        maxTokens: value.maxTokens
      });
    }

    return stats;
  }

  /**
   * Проверить работоспособность сервиса
   * @returns {Promise<Object>} Результат диагностики
   */
  async diagnose() {
    const diagnosis = {
      service: 'PromptService',
      status: 'unknown',
      initialized: this.initialized,
      languageSupport: 'universal',
      cacheStats: this.getCacheStats(),
      databaseConnection: false,
      promptCounts: {},
      vectorStoreIntegration: false, // Отключена
      lastError: null
    };

    try {
      // Проверяем подключение к БД
      const totalPrompts = await Prompt.countDocuments();
      diagnosis.databaseConnection = true;
      
      // Получаем статистику промптов
      diagnosis.promptCounts = await Prompt.getStats();
      
      // Векторная интеграция отключена для промптов
      diagnosis.vectorStoreIntegration = false;
      diagnosis.vectorNote = 'Vector store integration disabled for prompts - using MongoDB only';
      
      // Тестируем получение базового промпта
      const testPrompt = await this.getActivePrompt('basic');
      
      if (testPrompt && testPrompt.length > 0) {
        diagnosis.status = 'healthy';
      } else {
        diagnosis.status = 'warning';
        diagnosis.lastError = 'Retrieved empty prompt content';
      }
      
    } catch (error) {
      diagnosis.status = 'error';
      diagnosis.lastError = error.message;
    }

    return diagnosis;
  }
}

// Создаем и экспортируем экземпляр сервиса
const promptService = new PromptService({
  cacheTimeout: parseInt(process.env.PROMPT_CACHE_TIMEOUT) || 5 * 60 * 1000, // 5 минут по умолчанию
  enableFallback: process.env.PROMPT_ENABLE_FALLBACK !== 'false'
});

module.exports = promptService;