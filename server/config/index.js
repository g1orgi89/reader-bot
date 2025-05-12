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

  // Database configuration
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support',
  
  // Anthropic/Claude configuration
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
  CLAUDE_MAX_TOKENS: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
  CLAUDE_TEMPERATURE: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7,
  
  // Vector database configuration
  VECTOR_DB_URL: process.env.VECTOR_DB_URL || 'http://localhost:6333',
  VECTOR_COLLECTION_NAME: process.env.VECTOR_COLLECTION_NAME || 'shrooms_knowledge',
  
  // Embedding configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY, // For embeddings
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
  
  // Security configuration
  JWT_SECRET: process.env.JWT_SECRET || 'shrooms-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  API_KEYS: process.env.API_KEYS ? process.env.API_KEYS.split(',') : [],
  
  // Telegram Bot configuration
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL,
  
  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Logging configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_DIR: process.env.LOG_DIR || 'logs',
  ENABLE_FILE_LOGGING: process.env.ENABLE_FILE_LOGGING !== 'false',
  
  // CORS configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Session configuration
  SESSION_SECRET: process.env.SESSION_SECRET || 'shrooms-session-secret',
  SESSION_COOKIE_MAX_AGE: parseInt(process.env.SESSION_COOKIE_MAX_AGE) || 86400000, // 24 hours
  
  // File upload configuration
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  
  // External services
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'shrooms-webhook-secret',
  
  // Feature flags
  ENABLE_RAG: process.env.ENABLE_RAG !== 'false',
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
  ENABLE_CACHING: process.env.ENABLE_CACHING !== 'false',
  
  // Cache configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
  
  // Metrics and monitoring
  ENABLE_METRICS: process.env.ENABLE_METRICS !== 'false',
  METRICS_PORT: process.env.METRICS_PORT || 9090,
  
  // Backup configuration
  BACKUP_SCHEDULE: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
  
  // Performance configuration
  MAX_CONCURRENT_REQUESTS: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 100,
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 30000, // 30 seconds
  
  // Development configuration
  ENABLE_HOT_RELOAD: process.env.ENABLE_HOT_RELOAD === 'true',
  ENABLE_DEBUG_MODE: process.env.ENABLE_DEBUG_MODE === 'true',
  
  // Health check configuration
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000, // 1 minute
  
  // Shrooms-specific configuration
  SHROOMS_FARMING_YIELD: parseFloat(process.env.SHROOMS_FARMING_YIELD) || 12.5,
  SHROOMS_CONTRACT_ADDRESS: process.env.SHROOMS_CONTRACT_ADDRESS,
  STACKS_RPC_URL: process.env.STACKS_RPC_URL || 'https://stacks-node-api.mainnet.stacks.co',
  
  // Widget configuration
  WIDGET_BASE_URL: process.env.WIDGET_BASE_URL || 'http://localhost:3000',
  WIDGET_THEME: process.env.WIDGET_THEME || 'dark',
  
  // Notification configuration
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  
  // Language support
  DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE || 'en',
  SUPPORTED_LANGUAGES: (process.env.SUPPORTED_LANGUAGES || 'en,es,ru').split(','),
  
  // API versioning
  API_VERSION: process.env.API_VERSION || 'v1',
  
  // Timeouts and retries
  API_TIMEOUT: parseInt(process.env.API_TIMEOUT) || 5000,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
  RETRY_DELAY: parseInt(process.env.RETRY_DELAY) || 1000,
};

/**
 * Validate required configuration
 */
function validateConfig() {
  const requiredFields = [
    'ANTHROPIC_API_KEY',
    'MONGODB_URI'
  ];
  
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
  }
  
  // Validate specific formats
  if (config.CLAUDE_TEMPERATURE < 0 || config.CLAUDE_TEMPERATURE > 1) {
    throw new Error('CLAUDE_TEMPERATURE must be between 0 and 1');
  }
  
  if (config.CLAUDE_MAX_TOKENS < 1 || config.CLAUDE_MAX_TOKENS > 4096) {
    throw new Error('CLAUDE_MAX_TOKENS must be between 1 and 4096');
  }
}

/**
 * Get database configuration
 * @returns {Object} Database configuration
 */
function getDatabaseConfig() {
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
 * Get Claude configuration
 * @returns {Object} Claude configuration
 */
function getClaudeConfig() {
  return {
    apiKey: config.ANTHROPIC_API_KEY,
    model: config.CLAUDE_MODEL,
    maxTokens: config.CLAUDE_MAX_TOKENS,
    temperature: config.CLAUDE_TEMPERATURE,
    enableRAG: config.ENABLE_RAG
  };
}

/**
 * Get vector database configuration
 * @returns {Object} Vector database configuration
 */
function getVectorDBConfig() {
  return {
    url: config.VECTOR_DB_URL,
    collectionName: config.VECTOR_COLLECTION_NAME,
    embeddingModel: config.EMBEDDING_MODEL,
    openaiApiKey: config.OPENAI_API_KEY
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
 * Get security configuration
 * @returns {Object} Security configuration
 */
function getSecurityConfig() {
  return {
    jwtSecret: config.JWT_SECRET,
    jwtExpiresIn: config.JWT_EXPIRES_IN,
    adminUsername: config.ADMIN_USERNAME,
    adminPassword: config.ADMIN_PASSWORD,
    apiKeys: config.API_KEYS,
    sessionSecret: config.SESSION_SECRET,
    sessionCookieMaxAge: config.SESSION_COOKIE_MAX_AGE,
    webhookSecret: config.WEBHOOK_SECRET
  };
}

/**
 * Get rate limiting configuration
 * @returns {Object} Rate limiting configuration
 */
function getRateLimitConfig() {
  return {
    windowMs: config.RATE_LIMIT_WINDOW,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false
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

/**
 * Get VectorStore configuration 
 * @returns {Object} VectorStore configuration
 */
function getVectorStoreConfig() {
  return {
    url: config.VECTOR_DB_URL,
    collectionName: config.VECTOR_COLLECTION_NAME,
    embeddingModel: config.EMBEDDING_MODEL,
    embeddingApiKey: config.OPENAI_API_KEY
  };
}

// Validate configuration on load
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

// Export configuration and helper functions
module.exports = {
  ...config,
  validateConfig,
  getDatabaseConfig,
  getClaudeConfig,
  getVectorDBConfig,
  getVectorStoreConfig,
  getServerConfig,
  getSecurityConfig,
  getRateLimitConfig,
  getLoggingConfig
};
