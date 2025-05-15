/**
 * Общие типы и константы для проекта Shrooms Support Bot
 * @file server/types/index.js
 */

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
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
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
 * Статусы тикетов
 * @type {Object}
 */
const TICKET_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING_RESPONSE: 'waiting_response',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

/**
 * Приоритеты тикетов
 * @type {Object}
 */
const TICKET_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

/**
 * Категории тикетов
 * @type {Object}
 */
const TICKET_CATEGORIES = {
  TECHNICAL: 'technical',
  ACCOUNT: 'account',
  BILLING: 'billing',
  FEATURE: 'feature',
  BUG: 'bug',
  WALLET: 'wallet',
  STAKING: 'staking',
  FARMING: 'farming',
  OTHER: 'other'
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
 * Источники сообщений/тикетов
 * @type {Object}
 */
const MESSAGE_SOURCES = {
  SOCKET: 'socket',
  API: 'api',
  TELEGRAM: 'telegram',
  EMAIL: 'email'
};

/**
 * @typedef {Object} ShroomsError
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
 * @typedef {Object} TicketData
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {string} message - Исходное сообщение
 * @property {string} [context] - Контекст разговора
 * @property {string} [language] - Язык обращения
 * @property {string} [subject] - Тема тикета
 * @property {string} [category] - Категория тикета
 * @property {string} [priority] - Приоритет тикета
 * @property {string} [email] - Email пользователя
 * @property {string} [source] - Источник тикета
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

module.exports = {
  ERROR_CODES,
  MESSAGE_STATUSES,
  MESSAGE_ROLES,
  CONVERSATION_STATUSES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  SUPPORTED_LANGUAGES,
  MESSAGE_SOURCES
};