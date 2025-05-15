/**
 * Logger utility для проекта Shrooms Support Bot
 * @file server/utils/logger.js
 */

const winston = require('winston');
const path = require('path');
const { config } = require('../config');

// Создаем директорию для логов если она не существует
const fs = require('fs');
const logDir = config.logging.dir || 'logs';

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Определяем формат логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Формат для консоли с цветами
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Добавляем метаданные если они есть
    if (Object.keys(meta).length > 0) {
      logMessage += ' ' + JSON.stringify(meta, null, 2);
    }
    
    return logMessage;
  })
);

// Создаем transports
const transports = [
  // Консольный вывод (всегда включен)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      consoleFormat
    ),
    level: config.logging.level || 'info'
  })
];

// Файловое логирование (если включено)
if (config.logging.enableFileLogging) {
  // Лог всех сообщений
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );

  // Лог только ошибок
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );
}

// Создаем основной logger
const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: logFormat,
  transports,
  // Обработка необработанных исключений
  exceptionHandlers: config.logging.enableFileLogging ? [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: logFormat
    })
  ] : [],
  // Обработка необработанных Promise rejection
  rejectionHandlers: config.logging.enableFileLogging ? [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: logFormat
    })
  ] : []
});

// HTTP логирование с помощью morgan
const morgan = require('morgan');

// Создаем стрим для winston
const stream = {
  write: (message) => {
    logger.info(message.trim(), { source: 'http' });
  }
};

// HTTP logger middleware
const httpLogger = morgan(
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
  { 
    stream,
    skip: (req, res) => {
      // Пропускаем health check запросы в production
      if (config.app.isProduction && req.url === '/api/health') {
        return true;
      }
      return false;
    }
  }
);

// Дополнительные методы логгера
logger.database = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'database' });
};

logger.claude = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'claude' });
};

logger.socket = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'socket' });
};

logger.auth = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'auth' });
};

logger.ticket = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'ticket' });
};

// Методы для разных уровней с категориями
['error', 'warn', 'info', 'debug'].forEach(level => {
  const originalMethod = logger[level];
  logger[level] = function(message, meta = {}) {
    // Добавляем информацию о файле и строке для ошибок
    if (level === 'error' && meta instanceof Error) {
      meta = {
        error: meta.message,
        stack: meta.stack,
        ...meta
      };
    }
    
    return originalMethod.call(this, message, meta);
  };
});

// Graceful shutdown логгера
logger.close = () => {
  return new Promise((resolve) => {
    logger.end(() => {
      resolve();
    });
  });
};

module.exports = logger;
module.exports.httpLogger = httpLogger;