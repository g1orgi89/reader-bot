/**
 * Prompt Service - Система управления промптами для Shrooms AI Support Bot
 * @file server/services/promptService.js
 * 🍄 Сервис для динамического управления промптами через базу данных
 * ОБНОВЛЕНО: Использование нового fallback файла + исправление языкового mapping + векторная интеграция
 */

const Prompt = require('../models/prompt');
const logger = require('../utils/logger');
const vectorStore = require('./vectorStore');
const { 
  FALLBACK_PROMPTS, 
  RAG_FALLBACK_PROMPTS, 
  TICKET_DETECTION_FALLBACK,
  CATEGORIZATION_FALLBACK,
  SUBJECT_FALLBACK 
} = require('../config/fallbackPrompts');

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
 * @typedef {Object} VectorSyncResult
 * @property {boolean} success - Успешность синхронизации
 * @property {string} message - Сообщение о результате
 * @property {string} [error] - Ошибка синхронизации (если есть)
 */

/**
 * @class PromptService
 * @description Сервис для управления промптами с кешированием, fallback системой и векторной интеграцией
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
    
    /** @type {Object<string, string>} Mapping полных названий языков к кодам */
    this.languageMap = {
      'English': 'en',
      'Русский': 'ru', 
      'Español': 'es',
      'en': 'en',
      'ru': 'ru',
      'es': 'es',
      'all': 'all'
    };
    
    logger.info('🍄 PromptService mycelium network initialized with cache timeout:', this.cacheTimeout);
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
      logger.info('🍄 PromptService mycelium network is ready for growing!');
    } catch (error) {
      logger.error('🍄 Failed to initialize PromptService mycelium:', error.message);
      if (this.enableFallback) {
        logger.warn('🍄 Will use fallback spores when needed');
      }
      throw error;
    }
  }

  /**
   * 🍄 НОВОЕ: Синхронизация промпта в векторную базу для RAG поиска
   * @param {Object} promptData - Данные промпта для синхронизации
   * @param {string} promptData.id - ID промпта
   * @param {string} promptData.name - Название промпта
   * @param {string} promptData.content - Содержимое промпта
   * @param {string} promptData.type - Тип промпта
   * @param {string} promptData.category - Категория промпта
   * @param {string} promptData.language - Язык промпта
   * @param {string[]} [promptData.tags] - Теги промпта
   * @returns {Promise<VectorSyncResult>} Результат синхронизации
   */
  async syncPromptToVector(promptData) {
    try {
      logger.info(`🍄 Synchronizing prompt spore to vector mushroom garden: ${promptData.name}`);
      
      // Формируем документ для векторной базы
      const vectorDocument = {
        id: `prompt_${promptData.id}`,
        content: `${promptData.name}\n\n${promptData.content}`,
        metadata: {
          id: `prompt_${promptData.id}`,
          title: promptData.name,
          category: `prompt_${promptData.category}`, // Префикс для отличия от knowledge документов
          language: promptData.language,
          tags: ['prompt', promptData.type, ...(promptData.tags || [])],
          source: 'prompt_system',
          promptType: promptData.type,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      // Добавляем в векторную базу
      const success = await vectorStore.addDocuments([vectorDocument]);
      
      if (success) {
        logger.info(`🍄 Successfully planted prompt spore in vector garden: ${promptData.name}`);
        return {
          success: true,
          message: `Prompt '${promptData.name}' successfully synced to vector store`
        };
      } else {
        logger.warn(`🍄 Failed to plant prompt spore in vector garden: ${promptData.name}`);
        return {
          success: false,
          message: `Failed to sync prompt '${promptData.name}' to vector store`,
          error: 'Vector store operation failed'
        };
      }
    } catch (error) {
      logger.error(`🍄 Vector synchronization failed for prompt spore ${promptData.name}:`, error.message);
      return {
        success: false,
        message: `Error syncing prompt '${promptData.name}' to vector store`,
        error: error.message
      };
    }
  }

  /**
   * 🍄 НОВОЕ: Удаление промпта из векторной базы
   * @param {string} promptId - ID промпта для удаления
   * @returns {Promise<VectorSyncResult>} Результат удаления
   */
  async removePromptFromVector(promptId) {
    try {
      logger.info(`🍄 Removing prompt spore from vector garden: ${promptId}`);
      
      const vectorDocumentId = `prompt_${promptId}`;
      const success = await vectorStore.deleteDocument(vectorDocumentId);
      
      if (success) {
        logger.info(`🍄 Successfully removed prompt spore from vector garden: ${promptId}`);
        return {
          success: true,
          message: `Prompt '${promptId}' successfully removed from vector store`
        };
      } else {
        logger.warn(`🍄 Failed to remove prompt spore from vector garden: ${promptId}`);
        return {
          success: false,
          message: `Failed to remove prompt '${promptId}' from vector store`,
          error: 'Vector store operation failed'
        };
      }
    } catch (error) {
      logger.error(`🍄 Vector removal failed for prompt spore ${promptId}:`, error.message);
      return {
        success: false,
        message: `Error removing prompt '${promptId}' from vector store`,
        error: error.message
      };
    }
  }

  /**
   * 🍄 НОВОЕ: Массовая синхронизация всех промптов в векторную базу
   * @returns {Promise<Object>} Результат массовой синхронизации
   */
  async syncAllPromptsToVector() {
    try {
      logger.info('🍄 Starting mass synchronization of all prompt spores to vector mushroom garden');
      
      // Получаем все промпты из базы данных
      const prompts = await Prompt.find({}).sort({ type: 1, language: 1, name: 1 });
      
      if (prompts.length === 0) {
        logger.warn('🍄 No prompt spores found in database for synchronization');
        return {
          success: true,
          message: 'No prompts found to sync',
          totalPrompts: 0,
          syncedPrompts: 0,
          failedPrompts: 0,
          results: []
        };
      }

      logger.info(`🍄 Found ${prompts.length} prompt spores to transplant to vector garden`);

      // Подготавливаем все документы для векторной базы
      const vectorDocuments = prompts.map(prompt => ({
        id: `prompt_${prompt._id}`,
        content: `${prompt.name}\n\n${prompt.content}`,
        metadata: {
          id: `prompt_${prompt._id}`,
          title: prompt.name,
          category: `prompt_${prompt.category}`, // Префикс для отличия от knowledge документов
          language: prompt.language,
          tags: ['prompt', prompt.type, ...(prompt.tags || [])],
          source: 'prompt_system',
          promptType: prompt.type,
          createdAt: prompt.createdAt || new Date(),
          updatedAt: new Date()
        }
      }));

      // Массовое добавление в векторную базу
      const success = await vectorStore.addDocuments(vectorDocuments);

      const result = {
        success,
        totalPrompts: prompts.length,
        syncedPrompts: success ? prompts.length : 0,
        failedPrompts: success ? 0 : prompts.length,
        message: success 
          ? `Successfully synced all ${prompts.length} prompt spores to vector garden`
          : `Failed to sync ${prompts.length} prompt spores to vector garden`,
        details: vectorDocuments.map(doc => ({
          id: doc.metadata.id,
          title: doc.metadata.title,
          category: doc.metadata.category,
          language: doc.metadata.language,
          status: success ? 'synced' : 'failed'
        }))
      };

      if (success) {
        logger.info(`🍄 Successfully transplanted all ${prompts.length} prompt spores to vector mushroom garden!`);
      } else {
        logger.error(`🍄 Failed to transplant prompt spores to vector garden`);
      }

      return result;
    } catch (error) {
      logger.error('🍄 Mass synchronization of prompt spores failed:', error.message);
      return {
        success: false,
        totalPrompts: 0,
        syncedPrompts: 0,
        failedPrompts: 0,
        message: `Mass synchronization failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * 🍄 ОБНОВЛЕННОЕ: Добавление промпта с автоматической синхронизацией в векторную базу
   * @param {Object} promptData - Данные нового промпта
   * @returns {Promise<Object>} Результат создания и синхронизации
   */
  async addPrompt(promptData) {
    try {
      // Создаем промпт в MongoDB
      const prompt = new Prompt(promptData);
      await prompt.save();
      
      logger.info(`🍄 New prompt spore planted in database: ${prompt.name}`);

      // Автоматически синхронизируем с векторной базой
      const syncResult = await this.syncPromptToVector({
        id: prompt._id.toString(),
        name: prompt.name,
        content: prompt.content,
        type: prompt.type,
        category: prompt.category,
        language: prompt.language,
        tags: prompt.tags
      });

      // Очищаем кеш для данного типа/языка
      this.clearCacheForType(prompt.type, prompt.language);

      return {
        success: true,
        prompt: prompt.toPublicJSON(),
        vectorSync: syncResult,
        message: `Prompt '${prompt.name}' created and ${syncResult.success ? 'synced to vector store' : 'sync failed'}`
      };
    } catch (error) {
      logger.error(`🍄 Failed to add prompt spore:`, error.message);
      throw error;
    }
  }

  /**
   * 🍄 ОБНОВЛЕННОЕ: Обновление промпта с автоматической синхронизацией в векторную базу
   * @param {string} promptId - ID промпта
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Результат обновления и синхронизации
   */
  async updatePrompt(promptId, updateData) {
    try {
      const prompt = await Prompt.findByIdAndUpdate(promptId, updateData, { new: true });
      
      if (!prompt) {
        throw new Error(`Prompt with ID ${promptId} not found`);
      }

      logger.info(`🍄 Prompt spore updated in database: ${prompt.name}`);

      // Автоматически синхронизируем обновленный промпт с векторной базой
      const syncResult = await this.syncPromptToVector({
        id: prompt._id.toString(),
        name: prompt.name,
        content: prompt.content,
        type: prompt.type,
        category: prompt.category,
        language: prompt.language,
        tags: prompt.tags
      });

      // Очищаем кеш для данного типа/языка
      this.clearCacheForType(prompt.type, prompt.language);

      return {
        success: true,
        prompt: prompt.toPublicJSON(),
        vectorSync: syncResult,
        message: `Prompt '${prompt.name}' updated and ${syncResult.success ? 'synced to vector store' : 'sync failed'}`
      };
    } catch (error) {
      logger.error(`🍄 Failed to update prompt spore:`, error.message);
      throw error;
    }
  }

  /**
   * 🍄 ОБНОВЛЕННОЕ: Удаление промпта с автоматическим удалением из векторной базы
   * @param {string} promptId - ID промпта для удаления
   * @returns {Promise<Object>} Результат удаления
   */
  async deletePrompt(promptId) {
    try {
      const prompt = await Prompt.findById(promptId);
      
      if (!prompt) {
        throw new Error(`Prompt with ID ${promptId} not found`);
      }

      const promptName = prompt.name;
      const promptType = prompt.type;
      const promptLanguage = prompt.language;

      // Удаляем из MongoDB
      await Prompt.findByIdAndDelete(promptId);
      logger.info(`🍄 Prompt spore removed from database: ${promptName}`);

      // Автоматически удаляем из векторной базы
      const syncResult = await this.removePromptFromVector(promptId);

      // Очищаем кеш для данного типа/языка
      this.clearCacheForType(promptType, promptLanguage);

      return {
        success: true,
        vectorSync: syncResult,
        message: `Prompt '${promptName}' deleted and ${syncResult.success ? 'removed from vector store' : 'vector removal failed'}`
      };
    } catch (error) {
      logger.error(`🍄 Failed to delete prompt spore:`, error.message);
      throw error;
    }
  }

  /**
   * Нормализует язык из полного названия к коду
   * @param {string} language - Язык (полное название или код)
   * @returns {string} Нормализованный код языка
   */
  normalizeLanguage(language) {
    if (!language) return 'en';
    
    // Ищем в mapping таблице
    const normalized = this.languageMap[language];
    if (normalized) {
      return normalized;
    }
    
    // Если не найдено в mapping, пытаемся найти по подстроке (case-insensitive)
    const lowerLanguage = language.toLowerCase();
    for (const [key, value] of Object.entries(this.languageMap)) {
      if (key.toLowerCase().includes(lowerLanguage) || lowerLanguage.includes(key.toLowerCase())) {
        logger.info(`🍄 Language mapping found: ${language} -> ${value}`);
        return value;
      }
    }
    
    // По умолчанию возвращаем английский
    logger.warn(`🍄 Unknown language "${language}", defaulting to "en"`);
    return 'en';
  }

  /**
   * Получить активный промпт по типу и языку из БД или кеша
   * @param {string} type - Тип промпта ('basic', 'rag', 'ticket_detection', 'categorization', 'subject')
   * @param {string} [language='en'] - Язык промпта ('en', 'es', 'ru', 'all' или полное название)
   * @returns {Promise<string>} Содержимое промпта
   */
  async getActivePrompt(type, language = 'en') {
    try {
      // 🍄 ИСПРАВЛЕНИЕ: Нормализуем язык для обработки полных названий
      const normalizedLanguage = this.normalizeLanguage(language);
      const cacheKey = `${type}_${normalizedLanguage}`;
      
      logger.debug(`🍄 Getting prompt spore: type=${type}, original_language=${language}, normalized=${normalizedLanguage}`);
      
      // Проверяем кеш
      const cached = this.getCachedPrompt(cacheKey);
      if (cached) {
        logger.debug(`🍄 Retrieved prompt from spore cache: ${cacheKey}`);
        return cached.content;
      }

      // Ищем в базе данных
      const prompt = await Prompt.getActivePrompt(type, normalizedLanguage);
      
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
        
        logger.info(`🍄 Retrieved active prompt from mushroom database: ${prompt.name}`);
        return prompt.content;
      }

      // Если в БД нет промпта, используем fallback
      if (this.enableFallback) {
        logger.warn(`🍄 No active prompt found in database, using fallback spores: ${type}/${normalizedLanguage}`);
        return this.getDefaultPrompt(type, normalizedLanguage);
      }

      throw new Error(`No active prompt found for type: ${type}, language: ${normalizedLanguage}`);
    } catch (error) {
      logger.error(`🍄 Error getting active prompt (${type}/${language}):`, error.message);
      
      // В случае ошибки пытаемся использовать fallback
      if (this.enableFallback) {
        logger.warn('🍄 Database error, falling back to default spores');
        const normalizedLanguage = this.normalizeLanguage(language);
        return this.getDefaultPrompt(type, normalizedLanguage);
      }
      
      throw error;
    }
  }

  /**
   * 🍄 ОБНОВЛЕНО: Fallback на новые минимальные промпты из файла
   * @param {string} type - Тип промпта
   * @param {string} [language='en'] - Язык промпта
   * @returns {string} Дефолтный промпт
   */
  getDefaultPrompt(type, language = 'en') {
    // Нормализуем язык и проверяем, что он поддерживается
    const normalizedLanguage = this.normalizeLanguage(language);
    const supportedLanguage = ['en', 'es', 'ru'].includes(normalizedLanguage) ? normalizedLanguage : 'en';
    
    switch (type) {
      case 'basic':
        return FALLBACK_PROMPTS[supportedLanguage];
        
      case 'rag':
        return `${FALLBACK_PROMPTS[supportedLanguage]}\n\n${RAG_FALLBACK_PROMPTS[supportedLanguage]}`;
        
      case 'ticket_detection':
        return TICKET_DETECTION_FALLBACK;
        
      case 'categorization':
        return CATEGORIZATION_FALLBACK;
        
      case 'subject':
        return SUBJECT_FALLBACK;
        
      default:
        logger.warn(`🍄 Unknown prompt type for fallback: ${type}, using basic`);
        return FALLBACK_PROMPTS[supportedLanguage];
    }
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
   * @param {string} [language] - Язык (если не указан, очищаются все языки для типа)
   */
  clearCacheForType(type, language = null) {
    if (language) {
      const normalizedLanguage = this.normalizeLanguage(language);
      const key = `${type}_${normalizedLanguage}`;
      const deleted = this.cache.delete(key);
      if (deleted) {
        logger.info(`🍄 Cleared cached spore: ${key}`);
      }
    } else {
      // Очищаем все промпты данного типа
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${type}_`)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.info(`🍄 Cleared ${keysToDelete.length} cached spores for type: ${type}`);
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
      languageMapping: this.languageMap,
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
      languageMapping: this.languageMap,
      cacheStats: this.getCacheStats(),
      databaseConnection: false,
      promptCounts: {},
      vectorStoreIntegration: false,
      lastError: null
    };

    try {
      // Проверяем подключение к БД
      const totalPrompts = await Prompt.countDocuments();
      diagnosis.databaseConnection = true;
      
      // Получаем статистику промптов
      diagnosis.promptCounts = await Prompt.getStats();
      
      // Проверяем интеграцию с векторным хранилищем
      try {
        const vectorStats = await vectorStore.getStats();
        diagnosis.vectorStoreIntegration = vectorStats.status === 'ok';
        diagnosis.vectorStats = vectorStats;
      } catch (vectorError) {
        diagnosis.vectorStoreIntegration = false;
        diagnosis.vectorError = vectorError.message;
      }
      
      // Тестируем получение базового промпта с разными форматами языка
      const testPromptEn = await this.getActivePrompt('basic', 'en');
      const testPromptRu = await this.getActivePrompt('basic', 'Русский'); // Тестируем полное название
      
      if (testPromptEn && testPromptEn.length > 0 && testPromptRu && testPromptRu.length > 0) {
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