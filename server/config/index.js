/**
 * Централизованная конфигурация приложения
 * @file server/config/index.js
 */

require('dotenv').config();

/**
 * @typedef {Object} AppConfig
 * @property {Object} app - Настройки приложения
 * @property {Object} database - Настройки базы данных
 * @property {Object} claude - Настройки Claude API
 * @property {Object} vectorStore - Настройки векторной базы
 * @property {Object} security - Настройки безопасности
 * @property {Object} logging - Настройки логирования
 * @property {Object} cors - Настройки CORS
 * @property {Object} features - Флаги функций
 */

// Валидация обязательных переменных окружения
const requiredEnvVars = [
  'MONGODB_URI',
  'ANTHROPIC_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env file or environment configuration');
}

/**
 * @type {AppConfig}
 */
const config = {
  // Настройки приложения
  app: {
    name: 'Shrooms Support Bot',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3000,
    apiPrefix: process.env.API_PREFIX || '/api',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    maxRequestsPerSecond: parseInt(process.env.MAX_REQUESTS_PER_SECOND) || 10,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000
  },

  // Настройки базы данных
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 10000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 1,
      maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,
      bufferMaxEntries: 0,
      bufferCommands: false
    },
    maxReconnectAttempts: parseInt(process.env.DB_MAX_RECONNECT_ATTEMPTS) || 5,
    reconnectDelay: parseInt(process.env.DB_RECONNECT_DELAY) || 1000
  },

  // Настройки Claude API
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7,
    apiUrl: process.env.CLAUDE_API_URL || 'https://api.anthropic.com',
    timeout: parseInt(process.env.CLAUDE_TIMEOUT) || 30000,
    maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.CLAUDE_RETRY_DELAY) || 1000
  },

  // Настройки векторной базы данных
  vectorStore: {
    url: process.env.VECTOR_DB_URL || 'http://localhost:6333',
    collectionName: process.env.VECTOR_COLLECTION_NAME || 'shrooms_knowledge',
    timeout: parseInt(process.env.VECTOR_DB_TIMEOUT) || 10000,
    batchSize: parseInt(process.env.VECTOR_BATCH_SIZE) || 100,
    searchLimit: parseInt(process.env.VECTOR_SEARCH_LIMIT) || 5
  },

  // Настройки OpenAI (для эмбеддингов)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000
  },

  // Настройки безопасности
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'password123',
    adminToken: process.env.ADMIN_TOKEN || 'default-admin-token',
    apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : ['api-key-1'],
    sessionSecret: process.env.SESSION_SECRET || 'session-secret',
    cookieMaxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE) || 86400000 // 24 часа
  },

  // Настройки CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
  },

  // Настройки логирования
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
    enableConsoleColors: process.env.LOG_COLORS !== 'false',
    maxFileSize: process.env.LOG_MAX_FILE_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    enableHttpLogging: process.env.ENABLE_HTTP_LOGGING !== 'false'
  },

  // Настройки ограничения скорости
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 минут
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
  },

  // Настройки файлов
  files: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    allowedMimeTypes: [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/json'
    ]
  },

  // Настройки локализации
  i18n: {
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
    supportedLanguages: process.env.SUPPORTED_LANGUAGES 
      ? process.env.SUPPORTED_LANGUAGES.split(',') 
      : ['en', 'es', 'ru']
  },

  // Флаги функций
  features: {
    enableRAG: process.env.ENABLE_RAG !== 'false',
    enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
    enableCaching: process.env.ENABLE_CACHING === 'true',
    enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableTelegram: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== ''
  },

  // Настройки Telegram бота
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    polling: process.env.TELEGRAM_POLLING === 'true',
    timeout: parseInt(process.env.TELEGRAM_TIMEOUT) || 10000
  },

  // Настройки Redis (для кеширования)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 час
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY) || 1000
  },

  // Настройки email
  email: {
    from: process.env.EMAIL_FROM || 'noreply@shrooms.io',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  },

  // Настройки для Shrooms проекта
  shrooms: {
    farmingYield: parseFloat(process.env.SHROOMS_FARMING_YIELD) || 12.5,
    contractAddress: process.env.SHROOMS_CONTRACT_ADDRESS,
    stacksRpcUrl: process.env.STACKS_RPC_URL || 'https://stacks-node-api.mainnet.stacks.co',
    widgetBaseUrl: process.env.WIDGET_BASE_URL || 'http://localhost:3000',
    theme: process.env.WIDGET_THEME || 'dark'
  },

  // Настройки производительности
  performance: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 100,
    cacheTTL: parseInt(process.env.CACHE_TTL) || 3600,
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    enableEtag: process.env.ENABLE_ETAG !== 'false'
  },

  // Настройки мониторинга
  monitoring: {
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000,
    enableUptime: process.env.ENABLE_UPTIME_MONITORING === 'true',
    metricsPath: process.env.METRICS_PATH || '/metrics'
  }
};

// Функция для валидации конфигурации
function validateConfig() {
  const errors = [];

  // Проверяем обязательные настройки
  if (!config.claude.apiKey) {
    errors.push('ANTHROPIC_API_KEY is required');
  }

  if (!config.database.uri) {
    errors.push('MONGODB_URI is required');
  }

  // Валидация численных значений
  if (config.app.port < 1 || config.app.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (config.claude.maxTokens < 1 || config.claude.maxTokens > 8000) {
    errors.push('CLAUDE_MAX_TOKENS must be between 1 and 8000');
  }

  if (config.claude.temperature < 0 || config.claude.temperature > 1) {
    errors.push('CLAUDE_TEMPERATURE must be between 0 and 1');
  }

  // Валидация языков
  const validLanguages = ['en', 'es', 'ru'];
  const invalidLanguages = config.i18n.supportedLanguages.filter(
    lang => !validLanguages.includes(lang)
  );
  if (invalidLanguages.length > 0) {
    errors.push(`Invalid languages in SUPPORTED_LANGUAGES: ${invalidLanguages.join(', ')}`);
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    if (config.app.isProduction) {
      throw new Error('Invalid configuration in production environment');
    }
  }

  return errors.length === 0;
}

// Функция для получения настроек по категории
function getConfig(category = null) {
  if (category) {
    return config[category] || null;
  }
  return config;
}

// Функция для обновления конфигурации (для тестов)
function updateConfig(category, updates) {
  if (config[category]) {
    Object.assign(config[category], updates);
  }
}

// Проверяем конфигурацию при загрузке модуля
validateConfig();

module.exports = {
  config,
  getConfig,
  updateConfig,
  validateConfig
};