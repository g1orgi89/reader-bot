/**
 * @fileoverview Reader Bot Mini App API Endpoints
 * @description API маршруты для Telegram Mini App
 */

const express = require('express');
const router = express.Router();

// Импорты моделей
const UserProfile = require('../models/userProfile');
const Quote = require('../models/quote');
const WeeklyReport = require('../models/weeklyReport');
const MonthlyReport = require('../models/monthlyReport');
const BookCatalog = require('../models/BookCatalog');

// Импорт сервисов
const QuoteHandler = require('../services/quoteHandler');

// Инициализация обработчика цитат
const quoteHandler = new QuoteHandler();

/**
 * Simple userId extraction from request
 * Supports both query parameters and request body
 * Always returns String for consistency
 */
function getUserId(req) {
  return String(req.query.userId || req.body.userId || 'demo-user');
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
 * @description Telegram аутентификация для Mini App
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

    const authData = {
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        username: user.username || '',
        telegramId: user.id,
        isOnboardingComplete: userProfile ? userProfile.isOnboardingComplete : false
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
            isOnboardingComplete: true
        }
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

// ===========================================
// 👤 ПРОФИЛЬ И СТАТИСТИКА
// ===========================================

/**
 * @description Получение профиля пользователя
 * @route GET /api/reader/profile
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = getUserId(req);
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
router.patch('/profile', async (req, res) => {
  try {
    const userId = getUserId(req);
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
 * @description Загрузка аватара пользователя
 * @route POST /api/reader/profile/avatar
 */
router.post('/profile/avatar', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { image } = req.body;

    if (!image || !image.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image data. Expected base64 data URL'
      });
    }

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.avatarUrl = image; // TODO: заменить на загрузку в облако
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: user.avatarUrl,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    console.error('❌ Avatar Upload Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Сброс результатов теста
 * @route POST /api/reader/profile/reset-test
 */
router.post('/profile/reset-test', async (req, res) => {
  try {
    const userId = getUserId(req);

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
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await UserProfile.findOne({ userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userStats = user.statistics || {};
    const todayQuotes = await Quote.getTodayQuotesCount(userId);

    const safeStats = {
      totalQuotes: userStats.totalQuotes || 0,
      currentStreak: userStats.currentStreak || 0,
      longestStreak: userStats.longestStreak || 0,
      favoriteAuthors: userStats.favoriteAuthors || [],
      monthlyQuotes: userStats.monthlyQuotes || 0,
      todayQuotes: todayQuotes || 0,
      daysSinceRegistration: user.daysSinceRegistration || 0,
      weeksSinceRegistration: user.weeksSinceRegistration || 0
    };

    res.json({
      success: true,
      stats: safeStats
    });
  } catch (error) {
    console.error('❌ Stats Error:', error);
    // Возвращаем безопасный дефолт, чтобы фронт не ломался
    res.status(200).json({
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
      warning: 'Статистика временно недоступна, показаны значения по умолчанию'
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
router.post('/quotes', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { text, author, source } = req.body;

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

    try {
      const result = await quoteHandler.handleQuote(userId, text);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message
        });
      }

      await user.updateQuoteStats(result.quote.author);

      return res.json({
        success: true,
        quote: {
          id: result.quote._id,
          text: result.quote.text,
          author: result.quote.author,
          source: result.quote.source,
          category: result.quote.category,
          themes: result.quote.themes,
          sentiment: result.quote.sentiment,
          insights: result.quote.insights,
          isEdited: result.quote.isEdited,
          editedAt: result.quote.editedAt,
          createdAt: result.quote.createdAt
        },
        newAchievements: result.newAchievements || [],
        todayCount: result.todayCount
      });

    } catch (aiError) {
      console.warn(`⚠️ AI анализ неудачен, fallback: ${aiError.message}`);

      const quote = new Quote({
        userId,
        text: text.trim(),
        author: author ? author.trim() : null,
        source: source ? source.trim() : null,
        category: 'Другое',
        themes: ['размышления'],
        sentiment: 'neutral',
        insights: 'Интересная мысль для размышления'
      });
      await quote.save();

      // Пытаемся реанализировать в фоне
      try {
        const QuoteHandler = require('../handlers/QuoteHandler');
        await QuoteHandler.reanalyzeQuote(quote._id);
      } catch (inner) {
        console.warn('⚠️ Fallback AI reanalysis failed:', inner.message);
      }

      await user.updateQuoteStats(author);

      return res.json({
        success: true,
        quote: {
          id: quote._id,
          text: quote.text,
          author: quote.author,
          source: quote.source,
          category: quote.category,
          themes: quote.themes,
          sentiment: quote.sentiment,
          insights: quote.insights,
          isEdited: quote.isEdited,
          editedAt: quote.editedAt,
          createdAt: quote.createdAt
        },
        warning: 'Quote saved without AI analysis'
      });
    }

  } catch (error) {
    console.error('❌ Add Quote Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Получение цитат пользователя (пагинация / фильтры)
 * @route GET /api/reader/quotes
 */
router.get('/quotes', async (req, res) => {
  try {
    const userId = getUserId(req);
    const {
      limit = 20,
      offset = 0,
      author,
      search,
      dateFrom,
      dateTo
    } = req.query;

    const query = { userId };

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

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const quotes = await Quote.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Quote.countDocuments(query);

    res.json({
      success: true,
      quotes: quotes.map(q => ({
        id: q._id,
        text: q.text,
        author: q.author,
        source: q.source,
        category: q.category,
        themes: q.themes,
        sentiment: q.sentiment,
        insights: q.insights,
        isEdited: q.isEdited,
        editedAt: q.editedAt,
        createdAt: q.createdAt
      })),
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
router.get('/quotes/recent', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit = 10 } = req.query;

    const quotes = await Quote.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      quotes: quotes.map(q => ({
        id: q._id,
        text: q.text,
        author: q.author,
        source: q.source,
        category: q.category,
        themes: q.themes,
        sentiment: q.sentiment,
        insights: q.insights,
        isEdited: q.isEdited,
        editedAt: q.editedAt,
        createdAt: q.createdAt
      }))
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
router.get('/quotes/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const quote = await Quote.findOne({ _id: req.params.id, userId });

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    const weekQuotes = await Quote.getWeeklyQuotes(userId, quote.weekNumber, quote.yearNumber);
    const totalQuotes = await Quote.countDocuments({ userId });
    const positionInWeek = weekQuotes.findIndex(q => q._id.toString() === quote._id.toString()) + 1;

    res.json({
      success: true,
      quote: {
        id: quote._id,
        text: quote.text,
        author: quote.author,
        source: quote.source,
        category: quote.category,
        themes: quote.themes,
        sentiment: quote.sentiment,
        insights: quote.insights,
        isEdited: quote.isEdited,
        editedAt: quote.editedAt,
        createdAt: quote.createdAt,
        weekNumber: quote.weekNumber,
        yearNumber: quote.yearNumber
      },
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
router.put('/quotes/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { text, author, source } = req.body;

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
      await quote.save();
    } catch (aiError) {
      console.warn(`⚠️ AI анализ при редактировании неудачен, fallback: ${aiError.message}`);
      quote.text = text.trim();
      quote.author = author ? author.trim() : null;
      quote.source = source ? source.trim() : null;
      quote.isEdited = true;
      quote.editedAt = new Date();
      await quote.save();
    }

    res.json({
      success: true,
      quote: {
        id: quote._id,
        text: quote.text,
        author: quote.author,
        source: quote.source,
        category: quote.category,
        themes: quote.themes,
        sentiment: quote.sentiment,
        insights: quote.insights,
        isEdited: quote.isEdited,
        editedAt: quote.editedAt,
        createdAt: quote.createdAt
      }
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
router.post('/quotes/analyze', async (req, res) => {
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
router.get('/quotes/search', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { q: searchQuery, limit = 20 } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const quotes = await Quote.searchUserQuotes(userId, searchQuery.trim(), parseInt(limit));

    const highlightedQuotes = quotes.map(quote => {
      const searchRegex = new RegExp(`(${searchQuery.trim()})`, 'gi');
      return {
        id: quote._id,
        text: quote.text.replace(searchRegex, '<mark>$1</mark>'),
        originalText: quote.text,
        author: quote.author ? quote.author.replace(searchRegex, '<mark>$1</mark>') : null,
        originalAuthor: quote.author,
        source: quote.source ? quote.source.replace(searchRegex, '<mark>$1</mark>') : null,
        originalSource: quote.source,
        category: quote.category,
        themes: quote.themes,
        sentiment: quote.sentiment,
        isEdited: quote.isEdited,
        editedAt: quote.editedAt,
        createdAt: quote.createdAt,
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
router.delete('/quotes/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
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
router.get('/reports/weekly', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit = 5, offset = 0 } = req.query;

    const reports = await WeeklyReport.find({ userId })
      .sort({ sentAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('quotes');

    res.json({
      success: true,
      reports: reports.map(r => ({
        id: r._id,
        weekNumber: r.weekNumber,
        year: r.year,
        quotesCount: r.quotesCount,
        analysis: r.analysis,
        recommendations: r.recommendations,
        sentAt: r.sentAt,
        isRead: r.isRead
      }))
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
router.get('/reports/weekly/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const reports = await WeeklyReport.find({ userId })
      .populate('quotes', 'text author category')
      .sort({ sentAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const mapReport = (r) => ({
      id: r._id,
      weekNumber: r.weekNumber,
      year: r.year,
      quotesCount: Array.isArray(r.quotes) ? r.quotes.length : (r.quotesCount || 0),
      sentAt: r.sentAt,
      isRead: r.isRead,
      feedback: r.feedback,
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
    });

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
router.get('/reports/monthly', async (req, res) => {
  try {
    const userId = getUserId(req);
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
    const userId = getUserId(req);
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

// ===========================================
// 👥 СООБЩЕСТВО
// ===========================================

/**
 * @description Общая статистика сообщества
 * @route GET /api/reader/community/stats
 */
router.get('/community/stats', async (req, res) => {
  try {
    const totalUsers = await UserProfile.countDocuments({ isOnboardingComplete: true });
    const totalQuotes = await Quote.countDocuments();

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const activeUsers = await UserProfile.countDocuments({
      lastActiveAt: { $gte: oneWeekAgo },
      isActive: true
    });

    const topAuthors = await Quote.getTopAuthors(oneWeekAgo);

    res.json({
      success: true,
      stats: {
        totalMembers: totalUsers,
        activeToday: activeUsers,
        totalQuotes,
        topAuthors: topAuthors.map(a => a._id).slice(0, 3),
        activeReaders: activeUsers,
        newQuotes: await Quote.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
        totalReaders: totalUsers,
        totalAuthors: topAuthors.length,
        daysActive: 67 // TODO: вычислять динамически
      }
    });

  } catch (error) {
    console.error('❌ Get Community Stats Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Рейтинг пользователей (обезличенный)
 * @route GET /api/reader/community/leaderboard
 */
router.get('/community/leaderboard', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit = 10 } = req.query;

    const leaderboard = await UserProfile.aggregate([
      { $match: { isOnboardingComplete: true, isActive: true } },
      { $sort: { 'statistics.totalQuotes': -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          name: 1,
          'statistics.totalQuotes': 1,
          'statistics.currentStreak': 1,
          userId: 1
        }
      }
    ]);

    const result = leaderboard.map((u, index) => ({
      position: index + 1,
      name: u.name ? (u.name.charAt(0) + '***') : '***',
      quotes: u.statistics.totalQuotes,
      quotesThisWeek: Math.floor(Math.random() * 20), // заглушка
      isCurrentUser: u.userId === userId
    }));

    res.json({
      success: true,
      leaderboard: result
    });

  } catch (error) {
    console.error('❌ Get Leaderboard Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
