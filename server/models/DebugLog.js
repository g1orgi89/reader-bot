const mongoose = require('mongoose');

/**
 * @typedef {Object} DebugLogData
 * @property {string} userId - ID пользователя Telegram
 * @property {string} sessionId - ID сессии для группировки логов
 * @property {string} category - Категория лога (NAVIGATION, VIEWPORT, CSS, etc.)
 * @property {string} level - Уровень важности (INFO, WARNING, ERROR, CRITICAL)
 * @property {string} message - Сообщение лога
 * @property {Object} data - Дополнительные данные лога
 * @property {Object} deviceInfo - Информация об устройстве
 * @property {Object} telegramInfo - Информация о Telegram WebApp
 * @property {number} timestamp - Timestamp относительно начала сессии
 * @property {Date} createdAt - Дата создания лога
 * @property {string} userAgent - User Agent браузера
 * @property {Object} viewport - Информация о viewport
 * @property {Object} navigationState - Состояние навигации
 */

const DebugLogSchema = new mongoose.Schema({
    // Основная информация
    userId: {
        type: String,
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    
    // Категоризация
    category: {
        type: String,
        required: true,
        enum: [
            'INIT',           // Инициализация приложения
            'TELEGRAM',       // События Telegram WebApp
            'NAVIGATION',     // Поведение навигации
            'VIEWPORT',       // Изменения viewport
            'CSS',           // CSS стили и трансформации
            'DOM',           // Изменения DOM
            'SCROLL',        // События скролла
            'TOUCH',         // Touch события
            'ORIENTATION',   // Смена ориентации
            'KEYBOARD',      // Виртуальная клавиатура
            'ERROR',         // Ошибки
            'PERFORMANCE',   // Производительность
            'USER_ACTION'    // Действия пользователя
        ],
        index: true
    },
    
    level: {
        type: String,
        required: true,
        enum: ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        default: 'INFO',
        index: true
    },
    
    // Содержимое лога
    message: {
        type: String,
        required: true
    },
    
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Информация об устройстве
    deviceInfo: {
        userAgent: String,
        platform: String,
        isIOS: Boolean,
        iosVersion: String,
        deviceModel: String,
        screenWidth: Number,
        screenHeight: Number,
        pixelRatio: Number
    },
    
    // Telegram WebApp информация
    telegramInfo: {
        version: String,
        platform: String,
        isExpanded: Boolean,
        viewportHeight: Number,
        viewportStableHeight: Number,
        headerHeight: Number,
        safeAreaInset: {
            top: Number,
            bottom: Number,
            left: Number,
            right: Number
        },
        isVerticalSwipesEnabled: Boolean,
        themeParams: mongoose.Schema.Types.Mixed
    },
    
    // Viewport состояние
    viewport: {
        innerWidth: Number,
        innerHeight: Number,
        outerWidth: Number,
        outerHeight: Number,
        scrollX: Number,
        scrollY: Number,
        visualViewportHeight: Number,
        visualViewportWidth: Number,
        isKeyboardOpen: Boolean
    },
    
    // Состояние навигации
    navigationState: {
        position: String,           // computed position
        transform: String,          // computed transform
        bottom: String,            // computed bottom
        zIndex: String,            // computed z-index
        boundingRect: {
            top: Number,
            bottom: Number,
            left: Number,
            right: Number,
            width: Number,
            height: Number
        },
        isFixed: Boolean,
        isVisible: Boolean,
        hasIOSFixes: Boolean
    },
    
    // Временные метки
    timestamp: {
        type: Number,
        required: true  // Миллисекунды от начала сессии
    },
    
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    collection: 'debug_logs'
});

// Индексы для эффективного поиска
DebugLogSchema.index({ userId: 1, sessionId: 1, timestamp: 1 });
DebugLogSchema.index({ category: 1, level: 1, createdAt: -1 });
DebugLogSchema.index({ 'deviceInfo.isIOS': 1, category: 1 });
DebugLogSchema.index({ sessionId: 1, category: 'ERROR' });

// TTL индекс - удаляем логи старше 30 дней
DebugLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Методы модели
DebugLogSchema.statics = {
    /**
     * Создать debug лог
     * @param {DebugLogData} logData - Данные лога
     * @returns {Promise<Object>} Созданный лог
     */
    async createLog(logData) {
        const log = new this(logData);
        return await log.save();
    },
    
    /**
     * Получить логи сессии
     * @param {string} sessionId - ID сессии
     * @param {Object} filters - Фильтры
     * @returns {Promise<Array>} Логи сессии
     */
    async getSessionLogs(sessionId, filters = {}) {
        const query = { sessionId, ...filters };
        return await this.find(query).sort({ timestamp: 1 }).lean();
    },
    
    /**
     * Получить статистику логов по категориям
     * @param {string} sessionId - ID сессии
     * @returns {Promise<Array>} Статистика
     */
    async getSessionStats(sessionId) {
        return await this.aggregate([
            { $match: { sessionId } },
            {
                $group: {
                    _id: { category: '$category', level: '$level' },
                    count: { $sum: 1 },
                    firstTimestamp: { $min: '$timestamp' },
                    lastTimestamp: { $max: '$timestamp' }
                }
            },
            { $sort: { '_id.category': 1, '_id.level': 1 } }
        ]);
    },
    
    /**
     * Найти критические ошибки iOS навигации
     * @param {string} sessionId - ID сессии
     * @returns {Promise<Array>} Критические ошибки
     */
    async findNavigationErrors(sessionId) {
        return await this.find({
            sessionId,
            $or: [
                { category: 'NAVIGATION', level: { $in: ['ERROR', 'CRITICAL'] } },
                { category: 'VIEWPORT', level: { $in: ['ERROR', 'CRITICAL'] } },
                { message: { $regex: /navigation|viewport|position|transform/i } }
            ]
        }).sort({ timestamp: 1 }).lean();
    },
    
    /**
     * Получить последовательность событий навигации
     * @param {string} sessionId - ID сессии
     * @returns {Promise<Array>} События навигации
     */
    async getNavigationSequence(sessionId) {
        return await this.find({
            sessionId,
            category: { $in: ['NAVIGATION', 'VIEWPORT', 'SCROLL', 'TOUCH', 'TELEGRAM'] }
        }).sort({ timestamp: 1 }).lean();
    }
};

// Методы экземпляра
DebugLogSchema.methods = {
    /**
     * Форматировать лог для вывода
     * @returns {string} Отформатированный лог
     */
    format() {
        return `[${this.timestamp}ms] ${this.category}/${this.level}: ${this.message}`;
    }
};

module.exports = mongoose.model('DebugLog', DebugLogSchema);