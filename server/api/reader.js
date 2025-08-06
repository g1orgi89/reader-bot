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
const quoteHandler = require('../services/quoteHandler');



/**
 * Authentication middleware для защищенных routes
 */
const authenticateUser = async (req, res, next) => {
    try {
        const user = req.body.user || req.headers['x-telegram-user'];
        
        if (!user || !user.id) {
            return res.status(401).json({ 
                success: false, 
                error: 'Telegram user data required' 
            });
        }
        
        const userId = user.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        if (!userProfile) {
            return res.status(401).json({ 
                success: false, 
                error: 'User not found. Complete onboarding first.' 
            });
        }
        
        req.userId = userId;
        req.user = userProfile;
        req.telegramUser = user;
        
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication failed' 
        });
    }
};

// Применяем middleware к защищенным routes
router.use(['/profile', '/quotes', '/reports', '/community', '/catalog', '/stats'], authenticateUser);

/**
 * @description Telegram аутентификация для Mini App
 * @route POST /api/reader/auth/telegram
 */
router.post('/auth/telegram', async (req, res) => {
    try {
        console.log('📱 Telegram Auth Request:', req.body);
        
        const { user } = req.body;
        
        if (!user || !user.id) {
            return res.status(400).json({
                success: false,
                error: 'Отсутствуют данные пользователя Telegram'
            });
        }

        // Проверяем, существует ли пользователь в базе
        const userProfile = await UserProfile.findOne({ userId: user.id.toString() });
        
        // Простая аутентификация для начала
        const authData = {
            success: true,
            user: {
                id: user.id,
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                username: user.username || '',
                telegramId: user.id,
                isOnboardingCompleted: userProfile ? userProfile.isOnboardingComplete : false
            },
            token: `temp_token_${user.id}_${Date.now()}`, // Временный токен
            isOnboardingCompleted: userProfile ? userProfile.isOnboardingComplete : false
        };

        console.log('✅ Auth Success:', authData);
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
        console.log('📊 Onboarding Status Check');
        
        // Пытаемся получить пользователя из данных запроса
        const user = req.body.user || req.headers['x-telegram-user'];
        
        if (user && user.id) {
            // Проверяем в базе данных
            const userProfile = await UserProfile.findOne({ userId: user.id.toString() });
            
            if (userProfile && userProfile.isOnboardingComplete) {
                return res.json({
                    success: true,
                    isCompleted: true,
                    completed: true, // Для совместимости с фронтендом
                    user: {
                        userId: userProfile.userId,
                        name: userProfile.name,
                        email: userProfile.email
                    }
                });
            }
        }
        
        // Если пользователь не найден или онбординг не завершен
        res.json({
            success: true,
            isCompleted: false,
            completed: false, // Для совместимости с фронтендом
            data: null
        });

    } catch (error) {
        console.error('❌ Onboarding Status Error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка проверки статуса онбординга'
        });
    }
});

/**
 * @description Завершение онбординга
 * @route POST /api/reader/auth/complete-onboarding
 */
router.post('/auth/complete-onboarding', async (req, res) => {
    try {
        const { user, answers, email, source } = req.body;
        
        if (!user || !user.id || !answers || !email || !source) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: user, answers, email, source'
            });
        }
        
        const existingUser = await UserProfile.findOne({ userId: user.id.toString() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User already completed onboarding'
            });
        }
        
        const userProfile = new UserProfile({
            userId: user.id.toString(),
            name: answers.question1_name || answers.name,
            email: email,
            testResults: {
                question1_name: answers.question1_name || answers.name,
                question2_lifestyle: answers.question2_lifestyle || answers.lifestyle,
                question3_time: answers.question3_time || answers.timeForSelf,
                question4_priorities: answers.question4_priorities || answers.priorities,
                question5_reading_feeling: answers.question5_reading_feeling || answers.readingFeelings,
                question6_phrase: answers.question6_phrase || answers.closestPhrase,
                question7_reading_time: answers.question7_reading_time || answers.readingTime,
                completedAt: new Date()
            },
            source: source,
            telegramUsername: user.username,
            telegramData: {
                firstName: user.first_name,
                lastName: user.last_name,
                languageCode: user.language_code,
                chatId: user.id.toString()
            },
            isOnboardingComplete: true,
            registeredAt: new Date()
        });
        
        await userProfile.save();
        
        console.log(`✅ Пользователь создан: ${userProfile.userId} (${userProfile.name})`);
        
        res.json({
            success: true,
            user: {
                userId: userProfile.userId,
                name: userProfile.name,
                email: userProfile.email,
                isOnboardingComplete: true
            },
            message: 'Онбординг успешно завершен'
        });
    } catch (error) {
        console.error('❌ Ошибка онбординга:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @description Debug endpoint для viewport данных
 * @route POST /api/reader/debug/viewport
 */
router.post('/debug/viewport', async (req, res) => {
    try {
        console.log('🔧 Debug Viewport:', req.body);
        
        res.json({
            success: true,
            message: 'Viewport data received',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Debug Viewport Error:', error);
        res.status(500).json({
            success: false,
            error: 'Debug error'
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
        res.json({
            success: true,
            user: {
                userId: req.user.userId,
                name: req.user.name,
                email: req.user.email,
                isOnboardingComplete: req.user.isOnboardingComplete,
                registeredAt: req.user.registeredAt,
                source: req.user.source,
                preferences: req.user.preferences,
                settings: req.user.settings
            }
        });
    } catch (error) {
        console.error('❌ Profile Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @description Получение статистики пользователя
 * @route GET /api/reader/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = req.user.statistics;
        const todayQuotes = await Quote.getTodayQuotesCount(req.userId);
        
        res.json({
            success: true,
            stats: {
                totalQuotes: stats.totalQuotes,
                currentStreak: stats.currentStreak,
                longestStreak: stats.longestStreak,
                favoriteAuthors: stats.favoriteAuthors,
                monthlyQuotes: stats.monthlyQuotes,
                todayQuotes: todayQuotes,
                daysSinceRegistration: req.user.daysSinceRegistration,
                weeksSinceRegistration: req.user.weeksSinceRegistration
            }
        });
    } catch (error) {
        console.error('❌ Stats Error:', error);
        res.status(500).json({ success: false, error: error.message });
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
        const { text, author, source } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Text is required'
            });
        }
        
        // Проверяем лимит цитат в день
        const todayQuotes = await Quote.getTodayQuotesCount(req.userId);
        if (todayQuotes >= 10) {
            return res.status(429).json({
                success: false,
                error: 'Daily limit of 10 quotes exceeded'
            });
        }
        
        try {
            // Пытаемся добавить цитату с AI анализом
            const result = await quoteHandler.handleQuote(req.userId, text);
            
            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.message
                });
            }
            
            // Обновляем статистику пользователя
            await req.user.updateQuoteStats(result.quote.author);
            
            console.log(`✅ Цитата с AI анализом добавлена: ${req.userId} - "${text.substring(0, 50)}..."`);
            
            res.json({
                success: true,
                quote: {
                    id: result.quote._id,
                    text: result.quote.text,
                    author: result.quote.author,
                    source: result.quote.source,
                    category: result.quote.category,
                    themes: result.quote.themes,
                    sentiment: result.quote.sentiment,
                    isEdited: result.quote.isEdited,
                    editedAt: result.quote.editedAt,
                    createdAt: result.quote.createdAt
                },
                newAchievements: result.newAchievements || [],
                todayCount: result.todayCount
            });
            
        } catch (aiError) {
            // Fallback на ручное сохранение при ошибке AI
            console.warn(`⚠️ AI анализ неудачен, fallback на ручное сохранение: ${aiError.message}`);
            
            const quote = new Quote({
                userId: req.userId,
                text: text.trim(),
                author: author ? author.trim() : null,
                source: source ? source.trim() : null,
                category: 'Другое',
                themes: ['размышления'],
                sentiment: 'neutral'
            });
            
            await quote.save();
            
            // Обновляем статистику пользователя
            await req.user.updateQuoteStats(author);
            
            console.log(`✅ Цитата сохранена вручную (fallback): ${req.userId} - "${text.substring(0, 50)}..."`);
            
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
 * @description Получение цитат пользователя с пагинацией и фильтрами
 * @route GET /api/reader/quotes
 */
router.get('/quotes', async (req, res) => {
    try {
        const { 
            limit = 20, 
            offset = 0, 
            author, 
            search, 
            dateFrom, 
            dateTo 
        } = req.query;
        
        const query = { userId: req.userId };
        
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
            quotes: quotes.map(quote => ({
                id: quote._id,
                text: quote.text,
                author: quote.author,
                source: quote.source,
                category: quote.category,
                themes: quote.themes,
                sentiment: quote.sentiment,
                isEdited: quote.isEdited,
                editedAt: quote.editedAt,
                createdAt: quote.createdAt
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
 * @description Получение последних цитат
 * @route GET /api/reader/quotes/recent
 */
router.get('/quotes/recent', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const quotes = await Quote.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        res.json({
            success: true,
            quotes: quotes.map(quote => ({
                id: quote._id,
                text: quote.text,
                author: quote.author,
                source: quote.source,
                category: quote.category,
                themes: quote.themes,
                sentiment: quote.sentiment,
                isEdited: quote.isEdited,
                editedAt: quote.editedAt,
                createdAt: quote.createdAt
            }))
        });
        
    } catch (error) {
        console.error('❌ Get Recent Quotes Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @description Получение детальной информации о цитате
 * @route GET /api/reader/quotes/:id
 */
router.get('/quotes/:id', async (req, res) => {
    try {
        const quote = await Quote.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        
        if (!quote) {
            return res.status(404).json({
                success: false,
                error: 'Quote not found'
            });
        }
        
        // Получаем контекст: номер недели, позицию в неделе, общее количество
        const weekQuotes = await Quote.getWeeklyQuotes(req.userId, quote.weekNumber, quote.yearNumber);
        const totalQuotes = await Quote.countDocuments({ userId: req.userId });
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
        const { text, author, source } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Text is required'
            });
        }
        
        const quote = await Quote.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        
        if (!quote) {
            return res.status(404).json({
                success: false,
                error: 'Quote not found'
            });
        }
        
        try {
            // Выполняем только AI анализ обновленного текста (без создания новой цитаты)
            const parsedQuote = quoteHandler._parseQuote(author ? `"${text}" (${author})` : text);
            const analysis = await quoteHandler._analyzeQuote(parsedQuote.text, parsedQuote.author);
            
            // Обновляем цитату с результатами AI анализа
            quote.text = text.trim();
            quote.author = author ? author.trim() : null;
            quote.source = source ? source.trim() : null;
            quote.category = analysis.category;
            quote.themes = analysis.themes;
            quote.sentiment = analysis.sentiment;
            quote.isEdited = true;
            quote.editedAt = new Date();
            
            await quote.save();
            
            console.log(`✅ Цитата отредактирована с AI анализом: ${req.userId} - ${req.params.id}`);
            
        } catch (aiError) {
            // Fallback на ручное обновление при ошибке AI
            console.warn(`⚠️ AI анализ при редактировании неудачен, fallback: ${aiError.message}`);
            
            quote.text = text.trim();
            quote.author = author ? author.trim() : null;
            quote.source = source ? source.trim() : null;
            quote.isEdited = true;
            quote.editedAt = new Date();
            
            await quote.save();
            
            console.log(`✅ Цитата отредактирована вручную (fallback): ${req.userId} - ${req.params.id}`);
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
            return res.status(400).json({
                success: false,
                error: 'Text is required'
            });
        }
        
        // Выполняем только анализ без сохранения
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
 * @description Поиск по цитатам пользователя с подсветкой
 * @route GET /api/reader/quotes/search
 */
router.get('/quotes/search', async (req, res) => {
    try {
        const { q: searchQuery, limit = 20 } = req.query;
        
        if (!searchQuery || searchQuery.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        
        const quotes = await Quote.searchUserQuotes(req.userId, searchQuery.trim(), parseInt(limit));
        
        // Добавляем подсветку найденных фрагментов
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
        const quote = await Quote.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        
        if (!quote) {
            return res.status(404).json({
                success: false,
                error: 'Quote not found'
            });
        }
        
        await quote.deleteOne();
        
        console.log(`✅ Цитата удалена: ${req.userId} - ${req.params.id}`);
        
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
 * @description Получение еженедельных отчетов
 * @route GET /api/reader/reports/weekly
 */
router.get('/reports/weekly', async (req, res) => {
    try {
        const { limit = 5, offset = 0 } = req.query;
        
        const reports = await WeeklyReport.find({ userId: req.userId })
            .sort({ sentAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .populate('quotes');
            
        res.json({
            success: true,
            reports: reports.map(report => ({
                id: report._id,
                weekNumber: report.weekNumber,
                year: report.year,
                quotesCount: report.quotesCount,
                analysis: report.analysis,
                recommendations: report.recommendations,
                sentAt: report.sentAt,
                isRead: report.isRead
            }))
        });
        
    } catch (error) {
        console.error('❌ Get Weekly Reports Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @description Получение месячных отчетов
 * @route GET /api/reader/reports/monthly
 */
router.get('/reports/monthly', async (req, res) => {
    try {
        const { limit = 3, offset = 0 } = req.query;
        
        const reports = await MonthlyReport.find({ userId: req.userId })
            .sort({ sentAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset));
            
        res.json({
            success: true,
            reports: reports.map(report => ({
                id: report._id,
                month: report.month,
                year: report.year,
                monthStats: report.monthStats,
                analysis: report.analysis,
                specialOffer: report.specialOffer,
                sentAt: report.sentAt,
                hasSurveyResponse: report.hasSurveyResponse,
                hasFeedback: report.hasFeedback
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
 * @description Получение каталога книг с фильтрами
 * @route GET /api/reader/catalog
 */
router.get('/catalog', async (req, res) => {
    try {
        const { category, limit = 20, offset = 0 } = req.query;
        
        const query = { isActive: true };
        if (category) {
            query.categories = category;
        }
        
        const books = await BookCatalog.find(query)
            .sort({ priority: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset));
            
        const total = await BookCatalog.countDocuments(query);
        
        res.json({
            success: true,
            books: books.map(book => ({
                id: book._id,
                title: book.title,
                author: book.author,
                description: book.description,
                price: book.price,
                categories: book.categories,
                bookSlug: book.bookSlug,
                utmLink: book.utmLink
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
 * @description Получение персональных рекомендаций
 * @route GET /api/reader/recommendations
 */
router.get('/recommendations', async (req, res) => {
    try {
        // Анализируем предпочтения пользователя
        const userThemes = req.user.preferences?.mainThemes || [];
        
        // Получаем рекомендации на основе тем
        let recommendations = await BookCatalog.getRecommendationsByThemes(userThemes, 3);
        
        // Если недостаточно, добавляем универсальные
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
 * @description Получение статистики сообщества
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
                totalQuotes: totalQuotes,
                topAuthors: topAuthors.map(author => author._id).slice(0, 3),
                activeReaders: activeUsers,
                newQuotes: await Quote.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
                totalReaders: totalUsers,
                totalAuthors: topAuthors.length,
                daysActive: 67 // Можно вычислить динамически
            }
        });
        
    } catch (error) {
        console.error('❌ Get Community Stats Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @description Получение рейтинга пользователей
 * @route GET /api/reader/community/leaderboard
 */
router.get('/community/leaderboard', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // Получаем топ пользователей по количеству цитат
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
        
        // Добавляем позиции и обезличиваем имена
        const result = leaderboard.map((user, index) => ({
            position: index + 1,
            name: user.name.charAt(0) + '***', // Обезличиваем имена
            quotes: user.statistics.totalQuotes,
            quotesThisWeek: Math.floor(Math.random() * 20), // Заглушка
            isCurrentUser: user.userId === req.userId
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

/**
 * @description Базовая проверка работоспособности API
 * @route GET /api/reader/health
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Reader API is working',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;