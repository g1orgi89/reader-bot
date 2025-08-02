const DebugLog = require('../models/DebugLog');

/**
 * Сервис для работы с debug логами iOS навигации
 */
class DebugService {
    constructor() {
        this.activeSessions = new Map(); // sessionId -> { startTime, userId, logCount }
    }

    /**
     * Инициализация новой debug сессии
     * @param {string} userId - ID пользователя Telegram
     * @param {Object} deviceInfo - Информация об устройстве
     * @param {Object} telegramInfo - Информация о Telegram WebApp
     * @returns {string} sessionId
     */
    startSession(userId, deviceInfo = {}, telegramInfo = {}) {
        const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.activeSessions.set(sessionId, {
            startTime: Date.now(),
            userId,
            logCount: 0,
            deviceInfo,
            telegramInfo
        });

        console.log(`🔍 Debug сессия начата: ${sessionId} для пользователя ${userId}`);
        
        // Логируем начало сессии
        this.log(sessionId, 'INIT', 'DEBUG', 'Debug session started', {
            deviceInfo,
            telegramInfo,
            sessionId
        });

        return sessionId;
    }

    /**
     * Создание debug лога
     * @param {string} sessionId - ID сессии
     * @param {string} category - Категория лога
     * @param {string} level - Уровень важности
     * @param {string} message - Сообщение
     * @param {Object} data - Дополнительные данные
     * @param {Object} context - Контекст (viewport, navigation state, etc.)
     * @returns {Promise<void>}
     */
    async log(sessionId, category, level, message, data = {}, context = {}) {
        try {
            const session = this.activesessions.get(sessionId);
            if (!session) {
                console.warn(`⚠️ Попытка логирования в несуществующую сессию: ${sessionId}`);
                return;
            }

            const timestamp = Date.now() - session.startTime;
            session.logCount++;

            const logData = {
                userId: session.userId,
                sessionId,
                category,
                level,
                message,
                data,
                deviceInfo: session.deviceInfo,
                telegramInfo: session.telegramInfo,
                timestamp,
                ...context
            };

            // Сохраняем в MongoDB асинхронно
            setImmediate(async () => {
                try {
                    await DebugLog.createLog(logData);
                } catch (error) {
                    console.error('❌ Ошибка сохранения debug лога:', error);
                }
            });

            // Выводим в консоль с цветами
            this._consoleLog(category, level, message, data, timestamp);

            // Если критическая ошибка навигации - немедленно уведомляем
            if (level === 'CRITICAL' && category === 'NAVIGATION') {
                await this._notifyCriticalNavigationError(sessionId, message, data);
            }

        } catch (error) {
            console.error('❌ Ошибка в DebugService.log:', error);
        }
    }

    /**
     * Консольный вывод с цветами
     * @private
     */
    _consoleLog(category, level, message, data, timestamp) {
        const colors = {
            DEBUG: '\x1b[36m',     // cyan
            INFO: '\x1b[32m',      // green  
            WARNING: '\x1b[33m',   // yellow
            ERROR: '\x1b[31m',     // red
            CRITICAL: '\x1b[35m'   // magenta
        };

        const categoryColors = {
            INIT: '\x1b[42m',          // green background
            TELEGRAM: '\x1b[44m',      // blue background
            NAVIGATION: '\x1b[43m',    // yellow background
            VIEWPORT: '\x1b[45m',      // magenta background
            CSS: '\x1b[41m',           // red background
            DOM: '\x1b[46m',           // cyan background
            SCROLL: '\x1b[47m\x1b[30m' // white background, black text
        };

        const reset = '\x1b[0m';
        const bold = '\x1b[1m';
        
        const levelColor = colors[level] || '\x1b[37m';
        const catColor = categoryColors[category] || '\x1b[40m';
        
        console.log(
            `${bold}[${timestamp}ms]${reset} ` +
            `${catColor} ${category} ${reset} ` +
            `${levelColor}${level}${reset}: ` +
            `${message}`,
            data && Object.keys(data).length > 0 ? data : ''
        );
    }

    /**
     * Уведомление о критической ошибке навигации
     * @private
     */
    async _notifyCriticalNavigationError(sessionId, message, data) {
        console.error(`🚨 КРИТИЧЕСКАЯ ОШИБКА НАВИГАЦИИ [${sessionId}]: ${message}`, data);
        
        // Здесь можно добавить отправку уведомлений в Telegram или Slack
        // await this.notificationService.sendCriticalAlert(sessionId, message, data);
    }

    /**
     * Получение статистики сессии
     * @param {string} sessionId - ID сессии
     * @returns {Promise<Object>} Статистика сессии
     */
    async getSessionStats(sessionId) {
        try {
            const [logs, stats, navigationErrors] = await Promise.all([
                DebugLog.getSessionLogs(sessionId),
                DebugLog.getSessionStats(sessionId),
                DebugLog.findNavigationErrors(sessionId)
            ]);

            const session = this.activeSession.get(sessionId);
            
            return {
                sessionId,
                isActive: !!session,
                duration: session ? Date.now() - session.startTime : null,
                totalLogs: logs.length,
                stats: stats.reduce((acc, stat) => {
                    const key = `${stat._id.category}_${stat._id.level}`;
                    acc[key] = stat.count;
                    return acc;
                }, {}),
                navigationErrors: navigationErrors.length,
                criticalErrors: logs.filter(log => log.level === 'CRITICAL').length,
                deviceInfo: session?.deviceInfo,
                telegramInfo: session?.telegramInfo
            };
        } catch (error) {
            console.error('❌ Ошибка получения статистики сессии:', error);
            throw error;
        }
    }

    /**
     * Получение детального анализа навигации
     * @param {string} sessionId - ID сессии
     * @returns {Promise<Object>} Анализ навигации
     */
    async getNavigationAnalysis(sessionId) {
        try {
            const sequence = await DebugLog.getNavigationSequence(sessionId);
            const errors = await DebugLog.findNavigationErrors(sessionId);
            
            // Анализируем последовательность событий
            const analysis = {
                sessionId,
                totalEvents: sequence.length,
                errors: errors.length,
                timeline: sequence.map(log => ({
                    timestamp: log.timestamp,
                    category: log.category,
                    level: log.level,
                    message: log.message,
                    navigationState: log.navigationState,
                    viewport: log.viewport
                })),
                patterns: this._analyzePatterns(sequence),
                recommendations: this._generateRecommendations(sequence, errors)
            };

            return analysis;
        } catch (error) {
            console.error('❌ Ошибка анализа навигации:', error);
            throw error;
        }
    }

    /**
     * Анализ паттернов в логах
     * @private
     */
    _analyzePatterns(sequence) {
        const patterns = {
            scrollBeforeNavigationIssue: [],
            viewportChangesBeforeError: [],
            telegramEventsCorrelation: [],
            cssTransformConflicts: []
        };

        for (let i = 1; i < sequence.length; i++) {
            const current = sequence[i];
            const previous = sequence[i - 1];
            
            // Паттерн: Скролл -> Проблема с навигацией
            if (previous.category === 'SCROLL' && 
                current.category === 'NAVIGATION' && 
                current.level === 'ERROR') {
                patterns.scrollBeforeNavigationIssue.push({
                    scrollTime: previous.timestamp,
                    errorTime: current.timestamp,
                    delay: current.timestamp - previous.timestamp
                });
            }

            // Паттерн: Изменение viewport -> Ошибка
            if (previous.category === 'VIEWPORT' && 
                current.level === 'ERROR') {
                patterns.viewportChangesBeforeError.push({
                    viewportTime: previous.timestamp,
                    errorTime: current.timestamp,
                    delay: current.timestamp - previous.timestamp
                });
            }

            // Паттерн: События Telegram -> Проблемы
            if (previous.category === 'TELEGRAM' && 
                (current.category === 'NAVIGATION' || current.category === 'VIEWPORT') &&
                current.level !== 'DEBUG') {
                patterns.telegramEventsCorrelation.push({
                    telegramEvent: previous.message,
                    issueEvent: current.message,
                    delay: current.timestamp - previous.timestamp
                });
            }
        }

        return patterns;
    }

    /**
     * Генерация рекомендаций на основе анализа
     * @private
     */
    _generateRecommendations(sequence, errors) {
        const recommendations = [];

        // Анализируем частые ошибки
        const errorCategories = errors.reduce((acc, error) => {
            acc[error.category] = (acc[error.category] || 0) + 1;
            return acc;
        }, {});

        if (errorCategories.NAVIGATION > 5) {
            recommendations.push({
                priority: 'HIGH',
                type: 'NAVIGATION_STABILITY',
                message: 'Частые ошибки навигации - требуется усиление CSS фиксов',
                action: 'Применить более жесткие position: fixed правила'
            });
        }

        if (errorCategories.VIEWPORT > 3) {
            recommendations.push({
                priority: 'MEDIUM',
                type: 'VIEWPORT_HANDLING',
                message: 'Проблемы с viewport - рекомендуется блокировка Telegram событий',
                action: 'Переопределить Telegram.WebApp.onEvent для viewportChanged'
            });
        }

        // Проверяем Telegram события
        const telegramEvents = sequence.filter(log => log.category === 'TELEGRAM');
        if (telegramEvents.length > 10) {
            recommendations.push({
                priority: 'LOW',
                type: 'TELEGRAM_OPTIMIZATION',
                message: 'Много событий Telegram - возможна избыточная активность',
                action: 'Оптимизировать обработку Telegram событий'
            });
        }

        return recommendations;
    }

    /**
     * Завершение debug сессии
     * @param {string} sessionId - ID сессии
     * @returns {Promise<Object>} Финальная статистика
     */
    async endSession(sessionId) {
        try {
            const finalStats = await this.getSessionStats(sessionId);
            
            await this.log(sessionId, 'INIT', 'INFO', 'Debug session ended', {
                finalStats,
                duration: finalStats.duration
            });

            this.activeSession.delete(sessionId);
            
            console.log(`✅ Debug сессия завершена: ${sessionId}`);
            
            return finalStats;
        } catch (error) {
            console.error('❌ Ошибка завершения debug сессии:', error);
            throw error;
        }
    }

    /**
     * Очистка старых сессий (вызывается по расписанию)
     */
    cleanupOldSessions() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 минут

        for (const [sessionId, session] of this.activeSession.entries()) {
            if (now - session.startTime > maxAge) {
                this.activeSession.delete(sessionId);
                console.log(`🧹 Удалена старая debug сессия: ${sessionId}`);
            }
        }
    }

    /**
     * Получение активных сессий
     * @returns {Array} Список активных сессий
     */
    getActiveSessions() {
        return Array.from(this.activeSession.entries()).map(([sessionId, session]) => ({
            sessionId,
            userId: session.userId,
            startTime: session.startTime,
            duration: Date.now() - session.startTime,
            logCount: session.logCount,
            isIOS: session.deviceInfo?.isIOS || false
        }));
    }
}

module.exports = new DebugService();