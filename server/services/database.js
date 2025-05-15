/**
 * Сервис для работы с базой данных MongoDB
 * @file server/services/database.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @typedef {Object} ConnectionStatus
 * @property {string} state - Состояние соединения
 * @property {string} host - Хост базы данных
 * @property {string} name - Имя базы данных
 * @property {boolean} isConnected - Подключена ли БД
 * @property {number} readyState - Числовое состояние соединения
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {string} status - Статус проверки (ok/error)
 * @property {string} message - Сообщение о результате
 * @property {ConnectionStatus} details - Детали подключения
 * @property {string} [error] - Сообщение об ошибке, если есть
 */

/**
 * @class DatabaseService
 * @description Сервис для управления подключением к MongoDB
 */
class DatabaseService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 секунда
    
    // Настройки подключения - исправлены для совместимости
    this.connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 секунд
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      // Удаляем неподдерживаемые опции
      // bufferMaxEntries: 0,  // УДАЛЕНО - не поддерживается
      // bufferCommands: false // УДАЛЕНО - не поддерживается
    };
    
    // Настраиваем обработчики событий
    this.setupEventHandlers();
  }

  /**
   * Настраивает обработчики событий для подключения MongoDB
   */
  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('✅ MongoDB connected successfully');
    });

    mongoose.connection.on('error', (error) => {
      this.isConnected = false;
      logger.error('❌ MongoDB connection error:', {
        error: error.message,
        code: error.code,
        codeName: error.codeName
      });
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('⚠️ MongoDB disconnected');
      this.handleReconnect();
    });

    mongoose.connection.on('reconnected', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('🔄 MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  /**
   * Обрабатывает переподключение к базе данных
   */
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    this.reconnectAttempts++;
    logger.info(`🔄 Attempting to reconnect to MongoDB (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      mongoose.connect(process.env.MONGODB_URI, this.connectionOptions).catch(error => {
        logger.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Подключается к базе данных MongoDB
   * @param {string} [uri] - URI для подключения к MongoDB
   * @returns {Promise<mongoose.Connection>}
   */
  async connect(uri) {
    try {
      const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support';
      
      // Скрываем пароль в логах
      const logUri = mongoUri.replace(/:[^:]*@/, ':***@');
      logger.info(`📡 Attempting to connect to MongoDB: ${logUri}`);
      
      // Очищаем предыдущее соединение если есть
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }

      // Устанавливаем новое соединение
      await mongoose.connect(mongoUri, this.connectionOptions);
      
      this.connection = mongoose.connection;
      
      // Проверяем соединение
      await this.connection.db.admin().ping();
      
      logger.info('✅ Database service initialized successfully');
      
      return this.connection;
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Database connection failed:', {
        error: error.message,
        code: error.code,
        uri: uri?.replace(/:[^:]*@/, ':***@') || 'default'
      });
      
      // Не выбрасываем ошибку сразу, попробуем переподключиться
      this.handleReconnect();
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
        await mongoose.disconnect();
        this.isConnected = false;
        logger.info('✅ MongoDB connection closed gracefully');
      }
    } catch (error) {
      logger.error('❌ Error closing MongoDB connection:', error.message);
      throw error;
    }
  }

  /**
   * Graceful shutdown обработчик
   * @param {string} signal - Сигнал завершения
   */
  async gracefulShutdown(signal) {
    logger.info(`🔄 Received ${signal}, shutting down gracefully`);
    try {
      await this.disconnect();
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error.message);
      process.exit(1);
    }
  }

  /**
   * Проверяет состояние подключения к базе данных
   * @returns {boolean}
   */
  isConnectedToDB() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Получает информацию о состоянии подключения
   * @returns {ConnectionStatus}
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
      state: states[state] || 'unknown',
      host: mongoose.connection.host || 'unknown',
      name: mongoose.connection.name || 'unknown',
      isConnected: this.isConnected,
      readyState: state
    };
  }

  /**
   * Выполняет проверку здоровья базы данных
   * @returns {Promise<HealthCheckResult>}
   */
  async healthCheck() {
    try {
      const status = this.getConnectionStatus();
      
      if (!this.isConnectedToDB()) {
        return {
          status: 'error',
          message: `Database not connected. Current state: ${status.state}`,
          details: status
        };
      }

      // Ping базы данных
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'ok',
        message: 'Database is healthy and responding',
        details: status
      };
    } catch (error) {
      logger.error('Database health check failed:', error.message);
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
      
      const [dbStats, collections] = await Promise.all([
        db.stats(),
        db.listCollections().toArray()
      ]);

      return {
        database: {
          name: db.databaseName,
          collections: dbStats.collections,
          collectionsList: collections.map(c => c.name),
          objects: dbStats.objects,
          dataSize: this.formatBytes(dbStats.dataSize),
          storageSize: this.formatBytes(dbStats.storageSize),
          indexes: dbStats.indexes,
          indexSize: this.formatBytes(dbStats.indexSize)
        },
        connection: this.getConnectionStatus()
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error.message);
      throw error;
    }
  }

  /**
   * Форматирует байты в человекочитаемый формат
   * @param {number} bytes - Количество байт
   * @returns {string} Форматированная строка
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Создает индексы для коллекций
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      if (!this.isConnectedToDB()) {
        throw new Error('Database not connected');
      }

      logger.info('📋 Creating database indexes...');
      
      // Индексы для сообщений
      await mongoose.connection.collection('messages').createIndex({ 
        conversationId: 1, 
        createdAt: 1 
      });
      
      // Индексы для разговоров
      await mongoose.connection.collection('conversations').createIndex({ 
        userId: 1, 
        lastActivityAt: -1 
      });
      
      // Индексы для тикетов
      await mongoose.connection.collection('tickets').createIndex({ 
        ticketId: 1 
      });
      await mongoose.connection.collection('tickets').createIndex({ 
        userId: 1,
        status: 1,
        createdAt: -1 
      });
      
      logger.info('✅ Database indexes created successfully');
    } catch (error) {
      logger.error('❌ Failed to create database indexes:', error.message);
      throw error;
    }
  }

  /**
   * Очищает базу данных (только для тестов)
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
      logger.error('❌ Failed to clear database:', error.message);
      throw error;
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new DatabaseService();