/**
 * @file Конфигурация embeddings для разных провайдеров
 * @description Типизированные конфигурации для различных провайдеров embeddings
 */

/**
 * @typedef {import('../types').EmbeddingConfig} EmbeddingConfig
 * @typedef {import('../types').EmbeddingOptions} EmbeddingOptions
 */

/**
 * Конфигурации провайдеров embeddings
 * @type {Object<string, EmbeddingConfig>}
 */
const EMBEDDING_PROVIDERS = {
  openai: {
    provider: 'openai',
    model: 'text-embedding-ada-002',
    dimensions: 1536,
    apiKey: process.env.OPENAI_API_KEY,
    options: {
      maxTokens: 8192,
      normalize: true,
      inputType: 'search_document'
    }
  },
  
  voyage: {
    provider: 'voyage',
    model: 'voyage-large-2-instruct',
    dimensions: 1024,
    apiKey: process.env.VOYAGE_API_KEY,
    options: {
      maxTokens: 16000,
      normalize: true,
      inputType: 'document'
    }
  },
  
  cohere: {
    provider: 'cohere',
    model: 'embed-multilingual-v3.0',
    dimensions: 1024,
    apiKey: process.env.COHERE_API_KEY,
    options: {
      maxTokens: 512,
      normalize: true,
      inputType: 'search_document'
    }
  }
};

/**
 * Специфичные опции для языков
 * @type {Object<string, EmbeddingOptions>}
 */
const LANGUAGE_SPECIFIC_OPTIONS = {
  en: {
    inputType: 'search_document',
    language: 'en'
  },
  
  ru: {
    inputType: 'search_document',
    language: 'ru',
    customOptions: {
      // Для русского языка может потребоваться специальная обработка
      preprocessText: true
    }
  },
  
  es: {
    inputType: 'search_document',
    language: 'es'
  }
};

/**
 * Получение конфигурации embeddings
 * @param {string} [provider] - Провайдер embeddings
 * @param {string} [language] - Язык для специфичных настроек
 * @returns {EmbeddingConfig} Конфигурация embeddings
 */
function getEmbeddingConfig(provider, language = 'en') {
  // Определение провайдера по доступным API ключам
  if (!provider) {
    if (process.env.VOYAGE_API_KEY) {
      provider = 'voyage';
    } else if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
    } else if (process.env.COHERE_API_KEY) {
      provider = 'cohere';
    } else {
      throw new Error('No embedding provider API key found');
    }
  }
  
  const config = EMBEDDING_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown embedding provider: ${provider}`);
  }
  
  if (!config.apiKey) {
    throw new Error(`API key not found for provider: ${provider}`);
  }
  
  // Слияние с языковыми опциями
  const languageOptions = LANGUAGE_SPECIFIC_OPTIONS[language] || {};
  const mergedOptions = {
    ...config.options,
    ...languageOptions
  };
  
  return {
    ...config,
    options: mergedOptions
  };
}

/**
 * Получение всех доступных провайдеров
 * @returns {string[]} Массив доступных провайдеров
 */
function getAvailableProviders() {
  return Object.keys(EMBEDDING_PROVIDERS).filter(provider => {
    const config = EMBEDDING_PROVIDERS[provider];
    return config.apiKey && config.apiKey.length > 0;
  });
}

/**
 * Проверка совместимости провайдера с языком
 * @param {string} provider - Провайдер
 * @param {string} language - Язык
 * @returns {boolean} Совместимость
 */
function isProviderCompatibleWithLanguage(provider, language) {
  const config = EMBEDDING_PROVIDERS[provider];
  if (!config) return false;
  
  // Cohere хорошо работает с многими языками
  if (provider === 'cohere') return true;
  
  // OpenAI поддерживает все основные языки
  if (provider === 'openai') return true;
  
  // Voyage лучше всего работает с английским
  if (provider === 'voyage') return language === 'en';
  
  return true;
}

/**
 * Получение оптимального провайдера для языка
 * @param {string} language - Язык
 * @returns {string} Оптимальный провайдер
 */
function getOptimalProviderForLanguage(language) {
  const available = getAvailableProviders();
  
  // Приоритеты провайдеров для разных языков
  const priorities = {
    en: ['voyage', 'openai', 'cohere'],
    ru: ['cohere', 'openai', 'voyage'],
    es: ['cohere', 'openai', 'voyage']
  };
  
  const languagePriorities = priorities[language] || priorities.en;
  
  for (const provider of languagePriorities) {
    if (available.includes(provider)) {
      return provider;
    }
  }
  
  // Возвращаем первый доступный
  return available[0];
}

/**
 * Валидация конфигурации embeddings
 * @param {EmbeddingConfig} config - Конфигурация для валидации
 * @returns {boolean} Результат валидации
 * @throws {Error} Ошибка валидации
 */
function validateEmbeddingConfig(config) {
  if (!config.provider) {
    throw new Error('Provider is required');
  }
  
  if (!config.model) {
    throw new Error('Model is required');
  }
  
  if (!config.apiKey) {
    throw new Error('API key is required');
  }
  
  if (!config.dimensions || config.dimensions <= 0) {
    throw new Error('Valid dimensions required');
  }
  
  return true;
}

module.exports = {
  EMBEDDING_PROVIDERS,
  LANGUAGE_SPECIFIC_OPTIONS,
  getEmbeddingConfig,
  getAvailableProviders,
  isProviderCompatibleWithLanguage,
  getOptimalProviderForLanguage,
  validateEmbeddingConfig
};