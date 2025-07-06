/**
 * API роуты для управления цитатами проекта "Читатель"
 * Адаптировано из Shrooms Support Bot для нового проекта
 * @file server/api/quotes.js
 */

const express = require('express');
const router = express.Router();

// Импорт middleware
const { basicAdminAuth } = require('../middleware/auth');
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
 * GET /api/quotes - Получение списка цитат с фильтрацией
 */
router.get('/', basicAdminAuth, async (req, res) => {
    try {
        const {
            period = '7d',
            category = 'all',
            author = 'all',
            search = '',
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        logger.info('📝 Получение цитат с фильтрами:', {
            period, category, author, search, page, limit
        });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Построение фильтра для MongoDB
        const filter = {};
        
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
            weekNumber: quote.weekNumber,
            monthNumber: quote.monthNumber,
            createdAt: quote.createdAt,
            isEdited: quote.isEdited,
            editedAt: quote.editedAt,
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
 * GET /api/quotes/statistics - Получение статистики цитат
 */
router.get('/statistics', basicAdminAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;

        logger.info('📊 Получение статистики цитат за период:', period);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Определяем временные рамки
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - days);

        // Выполняем статистические запросы параллельно
        const [
            currentStats,
            previousStats,
            topCategories,
            uniqueAuthors
        ] = await Promise.all([
            Quote.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
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
                { $match: { createdAt: { $gte: startDate } } },
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
                createdAt: { $gte: startDate },
                author: { $ne: null, $ne: '' }
            })
        ]);

        const current = currentStats[0] || { totalQuotes: 0, avgDaily: 0 };
        const previous = previousStats[0] || { totalQuotes: 0 };
        const topCategory = topCategories[0] || { _id: 'Другое' };

        // Вычисляем изменения
        const quotesChange = current.totalQuotes - previous.totalQuotes;
        const authorsChange = uniqueAuthors.length;
        const dailyAverage = Math.round((current.totalQuotes / days) * 10) / 10;

        const statistics = {
            totalQuotes: current.totalQuotes,
            totalAuthors: uniqueAuthors.length,
            popularCategory: topCategory._id,
            dailyAverage,
            changeStats: {
                quotesChange: quotesChange > 0 ? `+${quotesChange}` : quotesChange.toString(),
                authorsChange: `+${authorsChange}`,
                avgChange: '+0.0' // Временно, нужна логика расчета
            },
            period
        };

        res.json({
            success: true,
            data: statistics
        });

    } catch (error) {
        logger.error('❌ Ошибка получения статистики:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения статистики цитат',
            error: error.message
        });
    }
});

/**
 * GET /api/quotes/analytics - Получение аналитических данных для графиков
 */
router.get('/analytics', basicAdminAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;

        logger.info('📈 Получение аналитики цитат за период:', period);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Параллельные запросы для аналитики
        const [
            categoriesData,
            timelineData,
            topAuthorsData,
            sentimentData
        ] = await Promise.all([
            // Распределение по категориям
            Quote.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
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
                { $match: { createdAt: { $gte: startDate } } },
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
                { $match: { createdAt: { $gte: startDate } } },
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
            'Саморазвитие': '#d4af37',
            'Любовь': '#c97a7e', 
            'Мудрость': '#81b3d3',
            'Философия': '#a8c686',
            'Творчество': '#deb887',
            'Мотивация': '#cd853f',
            'Отношения': '#f4a460',
            'Материнство': '#dda0dd',
            'Карьера': '#98fb98',
            'Другое': '#d3d3d3'
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
router.get('/:id', basicAdminAuth, async (req, res) => {
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
router.post('/:id/analyze', basicAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        logger.info('🤖 Запуск AI анализа цитаты:', id);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Находим цитату
        const quote = await Quote.findById(id);
        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Цитата не найдена'
            });
        }

        // TODO: Здесь будет интеграция с Claude для анализа
        // const claudeService = require('../services/claudeService');
        // const analysis = await claudeService.analyzeQuote(quote.text, quote.author);

        res.json({
            success: true,
            message: 'AI анализ запущен',
            data: {
                quoteId: id,
                status: 'processing',
                estimatedTime: '30 секунд'
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка запуска анализа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка запуска AI анализа',
            error: error.message
        });
    }
});

/**
 * PUT /api/quotes/:id - Обновление цитаты (редактирование)
 */
router.put('/:id', basicAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { text, author, category, themes } = req.body;

        logger.info('✏️ Обновление цитаты:', id, { text, author, category });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Валидация
        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Текст цитаты не может быть пустым'
            });
        }

        if (text.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Текст цитаты не может превышать 1000 символов'
            });
        }

        // Обновляем цитату
        const updatedQuote = await Quote.findByIdAndUpdate(
            id,
            {
                text: text.trim(),
                author: author?.trim() || null,
                category: category || 'Другое',
                themes: themes || [],
                isEdited: true,
                editedAt: new Date()
            },
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
            message: 'Цитата успешно обновлена',
            data: {
                id: updatedQuote._id.toString(),
                text: updatedQuote.text,
                author: updatedQuote.author,
                category: updatedQuote.category,
                themes: updatedQuote.themes,
                updatedAt: updatedQuote.editedAt,
                updatedBy: req.user?.username || 'admin'
            }
        });

    } catch (error) {
        logger.error('❌ Ошибка обновления цитаты:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка обновления цитаты',
            error: error.message
        });
    }
});

/**
 * DELETE /api/quotes/:id - Удаление цитаты
 */
router.delete('/:id', basicAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason = 'Удалено администратором' } = req.body;

        logger.info('🗑️ Удаление цитаты:', id, 'Причина:', reason);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Находим и удаляем цитату
        const deletedQuote = await Quote.findByIdAndDelete(id);

        if (!deletedQuote) {
            return res.status(404).json({
                success: false,
                message: 'Цитата не найдена'
            });
        }

        // Логируем удаление для аудита
        logger.info('🗑️ Цитата удалена:', {
            id,
            text: deletedQuote.text,
            author: deletedQuote.author,
            userId: deletedQuote.userId,
            reason,
            deletedBy: req.user?.username || 'admin'
        });

        res.json({
            success: true,
            message: 'Цитата успешно удалена',
            data: {
                id,
                deletedAt: new Date().toISOString(),
                deletedBy: req.user?.username || 'admin',
                reason
            }
        });

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
 * POST /api/quotes/export - Экспорт цитат
 */
router.post('/export', basicAdminAuth, async (req, res) => {
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
router.get('/search/similar/:id', basicAdminAuth, async (req, res) => {
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

module.exports = router;