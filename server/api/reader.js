// ВСТАВЬ СЮДА ↓↓↓ (самый верх!)
global.normalizeQuoteField = global.normalizeQuoteField || function (s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[—–]/g, '-');  // ← ДОБАВИТЬ! em dash (—) и en dash (–) → hyphen (-)
};

global.computeNormalizedKey = global.computeNormalizedKey || function (t, a = '') {
  return global.normalizeQuoteField(t) + '|||' + global.normalizeQuoteField(a);
};

// ВСЕ ВЫЗОВЫ ДОЛЖНЫ БЫТЬ ВИДИМЫ:
const normalizeQuoteField = global.normalizeQuoteField;
const computeNormalizedKey = global.computeNormalizedKey;

/**
 * Safely extract userId from request with enhanced error handling
 * ОБНОВЛЕНО: Добавлен fallback на X-User-Id если initData parsing fails
 * @param {Object} req - Express request object
 * @returns {string|null} userId or null if not found
 */
function safeExtractUserId(req) {
  try {
    // Priority 1: req.userId (set by telegramAuth middleware)
    if (req.userId) {
      return String(req.userId);
    }
    
    // Priority 2: Try to parse from headers (Authorization or X-Telegram-Init-Data)
    const initData = req.headers['authorization']?.startsWith('tma ')
      ? req.headers['authorization'].slice(4)
      : req.headers['x-telegram-init-data'];
    
    if (initData) {
      const userId = parseUserIdFromInitData(initData);
      if (userId) return userId;
    }
    
    // Priority 3: Fallback to X-User-Id header (клиент всегда отправляет этот заголовок)
    if (req.headers['x-user-id']) {
      return String(req.headers['x-user-id']);
    }
    
    // Priority 4: From query or body (legacy fallback)
    if (req.query?.userId) return String(req.query.userId);
    if (req.body?.userId) return String(req.body.userId);
    
    return null;
  } catch (error) {
    console.error('safeExtractUserId error:', error);
    return null;
  }
}

/**
 * Parse userId from Telegram initData string
 * Enhanced with better validation and error handling
 * ОБНОВЛЕНО: Добавлена безопасная декодировка для санитизированных данных
 * @param {string} initData - Telegram initData string (может быть закодирован)
 * @returns {string|null} userId or null if invalid
 */
function parseUserIdFromInitData(initData) {
  try {
    // Validate input is a string
    if (!initData || typeof initData !== 'string') {
      console.warn('parseUserIdFromInitData: initData is not a valid string');
      return null;
    }
    
    // Безопасная декодировка: клиент может отправить закодированную строку
    let decodedInitData = initData;
    try {
      // Пробуем декодировать, если строка закодирована
      const decoded = decodeURIComponent(initData);
      // Используем декодированную версию только если она выглядит как initData
      if (decoded.includes('=')) {
        decodedInitData = decoded;
      }
    } catch (decodeError) {
      // Если декодирование не удалось, используем оригинал
      console.debug('parseUserIdFromInitData: initData already decoded or invalid encoding');
    }
    
    // Check if initData contains expected pattern
    if (!decodedInitData.includes('=')) {
      console.warn('parseUserIdFromInitData: initData does not match expected pattern');
      return null;
    }
    
    // Парсим параметры из initData
    const params = new URLSearchParams(decodedInitData);
    const userStr = params.get('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      if (userObj && userObj.id) return String(userObj.id);
    }
  } catch (e) {
    console.warn('InitData parse error:', e.message);
  }
  return null;
}

function telegramAuth(req, res, next) {
  const initData = req.headers['authorization']?.startsWith('tma ')
    ? req.headers['authorization'].slice(4)
    : req.headers['x-telegram-init-data'];

  console.log('[TELEGRAM AUTH] RAW:', req.headers['authorization']);
  console.log('[TELEGRAM AUTH] INITDATA:', initData);

  const userId = parseUserIdFromInitData(initData);
  console.log('[TELEGRAM AUTH] PARSED USERID:', userId);
  
  if (!initData) {
    return res.status(401).json({ success: false, error: 'No Telegram initData' });
  }

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Invalid Telegram initData' });
  }

  req.userId = userId;
  next();
}

/**
 * @fileoverview Reader Bot Mini App API Endpoints
 * @description API маршруты для Telegram Mini App
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Импорты моделей
const UserProfile = require('../models/userProfile');
const Quote = require('../models/quote');
const WeeklyReport = require('../models/weeklyReport');
const MonthlyReport = require('../models/monthlyReport');
const BookCatalog = require('../models/BookCatalog');
const UTMClick = require('../models/analytics').UTMClick;
const PromoCodeUsage = require('../models/analytics').PromoCodeUsage;
const Follow = require('../models/Follow');
const Feedback = require('../models/Feedback');

// Импорт сервисов
const QuoteHandler = require('../services/quoteHandler');

// Импорт утилит
const { fetchTelegramAvatar, hasAvatar, updateUserAvatar } = require('../utils/telegramAvatarFetcher');
const { getAllCategories } = require('../utils/normalizeCategory');

// Defensive module-level import with fallback to prevent ReferenceError
const _normalizer = (() => {
  try {
    return require('../utils/quoteNormalizer');
  } catch (err) {
    console.error('⚠️ Failed to load quoteNormalizer, using fallback:', err);
    return {};
  }
})();

const localNormalizeQuoteField = _normalizer.normalizeQuoteField || (s => {
  if (!s || typeof s !== 'string') return '';
  return String(s).trim().toLowerCase();
});

// Импорт middleware
const { communityLimiter } = require('../middleware/rateLimiting');

// Helper functions for safe normalization with additional error handling
function safeNormalize(s) {
  try {
    return normalizeQuoteField(s || '');
  } catch (error) {
    console.error('Error normalizing field:', error);
    return String(s || '').trim().toLowerCase();
  }
}

function toNormalizedKey(text, author) {
  try {
    return computeNormalizedKey(text || '', author || '');
  } catch (error) {
    console.error('Error computing normalized key:', error);
    return `${safeNormalize(text)}|||${safeNormalize(author)}`;
  }
}

// Инициализация обработчика цитат
const quoteHandler = new QuoteHandler();

// === AVATAR STORAGE CONFIGURATION ===
// Use __dirname to ensure consistent path resolution regardless of process.cwd()
// Two levels up (../../) from server/api to reach repository root
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const AVATARS_DIR = path.join(UPLOADS_ROOT, 'avatars');

// Ensure avatars directory exists at module load time
try {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  console.log(`✅ Avatars directory ready: ${AVATARS_DIR}`);
} catch (error) {
  console.error(`❌ Failed to create avatars directory: ${error.message}`);
}

// === MIGRATION: Move files from legacy server/uploads/avatars to repo root ===
const LEGACY_AVATARS_DIR = path.join(__dirname, '../uploads/avatars');
try {
  if (fs.existsSync(LEGACY_AVATARS_DIR) && LEGACY_AVATARS_DIR !== AVATARS_DIR) {
    console.log(`🔄 Migrating avatars from legacy location: ${LEGACY_AVATARS_DIR}`);
    const legacyFiles = fs.readdirSync(LEGACY_AVATARS_DIR);
    let migratedCount = 0;
    
    for (const file of legacyFiles) {
      const sourcePath = path.join(LEGACY_AVATARS_DIR, file);
      const destPath = path.join(AVATARS_DIR, file);
      
      // Only migrate if destination doesn't exist
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(sourcePath, destPath);
        migratedCount++;
        console.log(`  ✅ Migrated: ${file}`);
      }
    }
    
    console.log(`✅ Migration complete: ${migratedCount} file(s) migrated`);
  }
} catch (error) {
  console.error(`⚠️ Avatar migration warning: ${error.message}`);
  // Don't fail if migration has issues, just log the warning
}

// Конфигурация multer для загрузки аватаров
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use standardized __dirname-based path
    cb(null, AVATARS_DIR);
  },
  filename: function (req, file, cb) {
    // Extract userId safely and validate it's numeric
    const userId = safeExtractUserId(req);
    
    if (!userId || userId === 'demo-user') {
      console.error('❌ Avatar upload rejected: NO_USER_ID_FOR_AVATAR');
      return cb(new Error('NO_USER_ID_FOR_AVATAR'));
    }
    
    // Validate userId is numeric for Telegram users
    if (!/^\d+$/.test(userId)) {
      console.error(`❌ Avatar upload rejected: Invalid userId format: ${userId}`);
      return cb(new Error('INVALID_USER_ID_FORMAT'));
    }
    
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${userId}_${Date.now()}${ext}`;
    console.log(`📁 Avatar filename generated: ${filename} for userId: ${userId}`);
    cb(null, filename);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Поддерживаются только изображения (JPEG, PNG, GIF, WebP)'));
    }
  }
});

/**
 * Simple userId extraction from request
 * Supports both query parameters and request body
 * Always returns String for consistency
 */
function getUserId(req) {
  return String(req.userId || req.query.userId || req.body.userId || 'demo-user');
}

/**
 * Validates period parameter and returns date range
 * @param {string} period - Period string like '7d', '30d'
 * @returns {{startDate: Date, isValid: boolean, period: string}} 
 */
function validatePeriod(period) {
  const now = new Date();
  const startDate = new Date(now);
  
  if (!period) {
    // Default to 7 days
    startDate.setDate(now.getDate() - 7);
    return { startDate, isValid: true, period: '7d' };
  }
  
  // Strict validation: only '7d' and '30d' allowed for production safety
  if (period !== '7d' && period !== '30d') {
    return { startDate: null, isValid: false, period: null };
  }
  
  const value = parseInt(period, 10);
  startDate.setDate(now.getDate() - value);
  
  return { startDate, isValid: true, period };
}

/**
 * Validates limit parameter with production-safe defaults
 * @param {string|number} limit - Limit value
 * @param {number} defaultLimit - Default limit if not provided
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {{limit: number, isValid: boolean}}
 */
function validateLimit(limit, defaultLimit = 10, maxLimit = 50) {
  if (!limit) {
    return { limit: defaultLimit, isValid: true };
  }
  
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > maxLimit) {
    return { limit: defaultLimit, isValid: false };
  }
  
  return { limit: parsed, isValid: true };
}

/**
 * Get origin user info for multiple quote pairs efficiently using normalized fields
 * Implements three-pass resolution for robust origin attribution:
 * - Pass 1: Exact text+author match (fastest, for consistent data)
 * - Pass 2a: Pre-normalized field match (for docs with normalizedText/normalizedAuthor)
 * - Pass 2b: JS normalization fallback (for legacy docs without pre-normalized fields)
 * @param {Array} quotePairs - Array of {text, author} pairs (original, not normalized)
 * @returns {Promise<Map>} Map from 'text|||author' key (original) to origin userId
 */
async function getOriginUserIds(quotePairs) {
  try {
    if (!quotePairs || quotePairs.length === 0) {
      return new Map();
    }

    // Build a map from original key -> normalized key for later mapping
    const originalToNormalizedMap = new Map();
    const normalizedToOriginalMap = new Map();
    
    quotePairs.forEach(pair => {
      const originalKey = `${pair.text}|||${pair.author || ''}`;
      const normalizedKey = toNormalizedKey(pair.text, pair.author || '');
      originalToNormalizedMap.set(originalKey, normalizedKey);
      normalizedToOriginalMap.set(normalizedKey, originalKey);
    });

    const originMap = new Map();

    // PASS 1: Try exact text+author match (fastest, handles new docs with consistent data)
    const exactMatches = await Quote.aggregate([
      {
        $match: {
          $or: quotePairs.map(pair => ({
            text: pair.text,
            author: pair.author || ''
          }))
        }
      },
      {
        $sort: { createdAt: 1, _id: 1 }
      },
      {
        $group: {
          _id: { text: '$text', author: '$author' },
          originUserId: { $first: '$userId' },
          earliestCreated: { $first: '$createdAt' }
        }
      }
    ]);

    // Map exact matches back to original keys
    exactMatches.forEach(result => {
      const originalKey = `${result._id.text}|||${result._id.author || ''}`;
      originMap.set(originalKey, result.originUserId);
    });

    // Collect pairs that still need resolution
    const unresolvedPairs = quotePairs.filter(pair => {
      const originalKey = `${pair.text}|||${pair.author || ''}`;
      return !originMap.has(originalKey);
    });

    if (unresolvedPairs.length === 0) {
      return originMap;
    }

    // PASS 2: Normalized match using pre-normalized fields or fallback to JS normalization
    // First, try using the normalizedText/normalizedAuthor fields if they exist
    const targetNormalizedKeys = unresolvedPairs.map(pair => 
      toNormalizedKey(pair.text, pair.author || '')
    );

    // Check if documents have pre-normalized fields
    const normalizedFieldMatches = await Quote.aggregate([
      {
        $match: {
          normalizedText: { $exists: true, $ne: null },
          normalizedAuthor: { $exists: true }
        }
      },
      {
        $addFields: {
          computedNormalizedKey: {
            $concat: ['$normalizedText', '|||', '$normalizedAuthor']
          }
        }
      },
      {
        $match: {
          computedNormalizedKey: { $in: targetNormalizedKeys }
        }
      },
      {
        $sort: { createdAt: 1, _id: 1 }
      },
      {
        $group: {
          _id: '$computedNormalizedKey',
          originUserId: { $first: '$userId' },
          earliestCreated: { $first: '$createdAt' }
        }
      }
    ]);

    // Map normalized field matches back to original keys
    normalizedFieldMatches.forEach(result => {
      const normalizedKey = result._id;
      const originalKey = normalizedToOriginalMap.get(normalizedKey);
      if (originalKey && !originMap.has(originalKey)) {
        originMap.set(originalKey, result.originUserId);
      }
    });

    // For remaining unresolved pairs, fetch all quotes and normalize in JS
    const stillUnresolvedAfterNormFields = unresolvedPairs.filter(pair => {
      const originalKey = `${pair.text}|||${pair.author || ''}`;
      return !originMap.has(originalKey);
    });

    if (stillUnresolvedAfterNormFields.length > 0) {
      // Fetch a broader set of quotes that might match (all quotes without pre-normalized fields)
      // Limit to 10k to avoid memory issues. This is reasonable because:
      // - Most quotes should have pre-normalized fields (handled in Pass 2a)
      // - Community endpoints typically query small sets (10-50 items)
      // - If a match isn't found in 10k legacy docs, origin likely doesn't exist
      const candidateQuotes = await Quote.find(
        {
          $or: [
            { normalizedText: { $exists: false } },
            { normalizedText: null }
          ]
        },
        { text: 1, author: 1, userId: 1, createdAt: 1, _id: 1 }
      )
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .limit(10000);

      // Build a map of normalized key -> earliest quote for candidates
      const candidateMap = new Map();
      candidateQuotes.forEach(quote => {
        const normalizedKey = toNormalizedKey(quote.text, quote.author || '');
        if (!candidateMap.has(normalizedKey)) {
          candidateMap.set(normalizedKey, quote);
        }
      });

      // Match unresolved pairs against candidates
      stillUnresolvedAfterNormFields.forEach(pair => {
        const originalKey = `${pair.text}|||${pair.author || ''}`;
        const normalizedKey = toNormalizedKey(pair.text, pair.author || '');
        const match = candidateMap.get(normalizedKey);
        
        if (match && !originMap.has(originalKey)) {
          originMap.set(originalKey, match.userId);
        }
      });
    }

    // The three-pass resolution is now complete:
    // Pass 1: Exact match (fastest)
    // Pass 2a: Pre-normalized field match (for docs with normalizedText/normalizedAuthor)
    // Pass 2b: JS normalization match (for legacy docs without normalized fields)

    return originMap;
  } catch (error) {
    console.error('Error getting origin user IDs:', error);
    return new Map();
  }
}

/**
 * DTO helper for standardized quote responses with aiAnalysis block
 * @param {Object} q - Quote document
 * @param {Object} options - Additional options
 * @param {string} options.summary - Summary text for aiAnalysis
 * @param {Object} options.user - User data for enrichment
 * @returns {Object} Standardized quote object with aiAnalysis
 */
function toQuoteDTO(q, { summary = '', user = null } = {}) {
  const base = {
    id: q._id,
    text: q.text,
    author: q.author,
    source: q.source,
    category: q.category,
    themes: Array.isArray(q.themes) ? q.themes : [],
    sentiment: q.sentiment,
    insights: q.insights,
    isEdited: q.isEdited,
    editedAt: q.editedAt,
    createdAt: q.createdAt,
    isFavorite: typeof q.isFavorite === 'boolean' ? q.isFavorite : false, // ← добавить эту строку!
    aiAnalysis: {
      summary: summary || '',
      insights: q.insights || '',
      category: q.category || 'ДРУГОЕ',
      themes: Array.isArray(q.themes) ? q.themes : [],
      sentiment: q.sentiment || 'neutral'
    }
  };
  if (user) base.user = user;
  return base;
}

/**
 * Local helper to normalize user settings with safe defaults
 * @param {Object|null} user - User profile object 
 * @returns {Object} Normalized settings object
 */
function normalizeSettings(user) {
  if (!user) {
    // Default settings for non-existent users
    return {
      reminders: { enabled: true, frequency: 'often', lastSentAt: null },
      achievements: { enabled: true },
      language: 'ru'
    };
  }

  // Use the model method if available, otherwise provide fallback
  if (typeof user.getNormalizedSettings === 'function') {
    return user.getNormalizedSettings();
  }

  // Fallback normalization logic
  const settings = user.settings || {};
  return {
    reminders: {
      enabled: settings.reminders?.enabled ?? settings.reminderEnabled ?? true,
      frequency: settings.reminders?.frequency ?? 'often',
      lastSentAt: settings.reminders?.lastSentAt ?? null
    },
    achievements: {
      enabled: settings.achievements?.enabled ?? true
    },
    language: settings.language ?? 'ru'
  };
}

/**
 * @description Health check endpoint
 * @route GET /api/reader/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Reader API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * @description Telegram аутентификация для Mini App с автоматическим получением аватара
 * @route POST /api/reader/auth/telegram
 */
router.post('/auth/telegram', async (req, res) => {
  try {
    const { telegramData, user } = req.body;

    if (!user || !user.id) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют данные пользователя Telegram'
      });
    }

    const userId = user.id.toString();
    const userProfile = await UserProfile.findOne({ userId });

    // Асинхронное получение аватара, если у пользователя его нет
    if (userProfile && !hasAvatar(userProfile)) {
      // Запускаем фетч аватара в фоне, не блокируя ответ
      fetchTelegramAvatar(userId)
        .then(avatarUrl => {
          if (avatarUrl) {
            return updateUserAvatar(userId, avatarUrl);
          }
        })
        .catch(error => {
          console.error(`❌ Background avatar fetch failed for user ${userId}:`, error.message);
        });
    }

    const authData = {
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        username: user.username || '',
        telegramId: user.id,
        isOnboardingComplete: userProfile ? userProfile.isOnboardingComplete : false,
        avatarUrl: userProfile ? userProfile.avatarUrl : null
      },
      isOnboardingComplete: userProfile ? userProfile.isOnboardingComplete : false
    };

    res.json(authData);

  } catch (error) {
    console.error('❌ Telegram Auth Error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка аутентификации'
    });
  }
});

/**
 * @description Проверка статуса онбординга
 * @route GET /api/reader/auth/onboarding-status
 */
router.get('/auth/onboarding-status', async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.json({
        success: true,
        isOnboardingComplete: false,
        // Legacy поля (временно)
        isCompleted: false,
        completed: false,
        isOnboardingCompleted: false,
        user: null
      });
    }

    const userProfile = await UserProfile.findOne({ userId });

    const isOnboardingComplete = !!(userProfile && userProfile.isOnboardingComplete);

    return res.json({
      success: true,
      isOnboardingComplete,            // unified новое поле
      // Legacy (оставляем временно для старого фронта / сторонних вызовов)
      isCompleted: isOnboardingComplete,
      completed: isOnboardingComplete,
      isOnboardingCompleted: isOnboardingComplete,
      user: userProfile ? {
        userId: userProfile.userId,
        name: userProfile.name,
        email: userProfile.email,
        isOnboardingComplete: userProfile.isOnboardingComplete
      } : null
    });

  } catch (error) {
    console.error('❌ Onboarding Status Error:', error);
    return res.status(500).json({
      success: false,
      error: 'ONBOARDING_STATUS_FAILED'
    });
  }
});

/**
 * @description Нормализация входных данных онбординга
 * Преобразует различные варианты source к допустимым enum
 */
function normalizeOnboardingInput(email, source) {
  const normalizedEmail = email ? email.trim() : '';
  const sourceMapping = {
    Instagram: 'Instagram',
    Telegram: 'Telegram',
    YouTube: 'YouTube',
    Threads: 'Threads',
    Друзья: 'Друзья',
    Другое: 'Другое',
    telegram: 'Telegram',
    instagram: 'Instagram',
    youtube: 'YouTube',
    threads: 'Threads',
    'От друзей': 'Друзья',
    'от друзей': 'Друзья',
    друже: 'Другое',
    другое: 'Другое',
    друзья: 'Друзья'
  };
  const normalizedSource = source && sourceMapping[source] ? sourceMapping[source] : 'Другое';
  return { email: normalizedEmail, source: normalizedSource };
}

/**
 * @description Завершение онбординга (идемпотентно + retake)
 * @route POST /api/reader/auth/complete-onboarding
 *
 * Сценарии:
 * 1) Новый профиль -> создаём (isOnboardingComplete = true)
 * 2) Существующий с флагом=false -> обновляем, ставим true
 * 3) Повтор без forceRetake при уже завершённом -> alreadyCompleted:true
 * 4) forceRetake=true -> обновляем testResults, сохраняем первоначальный completedAt, добавляем retakeAt
 */
router.post('/auth/complete-onboarding', async (req, res) => {
  try {
    const { user, answers, email, source, forceRetake } = req.body || {};

    if (!user || !user.id || !answers) {
      return res.status(400).json({ success: false, error: 'MISSING_FIELDS' });
    }

    const userId = user.id.toString();
    const { email: normalizedEmail, source: normalizedSource } = normalizeOnboardingInput(email, source);

    let profile = await UserProfile.findOne({ userId });

    const isFirstCompletion = !profile || !profile.isOnboardingComplete;

    // Email обязателен только при первом успешном завершении
    if (isFirstCompletion && !normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_REQUIRED',
        message: 'Email адрес обязателен для завершения регистрации'
      });
    }

    if (normalizedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          error: 'EMAIL_INVALID',
          message: 'Некорректный формат email адреса'
        });
      }
    }

    // 1. Новый профиль
    if (!profile) {
      const now = new Date();
      const testResults = {
        question1_name: answers.question1_name || answers.name,
        question2_lifestyle: answers.question2_lifestyle || answers.lifestyle,
        question3_time: answers.question3_time || answers.timeForSelf,
        question4_priorities: answers.question4_priorities || answers.priorities,
        question5_reading_feeling: answers.question5_reading_feeling || answers.readingFeelings,
        question6_phrase: answers.question6_phrase || answers.closestPhrase,
        question7_reading_time: answers.question7_reading_time || answers.readingTime,
        completedAt: now
      };

      profile = await UserProfile.create({
        userId,
        name: testResults.question1_name,
        email: normalizedEmail,
        source: normalizedSource,
        testResults,
        telegramUsername: user.username,
        telegramData: {
          firstName: user.first_name,
          lastName: user.last_name,
          languageCode: user.language_code,
          chatId: userId
        },
        isOnboardingComplete: true,
        registeredAt: now,
        updatedAt: now
      });

      console.log(`✅ Пользователь создан: ${profile.userId}`);
      return res.json({
        success: true,
        user: {
          userId: profile.userId,
          name: profile.name,
          email: profile.email,
          isOnboardingComplete: true
        },
        message: 'Онбординг успешно завершён'
      });
    }

    // 2. Идемпотентный повтор без forceRetake
    if (profile.isOnboardingComplete && !forceRetake) {
      console.log(`⚠️ Already completed (idempotent): ${userId}`);
      return res.json({
        success: true,
        alreadyCompleted: true,
        user: {
          userId: profile.userId,
          name: profile.name,
          email: profile.email,
          isOnboardingComplete: profile.isOnboardingComplete
        },
        message: 'Онбординг уже завершён'
      });
    }
    
    // Helper для построения testResults при обновлении / retake
    const buildTestResults = (prev, isRetake) => {
      const now = new Date();
      return {
        question1_name: answers.question1_name || answers.name,
        question2_lifestyle: answers.question2_lifestyle || answers.lifestyle,
        question3_time: answers.question3_time || answers.timeForSelf,
        question4_priorities: answers.question4_priorities || answers.priorities,
        question5_reading_feeling: answers.question5_reading_feeling || answers.readingFeelings,
        question6_phrase: answers.question6_phrase || answers.closestPhrase,
        question7_reading_time: answers.question7_reading_time || answers.readingTime,
        completedAt: prev?.testResults?.completedAt || now,
        ...(isRetake ? { retakeAt: now } : {})
      };
    };

    const testResults = buildTestResults(profile, !!forceRetake);

    const update = {
      testResults,
      isOnboardingComplete: true,
      updatedAt: new Date()
    };

    // Обновляем имя / email / source при наличии новых значений
    if (testResults.question1_name && testResults.question1_name !== profile.name) {
      update.name = testResults.question1_name;
    }
    if (normalizedEmail) update.email = normalizedEmail;
    if (normalizedSource) update.source = normalizedSource;

    await UserProfile.updateOne({ userId }, { $set: update });
    profile = await UserProfile.findOne({ userId }, 'userId name email isOnboardingComplete');

    console.log(`✅ Пользователь ${forceRetake ? 'retake обновлён' : 'обновлён'}: ${profile.userId}`);

    return res.json({
      success: true,
      ...(forceRetake ? { retake: true } : {}),
      user: {
        userId: profile.userId,
        name: profile.name,
        email: profile.email,
        isOnboardingComplete: profile.isOnboardingComplete
      },
      message: forceRetake
        ? 'Онбординг обновлён (retake)'
        : 'Статус онбординга подтверждён'
    });

  } catch (error) {
    // Возможная гонка (E11000) при параллельных запросах на создание
    if (error && error.code === 11000 && req.body?.user?.id) {
      try {
        const existing = await UserProfile.findOne({ userId: String(req.body.user.id) });
        if (existing?.isOnboardingComplete) {
          console.warn(`⚠️ Duplicate race resolved as alreadyCompleted: ${existing.userId}`);
          return res.json({
            success: true,
            alreadyCompleted: true,
            user: {
              userId: existing.userId,
              name: existing.name,
              email: existing.email,
              isOnboardingComplete: true
            }
          });
        }
      } catch (inner) {
        console.error('Duplicate resolution lookup failed:', inner);
      }
    }
    console.error('❌ complete-onboarding error:', error);
    return res.status(500).json({ success: false, error: 'INTERNAL_ONBOARDING_ERROR' });
  }
});

/**
 * @description Сброс онбординга
 * @route POST /api/reader/auth/reset-onboarding
 */
router.post('/auth/reset-onboarding', async (req, res) => {
  try {
    const userId = getUserId(req);

    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (typeof userProfile.resetTestResults === 'function') {
      await userProfile.resetTestResults();
      await userProfile.save();
    } else {
      userProfile.testResults = undefined;
      userProfile.isOnboardingComplete = false;
      userProfile.updatedAt = new Date();
      await userProfile.save();
    }

    res.json({
      success: true,
      user: {
        userId: userProfile.userId,
        name: userProfile.name,
        email: userProfile.email,
        isOnboardingComplete: userProfile.isOnboardingComplete
      }
    });
  } catch (error) {
    console.error('❌ Reset Onboarding Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during onboarding reset'
    });
  }
});

/**
 * @description Debug endpoint to verify avatar file existence
 * @route GET /api/reader/debug/avatar/:file
 * TODO: Remove this endpoint after debugging is complete
 * Rate limited to prevent abuse
 */
router.get('/debug/avatar/:file', communityLimiter, (req, res) => {
  try {
    const filename = req.params.file;
    
    // Strict validation to prevent path injection
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename format'
      });
    }
    
    // Sanitize filename for logging (prevent format string injection)
    const sanitizedFilename = filename.replace(/[^\w\-._]/g, '_');
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.warn(`⚠️ Directory traversal attempt detected: ${sanitizedFilename}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid filename format'
      });
    }
    
    // Validate filename pattern (userId_timestamp.ext) - strict whitelist
    if (!/^\d+_\d+\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
      console.warn(`⚠️ Invalid filename pattern: ${sanitizedFilename}`);
      return res.status(400).json({
        success: false,
        error: 'Filename does not match expected pattern'
      });
    }
    
    // Sanitize path by only using basename to prevent any path manipulation
    const safeFilename = path.basename(filename);
    const filePath = path.join(AVATARS_DIR, safeFilename);
    
    // Verify the resolved path is still within AVATARS_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedAvatarsDir = path.resolve(AVATARS_DIR);
    if (!resolvedPath.startsWith(resolvedAvatarsDir)) {
      console.error(`❌ Path escape attempt: ${sanitizedFilename}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const fileExists = fs.existsSync(resolvedPath);
    
    let fileStats = null;
    if (fileExists) {
      try {
        fileStats = fs.statSync(resolvedPath);
      } catch (statsError) {
        console.error('Error reading file stats:', statsError.message);
      }
    }
    
    console.log(`🔍 Debug avatar check: ${sanitizedFilename} - exists: ${fileExists}`);
    
    res.json({
      success: true,
      filename: safeFilename,
      exists: fileExists,
      paths: {
        relative: `/uploads/avatars/${safeFilename}`,
        avatarsDir: AVATARS_DIR
      },
      stats: fileStats ? {
        size: fileStats.size,
        created: fileStats.birthtime,
        modified: fileStats.mtime
      } : null
    });
  } catch (error) {
    console.error('❌ Debug avatar check error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @description Загрузка пользовательского аватара
 * @route POST /api/reader/auth/upload-avatar
 * Rate limited to prevent abuse
 */
router.post('/auth/upload-avatar', communityLimiter, telegramAuth, avatarUpload.single('avatar'), async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Файл аватара не предоставлен'
      });
    }

    // Sanitize and validate the uploaded file path
    const uploadedFilename = path.basename(req.file.filename);
    const expectedPath = path.join(AVATARS_DIR, uploadedFilename);
    const actualPath = path.resolve(req.file.path);
    
    // Verify path is within AVATARS_DIR (prevent path traversal)
    const resolvedAvatarsDir = path.resolve(AVATARS_DIR);
    if (!actualPath.startsWith(resolvedAvatarsDir)) {
      console.error('❌ Security: file path outside avatars directory');
      try {
        // Use the validated actualPath for cleanup since it's already resolved
        if (fs.existsSync(actualPath)) {
          await fs.promises.unlink(actualPath);
        }
      } catch (e) {
        // Ignore cleanup error
      }
      return res.status(403).json({
        success: false,
        error: 'Security validation failed'
      });
    }
    
    // Путь к загруженному файлу
    const avatarUrl = `/uploads/avatars/${uploadedFilename}`;
    const fsPath = expectedPath;

    // === RUNTIME DIAGNOSTICS: Verify file existence ===
    try {
      await fs.promises.access(fsPath, fs.constants.R_OK);
      console.log('✅ File verified on filesystem');
    } catch (accessError) {
      console.error('❌ File NOT accessible after upload:', accessError.message);
      return res.status(500).json({
        success: false,
        error: 'File was uploaded but not accessible',
        debug: {
          accessError: accessError.message
        }
      });
    }

    // === CLEANUP OLD AVATAR: Delete previous avatar file before updating ===
    try {
      const userProfile = await UserProfile.findOne({ userId });
      
      if (userProfile && userProfile.avatarUrl) {
        const oldAvatarUrl = userProfile.avatarUrl.trim();
        
        // Check if old avatar is not empty and not a default/external URL
        if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
          // Extract filename from URL (e.g., "/uploads/avatars/123_456789.jpg" -> "123_456789.jpg")
          const oldFilename = path.basename(oldAvatarUrl);
          
          // Validate filename pattern belongs to this user (userId_timestamp.ext)
          // Escape userId to prevent regex injection
          const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const filenamePattern = new RegExp(`^${escapedUserId}_\\d+\\.(jpg|jpeg|png|gif|webp)$`, 'i');
          
          if (filenamePattern.test(oldFilename)) {
            const oldFilePath = path.join(AVATARS_DIR, oldFilename);
            const resolvedOldPath = path.resolve(oldFilePath);
            const resolvedAvatarsDir = path.resolve(AVATARS_DIR);
            
            // Security: Ensure the file is within AVATARS_DIR
            if (resolvedOldPath.startsWith(resolvedAvatarsDir)) {
              // Check if old avatar file exists and delete it
              try {
                await fs.promises.access(resolvedOldPath, fs.constants.F_OK);
                await fs.promises.unlink(resolvedOldPath);
                console.log(`🗑️ Deleted old avatar: ${oldFilename}`);
              } catch (deleteError) {
                // File doesn't exist or couldn't be deleted - not critical, continue
                if (deleteError.code === 'ENOENT') {
                  console.log(`ℹ️ Old avatar file not found, skipping deletion: ${oldFilename}`);
                } else {
                  console.warn(`⚠️ Could not delete old avatar: ${deleteError.message}`);
                }
              }
            } else {
              console.warn(`⚠️ Old avatar path outside AVATARS_DIR, skipping deletion: ${oldFilename}`);
            }
          } else {
            console.log(`ℹ️ Old avatar filename doesn't match user pattern, skipping deletion: ${oldFilename}`);
          }
        }
      }
    } catch (cleanupError) {
      // Log error but don't fail the upload - cleanup is non-critical
      console.error('❌ Error during old avatar cleanup:', cleanupError.message);
    }

    // Обновляем профиль пользователя
    await updateUserAvatar(userId, avatarUrl);

    console.log(`✅ Multipart avatar upload successful for user ${userId}`);

    res.json({
      success: true,
      avatarUrl: avatarUrl,
      message: 'Аватар успешно загружен',
      debug: {
        filename: req.file.filename,
        size: req.file.size,
        uploadDir: AVATARS_DIR,
        fileExists: true
      }
    });

  } catch (error) {
    console.error('❌ Avatar Upload Error:', error.message);
    
    // Если произошла ошибка, попытаемся удалить загруженный файл
    if (req.file) {
      try {
        // Use safe path construction for cleanup
        const cleanupPath = path.join(AVATARS_DIR, path.basename(req.file.filename));
        const resolvedCleanupPath = path.resolve(cleanupPath);
        const resolvedAvatarsDir = path.resolve(AVATARS_DIR);
        
        // Only delete if within AVATARS_DIR
        if (resolvedCleanupPath.startsWith(resolvedAvatarsDir)) {
          await fs.promises.unlink(resolvedCleanupPath);
        }
      } catch (unlinkError) {
        console.error('❌ Failed to cleanup uploaded file:', unlinkError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Ошибка при загрузке аватара'
    });
  }
});

// ===========================================
// 👤 ПРОФИЛЬ И СТАТИСТИКА
// ===========================================

/**
 * @description Получение профиля пользователя
 * @route GET /api/reader/profile
 */
router.get('/profile',telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UserProfile.findOne({ userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isOnboardingComplete: user.isOnboardingComplete,
        registeredAt: user.registeredAt,
        source: user.source,
        preferences: user.preferences,
        settings: user.settings
      }
    });
  } catch (error) {
    console.error('❌ Profile Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Обновление профиля пользователя
 * @route PATCH /api/reader/profile
 */
router.patch('/profile', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { email, name, avatarUrl } = req.body;

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
            error: 'Invalid email format'
        });
      }
      user.email = email.toLowerCase().trim();
    }

    if (name) {
      user.name = name.trim();
    }

    if (avatarUrl !== undefined) {
      user.avatarUrl = avatarUrl;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isOnboardingComplete: user.isOnboardingComplete
      }
    });
  } catch (error) {
    console.error('❌ Profile Update Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @deprecated This endpoint is deprecated and will be removed in a future release.
 * @description Legacy base64 avatar upload endpoint - DEPRECATED
 * @route POST /api/reader/profile/avatar
 * Clients should use POST /api/reader/auth/upload-avatar with multipart/form-data instead.
 */
router.post('/profile/avatar', async (req, res) => {
  // Return 410 Gone to indicate deprecated endpoint
  return res.status(410).json({
    success: false,
    error: 'Deprecated endpoint. Please use POST /api/reader/auth/upload-avatar with multipart/form-data.',
    migration: {
      newEndpoint: '/api/reader/auth/upload-avatar',
      method: 'POST',
      contentType: 'multipart/form-data',
      fieldName: 'avatar'
    }
  });
});

/**
 * @description Сброс результатов теста
 * @route POST /api/reader/profile/reset-test
 */
router.post('/profile/reset-test', async (req, res) => {
  try {
    const userId = req.userId;

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (typeof user.resetTestResults === 'function') {
      await user.resetTestResults();
      await user.save();
    } else {
      user.testResults = undefined;
      user.isOnboardingComplete = false;
      user.updatedAt = new Date();
      await user.save();
    }

    res.json({
      success: true,
      message: 'Test results have been reset successfully',
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isOnboardingComplete: user.isOnboardingComplete,
        testResults: user.testResults
      }
    });
  } catch (error) {
    console.error('❌ Reset Test Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получение статистики пользователя
 * @route GET /api/reader/stats
 */
router.get('/stats', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UserProfile.findOne({ userId });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // ---- Parse query parameters ----
    const {
      scope = 'week',
      weekNumber,
      year,
      monthNumber,
      includeWeekMeta = 'false'
    } = req.query;

    const { 
      getBusinessNow, 
      getISOWeekInfo, 
      getISOWeekRange 
    } = require('../utils/isoWeek');

    // ---- Time boundaries using business timezone ----
    const businessNow = getBusinessNow();
    const startOfToday = new Date(businessNow); 
    startOfToday.setHours(0,0,0,0);
    
    let scopedQuotes, weekMeta = null;

    if (scope === 'week') {
      // Use provided week/year or current week
      const currentWeek = getISOWeekInfo(businessNow);
      const targetWeek = parseInt(weekNumber) || currentWeek.isoWeek;
      const targetYear = parseInt(year) || currentWeek.isoYear;
      
      // Get week range and meta
      const weekRange = getISOWeekRange(targetWeek, targetYear);
      
      if (includeWeekMeta === 'true') {
        weekMeta = {
          weekNumber: targetWeek,
          year: targetYear,
          range: {
            start: weekRange.start,
            end: weekRange.end
          }
        };
      }
      
      // Count quotes for this specific ISO week using weekNumber/yearNumber fields
      scopedQuotes = await Quote.countDocuments({ 
        userId, 
        weekNumber: targetWeek, 
        yearNumber: targetYear 
      });
    } else if (scope === 'month') {
      const targetMonth = parseInt(monthNumber) || (businessNow.getMonth() + 1);
      const targetYear = parseInt(year) || businessNow.getFullYear();
      
      // Count quotes for this specific month using monthNumber/yearNumber fields
      scopedQuotes = await Quote.countDocuments({ 
        userId, 
        monthNumber: targetMonth, 
        yearNumber: targetYear 
      });
    } else if (scope === 'global') {
      scopedQuotes = await Quote.countDocuments({ userId });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid scope. Use week, month, or global' 
      });
    }

    const startOfMonth = new Date(businessNow.getFullYear(), businessNow.getMonth(), 1);

    // ---- Parallel base counts ----
    const [ totalQuotes, todayQuotes, currentMonthQuotes ] = await Promise.all([
      Quote.countDocuments({ userId }),
      Quote.countDocuments({ userId, createdAt: { $gte: startOfToday } }),
      Quote.countDocuments({ userId, createdAt: { $gte: startOfMonth } })
    ]);

    // ---- Recent quotes for streak + authors (single fetch) ----
    // 300 is a pragmatic cap: enough to cover long streaks & author frequency without heavy load
    const recentQuotes = await Quote.find({ userId })
      .sort({ createdAt: -1 })
      .limit(300)
      .select({ createdAt: 1, author: 1 })
      .lean();

    // ---- Helpers ----
    const getDayKey = (d) => { 
      const dt = new Date(d);
      // Apply business timezone offset for consistent day boundaries
      const businessDate = new Date(dt.getTime() + (180 * 60 * 1000)); // Moscow time offset
      businessDate.setHours(0,0,0,0); 
      return businessDate.toISOString().slice(0,10); 
    };

    const computeDynamicStreak = (quotes) => {
      if (!quotes.length) return 0;
      const daySet = new Set(quotes.map(q => getDayKey(q.createdAt)));
      let streak = 0;
      const cursor = new Date(businessNow); 
      cursor.setHours(0,0,0,0);
      while (true) {
        const key = getDayKey(cursor);
        if (daySet.has(key)) { streak++; cursor.setDate(cursor.getDate() - 1); } else { break; }
      }
      return streak;
    };

    const dynamicStreak = computeDynamicStreak(recentQuotes);

    // ---- Favorite authors (top 3 by frequency among recent) ----
    const authorMap = new Map();
    for (const q of recentQuotes) {
      if (!q.author) continue;
      authorMap.set(q.author, (authorMap.get(q.author) || 0) + 1);
    }
    const favoriteAuthors = [...authorMap.entries()]
      .sort((a,b) => b[1]-a[1])
      .slice(0,3)
      .map(([author,count]) => ({ author, count }));

    // ---- Longest streak logic ----
    const storedLongest = user.statistics?.longestStreak || 0;
    const longestStreak = dynamicStreak > storedLongest ? dynamicStreak : storedLongest;

    // ---- days / weeks since registration ----
    const daysSinceRegistration = user.daysSinceRegistration || 0;
    const weeksSinceRegistration = user.weeksSinceRegistration || 0;

    // ---- Build response stats ----
    const safeStats = {
      totalQuotes,
      currentStreak: dynamicStreak,
      longestStreak,
      favoriteAuthors: favoriteAuthors.map(a => a.author), // Backward compatibility: array of strings
      monthlyQuotes: currentMonthQuotes, // expose numeric current month count (legacy field name)
      todayQuotes,
      daysSinceRegistration,
      weeksSinceRegistration,
      // New scoped fields
      scope,
      quotes: scopedQuotes // Quotes for the requested scope (week/month/global)
    };

    // Add scope-specific aliases for backward compatibility and clarity
    if (scope === 'week') {
      safeStats.weeklyQuotes = scopedQuotes;
    } else if (scope === 'global') {
      safeStats.globalQuotes = scopedQuotes;
    } else if (scope === 'month') {
      safeStats.monthScopedQuotes = scopedQuotes;
    }

    // Add week metadata if requested
    if (weekMeta) {
      safeStats.weekMeta = weekMeta;
    }

    // ---- Async snapshot update (do not await) ----
    (async () => {
      try {
        const month = businessNow.getMonth() + 1;
        const year = businessNow.getFullYear();
        const statsUpdate = user.statistics || {};
        statsUpdate.totalQuotes = totalQuotes;
        statsUpdate.currentStreak = dynamicStreak;
        if (longestStreak > storedLongest) statsUpdate.longestStreak = longestStreak;
        statsUpdate.favoriteAuthors = favoriteAuthors.map(a => a.author);

        // Update monthlyQuotes array structure
        if (!Array.isArray(statsUpdate.monthlyQuotes)) statsUpdate.monthlyQuotes = [];
        let monthEntry = statsUpdate.monthlyQuotes.find(m => m.month === month && m.year === year);
        if (!monthEntry) {
          monthEntry = { month, year, count: currentMonthQuotes };
          statsUpdate.monthlyQuotes.push(monthEntry);
        } else {
          monthEntry.count = currentMonthQuotes;
        }

        // Persist
        await UserProfile.updateOne(
          { _id: user._id },
          { $set: { statistics: statsUpdate, lastActiveAt: new Date() } }
        );
      } catch (innerErr) {
        console.warn('[stats] async snapshot update failed:', innerErr.message);
      }
    })();

    return res.json({ success: true, stats: safeStats });
  } catch (error) {
    console.error('❌ Stats Error (dynamic):', error);
    return res.status(200).json({
      success: true,
      stats: {
        totalQuotes: 0,
        currentStreak: 0,
        longestStreak: 0,
        favoriteAuthors: [],
        monthlyQuotes: 0,
        todayQuotes: 0,
        daysSinceRegistration: 0,
        weeksSinceRegistration: 0
      },
      warning: 'dynamic-fallback'
    });
  }
});

// ===========================================
// 📝 УПРАВЛЕНИЕ ЦИТАТАМИ
// ===========================================

/**
 * @description Добавление новой цитаты с AI анализом (лимит 10/день)
 * @route POST /api/reader/quotes
 */
router.post('/quotes', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { text, author, source, isFavorite } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    // Проверяем лимит цитат
    const todayQuotes = await Quote.getTodayQuotesCount(userId);
    if (todayQuotes >= 10) {
      return res.status(429).json({
        success: false,
        error: 'Daily limit of 10 quotes exceeded'
      });
    }

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Основная логика добавления цитаты
    try {
      const result = await quoteHandler.handleQuote(userId, text, author, source);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message
        });
      }

      // --- Обработка VersionError ---
      try {
        await user.updateQuoteStats(result.quote.author);
      } catch (err) {
        if (err.name === 'VersionError') {
          const freshUser = await UserProfile.findOne({ userId });
          if (freshUser) {
            await freshUser.updateQuoteStats(result.quote.author);
          }
          console.warn('VersionError при обновлении статистики, выполнен повторный save');
        } else {
          throw err;
        }
      }
      // --- конец обработки VersionError ---

      // Handle isFavorite parameter
      if (isFavorite === true && result.quote) {
        try {
          result.quote.isFavorite = true;
          result.quote.editedAt = new Date();
          await result.quote.save();
        } catch (err) {
          console.warn('Error setting quote as favorite:', err);
          // Don't fail the entire request if favorite setting fails
        }
      }

      // Генерация "Ответа Анны" (summary)
      let annaSummary = '';
      try {
        annaSummary = await quoteHandler.generateAnnaResponse(
          { text: result.quote.text, author: result.quote.author },
          { category: result.quote.category, themes: result.quote.themes, sentiment: result.quote.sentiment },
          result.todayCount,
          userId
        );
      } catch (err) {
        annaSummary = '';
      }

      const responseData = {
        success: true,
        quote: toQuoteDTO(result.quote, { summary: annaSummary }),
        newAchievements: result.newAchievements || [],
        todayCount: result.todayCount
      };

      // Send achievement notifications if enabled
      if (result.newAchievements && result.newAchievements.length > 0) {
        const user = await UserProfile.findOne({ userId });
        const settings = normalizeSettings(user);
        
        if (settings && settings.achievements.enabled && global.simpleTelegramBot) {
          try {
            for (const achievement of result.newAchievements) {
              const message = `🎉 Новое достижение: ${achievement.title || achievement.id || achievement.achievementId}`;
              await global.simpleTelegramBot.telegram.sendMessage(userId, message);
              console.log(`🎉 Achievement notification sent to user ${userId}: ${achievement.title || achievement.id}`);
            }
          } catch (notificationError) {
            console.error('❌ Failed to send achievement notifications:', notificationError);
            // Don't fail the main request if notification fails
          }
        }
      }

      return res.json(responseData);

    } catch (error) {
      // Ошибка внутри вложенного try
      console.error('❌ Inner Add Quote Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } catch (error) { // <-- ДОБАВЬ ЭТО!
    // Ошибка во внешнем try
    console.error('❌ Add Quote Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
    
/**
 * @description Получение цитат пользователя (пагинация / фильтры)
 * @route GET /api/reader/quotes
 */
router.get('/quotes', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      limit = 20,
      offset = 0,
      author,
      search,
      dateFrom,
      dateTo,
      weekNumber,
      year,
      monthNumber
    } = req.query;

    const query = { userId };
    console.log('QUERY FOR QUOTES:', query);
    
    if (req.query.favorites) {
      query.isFavorite = true;
    }
    
    if (author) {
      query.author = new RegExp(author, 'i');
    }

    if (search) {
      query.$or = [
        { text: new RegExp(search, 'i') },
        { author: new RegExp(search, 'i') },
        { source: new RegExp(search, 'i') }
      ];
    }

    // ISO week filtering (takes precedence over date range)
    if (weekNumber && year) {
      query.weekNumber = parseInt(weekNumber);
      query.yearNumber = parseInt(year);
    }
    
    // ISO month filtering (takes precedence over date range)
    else if (monthNumber && year) {
      query.monthNumber = parseInt(monthNumber);
      query.yearNumber = parseInt(year);
    }
    
    // Legacy date range filtering (used when ISO week/month not specified)
    else if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const quotes = await Quote.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Quote.countDocuments(query);

    // enrichment для user
    const userIds = [...new Set(quotes.map(q => String(q.userId)))];
    const users = await UserProfile.find(
      { userId: { $in: userIds } },
      { userId: 1, name: 1, telegramUsername: 1, email: 1 }
    ).lean();
    const userMap = users.reduce((map, user) => {
      map[user.userId] = user;
      return map;
    }, {});

  const enrichedQuotes = quotes.map(q => {
    const user = userMap[q.userId] ? {
      id: userMap[q.userId].userId,
      name: userMap[q.userId].name,
      username: userMap[q.userId].telegramUsername,
      email: userMap[q.userId].email
    } : undefined;
    
    return toQuoteDTO(q, { user });
  });

res.json({
    success: true,
    quotes: enrichedQuotes,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: total > parseInt(offset) + parseInt(limit)
    }
  });

  } catch (error) {
    console.error('❌ Get Quotes Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Последние цитаты
 * @route GET /api/reader/quotes/recent
 */
router.get('/quotes/recent', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 10 } = req.query;

    const quotes = await Quote.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      quotes: quotes.map(q => toQuoteDTO(q))
    });
  } catch (error) {
    console.error('❌ Get Recent Quotes Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Детали цитаты
 * @route GET /api/reader/quotes/:id
 */
router.get('/quotes/:id', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const quote = await Quote.findOne({ _id: req.params.id, userId });

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    const weekQuotes = await Quote.getWeeklyQuotes(userId, quote.weekNumber, quote.yearNumber);
    const totalQuotes = await Quote.countDocuments({ userId });
    const positionInWeek = weekQuotes.findIndex(q => q._id.toString() === quote._id.toString()) + 1;

    res.json({
      success: true,
      quote: toQuoteDTO(quote),
      context: {
        weekNumber: quote.weekNumber,
        yearNumber: quote.yearNumber,
        positionInWeek,
        totalInWeek: weekQuotes.length,
        totalQuotes
      }
    });
  } catch (error) {
    console.error('❌ Get Quote Details Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Редактирование цитаты с повторным AI анализом
 * @route PUT /api/reader/quotes/:id
 */
router.put('/quotes/:id', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { text, author, source, isFavorite } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const quote = await Quote.findOne({ _id: req.params.id, userId });
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    try {
      const parsedQuote = quoteHandler._parseQuote(author ? `"${text}" (${author})` : text);
      const analysis = await quoteHandler._analyzeQuote(parsedQuote.text, parsedQuote.author);

      quote.text = text.trim();
      quote.author = author ? author.trim() : null;
      quote.source = source ? source.trim() : null;
      quote.category = analysis.category;
      quote.themes = analysis.themes;
      quote.sentiment = analysis.sentiment;
      quote.insights = analysis.insights;
      quote.isEdited = true;
      quote.editedAt = new Date();
      
      if (typeof isFavorite !== 'undefined') {
        quote.isFavorite = !!isFavorite;
      }
      await quote.save();
    } catch (aiError) {
      console.warn(`⚠️ AI анализ при редактировании неудачен, fallback: ${aiError.message}`);

      
      quote.text = text.trim();
      quote.author = author ? author.trim() : null;
      quote.source = source ? source.trim() : null;
      quote.isEdited = true;
      quote.editedAt = new Date();
      
      if (typeof isFavorite !== 'undefined') {
        quote.isFavorite = !!isFavorite;
      }
      await quote.save();
    }

    res.json({
      success: true,
      quote: toQuoteDTO(quote)
    });

  } catch (error) {
    console.error('❌ Edit Quote Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Отдельный AI анализ текста (без сохранения)
 * @route POST /api/reader/quotes/analyze
 */
router.post('/quotes/analyze', telegramAuth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const parsedQuote = quoteHandler._parseQuote(text);
    const analysis = await quoteHandler._analyzeQuote(parsedQuote.text, parsedQuote.author);

    res.json({
      success: true,
      analysis: {
        originalText: text,
        parsedText: parsedQuote.text,
        parsedAuthor: parsedQuote.author,
        category: analysis.category,
        themes: analysis.themes,
        sentiment: analysis.sentiment,
        insights: analysis.insights
      },
      aiAnalysis: {
        summary: '',
        insights: analysis.insights,
        category: analysis.category,
        themes: analysis.themes,
        sentiment: analysis.sentiment
      }
    });

  } catch (error) {
    console.error('❌ Analyze Quote Error:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      details: error.message
    });
  }
});

/**
 * @description Поиск по цитатам (подсветка совпадений)
 * @route GET /api/reader/quotes/search
 */
router.get('/quotes/search', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { q: searchQuery, limit = 20 } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const quotes = await Quote.searchUserQuotes(userId, searchQuery.trim(), parseInt(limit));

    const highlightedQuotes = quotes.map(quote => {
      const searchRegex = new RegExp(`(${searchQuery.trim()})`, 'gi');
      
      // Create a copy of the quote with highlighted search terms
      const highlightedQuote = { ...quote };
      highlightedQuote.text = quote.text.replace(searchRegex, '<mark>$1</mark>');
      highlightedQuote.author = quote.author ? quote.author.replace(searchRegex, '<mark>$1</mark>') : null;
      highlightedQuote.source = quote.source ? quote.source.replace(searchRegex, '<mark>$1</mark>') : null;
      
      // Use toQuoteDTO to ensure aiAnalysis is included
      const standardQuote = toQuoteDTO(highlightedQuote);
      
      // Add search-specific fields
      return {
        ...standardQuote,
        originalText: quote.text,
        originalAuthor: quote.author,
        originalSource: quote.source,
        ageInDays: quote.ageInDays
      };
    });

    res.json({
      success: true,
      searchQuery: searchQuery.trim(),
      totalFound: quotes.length,
      quotes: highlightedQuotes
    });

  } catch (error) {
    console.error('❌ Search Quotes Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Удаление цитаты
 * @route DELETE /api/reader/quotes/:id
 */
router.delete('/quotes/:id', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const quote = await Quote.findOne({ _id: req.params.id, userId });

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    await quote.deleteOne();

    res.json({
      success: true,
      message: 'Quote deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete Quote Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// 📊 ОТЧЕТЫ
// ===========================================

/**
 * @description Получение еженедельных отчётов (query-based для обратной совместимости)
 * @route GET /api/reader/reports/weekly
 */
router.get('/reports/weekly', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 5, offset = 0 } = req.query;

    const reports = await WeeklyReport.find({ userId })
      .sort({ sentAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('quotes');

    res.json({
      success: true,
      reports: reports.map(r => {
        const { getISOWeekRange, formatISOWeekLabel } = require('../utils/isoWeek');
        const weekRange = getISOWeekRange(r.weekNumber, r.year);
        
        return {
          id: r._id,
          weekNumber: r.weekNumber,
          year: r.year,
          quotesCount: r.quotesCount,
          analysis: r.analysis,
          recommendations: r.recommendations,
          sentAt: r.sentAt,
          isRead: r.isRead,
          // Week metadata for proper period display
          weekMeta: {
            weekNumber: r.weekNumber,
            year: r.year,
            range: {
              start: weekRange.start,
              end: weekRange.end
            },
            label: formatISOWeekLabel(r.weekNumber, r.year)
          }
        };
      })
    });

  } catch (error) {
    console.error('❌ Get Weekly Reports Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получение еженедельных отчётов по path-параметру (совместимо с продом)
 * @route GET /api/reader/reports/weekly/:userId
 */
router.get('/reports/weekly/:userId', telegramAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const reports = await WeeklyReport.find({ userId })
      .populate('quotes', 'text author category createdAt')
      .sort({ sentAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const mapReport = (r) => {
      const { getISOWeekRange, formatISOWeekLabel } = require('../utils/isoWeek');
      const weekRange = getISOWeekRange(r.weekNumber, r.year);
      
      // Calculate metrics if not present but we have quotes
      let metrics = r.metrics;
      if (!metrics && r.quotes && Array.isArray(r.quotes)) {
        const quotes = r.quotes.filter(q => q); // Remove null/undefined quotes
        const quotesCount = quotes.length;
        const uniqueAuthors = new Set(
          quotes
            .filter(quote => quote.author && quote.author.trim())
            .map(quote => quote.author.trim())
        ).size;
        const activeDays = new Set(
          quotes
            .filter(quote => quote.createdAt)
            .map(quote => new Date(quote.createdAt).toISOString().split('T')[0])
        ).size;
        const targetQuotes = 30;
        const progressQuotesPct = Math.min(Math.round((quotesCount / targetQuotes) * 100), 100);
        const progressDaysPct = Math.min(Math.round((activeDays / 7) * 100), 100);

        metrics = {
          quotes: quotesCount,
          uniqueAuthors,
          activeDays,
          targetQuotes,
          progressQuotesPct,
          progressDaysPct
        };
      }
      
      return {
        id: r._id,
        weekNumber: r.weekNumber,
        year: r.year,
        quotesCount: Array.isArray(r.quotes) ? r.quotes.length : (r.quotesCount || 0),
        sentAt: r.sentAt,
        isRead: r.isRead,
        feedback: r.feedback,
        // Include quotes array for frontend calculation if needed
        quotes: r.quotes || [],
        // Include metrics if available (either from DB or calculated)
        metrics: metrics,
        // Week metadata for proper period display
        weekMeta: {
          weekNumber: r.weekNumber,
          year: r.year,
          range: {
            start: weekRange.start,
            end: weekRange.end
          },
          label: formatISOWeekLabel(r.weekNumber, r.year)
        },
        // Backward compatibility top-level fields
        dominantThemes: r.analysis?.dominantThemes || [],
        emotionalTone: r.analysis?.emotionalTone || '',
        // Full analysis block for Mini App UI
        analysis: {
          summary: r.analysis?.summary || '',
          insights: r.analysis?.insights || '',
          emotionalTone: r.analysis?.emotionalTone || '',
          dominantThemes: r.analysis?.dominantThemes || []
        },
        recommendations: r.recommendations || []
      };
    };

    return res.json({
      success: true,
      data: {
        userId,
        reports: reports.map(mapReport),
        total: reports.length
      }
    });
  } catch (error) {
    console.error('❌ Get Weekly Reports (path) Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получение месячных отчётов
 * @route GET /api/reader/reports/monthly
 */
router.get('/reports/monthly', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 3, offset = 0 } = req.query;

    const reports = await MonthlyReport.find({ userId })
      .sort({ sentAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({
      success: true,
      reports: reports.map(r => ({
        id: r._id,
        month: r.month,
        year: r.year,
        monthStats: r.monthStats,
        analysis: r.analysis,
        specialOffer: r.specialOffer,
        sentAt: r.sentAt,
        hasSurveyResponse: r.hasSurveyResponse,
        hasFeedback: r.hasFeedback
      }))
    });

  } catch (error) {
    console.error('❌ Get Monthly Reports Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// 📚 КАТАЛОГ КНИГ
// ===========================================

/**
 * @description Получение каталога книг
 * @route GET /api/reader/catalog
 */
router.get('/catalog', async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;

    const query = { isActive: true };
    if (category) query.categories = category;

    const books = await BookCatalog.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await BookCatalog.countDocuments(query);

    res.json({
      success: true,
      books: books.map(b => ({
        id: b._id,
        title: b.title,
        author: b.author,
        description: b.description,
        price: b.price,
        priceRub: b.priceRub,
        priceByn: b.priceByn,
        categories: b.categories,
        bookSlug: b.bookSlug,
        utmLink: b.utmLink
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Get Catalog Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Персональные рекомендации книг
 * @route GET /api/reader/recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UserProfile.findOne({ userId });

    const userThemes = user?.preferences?.mainThemes || [];
    const favoriteCategories = user?.statistics?.favoriteAuthors || []; // пока не используется

    let recommendations = await BookCatalog.getRecommendationsByThemes(userThemes, 3);
    if (recommendations.length < 2) {
      const universal = await BookCatalog.getUniversalRecommendations(2 - recommendations.length);
      recommendations = recommendations.concat(universal);
    }

    res.json({
      success: true,
      recommendations: recommendations.map(book => ({
        id: book._id,
        title: book.title,
        author: book.author,
        description: book.description,
        price: book.price,
        reasoning: book.reasoning,
        utmLink: book.utmLink
      }))
    });

  } catch (error) {
    console.error('❌ Get Recommendations Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/reader/catalog/track-click
 */
router.post('/catalog/track-click', async (req, res) => {
  try {
    const userId = String(req.query.userId || req.body.userId || 'demo-user');
    const { bookSlug, bookId } = req.body || {};

    let slug = (bookSlug || '').toString().trim().toLowerCase();
    if (!slug && bookId) {
      const book = await BookCatalog.findById(bookId).select({ bookSlug: 1 }).lean();
      if (book?.bookSlug) slug = String(book.bookSlug).toLowerCase();
    }
    if (!slug) return res.status(400).json({ success: false, error: 'bookSlug or bookId required' });

    await UTMClick.create({
      userId,
      source: 'telegram_bot',
      medium: 'mini_app',
      campaign: 'catalog',
      content: slug,
      timestamp: new Date()
    });

    return res.json({ success: true });
  } catch (e) {
    console.error('track-click error:', e);
    return res.status(500).json({ success: false, error: 'server error' });
  }
});

/**
 * @route GET /api/reader/top-books?period=7d or GET /api/reader/top-books?scope=week
 */
router.get('/top-books', async (req, res) => {
  try {
    const { period: periodParam, scope, weekNumber, year } = req.query;
    let startDate;
    let matchCriteria = { campaign: 'catalog' };
    
    if (scope === 'week') {
      // Use ISO week filtering
      const { 
        getBusinessNow, 
        getISOWeekInfo,
        getISOWeekRange
      } = require('../utils/isoWeek');
      
      const currentWeek = getISOWeekInfo(getBusinessNow());
      const targetWeek = parseInt(weekNumber) || currentWeek.isoWeek;
      const targetYear = parseInt(year) || currentWeek.isoYear;
      
      const weekRange = getISOWeekRange(targetWeek, targetYear);
      startDate = weekRange.start;
      const endDate = weekRange.end;
      
      matchCriteria.timestamp = { $gte: startDate, $lte: endDate };
    } else {
      // Legacy period logic for backwards compatibility
      const period = String(periodParam || '7d');
      const now = new Date();
      startDate = new Date(now);
      const m = period.match(/^(\d+)([dwm])$/i);
      if (m) {
        const val = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        if (unit === 'd') startDate.setDate(now.getDate() - val);
        if (unit === 'w') startDate.setDate(now.getDate() - val * 7);
        if (unit === 'm') startDate.setMonth(now.getMonth() - val);
      } else {
        startDate.setDate(now.getDate() - 7);
      }
      
      matchCriteria.timestamp = { $gte: startDate };
    }

    const clicksAgg = await UTMClick.aggregate([
      { $match: matchCriteria },
      { $group: { _id: '$content', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 3 }
    ]);

    const slugs = clicksAgg.map(a => (a._id || '').toLowerCase()).filter(Boolean);

    // Use same criteria for purchases
    const purchaseMatchCriteria = { ...matchCriteria, booksPurchased: { $exists: true, $ne: [] } };
    const purchasesAgg = await PromoCodeUsage.aggregate([
      { $match: purchaseMatchCriteria },
      { $unwind: '$booksPurchased' },
      { $group: { _id: { book: '$booksPurchased' }, purchases: { $sum: 1 } } }
    ]);

    const purchasesMap = new Map();
    for (const row of purchasesAgg) {
      const key = String(row._id.book || '').toLowerCase();
      if (!key) continue;
      purchasesMap.set(key, (purchasesMap.get(key) || 0) + row.purchases);
    }

    const books = await BookCatalog.find({ bookSlug: { $in: slugs } })
      .select({ title: 1, author: 1, bookSlug: 1 })
      .lean();
    const bySlug = new Map(books.map(b => [String(b.bookSlug).toLowerCase(), b]));

    const data = clicksAgg.map(row => {
      const slug = String(row._id || '').toLowerCase();
      const b = bySlug.get(slug);
      const sales = purchasesMap.get(slug) || 0;
      return {
        id: b?._id || slug,
        title: b?.title || slug,
        author: b?.author || '',
        clicksCount: row.clicks,
        salesCount: sales
      };
    });

    return res.json({ success: true, data });
  } catch (e) {
    console.error('top-books error:', e);
    return res.status(500).json({ success: false, error: 'server error' });
  }
});

// ===========================================
// 👥 СООБЩЕСТВО
// ===========================================

/**
 * @description Последние цитаты сообщества
 * @route GET /api/reader/community/quotes/latest
 */
router.get('/community/quotes/latest', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const { limit: limitParam } = req.query;
    const { limit, isValid } = validateLimit(limitParam, 10, 50);
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid limit parameter. Must be between 1 and 50.' 
      });
    }

    // Fetch latest quotes sorted by createdAt desc, tie-breaker _id
    const quotes = await Quote.find({})
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .select({
        _id: 1,
        text: 1,
        author: 1,
        source: 1,
        category: 1,
        themes: 1,
        sentiment: 1,
        insights: 1,
        isEdited: 1,
        editedAt: 1,
        createdAt: 1,
        isFavorite: 1,
        userId: 1 // Keep userId (do NOT delete)
      })
      .lean();

    // Get user info for each quote
    const userIds = [...new Set(quotes.map(q => String(q.userId)))];
    const users = await UserProfile.find(
      { userId: { $in: userIds } },
      { userId: 1, name: 1, avatarUrl: 1 }
    ).lean();
    const userMap = new Map(users.map(u => [String(u.userId), u]));

    // Collect unique (text, author) pairs for favorites aggregation using normalized fields
    const uniquePairs = [];
    const pairMap = new Map();
    const normalizedToOriginalMap = new Map();
    
    quotes.forEach(q => {
      const normalizedText = safeNormalize(q.text);
      const normalizedAuthor = safeNormalize(q.author || '');
      const normalizedKey = toNormalizedKey(q.text, q.author || '');
      const originalKey = `${q.text.trim()}|||${(q.author || '').trim()}`;
      
      if (!pairMap.has(normalizedKey)) {
        pairMap.set(normalizedKey, { text: q.text, author: q.author });
        uniquePairs.push({ normalizedText, normalizedAuthor });
        normalizedToOriginalMap.set(normalizedKey, originalKey);
      } else {
        // Multiple original keys may map to same normalized key
        normalizedToOriginalMap.set(normalizedKey, originalKey);
      }
    });

    // Get favorites count from Favorites collection (new system)
    const Favorite = require('../models/Favorite');
    const normalizedKeys = uniquePairs.map(pair => `${pair.normalizedText}|||${pair.normalizedAuthor}`);
    const favoritesCounts = await Favorite.getCountsForKeys(normalizedKeys);
    
    // Backward compatibility: also get counts from legacy Quote.isFavorite=true
    const legacyFavoritesAgg = await Quote.aggregate([
      {
        $match: { isFavorite: true }
      },
      {
        $addFields: {
          computedNormalizedText: {
            $ifNull: ['$normalizedText', '$text']
          },
          computedNormalizedAuthor: {
            $ifNull: ['$normalizedAuthor', { $ifNull: ['$author', ''] }]
          }
        }
      },
      {
        $match: {
          $expr: {
            $in: [
              { $concat: ['$computedNormalizedText', '|||', '$computedNormalizedAuthor'] },
              normalizedKeys
            ]
          }
        }
      },
      {
        $group: {
          _id: { 
            normalizedText: '$computedNormalizedText', 
            normalizedAuthor: '$computedNormalizedAuthor' 
          },
          userIds: { $addToSet: '$userId' }
        }
      }
    ]);

    // Merge favorites counts with backward-compat (union of userIds to avoid double counting)
    const favoritesMap = new Map();
    quotes.forEach(q => {
      const qNormText = safeNormalize(q.text);
      const qNormAuthor = safeNormalize(q.author || '');
      const normalizedKey = toNormalizedKey(q.text, q.author || '');
      const originalKey = `${q.text.trim()}|||${(q.author || '').trim()}`;
      
      // Get count from new Favorites system
      const newSystemCount = favoritesCounts.get(normalizedKey) || 0;
      
      // Get userIds from legacy system
      const legacyData = legacyFavoritesAgg.find(item => 
        item._id.normalizedText === qNormText && item._id.normalizedAuthor === qNormAuthor
      );
      const legacyUserIds = legacyData ? legacyData.userIds : [];
      
      // For backward compatibility, use max of the two counts
      // (we can't perfectly dedupe without fetching all Favorite docs, so we use max as approximation)
      const mergedCount = Math.max(newSystemCount, legacyUserIds.length);
      
      favoritesMap.set(originalKey, mergedCount);
    });

    // Get likedByMe status for current user
    const currentUserId = req.userId;
    let likedByMeSet = new Set();
    
    if (currentUserId) {
      const likedFavorites = await Favorite.find(
        { 
          userId: currentUserId,
          normalizedKey: { $in: normalizedKeys }
        },
        { normalizedKey: 1 }
      ).lean();
      
      likedByMeSet = new Set(likedFavorites.map(f => f.normalizedKey));
    }

    // Get origin user IDs (first creator) for consistent attribution across endpoints
    const quotePairs = quotes.map(q => ({ text: q.text, author: q.author || '' }));
    const originUserMap = await getOriginUserIds(quotePairs);
    
    // Collect all needed user IDs (both current and origin users)
    const originUserIds = [...originUserMap.values()].filter(Boolean).map(String);
    const allUserIds = [...new Set([...userIds, ...originUserIds])];
    
    // Fetch all users (including origin users not in original userMap)
    const allUsers = await UserProfile.find(
      { userId: { $in: allUserIds } },
      { userId: 1, name: 1, avatarUrl: 1, telegramUsername: 1 }
    ).lean();
    const fullUserMap = new Map(allUsers.map(u => [String(u.userId), u]));

    // Enrich each quote with user info, favorites count, and likedByMe
    const enrichedQuotes = quotes.map(q => {
      // Use origin user (first creator) for consistent attribution
      const originKey = `${q.text}|||${q.author || ''}`;
      const originUserId = originUserMap.get(originKey);
      const user = originUserId 
        ? fullUserMap.get(String(originUserId)) 
        : fullUserMap.get(String(q.userId));
      
      const favoritesKey = `${q.text.trim()}|||${(q.author || '').trim()}`;
      const favoritesCount = favoritesMap.get(favoritesKey) || 0;
      
      const normalizedKey = toNormalizedKey(q.text, q.author || '');
      
      // Build display name with fallback chain
      const displayName = user?.name || 
                         (user?.telegramUsername ? `@${user.telegramUsername}` : null) || 
                         'Пользователь';
      
      return {
        ...q,
        // Keep userId (do NOT delete as per spec)
        user: user ? {
          userId: user.userId,
          name: displayName,
          avatarUrl: user.avatarUrl
        } : null,
        favorites: favoritesCount,
        likedByMe: likedByMeSet.has(normalizedKey)
      };
    });

    // ✅ ВОТ ЭТО НУЖНО ДОБАВИТЬ:
    res.json({
      success: true,
      data: enrichedQuotes
    });

  } catch (error) {
    console.error('❌ Get Latest Community Quotes Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Популярные цитаты сообщества с поддержкой ISO недель
 * @route GET /api/reader/community/popular
 */
router.get('/community/popular', telegramAuth, communityLimiter, async (req, res) => {
  try {
    // Получаем ISO неделю и год через utils
    const { getBusinessNow, getISOWeekInfo } = require('../utils/isoWeek');
    const currentWeek = getISOWeekInfo(getBusinessNow());
    const weekNumber = currentWeek.isoWeek;
    const yearNumber = currentWeek.isoYear;

    // Фильтруем по weekNumber и yearNumber
    const matchCriteria = { weekNumber, yearNumber };

    // Агрегация: выбираем топ-3 цитаты за ISO неделю using normalized fields
    const pipeline = [
      { $match: matchCriteria },
      {
        $addFields: {
          // Compute normalized fields on-the-fly if not present (for legacy docs)
          computedNormalizedText: {
            $ifNull: ['$normalizedText', '$text']
          },
          computedNormalizedAuthor: {
            $ifNull: ['$normalizedAuthor', { $ifNull: ['$author', ''] }]
          }
        }
      },
      { $group: {
          _id: { 
            normalizedText: '$computedNormalizedText', 
            normalizedAuthor: '$computedNormalizedAuthor' 
          },
          count: { $sum: 1 },
          latestCreated: { $max: '$createdAt' },
          firstId: { $first: '$_id' },
          // Keep sample original text/author for display
          sampleText: { $first: '$text' },
          sampleAuthor: { $first: '$author' },
          category: { $first: '$category' },
          sentiment: { $first: '$sentiment' },
          themes: { $first: '$themes' }
      }},
      { $sort: { count: -1, latestCreated: -1, firstId: 1 } },
      { $limit: 3 },
      { $project: {
          text: '$sampleText',
          author: '$sampleAuthor',
          count: 1,
          category: 1,
          sentiment: 1,
          themes: 1,
          _id: 0
      }}
    ];

    const popularQuotes = await Quote.aggregate(pipeline);

    // enrichment (origin user)
    const quotePairs = popularQuotes.map(pq => ({ text: pq.text, author: pq.author }));
    const originUserMap = await getOriginUserIds(quotePairs);
    const originUserIds = [...new Set([...originUserMap.values()].filter(Boolean))];
    const users = await UserProfile.find(
      { userId: { $in: originUserIds } },
      { userId: 1, name: 1, avatarUrl: 1 }
    ).lean();
    const userMap = new Map(users.map(u => [String(u.userId), u]));

    const enrichedPopularQuotes = popularQuotes.map(pq => {
      const key = `${pq.text}|||${pq.author}`;
      const originUserId = originUserMap.get(key);
      const user = userMap.get(String(originUserId));
      return {
        text: pq.text,
        author: pq.author,
        count: pq.count,
        category: pq.category,
        sentiment: pq.sentiment,
        themes: pq.themes,
        user: user ? {
          userId: user.userId,
          name: user.name,
          avatarUrl: user.avatarUrl
        } : {
          userId: originUserId || 'unknown',
          name: 'Пользователь',
          avatarUrl: null
        }
      };
    });

    // ОДИН return/res.json!
    return res.json({
      success: true,
      data: enrichedPopularQuotes,
      meta: {
        weekNumber,
        yearNumber,
        total: enrichedPopularQuotes.length
      }
    });

  } catch (error) {
    console.error('❌ Weekly Popular (ISO) Error:', error);
    return res.status(500).json({ success: false, error: 'POPULAR_WEEK_INTERNAL_ERROR' });
  }
});

/**
 * @description Популярные цитаты по лайкам за период
 * @route GET /api/reader/community/popular-favorites
 */
router.get('/community/popular-favorites', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const { 
      period: periodParam, 
      limit: limitParam,
      scope,
      weekNumber,
      year 
    } = req.query;

    let matchCriteria = { isFavorite: true };
    let period = periodParam;

    if (scope === 'week') {
      // Use ISO week filtering
      const { 
        getBusinessNow, 
        getISOWeekInfo 
      } = require('../utils/isoWeek');
      
      const currentWeek = getISOWeekInfo(getBusinessNow());
      const targetWeek = parseInt(weekNumber) || currentWeek.isoWeek;
      const targetYear = parseInt(year) || currentWeek.isoYear;
      
      matchCriteria = { 
        isFavorite: true,
        weekNumber: targetWeek, 
        yearNumber: targetYear 
      };
      period = `week-${targetYear}-${targetWeek}`;
    } else {
      // Use legacy period logic for backwards compatibility
      const { startDate, isValid: periodValid, period: validPeriod } = validatePeriod(periodParam);
      if (!periodValid) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid period. Use 7d, 30d, or scope=week with optional weekNumber/year.' 
        });
      }
      
      matchCriteria = {
        isFavorite: true,
        $or: [
          { editedAt: { $gte: startDate } },
          { createdAt: { $gte: startDate } }
        ]
      };
      period = validPeriod;
    }

    const { limit, isValid: limitValid } = validateLimit(limitParam, 10, 50);
    if (!limitValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid limit parameter. Must be between 1 and 50.' 
      });
    }

    // Build match criteria for Favorites collection based on time period
    const Favorite = require('../models/Favorite');
    let favoritesMatchCriteria = {};
    
    if (scope === 'week') {
      const { getBusinessNow, getISOWeekInfo, getISOWeekRange } = require('../utils/isoWeek');
      const currentWeek = getISOWeekInfo(getBusinessNow());
      const targetWeek = parseInt(weekNumber) || currentWeek.isoWeek;
      const targetYear = parseInt(year) || currentWeek.isoYear;
      
      // Calculate start/end dates for the ISO week
      const { start: startDate, end: endDate } = getISOWeekRange(targetWeek, targetYear);
      
      favoritesMatchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
    } else {
      const { startDate } = validatePeriod(periodParam);
      favoritesMatchCriteria = {
        createdAt: { $gte: startDate }
      };
    }

    // Aggregate from Favorites collection
    const favoritesAgg = await Favorite.aggregate([
      {
        $match: favoritesMatchCriteria
      },
      {
        $group: {
          _id: '$normalizedKey',
          userIds: { $addToSet: '$userId' },
          latestCreated: { $max: '$createdAt' },
          sampleText: { $first: '$text' },
          sampleAuthor: { $first: '$author' }
        }
      },
      {
        $addFields: {
          favoritesCount: { $size: '$userIds' }
        }
      },
      {
        $sort: { 
          favoritesCount: -1, 
          latestCreated: -1 
        }
      },
      {
        $limit: limit * 2 // Get more for backward-compat merge
      }
    ]);

    // Backward compatibility: also aggregate from legacy Quote.isFavorite=true
    const legacyFavoritesAgg = await Quote.aggregate([
      {
        $match: matchCriteria
      },
      {
        $addFields: {
          computedNormalizedText: {
            $ifNull: ['$normalizedText', '$text']
          },
          computedNormalizedAuthor: {
            $ifNull: ['$normalizedAuthor', { $ifNull: ['$author', ''] }]
          }
        }
      },
      {
        $group: {
          _id: {
            normalizedText: '$computedNormalizedText',
            normalizedAuthor: '$computedNormalizedAuthor'
          },
          userIds: { $addToSet: '$userId' },
          latestEdit: { $max: '$editedAt' },
          latestCreated: { $max: '$createdAt' },
          sampleText: { $first: '$text' },
          sampleAuthor: { $first: '$author' },
          sampleCategory: { $first: '$category' },
          sampleThemes: { $first: '$themes' }
        }
      }
    ]);

    // Merge both sources by normalizedKey, taking union of userIds
    const mergedMap = new Map();
    
    // Add from new Favorites system
    favoritesAgg.forEach(item => {
      mergedMap.set(item._id, {
        normalizedKey: item._id,
        userIds: new Set(item.userIds),
        text: item.sampleText,
        author: item.sampleAuthor,
        latestCreated: item.latestCreated,
        sampleCategory: null,
        sampleThemes: []
      });
    });
    
    // Merge from legacy system
    legacyFavoritesAgg.forEach(item => {
      const normalizedKey = toNormalizedKey(item.sampleText, item.sampleAuthor);
      const existing = mergedMap.get(normalizedKey);
      
      if (existing) {
        // Merge userIds (set union)
        item.userIds.forEach(uid => existing.userIds.add(uid));
        // Update metadata if newer
        if (!existing.latestCreated || item.latestCreated > existing.latestCreated) {
          existing.latestCreated = item.latestCreated;
        }
        existing.sampleCategory = existing.sampleCategory || item.sampleCategory;
        existing.sampleThemes = existing.sampleThemes.length > 0 ? existing.sampleThemes : item.sampleThemes;
      } else {
        mergedMap.set(normalizedKey, {
          normalizedKey,
          userIds: new Set(item.userIds),
          text: item.sampleText,
          author: item.sampleAuthor,
          latestCreated: item.latestCreated,
          sampleCategory: item.sampleCategory,
          sampleThemes: item.sampleThemes
        });
      }
    });

    // Convert to array and sort by favorites count
    const popularFavorites = Array.from(mergedMap.values())
      .map(item => ({
        text: item.text,
        author: item.author,
        favorites: item.userIds.size,
        sampleCategory: item.sampleCategory,
        sampleThemes: item.sampleThemes,
        firstUserId: Array.from(item.userIds)[0] // Use first for user lookup
      }))
      .sort((a, b) => {
        // Sort by favorites count desc, then by latestCreated desc
        if (b.favorites !== a.favorites) {
          return b.favorites - a.favorites;
        }
        return (b.latestCreated || 0) - (a.latestCreated || 0);
      })
      .slice(0, limit);

    // Get origin user IDs for each quote pair (earliest creator) - STRICT ATTRIBUTION ONLY
    const quotePairs = popularFavorites.map(pf => ({ text: pf.text, author: pf.author }));
    const originUserMap = await getOriginUserIds(quotePairs);

    // Collect only origin user IDs (no fallback to firstUserId)
    const allUserIds = new Set();
    popularFavorites.forEach(pf => {
      const key = `${pf.text}|||${pf.author}`;
      const originUserId = originUserMap.get(key);
      if (originUserId) {
        allUserIds.add(String(originUserId));
      }
    });

    // Get user profiles for all needed users (include telegramUsername for fallback)
    const users = await UserProfile.find(
      { userId: { $in: [...allUserIds] } },
      { userId: 1, name: 1, avatarUrl: 1, telegramUsername: 1 }
    ).lean();
    const userMap = new Map(users.map(u => [String(u.userId), u]));

    // Get likedByMe status for current user
    const currentUserId = req.userId;
    let likedByMeSet = new Set();
    
    if (currentUserId) {
      const normalizedKeys = popularFavorites.map(pf => toNormalizedKey(pf.text, pf.author || ''));
      
      const likedFavorites = await Favorite.find(
        { 
          userId: currentUserId,
          normalizedKey: { $in: normalizedKeys }
        },
        { normalizedKey: 1 }
      ).lean();
      
      likedByMeSet = new Set(likedFavorites.map(f => f.normalizedKey));
    }

    // Add user info to each popular favorite (STRICT ORIGIN ONLY)
    const enrichedPopularFavorites = popularFavorites.map(pf => {
      const key = `${pf.text}|||${pf.author}`;
      const originUserId = originUserMap.get(key);
      
      // Use ONLY origin user (no fallback to firstUserId)
      const user = originUserId ? userMap.get(String(originUserId)) : null;
      
      const normalizedKey = toNormalizedKey(pf.text, pf.author || '');
      
      const result = {
        text: pf.text,
        author: pf.author,
        favorites: pf.favorites,
        sampleCategory: pf.sampleCategory,
        sampleThemes: pf.sampleThemes,
        likedByMe: likedByMeSet.has(normalizedKey)
      };
      
      if (user) {
        // Build display name with fallback: name || @telegramUsername || 'Пользователь'
        const displayName = user.name || 
                           (user.telegramUsername ? `@${user.telegramUsername}` : null) || 
                           'Пользователь';
        
        result.user = {
          userId: user.userId,
          name: displayName,
          avatarUrl: user.avatarUrl
        };
      } else {
        // Only if no origin user found - should be rare
        result.user = {
          userId: 'unknown',
          name: 'Пользователь',
          avatarUrl: null
        };
      }
      
      return result;
    });

    const total = enrichedPopularFavorites.length;

    res.json({
      success: true,
      data: enrichedPopularFavorites,
      pagination: {
        period: period,
        limit: limit,
        total: total
      }
    });

  } catch (error) {
    console.error('❌ Get Popular Favorites Error:', error);
    // UPDATED: Return 200 with empty data instead of 500 to prevent UI breakage
    res.json({ 
      success: true, 
      data: [], 
      pagination: {
        period: req.query.period || '7d',
        limit: parseInt(req.query.limit) || 10,
        total: 0
      },
      error: 'Could not load popular favorites at this time'
    });
  }
});

/**
 * @description Недавние избранные цитаты сообщества (ТОЛЬКО из дневников пользователей)
 * @route GET /api/reader/community/favorites/recent
 */
router.get('/community/favorites/recent', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const { 
      hours: hoursParam, 
      limit: limitParam,
      scope,
      weekNumber,
      year 
    } = req.query;
    
    let matchCriteria = { isFavorite: true };
    let hours = 48; // Default value

    if (scope === 'week') {
      // Use ISO week filtering
      const { 
        getBusinessNow, 
        getISOWeekInfo 
      } = require('../utils/isoWeek');
      
      const currentWeek = getISOWeekInfo(getBusinessNow());
      const targetWeek = parseInt(weekNumber) || currentWeek.isoWeek;
      const targetYear = parseInt(year) || currentWeek.isoYear;
      
      matchCriteria = { 
        isFavorite: true,
        weekNumber: targetWeek, 
        yearNumber: targetYear 
      };
      hours = null; // Not applicable for week scope
    } else {
      // Legacy hours-based filtering for backwards compatibility
      const parsedHours = parseInt(hoursParam);
      hours = Number.isFinite(parsedHours) ? Math.min(Math.max(parsedHours, 1), 168) : 48;
      
      // Calculate start date based on hours
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      matchCriteria = {
        isFavorite: true,
        $or: [
          { editedAt: { $gte: startDate } },
          { createdAt: { $gte: startDate } }
        ]
      };
    }
    
    // Validate limit parameter (default 10, max 50)
    const { limit, isValid: limitValid } = validateLimit(limitParam, 10, 50);
    if (!limitValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid limit parameter. Must be between 1 and 50.' 
      });
    }

    // ✅ НОВАЯ ЛОГИКА: Возвращаем ТОЛЬКО Quote.isFavorite=true (из дневников)
    const recentFavorites = await Quote.aggregate([
      {
        $match: matchCriteria
      },
      {
        $sort: { 
          editedAt: -1, 
          createdAt: -1, 
          _id: -1 
        }
      },
      {
        $addFields: {
          computedNormalizedText: {
            $ifNull: ['$normalizedText', '$text']
          },
          computedNormalizedAuthor: {
            $ifNull: ['$normalizedAuthor', { $ifNull: ['$author', ''] }]
          }
        }
      },
      {
        $group: {
          _id: {
            normalizedText: '$computedNormalizedText',
            normalizedAuthor: '$computedNormalizedAuthor'
          },
          userIds: { $addToSet: '$userId' },
          latestEdit: { $max: '$editedAt' },
          latestCreated: { $max: '$createdAt' },
          sampleText: { $first: '$text' },
          sampleAuthor: { $first: '$author' }
        }
      },
      {
        $addFields: {
          latestTimestamp: {
            $max: ['$latestEdit', '$latestCreated']
          }
        }
      },
      {
        $sort: { 
          latestTimestamp: -1 
        }
      },
      {
        $limit: limit
      },
      {
        $project: {
          text: '$sampleText',
          author: '$sampleAuthor',
          favorites: { $size: '$userIds' },
          latestCreated: '$latestTimestamp',
          firstUserId: { $arrayElemAt: ['$userIds', 0] },
          _id: 0
        }
      }
    ]);

    // Handle empty results gracefully
    if (!recentFavorites || recentFavorites.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          hours: hours,
          limit: limit,
          total: 0
        }
      });
    }

    // Get origin user IDs for each quote pair (earliest creator) - STRICT ATTRIBUTION ONLY
    const quotePairs = recentFavorites.map(rf => ({ text: rf.text || '', author: rf.author || '' }));
    const originUserMap = await getOriginUserIds(quotePairs);

    // Collect only origin user IDs (no fallback to firstUserId)
    const allUserIds = new Set();
    recentFavorites.forEach(rf => {
      const key = `${rf.text}|||${rf.author}`;
      const originUserId = originUserMap.get(key);
      if (originUserId) {
        allUserIds.add(String(originUserId));
      }
    });

    // Get user profiles for all needed users (include telegramUsername for fallback)
    const users = await UserProfile.find(
      { userId: { $in: [...allUserIds] } },
      { userId: 1, name: 1, avatarUrl: 1, telegramUsername: 1 }
    ).lean();
    const userMap = new Map(users.map(u => [String(u.userId), u]));

    // Get likedByMe status for current user
    const currentUserId = req.userId;
    let likedByMeSet = new Set();
    
    if (currentUserId) {
      const Favorite = require('../models/Favorite');
      const normalizedKeys = recentFavorites.map(rf => toNormalizedKey(rf.text, rf.author || ''));
      
      const likedFavorites = await Favorite.find(
        { 
          userId: currentUserId,
          normalizedKey: { $in: normalizedKeys }
        },
        { normalizedKey: 1 }
      ).lean();
      
      likedByMeSet = new Set(likedFavorites.map(f => f.normalizedKey));
    }

    // Enrich each recent favorite with user info (STRICT ORIGIN ONLY)
    const enrichedRecentFavorites = recentFavorites.map(rf => {
      const key = `${rf.text}|||${rf.author}`;
      const originUserId = originUserMap.get(key);
      
      // Use ONLY origin user (no fallback to firstUserId)
      const user = originUserId ? userMap.get(String(originUserId)) : null;
      
      const normalizedKey = toNormalizedKey(rf.text, rf.author || '');
      
      const result = {
        text: rf.text,
        author: rf.author,
        favorites: rf.favorites,
        latestCreated: rf.latestCreated,
        likedByMe: likedByMeSet.has(normalizedKey)
      };
      
      if (user) {
        // Build display name with fallback: name || @telegramUsername || 'Пользователь'
        const displayName = user.name || 
                           (user.telegramUsername ? `@${user.telegramUsername}` : null) || 
                           'Пользователь';
        
        result.user = {
          userId: user.userId,
          name: displayName,
          avatarUrl: user.avatarUrl
        };
      } else {
        // Only if no origin user found - should be rare
        result.user = {
          userId: 'unknown',
          name: 'Пользователь',
          avatarUrl: null
        };
      }
      
      return result;
    });

    const total = enrichedRecentFavorites.length;

    res.json({
      success: true,
      data: enrichedRecentFavorites,
      pagination: {
        hours: hours,
        limit: limit,
        total: total
      }
    });

  } catch (error) {
    console.error('❌ Get Recent Favorites Error:', error);
    console.error('❌ Stack trace:', error.stack);
    // UPDATED: Return 200 with empty data instead of 500 to prevent UI breakage
    res.json({ 
      success: true, 
      data: [], 
      pagination: {
        hours: parseInt(req.query.hours) || 48,
        limit: parseInt(req.query.limit) || 10,
        total: 0
      },
      error: 'Could not load recent favorites at this time'
    });
  }
});

/**
 * @description Популярные книги сообщества с поддержкой ISO недель
 * @route GET /api/reader/community/popular-books
 */
router.get('/community/popular-books', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const { 
      scope, 
      weekNumber, 
      year, 
      limit: limitParam 
    } = req.query;
    
    // Enforce scope=week only as per requirements
    if (scope !== 'week') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid scope parameter. Only scope=week is supported for community popular books.' 
      });
    }
    
    const { limit, isValid: limitValid } = validateLimit(limitParam, 10, 20);
    if (!limitValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid limit parameter. Must be between 1 and 20.' 
      });
    }

    // Use ISO week filtering
    const { 
      getBusinessNow, 
      getISOWeekInfo,
      getISOWeekRange
    } = require('../utils/isoWeek');
    
    const currentWeek = getISOWeekInfo(getBusinessNow());
    const targetWeek = parseInt(weekNumber) || currentWeek.isoWeek;
    const targetYear = parseInt(year) || currentWeek.isoYear;
    
    const weekRange = getISOWeekRange(targetWeek, targetYear);
    const startDate = weekRange.start;
    const endDate = weekRange.end;

    // Aggregate clicks within the ISO week range
    const clicksAgg = await UTMClick.aggregate([
      { $match: { timestamp: { $gte: startDate, $lte: endDate }, campaign: 'catalog' } },
      { $group: { _id: '$content', clicks: { $sum: 1 }, firstClick: { $min: '$_id' } } },
      { $sort: { clicks: -1, firstClick: 1 } }, // Deterministic sorting
      { $limit: limit }
    ]);

    const slugs = clicksAgg.map(a => (a._id || '').toLowerCase()).filter(Boolean);

    // Aggregate purchases within the ISO week range
    const purchasesAgg = await PromoCodeUsage.aggregate([
      { $match: { timestamp: { $gte: startDate, $lte: endDate }, booksPurchased: { $exists: true, $ne: [] } } },
      { $unwind: '$booksPurchased' },
      { $group: { _id: { book: '$booksPurchased' }, purchases: { $sum: 1 } } }
    ]);

    const purchasesMap = new Map();
    for (const row of purchasesAgg) {
      const key = String(row._id.book || '').toLowerCase();
      if (!key) continue;
      purchasesMap.set(key, (purchasesMap.get(key) || 0) + row.purchases);
    }

    const books = await BookCatalog.find({ bookSlug: { $in: slugs } })
      .select({ title: 1, author: 1, bookSlug: 1 })
      .lean();
    const bySlug = new Map(books.map(b => [String(b.bookSlug).toLowerCase(), b]));

    const data = clicksAgg.map(row => {
      const slug = String(row._id || '').toLowerCase();
      const b = bySlug.get(slug);
      const sales = purchasesMap.get(slug) || 0;
      return {
        id: b?._id || slug,
        title: b?.title || slug,
        author: b?.author || '',
        clicksCount: row.clicks,
        salesCount: sales
      };
    });

    res.json({ 
      success: true, 
      data,
      pagination: {
        total: data.length,
        limit: limit,
        weekNumber: targetWeek,
        year: targetYear
      }
    });

  } catch (error) {
    console.error('❌ Get Popular Community Books Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Последние клики по каталогу (UTMClick + BookCatalog)
 * @route GET /api/reader/catalog/clicks/recent
 */
router.get('/catalog/clicks/recent', telegramAuth, async (req, res) => {
  try {
    const { limit: limitParam } = req.query;
    const { limit, isValid } = validateLimit(limitParam, 10, 50);
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid limit parameter. Must be between 1 and 50.' 
      });
    }

    // Get recent UTM clicks and join with BookCatalog
    const recentClicks = await UTMClick.aggregate([
      {
        $match: {
          campaign: 'catalog',
          content: { $exists: true, $ne: '' }
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'book_catalog',
          localField: 'content',
          foreignField: 'bookSlug',
          as: 'book'
        }
      },
      {
        $unwind: {
          path: '$book',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          timestamp: 1,
          source: 1,
          medium: 1,
          campaign: 1,
          bookSlug: '$content',
          book: {
            id: '$book._id',
            title: '$book.title',
            author: '$book.author',
            price: '$book.price'
          }
        }
      }
    ]);

    res.json({
      success: true,
      clicks: recentClicks,
      total: recentClicks.length
    });

  } catch (error) {
    console.error('❌ Get Recent Catalog Clicks Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Общая статистика сообщества
 * @route GET /api/reader/community/stats
 */
router.get('/community/stats', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const { scope } = req.query;
    
    const totalUsers = await UserProfile.countDocuments({ isOnboardingComplete: true });
    const totalQuotes = await Quote.countDocuments();

    let newQuotes, activeUsers;
    
    if (scope === 'week') {
      // Use ISO week calculation
      const { 
        getBusinessNow, 
        getISOWeekInfo 
      } = require('../utils/isoWeek');
      
      const businessNow = getBusinessNow();
      const currentWeek = getISOWeekInfo(businessNow);
      
      // Count quotes for current ISO week using weekNumber/yearNumber fields
      newQuotes = await Quote.countDocuments({ 
        weekNumber: currentWeek.isoWeek, 
        yearNumber: currentWeek.isoYear 
      });
      
      // For active users, use rolling 7 days as fallback (scope=week affects quote counts mainly)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      activeUsers = await UserProfile.countDocuments({
        lastActiveAt: { $gte: oneWeekAgo },
        isActive: true
      });
    } else {
      // Default behavior (rolling 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      activeUsers = await UserProfile.countDocuments({
        lastActiveAt: { $gte: oneWeekAgo },
        isActive: true
      });
      
      newQuotes = await Quote.countDocuments({ createdAt: { $gte: oneWeekAgo } });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const topAuthors = await Quote.getTopAuthors(oneWeekAgo);

    // Calculate dynamic daysActive from first quote in database
    const firstQuote = await Quote.findOne({}, { createdAt: 1 }).sort({ createdAt: 1 }).lean();
    const daysActive = firstQuote ? Math.max(1, Math.ceil((Date.now() - new Date(firstQuote.createdAt)) / 86400000)) : 0;

    res.json({
      success: true,
      data: {
        totalMembers: totalUsers,
        activeToday: activeUsers,
        totalQuotes,
        topAuthors: topAuthors.map(a => a._id).slice(0, 3),
        activeReaders: activeUsers,
        newQuotes,
        totalReaders: totalUsers,
        totalAuthors: topAuthors.length,
        daysActive: daysActive
      }
    });

  } catch (error) {
    console.error('❌ Get Community Stats Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Периодный рейтинг пользователей с поддержкой ISO недель
 * @route GET /api/reader/community/leaderboard
 */
router.get('/community/leaderboard', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const userId = req.userId;
    const { 
      limit: limitParam, 
      period: periodParam, 
      scope,
      weekNumber,
      year 
    } = req.query;

    const { limit, isValid: limitValid } = validateLimit(limitParam, 10, 50);
    if (!limitValid) return res.status(400).json({ success: false, error: 'Invalid limit parameter. Must be between 1 and 50.' });

    let matchCriteria = {};
    let period = periodParam;

    if (scope === 'week') {
      // Use ISO week filtering
      const { 
        getBusinessNow, 
        getISOWeekInfo 
      } = require('../utils/isoWeek');
      
      const currentWeek = getISOWeekInfo(getBusinessNow());
      const targetWeek = parseInt(weekNumber) || currentWeek.isoWeek;
      const targetYear = parseInt(year) || currentWeek.isoYear;
      
      matchCriteria = { 
        weekNumber: targetWeek, 
        yearNumber: targetYear 
      };
      period = `week-${targetYear}-${targetWeek}`;
    } else {
      // Use legacy period logic for backwards compatibility
      const { startDate, isValid: periodValid, period: validPeriod } = validatePeriod(periodParam);
      if (!periodValid) return res.status(400).json({ success: false, error: 'Invalid period parameter. Use 7d, 30d, or scope=week with optional weekNumber/year.' });
      
      matchCriteria = { createdAt: { $gte: startDate } };
      period = validPeriod;
    }

    const agg = await Quote.aggregate([
      { $match: matchCriteria },
      { $group: { _id: '$userId', quotesWeek: { $sum: 1 } } },
      { $sort: { quotesWeek: -1, _id: 1 } }
    ]);

    const participants = agg.length;
    const top = agg.slice(0, limit);
    const ids = new Set([...top.map(r => String(r._id)), String(userId)]);
    const users = await UserProfile.find({ userId: { $in: Array.from(ids) } }, { userId: 1, name: 1, avatarUrl: 1 }).lean();
    const byId = new Map(users.map(u => [String(u.userId), u]));
    // Remove masking - show full names as requested
    // const mask = (name) => (name ? name.charAt(0) + '***' : '***');

    const myIdx = agg.findIndex(r => String(r._id) === String(userId));
    const myCount = myIdx >= 0 ? agg[myIdx].quotesWeek : 0;
    const position = myIdx >= 0 ? (myIdx + 1) : (participants > 0 ? participants + 1 : 1);
    const leaderCount = agg[0]?.quotesWeek || 0;
    const nextAheadCount = myIdx > 0 ? agg[myIdx - 1].quotesWeek : (myIdx === -1 && participants > 0 ? agg[participants - 1].quotesWeek : myCount);
    const deltaToNext = position === 1 ? 0 : Math.max(0, (nextAheadCount - myCount) + 1);
    const thirdPlaceCount = agg[2]?.quotesWeek || 0;
    const deltaToTop3 = position <= 3 ? 0 : Math.max(0, (thirdPlaceCount - myCount) + 1);
    const deltaToLeader = position === 1 ? 0 : Math.max(0, (leaderCount - myCount) + 1);
    const lessCount = agg.filter(r => r.quotesWeek < myCount).length;
    let percentile = 50;
    if (participants > 0) {
      percentile = Math.round((lessCount / participants) * 100);
      if (percentile < 1) percentile = 1;
      if (percentile > 99) percentile = 99;
    }

    const me = { userId, quotesWeek: myCount, position, deltaToNext, deltaToTop3, deltaToLeader, percentile };

    const data = top.map((row, idx) => {
      const u = byId.get(String(row._id));
      return {
        position: idx + 1,
        name: u?.name || 'Пользователь', // Show full name instead of masked
        avatarUrl: u?.avatarUrl || null, // Include avatar URL
        quotes: row.quotesWeek,
        quotesWeek: row.quotesWeek,
        isCurrentUser: String(row._id) === String(userId)
      };
    });

    return res.json({ success: true, period, data, me, pagination: { total: data.length, limit } });
  } catch (error) {
    console.error('❌ Get Leaderboard Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Инсайты сообщества за период
 * @route GET /api/reader/community/insights
 */
router.get('/community/insights', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const userId = req.userId;
    const { period: periodParam, scope } = req.query;
    
    let startDate, period;
    
    if (scope === 'week') {
      // Use ISO week calculation
      const { 
        getBusinessNow, 
        getISOWeekInfo, 
        getISOWeekRange 
      } = require('../utils/isoWeek');
      
      const businessNow = getBusinessNow();
      const currentWeek = getISOWeekInfo(businessNow);
      const weekRange = getISOWeekRange(currentWeek.isoWeek, currentWeek.isoYear);
      
      startDate = weekRange.start;
      period = 'week';
    } else {
      // Use existing period validation
      const validation = validatePeriod(periodParam);
      if (!validation.isValid) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid period parameter. Use 7d or 30d, or scope=week.' 
        });
      }
      startDate = validation.startDate;
      period = validation.period;
    }

    // Previous period for growth calculation
    const periodDays = period === 'week' ? 7 : parseInt(period, 10);
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);

    // For ISO week scope, use weekNumber/yearNumber fields for quote aggregation
    let quoteMatchQuery, previousQuoteMatchQuery;
    
    if (scope === 'week') {
      const { 
        getBusinessNow, 
        getISOWeekInfo 
      } = require('../utils/isoWeek');
      
      const businessNow = getBusinessNow();
      const currentWeek = getISOWeekInfo(businessNow);
      
      // Previous week calculation  
      let prevWeek = currentWeek.isoWeek - 1;
      let prevYear = currentWeek.isoYear;
      if (prevWeek < 1) {
        prevYear -= 1;
        // Calculate weeks in previous year (simplified)
        prevWeek = 52; // Simplified, could use proper ISO calculation
      }
      
      quoteMatchQuery = { 
        weekNumber: currentWeek.isoWeek, 
        yearNumber: currentWeek.isoYear 
      };
      previousQuoteMatchQuery = { 
        weekNumber: prevWeek, 
        yearNumber: prevYear 
      };
    } else {
      quoteMatchQuery = { createdAt: { $gte: startDate } };
      previousQuoteMatchQuery = { 
        createdAt: { $gte: previousStartDate, $lt: startDate } 
      };
    }

    // Interest analysis: leader by catalog clicks (keep date-based for UTM clicks)
    const currentPeriodClicks = await UTMClick.aggregate([
      { $match: { timestamp: { $gte: startDate }, campaign: 'catalog' } },
      { $group: { _id: '$content', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 1 }
    ]);

    const previousPeriodClicks = await UTMClick.aggregate([
      { $match: { 
        timestamp: { $gte: previousStartDate, $lt: startDate }, 
        campaign: 'catalog' 
      } },
      { $group: { _id: '$content', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 1 }
    ]);

    // Count unique breakdown studies with clicks
    const activelyStudying = await UTMClick.distinct('content', {
      timestamp: { $gte: startDate },
      campaign: 'catalog'
    });

    // Growth percentage calculation
    const currentClicks = currentPeriodClicks[0]?.clicks || 0;
    const previousClicks = previousPeriodClicks[0]?.clicks || 0;
    let growthPct = 0;
    if (previousClicks > 0) {
      growthPct = Math.round(((currentClicks - previousClicks) / previousClicks) * 100);
    } else if (currentClicks > 0) {
      growthPct = 100;
    }

    // Find leader book details
    let leaderBook = null;
    if (currentPeriodClicks[0]) {
      leaderBook = await BookCatalog.findOne({ 
        bookSlug: currentPeriodClicks[0]._id 
      }, { title: 1, author: 1 }).lean();
    }

    const interest = {
      leader: leaderBook ? {
        title: leaderBook.title,
        author: leaderBook.author,
        clicks: currentClicks
      } : null,
      growthPct,
      activelyStudying: activelyStudying.length
    };

    // Top authors in quotes for the period (use appropriate match query)
    const topAuthors = await Quote.aggregate([
      { $match: quoteMatchQuery },
      { $group: { _id: '$author', count: { $sum: 1 } } },
      { $match: { _id: { $ne: null, $ne: '' } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
      { $project: { author: '$_id', count: 1, _id: 0 } }
    ]);

    // Community achievements by activity thresholds (use appropriate match query)
    const achievements = await Quote.aggregate([
      { $match: quoteMatchQuery },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $bucket: {
        groupBy: '$count',
        boundaries: [1, 3, 5, 7, 10, 20, Infinity],
        default: 'other',
        output: { users: { $sum: 1 } }
      }}
    ]);

    // User rating (reuse leaderboard logic)
    const userStats = await Quote.aggregate([
      { $match: quoteMatchQuery },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }
    ]);

    const userIndex = userStats.findIndex(u => String(u._id) === String(userId));
    const userCount = userIndex >= 0 ? userStats[userIndex].count : 0;
    const position = userIndex >= 0 ? userIndex + 1 : userStats.length + 1;
    const totalParticipants = userStats.length;
    
    const lessActiveCount = userStats.filter(u => u.count < userCount).length;
    let percentile = 50;
    if (totalParticipants > 0) {
      percentile = Math.round((lessActiveCount / totalParticipants) * 100);
      percentile = Math.min(99, Math.max(1, percentile));
    }

    const userRating = { position, percentile };

    const insights = {
      interest,
      topAuthors,
      achievements: achievements.map(a => ({
        threshold: a._id === 'other' ? '20+' : `${a._id}+`,
        users: a.users
      })),
      userRating
    };

    return res.json({ success: true, period, insights });
  } catch (error) {
    console.error('❌ Get Community Insights Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Интересный факт недели
 * @route GET /api/reader/community/fun-fact
 */
router.get('/community/fun-fact', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const { period: periodParam, scope } = req.query;
    
    let startDate, period;
    let quoteMatchQuery;
    
    if (scope === 'week') {
      // Use ISO week calculation
      const { 
        getBusinessNow, 
        getISOWeekInfo 
      } = require('../utils/isoWeek');
      
      const businessNow = getBusinessNow();
      const currentWeek = getISOWeekInfo(businessNow);
      
      quoteMatchQuery = { 
        weekNumber: currentWeek.isoWeek, 
        yearNumber: currentWeek.isoYear 
      };
      period = 'week';
    } else {
      // Use existing period validation
      const validation = validatePeriod(periodParam);
      if (!validation.isValid) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid period parameter. Use 7d or 30d, or scope=week.' 
        });
      }
      startDate = validation.startDate;
      period = validation.period;
      quoteMatchQuery = { createdAt: { $gte: startDate } };
    }

    let funFact = '';

    // Try to get top author of the period (use appropriate match query)
    const topAuthor = await Quote.aggregate([
      { $match: quoteMatchQuery },
      { $group: { _id: '$author', count: { $sum: 1 } } },
      { $match: { _id: { $ne: null, $ne: '' } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 1 }
    ]);

    if (topAuthor.length > 0 && topAuthor[0].count > 1) {
      const authorName = topAuthor[0]._id;
      const count = topAuthor[0].count;
      funFact = `🏆 Автор недели: ${authorName} — ${count} ${count % 10 === 1 && count % 100 !== 11 ? 'цитата' : (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) ? 'цитаты' : 'цитат'}`;
    } else {
      if (scope === 'week') {
        // For ISO week scope, use a different fallback since we can't easily aggregate by day
        const totalQuotes = await Quote.countDocuments(quoteMatchQuery);
        if (totalQuotes > 0) {
          funFact = `📊 На этой неделе добавлено ${totalQuotes} ${totalQuotes % 10 === 1 && totalQuotes % 100 !== 11 ? 'цитата' : (totalQuotes % 10 >= 2 && totalQuotes % 10 <= 4 && (totalQuotes % 100 < 10 || totalQuotes % 100 >= 20)) ? 'цитаты' : 'цитат'}`;
        } else {
          funFact = '🌟 Сообщество активно развивается и изучает новые темы';
        }
      } else {
        // Fallback: day with maximum quotes (for date-based queries)
        const dailyStats = await Quote.aggregate([
          { $match: quoteMatchQuery },
          { 
            $group: { 
              _id: { 
                $dateToString: { 
                  format: '%Y-%m-%d', 
                  date: '$createdAt',
                  timezone: 'Europe/Moscow'
                } 
              }, 
              count: { $sum: 1 } 
            } 
          },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 1 }
        ]);

        if (dailyStats.length > 0 && dailyStats[0].count > 1) {
          const date = dailyStats[0]._id;
          const count = dailyStats[0].count;
          const formattedDate = new Date(date).toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long' 
          });
          funFact = `📅 Самый продуктивный день: ${formattedDate} — ${count} ${count % 10 === 1 && count % 100 !== 11 ? 'цитата' : (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) ? 'цитаты' : 'цитат'}`;
        } else {
          // Neutral fallback
          funFact = '🌟 Сообщество активно развивается и изучает новые темы';
        }
      }
    }

    return res.json({ success: true, period, data: funFact });
  } catch (error) {
    console.error('❌ Get Fun Fact Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Процент активности пользователя (сколько % пользователей имеют меньше цитат)
 * @route GET /api/reader/activity-percent
 */
router.get('/activity-percent', telegramAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const userQuotesCount = await Quote.countDocuments({ userId });

        const usersWithCounts = await Quote.aggregate([
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]);

        const totalUsers = usersWithCounts.length;
        const lessCount = usersWithCounts.filter(u => u.count < userQuotesCount).length;

        let percent = 50;
        if (totalUsers > 0) {
            percent = Math.round((lessCount / totalUsers) * 100);
            if (percent < 1) percent = 1;
            if (percent > 99) percent = 99;
        }

        res.json({ activityPercent: percent, totalUsers, userQuotesCount });
    } catch (e) {
        console.error('❌ Activity Percent Error:', e);
        res.status(500).json({ error: 'server error' });
    }
});

// In-memory cache for community message (10-15 minutes)
let communityMessageCache = null;
let communityMessageCacheTime = 0;
const COMMUNITY_MESSAGE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * @description Сообщение от Анны (динамическое, ежедневно уникальное)
 * @route GET /api/reader/community/message
 */
router.get('/community/message', telegramAuth, communityLimiter, async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (communityMessageCache && (now - communityMessageCacheTime) < COMMUNITY_MESSAGE_CACHE_TTL) {
      return res.json({
        success: true,
        data: communityMessageCache
      });
    }

    // Get metrics for last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [newQuotesCount, activeReadersCount, topAuthor] = await Promise.all([
      Quote.countDocuments({ createdAt: { $gte: yesterday } }),
      Quote.distinct('userId', { createdAt: { $gte: yesterday } }).then(users => users.length),
      Quote.aggregate([
        { $match: { createdAt: { $gte: yesterday }, author: { $ne: null, $ne: '' } } },
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ])
    ]);

    // Message templates (5-7 variants)
    const messageTemplates = [
      (data) => `Дорогие читатели! За сутки вы добавили ${data.newQuotes} цитат — это впечатляет! ${data.activeReaders} активных читателей создают настоящую библиотеку мудрости.`,
      (data) => `Сегодня особенно активны ${data.activeReaders} читателей. Ваши ${data.newQuotes} новых цитат показывают, как растёт наше сообщество!`,
      (data) => `Прекрасный день для чтения! ${data.newQuotes} свежих цитат от ${data.activeReaders} читателей. ${data.topAuthor ? `Особенно популярен ${data.topAuthor}` : 'Продолжайте собирать мудрость!'}.`,
      (data) => `Ваша активность вдохновляет: ${data.newQuotes} цитат за день! ${data.activeReaders} читателей создают уникальную коллекцию мыслей.`,
      (data) => `За последние 24 часа ${data.activeReaders} читателей поделились ${data.newQuotes} цитатами. ${data.topAuthor ? `Лидер дня — ${data.topAuthor}!` : 'Каждая цитата ценна!'}`,
      (data) => `Растём вместе! Сегодня ${data.activeReaders} активных читателей, ${data.newQuotes} новых мыслей. Продолжайте открывать для себя мудрость книг.`,
      (data) => `Какая активность! ${data.newQuotes} цитат за день от ${data.activeReaders} читателей. ${data.topAuthor ? `${data.topAuthor} особенно вдохновляет сегодня.` : 'Ваш вклад неоценим!'}`
    ];

    // Deterministic template selection based on date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const templateIndex = [...today].reduce((sum, char) => sum + char.charCodeAt(0), 0) % messageTemplates.length;
    
    const messageData = {
      newQuotes: newQuotesCount,
      activeReaders: activeReadersCount,
      topAuthor: topAuthor.length > 0 ? topAuthor[0]._id : null
    };

    const messageText = messageTemplates[templateIndex](messageData);

    const result = {
      text: messageText,
      time: 'сегодня'
    };

    // Cache the result
    communityMessageCache = result;
    communityMessageCacheTime = now;

    return res.json({
      success: true,
      data: result
    });
  } catch (e) {
    console.error('Community message error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// In-memory cache for community trend (15 minutes)
let communityTrendCache = null;
let communityTrendCacheTime = 0;
let communityTrendCacheWeek = null;
const COMMUNITY_TREND_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * @description Тренд недели по реальным данным (категории цитат за текущую ISO неделю)
 * @route GET /api/reader/community/trend
 */
router.get('/community/trend', telegramAuth, communityLimiter, async (_req, res) => {
  try {
    const { getBusinessNow, getISOWeekInfo, getISOWeekRange } = require('../utils/isoWeek');
    const { normalizeCategory, getCategorySlug } = require('../utils/normalizeCategory');
    
    // Get current ISO week info
    const currentWeek = getISOWeekInfo(getBusinessNow());
    const weekNumber = currentWeek.isoWeek;
    const yearNumber = currentWeek.isoYear;
    const weekKey = `${yearNumber}-W${weekNumber}`;

    // Check cache first (invalidate if week changed)
    const now = Date.now();
    if (communityTrendCache && 
        communityTrendCacheWeek === weekKey &&
        (now - communityTrendCacheTime) < COMMUNITY_TREND_CACHE_TTL) {
      return res.json({
        success: true,
        data: communityTrendCache
      });
    }

    // Aggregate categories from Quote.category for current ISO week
    const categoryAggregation = await Quote.aggregate([
      { $match: { weekNumber, yearNumber } },
      { $match: { category: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Filter out null/empty _id
    const validCategories = categoryAggregation.filter(cat => cat._id && cat._id.trim());

    // If no categories found, use fallback
    if (validCategories.length === 0) {
      const result = {
        title: 'Тренд недели',
        text: 'Сообщество активно изучает разнообразные темы',
        buttonText: 'Изучить разборы',
        link: '/catalog',
        category: { key: 'ВСЕ', label: 'Все категории' }
      };

      communityTrendCache = result;
      communityTrendCacheTime = now;
      communityTrendCacheWeek = weekKey;

      return res.json({
        success: true,
        data: result
      });
    }

    // Exclude 'ДРУГОЕ' if any other category exists
    const filteredCategories = validCategories.length > 1
      ? validCategories.filter(cat => cat._id !== 'ДРУГОЕ')
      : validCategories;

    // Get top category
    const topCategory = filteredCategories[0];
    const categoryKey = normalizeCategory(topCategory._id);
    const categorySlug = getCategorySlug(categoryKey);

    // Get ISO week range for book highlight logic
    const weekRange = getISOWeekRange(weekNumber, yearNumber);

    // Find books in BookCatalog with matching categories
    const matchingBooks = await BookCatalog.find({
      isActive: true,
      categories: categoryKey
    }).sort({ priority: -1, createdAt: -1 }).limit(10);

    let topBook = null;
    let highlightBookId = null;

    if (matchingBooks.length > 0) {
      // Try to find top book by clicks in current ISO week from UTMClick
      const bookSlugs = matchingBooks.map(b => b.bookSlug).filter(Boolean);
      
      if (bookSlugs.length > 0) {
        const topClickedBooks = await UTMClick.aggregate([
          {
            $match: {
              timestamp: { $gte: weekRange.start, $lte: weekRange.end },
              campaign: 'catalog',
              content: { $in: bookSlugs }
            }
          },
          {
            $group: {
              _id: '$content',
              clicks: { $sum: 1 }
            }
          },
          { $sort: { clicks: -1 } },
          { $limit: 1 }
        ]);

        if (topClickedBooks.length > 0) {
          const topSlug = topClickedBooks[0]._id;
          topBook = matchingBooks.find(b => b.bookSlug === topSlug);
          if (topBook) {
            // Use bookSlug when available, otherwise fallback to _id
            highlightBookId = topBook.bookSlug || topBook._id.toString();
          }
        }
      }

      // Fallback: first candidate sorted by priority desc, createdAt desc
      if (!topBook && matchingBooks.length > 0) {
        topBook = matchingBooks[0];
      }
    }

    // Build result with category-centric text always
    const result = {
      title: 'Тренд недели',
      text: `Тема «${categoryKey}» набирает популярность`,
      buttonText: 'Изучить разборы',
      link: highlightBookId 
        ? `/catalog?category=${categorySlug}&highlight=${encodeURIComponent(highlightBookId)}`
        : `/catalog?category=${categorySlug}`,
      category: { key: categoryKey, label: categoryKey, slug: categorySlug }
    };

    // Optionally include book meta for future use, but NOT in text/button
    if (topBook) {
      result.book = { 
        id: topBook._id.toString(), 
        title: topBook.title 
      };
    }

    // Cache the result
    communityTrendCache = result;
    communityTrendCacheTime = now;
    communityTrendCacheWeek = weekKey;

    return res.json({
      success: true,
      data: result
    });
  } catch (e) {
    console.error('Community trend error:', e);
    // Fallback on error
    const fallbackResult = {
      title: 'Тренд недели',
      text: 'Сообщество активно изучает новые темы',
      buttonText: 'Изучить разборы',
      link: '/catalog',
      category: { key: 'ВСЕ', label: 'Все категории' }
    };
    
    return res.json({
      success: true,
      data: fallbackResult
    });
  }
});

/**
 * @description Отправка уведомления через Simple Telegram Bot
 * @route POST /api/reader/notify
 */
router.post('/notify', async (req, res) => {
  try {
    // Проверка секретного заголовка
    const providedSecret = req.headers['x-notify-secret'];
    const expectedSecret = process.env.BOT_NOTIFICATIONS_SECRET;
    
    if (!expectedSecret) {
      return res.status(500).json({
        success: false,
        error: 'Notification secret not configured. Please set BOT_NOTIFICATIONS_SECRET environment variable.'
      });
    }
    
    if (!providedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing X-Notify-Secret header'
      });
    }
    
    const { userId, message, parseMode } = req.body;
    
    // Валидация данных
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'message is required'
      });
    }
    
    // Проверяем, доступен ли бот в этом процессе
    if (!global.simpleTelegramBot) {
      return res.status(503).json({
        success: false,
        error: 'Simple Telegram Bot is not available in this process. Please start bot/start.js as a separate process.'
      });
    }
    
    // Отправляем уведомление
    const result = await global.simpleTelegramBot.sendNotification(userId, message, { parseMode });
    
    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        userId: userId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Notification Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

const weekContextRoutes = require('./weekContext');
router.use('/week-context', weekContextRoutes);

// ===========================================
// ⚙️ НАСТРОЙКИ УВЕДОМЛЕНИЙ
// ===========================================

/**
 * @description Получение настроек пользователя
 * @route GET /api/reader/settings
 */
router.get('/settings', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UserProfile.findOne({ userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const normalizedSettings = normalizeSettings(user);

    res.json({
      success: true,
      settings: normalizedSettings
    });

  } catch (error) {
    console.error('❌ Get Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * @description Обновление настроек пользователя
 * @route PATCH /api/reader/settings
 */
router.patch('/settings', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Settings object is required'
      });
    }

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Validate and merge settings
    const currentSettings = user.settings || {};
    const updatedSettings = { ...currentSettings };

    // Map legacy notifications.* fields to canonical structure
    if (settings.notifications) {
      // Map notifications.daily → reminders.enabled
      if (typeof settings.notifications.daily === 'boolean') {
        if (!updatedSettings.reminders) updatedSettings.reminders = {};
        updatedSettings.reminders.enabled = settings.notifications.daily;
        updatedSettings.reminderEnabled = settings.notifications.daily; // legacy sync
      }
      
      // Map notifications.achievements → achievements.enabled
      if (typeof settings.notifications.achievements === 'boolean') {
        if (!updatedSettings.achievements) updatedSettings.achievements = {};
        updatedSettings.achievements.enabled = settings.notifications.achievements;
      }
      
      // Ignore notifications.weekly and notifications.announcements (no longer supported)
    }

    // Update reminders settings (canonical)
    if (settings.reminders) {
      if (!updatedSettings.reminders) {
        updatedSettings.reminders = {};
      }
      
      if (typeof settings.reminders.enabled === 'boolean') {
        updatedSettings.reminders.enabled = settings.reminders.enabled;
        updatedSettings.reminderEnabled = settings.reminders.enabled; // legacy sync
      }
      
      if (settings.reminders.frequency && ['often', 'standard', 'rare', 'off'].includes(settings.reminders.frequency)) {
        updatedSettings.reminders.frequency = settings.reminders.frequency;
      }
    }

    // Update achievement settings
    if (settings.achievements && typeof settings.achievements.enabled === 'boolean') {
      if (!updatedSettings.achievements) {
        updatedSettings.achievements = {};
      }
      updatedSettings.achievements.enabled = settings.achievements.enabled;
    }

    // Ignore weeklyReports and announcements updates (no longer supported)

    // Update language if provided
    if (settings.language && ['ru', 'en'].includes(settings.language)) {
      updatedSettings.language = settings.language;
    }

    // Save updated settings
    user.settings = updatedSettings;
    await user.save();

    // Log changes for diagnostics
    const changes = {};
    if (updatedSettings.reminders?.enabled !== currentSettings.reminders?.enabled) {
      changes.remindersEnabled = `${currentSettings.reminders?.enabled} → ${updatedSettings.reminders.enabled}`;
    }
    if (updatedSettings.reminders?.frequency !== currentSettings.reminders?.frequency) {
      changes.reminderFrequency = `${currentSettings.reminders?.frequency} → ${updatedSettings.reminders.frequency}`;
    }
    if (updatedSettings.achievements?.enabled !== currentSettings.achievements?.enabled) {
      changes.achievementsEnabled = `${currentSettings.achievements?.enabled} → ${updatedSettings.achievements.enabled}`;
    }
    
    if (Object.keys(changes).length > 0) {
      console.info(`⚙️ Settings updated for user ${userId}:`, changes);
    }

    // Return normalized settings
    const normalizedSettings = normalizeSettings(user);

    res.json({
      success: true,
      settings: normalizedSettings,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('❌ Update Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * @description Diagnostic endpoint for reminders
 * @route GET /api/reader/settings/reminders/diag
 */
router.get('/settings/reminders/diag', (req, res) => {
  try {
    const diagnostics = {
      serverTime: new Date().toISOString(),
      timezone: process.env.TZ || 'Not set',
      reminderService: global.reminderService ? global.reminderService.getDiagnostics() : null
    };

    res.json({
      success: true,
      diagnostics
    });
  } catch (error) {
    console.error('❌ Diagnostics Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ===========================================
// ❤️ FAVORITES API (Community Likes System)
// ===========================================

/**
 * @description Add a quote to favorites (like it)
 * @route POST /api/reader/favorites
 * @body { text: string, author?: string }
 */
router.post('/favorites', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const userId = safeExtractUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { text, author } = req.body;
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const Favorite = require('../models/Favorite');
    
    // Add favorite (upsert)
    const favorite = await Favorite.addFavorite(
      userId,
      text.trim(),
      (author || '').trim()
    );

    // Get total count for this quote pair
    const normalizedKey = Favorite.computeNormalizedKey(text, author);
    const countsMap = await Favorite.getCountsForKeys([normalizedKey]);
    const totalFavoritesForPair = countsMap.get(normalizedKey) || 1;

    res.json({
      success: true,
      favorite: {
        text: favorite.text,
        author: favorite.author
      },
      counts: {
        totalFavoritesForPair
      }
    });

  } catch (error) {
    console.error('❌ Add Favorite Error:', error);
    
    // Handle duplicate key error gracefully
    if (error.code === 11000) {
      return res.json({
        success: true,
        message: 'Already in favorites'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * @description Remove a quote from favorites (unlike it)
 * @route DELETE /api/reader/favorites
 * @body { text: string, author?: string }
 * @query { text: string, author?: string } (alternative for deployments that don't parse DELETE body)
 * 
 * UPDATED: Idempotent operation - returns success even if favorite doesn't exist
 * UPDATED: Accepts parameters from either req.body or req.query for robustness
 */
router.delete('/favorites', telegramAuth, communityLimiter, async (req, res) => {
  try {
    const userId = safeExtractUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Accept params from either body or query (for DELETE body parsing issues)
    const text = req.body?.text || req.query?.text;
    const author = req.body?.author || req.query?.author;
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const Favorite = require('../models/Favorite');
    
    // Remove favorite (idempotent - no error if not found)
    const deleted = await Favorite.removeFavorite(
      userId,
      text.trim(),
      (author || '').trim()
    );

    // Compute normalizedKey and get current count
    const normalizedKey = toNormalizedKey(text.trim(), (author || '').trim());
    const countsMap = await Favorite.getCountsForKeys([normalizedKey]);
    const totalFavoritesForPair = countsMap.get(normalizedKey) || 0;

    // Always return success for idempotency, even if not found
    res.json({
      success: true,
      deleted: !!deleted,
      counts: {
        totalFavoritesForPair
      }
    });

  } catch (error) {
    console.error('❌ Remove Favorite Error:', error);
    // Don't throw 500, log and return success for robustness
    res.json({
      success: true,
      deleted: false,
      error: 'Operation completed with errors'
    });
  }
});

// 📂 CATEGORIES API
// ===========================================

/**
 * @description Get all canonical categories
 * @route GET /api/reader/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = getAllCategories();
    
    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('❌ Get Categories Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// =============================================
// FOLLOW/SUBSCRIPTION ENDPOINTS
// =============================================

/**
 * @description Подписаться на пользователя
 * @route POST /api/reader/follow/:userId
 */
router.post('/follow/:userId', telegramAuth, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = req.params.userId;
    
    console.log(`👤 Follow request: ${followerId} -> ${followingId}`);
    
    // Нельзя подписаться на себя
    if (followerId === followingId) {
      return res.status(400).json({ 
        success: false, 
        error: 'CANNOT_FOLLOW_SELF',
        message: 'Нельзя подписаться на себя'
      });
    }
    
    // Проверяем существование целевого пользователя
    const targetUser = await UserProfile.findOne({ userId: followingId });
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        error: 'USER_NOT_FOUND',
        message: 'Пользователь не найден'
      });
    }
    
    await Follow.follow(followerId, followingId);
    
    console.log(`✅ Follow success: ${followerId} -> ${followingId}`);
    res.json({ success: true, isFollowing: true });
  } catch (error) {
    console.error('❌ Follow error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Отписаться от пользователя
 * @route DELETE /api/reader/follow/:userId
 */
router.delete('/follow/:userId', telegramAuth, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = req.params.userId;
    
    console.log(`👤 Unfollow request: ${followerId} -> ${followingId}`);
    
    await Follow.unfollow(followerId, followingId);
    
    console.log(`✅ Unfollow success: ${followerId} -> ${followingId}`);
    res.json({ success: true, isFollowing: false });
  } catch (error) {
    console.error('❌ Unfollow error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получить статус подписки на конкретного пользователя
 * @route GET /api/reader/follow/status/:userId
 */
router.get('/follow/status/:userId', telegramAuth, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = req.params.userId;
    
    const isFollowing = await Follow.isFollowing(followerId, followingId);
    
    res.json({ success: true, isFollowing });
  } catch (error) {
    console.error('❌ Follow status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получить статусы подписки для нескольких пользователей (batch)
 * @route POST /api/reader/follow/status/batch
 */
router.post('/follow/status/batch', telegramAuth, async (req, res) => {
  try {
    const followerId = req.userId;
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'INVALID_USER_IDS',
        message: 'userIds должен быть непустым массивом'
      });
    }
    
    // Ограничиваем количество запросов
    const limitedUserIds = userIds.slice(0, 100);
    
    const statusMap = await Follow.getFollowStatuses(followerId, limitedUserIds);
    
    // Конвертируем Map в объект для JSON
    const statuses = {};
    statusMap.forEach((isFollowing, userId) => {
      statuses[userId] = isFollowing;
    });
    
    res.json({ success: true, statuses });
  } catch (error) {
    console.error('❌ Batch follow status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получить список моих подписок
 * @route GET /api/reader/following
 */
router.get('/following', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = parseInt(req.query.skip) || 0;
    
    const follows = await Follow.getFollowing(userId, limit, skip);
    const userIds = follows.map(f => f.followingId);
    
    // Получаем информацию о пользователях
    const users = await UserProfile.find(
      { userId: { $in: userIds } },
      { userId: 1, name: 1, avatarUrl: 1, 'statistics.totalQuotes': 1 }
    ).lean();
    
    const usersMap = new Map(users.map(u => [u.userId, u]));
    
    const data = follows.map(f => ({
      id: f._id,
      userId: f.followingId,
      followedAt: f.createdAt,
      user: usersMap.get(f.followingId) || { userId: f.followingId, name: 'Читатель' }
    }));
    
    // Получаем общее количество подписок
    const total = await Follow.countFollowing(userId);
    
    res.json({ success: true, data, total, limit, skip });
  } catch (error) {
    console.error('❌ Get following error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получить список моих подписчиков
 * @route GET /api/reader/followers
 */
router.get('/followers', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = parseInt(req.query.skip) || 0;
    
    const followers = await Follow.getFollowers(userId, limit, skip);
    const userIds = followers.map(f => f.followerId);
    
    // Получаем информацию о пользователях
    const users = await UserProfile.find(
      { userId: { $in: userIds } },
      { userId: 1, name: 1, avatarUrl: 1, 'statistics.totalQuotes': 1 }
    ).lean();
    
    const usersMap = new Map(users.map(u => [u.userId, u]));
    
    const data = followers.map(f => ({
      id: f._id,
      userId: f.followerId,
      followedAt: f.createdAt,
      user: usersMap.get(f.followerId) || { userId: f.followerId, name: 'Читатель' }
    }));
    
    // Получаем общее количество подписчиков
    const total = await Follow.countFollowers(userId);
    
    res.json({ success: true, data, total, limit, skip });
  } catch (error) {
    console.error('❌ Get followers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получить счётчики подписок/подписчиков
 * @route GET /api/reader/follow/counts
 */
router.get('/follow/counts', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    
    const counts = await Follow.getCounts(userId);
    
    res.json({ success: true, ...counts });
  } catch (error) {
    console.error('❌ Get follow counts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Лента цитат от подписок
 * @route GET /api/reader/community/feed/following
 */
router.get('/community/feed/following', telegramAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = parseInt(req.query.skip) || 0;
    
    // Получаем список ID подписок
    const followingIds = await Follow.getFollowingIds(userId);
    
    if (followingIds.length === 0) {
      return res.json({ 
        success: true, 
        data: [], 
        total: 0,
        message: 'NO_SUBSCRIPTIONS',
        hint: 'Подпишитесь на интересных авторов, чтобы видеть их цитаты здесь'
      });
    }
    
    // Получаем цитаты от подписок
    const quotes = await Quote.find({ userId: { $in: followingIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // ✅ ДОБАВЛЯЕМ: Получаем информацию о пользователях
    const userIds = [...new Set(quotes.map(q => q.userId))];
    const users = await UserProfile.find(
      { userId: { $in: userIds } },
      { userId: 1, name: 1, avatarUrl: 1 }
    ).lean();
    
    const usersMap = new Map(users.map(u => [u.userId, u]));
    
    // ✅ ДОБАВЛЯЕМ: Собираем уникальные пары (text, author) для favorites
    const quotePairs = quotes.map(q => ({ text: q.text, author: q.author || '' }));
    const uniquePairs = [];
    const pairMap = new Map();
    const normalizedToOriginalMap = new Map();
    
    quotes.forEach(q => {
      const normalizedKey = toNormalizedKey(q.text, q.author || '');
      const originalKey = `${q.text.trim()}|||${(q.author || '').trim()}`;
      
      if (!pairMap.has(normalizedKey)) {
        pairMap.set(normalizedKey, { text: q.text, author: q.author });
        uniquePairs.push({ 
          normalizedText: safeNormalize(q.text), 
          normalizedAuthor: safeNormalize(q.author || '') 
        });
      }
      normalizedToOriginalMap.set(normalizedKey, originalKey);
    });
    
    // ✅ ДОБАВЛЯЕМ: Получаем счётчики favorites
    const Favorite = require('../models/Favorite');
    const normalizedKeys = uniquePairs.map(pair => `${pair.normalizedText}|||${pair.normalizedAuthor}`);
    const favoritesCounts = await Favorite.getCountsForKeys(normalizedKeys);
    
    // ✅ ДОБАВЛЯЕМ: Backward compatibility с legacy Quote.isFavorite=true
    const legacyFavoritesAgg = await Quote.aggregate([
      { $match: { isFavorite: true } },
      {
        $addFields: {
          computedNormalizedText: { $ifNull: ['$normalizedText', '$text'] },
          computedNormalizedAuthor: { $ifNull: ['$normalizedAuthor', { $ifNull: ['$author', ''] }] }
        }
      },
      {
        $match: {
          $expr: {
            $in: [
              { $concat: ['$computedNormalizedText', '|||', '$computedNormalizedAuthor'] },
              normalizedKeys
            ]
          }
        }
      },
      {
        $group: {
          _id: { 
            normalizedText: '$computedNormalizedText', 
            normalizedAuthor: '$computedNormalizedAuthor' 
          },
          userIds: { $addToSet: '$userId' }
        }
      }
    ]);
    
    // ✅ ДОБАВЛЯЕМ: Merge favorites counts
    const favoritesMap = new Map();
    quotes.forEach(q => {
      const normalizedKey = toNormalizedKey(q.text, q.author || '');
      const originalKey = `${q.text.trim()}|||${(q.author || '').trim()}`;
      
      const newSystemCount = favoritesCounts.get(normalizedKey) || 0;
      
      const qNormText = safeNormalize(q.text);
      const qNormAuthor = safeNormalize(q.author || '');
      const legacyData = legacyFavoritesAgg.find(item => 
        item._id.normalizedText === qNormText && item._id.normalizedAuthor === qNormAuthor
      );
      const legacyUserIds = legacyData ? legacyData.userIds : [];
      
      const mergedCount = Math.max(newSystemCount, legacyUserIds.length);
      favoritesMap.set(originalKey, mergedCount);
    });
    
    // ✅ ДОБАВЛЯЕМ: Получаем likedByMe для текущего юзера
    let likedByMeSet = new Set();
    if (userId) {
      const likedFavorites = await Favorite.find(
        { 
          userId: userId,
          normalizedKey: { $in: normalizedKeys }
        },
        { normalizedKey: 1 }
      ).lean();
      
      likedByMeSet = new Set(likedFavorites.map(f => f.normalizedKey));
    }
    
    // ✅ ОБНОВЛЯЕМ: Обогащаем цитаты с favorites и likedByMe
    const enrichedQuotes = quotes.map(q => {
      const normalizedKey = toNormalizedKey(q.text, q.author || '');
      const favoritesKey = `${q.text.trim()}|||${(q.author || '').trim()}`;
      const favoritesCount = favoritesMap.get(favoritesKey) || 0;
      
      return {
        ...q,
        id: q._id,
        user: usersMap.get(q.userId) || { userId: q.userId, name: 'Читатель' },
        isFollowing: true,
        favorites: favoritesCount,        // ← ДОБАВЛЕНО
        likedByMe: likedByMeSet.has(normalizedKey)  // ← ДОБАВЛЕНО
      };
    });
    
    const total = await Quote.countDocuments({ userId: { $in: followingIds } });
    
    res.json({ 
      success: true, 
      data: enrichedQuotes, 
      total,
      limit,
      skip,
      followingCount: followingIds.length
    });
  } catch (error) {
    console.error('❌ Following feed error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description POST /api/reader/feedback - Submit user feedback
 * @route POST /api/reader/feedback
 * @access Protected (requires telegramAuth or userId in body for telegram source)
 */
router.post('/feedback', async (req, res) => {
  try {
    // Extract userId/telegramId based on source
    let telegramId = null;
    let userId = null;
    
    const { rating, text, context, source, tags } = req.body;
    
    // Validate required fields
    if (!rating || typeof rating !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Rating is required and must be a number'
      });
    }
    
    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }
    
    // Get telegramId based on source
    if (source === 'telegram') {
      // For telegram source, allow telegramId in body
      telegramId = req.body.telegramId || safeExtractUserId(req);
    } else {
      // For mini_app source, use auth middleware
      telegramId = safeExtractUserId(req);
    }
    
    if (!telegramId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required: telegramId not found'
      });
    }
    
    // Try to find userId from UserProfile
    try {
      const userProfile = await UserProfile.findOne({ userId: telegramId });
      if (userProfile && userProfile._id) {
        userId = userProfile._id;
      }
    } catch (err) {
      console.warn('Could not resolve userId from telegramId:', err.message);
    }
    
    // Validate text for low ratings from mini_app
    const feedbackText = text ? String(text).trim() : '';
    if (source === 'mini_app' && rating <= 3 && feedbackText.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'For ratings of 3 or below, please provide at least 10 characters of feedback'
      });
    }
    
    // Validate text length (max 300 chars)
    if (feedbackText.length > 300) {
      return res.status(400).json({
        success: false,
        error: 'Feedback text must be 300 characters or less'
      });
    }
    
    // Sanitize and validate context
    const validContexts = ['monthly_report', 'general', 'bot'];
    const feedbackContext = context && validContexts.includes(context) 
      ? context 
      : 'monthly_report';
    
    // Sanitize and validate source
    const validSources = ['telegram', 'mini_app'];
    const feedbackSource = source && validSources.includes(source)
      ? source
      : 'telegram';
    
    // Sanitize tags (trim, lowercase, remove empty)
    const feedbackTags = Array.isArray(tags)
      ? tags.map(tag => String(tag).trim().toLowerCase()).filter(tag => tag.length > 0)
      : [];
    
    // Create feedback document
    const feedback = new Feedback({
      userId,
      telegramId,
      rating,
      text: feedbackText,
      context: feedbackContext,
      source: feedbackSource,
      tags: feedbackTags
    });
    
    // Save to database
    await feedback.save();
    
    console.log(`✅ Feedback saved: ${feedback._id} from user ${telegramId}, rating: ${rating}`);
    
    // Return success response
    res.json({
      success: true,
      data: {
        id: feedback._id,
        rating: feedback.rating,
        context: feedback.context,
        createdAt: feedback.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Feedback submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback'
    });
  }
});

module.exports = router;
