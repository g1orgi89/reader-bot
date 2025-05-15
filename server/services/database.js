/**
 * Сервис для работы с базой данных MongoDB
 * @file server/services/database.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @class DatabaseService
 * @description Сервис для управления подключением к MongoDB
 */
class DatabaseService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    
    // Настройки подключения
    this.connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Таймаут для выбора сервера
      socketTimeoutMS: 45000, // Таймаут сокета
      maxPoolSize: 10, // Максимальное количество соединений в пуле
      minPoolSize: 1,  // Минимальное количество соединений в пуле
      maxIdleTimeMS: 30000, // Время простоя соединения
      bufferMaxEntries: 0 // Отключить буферизацию
    };
    
    // Обработчики событий MongoDB
    this.setupEventHandlers();
  }

  /**
   * Настраивает обработчики событий для подключения MongoDB
   */
  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      logger.info('✅ MongoDB connected successfully');
    });

    mongoose.connection.on('error', (error) => {
      this.isConnected = false;
      logger.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      this.isConnected = true;
      logger.info('🔄 MongoDB reconnected');
    });

    // Обработка сигналов завершения приложения
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Подключается к базе данных MongoDB
   * @param {string} [uri] - URI для подключения к MongoDB
   * @returns {Promise<void>}
   */
  async connect(uri) {
    try {
      // Используем переданный URI или из переменных окружения - ИСПРАВЛЕНО на localhost
      const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support';
      
      logger.info(`Connecting to MongoDB: ${mongoUri.replace(/:[^:]*@/, ':***@')}`);
      
      // Подключение к MongoDB
      await mongoose.connect(mongoUri, this.connectionOptions);
      
      this.connection = mongoose.connection;
      logger.info('✅ Database service initialized');
      
      return this.connection;
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Отключается от базы данных
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.connection && this.isConnected) {
        await mongoose.connection.close();
        this.isConnected = false;
        logger.info('✅ MongoDB connection closed');
      }
    } catch (error) {
      logger.error('❌ Error closing MongoDB connection:', error);
      throw error;
    }
  }

  /**
   * Проверяет состояние подключения к базе данных
   * @returns {boolean} Подключена ли база данных
   */
  isConnectedToDB() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Получает информацию о состоянии подключения
   * @returns {Object} Информация о состоянии
   */
  getConnectionStatus() {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      state: states[state],
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      isConnected: this.isConnected,
      readyState: state
    };
  }

  /**
   * Выполняет проверку здоровья базы данных
   * @returns {Promise<Object>} Результат проверки
   */
  async healthCheck() {
    try {
      if (!this.isConnectedToDB()) {
        return {
          status: 'error',
          message: 'Database not connected',
          details: this.getConnectionStatus()
        };
      }

      // Выполняем простой запрос для проверки работоспособности
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'ok',
        message: 'Database is healthy',
        details: this.getConnectionStatus()
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'error',
        message: 'Database health check failed',
        error: error.message,
        details: this.getConnectionStatus()
      };
    }
  }

  /**
   * Получает статистику базы данных
   * @returns {Promise<Object>} Статистика базы данных
   */
  async getStats() {
    try {
      if (!this.isConnectedToDB()) {
        throw new Error('Database not connected');
      }

      const db = mongoose.connection.db;
      const admin = db.admin();
      
      // Получаем статистику базы данных
      const [dbStats, serverStatus] = await Promise.all([
        db.stats(),
        admin.serverStatus()
      ]);

      return {
        database: {
          name: db.databaseName,
          collections: dbStats.collections,
          objects: dbStats.objects,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          indexSize: dbStats.indexSize
        },
        server: {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          connections: serverStatus.connections,
          memory: serverStatus.mem
        },
        connection: this.getConnectionStatus()
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Создает индексы для коллекций (если нужно)
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      if (!this.isConnectedToDB()) {
        throw new Error('Database not connected');
      }

      logger.info('Creating database indexes...');
      
      // Здесь можно создать необходимые индексы
      // Пример:
      // await mongoose.connection.collection('messages').createIndex({ conversationId: 1, createdAt: 1 });
      // await mongoose.connection.collection('conversations').createIndex({ userId: 1, startedAt: -1 });
      
      logger.info('✅ Database indexes created successfully');
    } catch (error) {
      logger.error('❌ Failed to create database indexes:', error);
      throw error;
    }
  }

  /**
   * Выполняет миграции базы данных (если нужно)
   * @returns {Promise<void>}
   */
  async runMigrations() {
    try {
      if (!this.isConnectedToDB()) {
        throw new Error('Database not connected');
      }

      logger.info('Running database migrations...');
      
      // Здесь можно выполнить миграции
      // Пример проверки и создания коллекций
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(col => col.name);
      
      logger.info(`Found collections: ${collectionNames.join(', ')}`);
      
      logger.info('✅ Database migrations completed successfully');
    } catch (error) {
      logger.error('❌ Failed to run database migrations:', error);
      throw error;
    }
  }

  /**
   * Очищает базу данных (используется для тестов)
   * @param {boolean} [confirm=false] - Подтверждение очистки
   * @returns {Promise<void>}
   */
  async clearDatabase(confirm = false) {
    if (!confirm) {
      throw new Error('Database clearing requires explicit confirmation');
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clear database in production environment');
    }

    try {
      if (!this.isConnectedToDB()) {
        throw new Error('Database not connected');
      }

      logger.warn('⚠️ Clearing database...');
      await mongoose.connection.db.dropDatabase();
      logger.info('✅ Database cleared successfully');
    } catch (error) {
      logger.error('❌ Failed to clear database:', error);
      throw error;
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new DatabaseService();