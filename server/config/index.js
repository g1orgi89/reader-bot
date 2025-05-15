/**
 * Main configuration file for Shrooms Support Bot
 * @file server/config/index.js
 */

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Application configuration
 */
const config = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PREFIX: process.env.API_PREFIX || '/api',

  // Database configuration (optional for basic testing)
  MONGODB_URI: process.env.MONGODB_URI,
  
  // Anthropic/Claude configuration
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
  CLAUDE_MAX_TOKENS: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
  CLAUDE_TEMPERATURE: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7,
  
  // Vector database configuration (optional)
  VECTOR_DB_URL: process.env.VECTOR_DB_URL || 'http://localhost:6333',
  VECTOR_COLLECTION_NAME: process.env.VECTOR_COLLECTION_NAME || 'shrooms_knowledge',
  
  // Embedding configuration (optional)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
  
  // Security configuration
  JWT_SECRET: process.env.JWT_SECRET || 'shrooms-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'password123',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'default-admin-token',
  
  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Logging configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_DIR: process.env.LOG_DIR || 'logs',
  ENABLE_FILE_LOGGING: process.env.ENABLE_FILE_LOGGING !== 'false',
  
  // CORS configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Feature flags
  ENABLE_RAG: process.env.ENABLE_RAG !== 'false',
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
  
  // Performance configuration
  MAX_CONCURRENT_REQUESTS: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 100,
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
  
  // Language support
  DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE || 'en',
  SUPPORTED_LANGUAGES: (process.env.SUPPORTED_LANGUAGES || 'en,es,ru').split(','),
  
  // API configuration
  API_VERSION: process.env.API_VERSION || 'v1',
  API_TIMEOUT: parseInt(process.env.API_TIMEOUT) || 5000,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
  RETRY_DELAY: parseInt(process.env.RETRY_DELAY) || 1000,
};

/**
 * Get database configuration
 * @returns {Object} Database configuration
 */
function getDatabaseConfig() {
  if (!config.MONGODB_URI) {
    return null;
  }
  
  return {
    uri: config.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    }
  };
}

/**
 * Get server configuration
 * @returns {Object} Server configuration
 */
function getServerConfig() {
  return {
    port: config.PORT,
    nodeEnv: config.NODE_ENV,
    apiPrefix: config.API_PREFIX,
    corsOrigin: config.CORS_ORIGIN,
    maxConcurrentRequests: config.MAX_CONCURRENT_REQUESTS,
    requestTimeout: config.REQUEST_TIMEOUT
  };
}

/**
 * Get logging configuration
 * @returns {Object} Logging configuration
 */
function getLoggingConfig() {
  return {
    level: config.LOG_LEVEL,
    dir: config.LOG_DIR,
    enableFileLogging: config.ENABLE_FILE_LOGGING
  };
}

// Export configuration and helper functions
module.exports = {
  ...config,
  getDatabaseConfig,
  getServerConfig,
  getLoggingConfig
};