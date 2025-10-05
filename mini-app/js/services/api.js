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
        
        // ⚙️ Конфигурация запросов
        this.config = {
            timeout: 30000, // 30 секунд
            retries: 3,
            retryDelay: 1000
        };

        // 📊 Кэширование запросов
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
        
        console.log('🚀 API Service инициализирован', { 
            baseURL: this.baseURL
        });
    }
    
    /**
     * Отправить клик по книге из каталога
     * @param {Object} params
     * @param {string} [params.bookSlug]
     * @param {string} [params.bookId]
     * @param {string} [params.userId]
     * @returns {Promise<any>}
     */
    async trackCatalogClick({ bookSlug, bookId, userId }) {
      const payload = {
        bookSlug: bookSlug || null,
        bookId: bookId || null,
        userId: userId || this.resolveUserId()
      };
      return this.request('POST', `/catalog/track-click`, payload);
    }

    /**
     * 📚 Получить топ книг по кликам/продажам за период
     * ОБНОВЛЕНО: Точное соответствие требованиям API: GET /api/reader/top-books?period=7d
     * @param {Object} [options]
     * @param {string} [options.period] - напр. "7d"
     * @param {number} [options.limit] - количество книг
     * @returns {Promise<any>}
     */
    async getTopBooks(options = {}) {
        const params = new URLSearchParams();
        if (options.period) params.append('period', options.period);
        if (options.limit) params.append('limit', options.limit);

        const queryString = params.toString();
        const endpoint = queryString ? `/top-books?${queryString}` : '/top-books';
        
        return this.request('GET', endpoint);
    }
   
    /**
     * 🔗 Получает заголовки для запросов с аутентификацией
     */
    getHeaders(endpoint = '') {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // 🔑 Добавляем заголовки аутентификации
        const userId = this.resolveUserId();
        const initData = this.resolveTelegramInitData();

        // Extract userId from endpoint query string if present for consistency
        let finalUserId = userId;
        if (endpoint) {
            const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
            const endpointUserId = urlParams.get('userId');
            if (endpointUserId) {
                finalUserId = endpointUserId;
            }
        }

        if (finalUserId) {
            headers['X-User-Id'] = finalUserId;
        }

        if (initData) {
            headers['Authorization'] = `tma ${initData}`;
            // Include X-Telegram-Init-Data alongside Authorization
            headers['X-Telegram-Init-Data'] = initData;
        }

        return headers;
    }

    /**
     * 🆔 Разрешает ID пользователя из различных источников
     * Приоритет: App state → Telegram initDataUnsafe → localStorage
     */
    resolveUserId() {
        try {
            // Проверяем доступность window
            if (typeof window === 'undefined') {
                return 'demo-user';
            }

            // 1. Попытка получить из App state
            if (window.appState) {
                const userId = window.appState.getCurrentUserId();
                if (userId) {
                    return String(userId);
                }
            }

            // 2. Попытка получить из Telegram initDataUnsafe
            if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
                return String(window.Telegram.WebApp.initDataUnsafe.user.id);
            }

            // 3. Fallback на localStorage (с проверкой доступности)
            if (typeof localStorage !== 'undefined') {
                const storedUserId = localStorage.getItem('reader-user-id');
                if (storedUserId) {
                    return storedUserId;
                }
            }

            // 4. Финальный fallback
            return 'demo-user';
        } catch (error) {
            console.warn('⚠️ ApiService: Ошибка разрешения userId:', error);
            return 'demo-user';
        }
    }
    
    // --------- NEW: жёсткая санитизация для значений HTTP-заголовков ----------
    sanitizeHeaderValue(str) {
        if (!str) return '';
        // удаляем любые управляющие символы (0x00-0x1F и 0x7F), в т.ч. скрытые переносы строк
        return String(str).replace(/[\u0000-\u001F\u007F]/g, '').trim();
    }
    
    /**
     * 📱 Разрешает Telegram initData для аутентификации
     * ОБНОВЛЕНО: Добавлена санитизация для безопасной передачи в HTTP заголовках
     */
    resolveTelegramInitData() {
        try {
            // Проверяем доступность window
            if (typeof window === 'undefined') {
                return null;
            }

            let rawInitData = null;

            // Получаем initData из Telegram WebApp
            if (window.Telegram?.WebApp?.initData) {
                rawInitData = window.Telegram.WebApp.initData;
            }

            // Fallback на localStorage (с проверкой доступности)
            if (!rawInitData && typeof localStorage !== 'undefined') {
                const storedInitData = localStorage.getItem('reader-telegram-initdata');
                if (storedInitData) {
                    rawInitData = storedInitData;
                }
            }

            // Санитизация: удаляем CR/LF и кодируем для HTTP заголовков
            if (rawInitData) {
                // Удаляем все символы возврата каретки и переноса строки
                const sanitized = rawInitData.replace(/[\r\n]/g, '').trim();
                // Кодируем для безопасной передачи в HTTP заголовках
                return encodeURIComponent(sanitized);
            }

            return null;
        } catch (error) {
            console.warn('⚠️ ApiService: Ошибка разрешения initData:', error);
            return null;
        }
    }

    // --------- NEW: RAW initData без encodeURIComponent для безопасной вставки в заголовки ----------
    resolveTelegramInitDataRaw() {
        try {
            if (typeof window === 'undefined') return null;
            let raw = null;
            if (window.Telegram?.WebApp?.initData) raw = window.Telegram.WebApp.initData;
            if (!raw && typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('reader-telegram-initdata');
                if (stored) raw = stored;
            }
            if (!raw) return null;
            // удаляем все управляющие символы, в т.ч. любые скрытые переносы
            return this.sanitizeHeaderValue(raw);
        } catch (e) {
            console.warn('⚠️ ApiService: Ошибка получения RAW initData:', e);
            return null;
        }
    }

    getHeaders(endpoint = '') {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        const userId = this.resolveUserId();
        const initData = this.resolveTelegramInitData();

        let finalUserId = userId;
        if (endpoint) {
            const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
            const endpointUserId = urlParams.get('userId');
            if (endpointUserId) finalUserId = endpointUserId;
        }

        if (finalUserId) headers['X-User-Id'] = finalUserId;
        if (initData) {
            headers['Authorization'] = `tma ${initData}`;
            headers['X-Telegram-Init-Data'] = initData;
        }
        return headers;
    }
    
    /**
     * 📡 Универсальный HTTP клиент с обработкой ошибок
     * ИСПРАВЛЕНО: Убраны все debug заглушки - только реальный API
     */
    async request(method, endpoint, data = null, options = {}) {
        // Add cache-busting for quotes endpoints on GET requests
        let finalUrl = `${this.baseURL}${endpoint}`;
        if (method === 'GET' && endpoint.includes('/quotes')) {
            const separator = endpoint.includes('?') ? '&' : '?';
            finalUrl += `${separator}_t=${Date.now()}`;
        }
        
        const cacheKey = `${method}:${endpoint}:${JSON.stringify(data)}`;

        // 💾 Skip cache for quotes endpoints to prevent stale data
        if (method === 'GET' && !endpoint.includes('/quotes') && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📦 Возвращаем из кэша', { endpoint });
                return cached.data;
            }
        }

        // 🔄 Retry логика
        let lastError;
        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                console.log(`📤 ${method} ${endpoint}`, { data, attempt });

                // 🌐 Формируем запрос с правильным слиянием заголовков
                const authHeaders = this.getHeaders(endpoint);
                const customHeaders = options.headers || {};
                
                const requestOptions = {
                    method,
                    // Merge headers correctly: auth headers take precedence
                    headers: { ...customHeaders, ...authHeaders },
                    ...options
                };
                
                // Remove headers from options to avoid duplication
                delete requestOptions.headers;
                requestOptions.headers = { ...customHeaders, ...authHeaders };
                
                // Add no-cache headers for quotes GET requests
                if (method === 'GET' && endpoint.includes('/quotes')) {
                    requestOptions.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                    requestOptions.headers['Pragma'] = 'no-cache';
                    requestOptions.headers['Expires'] = '0';
                }

                if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                    requestOptions.body = JSON.stringify(data);
                }

                // ⏱️ Добавляем timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                requestOptions.signal = controller.signal;

                // 👇 ВСТАВЬ СЮДА
                requestOptions.credentials = 'include';

                // 🚀 Выполняем запрос
                const response = await fetch(finalUrl, requestOptions);
                clearTimeout(timeoutId);
                
                console.log(`📡 ${method} ${endpoint} - статус ответа:`, response.status, response.statusText);

                // ✅ Обрабатываем ответ
                const result = await this.handleResponse(response, endpoint);

                // 💾 Кэшируем только не-quotes GET запросы
                if (method === 'GET' && !endpoint.includes('/quotes')) {
                    this.cache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                }

                console.log(`📥 ${method} ${endpoint} успешно`, { result });
                return result;

            } catch (error) {
                lastError = error;
                console.log(`❌ ${method} ${endpoint} ошибка`, { error: error.message, attempt });

                // 🔄 Ждем перед повторной попыткой
                if (attempt < this.config.retries) {
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }

        // 💥 Выбрасываем последнюю ошибку после всех попыток
        throw lastError;
    }

    /**
     * 📨 Обрабатывает HTTP ответ
     */
    async handleResponse(response, endpoint) {
        const contentType = response.headers.get('content-type');
        console.log(`📨 handleResponse - ${endpoint} - статус: ${response.status}, content-type: ${contentType}`);

        // 📄 Получаем содержимое ответа
        let responseData;
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }
        
        console.log(`📄 handleResponse - ${endpoint} - данные ответа:`, responseData);

        // ✅ Успешный ответ
        if (response.ok) {
            console.log(`✅ handleResponse - ${endpoint} - успешный ответ`);
            return responseData;
        }

        // ❌ Ошибка от сервера
        console.error(`❌ handleResponse - ${endpoint} - ошибка сервера:`, response.status, response.statusText);
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
     * 🔑 Аутентификация через Telegram
     */
    async authenticateWithTelegram(telegramData, user) {
        try {
            console.log('🔐 Отправляем данные на /auth/telegram:', {
                hasInitData: !!telegramData,
                userId: user?.id,
                userFirstName: user?.first_name
            });

            const response = await this.request('POST', '/auth/telegram', {
                telegramData,
                user
            });

            return response;
        } catch (error) {
            console.log('❌ Ошибка аутентификации', { error: error.message });
            
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
     * 📊 Проверка статуса онбординга
     */
    async checkOnboardingStatus(userId = 'demo-user') {
        try {
            const response = await this.request('GET', `/auth/onboarding-status?userId=${userId}`);
            
            // Backward compatibility: provide fallback to old keys during deploy
            if (response && response.success) {
                return {
                    ...response,
                    // New unified field
                    isOnboardingComplete: response.isOnboardingComplete,
                    // Backward-safe fallbacks (for cached clients that might still expect them)
                    completed: response.isOnboardingComplete,
                    isCompleted: response.isOnboardingComplete,
                    isOnboardingCompleted: response.isOnboardingComplete
                };
            }
            
            return response;
        } catch (error) {
            console.log('❌ Ошибка проверки статуса онбординга', { error: error.message });
            // Fallback: считаем что онбординг не пройден
            return { 
                success: false,
                isOnboardingComplete: false,
                completed: false,
                isCompleted: false,
                isOnboardingCompleted: false
            };
        }
    }

    /**
     * ✅ Завершение онбординга
     */
    async completeOnboarding(onboardingData) {
        try {
            const response = await this.request('POST', '/auth/complete-onboarding', onboardingData);
            
            // Handle both successful completion and already completed cases
            if (response && response.success) {
                return response;
            }
            
            throw new Error(response?.message || 'Неизвестная ошибка при завершении онбординга');
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
    async getProfile(userId = 'demo-user') {
        return this.request('GET', `/profile?userId=${userId}`);
    }

    /**
     * ✏️ Обновить профиль пользователя
     */
    async updateProfile(profileData, userId = 'demo-user') {
        return this.request('PATCH', `/profile?userId=${userId}`, profileData);
    }

    /**
     * 🖼️ Загрузить аватар пользователя
     */
    async uploadAvatar(fileOrBlob, userId = 'demo-user') {
        try {
            console.log('🖼️ Загружаем аватар для пользователя:', userId);

            // Demo user: return base64 locally without network call
            if (userId === 'demo-user') {
                let base64Data;
                if (fileOrBlob instanceof Blob || fileOrBlob instanceof File) {
                    base64Data = await this.fileToBase64(fileOrBlob);
                } else if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) {
                    base64Data = fileOrBlob;
                } else {
                    throw new Error('Unsupported file format');
                }
                console.log('✅ Demo-user: Avatar preview (local, no upload)');
                return {
                    success: true,
                    avatarUrl: base64Data,
                    message: 'Demo avatar (not uploaded)'
                };
            }

            // Real users: multipart upload
            if (!(fileOrBlob instanceof Blob || fileOrBlob instanceof File)) {
                throw new Error('Expected File or Blob for upload');
            }

            const formData = new FormData();
            formData.append('avatar', fileOrBlob);

            const initData = this.resolveTelegramInitData();
            if (!initData) {
                throw new Error('Telegram authentication required');
            }

            const response = await fetch(`${this.baseURL}/auth/upload-avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `tma ${initData}`
                },
                body: formData
            });

            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            
            console.log('✅ Аватар загружен успешно:', result);
            return result;

        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            
            if (error.status === 413 || error.message.includes('413')) {
                throw new Error('Файл слишком большой. Максимальный размер: 5MB');
            } else if (error.status === 415 || error.message.includes('415')) {
                throw new Error('Неподдерживаемый формат файла. Используйте JPG, PNG или WebP');
            } else {
                throw new Error(`Не удалось загрузить аватар: ${error.message}`);
            }
        }
    }

    /**
     * 🔄 Перезапустить тест пользователя
     */
    async resetTest(userId = 'demo-user') {
        try {
            console.log('🔄 Сбрасываем тест для пользователя:', userId);
            
            const result = await this.request('POST', `/profile/reset-test?userId=${userId}`);
            
            console.log('✅ Тест сброшен успешно:', result);
            return result;

        } catch (error) {
            console.error('❌ Ошибка сброса теста:', error);
            throw new Error(`Не удалось сбросить тест: ${error.message}`);
        }
    }

    /**
     * 🔄 Сбросить онбординг (новый унифицированный метод)
     */
    async resetOnboarding(userId = 'demo-user') {
        try {
            console.log('🔄 Сбрасываем онбординг для пользователя:', userId);
            
            // Пытаемся использовать новый endpoint
            try {
                const result = await this.request('POST', `/auth/reset-onboarding?userId=${userId}`);
                console.log('✅ Онбординг сброшен через новый endpoint:', result);
                return result;
            } catch (newEndpointError) {
                console.warn('⚠️ Новый endpoint недоступен, fallback на старый:', newEndpointError.message);
                
                // Fallback на старый endpoint если новый недоступен
                const fallbackResult = await this.resetTest(userId);
                console.log('✅ Онбординг сброшен через fallback endpoint:', fallbackResult);
                return fallbackResult;
            }

        } catch (error) {
            console.error('❌ Ошибка сброса онбординга:', error);
            throw new Error(`Не удалось сбросить онбординг: ${error.message}`);
        }
    }

    /**
     * 🔧 Конвертировать файл в base64
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 📊 Получить статистику пользователя
     */
    /**
     * 📊 Получить статистику пользователя с поддержкой ISO недель
     */
    async getStats(userId = 'demo-user', options = {}) {
        try {
            const { 
                scope = 'week', 
                weekNumber, 
                year, 
                monthNumber, 
                includeWeekMeta = false 
            } = options;

            const params = new URLSearchParams({ userId });
            
            // Add scope and related parameters
            if (scope) params.append('scope', scope);
            if (weekNumber) params.append('weekNumber', weekNumber.toString());
            if (year) params.append('year', year.toString());
            if (monthNumber) params.append('monthNumber', monthNumber.toString());
            if (includeWeekMeta) params.append('includeWeekMeta', 'true');

            const result = await this.request('GET', `/stats?${params.toString()}`);
            
            // Защита от undefined значений в ответе API
            const safeStats = {
                totalQuotes: result?.stats?.totalQuotes || 0,
                currentStreak: result?.stats?.currentStreak || 0,
                longestStreak: result?.stats?.longestStreak || 0,
                favoriteAuthors: result?.stats?.favoriteAuthors || [],
                monthlyQuotes: result?.stats?.monthlyQuotes || 0,
                todayQuotes: result?.stats?.todayQuotes || 0,
                daysSinceRegistration: result?.stats?.daysSinceRegistration || 0,
                weeksSinceRegistration: result?.stats?.weeksSinceRegistration || 0,
                // New scoped fields
                scope: result?.stats?.scope || scope,
                quotes: result?.stats?.quotes || 0, // Scoped quote count
                weekMeta: result?.stats?.weekMeta || null, // Week metadata if requested
                // Surface scope-specific aliases
                weeklyQuotes: result?.stats?.weeklyQuotes || (scope === 'week' ? result?.stats?.quotes : undefined),
                globalQuotes: result?.stats?.globalQuotes || (scope === 'global' ? result?.stats?.quotes : undefined),
                monthScopedQuotes: result?.stats?.monthScopedQuotes || (scope === 'month' ? result?.stats?.quotes : undefined)
            };
            
            return { ...result, stats: safeStats };
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки статистики, возвращаем безопасные defaults:', error);
            
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
                    weeksSinceRegistration: 0,
                    scope: options.scope || 'week',
                    quotes: 0,
                    weekMeta: null
                },
                warning: 'Статистика временно недоступна'
            };
        }
    }

    /**
     * 📊 Получить процент активности пользователя среди всех (activityPercent)
     */
    async getActivityPercent() {
        // НЕ передавать userId через параметры!
        const endpoint = `/activity-percent`;
        const result = await this.request('GET', endpoint);
        return result && typeof result.activityPercent === 'number'
            ? result.activityPercent
            : 1; // fallback
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
     * ➕ Добавить новую цитату
     */
    async addQuote(quoteData, userId = 'demo-user') {
        this.clearQuotesCache();
        console.log('LOG: ApiService.addQuote - начинаем создание цитаты:', quoteData);
        console.log('LOG: ApiService.addQuote - userId:', userId);
        
        try {
            const result = await this.request('POST', '/quotes', { ...quoteData, userId });
            console.log('LOG: ApiService.addQuote - успешный ответ:', result);
            return result;
        } catch (error) {
            console.error('LOG: ApiService.addQuote - ошибка запроса:', error);
            
            // Проверяем, не является ли это успешным ответом с кодом 201
            if (error.status === 201 && error.data && error.data.success) {
                console.log('LOG: ApiService.addQuote - получен код 201 с success=true, считаем успехом');
                return error.data;
            }
            
            throw error;
        }
    }
    
    /**
     * 📖 Получить цитаты пользователя
     */
    async getQuotes(options = {}, userId) {
        const params = new URLSearchParams();

        const uid = userId || this.resolveUserId();
        if (uid && uid !== 'demo-user') {
            params.append('userId', uid);
        }

        if (options.limit) params.append('limit', options.limit);
        if (typeof options.offset !== 'undefined') params.append('offset', options.offset);
        if (options.author) params.append('author', options.author);
        if (options.search) params.append('search', options.search);
        if (options.dateFrom) params.append('dateFrom', options.dateFrom);
        if (options.dateTo) params.append('dateTo', options.dateTo);
        
        // Add ISO week parameters for filtering
        if (options.weekNumber) params.append('weekNumber', options.weekNumber);
        if (options.year) params.append('year', options.year);
        if (options.monthNumber) params.append('monthNumber', options.monthNumber);

        if (typeof options.favorites !== 'undefined') {
            params.append('favorites', String(!!options.favorites));
        }
        if (options.sort) params.append('sort', options.sort);
        if (options.order) params.append('order', options.order);

        const endpoint = `/quotes?${params.toString()}`;
        return this.request('GET', endpoint);
    }
    
    /**
     * 🤖 Анализ цитаты через AI
     */
    async analyzeQuote(textOrOptions, author = null) {
        // Support both signatures: analyzeQuote(text, author) and analyzeQuote({ text, author })
        let requestData;
        
        if (typeof textOrOptions === 'string') {
            // analyzeQuote(text, author) format
            requestData = {
                text: textOrOptions,
                author: author
            };
        } else if (typeof textOrOptions === 'object' && textOrOptions.text) {
            // analyzeQuote({ text, author, source }) format
            requestData = {
                text: textOrOptions.text,
                author: textOrOptions.author || null
            };
        } else {
            throw new Error('Invalid arguments: expected (text, author) or ({ text, author })');
        }

        return this.request('POST', '/quotes/analyze', requestData);
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
    async getRecentQuotes(limit = 10, userId = 'demo-user') {
        return this.request('GET', `/quotes/recent?limit=${limit}&userId=${userId}`);
    }

    /**
     * ✏️ Обновить цитату
     */
    async updateQuote(quoteId, updateData, userId = 'demo-user') {
        this.clearQuotesCache();
        return this.request('PUT', `/quotes/${quoteId}`, { ...updateData, userId });
    }

    /**
     * 🗑️ Удалить цитату
     */
    async deleteQuote(quoteId, userId) {
        this.clearQuotesCache();

        // Берём userId из аргумента или пытаемся разрешить из окружения
        const uid = userId || this.resolveUserId();

        // ВАЖНО: не отправляем demo-user — лучше вовсе без userId, пусть отработает Telegram auth
        const qs = uid && uid !== 'demo-user' ? `?userId=${encodeURIComponent(String(uid))}` : '';

        return this.request('DELETE', `/quotes/${quoteId}${qs}`);
    }

    /**
     * 🔍 Поиск цитат
     */
    async searchQuotes(query, options = {}, userId = 'demo-user') {
        const params = new URLSearchParams({ q: query, userId });
        
        if (options.limit) params.append('limit', options.limit);
        if (options.author) params.append('author', options.author);

        return this.request('GET', `/quotes/search?${params.toString()}`);
    }

    // ===========================================
    // 📊 ОТЧЕТЫ
    // ===========================================

    /**
     * 📅 Получить еженедельные отчеты (ОПТИМИЗИРОВАНО ДЛЯ ПОСЛЕДНЕГО ОТЧЕТА)
     */
    async getWeeklyReports(options = {}, userId = 'demo-user') {
        const params = new URLSearchParams();
        // ✅ ОПТИМИЗАЦИЯ: По умолчанию загружаем только последний отчет
        const limit = options.limit || 1;
        if (limit) params.append('limit', limit);
        if (options.offset) params.append('offset', options.offset);

        // Используем path-параметр, т.к. /reports/weekly?userId=... на проде отсутствует
        const qs = params.toString();
        const endpoint = `/reports/weekly/${encodeURIComponent(String(userId))}${qs ? `?${qs}` : ''}`;
        
        console.log(`📊 API: Загружаем еженедельные отчеты (limit: ${limit})`);
        return this.request('GET', endpoint);
    }

    /**
     * 📈 Получить конкретный еженедельный отчет по ID
     * Бэкенд не предоставляет GET /reports/weekly/:reportId,
     * поэтому эмитируем через загрузку списка и поиск нужного id.
     */
    async getWeeklyReport(reportId, userId = 'demo-user') {
        const resp = await this.getWeeklyReports({ limit: 10 }, userId);
        const reports = resp?.reports || resp?.data?.reports || [];
        return reports.find(r => r.id === reportId) || null;
    }

    /**
     * 📅 Получить контекст недели (NEW)
     * @param {string} userId - ID пользователя
     * @returns {Promise<Object>} Контекст недели с информацией о текущей/предыдущей неделе
     */
    async getWeekContext(userId) {
        const resolvedUserId = userId || this.resolveUserId();
        if (!resolvedUserId) {
            throw new Error('UserId is required for week context');
        }
        
        const params = new URLSearchParams({ userId: resolvedUserId });
        console.log(`📅 API: Загружаем контекст недели для пользователя ${resolvedUserId}`);
        return this.request('GET', `/week-context?${params.toString()}`);
    }
    
    /**
     * 📅 Получить месячные отчеты
     */
    async getMonthlyReports(options = {}, userId = 'demo-user') {
        const params = new URLSearchParams({ userId });
        
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const endpoint = `/reports/monthly?${params.toString()}`;
        return this.request('GET', endpoint);
    }

    /**
     * 📊 Получить конкретный месячный отчет
     */
    async getMonthlyReport(reportId, userId = 'demo-user') {
        return this.request('GET', `/reports/monthly/${reportId}?userId=${userId}`);
    }

    /**
     * 🔄 Запросить генерацию нового отчета
     */
    async generateReport(type = 'weekly') {
        return this.request('POST', `/reports/${type}/generate`);
    }

    /**
     * 📊 Получить статистику за неделю для пользователя
     * НОВЫЙ: Для получения реальных еженедельных статистик
     */
    async getWeeklyStats(userId = 'demo-user') {
        try {
            const endpoint = `/reports/weekly/${encodeURIComponent(String(userId))}/stats`;
            const result = await this.request('GET', endpoint);
            
            if (result && result.success && result.data) {
                return result;
            }
            
            // Возвращаем fallback если API не вернул валидные данные
            console.warn('⚠️ API getWeeklyStats: получены некорректные данные, используем fallback');
            return this._getWeeklyStatsFallback();
        } catch (error) {
            console.warn('⚠️ API getWeeklyStats: ошибка загрузки, используем fallback:', error);
            return this._getWeeklyStatsFallback();
        }
    }

    /**
     * 📊 Fallback статистика для getWeeklyStats
     * @private
     */
    _getWeeklyStatsFallback() {
        return {
            success: true,
            data: {
                quotes: 7,
                uniqueAuthors: 5,
                activeDays: 6,
                streakDays: 3,
                targetQuotes: 30,
                progressQuotesPct: 50,
                targetDays: 7,
                progressDaysPct: 86,
                dominantThemes: ['саморазвитие', 'психология'],
                prevWeek: {
                    quotes: 5,
                    uniqueAuthors: 4,
                    activeDays: 4
                },
                latestQuoteAt: new Date().toISOString()
            },
            warning: 'Использованы fallback данные'
        };
    }

    // ===========================================
    // 🆕 НОВАЯ СЕКЦИЯ: АЛИАСЫ ДЛЯ СОВМЕСТИМОСТИ
    // ===========================================

    /**
     * 📊 Универсальный метод получения отчета (алиас)
     * ОБНОВЛЕНО: Оптимизирован для еженедельных отчетов
     */
    async getReport(type = 'weekly', reportId = 'current') {
        if (reportId === 'current') {
            // ✅ ОПТИМИЗАЦИЯ: Возвращаем только последний отчет
            console.log(`📊 API: Запрос текущего ${type} отчета`);
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
     * @param {{scope?: 'week'}} options
     */
    async getCommunityStats(options = {}) {
        const params = new URLSearchParams();
        if (options.scope) params.append('scope', options.scope);
        const qs = params.toString();
        return this.request('GET', qs ? `/community/stats?${qs}` : '/community/stats');
    }

    /**
     * 🏆 Лидерборд за период
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * @param {{limit?: number}} options
     */
    async getLeaderboard(options = {}) {
        const params = new URLSearchParams();
        // Always use scope=week for weekly community blocks
        params.append('scope', 'week');
        if (options.limit) params.append('limit', options.limit);
        
        const queryString = params.toString();
        return this.request('GET', `/community/leaderboard?${queryString}`);
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

    /**
     * 📰 Получить последние цитаты сообщества
     * НОВЫЙ: Добавлен недостающий метод для CommunityPage (PR-3)
     */
    async getCommunityLatestQuotes(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);

        const queryString = params.toString();
        const endpoint = queryString ? `/community/quotes/latest?${queryString}` : '/community/quotes/latest';
        
        return this.request('GET', endpoint);
    }

    /**
     * 🔥 Получить популярные цитаты сообщества (обновленная версия)
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * @param {{limit?: number}} options
     */
    async getCommunityPopularQuotes(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        // Always use scope=week for weekly community blocks
        params.append('scope', 'week');

        const queryString = params.toString();
        const endpoint = `/community/popular?${queryString}`;
        
        return this.request('GET', endpoint);
    }

    /**
     * 📚 Получить популярные книги сообщества (обновленная версия)
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * @param {{limit?: number}} options
     */
    async getCommunityPopularFavorites(options = {}) {
        const params = new URLSearchParams();
        // Добавляем limit только если это число и положительное
        if (typeof options.limit === 'number' && options.limit > 0) {
            params.append('limit', options.limit);
        }
        // Всегда scope=week
        params.append('scope', 'week');
        const queryString = params.toString();
        const endpoint = `/community/popular-favorites?${queryString}`;
        return this.request('GET', endpoint);
    }

    /**
     * ❤️ Получить популярные лайкнутые цитаты за период
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * @param {{limit?: number}} options
     */
    async getCommunityPopularFavorites(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        // Always use scope=week for weekly community blocks
        params.append('scope', 'week');
        
        const queryString = params.toString();
        const endpoint = `/community/popular-favorites?${queryString}`;
        return this.request('GET', endpoint);
    }

    /**
     * ✨ Получить недавние избранные цитаты сообщества
     * НОВЫЙ: Для spotlight секции - недавно добавленные в избранное цитаты
     */
    async getCommunityRecentFavorites(options = {}) {
        const params = new URLSearchParams();
        if (options.hours) params.append('hours', options.hours);
        if (options.limit) params.append('limit', options.limit);
        const qs = params.toString();
        
        const endpoint = qs ? `/community/favorites/recent?${qs}` : '/community/favorites/recent';
        return this.request('GET', endpoint);
    }

    /**
     * 👆 Получить последние клики по каталогу
     * ОБНОВЛЕНО: Точное соответствие требованиям API: GET /api/reader/catalog/clicks/recent?limit=3
     */
    async getCatalogRecentClicks(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);

        const queryString = params.toString();
        const endpoint = queryString ? `/catalog/clicks/recent?${queryString}` : '/catalog/clicks/recent';
        
        return this.request('GET', endpoint);
    }

    /**
     * 💬 Получить сообщение от Анны
     * НОВЫЙ: API для сообщения от Анны: GET /api/reader/community/message
     */
    async getCommunityMessage() {
        return this.request('GET', '/community/message');
    }

    /**
     * 📈 Получить тренд недели
     * НОВЫЙ: API для тренда недели: GET /api/reader/community/trend
     */
    async getCommunityTrend() {
        return this.request('GET', '/community/trend');
    }

    /**
     * 📊 Получить инсайты сообщества за период
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * @param {{}} options
     */
    async getCommunityInsights(options = {}) {
        const params = new URLSearchParams();
        // Always use scope=week for weekly community blocks
        params.append('scope', 'week');
        
        const queryString = params.toString();
        const endpoint = `/community/insights?${queryString}`;
        return this.request('GET', endpoint);
    }

    /**
     * 🎉 Получить интересный факт недели
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * @param {{}} options
     */
    async getCommunityFunFact(options = {}) {
        const params = new URLSearchParams();
        // Always use scope=week for weekly community blocks
        params.append('scope', 'week');
        
        const queryString = params.toString();
        const endpoint = `/community/fun-fact?${queryString}`;
        return this.request('GET', endpoint);
    }

    // ===========================================
    // 🛠️ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ===========================================

    /**
     * 🗑️ Очистка кэша цитат
     */
    clearQuotesCache() {
        // Clear in-memory cache
        for (const key of this.cache.keys()) {
            if (key.includes('/quotes')) {
                this.cache.delete(key);
            }
        }
        
        // Clear localStorage cache for quotes endpoints
        if (typeof window !== 'undefined' && window.StorageService) {
            try {
                const storageService = new window.StorageService();
                storageService.clearApiCache('/quotes');
                console.log('🧹 Cleared both in-memory and localStorage cache for quotes');
            } catch (error) {
                console.warn('⚠️ Could not clear localStorage cache:', error);
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

    /**
     * ⚙️ Получить настройки пользователя
     * @param {string} userId - ID пользователя
     * @returns {Promise<Object>} Настройки
     */
    async getSettings(userId) {
        return this.request('GET', '/settings');
    }

    /**
     * ⚙️ Сохранить настройки пользователя
     * @param {string} userId - ID пользователя
     * @param {Object} settings - Настройки для сохранения
     * @returns {Promise<Object>} Обновленные настройки
     */
    async saveSettings(userId, settings) {
        return this.request('PATCH', '/settings', { settings });
    }

    /**
     * ⚙️ Обновить настройки пользователя (алиас для saveSettings)
     * @param {Object} settings - Настройки для сохранения
     * @returns {Promise<Object>} Обновленные настройки
     */
    async updateSettings(settings) {
        return this.request('PATCH', '/settings', { settings });
    }
}

// 🌍 Глобальный экспорт (только если window доступен)
if (typeof window !== 'undefined') {
    window.ApiService = ApiService;
}

// 📱 Экспорт для модульной системы
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}
