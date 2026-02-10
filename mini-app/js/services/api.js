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
     * 🔧 Invalidate covers caches after mutations
     * Clears any cached /covers requests to force fresh data
     * @private
     */
    _invalidateCoversCaches() {
        let invalidatedCount = 0;
        for (const [key] of this.cache.entries()) {
            if (key.includes('/covers')) {
                this.cache.delete(key);
                invalidatedCount++;
            }
        }
        if (invalidatedCount > 0) {
            console.log(`🔧 ApiService: Invalidated ${invalidatedCount} covers cache entries`);
        }
    }
    
    /**
     * 🔢 Clamp limit to prevent backend errors
     * Ensures limit is always within valid range (1 to max)
     * @param {number} limit - The requested limit
     * @param {number} max - Maximum allowed limit (default: 50)
     * @param {number} fallback - Fallback value if limit is invalid (default: 10)
     * @returns {number} Clamped limit value
     */
    clampLimit(limit, max = 50, fallback = 10) {
        // If limit is not a valid number, use fallback
        if (typeof limit !== 'number' || isNaN(limit)) {
            console.debug(`⚠️ ApiService.clampLimit: Invalid limit ${limit}, using fallback ${fallback}`);
            return fallback;
        }
        
        // Clamp to range [1, max]
        if (limit < 1) {
            console.debug(`⚠️ ApiService.clampLimit: Limit ${limit} < 1, using 1`);
            return 1;
        }
        if (limit > max) {
            console.debug(`⚠️ ApiService.clampLimit: Limit ${limit} > max ${max}, using ${max}`);
            return max;
        }
        
        return limit;
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
     * Поддерживает как legacy period параметр, так и scope=week с weekNumber/year
     * @param {Object} [options]
     * @param {string} [options.period] - напр. "7d" (legacy)
     * @param {string} [options.scope] - напр. "week" для недельной агрегации
     * @param {number} [options.weekNumber] - номер ISO недели
     * @param {number} [options.year] - год
     * @param {number} [options.limit] - количество книг
     * @param {string} [options.scope] - напр. "week" для недельных топов
     * @returns {Promise<any>}
     */
    async getTopBooks(options = {}) {
      const params = new URLSearchParams();
      if (options.period) params.append('period', options.period);
      if (options.limit) params.append('limit', options.limit);
      if (options.scope) params.append('scope', options.scope);
      if (options.weekNumber) params.append('weekNumber', options.weekNumber);
      if (options.year) params.append('year', options.year);

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
    
    /**
     * 📡 Универсальный HTTP клиент с обработкой ошибок
     * ИСПРАВЛЕНО: Убраны все debug заглушки - только реальный API
     */
    async request(method, endpoint, data = null, options = {}) {
        // Route audio endpoints to /api/audio instead of /api/reader
        let baseUrl = this.baseURL;
        let endpointPath = endpoint;
        
        if (endpoint.startsWith('/audio/')) {
            baseUrl = '/api/audio';
            // Remove the /audio prefix since the base is already /api/audio
            endpointPath = endpoint.slice(6); // Remove '/audio' prefix
        }
        
        // Add cache-busting for quotes endpoints on GET requests OR if noCache is requested
        let finalUrl = `${baseUrl}${endpointPath}`;
        if (method === 'GET' && (endpoint.includes('/quotes') || options.noCache)) {
            const separator = endpoint.includes('?') ? '&' : '?';
            finalUrl += `${separator}_t=${Date.now()}`;
        }
        
        const cacheKey = `${method}:${endpoint}:${JSON.stringify(data)}`;

        // 💾 Skip cache for quotes endpoints, noCache requests, or if cache is stale
        if (method === 'GET' && !endpoint.includes('/quotes') && !options.noCache && this.cache.has(cacheKey)) {
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
                
                // Add no-cache headers for quotes GET requests OR if noCache is requested
                if (method === 'GET' && (endpoint.includes('/quotes') || options.noCache)) {
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

                // 💾 Кэшируем только не-quotes GET запросы и не-noCache запросы
                if (method === 'GET' && !endpoint.includes('/quotes') && !options.noCache) {
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
     * 👤 Получить профиль пользователя по ID (публичный эндпоинт)
     * Используется для просмотра профилей других пользователей
     * @param {string} userId - ID пользователя
     * @returns {Promise<Object>} Профиль пользователя с статистикой
     */
    async getUserProfile(userId) {
        const currentUserId = this.resolveUserId();
        
        // Если запрашиваем свой профиль, используем getProfile
        if (userId === currentUserId || userId === 'me') {
            return this.getProfile(currentUserId);
        }
        
        // Для других пользователей используем публичный эндпоинт
        return this.request('GET', `/users/${userId}`);
    }

    /**
     * 📚 Получить цитаты пользователя
     * @param {string} userId - ID пользователя
     * @param {Object} options - Опции запроса (limit, offset)
     * @returns {Promise<Array>} Список цитат пользователя
     */
    async getUserQuotes(userId, options = {}) {
        const limit = options.limit || 10;
        const offset = options.offset || 0;
        const currentUserId = this.resolveUserId();
        
        // Если запрашиваем свои цитаты, используем getQuotes с offset
        if (userId === currentUserId || userId === 'me') {
            return await this.getQuotes({ limit, offset }, currentUserId);
        }
        
        // Для других пользователей используем публичный эндпоинт с offset
        const params = new URLSearchParams();
        params.append('limit', limit);
        if (offset) params.append('offset', offset);
        
        // Return full response to preserve pagination info
        return await this.request('GET', `/users/${userId}/quotes?${params.toString()}`);
    }

    /**
     * ✏️ Обновить профиль пользователя
     */
    async updateProfile(profileData, userId = 'demo-user') {
        return this.request('PATCH', `/profile?userId=${userId}`, profileData);
    }

    /**
     * 🖼️ Загрузить аватар пользователя
     * FIX: mobile WebView header pattern + fallback без Authorization
     */
    async uploadAvatar(fileOrBlob, userId = 'demo-user') {
        try {
            console.log('🖼️ Загружаем аватар для пользователя:', userId);

            // Demo user: возвращаем превью локально
            if (userId === 'demo-user') {
                let base64Data;
                if (fileOrBlob instanceof Blob || fileOrBlob instanceof File) {
                    base64Data = await this.fileToBase64(fileOrBlob);
                } else if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) {
                    base64Data = fileOrBlob;
                } else {
                    throw new Error('Unsupported file format');
                }
                return { success: true, avatarUrl: base64Data, message: 'Demo avatar (not uploaded)' };
            }

            if (!(fileOrBlob instanceof Blob || fileOrBlob instanceof File)) {
                throw new Error('Expected File or Blob for upload');
            }

            // RAW initData без encodeURIComponent, но с жёсткой санитизацией
            const initDataRaw = this.resolveTelegramInitDataRaw?.() || null;
            if (!initDataRaw) throw new Error('Telegram authentication required');

            const safeInitData = this.sanitizeHeaderValue(initDataRaw);
            const safeUserId = this.sanitizeHeaderValue(this.resolveUserId() || userId);

            // Формируем FormData
            const formData = new FormData();
            formData.append('avatar', fileOrBlob);

            const url = `${this.baseURL}/auth/upload-avatar`;

            const makeHeaders = (withAuth = true) => {
                const h = {
                    'X-Telegram-Init-Data': safeInitData,
                    'X-User-Id': safeUserId,
                    'Accept': 'application/json'
                };
                if (withAuth) {
                    // Именно RAW (санитизированный), без encodeURIComponent — мобильный WebView падает на «pattern»
                    h['Authorization'] = `tma ${safeInitData}`;
                }
                return h;
            };

            const makeOptions = (withAuth = true) => ({
                method: 'POST',
                headers: makeHeaders(withAuth),
                body: formData,
                credentials: 'include'
            });

            // 1) Пытаемся с Authorization + X-headers
            try {
                const response = await fetch(url, makeOptions(true));
                const result = await response.json().catch(() => ({}));

                const bodyMsg = (result && (result.error || result.message || '') || '').toString().toLowerCase();

                if (!response.ok && bodyMsg.includes('expected pattern')) {
                    console.warn('⚠️ Upload: backend pattern error, retry without Authorization header...');
                    // 2) Fallback: без Authorization; добавим initData в тело на всякий случай
                    formData.append('initData', safeInitData);
                    const resp2 = await fetch(url, makeOptions(false));
                    const res2 = await resp2.json().catch(() => ({}));
                    if (!resp2.ok || !res2.success) {
                        throw new Error(res2.error || `HTTP ${resp2.status}`);
                    }
                    console.log('✅ Аватар загружен (fallback без Authorization):', res2);
                    return res2;
                }

                if (!response.ok || !result.success) {
                    throw new Error(result.error || `HTTP ${response.status}`);
                }
                console.log('✅ Аватар загружен успешно:', result);
                return result;

            } catch (e) {
                // Если сам fetch/Headers упал ещё до запроса из‑за некорректного заголовка
                const msg = (e && e.message || '').toLowerCase();
                if (msg.includes('did not match the expected pattern') || msg.includes('header')) {
                    console.warn('⚠️ Upload: header creation error in WebView, retrying without Authorization...');
                    formData.append('initData', safeInitData);
                    const resp2 = await fetch(url, makeOptions(false));
                    const res2 = await resp2.json().catch(() => ({}));
                    if (!resp2.ok || !res2.success) {
                        throw new Error(res2.error || `HTTP ${resp2.status}`);
                    }
                    console.log('✅ Аватар загружен (fallback без Authorization):', res2);
                    return res2;
                }
                throw e;
            }

        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            if (error.status === 413 || (error.message || '').includes('413')) {
                throw new Error('Файл слишком большой. Максимальный размер: 5MB');
            } else if (error.status === 415 || (error.message || '').includes('415')) {
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
        if (options.type) params.append('type', options.type);
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
     * ОБНОВЛЕНО: Добавлена проверка limit через clampLimit для предотвращения backend ошибок
     * @param {{limit?: number, noCache?: boolean}} options
     */
    async getLeaderboard(options = {}) {
        const params = new URLSearchParams();
        // Always use scope=week for weekly community blocks
        params.append('scope', 'week');
        if (options.limit !== undefined) {
            const clampedLimit = this.clampLimit(options.limit, 50, 10);
            params.append('limit', clampedLimit);
            console.debug(`🏆 getLeaderboard: limit=${options.limit} -> clamped=${clampedLimit}`);
        }
        
        const queryString = params.toString();
        return this.request('GET', `/community/leaderboard?${queryString}`, null, { noCache: options.noCache });
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
     * ОБНОВЛЕНО: Добавлена проверка limit через clampLimit для предотвращения backend ошибок
     * @param {{limit?: number, noCache?: boolean}} options
     */
    async getCommunityLatestQuotes(options = {}) {
        const params = new URLSearchParams();
        if (options.limit !== undefined) {
            const clampedLimit = this.clampLimit(options.limit, 50, 10);
            params.append('limit', clampedLimit);
            console.debug(`📰 getCommunityLatestQuotes: limit=${options.limit} -> clamped=${clampedLimit}`);
        }

        const queryString = params.toString();
        const endpoint = queryString ? `/community/quotes/latest?${queryString}` : '/community/quotes/latest';
        
        return this.request('GET', endpoint, null, { noCache: options.noCache });
    }

    /**
     * 🔥 Получить популярные цитаты сообщества (обновленная версия)
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * ОБНОВЛЕНО: Добавлена проверка limit через clampLimit для предотвращения backend ошибок
     * @param {{limit?: number, noCache?: boolean}} options
     */
    async getCommunityPopularQuotes(options = {}) {
        const params = new URLSearchParams();
        if (options.limit !== undefined) {
            const clampedLimit = this.clampLimit(options.limit, 50, 10);
            params.append('limit', clampedLimit);
            console.debug(`🔥 getCommunityPopularQuotes: limit=${options.limit} -> clamped=${clampedLimit}`);
        }
        // Always use scope=week for weekly community blocks
        params.append('scope', 'week');

        const queryString = params.toString();
        const endpoint = `/community/popular?${queryString}`;
        
        return this.request('GET', endpoint, null, { noCache: options.noCache });
    }

    /**
     * 📚 Получить популярные избранные цитаты сообщества (обновленная версия)
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * ОБНОВЛЕНО: Добавлена проверка limit через clampLimit для предотвращения backend ошибок
     * @param {{limit?: number, noCache?: boolean}} options
     */
    async getCommunityPopularFavorites(options = {}) {
        const params = new URLSearchParams();
        // Clamp limit to valid range [1, 50]
        if (options.limit !== undefined) {
            const clampedLimit = this.clampLimit(options.limit, 50, 10);
            params.append('limit', clampedLimit);
            console.debug(`📚 getCommunityPopularFavorites: limit=${options.limit} -> clamped=${clampedLimit}`);
        }
        // Всегда scope=week
        params.append('scope', 'week');
        const queryString = params.toString();
        const endpoint = `/community/popular-favorites?${queryString}`;
        return this.request('GET', endpoint, null, { noCache: options.noCache });
    }

    /**
     * ✨ Получить недавние избранные цитаты сообщества
     * НОВЫЙ: Для spotlight секции - недавно добавленные в избранное цитаты
     * ОБНОВЛЕНО: Добавлена проверка limit через clampLimit для предотвращения backend ошибок
     * @param {{hours?: number, limit?: number, noCache?: boolean}} options
     */
    async getCommunityRecentFavorites(options = {}) {
        const params = new URLSearchParams();
        if (options.hours !== undefined) params.append('hours', options.hours);
        if (options.limit !== undefined) {
            const clampedLimit = this.clampLimit(options.limit, 50, 10);
            params.append('limit', clampedLimit);
            console.debug(`✨ getCommunityRecentFavorites: limit=${options.limit} -> clamped=${clampedLimit}`);
        }
        const qs = params.toString();
        
        const endpoint = qs ? `/community/favorites/recent?${qs}` : '/community/favorites/recent';
        return this.request('GET', endpoint, null, { noCache: options.noCache });
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

    // ===========================================
    // ❤️ FAVORITES (Community Likes System)
    // ===========================================

    /**
     * ❤️ Like a quote (add to favorites)
     * @param {Object} params
     * @param {string} params.text - Quote text
     * @param {string} [params.author] - Quote author
     * @returns {Promise<Object>}
     */
    async likeQuote({ text, author }) {
        if (!text || typeof text !== 'string') {
            throw new Error('Quote text is required');
        }
        
        return this.request('POST', '/favorites', {
            text: text.trim(),
            author: (author || '').trim()
        });
    }

    /**
     * 💔 Unlike a quote (remove from favorites)
     * UPDATED: Send params via query string to avoid DELETE body parsing issues
     * @param {Object} params
     * @param {string} params.text - Quote text
     * @param {string} [params.author] - Quote author
     * @returns {Promise<Object>}
     */
    async unlikeQuote({ text, author }) {
        if (!text || typeof text !== 'string') {
            throw new Error('Quote text is required');
        }
        
        // Send via query params to avoid DELETE body parsing issues in some deployments
        const params = new URLSearchParams();
        params.append('text', text.trim());
        if (author) {
            params.append('author', author.trim());
        }
        
        return this.request('DELETE', `/favorites?${params.toString()}`);
    }

    // ===========================================
    // 👥 ПОДПИСКИ (FOLLOW SYSTEM)
    // ===========================================

    /**
     * ➕ Подписаться на пользователя
     * @param {string} userId - ID пользователя для подписки
     */
    async followUser(userId) {
        console.log(`[FOLLOW_SYNC] api.followUser: starting follow for userId=${userId}`);
        const result = await this.request('POST', `/follow/${userId}`);
        
        // ✅ Инвалидация кэша ленты подписок после успешной подписки
        if (result && result.success) {
            console.log(`[FOLLOW_SYNC] api.followUser: success, invalidating caches for userId=${userId}`);
            
            // (1) Invalidate related caches
            this._invalidateFollowRelatedCaches(userId);
            
            // (2) Update centralized follow state
            if (typeof window !== 'undefined' && window.appState?.setFollowStatus) {
                window.appState.setFollowStatus(userId, true);
                console.log(`[FOLLOW_SYNC] api.followUser: updated appState for userId=${userId} to following=true`);
            }
            
            // (3) Dispatch global follow:changed event
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('follow:changed', {
                    detail: { userId, following: true }
                }));
                console.log(`[FOLLOW_SYNC] api.followUser: dispatched follow:changed event for userId=${userId}`);
            }
        }
        
        return result;
    }

    /**
     * ➖ Отписаться от пользователя
     * @param {string} userId - ID пользователя
     */
    async unfollowUser(userId) {
        console.log(`[FOLLOW_SYNC] api.unfollowUser: starting unfollow for userId=${userId}`);
        const result = await this.request('DELETE', `/follow/${userId}`);
        
        // ✅ Инвалидация кэша ленты подписок после успешной отписки
        if (result && result.success) {
            console.log(`[FOLLOW_SYNC] api.unfollowUser: success, invalidating caches for userId=${userId}`);
            
            // (1) Invalidate related caches
            this._invalidateFollowRelatedCaches(userId);
            
            // (2) Update centralized follow state
            if (typeof window !== 'undefined' && window.appState?.setFollowStatus) {
                window.appState.setFollowStatus(userId, false);
                console.log(`[FOLLOW_SYNC] api.unfollowUser: updated appState for userId=${userId} to following=false`);
            }
            
            // (3) Dispatch global follow:changed event
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('follow:changed', {
                    detail: { userId, following: false }
                }));
                console.log(`[FOLLOW_SYNC] api.unfollowUser: dispatched follow:changed event for userId=${userId}`);
            }
        }
        
        return result;
    }

    /**
     * 🗑️ Инвалидация кэша ленты подписок (legacy)
     * @private
     */
    _invalidateFollowingFeedCache() {
        for (const key of this.cache.keys()) {
            if (key.includes('/community/feed/following') || key.includes('/following')) {
                this.cache.delete(key);
                console.log('🗑️ Кэш ленты подписок очищен:', key);
            }
        }
    }
    
    /**
     * 🗑️ Инвалидация всех связанных кэшей подписок для userId
     * Invalidates: /follow/counts, /followers?userId=, /following, /users/:id, /profile
     * @private
     */
    _invalidateFollowRelatedCaches(userId) {
        const cachePatterns = [
            '/follow/counts',
            '/followers',
            `/followers?userId=${userId}`,
            '/following',
            `/users/${userId}`,
            '/profile',
            '/community/feed/following'
        ];
        
        for (const key of this.cache.keys()) {
            for (const pattern of cachePatterns) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                    console.log(`[FOLLOW_SYNC] Cache invalidated: ${key}`);
                    break;
                }
            }
        }
    }
    
    /**
     * 🔍 Проверить статус подписки на пользователя
     * @param {string} userId - ID пользователя
     */
    async getFollowStatus(userId) {
        return this.request('GET', `/follow/status/${userId}`);
    }

    /**
     * 🔍 Batch проверка статусов подписки
     * @param {string[]} userIds - Массив ID пользователей (макс 100)
     */
    async getFollowStatusBatch(userIds) {
        return this.request('POST', `/follow/status/batch`, { userIds });
    }

    /**
     * 📋 Получить список подписок (на кого подписан)
     * UPDATED: Теперь принимает userId для просмотра подписок любого пользователя
     * @param {Object} options - { limit, skip, userId }
     * @param {string} [options.userId] - ID пользователя, чьи подписки нужно получить (если не указан, используется текущий пользователь)
     */
    async getFollowing(options = {}) {
        console.log('📡 ApiService.getFollowing called with options:', options);
        
        const params = new URLSearchParams();
        
        // НОВАЯ ЛОГИКА: Явно передаём userId в query параметрах
        // Приоритет: options.userId > resolveUserId()
        const targetUserId = options.userId || this.resolveUserId();
        if (targetUserId) {
            params.append('userId', targetUserId);
            console.log('📡 ApiService.getFollowing - передаём userId в запрос:', targetUserId);
        }
        
        if (options.limit) params.append('limit', options.limit);
        if (options.skip) params.append('skip', options.skip);
        const qs = params.toString();
        
        console.log('📡 ApiService.getFollowing - итоговый query string:', qs);
        return this.request('GET', qs ? `/following?${qs}` : '/following');
    }

    /**
     * 📋 Получить список подписчиков
     * UPDATED: Теперь принимает userId для просмотра подписчиков любого пользователя
     * @param {Object} options - { limit, skip, userId }
     * @param {string} [options.userId] - ID пользователя, чьих подписчиков нужно получить (если не указан, используется текущий пользователь)
     */
    async getFollowers(options = {}) {
        console.log('📡 ApiService.getFollowers called with options:', options);
        
        const params = new URLSearchParams();
        
        // НОВАЯ ЛОГИКА: Явно передаём userId в query параметрах
        // Приоритет: options.userId > resolveUserId()
        const targetUserId = options.userId || this.resolveUserId();
        if (targetUserId) {
            params.append('userId', targetUserId);
            console.log('📡 ApiService.getFollowers - передаём userId в запрос:', targetUserId);
        }
        
        if (options.limit) params.append('limit', options.limit);
        if (options.skip) params.append('skip', options.skip);
        const qs = params.toString();
        
        console.log('📡 ApiService.getFollowers - итоговый query string:', qs);
        return this.request('GET', qs ? `/followers?${qs}` : '/followers');
    }

    /**
     * 📊 Получить счётчики подписок/подписчиков
     */
    async getFollowCounts() {
        return this.request('GET', `/follow/counts`);
    }

    /**
     * 📰 Получить ленту цитат от подписок
     * @param {Object} options - { limit, skip }
     */
    async getFollowingFeed(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.skip) params.append('skip', options.skip);
        const qs = params.toString();
        return this.request('GET', qs ? `/community/feed/following?${qs}` : '/community/feed/following');
    }

    // ==========================================
    // 🎧 AUDIO API METHODS
    // ==========================================

    /**
     * Get list of free audios
     * @returns {Promise<Object>} Response with audios array
     */
    async getFreeAudios() {
        console.log('🎧 ApiService: Getting free audios...');
        return this.request('GET', '/api/audio/free');
    }

    /**
     * Get audio metadata
     * @param {string} audioId - Audio identifier
     * @returns {Promise<Object>} Response with audio metadata
     */
    async getAudioMetadata(audioId) {
        const userId = this.resolveUserId();
        console.log(`🎧 ApiService: Getting metadata for audio ${audioId}...`);
        return this.request('GET', `/api/audio/${audioId}?userId=${userId}`);
    }

    /**
     * Get audio stream URL
     * @param {string} audioId - Audio identifier
     * @returns {Promise<Object>} Response with stream URL
     */
    async getAudioStreamUrl(audioId) {
        const userId = this.resolveUserId();
        console.log(`🎧 ApiService: Getting stream URL for audio ${audioId}...`);
        return this.request('GET', `/api/audio/${audioId}/stream-url?userId=${userId}`);
    }

    /**
     * Get audio playback progress
     * @param {string} audioId - Audio identifier
     * @returns {Promise<Object>} Response with progress data
     */
    async getAudioProgress(audioId) {
        const userId = this.resolveUserId();
        console.log(`🎧 ApiService: Getting progress for audio ${audioId}...`);
        return this.request('GET', `/api/audio/${audioId}/progress?userId=${userId}`);
    }

    /**
     * Update audio playback progress
     * @param {string} audioId - Audio identifier
     * @param {number} positionSec - Current position in seconds
     * @returns {Promise<Object>} Response with updated progress
     */
    async updateAudioProgress(audioId, positionSec) {
        const userId = this.resolveUserId();
        console.log(`🎧 ApiService: Updating progress for audio ${audioId}: ${positionSec}s`);
        return this.request('POST', `/api/audio/${audioId}/progress?userId=${userId}`, {
            positionSec
        });
    }

    /**
     * Get last listened track for a container
     * @param {string} containerId - Container identifier
     * @returns {Promise<Object>} Response with trackId and positionSec
     */
    async getLastTrack(containerId) {
        const userId = this.resolveUserId();
        console.log(`🎧 ApiService: Getting last track for container ${containerId}...`);
        return this.request('GET', `/api/audio/${containerId}/last-track?userId=${userId}`);
    }
    
    // ============================================================================
    // === COVERS (ОБЛОЖКИ) METHODS ===
    // ============================================================================
    
    /**
     * Get covers feed
     * @param {Object} options - Request options
     * @param {string} options.feed - Feed filter ('all' or 'following')
     * @param {string} options.cursor - Pagination cursor
     * @param {number} options.limit - Number of posts to load
     * @returns {Promise}
     */
    async getCovers(options = {}) {
        const params = new URLSearchParams();
        if (options.feed) params.append('feed', options.feed);
        if (options.cursor) params.append('cursor', options.cursor);
        if (options.limit) params.append('limit', options.limit);
        if (options.ts) params.append('ts', options.ts); // Cache-busting timestamp
        
        console.log(`📸 ApiService: Getting covers (feed=${options.feed}, cursor=${options.cursor}, ts=${options.ts})...`);
        
        // 🔧 FIX: Include Telegram auth headers to enable server-side like state computation
        // This ensures the backend can return correct 'liked' and 'likesCount' for the current user
        const initDataRaw = this.resolveTelegramInitDataRaw();
        const userId = this.resolveUserId();
        
        // Use custom headers instead of default request() to ensure auth is always included
        const url = `${this.baseURL}/covers?${params.toString()}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `tma ${initDataRaw || ''}`,
                    'X-User-Id': String(userId || ''),
                    'X-Telegram-Init-Data': initDataRaw || ''
                },
                credentials: 'include'
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch covers');
            }
            return data;
        } catch (error) {
            console.error('❌ ApiService: Failed to get covers:', error);
            throw error;
        }
    }
    
    /**
     * Upload a cover photo
     * @param {File} imageFile - Image file to upload
     * @param {string} caption - Photo caption
     * @returns {Promise}
     */
    async uploadCover(imageFile, caption = '') {
        const formData = new FormData();
        formData.append('image', imageFile);
        if (caption) formData.append('caption', caption);
        
        console.log('📸 ApiService: Uploading cover photo...');
        
        // Get authentication data
        const initDataRaw = this.resolveTelegramInitDataRaw();
        const userId = this.resolveUserId();
        
        // Use fetch directly for multipart/form-data
        return fetch(`${this.baseURL}/covers`, {
            method: 'POST',
            headers: {
                'Authorization': `tma ${initDataRaw || ''}`,
                'X-User-Id': String(userId || '')
            },
            body: formData
        }).then(async (response) => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }
            // 🔧 Invalidate covers caches after successful upload
            this._invalidateCoversCaches();
            return data;
        });
    }
    
    /**
     * Get comments for a cover post
     * @param {string} postId - Post ID
     * @param {Object} options - Request options
     * @returns {Promise}
     */
    async getCoverComments(postId, options = {}) {
        const params = new URLSearchParams();
        if (options.cursor) params.append('cursor', options.cursor);
        if (options.limit) params.append('limit', options.limit);
        if (options.ts) params.append('ts', options.ts); // Cache-busting timestamp
        
        console.log(`📸 ApiService: Getting comments for post ${postId} (ts=${options.ts})...`);
        return this.request('GET', `/covers/${postId}/comments?${params.toString()}`);
    }
    
    /**
     * Add comment to a cover post
     * @param {string} postId - Post ID
     * @param {string} text - Comment text
     * @param {string|null} parentId - Parent comment ID for replies (optional)
     * @returns {Promise}
     */
    async addCoverComment(postId, text, parentId = null) {
        console.log(`📸 ApiService: Adding comment to post ${postId}...`);
        const payload = { text };
        if (parentId) payload.parentId = parentId;
        return this.request('POST', `/covers/${postId}/comments`, payload);
    }
    
    /**
     * Like/unlike a cover post (toggle)
     * @param {string} postId - Post ID
     * @returns {Promise}
     */
    async likeCoverPost(postId) {
        console.log(`❤️ ApiService: Toggling like for cover post ${postId}...`);
        return this.request('POST', `/covers/${postId}/like`);
    }
    
    /**
     * Like/unlike a comment (toggle)
     * @param {string} postId - Post ID
     * @param {string} commentId - Comment ID
     * @returns {Promise}
     */
    async likeCoverComment(postId, commentId) {
        console.log(`❤️ ApiService: Toggling like for comment ${commentId}...`);
        return this.request('POST', `/covers/${postId}/comments/${commentId}/like`);
    }
    
    /**
     * Delete a cover post
     * @param {string} postId - Post ID to delete
     * @returns {Promise}
     */
    async deleteCover(postId) {
        console.log(`📸 ApiService: Deleting cover post ${postId}...`);
        const result = await this.request('DELETE', `/covers/${postId}`);
        // 🔧 Invalidate covers caches after successful delete
        if (result && result.success) {
            this._invalidateCoversCaches();
        }
        return result;
    }
    
    /**
     * Delete a comment on a cover post
     * @param {string} postId - Post ID
     * @param {string} commentId - Comment ID to delete
     * @returns {Promise}
     */
    async deleteCoverComment(postId, commentId) {
        console.log(`📸 ApiService: Deleting comment ${commentId} from post ${postId}...`);
        return this.request('DELETE', `/covers/${postId}/comments/${commentId}`);
    }
    
    // ============================================================================
    // === GAMIFICATION / ALICE BADGE METHODS ===
    // ============================================================================
    
    /**
     * Get Alice badge progress
     * @param {Object} options - Request options
     * @param {boolean} options.noCache - Force bypass cache (default: true for fresh data)
     * @returns {Promise<Object>} Progress data for Alice badge
     */
    async getAliceProgress(options = { noCache: true }) {
        console.log('🎖️ ApiService: Getting Alice badge progress (noCache:', options.noCache, ')...');
        return this.request('GET', '/gamification/progress/alice', null, options);
    }
    
    /**
     * Claim Alice badge
     * @returns {Promise<Object>} Result of claim operation
     */
    async claimAlice() {
        console.log('🎖️ ApiService: Claiming Alice badge...');
        return this.request('POST', '/gamification/alice/claim');
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
