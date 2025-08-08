/**
 * @fileoverview Reader Bot Mini App API Endpoints
 * @description API маршруты для Telegram Mini App
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

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

// JWT секрет для подписи токенов
const JWT_SECRET = process.env.JWT_SECRET || 'reader_bot_secret_key_2024';

// 🎯 DEBUG ENVIRONMENT CONTROLS
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';
const DEBUG_QUOTES = process.env.DEBUG_QUOTES === 'true';
const DEBUG_AI = process.env.DEBUG_AI === 'true';
const DEBUG_DB = process.env.DEBUG_DB === 'true';
const DEBUG_ALL = process.env.DEBUG_ALL === 'true';

/**
 * ИСПРАВЛЕНО: Authentication middleware для защищенных routes с JWT
 * 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: Middleware блокирует все запросы без JWT токена,
 * но debug режим не создает валидный токен, вызывая 401 ошибки
 * TODO: Добавить поддержку debug режима или создавать JWT для debug пользователей
 */
const authenticateUser = async (req, res, next) => {
    try {
        // 🔐 COMPREHENSIVE AUTH MIDDLEWARE DEBUG
        if (DEBUG_AUTH || DEBUG_ALL) {
            console.log('🔐 [AUTH MIDDLEWARE DEBUG]', {
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.url,
                
                // Headers analysis
                hasAuthHeader: !!req.headers.authorization,
                authHeaderType: req.headers.authorization?.split(' ')[0],
                authHeaderLength: req.headers.authorization?.length,
                authHeaderPreview: req.headers.authorization?.substring(0, 50) + '...',
                
                // All headers for debugging
                allHeaders: Object.keys(req.headers),
                userAgent: req.headers['user-agent'],
                
                // Telegram Web App context
                isTelegramWebApp: !!req.headers['x-telegram-web-app'],
                telegramVersion: req.headers['x-telegram-web-app-version'],
                telegramPlatform: req.headers['x-telegram-web-app-platform'],
                referrer: req.headers.referer,
                origin: req.headers.origin,
                
                // Request body preview
                hasBody: !!req.body,
                bodyKeys: req.body ? Object.keys(req.body) : []
            });
        }
        
        // ИСПРАВЛЕНО: Получаем токен из заголовка Authorization
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            if (DEBUG_AUTH || DEBUG_ALL) {
                console.log('❌ [AUTH DEBUG] No valid authorization header', {
                    hasAuthHeader: !!authHeader,
                    authHeaderValue: authHeader?.substring(0, 20) + '...',
                    expectedFormat: 'Bearer <token>'
                });
            }
            return res.status(401).json({ 
                success: false, 
                error: 'Authorization token required' 
            });
        }
        
        const token = authHeader.substring(7); // Убираем "Bearer "
        
        // ИСПРАВЛЕНО: Проверяем JWT токен
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const userId = decoded.userId;
            
            if (DEBUG_AUTH || DEBUG_ALL) {
                console.log('🔐 [AUTH DEBUG] JWT verification successful', {
                    extractedToken: token ? `${token.substring(0, 20)}...` : null,
                    tokenValid: !!decoded,
                    extractedUserId: decoded?.userId,
                    tokenPayload: {
                        userId: decoded?.userId,
                        iat: decoded?.iat,
                        exp: decoded?.exp,
                        telegramUserId: decoded?.telegramUser?.id
                    }
                });
            }
            
            // Находим пользователя в базе
            const userProfile = await UserProfile.findOne({ userId });
            if (!userProfile) {
                if (DEBUG_AUTH || DEBUG_ALL) {
                    console.log('❌ [AUTH DEBUG] User not found in database', {
                        searchedUserId: userId,
                        jwtUserId: decoded.userId
                    });
                }
                return res.status(401).json({ 
                    success: false, 
                    error: 'User not found. Complete onboarding first.' 
                });
            }
            
            req.userId = userId;
            req.user = userProfile;
            req.telegramUser = decoded.telegramUser;
            
            if (DEBUG_AUTH || DEBUG_ALL) {
                console.log('✅ [AUTH DEBUG] Authentication successful', {
                    finalUserId: userId,
                    userExists: !!userProfile,
                    userName: userProfile?.name,
                    isOnboardingComplete: userProfile?.isOnboardingComplete
                });
            }
            
            next();
        } catch (jwtError) {
            if (DEBUG_AUTH || DEBUG_ALL) {
                console.log('❌ [AUTH DEBUG] JWT verification failed', {
                    error: jwtError.message,
                    tokenPreview: token?.substring(0, 30) + '...',
                    jwtErrorName: jwtError.name,
                    isExpired: jwtError.name === 'TokenExpiredError',
                    isInvalid: jwtError.name === 'JsonWebTokenError'
                });
            }
            console.error('❌ JWT verification failed:', jwtError.message);
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid or expired token' 
            });
        }
        
    } catch (error) {
        if (DEBUG_AUTH || DEBUG_ALL) {
            console.log('❌ [AUTH DEBUG] Middleware error', {
                error: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method
            });
        }
        console.error('❌ Authentication middleware error:', error);
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication failed' 
        });
    }
};

// Применяем middleware к защищенным routes
router.use(['/profile', '/quotes', '/reports', '/community', '/catalog', '/stats'], authenticateUser);

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
        // 📱 TELEGRAM AUTH COMPREHENSIVE DEBUG
        if (DEBUG_AUTH || DEBUG_ALL) {
            console.log('📱 [TELEGRAM AUTH DEBUG]', {
                timestamp: new Date().toISOString(),
                telegramDataReceived: !!req.body.telegramData,
                userDataReceived: !!req.body.user,
                userIdFromTelegram: req.body.user?.id,
                
                // Telegram data analysis
                telegramDataPreview: req.body.telegramData?.substring(0, 100) + '...',
                userDataKeys: req.body.user ? Object.keys(req.body.user) : [],
                
                // Headers analysis for Telegram context
                telegramHeaders: {
                    isTelegramWebApp: !!req.headers['x-telegram-web-app'],
                    telegramVersion: req.headers['x-telegram-web-app-version'],
                    telegramPlatform: req.headers['x-telegram-web-app-platform'],
                    userAgent: req.headers['user-agent'],
                    referrer: req.headers.referer,
                    origin: req.headers.origin
                },
                
                // Full request body structure (sanitized)
                requestStructure: {
                    hasUser: !!req.body.user,
                    hasTelegramData: !!req.body.telegramData,
                    userFields: req.body.user ? Object.keys(req.body.user) : [],
                    telegramDataLength: req.body.telegramData?.length || 0
                }
            });
        }
        
        console.log('📱 Telegram Auth Request:', req.body);
        
        const { telegramData, user } = req.body;
        
        if (!user || !user.id) {
            if (DEBUG_AUTH || DEBUG_ALL) {
                console.log('❌ [TELEGRAM AUTH DEBUG] Missing user data', {
                    hasUser: !!user,
                    userKeys: user ? Object.keys(user) : [],
                    hasUserId: !!(user && user.id)
                });
            }
            return res.status(400).json({
                success: false,
                error: 'Отсутствуют данные пользователя Telegram'
            });
        }

        // ИСПРАВЛЕНО: Проверяем, существует ли пользователь в базе
        // 🚨 ПОТЕНЦИАЛЬНАЯ ПРОБЛЕМА: Race condition между проверкой и созданием
        // TODO: Добавить атомарную операцию создания пользователя
        const userId = user.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        
        if (DEBUG_AUTH || DEBUG_ALL) {
            console.log('📱 [TELEGRAM AUTH DEBUG] User lookup', {
                searchUserId: userId,
                userExists: !!userProfile,
                userOnboardingComplete: userProfile?.isOnboardingComplete,
                userName: userProfile?.name
            });
        }
        
        // ИСПРАВЛЕНО: Создаем JWT токен
        const tokenPayload = {
            userId: userId,
            telegramUser: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username
            },
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 дней
        };
        
        const token = jwt.sign(tokenPayload, JWT_SECRET);
        
        if (DEBUG_AUTH || DEBUG_ALL) {
            console.log('📱 [TELEGRAM AUTH DEBUG] JWT generation', {
                tokenGenerated: !!token,
                tokenLength: token?.length,
                tokenPreview: token ? `${token.substring(0, 30)}...` : null,
                tokenPayload: {
                    userId: tokenPayload.userId,
                    telegramUserId: tokenPayload.telegramUser.id,
                    expiresIn: '30 days',
                    issuedAt: new Date(tokenPayload.iat * 1000).toISOString(),
                    expiresAt: new Date(tokenPayload.exp * 1000).toISOString()
                }
            });
        }
        
        // ИСПРАВЛЕНО: Формируем ответ с реальными данными
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
            token: token,
            isOnboardingCompleted: userProfile ? userProfile.isOnboardingComplete : false,
            expiresIn: '30d'
        };

        // Log final auth result
        if (DEBUG_AUTH || DEBUG_ALL) {
            console.log('✅ [TELEGRAM AUTH RESULT]', {
                success: authData.success,
                userId: authData.user.id,
                isOnboardingCompleted: authData.isOnboardingCompleted,
                tokenGenerated: !!authData.token,
                responseStructure: Object.keys(authData),
                userFields: Object.keys(authData.user)
            });
        }

        console.log('✅ Auth Success:', {
            userId: authData.user.id,
            firstName: authData.user.firstName,
            isOnboardingCompleted: authData.isOnboardingCompleted,
            tokenGenerated: !!authData.token
        });
        
        res.json(authData);

    } catch (error) {
        if (DEBUG_AUTH || DEBUG_ALL) {
            console.log('❌ [TELEGRAM AUTH DEBUG] Error occurred', {
                error: error.message,
                stack: error.stack,
                requestBody: req.body ? Object.keys(req.body) : [],
                errorName: error.name
            });
        }
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
 * ИСПРАВЛЕНО: Использует опциональную JWT аутентификацию для правильной проверки статуса
 */
router.get('/auth/onboarding-status', async (req, res) => {
    try {
        console.log('📊 Onboarding Status Check');
        
        // Пытаемся получить токен из заголовка Authorization
        const authHeader = req.headers.authorization;
        let userProfile = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7); // Убираем "Bearer "
                const decoded = jwt.verify(token, JWT_SECRET);
                const userId = decoded.userId;
                
                // Находим пользователя в базе
                userProfile = await UserProfile.findOne({ userId });
                console.log('✅ Найден пользователь по JWT токену:', { userId, isOnboardingComplete: userProfile?.isOnboardingComplete });
            } catch (jwtError) {
                console.warn('⚠️ JWT токен недействителен:', jwtError.message);
                // Продолжаем без аутентификации
            }
        }
        
        if (userProfile && userProfile.isOnboardingComplete) {
            console.log('✅ Пользователь завершил онбординг:', userProfile.userId);
            return res.json({
                success: true,
                isCompleted: true,
                completed: true, // Для совместимости с фронтендом
                user: {
                    userId: userProfile.userId,
                    name: userProfile.name,
                    email: userProfile.email,
                    isOnboardingCompleted: true
                }
            });
        }
        
        // Если пользователь не найден или онбординг не завершен
        console.log('⚠️ Пользователь не завершил онбординг или не найден');
        res.json({
            success: true,
            isCompleted: false,
            completed: false, // Для совместимости с фронтендом
            user: userProfile ? {
                userId: userProfile.userId,
                name: userProfile.name,
                isOnboardingCompleted: false
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
 * @description Завершение онбординга
 * @route POST /api/reader/auth/complete-onboarding
 * 🚨 ИСПРАВЛЕНО: Устранена race condition при создании пользователей
 */
router.post('/auth/complete-onboarding', async (req, res) => {
    try {
        const { telegramData, user, answers, email, source } = req.body;
        
        if (!user || !user.id || !answers || !email || !source) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: user, answers, email, source'
            });
        }

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
        
        if (!wasJustCreated && userProfile.isOnboardingComplete) {
            console.log(`⚠️ Пользователь ${userId} уже завершил онбординг`);
            return res.status(400).json({
                success: false,
                error: 'User already completed onboarding',
                user: {
                    userId: userProfile.userId,
                    name: userProfile.name,
                    email: userProfile.email,
                    isOnboardingComplete: userProfile.isOnboardingComplete
                }
            });
        }

        console.log(`✅ Пользователь ${wasJustCreated ? 'создан' : 'обновлен'}: ${userProfile.userId} (${userProfile.name})`);
        
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
        
        // ИСПРАВЛЕНО: Обрабатываем ошибки дубликатов (E11000)
        if (error.code === 11000) {
            console.warn(`⚠️ Попытка создания дубликата пользователя ${req.body.user?.id}`);
            
            // Если возникла ошибка дубликата, находим существующего пользователя
            try {
                const existingUser = await UserProfile.findOne({ userId: req.body.user.id.toString() });
                if (existingUser && existingUser.isOnboardingComplete) {
                    return res.status(400).json({
                        success: false,
                        error: 'User already completed onboarding',
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
        // ИСПРАВЛЕНО: Защита от undefined значений в статистике пользователя
        const userStats = req.user?.statistics || {};
        const todayQuotes = await Quote.getTodayQuotesCount(req.userId);
        
        // ИСПРАВЛЕНО: Добавляем default значения для всех полей
        const safeStats = {
            totalQuotes: userStats.totalQuotes || 0,
            currentStreak: userStats.currentStreak || 0,
            longestStreak: userStats.longestStreak || 0,
            favoriteAuthors: userStats.favoriteAuthors || [],
            monthlyQuotes: userStats.monthlyQuotes || 0,
            todayQuotes: todayQuotes || 0,
            daysSinceRegistration: req.user?.daysSinceRegistration || 0,
            weeksSinceRegistration: req.user?.weeksSinceRegistration || 0
        };
        
        console.log('📊 Stats response with safe defaults:', {
            userId: req.userId,
            totalQuotes: safeStats.totalQuotes,
            hasUserStats: !!req.user?.statistics
        });
        
        res.json({
            success: true,
            stats: safeStats
        });
    } catch (error) {
        console.error('❌ Stats Error:', error);
        
        // ИСПРАВЛЕНО: Возвращаем безопасные default значения даже при ошибке
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
        // 📝 QUOTES API COMPREHENSIVE DEBUG
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('📝 [QUOTES API DEBUG]', {
                timestamp: new Date().toISOString(),
                endpoint: req.url,
                method: req.method,
                authenticatedUserId: req.userId,
                
                // Quote data analysis
                quoteData: {
                    text: req.body.text?.substring(0, 50) + '...',
                    author: req.body.author,
                    source: req.body.source,
                    hasText: !!req.body.text,
                    hasAuthor: !!req.body.author,
                    hasSource: !!req.body.source,
                    textLength: req.body.text?.length || 0
                },
                
                // User context
                userContext: {
                    userId: req.userId,
                    userName: req.user?.name,
                    userEmail: req.user?.email,
                    isOnboardingComplete: req.user?.isOnboardingComplete
                }
            });
        }
        
        const { text, author, source } = req.body;
        
        if (!text || text.trim().length === 0) {
            if (DEBUG_QUOTES || DEBUG_ALL) {
                console.log('❌ [QUOTES DEBUG] Missing or empty text', {
                    hasText: !!text,
                    textLength: text?.length || 0,
                    textTrimmed: text?.trim().length || 0
                });
            }
            return res.status(400).json({
                success: false,
                error: 'Text is required'
            });
        }
        
        // Проверяем лимит цитат в день
        const todayQuotes = await Quote.getTodayQuotesCount(req.userId);
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('📝 [QUOTES DEBUG] Daily limit check', {
                userId: req.userId,
                todayQuotes: todayQuotes,
                dailyLimit: 10,
                canAddQuote: todayQuotes < 10
            });
        }
        
        if (todayQuotes >= 10) {
            if (DEBUG_QUOTES || DEBUG_ALL) {
                console.log('❌ [QUOTES DEBUG] Daily limit exceeded', {
                    userId: req.userId,
                    todayQuotes: todayQuotes,
                    limit: 10
                });
            }
            return res.status(429).json({
                success: false,
                error: 'Daily limit of 10 quotes exceeded'
            });
        }
        
        try {
            // 🤖 AI ANALYSIS START DEBUG
            if (DEBUG_AI || DEBUG_ALL) {
                console.log('🤖 [AI ANALYSIS START]', {
                    timestamp: new Date().toISOString(),
                    userId: req.userId,
                    quoteText: text?.substring(0, 50) + '...',
                    textLength: text?.length
                });
            }
            
            const aiStartTime = Date.now();
            
            // Пытаемся добавить цитату с AI анализом
            const result = await quoteHandler.handleQuote(req.userId, text);
            
            const aiEndTime = Date.now();
            
            // 🤖 AI ANALYSIS COMPLETE DEBUG
            if (DEBUG_AI || DEBUG_ALL) {
                console.log('🤖 [AI ANALYSIS COMPLETE]', {
                    timestamp: new Date().toISOString(),
                    userId: req.userId,
                    quoteId: result.quote?._id,
                    processingTime: `${aiEndTime - aiStartTime}ms`,
                    success: !!result.success,
                    category: result.quote?.category,
                    themes: result.quote?.themes,
                    sentiment: result.quote?.sentiment
                });
            }
            
            if (!result.success) {
                if (DEBUG_QUOTES || DEBUG_ALL) {
                    console.log('❌ [QUOTES DEBUG] AI processing failed', {
                        userId: req.userId,
                        resultMessage: result.message,
                        resultSuccess: result.success
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: result.message
                });
            }
            
            // 💾 DATABASE DEBUG
            if (DEBUG_DB || DEBUG_ALL) {
                console.log('💾 [DATABASE DEBUG]', {
                    timestamp: new Date().toISOString(),
                    operation: 'UPDATE',
                    table: 'userProfile',
                    userId: req.userId,
                    action: 'updateQuoteStats',
                    author: result.quote.author
                });
            }
            
            // Обновляем статистику пользователя
            await req.user.updateQuoteStats(result.quote.author);
            
            if (DEBUG_QUOTES || DEBUG_ALL) {
                console.log('✅ [QUOTES DEBUG] Quote added successfully', {
                    userId: req.userId,
                    quoteId: result.quote._id,
                    quoteText: text.substring(0, 50) + '...',
                    category: result.quote.category,
                    aiAnalysisTime: `${aiEndTime - aiStartTime}ms`,
                    todayCount: result.todayCount,
                    newAchievements: result.newAchievements?.length || 0
                });
            }
            
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
            // 🤖 AI ANALYSIS ERROR DEBUG
            if (DEBUG_AI || DEBUG_ALL) {
                console.log('❌ [AI ANALYSIS ERROR]', {
                    timestamp: new Date().toISOString(),
                    userId: req.userId,
                    error: aiError.message,
                    errorName: aiError.name,
                    stack: aiError.stack
                });
            }
            
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
            
            // 💾 DATABASE DEBUG - FALLBACK
            if (DEBUG_DB || DEBUG_ALL) {
                console.log('💾 [DATABASE DEBUG - FALLBACK]', {
                    timestamp: new Date().toISOString(),
                    operation: 'INSERT',
                    table: 'quotes',
                    userId: req.userId,
                    fallbackReason: 'AI_ANALYSIS_FAILED',
                    quoteData: {
                        text: text.substring(0, 50) + '...',
                        author: author,
                        source: source,
                        category: 'Другое'
                    }
                });
            }
            
            await quote.save();

            // ✅ АВТОМАТИЧЕСКИЙ AI АНАЛИЗ ДЛЯ FALLBACK
            try {
                const QuoteHandler = require('../handlers/QuoteHandler');
                await QuoteHandler.reanalyzeQuote(quote._id);
                console.log('🤖 AI анализ выполнен для fallback цитаты:', quote._id);
            } catch (aiError) {
                console.warn('⚠️ AI анализ fallback не удался:', aiError.message);
            }

            // Обновляем статистику пользователя
            await req.user.updateQuoteStats(author);
            
            if (DEBUG_QUOTES || DEBUG_ALL) {
                console.log('✅ [QUOTES DEBUG] Fallback quote saved', {
                    userId: req.userId,
                    quoteId: quote._id,
                    fallbackCategory: 'Другое',
                    manualSave: true
                });
            }
            
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
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('❌ [QUOTES DEBUG] Endpoint error', {
                error: error.message,
                stack: error.stack,
                userId: req.userId,
                url: req.url
            });
        }
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
        // 📝 QUOTES API DEBUG - GET
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('📝 [QUOTES API DEBUG]', {
                timestamp: new Date().toISOString(),
                endpoint: req.url,
                method: req.method,
                authenticatedUserId: req.userId,
                
                // Query parameters
                queryParams: req.query,
                filters: {
                    hasAuthorFilter: !!req.query.author,
                    hasSearchFilter: !!req.query.search,
                    hasDateFilter: !!(req.query.dateFrom || req.query.dateTo),
                    limit: req.query.limit || 20,
                    offset: req.query.offset || 0
                }
            });
        }
        
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
        
        // 💾 DATABASE DEBUG - QUOTES QUERY
        if (DEBUG_DB || DEBUG_ALL) {
            console.log('💾 [DATABASE DEBUG]', {
                timestamp: new Date().toISOString(),
                operation: 'SELECT',
                table: 'quotes',
                userId: req.userId,
                conditions: query,
                pagination: { limit: parseInt(limit), offset: parseInt(offset) }
            });
        }
        
        const quotes = await Quote.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset));
            
        const total = await Quote.countDocuments(query);
        
        // 💾 DATABASE DEBUG - RESULTS
        if (DEBUG_DB || DEBUG_ALL) {
            console.log('💾 [DATABASE DEBUG]', {
                timestamp: new Date().toISOString(),
                operation: 'SELECT_RESULT',
                table: 'quotes',
                userId: req.userId,
                resultCount: quotes?.length || 0,
                totalCount: total,
                hasMore: total > parseInt(offset) + parseInt(limit)
            });
        }
        
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('✅ [QUOTES DEBUG] Quotes retrieved', {
                userId: req.userId,
                quotesFound: quotes.length,
                totalQuotes: total,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: total > parseInt(offset) + parseInt(limit)
                },
                filters: {
                    author: author || null,
                    search: search || null,
                    dateRange: (dateFrom || dateTo) ? { from: dateFrom, to: dateTo } : null
                }
            });
        }
        
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
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('❌ [QUOTES DEBUG] GET quotes error', {
                error: error.message,
                stack: error.stack,
                userId: req.userId,
                query: req.query
            });
        }
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
        // 📝 QUOTES API DEBUG - RECENT
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('📝 [QUOTES API DEBUG]', {
                timestamp: new Date().toISOString(),
                endpoint: req.url,
                method: req.method,
                authenticatedUserId: req.userId,
                requestedLimit: req.query.limit || 10
            });
        }
        
        const { limit = 10 } = req.query;
        
        // 💾 DATABASE DEBUG - RECENT QUOTES
        if (DEBUG_DB || DEBUG_ALL) {
            console.log('💾 [DATABASE DEBUG]', {
                timestamp: new Date().toISOString(),
                operation: 'SELECT',
                table: 'quotes',
                userId: req.userId,
                conditions: { userId: req.userId },
                sort: { createdAt: -1 },
                limit: parseInt(limit)
            });
        }
        
        const quotes = await Quote.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        // 💾 DATABASE DEBUG - RECENT RESULTS
        if (DEBUG_DB || DEBUG_ALL) {
            console.log('💾 [DATABASE DEBUG]', {
                timestamp: new Date().toISOString(),
                operation: 'SELECT_RESULT',
                table: 'quotes',
                userId: req.userId,
                resultCount: quotes?.length || 0
            });
        }
        
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('✅ [QUOTES DEBUG] Recent quotes retrieved', {
                userId: req.userId,
                quotesFound: quotes.length,
                requestedLimit: parseInt(limit),
                oldestQuoteDate: quotes.length > 0 ? quotes[quotes.length - 1].createdAt : null,
                newestQuoteDate: quotes.length > 0 ? quotes[0].createdAt : null
            });
        }
        
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
        if (DEBUG_QUOTES || DEBUG_ALL) {
            console.log('❌ [QUOTES DEBUG] GET recent quotes error', {
                error: error.message,
                stack: error.stack,
                userId: req.userId,
                limit: req.query.limit
            });
        }
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
        const favoriteCategories = req.user.statistics?.favoriteAuthors || [];
        
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
