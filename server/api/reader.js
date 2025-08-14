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
        const userProfile = await UserProfile.findOne({ userId });
        
        const isOnboardingComplete = userProfile ? userProfile.isOnboardingComplete : false;
        
        res.json({
            success: true,
            isOnboardingComplete,
            user: userProfile ? {
                userId: userProfile.userId,
                name: userProfile.name,
                email: userProfile.email,
                isOnboardingComplete: userProfile.isOnboardingComplete
            } : null
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
 * @description Нормализация входных данных онбординга
 * Преобразует различные варианты source в соответствии с enum схемы
 */
function normalizeOnboardingInput(email, source) {
    // Нормализация email
    const normalizedEmail = email ? email.trim() : '';
    
    // Карта нормализации источников
    const sourceMapping = {
        // Прямые соответствия (уже корректные)
        'Instagram': 'Instagram',
        'Telegram': 'Telegram', 
        'YouTube': 'YouTube',
        'Threads': 'Threads',
        'Друзья': 'Друзья',
        'Другое': 'Другое',
        
        // Проблематичные варианты для нормализации
        'telegram': 'Telegram',        // lowercase -> правильный case
        'От друзей': 'Друзья',        // локализованная строка -> enum значение
        'от друзей': 'Друзья',        // lowercase вариант
        'instagram': 'Instagram',      // lowercase
        'youtube': 'YouTube',          // lowercase
        'threads': 'Threads',          // lowercase
        'другое': 'Другое',           // lowercase
        'друзья': 'Друзья'            // lowercase
    };
    
    // Нормализация source с fallback на 'Другое'
    const normalizedSource = source && sourceMapping[source] 
        ? sourceMapping[source] 
        : 'Другое';
    
    return {
        email: normalizedEmail,
        source: normalizedSource
    };
}

/**
 * @description Завершение онбординга
 * @route POST /api/reader/auth/complete-onboarding
 * 🚨 ИСПРАВЛЕНО: Устранена race condition при создании пользователей
 * 🔧 ДОБАВЛЕНО: Нормализация и валидация входных данных
 */
router.post('/auth/complete-onboarding', async (req, res) => {
    try {
        const { telegramData, user, answers, email, source, forceRetake } = req.body;
        
        if (!user || !user.id || !answers) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: user, answers'
            });
        }

        // Log incoming request for debugging (sanitized)
        console.log('📤 Complete onboarding request:', {
            hasUser: !!user,
            userId: user?.id,
            hasAnswers: !!answers,
            hasEmail: !!email,
            emailLength: email?.length || 0,
            hasSource: !!source,
            isForceRetake: !!forceRetake
        });

        // Нормализация и валидация входных данных
        const { email: normalizedEmail, source: normalizedSource } = normalizeOnboardingInput(email, source);
        
        // Валидация email (должен быть непустым)
        if (!normalizedEmail || normalizedEmail.length === 0) {
            console.log('❌ Email validation failed:', { 
                originalEmail: email, 
                normalizedEmail, 
                reason: 'empty_or_missing' 
            });
            return res.status(400).json({
                success: false,
                error: 'EMAIL_REQUIRED',
                message: 'Email адрес обязателен для завершения регистрации'
            });
        }
        
        // Проверка валидности email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            console.log('❌ Email format validation failed:', { 
                email: normalizedEmail, 
                reason: 'invalid_format' 
            });
            return res.status(400).json({
                success: false,
                error: 'EMAIL_INVALID',
                message: 'Некорректный формат email адреса'
            });
        }

        // Используем нормализованные значения
        const sanitizedEmail = normalizedEmail;
        const sanitizedSource = normalizedSource;

        const userId = user.id.toString();

        // ИСПРАВЛЕНО: Используем атомарную операцию findOneAndUpdate с upsert
        // для предотвращения race conditions при одновременном создании пользователей
        const userProfile = await UserProfile.findOneAndUpdate(
            { userId }, // фильтр для поиска
            {
                $setOnInsert: {
                    // Данные устанавливаются только при создании нового документа
                    userId,
                    name: answers.question1_name || answers.name,
                    email: sanitizedEmail,
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
                    source: sanitizedSource,
                    telegramUsername: user.username,
                    telegramData: {
                        firstName: user.first_name,
                        lastName: user.last_name,
                        languageCode: user.language_code,
                        chatId: user.id.toString()
                    },
                    isOnboardingComplete: true,
                    registeredAt: new Date(),
                    createdAt: new Date()
                },
                $set: {
                    // Всегда обновляем timestamp последнего обновления
                    updatedAt: new Date()
                }
            },
            {
                upsert: true, // создать если не существует
                new: true,    // вернуть обновленный документ
                runValidators: true // проверить валидацию схемы
            }
        );

        // Проверяем, был ли пользователь создан сейчас или уже существовал
        const wasJustCreated = userProfile.createdAt.getTime() === userProfile.updatedAt.getTime();
        
        // RETAKE: Если пользователь уже завершил онбординг и forceRetake не установлен
        if (!wasJustCreated && userProfile.isOnboardingComplete && !forceRetake) {
            console.log(`⚠️ Пользователь ${userId} уже завершил онбординг`);
            return res.status(200).json({
                success: true,
                alreadyCompleted: true,
                user: {
                    userId: userProfile.userId,
                    name: userProfile.name,
                    email: userProfile.email,
                    isOnboardingComplete: userProfile.isOnboardingComplete
                }
            });
        }

        // RETAKE: Если forceRetake установлен, обновляем существующего пользователя
        if (!wasJustCreated && forceRetake) {
            console.log(`🔄 RETAKE: Принудительное обновление пользователя ${userId}`);
            
            // Обновляем данные при повторном прохождении
            await UserProfile.findOneAndUpdate(
                { userId },
                {
                    $set: {
                        name: answers.question1_name || answers.name,
                        email: sanitizedEmail || userProfile.email, // сохраняем существующий email если новый пустой
                        testResults: {
                            question1_name: answers.question1_name || answers.name,
                            question2_lifestyle: answers.question2_lifestyle || answers.lifestyle,
                            question3_time: answers.question3_time || answers.timeForSelf,
                            question4_priorities: answers.question4_priorities || answers.priorities,
                            question5_reading_feeling: answers.question5_reading_feeling || answers.readingFeelings,
                            question6_phrase: answers.question6_phrase || answers.closestPhrase,
                            question7_reading_time: answers.question7_reading_time || answers.readingTime,
                            completedAt: new Date(),
                            retakeAt: new Date() // отмечаем время повторного прохождения
                        },
                        source: sanitizedSource || userProfile.source, // сохраняем существующий source если новый пустой
                        isOnboardingComplete: true,
                        updatedAt: new Date()
                    }
                }
            );
        }

        console.log(`✅ Пользователь ${wasJustCreated ? 'создан' : (forceRetake ? 'обновлен (retake)' : 'обновлен')}: ${userProfile.userId} (${userProfile.name})`);
        
        const responseData = {
            success: true,
            user: {
                userId: userProfile.userId,
                name: userProfile.name,
                email: userProfile.email,
                isOnboardingComplete: true
            },
            message: forceRetake ? 'Онбординг успешно пройден повторно' : 'Онбординг успешно завершен'
        };

        // RETAKE: Добавляем флаг retake в ответ если это повторное прохождение
        if (forceRetake) {
            responseData.retake = true;
        }

        res.json(responseData);
    } catch (error) {
        console.error('❌ Ошибка онбординга:', error);
        
        // ИСПРАВЛЕНО: Обрабатываем ошибки дубликатов (E11000)
        if (error.code === 11000) {
            console.warn(`⚠️ Попытка создания дубликата пользователя ${req.body.user?.id}`);
            
            // Если возникла ошибка дубликата, находим существующего пользователя
            try {
                const existingUser = await UserProfile.findOne({ userId: req.body.user.id.toString() });
                if (existingUser && existingUser.isOnboardingComplete) {
                    return res.status(200).json({
                        success: true,
                        alreadyCompleted: true,
                        user: {
                            userId: existingUser.userId,
                            name: existingUser.name,
                            email: existingUser.email,
                            isOnboardingComplete: true
                        }
                    });
                }
            } catch (findError) {
                console.error('Ошибка поиска существующего пользователя:', findError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error during onboarding'
        });
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
        
        // Используем новый метод для сброса результатов теста
        await userProfile.resetTestResults();
        
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
        
        // Валидация email если передан
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
        
        // Обновление имени если передано
        if (name) {
            user.name = name.trim();
        }
        
        // Обновление аватара если передан
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
        
        // В простой реализации сохраняем base64 напрямую
        // В продакшне здесь должна быть загрузка в облачное хранилище
        user.avatarUrl = image;
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
        
        // Используем новый метод для сброса теста
        await user.resetTestResults();
        
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
        
        // Проверяем лимит цитат в день
        const todayQuotes = await Quote.getTodayQuotesCount(userId);
        if (todayQuotes >= 10) {
            return res.status(429).json({
                success: false,
                error: 'Daily limit of 10 quotes exceeded'
            });
        }
        
        // Получаем пользователя для обновления статистики
        const user = await UserProfile.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        try {
            // Пытаемся добавить цитату с AI анализом
            const result = await quoteHandler.handleQuote(userId, text);
            
            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.message
                });
            }
            
            // Обновляем статистику пользователя
            await user.updateQuoteStats(result.quote.author);
            
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
            console.warn(`⚠️ AI анализ неудачен, fallback на ручное сохранение: ${aiError.message}`);
            
            // Fallback на ручное сохранение при ошибке AI
            const quote = new Quote({
                userId: userId,
                text: text.trim(),
                author: author ? author.trim() : null,
                source: source ? source.trim() : null,
                category: 'Другое',
                themes: ['размышления'],
                sentiment: 'neutral'
            });
            
            await quote.save();

            // Попытка автоматического AI анализа для fallback
            try {
                const QuoteHandler = require('../handlers/QuoteHandler');
                await QuoteHandler.reanalyzeQuote(quote._id);
            } catch (aiError) {
                console.warn('⚠️ AI анализ fallback не удался:', aiError.message);
            }

            // Обновляем статистику пользователя
            await user.updateQuoteStats(author);
            
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
        const userId = getUserId(req);
        const { 
            limit = 20, 
            offset = 0, 
            author, 
            search, 
            dateFrom, 
            dateTo 
        } = req.query;
        
        const query = { userId: userId };
        
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
        const userId = getUserId(req);
        const { limit = 10 } = req.query;
        
        const quotes = await Quote.find({ userId: userId })
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
        const userId = getUserId(req);
        const quote = await Quote.findOne({
            _id: req.params.id,
            userId: userId
        });
        
        if (!quote) {
            return res.status(404).json({
                success: false,
                error: 'Quote not found'
            });
        }
        
        // Получаем контекст: номер недели, позицию в неделе, общее количество
        const weekQuotes = await Quote.getWeeklyQuotes(userId, quote.weekNumber, quote.yearNumber);
        const totalQuotes = await Quote.countDocuments({ userId: userId });
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
        const userId = getUserId(req);
        const { text, author, source } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Text is required'
            });
        }
        
        const quote = await Quote.findOne({
            _id: req.params.id,
            userId: userId
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
            
        } catch (aiError) {
            // Fallback на ручное обновление при ошибке AI
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
        const userId = getUserId(req);
        const { q: searchQuery, limit = 20 } = req.query;
        
        if (!searchQuery || searchQuery.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        
        const quotes = await Quote.searchUserQuotes(userId, searchQuery.trim(), parseInt(limit));
        
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
        const userId = getUserId(req);
        const quote = await Quote.findOne({
            _id: req.params.id,
            userId: userId
        });
        
        if (!quote) {
            return res.status(404).json({
                success: false,
                error: 'Quote not found'
            });
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
 * @description Получение еженедельных отчетов
 * @route GET /api/reader/reports/weekly
 */
router.get('/reports/weekly', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { limit = 5, offset = 0 } = req.query;
        
        const reports = await WeeklyReport.find({ userId: userId })
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
        const userId = getUserId(req);
        const { limit = 3, offset = 0 } = req.query;
        
        const reports = await MonthlyReport.find({ userId: userId })
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
        const userId = getUserId(req);
        const user = await UserProfile.findOne({ userId });
        
        // Анализируем предпочтения пользователя
        const userThemes = user?.preferences?.mainThemes || [];
        const favoriteCategories = user?.statistics?.favoriteAuthors || [];
        
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
        const userId = getUserId(req);
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
            isCurrentUser: user.userId === userId
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
