/**
 * ⚙️ КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ
 * Основные настройки Mini App
 * 
 * Центральная конфигурация для всех компонентов приложения
 * @fileoverview Настройки функций, лимиты, и параметры UI
 * @version 1.0.0
 */

/**
 * Основная конфигурация приложения
 * @namespace AppConfig
 */
const AppConfig = {
    /**
     * Информация о приложении
     * @type {Object}
     */
    app: {
        name: 'Reader Bot Mini App',
        version: '1.0.0',
        description: 'Персональный дневник цитат для участников Книжного клуба',
        
        // Режим разработки
        isDevelopment: window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1',
        
        // Поддерживаемые языки
        supportedLanguages: ['ru', 'en'],
        defaultLanguage: 'ru'
    },

    /**
     * Настройки цитат
     * @type {Object}
     */
    quotes: {
        // Лимиты
        dailyLimit: 10,
        minLength: 10,
        maxLength: 1000,
        
        // Автор
        maxAuthorLength: 100,
        
        // Автосохранение черновиков
        autoSaveDrafts: true,
        autoSaveInterval: 3000, // 3 секунды
        
        // AI анализ
        enableAiAnalysis: true,
        aiAnalysisTimeout: 15000, // 15 секунд
        
        // Валидация
        validation: {
            requireAuthor: false,
            allowEmptyAuthor: true,
            forbiddenWords: [],
            maxConsecutiveChars: 5
        }
    },

    /**
     * Настройки отчетов
     * @type {Object}
     */
    reports: {
        // Еженедельные отчеты
        weekly: {
            enabled: true,
            dayOfWeek: 0, // Воскресенье
            timeOfDay: '11:00',
            includeAnalysis: true,
            includeRecommendations: true
        },
        
        // Месячные отчеты
        monthly: {
            enabled: true,
            dayOfMonth: 1, // Первое число
            timeOfDay: '10:00',
            detailedAnalysis: true,
            includeGoals: true
        },
        
        // Экспорт
        export: {
            formats: ['json', 'txt', 'pdf'],
            maxExportSize: 1000, // Максимум цитат в экспорте
            includeMetadata: true
        }
    },

    /**
     * Геймификация и достижения
     * @type {Object}
     */
    gamification: {
        // Основные настройки
        enabled: true,
        
        // Достижения
        achievements: {
            enabled: true,
            showProgress: true,
            notifyOnUnlock: true,
            categories: [
                'collector', // Коллекционер цитат
                'philosopher', // Философ (глубокие цитаты)
                'reader', // Любитель чтения
                'consistent', // Постоянство
                'explorer' // Исследователь жанров
            ]
        },
        
        // Серии (стрики)
        streaks: {
            enabled: true,
            dailyQuoteStreak: true,
            weeklyReportStreak: false,
            resetOnMissedDay: true
        },
        
        // Система очков (отключена пока)
        points: {
            enabled: false,
            perQuote: 10,
            perDay: 5,
            bonusMultiplier: 1.5
        }
    },

    /**
     * Пользовательский интерфейс
     * @type {Object}
     */
    ui: {
        // Тема
        theme: {
            default: 'auto', // auto, light, dark
            followSystem: true,
            followTelegram: true
        },
        
        // Анимации
        animations: {
            enabled: true,
            duration: 300, // миллисекунды
            easing: 'ease-in-out',
            reducedMotion: false // Учитывать prefers-reduced-motion
        },
        
        // Haptic feedback
        haptics: {
            enabled: true,
            success: 'notification',
            error: 'notification',
            warning: 'notification',
            click: 'impact',
            selection: 'selection'
        },
        
        // Загрузочные индикаторы
        loading: {
            showSkeletons: true,
            showSpinners: true,
            minLoadingTime: 500, // Минимальное время показа загрузки
            timeout: 10000 // Таймаут загрузки
        },
        
        // Уведомления
        notifications: {
            position: 'top',
            duration: 3000,
            maxVisible: 3,
            showIcons: true,
            allowDismiss: true
        }
    },

    /**
     * Производительность
     * @type {Object}
     */
    performance: {
        // Кэширование
        cache: {
            enabled: true,
            quotesCache: 10 * 60 * 1000, // 10 минут
            reportsCache: 30 * 60 * 1000, // 30 минут
            userDataCache: 5 * 60 * 1000, // 5 минут
            maxCacheSize: 50 // Максимум элементов в кэше
        },
        
        // Предзагрузка
        preload: {
            enabled: true,
            preloadNextPage: true,
            preloadImages: true,
            preloadReports: true
        },
        
        // Ленивая загрузка
        lazyLoading: {
            enabled: true,
            threshold: 0.1, // 10% видимости для загрузки
            rootMargin: '50px'
        },
        
        // Дебаунс для поиска
        debounce: {
            search: 300,
            input: 150,
            scroll: 16
        }
    },

    /**
     * Навигация и роутинг
     * @type {Object}
     */
    navigation: {
        // Главные страницы
        defaultPage: 'home',
        
        // История навигации
        maxHistoryLength: 10,
        
        // Переходы между страницами
        transitions: {
            enabled: true,
            type: 'slide', // slide, fade, none
            duration: 300
        },
        
        // Кнопка "Назад"
        backButton: {
            showOnSubPages: true,
            confirmOnExit: false
        }
    },

    /**
     * Безопасность
     * @type {Object}
     */
    security: {
        // Валидация данных
        validation: {
            strictMode: true,
            sanitizeInput: true,
            maxInputLength: 5000
        },
        
        // Сессия
        session: {
            timeout: 24 * 60 * 60 * 1000, // 24 часа
            refreshThreshold: 60 * 60 * 1000, // Обновлять за час до истечения
            validateOnFocus: true
        },
        
        // Ограничения запросов
        rateLimit: {
            quotesPerMinute: 5,
            searchPerMinute: 20,
            apiCallsPerMinute: 100
        }
    },

    /**
     * Функциональные возможности
     * @type {Object}
     */
    features: {
        // Поиск
        search: {
            enabled: true,
            minQueryLength: 2,
            maxResults: 50,
            highlightMatches: true,
            searchInContent: true,
            searchInAuthor: true,
            fuzzySearch: false
        },
        
        // Офлайн режим
        offline: {
            enabled: true,
            cacheQuotes: true,
            cacheReports: false,
            showOfflineIndicator: true,
            syncOnReconnect: true
        },
        
        // Экспорт/импорт
        export: {
            enabled: true,
            formats: ['json', 'txt'],
            includeMetadata: true
        },
        
        // Поделиться
        sharing: {
            enabled: false, // Пока отключено
            platforms: [],
            includeAttribution: true
        }
    },

    /**
     * Интеграция с Telegram
     * @type {Object}
     */
    telegram: {
        // Основные настройки
        integration: {
            useThemeColors: true,
            enableHaptics: true,
            autoExpand: true,
            enableClosingConfirmation: true
        },
        
        // Главная кнопка
        mainButton: {
            text: 'Добавить цитату',
            color: '#3390ec',
            textColor: '#ffffff',
            showProgress: true
        },
        
        // Кнопка "Назад"
        backButton: {
            enabled: true
        },
        
        // Кнопка настроек
        settingsButton: {
            enabled: true
        }
    },

    /**
     * Аналитика и отладка
     * @type {Object}
     */
    debug: {
        // Логирование
        logging: {
            enabled: false, // Включается только в development
            level: 'info', // error, warn, info, debug
            logToConsole: true,
            logApiCalls: true,
            logUserActions: false
        },
        
        // Метрики производительности
        performance: {
            trackPageLoad: true,
            trackApiCalls: true,
            trackUserInteractions: false
        },
        
        // Показ отладочной информации
        showDebugInfo: false,
        showPerformanceMetrics: false
    },

    /**
     * Константы приложения
     * @type {Object}
     */
    constants: {
        // Время
        ANIMATION_DURATION: 300,
        DEBOUNCE_DELAY: 300,
        TOAST_DURATION: 3000,
        
        // Размеры
        MAX_QUOTE_LENGTH: 1000,
        MAX_AUTHOR_LENGTH: 100,
        QUOTES_PER_PAGE: 20,
        
        // Ключи localStorage
        STORAGE_KEYS: {
            USER_PREFERENCES: 'reader_user_preferences',
            DRAFT_QUOTE: 'reader_draft_quote',
            CACHE_PREFIX: 'reader_cache_',
            LAST_SYNC: 'reader_last_sync'
        }
    }
};

/**
 * Утилиты для работы с конфигурацией
 * @namespace ConfigManager
 */
const ConfigManager = {
    /**
     * Получить значение конфигурации
     * @param {string} path - Путь к значению (например, 'quotes.dailyLimit')
     * @param {*} defaultValue - Значение по умолчанию
     * @returns {*} Значение конфигурации
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = AppConfig;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    },

    /**
     * Проверить включена ли функция
     * @param {string} path - Путь к булевому значению
     * @returns {boolean} Статус функции
     */
    isEnabled(path) {
        return this.get(path, false) === true;
    },

    /**
     * Получить константу
     * @param {string} name - Имя константы
     * @returns {*} Значение константы
     */
    getConstant(name) {
        return this.get(`constants.${name}`);
    },

    /**
     * Проверить режим разработки
     * @returns {boolean} Режим разработки
     */
    isDevelopment() {
        return this.get('app.isDevelopment', false);
    },

    /**
     * Получить настройки темы
     * @returns {Object} Настройки темы
     */
    getThemeConfig() {
        return this.get('ui.theme', {});
    },

    /**
     * Получить лимиты для цитат
     * @returns {Object} Лимиты цитат
     */
    getQuoteLimits() {
        return {
            daily: this.get('quotes.dailyLimit'),
            minLength: this.get('quotes.minLength'),
            maxLength: this.get('quotes.maxLength'),
            maxAuthor: this.get('quotes.maxAuthorLength')
        };
    }
};

/**
 * Инициализация конфигурации
 * Выполняется при загрузке приложения
 */
const initializeConfig = () => {
    // Установить режим разработки на основе окружения
    if (ConfigManager.isDevelopment()) {
        AppConfig.debug.logging.enabled = true;
        AppConfig.debug.showDebugInfo = true;
        console.log('🔧 Development mode enabled');
        console.log('📋 App Config:', AppConfig);
    }
    
    // Применить пользовательские настройки из localStorage
    try {
        const userPrefs = localStorage.getItem(AppConfig.constants.STORAGE_KEYS.USER_PREFERENCES);
        if (userPrefs) {
            const preferences = JSON.parse(userPrefs);
            // Объединить с конфигурацией по умолчанию
            // TODO: Реализовать merge пользовательских настроек
        }
    } catch (error) {
        console.warn('Failed to load user preferences:', error);
    }
};

// Экспорт для использования в модульной системе
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AppConfig,
        ConfigManager,
        initializeConfig
    };
}

// Глобальный доступ в браузере
if (typeof window !== 'undefined') {
    window.AppConfig = AppConfig;
    window.ConfigManager = ConfigManager;
    window.initializeConfig = initializeConfig;
    
    // Автоматическая инициализация при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeConfig);
    } else {
        initializeConfig();
    }
}