/**
 * Сервис логирования
 * @file server/utils/logger.js
 */

const path = require('path');
const fs = require('fs');

/**
 * @class Logger
 * @description Простой логгер для приложения
 */
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // Создание директории для логов
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDir();
  }

  /**
   * Создает директорию для логов если она не существует
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Форматирует сообщение лога
   * @param {string} level - Уровень лога
   * @param {string} message - Сообщение
   * @param {any} [meta] - Дополнительные данные
   * @returns {string} Отформатированное сообщение
   */
  formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (meta !== undefined) {
      if (typeof meta === 'object') {
        logMessage += '\n' + JSON.stringify(meta, null, 2);
      } else {
        logMessage += ` ${meta}`;
      }
    }
    
    return logMessage;
  }

  /**
   * Проверяет, должен ли лог быть записан
   * @param {string} level - Уровень лога
   * @returns {boolean} Должен ли лог быть записан
   */
  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  /**
   * Записывает лог в консоль и файл
   * @param {string} level - Уровень лога
   * @param {string} message - Сообщение
   * @param {any} [meta] - Дополнительные данные
   */
  log(level, message, meta) {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Вывод в консоль с цветами
    const colors = {
      error: '\x1b[31m', // Красный
      warn: '\x1b[33m',  // Желтый
      info: '\x1b[36m',  // Циан
      debug: '\x1b[35m'  // Пурпурный
    };
    
    const resetColor = '\x1b[0m';
    const coloredMessage = `${colors[level]}${formattedMessage}${resetColor}`;
    
    // Вывод в консоль
    if (level === 'error') {
      console.error(coloredMessage);
    } else if (level === 'warn') {
      console.warn(coloredMessage);
    } else {
      console.log(coloredMessage);
    }

    // Запись в файл (только в production)
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(level, formattedMessage);
    }
  }

  /**
   * Записывает лог в файл
   * @param {string} level - Уровень лога
   * @param {string} message - Сообщение
   */
  writeToFile(level, message) {
    try {
      const logFile = path.join(this.logDir, `${level}.log`);
      const logEntry = message + '\n';
      
      fs.appendFileSync(logFile, logEntry, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Логирует ошибку
   * @param {string} message - Сообщение
   * @param {any} [meta] - Дополнительные данные
   */
  error(message, meta) {
    this.log('error', message, meta);
  }

  /**
   * Логирует предупреждение
   * @param {string} message - Сообщение
   * @param {any} [meta] - Дополнительные данные
   */
  warn(message, meta) {
    this.log('warn', message, meta);
  }

  /**
   * Логирует информационное сообщение
   * @param {string} message - Сообщение
   * @param {any} [meta] - Дополнительные данные
   */
  info(message, meta) {
    this.log('info', message, meta);
  }

  /**
   * Логирует отладочное сообщение
   * @param {string} message - Сообщение
   * @param {any} [meta] - Дополнительные данные
   */
  debug(message, meta) {
    this.log('debug', message, meta);
  }

  /**
   * Middleware для логирования HTTP запросов
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  httpLogger(req, res, next) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;
    
    // Логируем входящий запрос
    logger.info(`${method} ${originalUrl} - ${ip}`);
    
    // Перехватываем окончание ответа
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      // Логируем ответ
      logger.info(`${method} ${originalUrl} - ${statusCode} - ${duration}ms`);
      
      // Вызываем оригинальный send
      originalSend.call(res, data);
    };
    
    next();
  }

  /**
   * Создает middleware для логирования HTTP запросов с дополнительными опциями
   * @param {Object} options - Опции логирования
   * @returns {Function} Express middleware
   */
  createHttpLogger(options = {}) {
    const {
      includeBody = false,
      includeHeaders = false,
      skipPaths = []
    } = options;
    
    return (req, res, next) => {
      // Пропускаем определенные пути
      if (skipPaths.some(path => req.originalUrl.startsWith(path))) {
        return next();
      }
      
      const start = Date.now();
      const { method, originalUrl, ip } = req;
      
      let logData = {
        method,
        url: originalUrl,
        ip,
        userAgent: req.get('User-Agent')
      };
      
      if (includeHeaders) {
        logData.headers = req.headers;
      }
      
      if (includeBody && req.body) {
        logData.body = req.body;
      }
      
      logger.info('Incoming request', logData);
      
      // Перехватываем окончание ответа
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - start;
        const { statusCode } = res;
        
        logger.info('Response sent', {
          method,
          url: originalUrl,
          statusCode,
          duration: `${duration}ms`
        });
        
        originalSend.call(res, data);
      };
      
      next();
    };
  }
}

// Создаем экземпляр логгера
const logger = new Logger();

// Экспортируем экземпляр и httpLogger middleware
module.exports = logger;
module.exports.httpLogger = logger.httpLogger.bind(logger);