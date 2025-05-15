/**
 * Middleware для обработки ошибок
 * @file server/middleware/errorHandler.js
 */

const logger = require('../utils/logger');
const { ERROR_CODES } = require('../types');

/**
 * Обработчик ошибок
 * @param {Error} err - Объект ошибки
 * @param {Request} req - Объект запроса Express
 * @param {Response} res - Объект ответа Express
 * @param {Function} next - Следующий middleware
 */
function errorHandler(err, req, res, next) {
  // Логируем ошибку
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Определяем статус код и тип ошибки
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Internal Server Error';

  // Специфичные типы ошибок
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Validation failed';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = ERROR_CODES.INVALID_INPUT;
    message = 'Invalid input format';
  } else if (err.code === 11000) {
    statusCode = 400;
    errorCode = ERROR_CODES.DUPLICATE_ENTRY;
    message = 'Duplicate entry';
  } else if (err.name === 'MongoNetworkError') {
    statusCode = 503;
    errorCode = ERROR_CODES.DATABASE_CONNECTION_ERROR;
    message = 'Database connection error';
  } else if (err.message.includes('Claude')) {
    statusCode = 503;
    errorCode = ERROR_CODES.CLAUDE_API_ERROR;
    message = 'AI service temporarily unavailable';
  }

  // Формируем ответ об ошибке
  const errorResponse = {
    success: false,
    error: message,
    code: errorCode,
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // В режиме разработки добавляем стек ошибки
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
  }

  // Отправляем ответ
  res.status(statusCode).json(errorResponse);
}

/**
 * Middleware для обработки несуществующих маршрутов
 * @param {Request} req - Объект запроса Express
 * @param {Response} res - Объект ответа Express
 * @param {Function} next - Следующий middleware
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = ERROR_CODES.NOT_FOUND;
  next(error);
}

/**
 * Middleware для обработки асинхронных ошибок
 * @param {Function} fn - Асинхронная функция
 * @returns {Function} Обернутая функция
 */
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncErrorHandler
};