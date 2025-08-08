/**
 * 📡 API SERVICE - HTTP клиент для Reader Bot backend
 * 
 * Полная интеграция со всеми существующими API endpoints:
 * - Аутентификация через Telegram
 * - Управление цитатами
 * - Еженедельные и месячные отчеты
 * - Статистика и достижения
 * - Каталог книг и рекомендации
 * 
 * Backend endpoints готовы на 100% ✅
 * Размер: ~8KB согласно архитектуре
 * ВЕРСИЯ: 1.0.5 - ОТКЛЮЧЕН DEBUG РЕЖИМ - ТОЛЬКО РЕАЛЬНЫЙ API
 */

class ApiService {
    constructor() {
        // 🌐 Base URL для всех API запросов
        this.baseURL = '/api/reader';
        
        // 🔐 Токен аутентификации - загружаем из storage если есть
        this.authToken = this.loadAuthTokenFromStorage();
        
        // ⚙️ Конфигурация запросов
        this.config = {
            timeout: 30000, // 30 секунд
            retries: 3,
            retryDelay: 1000
        };

        // 📊 Кэширование запросов
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут

        // 🔍 Debug режим - ОТКЛЮЧЕН
        this.debug = false; // ✅ ИСПРАВЛЕНО: Всегда false
        
        console.log('🚀 API Service инициализирован', { 
            baseURL: this.baseURL, 
            debug: this.debug,
            hasStoredToken: !!this.authToken
        });
    }

    /**
     * 🔐 Загружает токен аутентификации из storage
     */
    loadAuthTokenFromStorage() {
        try {
            // Пробуем загрузить из sessionStorage (приоритет)
            if (typeof sessionStorage !== 'undefined') {
                const token = sessionStorage.getItem('reader_auth_token');
                if (token) {
                    console.log('🔑 Токен загружен из sessionStorage');
                    return token;
                }
            }
            
            // Fallback на localStorage
            if (typeof localStorage !== 'undefined') {
                const token = localStorage.getItem('reader_auth_token');
                if (token) {
                    console.log('🔑 Токен загружен из localStorage');
                    return token;
                }
            }
            
            return null;
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить токен из storage:', error);
            return null;
        }
    }

    /**
     * 🔍 Определяет debug режим - ОТКЛЮЧЕН
     */
    isDebugMode() {
        // ✅ ИСПРАВЛЕНО: Всегда false - используем только реальный API
        return false;
    }

    /**
     * 🌐 Определяет базовый URL в зависимости от окружения
     */
    getBaseURL() {
        // ✅ ИСПРАВЛЕНО: Всегда продакшн режим - реальный API
        return '/api/reader';
    }

    /**
     * 🔐 Устанавливает токен аутентификации с comprehensive debugging
     */
    setAuthToken(token) {
        // 📱 AUTH TOKEN SET DEBUG
        if (window.DebugUtils?.shouldLog('auth')) {
            window.DebugUtils.log('auth', '📱', 'AUTH TOKEN SET DEBUG', {
                hadPreviousToken: !!this.authToken,
                newTokenReceived: !!token,
                newTokenLength: token?.length,
                newTokenPreview: token && window.DebugUtils.createTokenPreview ? 
                               window.DebugUtils.createTokenPreview(token) : null,
                tokenType: token ? 'JWT' : null,
                previousTokenPreview: this.authToken && window.DebugUtils.createTokenPreview ?
                                    window.DebugUtils.createTokenPreview(this.authToken) : null
            });
        }

        this.authToken = token;
        
        // ИСПРАВЛЕНИЕ: Сохраняем токен в storage для доступа из service worker
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('reader_auth_token', token);
                
                if (window.DebugUtils?.shouldLog('storage')) {
                    window.DebugUtils.log('storage', '💾', 'Token saved to sessionStorage', {
                        key: 'reader_auth_token',
                        tokenLength: token?.length
                    });
                }
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('reader_auth_token', token);
                
                if (window.DebugUtils?.shouldLog('storage')) {
                    window.DebugUtils.log('storage', '💾', 'Token saved to localStorage', {
                        key: 'reader_auth_token',
                        tokenLength: token?.length
                    });
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить токен в storage:', error);
            
            if (window.DebugUtils?.shouldLog('auth')) {
                window.DebugUtils.log('auth', '⚠️', 'Token storage failed', {
                    error: error.message,
                    hasSessionStorage: typeof sessionStorage !== 'undefined',
                    hasLocalStorage: typeof localStorage !== 'undefined'
                });
            }
        }
        
        // Verify token was set correctly
        if (window.DebugUtils?.shouldLog('auth')) {
            window.DebugUtils.log('auth', '📱', 'AUTH TOKEN VERIFY DEBUG', {
                tokenSetSuccessfully: !!this.authToken,
                storedTokenLength: this.authToken?.length,
                storedTokenPreview: this.authToken && window.DebugUtils.createTokenPreview ? 
                                  window.DebugUtils.createTokenPreview(this.authToken) : null,
                tokensMatch: token === this.authToken,
                
                // Verify storage
                sessionStorageHasToken: typeof sessionStorage !== 'undefined' && 
                                      !!sessionStorage.getItem('reader_auth_token'),
                localStorageHasToken: typeof localStorage !== 'undefined' && 
                                    !!localStorage.getItem('reader_auth_token')
            });
        }
        
        console.log('🔑 Токен аутентификации установлен и сохранен в storage');
    }

    /**
     * 🔗 Получает заголовки для запросов с comprehensive debugging
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        // 📱 HEADERS GENERATION DEBUG
        if (window.DebugUtils?.shouldLog('headers', 'verbose')) {
            window.DebugUtils.log('headers', '📱', 'HEADERS GENERATION DEBUG', {
                hasAuthToken: !!this.authToken,
                authTokenLength: this.authToken?.length,
                generatedHeaders: Object.keys(headers),
                hasAuthorizationHeader: !!headers['Authorization'],
                authHeaderPreview: headers['Authorization'] && window.DebugUtils.createTokenPreview ?
                                 window.DebugUtils.createTokenPreview(headers['Authorization']) : null,
                
                // Token validation
                authTokenFromStorage: {
                    sessionStorage: typeof sessionStorage !== 'undefined' && 
                                  !!sessionStorage.getItem('reader_auth_token'),
                    localStorage: typeof localStorage !== 'undefined' && 
                                !!localStorage.getItem('reader_auth_token')
                },
                
                // Header structure
                contentType: headers['Content-Type'],
                accept: headers['Accept']
            });
        }

        return headers;
    }

    /**
     * 📡 Универсальный метод для API запросов (alias для request)
     * ДОБАВЛЕНО: Alias метод согласно требованиям спецификации
     */
    async makeRequest(endpoint, options = {}) {
        // Извлекаем метод из options или используем GET по умолчанию
        const method = options.method || 'GET';
        const data = options.body ? JSON.parse(options.body) : null;
        
        // Удаляем метод и body из options, чтобы передать остальные параметры
        const { method: _, body: __, ...restOptions } = options;
        
        return this.request(method, endpoint, data, restOptions);
    }

    /**
     * 📡 Универсальный HTTP клиент с обработкой ошибок и comprehensive debugging
     * ДОБАВЛЕНО: Полная JWT chain диагностика согласно требованиям
     */
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = `${method}:${endpoint}:${JSON.stringify(data)}`;
        const requestStartTime = performance.now();

        // 📱 COMPREHENSIVE FRONTEND API DEBUG
        if (window.DebugUtils?.shouldLog('api')) {
            window.DebugUtils.log('api', '📱', 'FRONTEND API DEBUG', {
                method: method || 'GET',
                endpoint: endpoint,
                fullUrl: url,
                
                // Auth token analysis
                hasAuthToken: !!this.authToken,
                authTokenType: this.authToken ? 'JWT' : null,
                authTokenLength: this.authToken?.length,
                authTokenPreview: this.authToken && window.DebugUtils.createTokenPreview ? 
                                window.DebugUtils.createTokenPreview(this.authToken) : null,
                
                // Headers analysis  
                requestHeaders: this.getHeaders(),
                hasAuthorizationHeader: !!this.getHeaders()['Authorization'],
                authHeaderValue: this.getHeaders()['Authorization'] && window.DebugUtils.createTokenPreview ?
                               window.DebugUtils.createTokenPreview(this.getHeaders()['Authorization']) : null,
                
                // Request body
                hasBody: !!data,
                bodyKeys: data ? Object.keys(data) : [],
                bodyPreview: data ? JSON.stringify(data).substring(0, 100) + '...' : null,
                
                // Browser context
                userAgent: navigator.userAgent.substring(0, 100),
                isTelegramWebApp: !!window.Telegram?.WebApp,
                telegramVersion: window.Telegram?.WebApp?.version,
                
                // Request options
                requestOptions: Object.keys(options),
                cacheKey: cacheKey,
                attempt: 1
            });
        }

        // 💾 Проверяем кэш для GET запросов
        if (method === 'GET' && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                if (window.DebugUtils?.shouldLog('api')) {
                    window.DebugUtils.log('api', '📦', 'Cache hit', { 
                        endpoint,
                        cacheAge: Date.now() - cached.timestamp
                    });
                }
                console.log('📦 Возвращаем из кэша', { endpoint });
                return cached.data;
            }
        }

        // 🔄 Retry логика
        let lastError;
        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                if (window.DebugUtils?.shouldLog('api', 'verbose') && attempt > 1) {
                    window.DebugUtils.log('api', '🔄', 'Retry attempt', {
                        attempt,
                        maxRetries: this.config.retries,
                        endpoint,
                        previousError: lastError?.message
                    });
                }

                console.log(`📤 ${method} ${endpoint}`, { data, attempt });

                // 🌐 Формируем запрос
                const requestOptions = {
                    method,
                    headers: this.getHeaders(),
                    ...options
                };

                if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                    requestOptions.body = JSON.stringify(data);
                }

                // ⏱️ Добавляем timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                requestOptions.signal = controller.signal;

                // 🚀 Выполняем запрос
                const response = await fetch(url, requestOptions);
                clearTimeout(timeoutId);

                // 📱 FRONTEND RESPONSE DEBUG
                if (window.DebugUtils?.shouldLog('api')) {
                    const requestEndTime = performance.now();
                    window.DebugUtils.log('api', '📱', 'FRONTEND RESPONSE DEBUG', {
                        endpoint: endpoint,
                        status: response.status,
                        statusText: response.statusText,
                        ok: response.ok,
                        responseHeaders: Object.fromEntries(response.headers.entries()),
                        
                        // Auth specific
                        isAuthError: response.status === 401,
                        isServerError: response.status >= 500,
                        
                        // Performance
                        requestDuration: Math.round(requestEndTime - requestStartTime),
                        attempt: attempt,
                        
                        // Network status
                        networkOnline: navigator.onLine
                    });
                }

                // ✅ Обрабатываем ответ
                const result = await this.handleResponse(response, endpoint);

                // 💾 Кэшируем GET запросы
                if (method === 'GET') {
                    this.cache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                }

                if (window.DebugUtils?.shouldLog('api', 'verbose')) {
                    window.DebugUtils.log('api', '✅', 'Request successful', {
                        endpoint,
                        resultKeys: result ? Object.keys(result) : [],
                        cached: method === 'GET'
                    });
                }

                console.log(`📥 ${method} ${endpoint} успешно`, { result });
                return result;

            } catch (error) {
                lastError = error;
                
                // 📱 FRONTEND ERROR DEBUG
                if (window.DebugUtils?.shouldLog('api')) {
                    window.DebugUtils.log('api', '📱', 'FRONTEND ERROR DEBUG', {
                        endpoint: endpoint,
                        status: error.status || 'network_error',
                        errorMessage: error.message?.substring(0, 200),
                        errorType: error.constructor.name,
                        hasAuthToken: !!this.authToken,
                        sentAuthHeader: !!this.getHeaders()['Authorization'],
                        attempt: attempt,
                        maxRetries: this.config.retries,
                        willRetry: attempt < this.config.retries
                    });
                }

                console.log(`❌ ${method} ${endpoint} ошибка`, { error: error.message, attempt });

                // 🔄 Ждем перед повторной попыткой
                if (attempt < this.config.retries) {
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }

        // 📱 FRONTEND NETWORK ERROR (final)
        if (window.DebugUtils?.shouldLog('api')) {
            window.DebugUtils.log('api', '📱', 'FRONTEND NETWORK ERROR', {
                endpoint: endpoint,
                errorMessage: lastError?.message,
                errorType: lastError?.constructor.name,
                hasAuthToken: !!this.authToken,
                networkStatus: navigator.onLine ? 'online' : 'offline',
                allRetriesExhausted: true,
                totalAttempts: this.config.retries
            });
        }

        // 💥 Выбрасываем последнюю ошибку после всех попыток
        throw lastError;
    }

    /**
     * 📨 Обрабатывает HTTP ответ
     */
    async handleResponse(response, endpoint) {
        const contentType = response.headers.get('content-type');

        // 📄 Получаем содержимое ответа
        let responseData;
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // ✅ Успешный ответ
        if (response.ok) {
            return responseData;
        }

        // ❌ Ошибка от сервера
        const error = new Error(responseData.message || `HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.endpoint = endpoint;
        error.data = responseData;

        throw error;
    }

    /**
     * ⏱️ Вспомогательная функция задержки
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===========================================
    // 🔐 АУТЕНТИФИКАЦИЯ
    // ===========================================

    /**
     * 🔑 Аутентификация через Telegram с comprehensive debugging
     */
    async authenticateWithTelegram(telegramData, user) {
        try {
            // 📱 TELEGRAM AUTH START DEBUG
            if (window.DebugUtils?.shouldLog('auth')) {
                window.DebugUtils.log('auth', '📱', 'TELEGRAM AUTH START DEBUG', {
                    hasInitData: !!telegramData,
                    initDataLength: telegramData?.length,
                    initDataPreview: telegramData ? `${telegramData.substring(0, 100)}...` : null,
                    
                    // User data analysis
                    userId: user?.id,
                    userFirstName: user?.first_name,
                    userUsername: user?.username,
                    userKeys: user ? Object.keys(user) : [],
                    
                    // Current auth state
                    currentlyHasToken: !!this.authToken,
                    currentTokenPreview: this.authToken && window.DebugUtils.createTokenPreview ?
                                       window.DebugUtils.createTokenPreview(this.authToken) : null
                });
            }

            console.log('🔐 Отправляем данные на /auth/telegram:', {
                hasInitData: !!telegramData,
                userId: user?.id,
                userFirstName: user?.first_name
            });

            const response = await this.request('POST', '/auth/telegram', {
                telegramData,
                user
            });

            // 📱 AUTH RESULT DEBUG
            if (window.DebugUtils?.shouldLog('auth')) {
                window.DebugUtils.log('auth', '📱', 'AUTH RESULT DEBUG', {
                    authSuccess: !!response.success,
                    tokenReceived: !!response.token,
                    tokenLength: response.token?.length,
                    tokenPreview: response.token && window.DebugUtils.createTokenPreview ? 
                                window.DebugUtils.createTokenPreview(response.token) : null,
                    userId: response.userId,
                    isOnboardingCompleted: response.isOnboardingCompleted,
                    responseKeys: response ? Object.keys(response) : [],
                    userDataKeys: response.user ? Object.keys(response.user) : []
                });
            }

            if (response.token) {
                this.setAuthToken(response.token);
                
                // 📱 TOKEN VERIFICATION DEBUG  
                if (window.DebugUtils?.shouldLog('auth')) {
                    window.DebugUtils.log('auth', '📱', 'TOKEN VERIFICATION DEBUG', {
                        tokenSetInApi: !!this.authToken,
                        apiTokenLength: this.authToken?.length,
                        apiTokenPreview: this.authToken && window.DebugUtils.createTokenPreview ? 
                                       window.DebugUtils.createTokenPreview(this.authToken) : null,
                        tokensMatch: response.token === this.authToken,
                        
                        // Storage verification
                        tokenInSessionStorage: typeof sessionStorage !== 'undefined' && 
                                             !!sessionStorage.getItem('reader_auth_token'),
                        tokenInLocalStorage: typeof localStorage !== 'undefined' && 
                                           !!localStorage.getItem('reader_auth_token')
                    });
                }
                
                console.log('✅ Токен аутентификации сохранен');
            }

            return response;
        } catch (error) {
            // 📱 AUTH ERROR DEBUG
            if (window.DebugUtils?.shouldLog('auth')) {
                window.DebugUtils.log('auth', '📱', 'AUTH ERROR DEBUG', {
                    errorMessage: error.message,
                    errorType: error.constructor.name,
                    errorStatus: error.status,
                    stackTrace: error.stack?.substring(0, 300),
                    
                    // Request context
                    hadInitData: !!telegramData,
                    hadUserData: !!user,
                    
                    // Network context
                    networkOnline: navigator.onLine,
                    currentUrl: window.location.href
                });
            }
            
            console.log('❌ Ошибка аутентификации', { error: error.message });
            
            // ИСПРАВЛЕНО: Более детальная информация об ошибке
            if (error.status === 401) {
                throw new Error('Ошибка аутентификации: недействительные данные Telegram');
            } else if (error.status === 500) {
                throw new Error('Ошибка сервера: не удалось обработать аутентификацию');
            } else {
                throw new Error(`Не удалось аутентифицироваться: ${error.message}`);
            }
        }
    }

    /**
     * 🔄 Обновление токена
     */
    async refreshToken() {
        try {
            const response = await this.request('POST', '/auth/refresh');
            if (response.token) {
                this.setAuthToken(response.token);
            }
            return response;
        } catch (error) {
            console.log('❌ Ошибка обновления токена', { error: error.message });
            throw error;
        }
    }

    /**
     * 📊 Проверка статуса онбординга - ИСПРАВЛЕНО: Только реальный API
     */
    async checkOnboardingStatus() {
        try {
            return await this.request('GET', '/auth/onboarding-status');
        } catch (error) {
            console.log('❌ Ошибка проверки статуса онбординга', { error: error.message });
            // Fallback: считаем что онбординг не пройден
            return { completed: false };
        }
    }

    /**
     * ✅ Завершение онбординга - ИСПРАВЛЕНО: Только реальный API
     */
    async completeOnboarding(onboardingData) {
        try {
            return await this.request('POST', '/auth/complete-onboarding', onboardingData);
        } catch (error) {
            console.log('❌ Ошибка завершения онбординга', { error: error.message });
            throw new Error('Не удалось сохранить данные онбординга');
        }
    }

    // ===========================================
    // 👤 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
    // ===========================================

    /**
     * 📋 Получить профиль пользователя
     */
    async getProfile() {
        return this.request('GET', '/profile');
    }

    /**
     * ✏️ Обновить профиль пользователя
     */
    async updateProfile(profileData) {
        return this.request('PUT', '/profile', profileData);
    }

    /**
     * 📊 Получить статистику пользователя - ИСПРАВЛЕНО: С защитой от undefined
     */
    async getStats() {
        try {
            const result = await this.request('GET', '/stats');
            
            // ИСПРАВЛЕНО: Защита от undefined значений в ответе API
            const safeStats = {
                totalQuotes: result?.stats?.totalQuotes || 0,
                currentStreak: result?.stats?.currentStreak || 0,
                longestStreak: result?.stats?.longestStreak || 0,
                favoriteAuthors: result?.stats?.favoriteAuthors || [],
                monthlyQuotes: result?.stats?.monthlyQuotes || 0,
                todayQuotes: result?.stats?.todayQuotes || 0,
                daysSinceRegistration: result?.stats?.daysSinceRegistration || 0,
                weeksSinceRegistration: result?.stats?.weeksSinceRegistration || 0
            };
            
            return { ...result, stats: safeStats };
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки статистики, возвращаем безопасные defaults:', error);
            
            // ИСПРАВЛЕНО: Возвращаем безопасные default значения при ошибке
            return {
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
                warning: 'Статистика временно недоступна'
            };
        }
    }

    /**
     * 🏆 Получить достижения пользователя
     */
    async getAchievements() {
        return this.request('GET', '/achievements');
    }

    // ===========================================
    // 📝 УПРАВЛЕНИЕ ЦИТАТАМИ
    // ===========================================

    /**
     * ➕ Добавить новую цитату - ИСПРАВЛЕНО: Только реальный API
     */
    async addQuote(quoteData) {
        this.clearQuotesCache();
        return this.request('POST', '/quotes', quoteData);
    }

    /**
     * 📖 Получить цитаты пользователя - ИСПРАВЛЕНО: Только реальный API
     */
    async getQuotes(options = {}) {
        const params = new URLSearchParams();
        
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);
        if (options.author) params.append('author', options.author);
        if (options.search) params.append('search', options.search);
        if (options.dateFrom) params.append('dateFrom', options.dateFrom);
        if (options.dateTo) params.append('dateTo', options.dateTo);

        const queryString = params.toString();
        const endpoint = queryString ? `/quotes?${queryString}` : '/quotes';
        
        return this.request('GET', endpoint);
    }

    /**
     * 🤖 Анализ цитаты через AI
     */
    async analyzeQuote(text, author = null) {
        return this.request('POST', '/quotes/analyze', {
            text: text,
            author: author
        });
    }

    /**
     * 🤖 Повторный анализ существующей цитаты
     */
    async reanalyzeQuote(quoteId) {
        return this.request('POST', `/quotes/${quoteId}/reanalyze`);
    }
    
    /**
     * 🕐 Получить последние цитаты
     */
    async getRecentQuotes(limit = 10) {
        return this.request('GET', `/quotes/recent?limit=${limit}`);
    }

    /**
     * ✏️ Обновить цитату
     */
    async updateQuote(quoteId, updateData) {
        this.clearQuotesCache();
        return this.request('PUT', `/quotes/${quoteId}`, updateData);
    }

    /**
     * 🗑️ Удалить цитату
     */
    async deleteQuote(quoteId) {
        this.clearQuotesCache();
        return this.request('DELETE', `/quotes/${quoteId}`);
    }

    /**
     * 🔍 Поиск цитат - ИСПРАВЛЕНО: Только реальный API
     */
    async searchQuotes(query, options = {}) {
        const params = new URLSearchParams({ q: query });
        
        if (options.limit) params.append('limit', options.limit);
        if (options.author) params.append('author', options.author);

        return this.request('GET', `/quotes/search?${params.toString()}`);
    }

    // ===========================================
    // 📊 ОТЧЕТЫ
    // ===========================================

    /**
     * 📅 Получить еженедельные отчеты
     */
    async getWeeklyReports(options = {}) {
        const params = new URLSearchParams();
        
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const queryString = params.toString();
        const endpoint = queryString ? `/reports/weekly?${queryString}` : '/reports/weekly';
        
        return this.request('GET', endpoint);
    }

    /**
     * 📈 Получить конкретный еженедельный отчет
     */
    async getWeeklyReport(reportId) {
        return this.request('GET', `/reports/weekly/${reportId}`);
    }

    /**
     * 📅 Получить месячные отчеты
     */
    async getMonthlyReports(options = {}) {
        const params = new URLSearchParams();
        
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const queryString = params.toString();
        const endpoint = queryString ? `/reports/monthly?${queryString}` : '/reports/monthly';
        
        return this.request('GET', endpoint);
    }

    /**
     * 📊 Получить конкретный месячный отчет
     */
    async getMonthlyReport(reportId) {
        return this.request('GET', `/reports/monthly/${reportId}`);
    }

    /**
     * 🔄 Запросить генерацию нового отчета
     */
    async generateReport(type = 'weekly') {
        return this.request('POST', `/reports/${type}/generate`);
    }

    // ===========================================
    // 🆕 НОВАЯ СЕКЦИЯ: АЛИАСЫ ДЛЯ СОВМЕСТИМОСТИ
    // ===========================================

    /**
     * 📊 Универсальный метод получения отчета (алиас)
     * НОВЫЙ: Для совместимости с ReportsPage.js
     */
    async getReport(type = 'weekly', reportId = 'current') {
        if (reportId === 'current') {
            // Возвращаем текущий отчет (последний)
            const reports = await this.getReports(type, { limit: 1 });
            return reports && reports.length > 0 ? reports[0] : null;
        } else {
            // Возвращаем конкретный отчет
            return type === 'weekly' ? 
                this.getWeeklyReport(reportId) : 
                this.getMonthlyReport(reportId);
        }
    }

    /**
     * 📅 Универсальный метод получения списка отчетов (алиас)
     * НОВЫЙ: Для совместимости с ReportsPage.js
     */
    async getReports(type = 'weekly', options = {}) {
        return type === 'weekly' ? 
            this.getWeeklyReports(options) : 
            this.getMonthlyReports(options);
    }

    /**
     * 📊 Получить отчет по ID (универсальный)
     * НОВЫЙ: Для совместимости с ReportsPage.js
     */
    async getReportById(reportId) {
        // Пытаемся найти в еженедельных, потом в месячных
        try {
            return await this.getWeeklyReport(reportId);
        } catch (error) {
            return await this.getMonthlyReport(reportId);
        }
    }

    // ===========================================
    // 📚 КАТАЛОГ КНИГ
    // ===========================================

    /**
     * 📖 Получить каталог книг
     * ИСПРАВЛЕНО: Добавлен alias getCatalog для совместимости с CatalogPage
     */
    async getBookCatalog(options = {}) {
        const params = new URLSearchParams();
        
        if (options.category) params.append('category', options.category);
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const queryString = params.toString();
        const endpoint = queryString ? `/catalog?${queryString}` : '/catalog';
        
        return this.request('GET', endpoint);
    }

    /**
     * 📖 Alias для getCatalog (для CatalogPage.js)
     * ИСПРАВЛЕНО: Добавлен недостающий метод
     */
    async getCatalog(options = {}) {
        return this.getBookCatalog(options);
    }

    /**
     * 📑 Получить категории книг
     */
    async getCategories() {
        return this.request('GET', '/categories');
    }

    /**
     * 🎯 Получить персональные рекомендации
     */
    async getRecommendations() {
        return this.request('GET', '/recommendations');
    }

    /**
     * 🏷️ Получить промокоды
     */
    async getPromoCodes() {
        return this.request('GET', '/promo-codes');
    }

    /**
     * 📚 Получить детали книги
     * НОВЫЙ: Добавлен метод для детальной информации о книге
     */
    async getBookDetails(bookId) {
        return this.request('GET', `/catalog/${bookId}`);
    }

    // ===========================================
    // 👥 СООБЩЕСТВО (MVP)
    // ===========================================

    /**
     * 🗨️ Получить сообщения сообщества
     */
    async getCommunityMessages(options = {}) {
        const params = new URLSearchParams();
        
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const queryString = params.toString();
        const endpoint = queryString ? `/community?${queryString}` : '/community';
        
        return this.request('GET', endpoint);
    }

    /**
     * 💬 Отправить сообщение в сообщество
     */
    async postCommunityMessage(messageData) {
        return this.request('POST', '/community', messageData);
    }

    /**
     * 📊 Получить статистику сообщества
     * НОВЫЙ: Добавлен недостающий метод для CommunityPage
     */
    async getCommunityStats() {
        return this.request('GET', '/community/stats');
    }

    /**
     * 🏆 Получить таблицу лидеров
     * НОВЫЙ: Добавлен недостающий метод для CommunityPage
     */
    async getLeaderboard(options = {}) {
        const params = new URLSearchParams();
        if (options.type) params.append('type', options.type);
        if (options.limit) params.append('limit', options.limit);

        const queryString = params.toString();
        const endpoint = queryString ? `/community/leaderboard?${queryString}` : '/community/leaderboard';
        
        return this.request('GET', endpoint);
    }

    /**
     * 🔥 Получить популярные цитаты
     * НОВЫЙ: Добавлен недостающий метод для CommunityPage
     */
    async getPopularQuotes(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.period) params.append('period', options.period);

        const queryString = params.toString();
        const endpoint = queryString ? `/community/popular?${queryString}` : '/community/popular';
        
        return this.request('GET', endpoint);
    }

    /**
     * 📚 Получить популярные книги сообщества
     * НОВЫЙ: Добавлен недостающий метод для CommunityPage
     */
    async getPopularBooks(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.period) params.append('period', options.period);

        const queryString = params.toString();
        const endpoint = queryString ? `/community/popular-books?${queryString}` : '/community/popular-books';
        
        return this.request('GET', endpoint);
    }

    // ===========================================
    // 🛠️ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ===========================================

    /**
     * 🗑️ Очистка кэша цитат
     */
    clearQuotesCache() {
        for (const key of this.cache.keys()) {
            if (key.includes('/quotes')) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * 🧹 Полная очистка кэша
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 Кэш полностью очищен');
    }

    /**
     * 📊 Статистика кэша
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * 🏥 Проверка состояния API
     */
    async healthCheck() {
        try {
            const response = await this.request('GET', '/health');
            console.log('✅ API здоров', { response });
            return response;
        } catch (error) {
            console.log('❌ API недоступен', { error: error.message });
            throw error;
        }
    }

    // ===========================================
    // 📡 POST методы для других операций 
    // ===========================================

    /**
     * 📝 POST запрос (алиас для request)
     */
    async post(endpoint, data) {
        return this.request('POST', endpoint, data);
    }

    /**
     * 📖 GET запрос (алиас для request)
     */
    async get(endpoint) {
        return this.request('GET', endpoint);
    }

    /**
     * ✏️ PUT запрос (алиас для request)
     */
    async put(endpoint, data) {
        return this.request('PUT', endpoint, data);
    }

    /**
     * 🗑️ DELETE запрос (алиас для request)
     */
    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }
}

// 🌍 Глобальный экспорт
window.ApiService = ApiService;

// 📱 Экспорт для модульной системы
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}
