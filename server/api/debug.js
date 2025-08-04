const express = require('express');
const router = express.Router();
const debugService = require('../services/debugService');
const DebugLog = require('../models/DebugLog');

/**
 * @route POST /api/debug/start-session
 * @description Начать новую debug сессию
 * @access Public (для Mini App)
 */
router.post('/start-session', async (req, res) => {
    try {
        const { userId, deviceInfo, telegramInfo } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: 'userId is required'
            });
        }

        const sessionId = debugService.startSession(userId, deviceInfo, telegramInfo);
        
        res.json({
            success: true,
            sessionId,
            message: 'Debug session started successfully'
        });

    } catch (error) {
        console.error('❌ Ошибка старта debug сессии:', error);
        res.status(500).json({
            error: 'Failed to start debug session',
            details: error.message
        });
    }
});

/**
 * @route POST /api/debug/log
 * @description Отправить debug лог
 * @access Public (для Mini App)
 */
router.post('/log', async (req, res) => {
    try {
        const { sessionId, category, level, message, data, context } = req.body;
        
        if (!sessionId || !category || !level || !message) {
            return res.status(400).json({
                error: 'sessionId, category, level, and message are required'
            });
        }

        await debugService.log(sessionId, category, level, message, data, context);
        
        res.json({
            success: true,
            message: 'Log recorded successfully'
        });

    } catch (error) {
        console.error('❌ Ошибка записи debug лога:', error);
        res.status(500).json({
            error: 'Failed to record log',
            details: error.message
        });
    }
});

/**
 * @route POST /api/debug/batch-log
 * @description Отправить множественные debug логи одним запросом
 * @access Public (для Mini App)
 */
router.post('/batch-log', async (req, res) => {
    try {
        const { sessionId, logs } = req.body;
        
        if (!sessionId || !Array.isArray(logs)) {
            return res.status(400).json({
                error: 'sessionId and logs array are required'
            });
        }

        const results = [];
        
        for (const log of logs) {
            try {
                await debugService.log(
                    sessionId,
                    log.category,
                    log.level,
                    log.message,
                    log.data,
                    log.context
                );
                results.push({ success: true });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }

        res.json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('❌ Ошибка batch записи debug логов:', error);
        res.status(500).json({
            error: 'Failed to process batch logs',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/session/:sessionId/stats
 * @description Получить статистику debug сессии
 * @access Private (для админов)
 */
router.get('/session/:sessionId/stats', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const stats = await debugService.getSessionStats(sessionId);
        
        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('❌ Ошибка получения статистики сессии:', error);
        res.status(500).json({
            error: 'Failed to get session stats',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/session/:sessionId/analysis
 * @description Получить детальный анализ навигации
 * @access Private (для админов)
 */
router.get('/session/:sessionId/analysis', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const analysis = await debugService.getNavigationAnalysis(sessionId);
        
        res.json({
            success: true,
            analysis
        });

    } catch (error) {
        console.error('❌ Ошибка анализа сессии:', error);
        res.status(500).json({
            error: 'Failed to analyze session',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/session/:sessionId/logs
 * @description Получить все логи сессии
 * @access Private (для админов)
 */
router.get('/session/:sessionId/logs', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { category, level, limit = 1000 } = req.query;
        
        const filters = {};
        if (category) filters.category = category;
        if (level) filters.level = level;
        
        const logs = await DebugLog.getSessionLogs(sessionId, filters);
        
        res.json({
            success: true,
            sessionId,
            total: logs.length,
            logs: logs.slice(0, parseInt(limit))
        });

    } catch (error) {
        console.error('❌ Ошибка получения логов сессии:', error);
        res.status(500).json({
            error: 'Failed to get session logs',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/sessions/active
 * @description Получить список активных debug сессий
 * @access Private (для админов)
 */
router.get('/sessions/active', async (req, res) => {
    try {
        const activeSessions = debugService.getActiveSessions();
        
        res.json({
            success: true,
            count: activeSessions.length,
            sessions: activeSessions
        });

    } catch (error) {
        console.error('❌ Ошибка получения активных сессий:', error);
        res.status(500).json({
            error: 'Failed to get active sessions',
            details: error.message
        });
    }
});

/**
 * @route POST /api/debug/session/:sessionId/end
 * @description Завершить debug сессию
 * @access Public (для Mini App)
 */
router.post('/session/:sessionId/end', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const finalStats = await debugService.endSession(sessionId);
        
        res.json({
            success: true,
            message: 'Debug session ended successfully',
            finalStats
        });

    } catch (error) {
        console.error('❌ Ошибка завершения debug сессии:', error);
        res.status(500).json({
            error: 'Failed to end debug session',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/ios-issues
 * @description Получить сводку iOS проблем навигации
 * @access Private (для админов)
 */
router.get('/ios-issues', async (req, res) => {
    try {
        const { hours = 24, limit = 100 } = req.query;
        
        const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);
        
        // Ищем iOS сессии с ошибками навигации
        const iosIssues = await DebugLog.aggregate([
            {
                $match: {
                    createdAt: { $gte: sinceDate },
                    'deviceInfo.isIOS': true,
                    $or: [
                        { category: 'NAVIGATION', level: { $in: ['ERROR', 'CRITICAL'] } },
                        { category: 'VIEWPORT', level: { $in: ['ERROR', 'CRITICAL'] } }
                    ]
                }
            },
            {
                $group: {
                    _id: '$sessionId',
                    userId: { $first: '$userId' },
                    deviceInfo: { $first: '$deviceInfo' },
                    errorCount: { $sum: 1 },
                    firstError: { $min: '$createdAt' },
                    lastError: { $max: '$createdAt' },
                    categories: { $addToSet: '$category' },
                    messages: { $push: '$message' }
                }
            },
            { $sort: { errorCount: -1, lastError: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            success: true,
            period: `${hours} hours`,
            issuesFound: iosIssues.length,
            issues: iosIssues
        });

    } catch (error) {
        console.error('❌ Ошибка получения iOS проблем:', error);
        res.status(500).json({
            error: 'Failed to get iOS issues',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/reports/navigation-problems
 * @description Генерация отчета по проблемам навигации
 * @access Private (для админов)
 */
router.get('/reports/navigation-problems', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Статистика по устройствам
        const deviceStats = await DebugLog.aggregate([
            {
                $match: {
                    createdAt: { $gte: sinceDate },
                    category: 'NAVIGATION',
                    level: { $in: ['ERROR', 'CRITICAL'] }
                }
            },
            {
                $group: {
                    _id: {
                        isIOS: '$deviceInfo.isIOS',
                        iosVersion: '$deviceInfo.iosVersion',
                        deviceModel: '$deviceInfo.deviceModel'
                    },
                    errorCount: { $sum: 1 },
                    sessionCount: { $addToSet: '$sessionId' }
                }
            },
            {
                $project: {
                    device: '$_id',
                    errorCount: 1,
                    sessionCount: { $size: '$sessionCount' }
                }
            },
            { $sort: { errorCount: -1 } }
        ]);

        // Самые частые ошибки
        const topErrors = await DebugLog.aggregate([
            {
                $match: {
                    createdAt: { $gte: sinceDate },
                    category: 'NAVIGATION',
                    level: { $in: ['ERROR', 'CRITICAL'] }
                }
            },
            {
                $group: {
                    _id: '$message',
                    count: { $sum: 1 },
                    sessions: { $addToSet: '$sessionId' },
                    lastOccurrence: { $max: '$createdAt' }
                }
            },
            {
                $project: {
                    message: '$_id',
                    count: 1,
                    sessionCount: { $size: '$sessions' },
                    lastOccurrence: 1
                }
            },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);

        res.json({
            success: true,
            period: `${days} days`,
            report: {
                deviceStats,
                topErrors,
                summary: {
                    totalDeviceConfigs: deviceStats.length,
                    totalErrorTypes: topErrors.length,
                    totalSessions: deviceStats.reduce((sum, stat) => sum + stat.sessionCount, 0),
                    totalErrors: deviceStats.reduce((sum, stat) => sum + stat.errorCount, 0)
                }
            }
        });

    } catch (error) {
        console.error('❌ Ошибка генерации отчета:', error);
        res.status(500).json({
            error: 'Failed to generate navigation problems report',
            details: error.message
        });
    }
});

/**
 * @route DELETE /api/debug/cleanup
 * @description Очистка старых debug данных
 * @access Private (для админов)
 */
router.delete('/cleanup', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const beforeDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const result = await DebugLog.deleteMany({
            createdAt: { $lt: beforeDate }
        });
        
        // Очищаем активные сессии
        debugService.cleanupOldSessions();
        
        res.json({
            success: true,
            message: `Cleaned up debug data older than ${days} days`,
            deletedLogs: result.deletedCount
        });

    } catch (error) {
        console.error('❌ Ошибка очистки debug данных:', error);
        res.status(500).json({
            error: 'Failed to cleanup debug data',
            details: error.message
        });
    }
});

module.exports = router;