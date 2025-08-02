/**
 * 🔍 DEBUG API для диагностики проблем Telegram Mini App
 * 
 * Собирает данные о viewport проблемах, логирует их в БД
 * и предоставляет аналитику для исправления багов
 * 
 * @filesize ~8KB
 * @version 1.0.1
 */

const express = require('express');
const router = express.Router();
const ViewportLog = require('../models/ViewportLog');
const logger = require('../utils/logger');

/**
 * @typedef {import('../types').ShroomsError} ShroomsError
 */

/**
 * 📱 POST /api/debug/viewport - Логирование viewport проблем
 * 
 * Принимает данные о viewport с клиента и сохраняет в БД для анализа
 * Помогает диагностировать проблемы с пустым местом снизу в Mini App
 */
router.post('/viewport', async (req, res) => {
  try {
    const {
      sessionId,
      page,
      url,
      viewport,
      device,
      telegram,
      problem,
      debugMode = false,
      cssVariables,
      notes
    } = req.body;

    // 🔍 Валидация обязательных полей
    if (!sessionId || !page || !viewport || !device || !problem) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['sessionId', 'page', 'viewport', 'device', 'problem']
      });
    }

    // 📊 Логируем получение данных
    logger.info('🔍 [DEBUG] Viewport issue reported:', {
      sessionId: sessionId.substring(0, 8),
      page,
      platform: device.platform,
      problemType: problem.type,
      difference: viewport.difference,
      userAgent: device.userAgent.substring(0, 50) + '...'
    });

    // 🛠️ Анализируем проблему и определяем тип
    const problemType = determineProblemType(viewport, problem);
    const severity = determineSeverity(viewport.difference);

    // 🔧 ИСПРАВЛЕНО: Рассчитываем обязательные поля перед сохранением
    const bottomNavHeight = viewport.bottomNavHeight || 64;
    const headerHeight = viewport.headerHeight || 56;
    const totalSubtracted = bottomNavHeight + headerHeight + 40; // padding
    const availableHeight = viewport.innerHeight - totalSubtracted;

    // 💾 Создаем запись в БД
    const viewportLog = new ViewportLog({
      sessionId,
      page,
      url: url || `/mini-app/${page}`,
      viewport: {
        innerHeight: viewport.innerHeight,
        innerWidth: viewport.innerWidth,
        telegramHeight: viewport.telegramHeight,
        telegramStableHeight: viewport.telegramStableHeight,
        telegramExpanded: viewport.telegramExpanded,
        calculatedContentHeight: viewport.calculatedContentHeight,
        actualContentHeight: viewport.actualContentHeight,
        bottomNavHeight: bottomNavHeight,
        headerHeight: headerHeight,
        // 🔧 ИСПРАВЛЕНО: Добавляем обязательные поля
        totalSubtracted: totalSubtracted,
        availableHeight: availableHeight,
        difference: viewport.difference,
        safeBounds: viewport.safeBounds || { top: 0, bottom: 0, left: 0, right: 0 }
      },
      device: {
        userAgent: device.userAgent,
        platform: device.platform || detectPlatform(device.userAgent),
        browser: device.browser || detectBrowser(device.userAgent),
        devicePixelRatio: device.devicePixelRatio || 1,
        orientation: device.orientation || 'portrait',
        screen: device.screen
      },
      telegram: {
        isAvailable: telegram?.isAvailable || false,
        version: telegram?.version,
        platform: telegram?.platform,
        colorScheme: telegram?.colorScheme,
        isVerticalSwipesEnabled: telegram?.isVerticalSwipesEnabled,
        headerColor: telegram?.headerColor,
        backgroundColor: telegram?.backgroundColor
      },
      problem: {
        type: problemType,
        severity: severity,
        description: problem.description || generateProblemDescription(viewport, problemType),
        scrollTop: problem.scrollTop || 0,
        scrollHeight: problem.scrollHeight || 0,
        clientHeight: problem.clientHeight || 0
      },
      debugMode,
      cssVariables: cssVariables || {},
      notes
    });

    // 💾 Сохраняем в БД
    await viewportLog.save();

    // 📊 Логируем успешное сохранение
    logger.info('✅ [DEBUG] Viewport log saved:', {
      id: viewportLog._id,
      sessionId: sessionId.substring(0, 8),
      problemType,
      severity,
      difference: viewport.difference
    });

    // 🚨 Если проблема серьезная - логируем с повышенным приоритетом
    if (severity === 'severe') {
      logger.warn('🚨 [DEBUG] SEVERE viewport issue detected:', {
        platform: device.platform,
        page,
        difference: viewport.difference,
        userAgent: device.userAgent
      });
    }

    // ✅ Возвращаем успешный ответ
    res.json({
      success: true,
      message: 'Viewport data logged successfully',
      logId: viewportLog._id,
      analysis: {
        problemType,
        severity,
        recommendation: getRecommendation(problemType, viewport)
      }
    });

  } catch (error) {
    logger.error('❌ [DEBUG] Failed to log viewport data:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Failed to log viewport data',
      details: error.message
    });
  }
});

/**
 * 📊 GET /api/debug/viewport/stats - Статистика viewport проблем
 * 
 * Возвращает аналитику по собранным данным viewport
 */
router.get('/viewport/stats', async (req, res) => {
  try {
    const { platform, page, limit = 100, days = 7 } = req.query;

    // 📅 Фильтр по дате
    const dateFilter = {
      timestamp: {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      }
    };

    // 🔍 Дополнительные фильтры
    const filters = { ...dateFilter };
    if (platform) filters['device.platform'] = platform;
    if (page) filters.page = page;

    // 📊 Получаем статистику
    const [
      totalLogs,
      problemsByType,
      problemsByPlatform,
      problemsByPage,
      recentProblems,
      averageMetrics
    ] = await Promise.all([
      ViewportLog.countDocuments(filters),
      
      ViewportLog.aggregate([
        { $match: filters },
        { $group: { _id: '$problem.type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      ViewportLog.aggregate([
        { $match: filters },
        { $group: { _id: '$device.platform', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      ViewportLog.aggregate([
        { $match: filters },
        { $group: { _id: '$page', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      ViewportLog.find(filters)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .select('page device.platform problem.type viewport.difference timestamp')
        .lean(),
        
      ViewportLog.aggregate([
        { $match: filters },
        {
          $group: {
            _id: null,
            avgDifference: { $avg: '$viewport.difference' },
            avgInnerHeight: { $avg: '$viewport.innerHeight' },
            avgTelegramHeight: { $avg: '$viewport.telegramHeight' },
            avgBottomNavHeight: { $avg: '$viewport.bottomNavHeight' },
            avgHeaderHeight: { $avg: '$viewport.headerHeight' }
          }
        }
      ])
    ]);

    // 📈 Формируем ответ
    const stats = {
      summary: {
        totalLogs,
        period: `${days} days`,
        platforms: problemsByPlatform.length,
        pages: problemsByPage.length
      },
      problems: {
        byType: problemsByType,
        byPlatform: problemsByPlatform,
        byPage: problemsByPage
      },
      metrics: averageMetrics[0] || {},
      recent: recentProblems
    };

    logger.info('📊 [DEBUG] Stats requested:', {
      platform,
      page,
      totalLogs,
      days
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('❌ [DEBUG] Failed to get viewport stats:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get viewport statistics',
      details: error.message
    });
  }
});

/**
 * 🔍 GET /api/debug/viewport/analysis - Детальный анализ проблем
 * 
 * Возвращает детальный анализ конкретной проблемы или типа проблем
 */
router.get('/viewport/analysis', async (req, res) => {
  try {
    const { logId, problemType, platform } = req.query;

    let analysisData;

    if (logId) {
      // Анализ конкретной записи
      analysisData = await ViewportLog.findById(logId).lean();
      if (!analysisData) {
        return res.status(404).json({
          success: false,
          error: 'Viewport log not found'
        });
      }
    } else {
      // Анализ по типу проблемы или платформе
      const filters = {};
      if (problemType) filters['problem.type'] = problemType;
      if (platform) filters['device.platform'] = platform;

      analysisData = await ViewportLog.aggregate([
        { $match: filters },
        {
          $group: {
            _id: {
              platform: '$device.platform',
              page: '$page',
              problemType: '$problem.type'
            },
            count: { $sum: 1 },
            avgDifference: { $avg: '$viewport.difference' },
            minDifference: { $min: '$viewport.difference' },
            maxDifference: { $max: '$viewport.difference' },
            avgInnerHeight: { $avg: '$viewport.innerHeight' },
            avgTelegramHeight: { $avg: '$viewport.telegramHeight' },
            samples: { $push: '$$ROOT' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]);
    }

    res.json({
      success: true,
      data: analysisData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [DEBUG] Failed to get viewport analysis:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get viewport analysis',
      details: error.message
    });
  }
});

/**
 * 🗑️ DELETE /api/debug/viewport/clear - Очистка старых логов
 * 
 * Удаляет старые записи viewport логов для экономии места
 */
router.delete('/viewport/clear', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await ViewportLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    logger.info('🗑️ [DEBUG] Viewport logs cleaned:', {
      deletedCount: result.deletedCount,
      cutoffDate,
      days
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} old viewport logs`,
      deletedCount: result.deletedCount,
      cutoffDate
    });

  } catch (error) {
    logger.error('❌ [DEBUG] Failed to clear viewport logs:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear viewport logs',
      details: error.message
    });
  }
});

// ===========================================
// 🛠️ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ===========================================

/**
 * Определить тип проблемы viewport
 */
function determineProblemType(viewport, problem) {
  const diff = viewport.difference;
  
  if (problem.type) return problem.type;
  
  if (diff > 10) return 'empty_space_bottom';
  if (diff < -10) return 'content_overflow';
  if (Math.abs(diff) < 10) return 'height_mismatch';
  
  return 'scroll_issue';
}

/**
 * Определить серьезность проблемы
 */
function determineSeverity(difference) {
  const abs = Math.abs(difference);
  
  if (abs < 10) return 'minor';
  if (abs < 50) return 'moderate';
  return 'severe';
}

/**
 * Определить платформу по User Agent
 */
function detectPlatform(userAgent) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/Windows|Mac|Linux/i.test(userAgent)) return 'Desktop';
  return 'Unknown';
}

/**
 * Определить браузер по User Agent
 */
function detectBrowser(userAgent) {
  if (/TelegramWebApp/i.test(userAgent)) return 'Telegram';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Safari/i.test(userAgent)) return 'Safari';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  return 'Unknown';
}

/**
 * Сгенерировать описание проблемы
 */
function generateProblemDescription(viewport, problemType) {
  const diff = viewport.difference;
  
  switch (problemType) {
    case 'empty_space_bottom':
      return `Empty space at bottom: ${diff}px gap between content and navigation`;
    case 'content_overflow':
      return `Content overflow: ${Math.abs(diff)}px content hidden below viewport`;
    case 'height_mismatch':
      return `Height calculation mismatch: ${diff}px difference in expected vs actual`;
    case 'scroll_issue':
      return `Scroll behavior issue with ${diff}px viewport difference`;
    default:
      return `Viewport issue: ${diff}px difference detected`;
  }
}

/**
 * Получить рекомендацию по исправлению
 */
function getRecommendation(problemType, viewport) {
  switch (problemType) {
    case 'empty_space_bottom':
      return 'Consider reducing bottom padding or adjusting content height calculation';
    case 'content_overflow':
      return 'Increase content container height or enable scrolling';
    case 'height_mismatch':
      return 'Review CSS calc() formulas and Telegram viewport integration';
    case 'scroll_issue':
      return 'Check scroll container configuration and overflow settings';
    default:
      return 'Review viewport height calculation logic';
  }
}

module.exports = router;