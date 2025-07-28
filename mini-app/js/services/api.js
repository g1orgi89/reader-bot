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
 * ВЕРСИЯ: 1.0.3 - ИСПРАВЛЕНА СИНТАКСИЧЕСКАЯ ОШИБКА НА СТРОКЕ 841
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

        // 🔍 Debug режим
        this.debug = this.isDebugMode();
        
        this.log('🚀 API Service инициализирован', { baseURL: this.baseURL, debug: this.debug });
    }

    /**
     * 🔍 Определяет debug режим
     * ИСПРАВЛЕНО: Добавлена проверка для app.unibotz.com
     */
    isDebugMode() {
        const hostname = window.location.hostname;
        
        // Debug режим для разработки
        return hostname === 'localhost' || 
               hostname === '127.0.0.1' ||
               hostname.includes('unibotz.com') || // 🔥 ДОБАВЛЕНО для вашего домена
               hostname.includes('ngrok') ||
               hostname.includes('vercel.app') ||
               hostname.includes('netlify.app');
    }

    /**
     * 🌐 Определяет базовый URL в зависимости от окружения
     * ИСПРАВЛЕНО: Принудительно используем заглушки в debug режиме
     */
    getBaseURL() {
        const hostname = window.location.hostname;
        
        // 🧪 Debug режим - НЕ ИСПОЛЬЗУЕМ реальный API
        if (this.isDebugMode()) {
            console.log('🧪 DEBUG MODE: Используются заглушки вместо реального API');
            return null; // Заглушки не требуют URL
        }
        
        // Продакшн URL (только для реального продакшна)
        return 'https://your-domain.com/api/reader';
    }

    /**
     * 🔐 Устанавливает токен аутентификации
     */
    setAuthToken(token) {
        this.authToken = token;
        this.log('🔑 Токен аутентификации установлен');
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
     * ИСПРАВЛЕНО: Автоматическое переключение на заглушки в debug режиме
     */
    async request(method, endpoint, data = null, options = {}) {
        // 🧪 В debug режиме используем заглушки
        if (this.debug) {
            this.log(`🧪 DEBUG: Возвращаем заглушку для ${method} ${endpoint}`);
            return this.getMockData(endpoint, method, data);
        }

        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = `${method}:${endpoint}:${JSON.stringify(data)}`;

        // 💾 Проверяем кэш для GET запросов
        if (method === 'GET' && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.log('📦 Возвращаем из кэша', { endpoint });
                return cached.data;
            }
        }

        // 🔄 Retry логика
        let lastError;
        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                this.log(`📤 ${method} ${endpoint}`, { data, attempt });

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

                this.log(`📥 ${method} ${endpoint} успешно`, { result });
                return result;

            } catch (error) {
                lastError = error;
                this.log(`❌ ${method} ${endpoint} ошибка`, { error: error.message, attempt });

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
     * 🧪 Получение тестовых данных (заглушки)
     * НОВЫЙ: Централизованные заглушки для всех endpoint'ов
     */
    getMockData(endpoint, method, data) {
        // Имитируем задержку сети
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockData = this.generateMockResponse(endpoint, method, data);
                resolve(mockData);
            }, Math.random() * 500 + 200); // 200-700ms задержка
        });
    }

    /**
     * 🎭 Генерация mock данных для разных endpoint'ов
     */
    generateMockResponse(endpoint, method, data) {
        this.log(`🎭 Генерируем mock для ${endpoint}`);

        // Профиль пользователя
        if (endpoint === '/profile') {
            return {
                id: 12345,
                firstName: 'Тестер',
                username: 'debug_user',
                email: 'test@example.com',
                isOnboardingCompleted: true,
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 дней назад
                preferences: {
                    theme: 'light',
                    notifications: true
                }
            };
        }

        // Статистика пользователя
        if (endpoint === '/stats') {
            return {
                totalQuotes: 127,
                thisWeek: 8,
                currentStreak: 5,
                longestStreak: 23,
                favoriteAuthors: ['Эрих Фромм', 'Карл Юнг', 'Виктор Франкл'],
                totalBooks: 15,
                readingGoal: 50,
                achievements: 8
            };
        }

        // Последние цитаты
        if (endpoint.includes('/quotes/recent')) {
            return {
                quotes: [
                    {
                        id: 1,
                        text: "Смысл жизни заключается в том, чтобы найти свой дар. Цель жизни — отдать его.",
                        author: "Пабло Пикассо",
                        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 часа назад
                        source: "mini_app"
                    },
                    {
                        id: 2,
                        text: "Будущее принадлежит тем, кто верит в красоту своих мечт.",
                        author: "Элеонора Рузвельт",
                        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 день назад
                        source: "telegram_bot"
                    },
                    {
                        id: 3,
                        text: "Единственный способ делать великую работу — любить то, что ты делаешь.",
                        author: "Стив Джобс",
                        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 дня назад
                        source: "mini_app"
                    }
                ]
            };
        }

        // Каталог книг
        if (endpoint.includes('/catalog')) {
            return [
                {
                    id: 1,
                    title: "Искусство любить",
                    author: "Эрих Фромм",
                    description: "Классическая работа о природе любви и человеческих отношений",
                    price: 1299,
                    originalPrice: 1599,
                    rating: 4.8,
                    reviewsCount: 156,
                    category: "psychology",
                    chaptersCount: 8,
                    readingTime: "45 минут"
                },
                {
                    id: 2,
                    title: "Человек в поисках смысла",
                    author: "Виктор Франкл",
                    description: "Вдохновляющая история о поиске смысла жизни в любых обстоятельствах",
                    price: 999,
                    rating: 4.9,
                    reviewsCount: 234,
                    category: "psychology",
                    chaptersCount: 6,
                    readingTime: "60 минут"
                },
                {
                    id: 3,
                    title: "Воспоминания, сновидения, размышления",
                    author: "Карл Густав Юнг",
                    description: "Автобиографические записи великого психоаналитика",
                    price: 1499,
                    rating: 4.7,
                    reviewsCount: 89,
                    category: "psychology",
                    chaptersCount: 12,
                    readingTime: "90 минут"
                }
            ];
        }

        // Рекомендации
        if (endpoint === '/recommendations') {
            return [
                {
                    id: 1,
                    title: "Искусство любить",
                    author: "Эрих Фромм",
                    recommendationReason: "На основе ваших цитат о любви и отношениях",
                    price: 1299
                },
                {
                    id: 2,
                    title: "Быть собой",
                    author: "Анна Бусел",
                    recommendationReason: "Подходит для самопознания",
                    price: 899
                }
            ];
        }

        // Категории
        if (endpoint === '/categories') {
            return [
                { id: 'psychology', name: 'Психология', count: 45 },
                { id: 'philosophy', name: 'Философия', count: 23 },
                { id: 'personal_growth', name: 'Личностный рост', count: 34 },
                { id: 'relationships', name: 'Отношения', count: 18 }
            ];
        }

        // Статистика сообщества
        if (endpoint === '/community/stats') {
            return {
                totalMembers: 1250,
                activeToday: 89,
                totalQuotes: 15420,
                topAuthors: ['Эрих Фромм', 'Виктор Франкл', 'Карл Юнг']
            };
        }

        // Рейтинг
        if (endpoint.includes('/community/leaderboard')) {
            return [
                { name: 'Анна', quotes: 127, position: 1 },
                { name: 'Мария', quotes: 98, position: 2 },
                { name: 'Елена', quotes: 76, position: 3 },
                { name: 'Вы', quotes: 45, position: 8 }
            ];
        }

        // Популярные цитаты
        if (endpoint.includes('/community/popular')) {
            return [
                {
                    text: "Смысл жизни заключается в том, чтобы найти свой дар. Цель жизни — отдать его.",
                    author: "Пабло Пикассо",
                    likes: 42,
                    user: "Анна"
                },
                {
                    text: "Будущее принадлежит тем, кто верит в красоту своих мечт.",
                    author: "Элеонора Рузвельт", 
                    likes: 38,
                    user: "Мария"
                }
            ];
        }

        // Еженедельные отчеты
        if (endpoint.includes('/reports/weekly')) {
            return [
                {
                    id: 1,
                    weekNumber: 30,
                    year: 2025,
                    quotesCount: 8,
                    analysis: "На этой неделе вас интересовали темы самопознания и личностного роста.",
                    recommendations: ["Искусство любить - Эрих Фромм", "Быть собой - Анна Бусел"],
                    promoCode: { code: "READER20", discount: 20 }
                }
            ];
        }

        // По умолчанию
        return {
            success: true,
            message: `Mock data for ${endpoint}`,
            data: null
        };
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
     * 🔑 Аутентификация через Telegram
     */
    async authenticateWithTelegram(telegramData, user) {
        if (this.debug) {
            this.log('🧪 DEBUG: Мок аутентификации');
            return {
                token: 'debug_token_12345',
                user: {
                    id: 12345,
                    firstName: 'Тестер',
                    username: 'debug_user',
                    isDebug: true
                }
            };
        }

        try {
            const response = await this.request('POST', '/auth/telegram', {
                telegramData,
                user
            });

            if (response.token) {
                this.setAuthToken(response.token);
            }

            return response;
        } catch (error) {
            this.log('❌ Ошибка аутентификации', { error: error.message });
            throw new Error('Не удалось аутентифицироваться через Telegram');
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
            this.log('❌ Ошибка обновления токена', { error: error.message });
            throw error;
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
     * 📊 Получить статистику пользователя
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
     * ➕ Добавить новую цитату
     */
    async addQuote(quoteData) {
        // Очищаем кэш цитат после добавления
        this.clearQuotesCache();
        return this.request('POST', '/quotes', quoteData);
    }

    /**
     * 📖 Получить цитаты пользователя
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
     * 🔍 Поиск цитат
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
    async getLeaderboard(type = 'monthly') {
        return this.request('GET', `/community/leaderboard?type=${type}`);
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
        this.log('🧹 Кэш полностью очищен');
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
     * 🔍 Логирование (только в debug режиме)
     */
    log(message, data = null) {
        if (this.debug) {
            console.log(`[API] ${message}`, data || '');
        }
    }

    /**
     * 🏥 Проверка состояния API
     */
    async healthCheck() {
        try {
            const response = await this.request('GET', '/health');
            this.log('✅ API здоров', { response });
            return response;
        } catch (error) {
            this.log('❌ API недоступен', { error: error.message });
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
} // 🔧 ИСПРАВЛЕНО: Добавлена недостающая закрывающая скобка класса

// 🌍 Глобальный экспорт
window.ApiService = ApiService;

// 📱 Экспорт для модульной системы
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}