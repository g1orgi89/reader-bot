/**
 * Утилиты для аутентификации и авторизации
 * @file server/utils/auth.js
 */

const logger = require('./logger');

/**
 * Базовая аутентификация для админ-панели
 * Использует простой логин/пароль для MVP
 * В продакшене следует заменить на более надежную систему
 */

// Временные учетные данные администратора
// В продакшене эти данные должны храниться в переменных окружения
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'password123'
};

/**
 * Middleware для базовой HTTP аутентификации
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 * @param {Function} next - Express next функция
 */
function authenticate(req, res, next) {
  // Пропускаем аутентификацию для некоторых публичных эндпоинтов
  const publicPaths = [
    '/api/chat/message', // публичный эндпоинт для чата
    '/api/health'        // проверка здоровья системы
  ];

  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    logger.warn(`Unauthorized access attempt to ${req.path} from ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  // Декодируем Base64 заголовок
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // Проверяем учетные данные
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    // Добавляем информацию о пользователе в request объект
    req.user = {
      id: 'admin',
      username: 'admin',
      role: 'administrator'
    };
    
    logger.info(`Admin authenticated successfully from ${req.ip}`);
    return next();
  }

  logger.warn(`Failed authentication attempt for user '${username}' from ${req.ip}`);
  return res.status(401).json({
    success: false,
    error: 'Invalid credentials',
    code: 'INVALID_CREDENTIALS'
  });
}

/**
 * Middleware для проверки прав администратора
 * Использовать после authenticate middleware
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 * @param {Function} next - Express next функция
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'administrator') {
    logger.warn(`Access denied to admin resource ${req.path} for user ${req.user?.username || 'anonymous'}`);
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'FORBIDDEN'
    });
  }

  return next();
}

/**
 * Простая валидация API ключа для интеграций
 * @param {string} apiKey - API ключ для проверки
 * @returns {boolean} - Действителен ли ключ
 */
function validateApiKey(apiKey) {
  // В продакшене API ключи должны храниться в базе данных
  // и иметь ограничения по времени и скорости запросов
  const validApiKeys = [
    process.env.API_KEY,
    process.env.TELEGRAM_API_KEY
  ].filter(Boolean);

  return validApiKeys.includes(apiKey);
}

/**
 * Middleware для аутентификации через API ключ
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 * @param {Function} next - Express next функция
 */
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    });
  }

  if (!validateApiKey(apiKey)) {
    logger.warn(`Invalid API key used: ${apiKey.substring(0, 8)}... from ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  req.user = {
    id: 'api',
    type: 'api_client',
    apiKey: apiKey.substring(0, 8) + '...'
  };

  return next();
}

/**
 * Middleware для ограничения скорости запросов (rate limiting)
 * Простая реализация в памяти, в продакшене использовать Redis
 */
const rateLimitStore = new Map();

/**
 * Создает middleware для ограничения скорости запросов
 * @param {Object} options - Опции rate limiting
 * @param {number} options.windowMs - Временное окно в миллисекундах
 * @param {number} options.max - Максимальное количество запросов за окно
 * @param {string} [options.message] - Сообщение при превышении лимита
 * @returns {Function} Express middleware функция
 */
function createRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,  // 15 минут по умолчанию
    max = 100,                   // 100 запросов по умолчанию
    message = 'Too many requests'
  } = options;

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    
    // Получаем или создаем запись для IP
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, {
        count: 0,
        resetTime: now + windowMs
      });
    }

    const record = rateLimitStore.get(key);

    // Сбрасываем счетчик если окно прошло
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    // Проверяем лимит
    if (record.count >= max) {
      logger.warn(`Rate limit exceeded for IP ${key}`);
      return res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    // Увеличиваем счетчик
    record.count++;

    // Добавляем заголовки с информацией о лимитах
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': max - record.count,
      'X-RateLimit-Reset': Math.ceil(record.resetTime / 1000)
    });

    return next();
  };
}

// Очистка устаревших записей rate limit каждые 10 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime + 60000) { // +1 минута буфер
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

module.exports = {
  authenticate,
  requireAdmin,
  authenticateApiKey,
  validateApiKey,
  createRateLimit
};