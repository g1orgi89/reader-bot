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
        this.baseURL = this.getBaseURL();
        
        // 🔐 Токен аутентификации
        this.authToken = null;
        
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
        
        this.log('🚀 API Service инициализирован', { baseURL: this.baseURL, debug: this.debug });
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
     * 🔐 Устанавливает токен аутентификации
     */
    setAuthToken(token) {
        this.authToken = token;
        console.log('🔑 Токен аутентификации установлен'); // ✅ Всегда логируем
    }

    /**
     * 🔗 Получает заголовки для запросов
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        return headers;
    }

    /**
     * 📡 Универсальный HTTP клиент с обработкой ошибок
     * ИСПРАВЛЕНО: Убраны все debug заглушки - только реальный API
     */
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = `${method}:${endpoint}:${JSON.stringify(data)}`;

        // 💾 Проверяем кэш для GET запросов
        if (method === 'GET' && this.cache.has(cacheKey)) {
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

                // ✅ Обрабатываем ответ
                const result = await this.handleResponse(response, endpoint);

                // 💾 Кэшируем GET запросы
                if (method === 'GET') {
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
     * 🔑 Аутентификация через Telegram - ИСПРАВЛЕНО: Только реальный API
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

            if (response.token) {
                this.setAuthToken(response.token);
                console.log('✅ Токен аутентификации сохранен');
            }

            return response;
        } catch (error) {
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
     * 📊 Получить статистику пользователя - ИСПРАВЛЕНО: Только реальный API
     */
    async getStats() {
        return this.request('GET', '/stats');
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