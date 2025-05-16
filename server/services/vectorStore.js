/**
 * Заглушка для Vector Store сервиса (до интеграции с Qdrant)
 * @file server/services/vectorStore.js
 */

const logger = require('../utils/logger');

/**
 * @class VectorStoreService
 * @description Заглушка для векторного хранилища
 */
class VectorStoreService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Инициализация (заглушка)
   */
  async initialize() {
    logger.info('Vector store: Not initialized (Qdrant not configured)');
    this.isInitialized = false;
    return Promise.resolve();
  }

  /**
   * Поиск в векторной базе (заглушка)
   * @param {string} query - Поисковый запрос
   * @param {Object} options - Опции поиска
   * @returns {Promise<Array>} Пустой массив
   */
  async search(query, options = {}) {
    logger.debug('Vector store search called but not implemented yet');
    return [];
  }

  /**
   * Добавление документов (заглушка)
   * @param {Array} documents - Документы для добавления
   * @returns {Promise<void>}
   */
  async addDocuments(documents) {
    logger.warn('Vector store: addDocuments called but not implemented');
    return Promise.resolve();
  }

  /**
   * Проверка здоровья сервиса
   * @returns {Promise<Object>} Статус здоровья
   */
  async healthCheck() {
    return {
      status: 'not_configured',
      message: 'Vector store not configured (Qdrant integration pending)',
      isInitialized: this.isInitialized
    };
  }

  /**
   * Получение статистики (заглушка)
   * @returns {Object} Базовая статистика
   */
  getStats() {
    return {
      status: 'not_initialized',
      documentsCount: 0,
      lastUpdate: null
    };
  }
}

// Экспортируем единственный экземпляр
module.exports = new VectorStoreService();