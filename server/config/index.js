/**
 * Main configuration file for the Shrooms Support Bot
 * @fileoverview Contains all configuration settings and environment variables
 * Adapted from anthropic-cookbook best practices
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

/**
 * Environment configuration
 * @readonly
 * @enum {string}
 */
export const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Server configuration
 * @readonly
 * @type {Object}
 * @property {number} PORT - Server port
 * @property {string} CORS_ORIGIN - CORS origin setting
 */
export const SERVER_CONFIG = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

/**
 * Database configuration
 * @readonly
 * @type {Object}
 * @property {string} MONGODB_URI - MongoDB connection string
 * @property {string} MONGODB_DB_NAME - Database name
 */
export const DATABASE_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'shrooms-support',
};

/**
 * Claude AI configuration following anthropic-cookbook patterns
 * @readonly
 * @type {Object}
 * @property {string} API_KEY - Anthropic API key
 * @property {string} MODEL - Default Claude model to use
 * @property {number} MAX_TOKENS - Default max tokens for responses
 * @property {number} TEMPERATURE - Default temperature for generation
 * @property {number} TIMEOUT - Request timeout in milliseconds
 */
export const CLAUDE_CONFIG = {
  API_KEY: process.env.ANTHROPIC_API_KEY,
  MODEL: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
  MAX_TOKENS: parseInt(process.env.MAX_TOKENS, 10) || 1000,
  TEMPERATURE: parseFloat(process.env.TEMPERATURE) || 0.7,
  TIMEOUT: parseInt(process.env.CLAUDE_TIMEOUT, 10) || 30000,
};

/**
 * Vector database configuration (Qdrant)
 * @readonly
 * @type {Object}
 * @property {string} TYPE - Vector database type
 * @property {string} URL - Vector database URL
 * @property {string} COLLECTION_NAME - Collection name for knowledge base
 * @property {number} DIMENSION - Vector dimension
 */
export const VECTOR_DB_CONFIG = {
  TYPE: process.env.VECTOR_DB_TYPE || 'qdrant',
  URL: process.env.VECTOR_DB_URL || 'http://localhost:6333',
  COLLECTION_NAME: process.env.VECTOR_COLLECTION_NAME || 'shrooms_knowledge',
  DIMENSION: parseInt(process.env.VECTOR_DIMENSION, 10) || 1536,
};

/**
 * OpenAI configuration for embeddings
 * @readonly
 * @type {Object}
 * @property {string} API_KEY - OpenAI API key
 * @property {string} EMBEDDING_MODEL - Embedding model to use
 */
export const OPENAI_CONFIG = {
  API_KEY: process.env.OPENAI_API_KEY,
  EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
};

/**
 * Telegram bot configuration
 * @readonly
 * @type {Object}
 * @property {string} BOT_TOKEN - Telegram bot token
 * @property {string} WEBHOOK_URL - Webhook URL for production
 */
export const TELEGRAM_CONFIG = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL,
};

/**
 * Logging configuration
 * @readonly
 * @type {Object}
 * @property {string} LEVEL - Log level (debug, info, warn, error)
 * @property {boolean} TO_FILE - Whether to log to file
 * @property {string} FILE_PATH - Log file path
 */
export const LOG_CONFIG = {
  LEVEL: process.env.LOG_LEVEL || 'info',
  TO_FILE: process.env.LOG_TO_FILE === 'true',
  FILE_PATH: process.env.LOG_FILE_PATH || './logs/app.log',
};

/**
 * Security configuration
 * @readonly
 * @type {Object}
 * @property {string} JWT_SECRET - JWT secret for authentication
 * @property {string} ADMIN_PASSWORD - Admin panel password
 * @property {number} BCRYPT_ROUNDS - Bcrypt salt rounds
 */
export const SECURITY_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
};

/**
 * Rate limiting configuration
 * @readonly
 * @type {Object}
 * @property {number} WINDOW_MS - Time window in milliseconds
 * @property {number} MAX_REQUESTS - Max requests per window
 */
export const RATE_LIMIT_CONFIG = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
};

/**
 * Knowledge base configuration following anthropic-cookbook patterns
 * @readonly
 * @type {Object}
 * @property {number} CHUNK_SIZE - Size of text chunks
 * @property {number} CHUNK_OVERLAP - Overlap between chunks
 * @property {number} RETRIEVAL_K - Default number of documents to retrieve
 * @property {number} RERANK_K - Number of documents after reranking
 * @property {boolean} USE_RERANKING - Whether to use reranking by default
 * @property {boolean} INCLUDE_SUMMARIES - Whether to include document summaries
 */
export const KNOWLEDGE_BASE_CONFIG = {
  CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE, 10) || 1000,
  CHUNK_OVERLAP: parseInt(process.env.CHUNK_OVERLAP, 10) || 200,
  RETRIEVAL_K: parseInt(process.env.RETRIEVAL_K, 10) || 5,
  RERANK_K: parseInt(process.env.RERANK_K, 10) || 3,
  USE_RERANKING: process.env.USE_RERANKING === 'true',
  INCLUDE_SUMMARIES: process.env.INCLUDE_SUMMARIES === 'true',
};

/**
 * Shrooms-specific configuration
 * @readonly
 * @type {Object}
 * @property {string[]} SUPPORTED_LANGUAGES - Supported languages
 * @property {string} DEFAULT_LANGUAGE - Default language
 * @property {number} TICKET_ID_LENGTH - Length of ticket IDs
 * @property {string} TICKET_PREFIX - Prefix for ticket IDs
 */
export const SHROOMS_CONFIG = {
  SUPPORTED_LANGUAGES: ['en', 'es', 'ru'],
  DEFAULT_LANGUAGE: 'en',
  TICKET_ID_LENGTH: 8,
  TICKET_PREFIX: 'SHR',
};

/**
 * Validates that all required environment variables are present
 * @function validateConfig
 * @throws {Error} If required environment variables are missing
 */
export function validateConfig() {
  const requiredVars = [
    'ANTHROPIC_API_KEY',
    'MONGODB_URI',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

/**
 * Gets configuration for a specific module
 * @function getModuleConfig
 * @param {string} module - Module name
 * @returns {Object} Module configuration
 */
export function getModuleConfig(module) {
  const configs = {
    server: SERVER_CONFIG,
    database: DATABASE_CONFIG,
    claude: CLAUDE_CONFIG,
    vector: VECTOR_DB_CONFIG,
    openai: OPENAI_CONFIG,
    telegram: TELEGRAM_CONFIG,
    logging: LOG_CONFIG,
    security: SECURITY_CONFIG,
    rateLimit: RATE_LIMIT_CONFIG,
    knowledgeBase: KNOWLEDGE_BASE_CONFIG,
    shrooms: SHROOMS_CONFIG,
  };

  return configs[module] || {};
}

// Validate configuration on import
if (NODE_ENV !== 'test') {
  validateConfig();
}
