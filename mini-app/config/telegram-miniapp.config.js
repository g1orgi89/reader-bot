/**
 * Telegram Mini App Configuration
 * Конфигурация интеграции с Telegram Web App SDK
 * 
 * @fileoverview Настройки для взаимодействия с Telegram Web App API
 * @version 1.0.0
 * @author Reader Bot Development Team
 */

/**
 * Основные настройки Telegram Mini App
 * @namespace TelegramMiniAppConfig
 */
const TelegramMiniAppConfig = {
    /**
     * Основные параметры приложения
     * @type {Object}
     */
    app: {
        name: 'Reader Bot',
        version: '1.0.0',
        debug: process.env.NODE_ENV === 'development',
        
        // Поддерживаемые платформы
        supportedPlatforms: ['ios', 'android', 'web', 'desktop'],
        
        // Минимальная версия Telegram для корректной работы
        minTelegramVersion: '6.9.0'
    },

    /**
     * Настройки инициализации Telegram Web App
     * @type {Object}
     */
    initialization: {
        // Автоматическое расширение приложения при запуске
        autoExpand: true,
        
        // Включение smooth анимаций при переходах
        smoothTransitions: true,
        
        // Время ожидания инициализации (мс)
        initTimeout: 5000,
        
        // Автоматическое закрытие подтверждения при выходе
        enableClosingConfirmation: true,
        
        // Включение вертикальных свайпов
        enableVerticalSwipes: false
    },

    /**
     * Настройки пользовательского интерфейса
     * @type {Object}
     */
    ui: {
        /**
         * Цветовая схема приложения
         * Автоматически синхронизируется с темой Telegram
         */
        theme: {
            // Использовать цвета из темы Telegram
            useThemeParams: true,
            
            // Fallback цвета если themeParams недоступны
            fallbackColors: {
                bg_color: '#ffffff',
                text_color: '#000000',
                hint_color: '#999999',
                link_color: '#3390ec',
                button_color: '#3390ec',
                button_text_color: '#ffffff',
                secondary_bg_color: '#f1f1f1'
            }
        },

        /**
         * Настройки главной кнопки
         */
        mainButton: {
            // Текст по умолчанию
            defaultText: 'Добавить цитату',
            
            // Цвет кнопки (если не использовать theme)
            color: '#3390ec',
            textColor: '#ffffff',
            
            // Показывать прогресс при загрузке
            showProgress: true,
            
            // Включить haptic feedback при нажатии
            hapticFeedback: true
        },

        /**
         * Настройки кнопки "Назад"
         */
        backButton: {
            // Показывать кнопку "Назад" на внутренних страницах
            show: true,
            
            // Haptic feedback при нажатии
            hapticFeedback: true
        },

        /**
         * Настройки области настроек
         */
        settingsButton: {
            // Показывать кнопку настроек в меню
            show: true
        }
    },

    /**
     * Настройки Haptic Feedback
     * @type {Object}
     */
    haptic: {
        // Включить haptic feedback
        enabled: true,
        
        // Типы обратной связи для разных действий
        patterns: {
            // При успешном действии
            success: 'notification',
            
            // При ошибке
            error: 'notification', 
            
            // При предупреждении
            warning: 'notification',
            
            // При обычном нажатии
            click: 'impact',
            
            // При выборе элемента
            selection: 'selection'
        }
    },

    /**
     * Настройки аутентификации
     * @type {Object}
     */
    auth: {
        // Автоматическая аутентификация при запуске
        autoAuth: true,
        
        // Валидация данных пользователя
        validateUser: true,
        
        // Время жизни сессии (мс)
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 часа
        
        // Поля пользователя для получения
        requiredUserFields: [
            'id',
            'first_name', 
            'last_name',
            'username',
            'language_code',
            'is_premium'
        ]
    },

    /**
     * Настройки сетевых запросов
     * @type {Object}
     */
    api: {
        // Базовый URL для API запросов
        baseURL: '/api/reader',
        
        // Таймаут запросов (мс)
        timeout: 10000,
        
        // Количество повторных попыток
        retryAttempts: 3,
        
        // Задержка между повторными попытками (мс)
        retryDelay: 1000,
        
        // Заголовки по умолчанию
        defaultHeaders: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    },

    /**
     * Настройки уведомлений
     * @type {Object}
     */
    notifications: {
        // Показывать уведомления в приложении
        inApp: true,
        
        // Типы уведомлений
        types: {
            success: {
                duration: 3000,
                haptic: 'success'
            },
            error: {
                duration: 5000,
                haptic: 'error'
            },
            warning: {
                duration: 4000,
                haptic: 'warning'
            },
            info: {
                duration: 3000,
                haptic: null
            }
        }
    },

    /**
     * Настройки производительности
     * @type {Object}
     */
    performance: {
        // Включить предзагрузку данных
        preloadData: true,
        
        // Кэширование данных в localStorage
        cacheData: true,
        
        // Время жизни кэша (мс)
        cacheExpiry: 5 * 60 * 1000, // 5 минут
        
        // Оптимизация изображений
        optimizeImages: true,
        
        // Ленивая загрузка компонентов
        lazyLoading: true
    },

    /**
     * Настройки безопасности
     * @type {Object}
     */
    security: {
        // Валидация initData от Telegram
        validateInitData: true,
        
        // Проверка домена
        validateDomain: true,
        
        // Разрешенные домены для iframe
        allowedDomains: [
            'web.telegram.org',
            'telegram.org'
        ],
        
        // Максимальный возраст initData (секунды)
        maxInitDataAge: 3600 // 1 час
    },

    /**
     * Настройки отладки
     * @type {Object}
     */
    debug: {
        // Включить логирование
        enabled: process.env.NODE_ENV === 'development',
        
        // Уровень логирования
        level: 'info', // 'error', 'warn', 'info', 'debug'
        
        // Логировать события Telegram
        logTelegramEvents: true,
        
        // Показывать информацию о производительности
        showPerformanceInfo: false,
        
        // Логировать сетевые запросы
        logApiCalls: true
    },

    /**
     * Обработчики событий
     * @type {Object}
     */
    events: {
        // Обработка изменения темы
        onThemeChanged: null,
        
        // Обработка изменения viewport
        onViewportChanged: null,
        
        // Обработка нажатия главной кнопки
        onMainButtonClicked: null,
        
        // Обработка нажатия кнопки "Назад"
        onBackButtonClicked: null,
        
        // Обработка изменения состояния меню настроек
        onSettingsButtonClicked: null,
        
        // Обработка ошибок инициализации
        onInitError: null,
        
        // Обработка успешной инициализации
        onInitSuccess: null
    },

    /**
     * Настройки аналитики
     * @type {Object}
     */
    analytics: {
        // Включить аналитику
        enabled: false,
        
        // Трекинг пользовательских действий
        trackUserActions: false,
        
        // Трекинг производительности
        trackPerformance: false,
        
        // Трекинг ошибок
        trackErrors: true
    }
};

/**
 * Утилиты для работы с конфигурацией
 * @namespace ConfigUtils
 */
const ConfigUtils = {
    /**
     * Получить значение конфигурации по пути
     * @param {string} path - Путь к значению (например, 'ui.theme.useThemeParams')
     * @param {*} defaultValue - Значение по умолчанию
     * @returns {*} Значение конфигурации
     */
    get(path, defaultValue = null) {
        return path.split('.').reduce((obj, key) => 
            (obj && obj[key] !== undefined) ? obj[key] : defaultValue, 
            TelegramMiniAppConfig
        );
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
     * Получить цвета темы с fallback
     * @returns {Object} Объект с цветами
     */
    getThemeColors() {
        if (window.Telegram?.WebApp?.themeParams && this.isEnabled('ui.theme.useThemeParams')) {
            return window.Telegram.WebApp.themeParams;
        }
        return this.get('ui.theme.fallbackColors');
    },

    /**
     * Проверить поддержку текущей платформы
     * @returns {boolean} Поддерживается ли платформа
     */
    isPlatformSupported() {
        const platform = window.Telegram?.WebApp?.platform;
        const supportedPlatforms = this.get('app.supportedPlatforms', []);
        return !platform || supportedPlatforms.includes(platform);
    }
};

// Экспорт для использования в модульной системе
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TelegramMiniAppConfig, ConfigUtils };
}

// Глобальный доступ в браузере
if (typeof window !== 'undefined') {
    window.TelegramMiniAppConfig = TelegramMiniAppConfig;
    window.ConfigUtils = ConfigUtils;
}