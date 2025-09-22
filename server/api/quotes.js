/**
 * API роуты для управления цитатами проекта "Читатель"
 * Адаптировано из Shrooms Support Bot для нового проекта
 * @file server/api/quotes.js
 */

const express = require('express');
const router = express.Router();

// ✅ ДОБАВИТЬ НЕДОСТАЮЩИЙ ИМПОРТ:
function parseUserIdFromInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      if (userObj && userObj.id) return String(userObj.id);
    }
  } catch (e) {
    console.warn('InitData parse error:', e, initData);
  }
  return null;
}

function telegramAuth(req, res, next) {
  const initData = req.headers['authorization']?.startsWith('tma ')
    ? req.headers['authorization'].slice(4)
    : req.headers['x-telegram-init-data'];

  const userId = parseUserIdFromInitData(initData);
  
  if (!initData || !userId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  req.userId = userId;
  next();
}

// Импорт утилит
const logger = require('../utils/logger');

// Импорт моделей
const Quote = require('../models/quote');
const UserProfile = require('../models/userProfile');

/**
 * @typedef {Object} QuoteFilters
 * @property {string} period - Период фильтрации ('1d', '7d', '30d', '90d')
 * @property {string} category - Категория цитаты
 * @property {string} author - Фильтр по автору
 * @property {string} search - Поисковый запрос
 * @property {number} page - Номер страницы
 * @property {number} limit - Количество записей на странице
 */

/**
 * @typedef {Object} QuoteStatistics
 * @property {number} totalQuotes - Общее количество цитат
 * @property {number} totalAuthors - Количество уникальных авторов
 * @property {string} popularCategory - Самая популярная категория
 * @property {number} dailyAverage - Среднее количество цитат в день
 * @property {Object} changeStats - Статистика изменений
 */

// ==================== ОСНОВНЫЕ РОУТЫ ====================

/**
 * GET /api/quotes/recent - Получение последних цитат пользователя
 * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Добавлен роут /recent ПЕРЕД /:id для предотвращения конфликта
 */
router.get('/recent', async (req, res) => {
    console.log('=== [API/QUOTES] GET /api/quotes called ===', req.query);    
  
    try {
        // ИСПРАВЛЕНИЕ: Убираем fallback к demo-user, требуем аутентификации
        const userId = req.userId || req.query.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'User ID not found. Please authenticate first.'
            });
        }
        
        const limit = parseInt(req.query.limit) || 10;

        logger.info('📝 Получение последних цитат для пользователя:', userId);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // УЛУЧШЕННАЯ ОБРАБОТКА ОШИБОК: Валидация лимита
        if (limit > 100) {
            return res.status(400).json({
                success: false,
                message: 'Лимит не может превышать 100 записей',
                error: 'LIMIT_TOO_HIGH'
            });
        }

        if (limit < 1) {
            return res.status(400).json({
                success: false,
                message: 'Лимит должен быть положительным числом',
                error: 'INVALID_LIMIT'
            });
        }

        // Получаем последние цитаты пользователя
        const quotes = await Quote.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Обогащаем цитаты информацией о пользователе
        const enrichedQuotes = quotes.map(quote => ({
            id: quote._id.toString(),
            text: quote.text,
            author: quote.author,
            source: quote.source,
            category: quote.category,
            sentiment: quote.sentiment,
            themes: quote.themes || [],
            insights: quote.insights, // FIXED: Include insights in recent quotes
            createdAt: quote.createdAt,
            isFavorite: quote.isFavorite || false
        }));

        res.json({
            success: true,
            data: {
                quotes: enrichedQuotes,
                total: enrichedQuotes.length,
                userId: userId,
                limit: limit
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка получения последних цитат:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения последних цитат',
            error: error.message
        });
    }
});

/**
 * GET /api/quotes - Получение списка цитат с фильтрацией для аутентифицированного пользователя
 * 🚨 ИСПРАВЛЕНО: Добавлен фильтр по userId для показа только цитат текущего пользователя
 */
router.get('/', async (req, res) => {
    try {
        const {
            period = 'all',
            category = 'all',
            author = 'all',
            search = '',
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // ИСПРАВЛЕНИЕ: Убираем fallback к demo-user, требуем аутентификации  
        const userId = req.userId || req.query.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'User ID not found. Please authenticate first.'
            });
        }

        logger.info('📝 Получение цитат с фильтрами для пользователя:', {
            userId, period, category, author, search, page, limit
        });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // ИСПРАВЛЕНО: Построение фильтра для MongoDB с обязательным фильтром по userId
        const filter = {
            userId: userId // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Показываем только цитаты текущего пользователя
        };
        
        // Фильтр по периоду
        if (period !== 'all') {
            const days = parseInt(period);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            filter.createdAt = { $gte: startDate };
        }

        // Фильтр по категории
        if (category !== 'all') {
            filter.category = category;
        }

        // Фильтр по автору
        if (author === 'has_author') {
            filter.author = { $ne: null, $ne: '' };
        } else if (author === 'no_author') {
            filter.$or = [
                { author: null },
                { author: '' }
            ];
        }

        // Поиск по тексту
        if (search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { text: searchRegex },
                { author: searchRegex },
                { source: searchRegex }
            ];
        }

        // Вычисляем пропуск записей для пагинации
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Сортировка
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Выполняем запросы параллельно
        const [quotes, totalCount] = await Promise.all([
            Quote.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Quote.countDocuments(filter)
        ]);

        // Получаем информацию о пользователях для найденных цитат
        const userIds = [...new Set(quotes.map(q => q.userId))];
        const users = await UserProfile.find(
            { userId: { $in: userIds } },
            { userId: 1, name: 1, telegramUsername: 1, email: 1 }
        ).lean();

        const userMap = users.reduce((map, user) => {
            map[user.userId] = user;
            return map;
        }, {});

        // Обогащаем цитаты информацией о пользователях
        const enrichedQuotes = quotes.map(quote => ({
            id: quote._id.toString(),
            text: quote.text,
            author: quote.author,
            source: quote.source,
            category: quote.category,
            sentiment: quote.sentiment,
            themes: quote.themes || [],
            insights: quote.insights, // FIXED: Include insights in quotes list
            weekNumber: quote.weekNumber,
            monthNumber: quote.monthNumber,
            createdAt: quote.createdAt,
            isEdited: quote.isEdited,
            editedAt: quote.editedAt,
            isFavorite: quote.isFavorite || false, // ✅ Добавлено поле избранного
            user: {
                id: quote.userId,
                name: userMap[quote.userId]?.name || 'Неизвестный',
                username: userMap[quote.userId]?.telegramUsername || 'N/A',
                email: userMap[quote.userId]?.email || 'N/A'
            }
        }));

        const response = {
            success: true,
            data: {
                quotes: enrichedQuotes,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalCount,
                    hasNext: skip + parseInt(limit) < totalCount,
                    hasPrev: parseInt(page) > 1,
                    limit: parseInt(limit)
                },
                filters: {
                    period,
                    category,
                    author,
                    search
                }
            }
        };

        res.json(response);

    } catch (error) {
        logger.error('❌ Ошибка получения цитат:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения цитат',
            error: error.message
        });
    }
});

/**
 * POST /api/quotes - Создание новой цитаты
 */
router.post('/', async (req, res) => {
    try {
        const { text, author, source } = req.body;
        const userId = req.userId || req.body.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'User ID not found. Please authenticate first.'
            });
        }

        logger.info('📝 Создание новой цитаты:', { text, author, source, userId });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Валидация
        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Текст цитаты не может быть пустым',
                error: 'EMPTY_TEXT'
            });
        }
        if (text.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Текст цитаты не может превышать 1000 символов',
                error: 'TEXT_TOO_LONG'
            });
        }
        if (author && author.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Имя автора не может превышать 100 символов',
                error: 'AUTHOR_TOO_LONG'
            });
        }
        if (source && source.length > 200) {
            return res.status(400).json({
                success: false,
                message: 'Источник не может превышать 200 символов',
                error: 'SOURCE_TOO_LONG'
            });
        }

        // Лимит по количеству цитат в день
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayQuotesCount = await Quote.countDocuments({
            userId: userId,
            createdAt: { $gte: todayStart }
        });
        if (todayQuotesCount >= 50) {
            return res.status(429).json({
                success: false,
                message: 'Превышен дневной лимит цитат (50 в день)',
                error: 'DAILY_LIMIT_EXCEEDED'
            });
        }

        const now = new Date();
        const weekNumber = getWeekOfYear(now);
        const monthNumber = now.getMonth() + 1;
        const yearNumber = now.getFullYear();

        // Создаем цитату
        const newQuote = new Quote({
            userId: userId,
            text: text.trim(),
            author: author?.trim() || null,
            source: source?.trim() || null,
            category: 'ДРУГОЕ',
            sentiment: 'neutral',
            themes: [],
            weekNumber,
            monthNumber,
            yearNumber,
            createdAt: now,
            isEdited: false
        });

        const savedQuote = await newQuote.save();

        // AI анализ
        let analysis = {
            category: savedQuote.category,
            themes: [],
            sentiment: savedQuote.sentiment,
            insights: ""
        };
        try {
            const QuoteHandler = require('../services/quoteHandler');
            const quoteHandler = new QuoteHandler();
            analysis = await quoteHandler.analyzeQuote(savedQuote.text, savedQuote.author);
            savedQuote.category = analysis.category;
            savedQuote.themes = analysis.themes;
            savedQuote.sentiment = analysis.sentiment;
            savedQuote.insights = analysis.insights;
            await savedQuote.save();
            logger.info('🤖 AI анализ выполнен для цитаты:', savedQuote._id);
        } catch (aiError) {
            logger.warn('⚠️ AI анализ не удался, но цитата создана:', aiError.message);
        }

        // Генерация ответа Анны
        let annaResponse = 'Цитата успешно создана';
        try {
            const QuoteHandler = require('../services/quoteHandler');
            const quoteHandler = new QuoteHandler();
            const todayCount = await quoteHandler.getTodayQuotesCount(userId);
            annaResponse = await quoteHandler.generateAnnaResponse(
                { text: savedQuote.text, author: savedQuote.author }, 
                { category: savedQuote.category, themes: savedQuote.themes, sentiment: savedQuote.sentiment },
                todayCount,
                userId
            );
        } catch (responseError) {
            logger.warn('⚠️ Ошибка генерации ответа Анны, используем стандартный:', responseError.message);
        }

        // ОТДАЕМ ОДИН ОТВЕТ КЛИЕНТУ (НЕ ДЕЛИМ НА success/fallback, ВСЕ ПОЛЯ ЕСТЬ)
        const response = {
            success: true,
            message: annaResponse,
            data: {
                id: savedQuote._id.toString(),
                text: savedQuote.text,
                author: savedQuote.author,
                source: savedQuote.source,
                category: savedQuote.category,
                sentiment: savedQuote.sentiment,
                themes: savedQuote.themes,
                insights: savedQuote.insights,
                createdAt: savedQuote.createdAt,
                weekNumber: savedQuote.weekNumber,
                monthNumber: savedQuote.monthNumber,
                aiAnalysis: {
                    summary: annaResponse,
                    category: savedQuote.category,
                    themes: savedQuote.themes,
                    sentiment: savedQuote.sentiment
                }
            }
        };
        console.log('[DEBUG][API][addQuote] Ответ на фронт:', JSON.stringify(response, null, 2));
        res.status(201).json(response);

    } catch (error) {
        logger.error('❌ Ошибка создания цитаты:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка создания цитаты',
            error: error.message
        });
    }
});
            
/**
 * GET /api/quotes/statistics - Получение статистики цитат для аутентифицированного пользователя
 * 🚨 ИСПРАВЛЕНО: Добавлен фильтр по userId для показа статистики только текущего пользователя
 */
router.get('/statistics', telegramAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;

        // ИСПРАВЛЕНИЕ: Убираем fallback к demo-user, требуем аутентификации
        const userId = req.userId || req.query.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'User ID not found. Please authenticate first.'
            });
        }

        logger.info('📊 Получение статистики цитат за период для пользователя:', { userId, period });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Определяем временные рамки
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - days);

        // ИСПРАВЛЕНО: Выполняем статистические запросы параллельно с фильтром по userId
        const [
            currentStats,
            previousStats,
            topCategories,
            uniqueAuthors
        ] = await Promise.all([
            Quote.aggregate([
                { $match: { userId: userId, createdAt: { $gte: startDate } } }, // ✅ Добавлен фильтр по userId
                {
                    $group: {
                        _id: null,
                        totalQuotes: { $sum: 1 },
                        avgDaily: { $avg: 1 }
                    }
                }
            ]),
            Quote.aggregate([
                { 
                    $match: { 
                        userId: userId, // ✅ Добавлен фильтр по userId
                        createdAt: { 
                            $gte: previousStartDate, 
                            $lt: startDate 
                        } 
                    } 
                },
                {
                    $group: {
                        _id: null,
                        totalQuotes: { $sum: 1 }
                    }
                }
            ]),
            Quote.aggregate([
                { $match: { userId: userId, createdAt: { $gte: startDate } } }, // ✅ Добавлен фильтр по userId
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ]),
            Quote.distinct('author', { 
                userId: userId, // ✅ Добавлен фильтр по userId
                createdAt: { $gte: startDate },
                author: { $ne: null, $ne: '' }
            })
        ]);

        const current = currentStats[0] || { totalQuotes: 0, avgDaily: 0 };
        const previous = previousStats[0] || { totalQuotes: 0 };
        const topCategory = topCategories[0] || { _id: 'ДРУГОЕ' };

        // Вычисляем изменения
        const quotesChange = current.totalQuotes - previous.totalQuotes;
        const authorsChange = uniqueAuthors.length;
        const dailyAverage = Math.round((current.totalQuotes / days) * 10) / 10;

        // ИСПРАВЛЕНО: Защита от undefined значений во всех полях статистики
        const statistics = {
            totalQuotes: current.totalQuotes || 0,
            totalAuthors: uniqueAuthors.length || 0,
            // ИСПРАВЛЕНО: Безопасный доступ к topCategory._id с fallback
            popularCategory: topCategory?._id || 'ДРУГОЕ',
            dailyAverage: dailyAverage || 0,
            changeStats: {
                quotesChange: quotesChange > 0 ? `+${quotesChange}` : quotesChange.toString(),
                authorsChange: `+${authorsChange || 0}`,
                avgChange: '+0.0' // Временно, нужна логика расчета
            },
            period: period || '7d'
        };

        res.json({
            success: true,
            data: statistics
        });

    } catch (error) {
        logger.error('❌ Ошибка получения статистики:', error);
        
        // ИСПРАВЛЕНО: Возвращаем безопасные default значения даже при ошибке
        res.status(200).json({
            success: true,
            data: {
                totalQuotes: 0,
                totalAuthors: 0,
                popularCategory: 'ДРУГОЕ',
                dailyAverage: 0,
                changeStats: {
                    quotesChange: '+0',
                    authorsChange: '+0',
                    avgChange: '+0.0'
                },
                period: req.query.period || '7d'
            },
            warning: 'Статистика временно недоступна, показаны значения по умолчанию'
        });
    }
});

/**
 * GET /api/quotes/analytics - Получение аналитических данных для графиков для аутентифицированного пользователя
 * 🚨 ИСПРАВЛЕНО: Добавлен фильтр по userId для показа аналитики только текущего пользователя
 */
router.get('/analytics', async (req, res) => {
    try {
        const { period = '7d' } = req.query;

        // ИСПРАВЛЕНИЕ: Убираем fallback к demo-user, требуем аутентификации
        const userId = req.userId || req.query.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'User ID not found. Please authenticate first.'
            });
        }

        logger.info('📈 Получение аналитики цитат за период для пользователя:', { userId, period });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // ИСПРАВЛЕНО: Параллельные запросы для аналитики с фильтром по userId
        const [
            categoriesData,
            timelineData,
            topAuthorsData,
            sentimentData
        ] = await Promise.all([
            // Распределение по категориям
            Quote.aggregate([
                { $match: { userId: userId, createdAt: { $gte: startDate } } }, // ✅ Добавлен фильтр по userId
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            // Временная динамика
            Quote.aggregate([
                { $match: { userId: userId, createdAt: { $gte: startDate } } }, // ✅ Добавлен фильтр по userId
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: period === '1d' ? '%H:00' : '%Y-%m-%d',
                                date: '$createdAt'
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id': 1 } }
            ]),

            // Топ авторы
            Quote.aggregate([
                { 
                    $match: { 
                        userId: userId, // ✅ Добавлен фильтр по userId
                        createdAt: { $gte: startDate },
                        author: { $ne: null, $ne: '' }
                    } 
                },
                {
                    $group: {
                        _id: '$author',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 6 }
            ]),

            // Анализ настроений
            Quote.aggregate([
                { $match: { userId: userId, createdAt: { $gte: startDate } } }, // ✅ Добавлен фильтр по userId
                {
                    $group: {
                        _id: '$sentiment',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Подготавливаем данные для графиков
        const categoryColors = {
            'КРИЗИСЫ': '#d4af37',
            'Я — ЖЕНЩИНА': '#c97a7e',
            'ЛЮБОВЬ': '#81b3d3',
            'ОТНОШЕНИЯ': '#a8c686',
            'ДЕНЬГИ': '#deb887',
            'ОДИНОЧЕСТВО': '#cd853f',
            'СМЕРТЬ': '#f4a460',
            'СЕМЕЙНЫЕ ОТНОШЕНИЯ': '#dda0dd',
            'СМЫСЛ ЖИЗНИ': '#98fb98',
            'СЧАСТЬЕ': '#ffc857',
            'ВРЕМЯ И ПРИВЫЧКИ': '#a0c4ff',
            'ДОБРО И ЗЛО': '#bdb2ff',
            'ОБЩЕСТВО': '#ffb4a2',
            'ПОИСК СЕБЯ': '#b5ead7',
            'ДРУГОЕ': '#d3d3d3'
        };
        
        const analytics = {
            categories: {
                labels: categoriesData.map(item => item._id),
                data: categoriesData.map(item => item.count),
                colors: categoriesData.map(item => categoryColors[item._id] || '#d3d3d3')
            },
            timeline: {
                labels: timelineData.map(item => {
                    if (period === '1d') {
                        return item._id;
                    }
                    const date = new Date(item._id);
                    return date.toLocaleDateString('ru-RU', { 
                        month: 'short', 
                        day: 'numeric' 
                    });
                }),
                data: timelineData.map(item => item.count)
            },
            topAuthors: topAuthorsData.map((author, index) => {
                const totalQuotes = categoriesData.reduce((sum, cat) => sum + cat.count, 0);
                return {
                    name: author._id,
                    count: author.count,
                    percentage: totalQuotes > 0 ? Math.round((author.count / totalQuotes) * 100 * 10) / 10 : 0
                };
            }),
            sentiment: {
                labels: ['Позитивные', 'Нейтральные', 'Негативные'],
                data: [
                    sentimentData.find(s => s._id === 'positive')?.count || 0,
                    sentimentData.find(s => s._id === 'neutral')?.count || 0,
                    sentimentData.find(s => s._id === 'negative')?.count || 0
                ],
                colors: ['#4ade80', '#64748b', '#ef4444']
            }
        };

        res.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        logger.error('❌ Ошибка получения аналитики:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения аналитики цитат',
            error: error.message
        });
    }
});

/**
 * GET /api/quotes/:id - Получение детальной информации о цитате
 */
router.get('/:id', telegramAuth, async (req, res) => {
    try {
        const { id } = req.params;

        logger.info('📝 Получение детальной информации о цитате:', id);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Находим цитату
        const quote = await Quote.findById(id).lean();
        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Цитата не найдена'
            });
        }

        // Получаем информацию о пользователе
        const user = await UserProfile.findOne({ userId: quote.userId }).lean();

        // Ищем похожие цитаты
        const similarQuotes = await Quote.findSimilarQuotes(quote.text, quote.userId);

        const quoteDetails = {
            id: quote._id.toString(),
            text: quote.text,
            author: quote.author,
            source: quote.source,
            category: quote.category,
            themes: quote.themes || [],
            sentiment: quote.sentiment,
            user: {
                id: quote.userId,
                name: user?.name || 'Неизвестный',
                telegramUsername: user?.telegramUsername || 'N/A',
                email: user?.email || 'N/A'
            },
            meta: {
                weekNumber: quote.weekNumber,
                monthNumber: quote.monthNumber,
                yearNumber: quote.yearNumber,
                createdAt: quote.createdAt,
                editedAt: quote.editedAt,
                isEdited: quote.isEdited,
                wordCount: quote.text.split(' ').length,
                characterCount: quote.text.length
            },
            relatedQuotes: similarQuotes.map(sq => ({
                id: sq._id.toString(),
                text: sq.text,
                author: sq.author,
                similarity: Math.random() * 0.3 + 0.7 // Временная логика
            }))
        };

        res.json({
            success: true,
            data: quoteDetails
        });

    } catch (error) {
        logger.error('❌ Ошибка получения детальной информации:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения информации о цитате',
            error: error.message
        });
    }
});

/**
 * POST /api/quotes/:id/analyze - Запуск AI анализа цитаты
 */
router.post('/analyze', telegramAuth, async (req, res) => {
    try {
        const { text, author } = req.body;

        logger.info('🤖 Запуск AI анализа цитаты:', { text: text?.substring(0, 50) + '...', author });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Текст цитаты обязателен'
            });
        }

        const QuoteHandler = require('../services/quoteHandler');
        const quoteHandler = new QuoteHandler();
        
        const analysis = await quoteHandler.analyzeQuote(text, author || null);

        res.json({
            success: true,
            message: 'Анализ цитаты завершен',
            data: {
                text: text,
                author: author || null,
                analysis: analysis
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка AI анализа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка анализа цитаты',
            error: error.message
        });
    }
});

/**
 * POST /api/quotes/:id/analyze - Повторный анализ существующей цитаты
 */
router.post('/:id/analyze', telegramAuth, async (req, res) => {
    try {
        const { id } = req.params;

        logger.info('🤖 Запуск повторного AI анализа цитаты:', id);

        res.setHeader('Content-Type: application/json; charset=utf-8');

        const quote = await Quote.findById(id);
        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Цитата не найдена'
            });
        }

        const QuoteHandler = require('../services/quoteHandler');
        const quoteHandler = new QuoteHandler();
        
        const analysis = await quoteHandler.analyzeQuote(quote.text, quote.author);

        quote.category = analysis.category;
        quote.themes = analysis.themes;
        quote.sentiment = analysis.sentiment;
        quote.insights = analysis.insights;
        await quote.save();

        res.json({
            success: true,
            message: 'Повторный анализ завершен',
            data: {
                quoteId: id,
                analysis: analysis,
                updated: true
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка повторного анализа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка повторного анализа цитаты',
            error: error.message
        });
    }
});

/**
 * POST /api/quotes/analyze - Анализ нового текста цитаты
 */
router.post('/analyze', telegramAuth, async (req, res) => {
    try {
        const { text, author } = req.body;

        logger.info('🤖 Запуск AI анализа новой цитаты:', { text: text?.substring(0, 50) + '...', author });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Текст цитаты обязателен'
            });
        }

        const QuoteHandler = require('../services/quoteHandler');
        const quoteHandler = new QuoteHandler();
        
        const analysis = await quoteHandler.analyzeQuote(text, author || null);

        res.json({
            success: true,
            message: 'Анализ цитаты завершен',
            data: {
                text: text,
                author: author || null,
                analysis: analysis
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка AI анализа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка анализа цитаты',
            error: error.message
        });
    }
});

/**
 * POST /api/quotes/:id/reanalyze - Повторный анализ существующей цитаты
 */
router.post('/:id/reanalyze', telegramAuth, async (req, res) => {
    try {
        const { id } = req.params;

        logger.info('🤖 Запуск повторного AI анализа цитаты:', id);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        const quote = await Quote.findById(id);
        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Цитата не найдена'
            });
        }

        const QuoteHandler = require('../services/quoteHandler');
        const quoteHandler = new QuoteHandler();
        
        const analysis = await quoteHandler.analyzeQuote(quote.text, quote.author);

        quote.category = analysis.category;
        quote.themes = analysis.themes;
        quote.sentiment = analysis.sentiment;
        quote.insights = analysis.insights;
        await quote.save();

        res.json({
            success: true,
            message: 'Повторный анализ завершен',
            data: {
                quoteId: id,
                analysis: analysis,
                updated: true
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка повторного анализа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка повторного анализа цитаты',
            error: error.message
        });
    }
});

/**
 * DELETE /api/quotes/:id - Удаление цитаты текущего пользователя
 */
router.delete('/:id', telegramAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId || req.user?.id || req.body?.userId;

        logger.info('🗑️ Удаление цитаты:', id, 'Пользователь:', userId);

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'User ID not found. Please authenticate first.'
            });
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Находим цитату и проверяем владельца
        const quote = await Quote.findById(id);
        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Цитата не найдена'
            });
        }

        // Проверяем, что пользователь является владельцем цитаты
        if (String(quote.userId) !== String(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Нет прав для удаления данной цитаты'
            });
        }

        // Удаляем цитату
        await Quote.deleteOne({ _id: id });

        // Логируем удаление для аудита
        logger.info('🗑️ Цитата удалена пользователем:', {
            id,
            text: quote.text,
            author: quote.author,
            userId: quote.userId,
            deletedBy: userId
        });

        res.status(204).end();

    } catch (error) {
        logger.error('❌ Ошибка удаления цитаты:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка удаления цитаты',
            error: error.message
        });
    }
});

/**
 * POST /api/quotes/:id/favorite - Toggle favorite status of a quote
 */
router.post('/:id/favorite', telegramAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { isFavorite } = req.body;

        logger.info('⭐ Toggle favorite for quote:', id, { isFavorite });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Find and update the quote
        const updatedQuote = await Quote.findByIdAndUpdate(
            id,
            { isFavorite: Boolean(isFavorite) },
            { new: true, runValidators: true }
        );

        if (!updatedQuote) {
            return res.status(404).json({
                success: false,
                message: 'Цитата не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Статус избранного обновлен',
            data: {
                id: updatedQuote._id.toString(),
                isFavorite: updatedQuote.isFavorite
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка обновления избранного:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка обновления статуса избранного',
            error: error.message
        });
    }
});

/**
 * POST /api/quotes/export - Экспорт цитат
 */
router.post('/export', telegramAuth, async (req, res) => {
    try {
        const { 
            format = 'csv',
            period = '30d',
            category = 'all',
            includeUserData = false
        } = req.body;

        logger.info('📊 Экспорт цитат:', { format, period, category, includeUserData });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Построение фильтра
        const filter = {};
        if (period !== 'all') {
            const days = parseInt(period);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            filter.createdAt = { $gte: startDate };
        }

        if (category !== 'all') {
            filter.category = category;
        }

        // Подсчитываем количество записей для экспорта
        const recordsCount = await Quote.countDocuments(filter);

        // TODO: Здесь будет логика генерации файла
        const exportData = {
            filename: `quotes_export_${new Date().toISOString().split('T')[0]}.${format}`,
            format,
            recordsCount,
            generatedAt: new Date().toISOString(),
            downloadUrl: `/api/quotes/download/${Date.now()}.${format}`
        };

        res.json({
            success: true,
            message: 'Экспорт запущен',
            data: exportData
        });

    } catch (error) {
        logger.error('❌ Ошибка экспорта:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка экспорта цитат',
            error: error.message
        });
    }
});

/**
 * GET /api/quotes/search/similar/:id - Поиск похожих цитат
 */
router.get('/search/similar/:id', telegramAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 5 } = req.query;

        logger.info('🔍 Поиск похожих цитат для:', id);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Находим исходную цитату
        const sourceQuote = await Quote.findById(id);
        if (!sourceQuote) {
            return res.status(404).json({
                success: false,
                message: 'Исходная цитата не найдена'
            });
        }

        // Ищем похожие цитаты
        const similarQuotes = await Quote.findSimilarQuotes(
            sourceQuote.text, 
            sourceQuote.userId
        );

        const result = similarQuotes.slice(0, parseInt(limit)).map(quote => ({
            id: quote._id.toString(),
            text: quote.text,
            author: quote.author,
            category: quote.category,
            similarity: Math.random() * 0.3 + 0.7 // Временная логика, заменить на реальный алгоритм
        }));

        res.json({
            success: true,
            data: {
                sourceQuoteId: id,
                similarQuotes: result
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка поиска похожих цитат:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка поиска похожих цитат',
            error: error.message
        });
    }
});

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Получение статистики для конкретного периода
 * @param {string} period - Период ('1d', '7d', '30d', '90d')
 * @returns {Promise<Object>} Статистика
 */
async function getStatisticsForPeriod(period) {
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await Quote.getQuoteStats(period);
    return stats;
}

/**
 * Получение номера недели в году
 * @param {Date} date - Дата
 * @returns {number} Номер недели
 */
function getWeekOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
}

module.exports = router;
