/**
 * @file Configuration for VectorStore service
 * @description Конфигурация векторной базы знаний для проекта Shrooms
 */

/**
 * @import {VectorStoreOptions} from '../types/index.js'
 */

/**
 * @typedef {Object} VectorStoreConfig
 * @property {VectorStoreOptions} development - Настройки для разработки
 * @property {VectorStoreOptions} production - Настройки для продакшена
 * @property {Object} defaultOptions - Опции по умолчанию
 */

/**
 * Конфигурация по умолчанию для VectorStore
 * @type {VectorStoreConfig}
 */
const vectorStoreConfig = {
  development: {
    url: process.env.VECTOR_DB_URL || 'http://localhost:6333',
    collectionName: 'shrooms_knowledge_dev',
    embeddingProvider: {
      provider: process.env.EMBEDDING_PROVIDER || 'voyage',
      model: process.env.EMBEDDING_MODEL || 'voyage-2',
      apiKey: process.env.VOYAGE_API_KEY || process.env.OPENAI_API_KEY,
      apiUrl: process.env.EMBEDDING_API_URL
    },
    dimensions: 1024,
    metric: 'cosine'
  },
  
  production: {
    url: process.env.VECTOR_DB_URL || 'http://qdrant:6333',
    collectionName: 'shrooms_knowledge',
    embeddingProvider: {
      provider: process.env.EMBEDDING_PROVIDER || 'voyage',
      model: process.env.EMBEDDING_MODEL || 'voyage-2',
      apiKey: process.env.VOYAGE_API_KEY || process.env.OPENAI_API_KEY,
      apiUrl: process.env.EMBEDDING_API_URL
    },
    dimensions: 1024,
    metric: 'cosine'
  },
  
  defaultOptions: {
    // Опции для search
    searchDefaults: {
      limit: 10,
      threshold: 0.7,
      includeMetadata: true
    },
    
    // Опции для chunking
    chunkingOptions: {
      chunkSize: 800,
      chunkOverlap: 200,
      useBoundaryDetection: true,
      preserveCodeBlocks: true
    },
    
    // Опции для contextual embeddings
    contextualEmbeddings: {
      enabled: true,
      contextPrompt: `
        Пожалуйста, дайте краткое объясняющее описание следующей части документа. 
        Это описание будет использоваться для улучшения поиска, поэтому включите 
        ключевые понятия и контекст, который может быть не очевиден в изолированном 
        тексте. Не добавляйте никаких преамбул и отвечайте только кратким описанием.
        
        Документ:
        {{document}}
        
        Часть документа:
        {{chunk}}
        
        Описание:`,
      maxContextTokens: 100,
      usePromptCaching: true
    },
    
    // Опции кэширования
    cache: {
      maxSize: 1000,
      ttl: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
      cleanupInterval: 60 * 60 * 1000 // Очистка каждый час
    },
    
    // Опции для batch операций
    batchProcessing: {
      batchSize: 100,
      concurrentBatches: 3,
      retryAttempts: 3,
      retryDelay: 1000
    }
  }
};

/**
 * Получение конфигурации для текущего окружения
 * @param {string} [environment] - Окружение (development/production)
 * @returns {VectorStoreOptions}
 */
function getVectorStoreConfig(environment) {
  const env = environment || process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    return vectorStoreConfig.production;
  }
  
  return vectorStoreConfig.development;
}

/**
 * Валидация конфигурации VectorStore
 * @param {VectorStoreOptions} config - Конфигурация для проверки
 * @returns {Object} Результат валидации
 */
function validateVectorStoreConfig(config) {
  const errors = [];
  
  if (!config.url) {
    errors.push('VECTOR_DB_URL is required');
  }
  
  if (!config.embeddingProvider.apiKey) {
    errors.push('Embedding provider API key is required');
  }
  
  if (!['voyage', 'openai'].includes(config.embeddingProvider.provider)) {
    errors.push('Unsupported embedding provider');
  }
  
  if (config.dimensions && (config.dimensions < 1 || config.dimensions > 4096)) {
    errors.push('Invalid dimensions value');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Получение всех доступных провайдеров embeddings
 * @returns {Object} Список провайдеров с их моделями
 */
function getAvailableProviders() {
  return {
    voyage: {
      models: [
        'voyage-2',
        'voyage-large-2',
        'voyage-code-2',
        'voyage-law-2',
        'voyage-finance-2'
      ],
      dimensions: {
        'voyage-2': 1024,
        'voyage-large-2': 1536,
        'voyage-code-2': 1024,
        'voyage-law-2': 1024,
        'voyage-finance-2': 1024
      }
    },
    openai: {
      models: [
        'text-embedding-ada-002',
        'text-embedding-3-small',
        'text-embedding-3-large'
      ],
      dimensions: {
        'text-embedding-ada-002': 1536,
        'text-embedding-3-small': 1536,
        'text-embedding-3-large': 3072
      }
    }
  };
}

module.exports = {
  vectorStoreConfig,
  getVectorStoreConfig,
  validateVectorStoreConfig,
  getAvailableProviders
};