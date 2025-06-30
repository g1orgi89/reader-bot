/**
 * Общие типы и константы для проекта "Читатель"
 * @file server/types/index.js
 */

// Импортируем типы для "Читателя"
require('./reader');

/**
 * Коды ошибок для обработки различных ситуаций
 * @type {Object}
 */
const ERROR_CODES = {
  // Общие ошибки
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Ошибки базы данных
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR: 'DATABASE_QUERY_ERROR',
  
  // Ошибки API Claude
  CLAUDE_API_ERROR: 'CLAUDE_API_ERROR',
  CLAUDE_RATE_LIMIT: 'CLAUDE_RATE_LIMIT',
  CLAUDE_INVALID_REQUEST: 'CLAUDE_INVALID_REQUEST',
  
  // Ошибки авторизации
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Ошибки векторной базы
  VECTOR_STORE_ERROR: 'VECTOR_STORE_ERROR',
  VECTOR_SEARCH_ERROR: 'VECTOR_SEARCH_ERROR',
  
  // Ошибки сервисов
  SERVICE_NOT_INITIALIZED: 'SERVICE_NOT_INITIALIZED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Ошибки "Читателя"
  QUOTE_NOT_FOUND: 'QUOTE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TEST_NOT_COMPLETED: 'TEST_NOT_COMPLETED',
  INVALID_QUOTE_FORMAT: 'INVALID_QUOTE_FORMAT',
  QUOTE_LIMIT_EXCEEDED: 'QUOTE_LIMIT_EXCEEDED',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  PROMO_CODE_INVALID: 'PROMO_CODE_INVALID',
  PROMO_CODE_EXPIRED: 'PROMO_CODE_EXPIRED'
};

/**
 * Статусы сообщений
 * @type {Object}
 */
const MESSAGE_STATUSES = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  EDITED: 'edited'
};

/**
 * Роли в системе сообщений
 * @type {Object}
 */
const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

/**
 * Статусы разговоров
 * @type {Object}
 */
const CONVERSATION_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived'
};

/**
 * Поддерживаемые языки
 * @type {Object}
 */
const SUPPORTED_LANGUAGES = {
  ENGLISH: 'en',
  SPANISH: 'es',
  RUSSIAN: 'ru'
};

/**
 * Источники сообщений/пользователей
 * @type {Object}
 */
const MESSAGE_SOURCES = {
  SOCKET: 'socket',
  API: 'api',
  TELEGRAM: 'telegram',
  EMAIL: 'email'
};

/**
 * Источники привлечения пользователей для "Читателя"
 * @type {Object}
 */
const USER_SOURCES = {
  INSTAGRAM: 'instagram',
  TELEGRAM: 'telegram',
  YOUTUBE: 'youtube',
  THREADS: 'threads',
  FRIENDS: 'friends',
  OTHER: 'other'
};

/**
 * Категории цитат
 * @type {Object}
 */
const QUOTE_CATEGORIES = {
  LOVE: 'love',
  SELF_DEVELOPMENT: 'self_development',
  PHILOSOPHY: 'philosophy',
  PSYCHOLOGY: 'psychology',
  SPIRITUALITY: 'spirituality',
  RELATIONSHIPS: 'relationships',
  WISDOM: 'wisdom',
  INSPIRATION: 'inspiration',
  LIFE: 'life',
  HAPPINESS: 'happiness',
  SUCCESS: 'success',
  CREATIVITY: 'creativity',
  HEALTH: 'health',
  WORK: 'work',
  FAMILY: 'family',
  FRIENDSHIP: 'friendship',
  TIME: 'time',
  MONEY: 'money',
  EDUCATION: 'education',
  TRAVEL: 'travel',
  ART: 'art',
  NATURE: 'nature',
  FREEDOM: 'freedom',
  PEACE: 'peace',
  HOPE: 'hope',
  FAITH: 'faith',
  COURAGE: 'courage',
  FEAR: 'fear',
  CHANGE: 'change',
  GOALS: 'goals',
  OTHER: 'other'
};

/**
 * Частота напоминаний
 * @type {Object}
 */
const REMINDER_FREQUENCIES = {
  DAILY: 'daily',
  EVERY_OTHER_DAY: 'every_other_day',
  TWICE_WEEKLY: 'twice_weekly',
  WEEKLY: 'weekly',
  DISABLED: 'disabled'
};

/**
 * Типы контента
 * @type {Object}
 */
const CONTENT_TYPES = {
  PROMPT: 'prompt',
  TEMPLATE: 'template',
  MESSAGE: 'message',
  BOOK_ANALYSIS: 'book_analysis',
  EMAIL_TEMPLATE: 'email_template'
};

/**
 * Типы отчетов
 * @type {Object}
 */
const REPORT_TYPES = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly'
};

/**
 * Типы действий для аналитики
 * @type {Object}
 */
const ANALYTICS_ACTIONS = {
  QUOTE_ADDED: 'quote_added',
  QUOTE_EDITED: 'quote_edited',
  QUOTE_DELETED: 'quote_deleted',
  LINK_CLICKED: 'link_clicked',
  PROMO_USED: 'promo_used',
  REPORT_VIEWED: 'report_viewed',
  TEST_STARTED: 'test_started',
  TEST_COMPLETED: 'test_completed',
  EMAIL_OPENED: 'email_opened',
  EMAIL_CLICKED: 'email_clicked',
  BOOK_PURCHASED: 'book_purchased',
  REMINDER_SENT: 'reminder_sent',
  FEEDBACK_GIVEN: 'feedback_given',
  USER_REGISTERED: 'user_registered',
  USER_ACTIVE: 'user_active',
  SEARCH_PERFORMED: 'search_performed',
  SETTINGS_CHANGED: 'settings_changed'
};

/**
 * Вопросы для вступительного теста
 * @type {Array<Object>}
 */
const TEST_QUESTIONS = [
  {
    number: 1,
    question: "Как вас зовут?",
    type: "text",
    required: true
  },
  {
    number: 2,
    question: "Расскажите о себе:",
    type: "choice",
    options: [
      "Я мама (дети - главная забота)",
      "Замужем, балансирую дом/работу/себя",
      "Без отношений, изучаю мир и себя"
    ],
    required: true
  },
  {
    number: 3,
    question: "Как находите время для себя?",
    type: "text",
    required: true
  },
  {
    number: 4,
    question: "Что сейчас важнее всего?",
    type: "text",
    required: true
  },
  {
    number: 5,
    question: "Что чувствуете, читая книги?",
    type: "text",
    required: true
  },
  {
    number: 6,
    question: "Какая фраза ближе?",
    type: "choice",
    options: [
      "Хочу понять себя и свои чувства",
      "Стремлюсь к внутренней гармонии",
      "Ищу практические решения проблем",
      "Хочу вдохновения и мотивации"
    ],
    required: true
  },
  {
    number: 7,
    question: "Сколько времени читаете в неделю?",
    type: "choice",
    options: [
      "Менее 1 часа",
      "1-3 часа",
      "3-5 часов",
      "Более 5 часов"
    ],
    required: true
  }
];

/**
 * @typedef {Object} ReaderError
 * @property {string} message - Сообщение об ошибке
 * @property {string} code - Код ошибки
 * @property {number} [statusCode] - HTTP статус код
 * @property {Object} [details] - Дополнительные детали ошибки
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} text - Текст сообщения
 * @property {string} role - Роль отправителя (user/assistant/system)
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {Object} [metadata] - Метаданные сообщения
 * @property {string} [metadata.language] - Язык сообщения
 * @property {number} [metadata.tokensUsed] - Количество токенов
 * @property {string} [metadata.source] - Источник сообщения
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} message - Ответное сообщение
 * @property {string} conversationId - ID разговора
 * @property {string} messageId - ID сообщения
 * @property {boolean} needsTicket - Нужно ли создавать тикет
 * @property {string} [ticketId] - ID созданного тикета
 * @property {string} [ticketError] - Ошибка создания тикета
 * @property {number} tokensUsed - Количество использованных токенов
 * @property {string} language - Язык ответа
 * @property {string} timestamp - Время создания ответа
 * @property {Object} metadata - Дополнительные метаданные
 */

/**
 * @typedef {Object} SocketMessageData
 * @property {string} message - Текст сообщения
 * @property {string} userId - ID пользователя
 * @property {string} [conversationId] - ID разговора (опционально)
 * @property {string} [language] - Язык сообщения (опционально)
 */

/**
 * @typedef {Object} VectorSearchOptions
 * @property {number} [limit] - Количество результатов
 * @property {string} [language] - Язык для фильтрации
 * @property {number} [scoreThreshold] - Минимальный порог релевантности
 * @property {Object} [filters] - Дополнительные фильтры
 */

/**
 * @typedef {Object} ServiceHealthCheck
 * @property {string} status - Статус сервиса (ok/error)
 * @property {string} message - Сообщение о состоянии
 * @property {Object} [details] - Дополнительные детали
 * @property {string} [error] - Сообщение об ошибке
 */

/**
 * @typedef {Object} ConfigFeatures
 * @property {boolean} enableRAG - Включен ли RAG
 * @property {boolean} enableAnalytics - Включена ли аналитика
 * @property {boolean} enableCaching - Включено ли кеширование
 * @property {boolean} enableTelegram - Включен ли Telegram бот
 * @property {boolean} enableHealthChecks - Включены ли проверки здоровья
 * @property {boolean} enableMetrics - Включены ли метрики
 * @property {boolean} enableEmailReports - Включены ли email отчеты
 * @property {boolean} enableReminders - Включены ли напоминания
 * @property {boolean} enableBookRecommendations - Включены ли рекомендации книг
 */

/**
 * @typedef {Object} DatabaseStats
 * @property {number} collections - Количество коллекций
 * @property {number} objects - Количество объектов
 * @property {string} dataSize - Размер данных
 * @property {string} storageSize - Размер хранилища
 * @property {number} indexes - Количество индексов
 * @property {string} indexSize - Размер индексов
 */

/**
 * @typedef {Object} ReaderStats
 * @property {number} totalUsers - Общее количество пользователей
 * @property {number} activeUsers - Активные пользователи
 * @property {number} totalQuotes - Общее количество цитат
 * @property {number} quotesToday - Цитат добавлено сегодня
 * @property {number} reportsGenerated - Сгенерировано отчетов
 * @property {number} emailsSent - Отправлено email
 * @property {Object} topCategories - Популярные категории цитат
 * @property {Object} usersBySource - Пользователи по источникам
 * @property {number} averageQuotesPerUser - Среднее количество цитат на пользователя
 * @property {number} retentionRate - Показатель удержания пользователей
 */

module.exports = {
  ERROR_CODES,
  MESSAGE_STATUSES,
  MESSAGE_ROLES,
  CONVERSATION_STATUSES,
  SUPPORTED_LANGUAGES,
  MESSAGE_SOURCES,
  USER_SOURCES,
  QUOTE_CATEGORIES,
  REMINDER_FREQUENCIES,
  CONTENT_TYPES,
  REPORT_TYPES,
  ANALYTICS_ACTIONS,
  TEST_QUESTIONS
};