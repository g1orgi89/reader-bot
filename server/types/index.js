/**
 * Общие типы для проекта Shrooms Support Bot
 * @file server/types/index.js
 */

/**
 * @typedef {Object} ShroomsError
 * @property {number} statusCode - HTTP статус код
 * @property {string} message - Сообщение об ошибке
 * @property {string} code - Код ошибки
 * @property {Object} [details] - Дополнительные детали
 */

/**
 * @typedef {Object} User
 * @property {string} userId - Уникальный ID пользователя
 * @property {string} [email] - Email пользователя
 * @property {string} language - Предпочитаемый язык (en, es, ru)
 * @property {Date} firstSeenAt - Время первого посещения
 * @property {Date} lastActiveAt - Время последней активности
 * @property {Object} metadata - Дополнительные метаданные
 */

/**
 * @typedef {Object} Message
 * @property {string} _id - ID сообщения
 * @property {string} text - Текст сообщения
 * @property {'user'|'assistant'|'system'} role - Роль отправителя
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {Object} metadata - Метаданные сообщения
 * @property {string} metadata.language - Язык сообщения
 * @property {number} [metadata.tokensUsed] - Использованные токены
 * @property {boolean} [metadata.ticketCreated] - Создан ли тикет
 * @property {string} [metadata.ticketId] - ID тикета
 * @property {string} [metadata.source] - Источник сообщения
 * @property {Date} createdAt - Время создания
 */

/**
 * @typedef {Object} Conversation
 * @property {string} _id - ID разговора
 * @property {string} userId - ID пользователя
 * @property {string} language - Язык разговора
 * @property {Date} startedAt - Время начала
 * @property {Date} lastActivityAt - Время последней активности
 * @property {Object} metadata - Метаданные разговора
 * @property {'active'|'completed'|'archived'} status - Статус разговора
 */

/**
 * @typedef {Object} Ticket
 * @property {string} _id - ID документа
 * @property {string} ticketId - Публичный ID тикета
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {'open'|'in_progress'|'resolved'|'closed'} status - Статус тикета
 * @property {'low'|'medium'|'high'|'urgent'} priority - Приоритет
 * @property {'technical'|'account'|'billing'|'feature'|'other'} category - Категория
 * @property {string} subject - Тема тикета
 * @property {string} initialMessage - Первоначальное сообщение
 * @property {string} [context] - Контекст для команды поддержки
 * @property {string} [email] - Email для связи
 * @property {string} [assignedTo] - Назначен на
 * @property {string} [resolution] - Решение
 * @property {string} language - Язык тикета
 * @property {Date} createdAt - Время создания
 * @property {Date} updatedAt - Время обновления
 * @property {Date} [resolvedAt] - Время решения
 */

/**
 * @typedef {Object} KnowledgeDocument
 * @property {string} _id - ID документа
 * @property {string} title - Заголовок документа
 * @property {string} content - Содержимое документа
 * @property {string} category - Категория документа
 * @property {string[]} tags - Теги документа
 * @property {string} language - Язык документа (en, es, ru)
 * @property {string} vectorId - ID в векторной базе
 * @property {string} [authorId] - ID автора
 * @property {'draft'|'published'|'archived'} status - Статус документа
 * @property {Date} createdAt - Время создания
 * @property {Date} updatedAt - Время обновления
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} message - Текст сообщения
 * @property {string} userId - ID пользователя
 * @property {string} [conversationId] - ID разговора (опционально)
 * @property {string} [language] - Язык сообщения (опционально)
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} message - Ответное сообщение
 * @property {string} conversationId - ID разговора
 * @property {string} messageId - ID созданного сообщения
 * @property {boolean} needsTicket - Требуется ли создание тикета
 * @property {string} [ticketId] - ID тикета (если создан)
 * @property {string} [ticketError] - Ошибка создания тикета
 * @property {number} tokensUsed - Использованные токены
 * @property {string} language - Определенный язык
 * @property {string} timestamp - Время ответа
 * @property {Object} metadata - Дополнительные метаданные
 */

/**
 * @typedef {Object} ClaudeResponse
 * @property {string} message - Текст ответа
 * @property {boolean} needsTicket - Требуется ли создание тикета
 * @property {number} tokensUsed - Использованные токены
 */

/**
 * @typedef {Object} ClaudeOptions
 * @property {string[]} [context] - Контекст из базы знаний
 * @property {Object[]} [history] - История сообщений
 * @property {string} [language] - Язык общения
 */

/**
 * @typedef {Object} VectorSearchResult
 * @property {string} content - Содержимое документа
 * @property {Object} metadata - Метаданные документа
 * @property {number} score - Оценка релевантности
 */

/**
 * @typedef {Object} VectorSearchOptions
 * @property {number} [limit] - Количество результатов
 * @property {string} [language] - Язык для фильтрации
 * @property {string} [category] - Категория для фильтрации
 */

/**
 * @typedef {Object} DatabaseConnectionStatus
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
 * @property {DatabaseConnectionStatus} details - Детали подключения
 * @property {string} [error] - Сообщение об ошибке, если есть
 */

/**
 * @typedef {Object} TicketCreateData
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {string} message - Сообщение/вопрос
 * @property {string} [context] - Контекст разговора
 * @property {string} [language] - Язык обращения
 * @property {string} [subject] - Тема тикета
 * @property {string} [category] - Категория тикета
 * @property {string} [email] - Email для связи
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} [page] - Номер страницы (по умолчанию 1)
 * @property {number} [limit] - Количество элементов на странице (по умолчанию 10)
 * @property {string} [sortBy] - Поле для сортировки
 * @property {1|-1} [sortOrder] - Порядок сортировки (1 - возрастание, -1 - убывание)
 */

/**
 * @typedef {Object} PaginatedResult
 * @property {Array} data - Данные
 * @property {number} total - Общее количество элементов
 * @property {number} page - Текущая страница
 * @property {number} totalPages - Общее количество страниц
 * @property {number} limit - Количество элементов на странице
 */

/**
 * @typedef {Object} SocketMessageData
 * @property {string} message - Текст сообщения
 * @property {string} userId - ID пользователя
 * @property {string} [conversationId] - ID разговора
 * @property {string} [language] - Язык сообщения
 */

/**
 * @typedef {Object} AdminTicketFilter
 * @property {string} [status] - Фильтр по статусу
 * @property {string} [category] - Фильтр по категории
 * @property {string} [priority] - Фильтр по приоритету
 * @property {string} [assignedTo] - Фильтр по назначенному
 * @property {string} [language] - Фильтр по языку
 * @property {Date} [from] - Фильтр по дате (от)
 * @property {Date} [to] - Фильтр по дате (до)
 */

/**
 * @typedef {Object} MessageHistoryItem
 * @property {'user'|'assistant'} role - Роль
 * @property {string} content - Содержимое сообщения
 */

/**
 * @typedef {Object} SystemPrompts
 * @property {string} basic - Базовый системный промпт
 * @property {string} rag - Промпт для работы с RAG
 * @property {string} ticket - Промпт для создания тикетов
 */

// Коды ошибок
/**
 * @readonly
 * @enum {string}
 */
const ERROR_CODES = {
  // Общие ошибки
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  
  // Ошибки базы данных
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  DATABASE_OPERATION_ERROR: 'DATABASE_OPERATION_ERROR',
  
  // Ошибки Claude API
  CLAUDE_API_ERROR: 'CLAUDE_API_ERROR',
  CLAUDE_RATE_LIMIT: 'CLAUDE_RATE_LIMIT',
  CLAUDE_INVALID_REQUEST: 'CLAUDE_INVALID_REQUEST',
  
  // Ошибки векторной базы
  VECTOR_STORE_ERROR: 'VECTOR_STORE_ERROR',
  
  // Ошибки аутентификации
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Ошибки тикетов
  TICKET_CREATION_ERROR: 'TICKET_CREATION_ERROR',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  
  // Ошибки разговоров
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_CREATION_ERROR: 'MESSAGE_CREATION_ERROR'
};

// Константы
/**
 * @readonly
 * @enum {string}
 */
const SUPPORTED_LANGUAGES = {
  EN: 'en',
  ES: 'es',
  RU: 'ru'
};

/**
 * @readonly
 * @enum {string}
 */
const TICKET_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

/**
 * @readonly
 * @enum {string}
 */
const TICKET_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

/**
 * @readonly
 * @enum {string}
 */
const TICKET_CATEGORIES = {
  TECHNICAL: 'technical',
  ACCOUNT: 'account',
  BILLING: 'billing',
  FEATURE: 'feature',
  OTHER: 'other'
};

/**
 * @readonly
 * @enum {string}
 */
const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

/**
 * @readonly
 * @enum {string}
 */
const CONVERSATION_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

/**
 * @readonly
 * @enum {string}
 */
const DOCUMENT_STATUSES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

module.exports = {
  ERROR_CODES,
  SUPPORTED_LANGUAGES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  MESSAGE_ROLES,
  CONVERSATION_STATUSES,
  DOCUMENT_STATUSES
};