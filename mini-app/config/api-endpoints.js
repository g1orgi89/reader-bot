/**
 * 🌐 API ENDPOINTS
 * URL эндпоинтов backend (/api/reader/*)
 * 
 * Конфигурация всех API endpoints для Mini App
 * @fileoverview Централизованное управление API URL
 * @version 1.0.0
 */

/**
 * Базовая конфигурация API
 * @type {Object}
 */
const API_CONFIG = {
    // Базовый URL для всех API запросов
    BASE_URL: '/api',
    
    // Таймауты и повторные попытки
    TIMEOUT: 10000, // 10 секунд
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 секунда
    
    // Заголовки по умолчанию
    DEFAULT_HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

/**
 * Основные API endpoints
 * Все пути относительно BASE_URL
 * @type {Object}
 */
const API_ENDPOINTS = {
    /**
     * 🔐 АУТЕНТИФИКАЦИЯ И ПОЛЬЗОВАТЕЛИ
     */
    AUTH: {
        // Аутентификация через Telegram
        TELEGRAM_LOGIN: '/auth/telegram',
        
        // Получение профиля пользователя
        PROFILE: '/users/profile',
        
        // Обновление профиля
        UPDATE_PROFILE: '/users/profile',
        
        // Получение статистики пользователя
        USER_STATS: '/users/stats'
    },

    /**
     * 📝 ЦИТАТЫ
     */
    QUOTES: {
        // Базовый endpoint для цитат
        BASE: '/quotes',
        
        // Добавить новую цитату
        CREATE: '/quotes',
        
        // Получить цитаты пользователя
        GET_USER_QUOTES: '/quotes/user',
        
        // Получить конкретную цитату
        GET_BY_ID: (id) => `/quotes/${id}`,
        
        // Обновить цитату
        UPDATE: (id) => `/quotes/${id}`,
        
        // Удалить цитату
        DELETE: (id) => `/quotes/${id}`,
        
        // Поиск по цитатам
        SEARCH: '/quotes/search',
        
        // Анализ цитаты с AI
        ANALYZE: '/quotes/analyze',
        
        // Получить случайную цитату
        RANDOM: '/quotes/random',
        
        // Экспорт цитат
        EXPORT: '/quotes/export'
    },

    /**
     * 📊 ОТЧЕТЫ
     */
    REPORTS: {
        // Еженедельные отчеты
        WEEKLY: '/reports/weekly',
        
        // Получить еженедельный отчет
        GET_WEEKLY: '/reports/weekly/current',
        
        // Архив еженедельных отчетов
        WEEKLY_ARCHIVE: '/reports/weekly/archive',
        
        // Месячные отчеты
        MONTHLY: '/reports/monthly',
        
        // Получить месячный отчет
        GET_MONTHLY: '/reports/monthly/current',
        
        // Архив месячных отчетов
        MONTHLY_ARCHIVE: '/reports/monthly/archive',
        
        // Персональная аналитика
        ANALYTICS: '/reports/analytics',
        
        // Экспорт отчета
        EXPORT: '/reports/export'
    },

    /**
     * 🏆 ДОСТИЖЕНИЯ И ГЕЙМИФИКАЦИЯ
     */
    ACHIEVEMENTS: {
        // Все достижения пользователя
        USER_ACHIEVEMENTS: '/achievements/user',
        
        // Доступные достижения
        AVAILABLE: '/achievements/available',
        
        // Прогресс по достижениям
        PROGRESS: '/achievements/progress',
        
        // Статистика достижений
        STATS: '/achievements/stats'
    },

    /**
     * 📚 РЕКОМЕНДАЦИИ
     */
    RECOMMENDATIONS: {
        // Персональные рекомендации книг
        BOOKS: '/recommendations/books',
        
        // Рекомендации на основе цитат
        BASED_ON_QUOTES: '/recommendations/quotes-based',
        
        // Популярные книги в клубе
        POPULAR: '/recommendations/popular',
        
        // Новинки
        NEW_RELEASES: '/recommendations/new'
    },

    /**
     * 🛒 КАТАЛОГ И ПРОДУКТЫ
     */
    CATALOG: {
        // Каталог книг
        BOOKS: '/bookCatalog',
        
        // Получить книгу по ID
        BOOK_BY_ID: (id) => `/bookCatalog/${id}`,
        
        // Поиск в каталоге
        SEARCH: '/bookCatalog/search',
        
        // Категории книг
        CATEGORIES: '/categories',
        
        // Книги по категории
        BY_CATEGORY: (categoryId) => `/bookCatalog/category/${categoryId}`
    },

    /**
     * 🎁 ПРОМОКОДЫ И АКЦИИ
     */
    PROMO: {
        // Применить промокод
        APPLY: '/promoCodes/apply',
        
        // Валидация промокода
        VALIDATE: '/promoCodes/validate',
        
        // Доступные промокоды для пользователя
        AVAILABLE: '/promoCodes/available',
        
        // История использования
        HISTORY: '/promoCodes/history'
    },

    /**
     * 📢 АНОНСЫ И НОВОСТИ
     */
    ANNOUNCEMENTS: {
        // Активные анонсы
        ACTIVE: '/announcements/active',
        
        // Все анонсы
        ALL: '/announcements',
        
        // Анонс по ID
        BY_ID: (id) => `/announcements/${id}`,
        
        // Отметить как прочитанный
        MARK_READ: (id) => `/announcements/${id}/read`
    },

    /**
     * 💬 ЧАТ И ПОДДЕРЖКА
     */
    CHAT: {
        // Отправить сообщение Анне
        SEND_MESSAGE: '/chat/send',
        
        // История чата
        HISTORY: '/chat/history',
        
        // Создать тикет поддержки
        CREATE_TICKET: '/tickets',
        
        // Получить тикеты пользователя
        USER_TICKETS: '/tickets/user',
        
        // Тикет по ID
        TICKET_BY_ID: (id) => `/tickets/${id}`
    },

    /**
     * 📈 АНАЛИТИКА
     */
    ANALYTICS: {
        // Общая статистика
        STATS: '/analytics/stats',
        
        // Статистика чтения
        READING_STATS: '/analytics/reading',
        
        // Тренды
        TRENDS: '/analytics/trends',
        
        // Сравнение с другими пользователями
        COMPARE: '/analytics/compare'
    },

    /**
     * ⚙️ НАСТРОЙКИ
     */
    SETTINGS: {
        // Получить настройки
        GET: '/settings',
        
        // Обновить настройки
        UPDATE: '/settings',
        
        // Настройки уведомлений
        NOTIFICATIONS: '/settings/notifications',
        
        // Настройки конфиденциальности
        PRIVACY: '/settings/privacy'
    }
};

/**
 * Утилиты для работы с API
 * @namespace ApiUtils
 */
const ApiUtils = {
    /**
     * Построить полный URL для endpoint
     * @param {string} endpoint - Endpoint путь
     * @returns {string} Полный URL
     */
    buildUrl(endpoint) {
        return `${API_CONFIG.BASE_URL}${endpoint}`;
    },

    /**
     * Получить заголовки для запроса
     * @param {Object} additionalHeaders - Дополнительные заголовки
     * @returns {Object} Объект заголовков
     */
    getHeaders(additionalHeaders = {}) {
        return {
            ...API_CONFIG.DEFAULT_HEADERS,
            ...additionalHeaders
        };
    },

    /**
     * Получить заголовки с авторизацией
     * @param {string} token - Токен авторизации
     * @param {Object} additionalHeaders - Дополнительные заголовки
     * @returns {Object} Объект заголовков
     */
    getAuthHeaders(token, additionalHeaders = {}) {
        return this.getHeaders({
            'Authorization': `Bearer ${token}`,
            ...additionalHeaders
        });
    },

    /**
     * Обработка ошибок API
     * @param {Error} error - Ошибка запроса
     * @returns {Object} Стандартизированная ошибка
     */
    handleError(error) {
        console.error('API Error:', error);
        
        if (error.response) {
            // Ошибка от сервера
            return {
                status: error.response.status,
                message: error.response.data?.message || 'Ошибка сервера',
                code: error.response.data?.code || 'SERVER_ERROR'
            };
        } else if (error.request) {
            // Сеть недоступна
            return {
                status: 0,
                message: 'Проблемы с подключением к интернету',
                code: 'NETWORK_ERROR'
            };
        } else {
            // Другие ошибки
            return {
                status: -1,
                message: error.message || 'Неизвестная ошибка',
                code: 'UNKNOWN_ERROR'
            };
        }
    }
};

/**
 * Специальные endpoints для Mini App
 * @type {Object}
 */
const MINI_APP_ENDPOINTS = {
    // Данные для инициализации приложения
    INIT_DATA: '/mini-app/init',
    
    // Конфигурация приложения
    CONFIG: '/mini-app/config',
    
    // Проверка статуса приложения
    HEALTH: '/mini-app/health',
    
    // Метрики производительности
    METRICS: '/mini-app/metrics'
};

// Экспорт для использования в модульной системе
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_CONFIG,
        API_ENDPOINTS,
        ApiUtils,
        MINI_APP_ENDPOINTS
    };
}

// Глобальный доступ в браузере
if (typeof window !== 'undefined') {
    window.API_CONFIG = API_CONFIG;
    window.API_ENDPOINTS = API_ENDPOINTS;
    window.ApiUtils = ApiUtils;
    window.MINI_APP_ENDPOINTS = MINI_APP_ENDPOINTS;
}