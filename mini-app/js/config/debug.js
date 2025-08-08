/**
 * 🔍 FRONTEND DEBUG CONFIGURATION
 * Comprehensive debugging controls for Reader Bot Mini App
 * 
 * @fileoverview Frontend debug configuration for JWT chain diagnostics
 * @version 1.0.0
 */

/**
 * Frontend debug configuration
 */
const DEBUG_CONFIG = {
    // Core debug flags
    ENABLE_API_DEBUG: true,
    ENABLE_AUTH_DEBUG: true,
    ENABLE_STORAGE_DEBUG: true,
    ENABLE_SW_DEBUG: true,
    ENABLE_JWT_DEBUG: true,
    
    // Log levels: 'minimal', 'normal', 'verbose'
    LOG_LEVEL: 'verbose',
    
    // Component-specific debugging
    ENABLE_REQUEST_DEBUGGING: true,
    ENABLE_RESPONSE_DEBUGGING: true,
    ENABLE_HEADERS_DEBUGGING: true,
    ENABLE_TOKEN_DEBUGGING: true,
    ENABLE_TELEGRAM_DEBUGGING: true,
    
    // Performance debugging
    ENABLE_TIMING_DEBUG: true,
    ENABLE_NETWORK_DEBUG: true,
    
    // Security debugging (sanitized output)
    ENABLE_SAFE_TOKEN_PREVIEW: true,
    TOKEN_PREVIEW_LENGTH: 30,
    
    // Batch logging settings
    BATCH_LOGS: false,
    BATCH_SIZE: 10,
    BATCH_TIMEOUT: 5000,
    
    // Environment detection
    AUTO_DETECT_ENVIRONMENT: true,
    FORCE_DEBUG_MODE: false
};

/**
 * Environment-based debug controls
 */
function getEnvironmentConfig() {
    const isDevelopment = (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('dev') ||
        window.location.port === '3000' ||
        window.location.port === '3002' ||
        new URLSearchParams(window.location.search).get('debug') === 'true' ||
        !window.Telegram?.WebApp
    );
    
    const isProduction = (
        window.location.protocol === 'https:' &&
        !isDevelopment &&
        window.Telegram?.WebApp &&
        !new URLSearchParams(window.location.search).get('debug')
    );
    
    return {
        isDevelopment,
        isProduction,
        isTelegramWebApp: !!window.Telegram?.WebApp,
        telegramVersion: window.Telegram?.WebApp?.version || 'unknown'
    };
}

/**
 * URL параметры могут переопределить настройки
 */
function applyUrlOverrides(config) {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Полное отключение debug
    if (urlParams.get('debug') === 'false') {
        Object.keys(config).forEach(key => {
            if (key.startsWith('ENABLE_')) {
                config[key] = false;
            }
        });
        config.LOG_LEVEL = 'minimal';
        return config;
    }
    
    // Включение debug в production
    if (urlParams.get('debug') === 'true') {
        Object.keys(config).forEach(key => {
            if (key.startsWith('ENABLE_')) {
                config[key] = true;
            }
        });
        config.LOG_LEVEL = 'verbose';
        return config;
    }
    
    // Специфичные переопределения
    if (urlParams.get('api_debug') === 'true') {
        config.ENABLE_API_DEBUG = true;
    }
    if (urlParams.get('auth_debug') === 'true') {
        config.ENABLE_AUTH_DEBUG = true;
    }
    if (urlParams.get('jwt_debug') === 'true') {
        config.ENABLE_JWT_DEBUG = true;
    }
    
    // Уровень логирования
    const logLevel = urlParams.get('log_level');
    if (['minimal', 'normal', 'verbose'].includes(logLevel)) {
        config.LOG_LEVEL = logLevel;
    }
    
    return config;
}

/**
 * Environment-aware конфигурация
 */
function getEnvironmentAwareConfig() {
    const env = getEnvironmentConfig();
    let config = { ...DEBUG_CONFIG };
    
    // В production по умолчанию debug отключен
    if (env.isProduction && !config.FORCE_DEBUG_MODE) {
        Object.keys(config).forEach(key => {
            if (key.startsWith('ENABLE_')) {
                config[key] = false;
            }
        });
        config.LOG_LEVEL = 'minimal';
    }
    
    // В development включаем все debug опции
    if (env.isDevelopment) {
        Object.keys(config).forEach(key => {
            if (key.startsWith('ENABLE_')) {
                config[key] = true;
            }
        });
        if (config.LOG_LEVEL === 'minimal') {
            config.LOG_LEVEL = 'verbose';
        }
    }
    
    // Применяем URL переопределения
    config = applyUrlOverrides(config);
    
    // Добавляем environment info
    config._environment = env;
    
    return config;
}

/**
 * Utility functions для debug логирования
 */
const DebugUtils = {
    /**
     * Создает безопасный preview токена
     */
    createTokenPreview(token) {
        if (!token || !DEBUG_CONFIG.ENABLE_SAFE_TOKEN_PREVIEW) {
            return null;
        }
        const length = DEBUG_CONFIG.TOKEN_PREVIEW_LENGTH;
        return `${token.substring(0, length)}...`;
    },
    
    /**
     * Форматирует timestamp для логов
     */
    formatTimestamp() {
        return new Date().toISOString();
    },
    
    /**
     * Создает уникальный ID для debug сессии
     */
    createSessionId() {
        return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    /**
     * Проверяет, должен ли логироваться определенный тип события
     */
    shouldLog(type, level = 'normal') {
        const config = window.DEBUG_CONFIG || DEBUG_CONFIG;
        
        if (!config) return false;
        
        // Проверяем общий уровень логирования
        const levels = ['minimal', 'normal', 'verbose'];
        const currentLevelIndex = levels.indexOf(config.LOG_LEVEL);
        const requiredLevelIndex = levels.indexOf(level);
        
        if (currentLevelIndex < requiredLevelIndex) {
            return false;
        }
        
        // Проверяем специфичные флаги
        switch (type) {
            case 'api': return config.ENABLE_API_DEBUG;
            case 'auth': return config.ENABLE_AUTH_DEBUG;
            case 'jwt': return config.ENABLE_JWT_DEBUG;
            case 'storage': return config.ENABLE_STORAGE_DEBUG;
            case 'sw': return config.ENABLE_SW_DEBUG;
            case 'request': return config.ENABLE_REQUEST_DEBUGGING;
            case 'response': return config.ENABLE_RESPONSE_DEBUGGING;
            case 'headers': return config.ENABLE_HEADERS_DEBUGGING;
            case 'token': return config.ENABLE_TOKEN_DEBUGGING;
            case 'telegram': return config.ENABLE_TELEGRAM_DEBUGGING;
            case 'timing': return config.ENABLE_TIMING_DEBUG;
            case 'network': return config.ENABLE_NETWORK_DEBUG;
            default: return true;
        }
    },
    
    /**
     * Универсальная функция debug логирования
     */
    log(type, emoji, message, data = {}) {
        if (!this.shouldLog(type)) return;
        
        const timestamp = this.formatTimestamp();
        const logData = {
            timestamp,
            type,
            message,
            ...data
        };
        
        console.log(`${emoji} [${type.toUpperCase()} DEBUG]`, logData);
        
        // Опционально отправляем на сервер
        if (window.DEBUG_CONFIG?.SEND_TO_SERVER && window.ApiService) {
            // Здесь можно добавить отправку на сервер для централизованного логирования
        }
    }
};

// Инициализируем конфигурацию
const FINAL_DEBUG_CONFIG = getEnvironmentAwareConfig();

// Экспортируем в глобальную область
window.DEBUG_CONFIG = FINAL_DEBUG_CONFIG;
window.DebugUtils = DebugUtils;

// Логируем инициализацию debug системы
if (FINAL_DEBUG_CONFIG.ENABLE_API_DEBUG) {
    console.log('🔍 [DEBUG CONFIG INITIALIZED]', {
        timestamp: DebugUtils.formatTimestamp(),
        environment: FINAL_DEBUG_CONFIG._environment,
        config: Object.keys(FINAL_DEBUG_CONFIG).filter(key => key.startsWith('ENABLE_')),
        logLevel: FINAL_DEBUG_CONFIG.LOG_LEVEL,
        telegramWebApp: !!window.Telegram?.WebApp
    });
}

// Модульный экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEBUG_CONFIG: FINAL_DEBUG_CONFIG,
        DebugUtils,
        getEnvironmentConfig,
        getEnvironmentAwareConfig
    };
}