const express = require('express');
const router = express.Router();

// Простая в памяти база данных для тестирования
const sessions = new Map();
const logs = [];

/**
 * @route POST /api/debug/start-session
 * @description Начать новую debug сессию (упрощенная версия)
 */
router.post('/start-session', async (req, res) => {
    try {
        const { userId, deviceInfo, telegramInfo } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: 'userId is required'
            });
        }

        const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Сохраняем сессию в памяти
        sessions.set(sessionId, {
            userId,
            deviceInfo: deviceInfo || {},
            telegramInfo: telegramInfo || {},
            startTime: Date.now(),
            logCount: 0
        });
        
        console.log(`🔍 Debug session started: ${sessionId} for user ${userId}`);
        console.log('📱 Device info:', deviceInfo);
        console.log('📱 Telegram info:', telegramInfo);
        
        res.json({
            success: true,
            sessionId,
            message: 'Debug session started successfully'
        });

    } catch (error) {
        console.error('❌ Error starting debug session:', error);
        res.status(500).json({
            error: 'Failed to start debug session',
            details: error.message
        });
    }
});

/**
 * @route POST /api/debug/log
 * @description Отправить debug лог (упрощенная версия)
 */
router.post('/log', async (req, res) => {
    try {
        const { sessionId, category, level, message, data, context } = req.body;
        
        if (!sessionId || !category || !level || !message) {
            return res.status(400).json({
                error: 'sessionId, category, level, and message are required'
            });
        }

        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(404).json({
                error: 'Session not found'
            });
        }

        // Создаем лог
        const logEntry = {
            sessionId,
            category,
            level,
            message,
            data: data || {},
            context: context || {},
            timestamp: Date.now() - session.startTime,
            createdAt: new Date()
        };

        logs.push(logEntry);
        session.logCount++;

        console.log(`📝 Debug log [${sessionId}] ${category}/${level}: ${message}`);
        if (data && Object.keys(data).length > 0) {
            console.log('   Data:', data);
        }
        if (context && Object.keys(context).length > 0) {
            console.log('   Context:', context);
        }

        res.json({
            success: true,
            message: 'Log recorded successfully'
        });

    } catch (error) {
        console.error('❌ Error recording log:', error);
        res.status(500).json({
            error: 'Failed to record log',
            details: error.message
        });
    }
});

/**
 * @route POST /api/debug/batch-log
 * @description Отправить множественные debug логи (упрощенная версия)
 */
router.post('/batch-log', async (req, res) => {
    try {
        const { sessionId, logs: batchLogs } = req.body;
        
        if (!sessionId || !Array.isArray(batchLogs)) {
            return res.status(400).json({
                error: 'sessionId and logs array are required'
            });
        }

        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(404).json({
                error: 'Session not found'
            });
        }

        const results = [];
        
        for (const log of batchLogs) {
            try {
                const logEntry = {
                    sessionId,
                    category: log.category,
                    level: log.level,
                    message: log.message,
                    data: log.data || {},
                    context: log.context || {},
                    timestamp: log.timestamp || (Date.now() - session.startTime),
                    createdAt: new Date()
                };

                logs.push(logEntry);
                session.logCount++;
                results.push({ success: true });

                console.log(`📝 Batch log [${sessionId}] ${log.category}/${log.level}: ${log.message}`);
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
        console.error('❌ Error processing batch logs:', error);
        res.status(500).json({
            error: 'Failed to process batch logs',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/session/:sessionId/stats
 * @description Получить статистику debug сессии (упрощенная версия)
 */
router.get('/session/:sessionId/stats', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(404).json({
                error: 'Session not found'
            });
        }

        const sessionLogs = logs.filter(log => log.sessionId === sessionId);
        
        // Группируем по категориям и уровням
        const stats = sessionLogs.reduce((acc, log) => {
            const key = `${log.category}_${log.level}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const response = {
            sessionId,
            isActive: true,
            duration: Date.now() - session.startTime,
            totalLogs: sessionLogs.length,
            stats,
            navigationErrors: sessionLogs.filter(log => 
                log.category === 'NAVIGATION' && ['ERROR', 'CRITICAL'].includes(log.level)
            ).length,
            criticalErrors: sessionLogs.filter(log => log.level === 'CRITICAL').length,
            deviceInfo: session.deviceInfo,
            telegramInfo: session.telegramInfo
        };

        res.json({
            success: true,
            stats: response
        });

    } catch (error) {
        console.error('❌ Error getting session stats:', error);
        res.status(500).json({
            error: 'Failed to get session stats',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/session/:sessionId/logs
 * @description Получить все логи сессии (упрощенная версия)
 */
router.get('/session/:sessionId/logs', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { category, level, limit = 1000 } = req.query;
        
        let sessionLogs = logs.filter(log => log.sessionId === sessionId);
        
        // Применяем фильтры
        if (category) {
            sessionLogs = sessionLogs.filter(log => log.category === category);
        }
        if (level) {
            sessionLogs = sessionLogs.filter(log => log.level === level);
        }
        
        // Сортируем по timestamp
        sessionLogs.sort((a, b) => a.timestamp - b.timestamp);
        
        res.json({
            success: true,
            sessionId,
            total: sessionLogs.length,
            logs: sessionLogs.slice(0, parseInt(limit))
        });

    } catch (error) {
        console.error('❌ Error getting session logs:', error);
        res.status(500).json({
            error: 'Failed to get session logs',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/sessions/active
 * @description Получить список активных debug сессий (упрощенная версия)
 */
router.get('/sessions/active', async (req, res) => {
    try {
        const activeSessions = Array.from(sessions.entries()).map(([sessionId, session]) => ({
            sessionId,
            userId: session.userId,
            startTime: session.startTime,
            duration: Date.now() - session.startTime,
            logCount: session.logCount,
            isIOS: session.deviceInfo?.isIOS || false
        }));
        
        res.json({
            success: true,
            count: activeSessions.length,
            sessions: activeSessions
        });

    } catch (error) {
        console.error('❌ Error getting active sessions:', error);
        res.status(500).json({
            error: 'Failed to get active sessions',
            details: error.message
        });
    }
});

/**
 * @route POST /api/debug/session/:sessionId/end
 * @description Завершить debug сессию (упрощенная версия)
 */
router.post('/session/:sessionId/end', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(404).json({
                error: 'Session not found'
            });
        }

        const finalStats = {
            sessionId,
            duration: Date.now() - session.startTime,
            totalLogs: session.logCount
        };

        sessions.delete(sessionId);
        
        console.log(`✅ Debug session ended: ${sessionId}`, finalStats);
        
        res.json({
            success: true,
            message: 'Debug session ended successfully',
            finalStats
        });

    } catch (error) {
        console.error('❌ Error ending debug session:', error);
        res.status(500).json({
            error: 'Failed to end debug session',
            details: error.message
        });
    }
});

/**
 * @route GET /api/debug/health
 * @description Health check для debug API
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Debug API is working (simplified version)',
        timestamp: new Date().toISOString(),
        stats: {
            activeSessions: sessions.size,
            totalLogs: logs.length
        }
    });
});

/**
 * @route GET /api/debug/ios-issues
 * @description Получить iOS проблемы (упрощенная версия)
 */
router.get('/ios-issues', async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const sinceTime = Date.now() - (hours * 60 * 60 * 1000);
        
        const iosIssues = logs.filter(log => {
            const session = sessions.get(log.sessionId);
            return log.createdAt.getTime() > sinceTime &&
                   session?.deviceInfo?.isIOS &&
                   (log.category === 'NAVIGATION' || log.category === 'VIEWPORT') &&
                   ['ERROR', 'CRITICAL'].includes(log.level);
        });

        res.json({
            success: true,
            period: `${hours} hours`,
            issuesFound: iosIssues.length,
            issues: iosIssues
        });

    } catch (error) {
        console.error('❌ Error getting iOS issues:', error);
        res.status(500).json({
            error: 'Failed to get iOS issues',
            details: error.message
        });
    }
});

module.exports = router;