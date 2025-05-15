/**
 * Заглушка для базы данных MongoDB (для тестирования)
 * @file server/services/database.js
 */

const logger = require('../utils/logger');

/**
 * @class DatabaseService (Stub)
 * @description Заглушка для базы данных
 */
class DatabaseService {
  constructor() {
    this.connection = null;
    this.isConnected = true; // Всегда подключена
  }

  /**
   * Заглушка подключения к базе данных
   * @param {string} [uri] - URI для подключения к MongoDB
   * @returns {Promise<void>}
   */
  async connect(uri) {
    try {
      logger.info('📦 Using database stub (no real database connection)');
      logger.info('✅ Database service initialized (stub mode)');
      this.isConnected = true;
      return Promise.resolve();
    } catch (error) {
      logger.error('❌ Database stub connection failed:', error);
      throw error;
    }
  }

  /**
   * Заглушка отключения от базы данных
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      this.isConnected = false;
      logger.info('✅ Database stub disconnected');
      return Promise.resolve();
    } catch (error) {
      logger.error('❌ Error disconnecting database stub:', error);
      throw error;
    }
  }

  /**
   * Проверяет состояние подключения к базе данных
   * @returns {boolean} Подключена ли база данных
   */
  isConnectedToDB() {
    return this.isConnected;
  }

  /**
   * Получает информацию о состоянии подключения
   * @returns {Object} Информация о состоянии
   */
  getConnectionStatus() {
    return {
      state: this.isConnected ? 'connected' : 'disconnected',
      host: 'stub',
      name: 'stub',
      isConnected: this.isConnected,
      readyState: this.isConnected ? 1 : 0
    };
  }

  /**
   * Заглушка проверки здоровья базы данных
   * @returns {Promise<Object>} Результат проверки
   */
  async healthCheck() {
    return {
      status: 'ok',
      message: 'Database stub is healthy',
      details: this.getConnectionStatus()
    };
  }

  /**
   * Заглушка статистики базы данных
   * @returns {Promise<Object>} Статистика базы данных
   */
  async getStats() {
    return {
      database: {
        name: 'stub',
        collections: 0,
        objects: 0,
        dataSize: 0,
        storageSize: 0,
        indexes: 0,
        indexSize: 0
      },
      server: {
        version: 'stub',
        uptime: 0,
        connections: null,
        memory: null
      },
      connection: this.getConnectionStatus()
    };
  }

  /**
   * Заглушка создания индексов
   * @returns {Promise<void>}
   */
  async createIndexes() {
    logger.info('📦 Database indexes (stub mode) - no actual indexes created');
    return Promise.resolve();
  }

  /**
   * Заглушка миграций базы данных
   * @returns {Promise<void>}
   */
  async runMigrations() {
    logger.info('📦 Database migrations (stub mode) - no actual migrations run');
    return Promise.resolve();
  }

  /**
   * Заглушка очистки базы данных
   * @param {boolean} [confirm=false] - Подтверждение очистки
   * @returns {Promise<void>}
   */
  async clearDatabase(confirm = false) {
    logger.info('📦 Database clearing (stub mode) - no actual database to clear');
    return Promise.resolve();
  }
}

// Экспорт экземпляра сервиса
module.exports = new DatabaseService();