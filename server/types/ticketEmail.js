/**
 * Типы для сервиса сбора email адресов для тикетов
 * @file server/types/ticketEmail.js
 */

/**
 * @typedef {Object} PendingTicket
 * @property {string} ticketId - ID созданного тикета
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {Date} createdAt - Время создания
 * @property {Date} expiresAt - Время истечения
 */

/**
 * @typedef {Object} TicketEmailResult
 * @property {boolean} success - Успешность операции
 * @property {Object} [ticket] - Объект тикета (если успешно)
 * @property {boolean} [pendingEmail] - Флаг ожидания email
 * @property {string} message - Сообщение для пользователя
 */

/**
 * @typedef {Object} PendingTicketsStats
 * @property {number} total - Общее количество тикетов в ожидании
 * @property {number} active - Активные тикеты (не истекшие)
 * @property {number} expired - Истекшие тикеты
 * @property {number} timeout - Таймаут в секундах
 */

/**
 * @typedef {Object} EmailCollectionData
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {string} subject - Тема тикета
 * @property {string} initialMessage - Первоначальное сообщение
 * @property {string} [context] - Контекст разговора
 * @property {string} [priority] - Приоритет тикета
 * @property {string} [category] - Категория тикета
 * @property {string} [language] - Язык пользователя
 * @property {Object} [metadata] - Дополнительные метаданные
 */

module.exports = {
  // Экспортируем типы для использования в других модулях
  PendingTicket: {},
  TicketEmailResult: {},
  PendingTicketsStats: {},
  EmailCollectionData: {}
};