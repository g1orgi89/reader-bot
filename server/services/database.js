/**
 * MongoDB Service for basic operations
 * @file server/services/database.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @class DatabaseService
 * @description Simple MongoDB service for basic operations
 */
class DatabaseService {
  /**
   * @constructor
   */
  constructor() {
    this.connected = false;
    this.connection = null;
  }

  /**
   * Initialize database connection
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(options = {}) {
    try {
      // Get connection URI from environment or config
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support';
      
      logger.info(`🍄 Initializing database connection to ${uri.replace(/\/\/.*@/, '//***@')}`);
      
      return await this.connect(uri, options);
    } catch (error) {
      logger.error(`Database initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to MongoDB
   * @param {string} uri - MongoDB connection URI
   * @param {Object} options - Connection options
   * @returns {Promise<boolean>} Connection success
   */
  async connect(uri, options = {}) {
    try {
      if (this.connected) {
        logger.info('Database already connected');
        return true;
      }

      const defaultOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        ...options
      };

      await mongoose.connect(uri, defaultOptions);
      this.connection = mongoose.connection;
      this.connected = true;

      logger.info('✅ Database connected successfully');
      return true;
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<boolean>} Disconnection success
   */
  async disconnect() {
    try {
      if (!this.connected) {
        logger.info('Database already disconnected');
        return true;
      }

      await mongoose.disconnect();
      this.connected = false;
      this.connection = null;

      logger.info('Database disconnected successfully');
      return true;
    } catch (error) {
      logger.error('Database disconnection failed:', error);
      throw new Error(`Database disconnection failed: ${error.message}`);
    }
  }

  /**
   * Close database connection (alias for disconnect)
   * @returns {Promise<boolean>} Close success
   */
  async close() {
    return this.disconnect();
  }

  /**
   * Get database connection status
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected && mongoose.connection.readyState === 1;
  }

  /**
   * Get MongoDB connection instance
   * @returns {mongoose.Connection} MongoDB connection
   */
  getConnection() {
    return this.connection;
  }

  /**
   * Health check for database
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      if (!this.isConnected()) {
        return {
          status: 'unhealthy',
          message: 'Database not connected'
        };
      }

      // Ping database
      await mongoose.connection.db.admin().ping();

      return {
        status: 'healthy',
        message: 'Database connection is working',
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        message: `Database health check failed: ${error.message}`
      };
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} Database stats
   */
  async getStats() {
    try {
      if (!this.isConnected()) {
        return {
          error: 'Database not connected'
        };
      }

      const stats = await mongoose.connection.db.stats();
      return {
        collections: stats.collections,
        documents: stats.objects,
        averageObjectSize: stats.avgObjSize,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return {
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();