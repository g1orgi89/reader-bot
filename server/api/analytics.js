/**
 * @fileoverview Полная реализация Analytics API для проекта "Читатель"
 * @description API endpoints для получения аналитики с реальными данными MongoDB
 * @version 3.0.0
 */

const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Статус успеха
 * @property {any} data - Данные ответа
 * @property {string} [error] - Сообщение об ошибке
 * @property {string} timestamp - Время ответа
 * @property {boolean} [fallbackMode] - Режим fallback данных
 */

/**
 * @typedef {Object} DashboardOverview
 * @property {number} totalUsers - Общее количество пользователей
 * @property {number} newUsers - Новые пользователи за период
 * @property {number} totalQuotes - Общее количество цитат
 * @property {number} avgQuotesPerUser - Среднее количество цитат на пользователя
 * @property {number} activeUsers - Активные пользователи
 * @property {number} promoUsage - Использование промокодов
 */

console.log('📊 Analytics API: Полная реализация загружена');

// ========================================
// ОСНОВНЫЕ ENDPOINTS
// ========================================

/**
 * Тестовый endpoint для проверки работоспособности
 * @route GET /api/analytics/test
 */
router.get('/test', (req, res) => {
  console.log('📊 TEST Analytics endpoint вызван');
  
  res.json({
    success: true,
    message: 'Analytics API работает с полной реализацией!',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    features: [
      'Реальные данные MongoDB',
      'Fallback режим',
      'UTM tracking', 
      'Promo code analytics',
      'Retention analysis',
      'Top content analysis'
    ]
  });
});

/**
 * Получение основной статистики дашборда
 * @route GET /api/analytics/dashboard
 * @param {string} [period=7d] - Период анализа (1d, 7d, 30d, 90d)
 * @returns {ApiResponse<DashboardStats>}
 */
router.get('/dashboard', async (req, res) => {
  try {
    console.log('📊 DASHBOARD endpoint: получение статистики дашборда');
    
    const { period = '7d' } = req.query;
    
    // Валидация периода
    const validPeriods = ['1d', '7d', '30d', '90d'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `Неверный период. Доступные: ${validPeriods.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    // Получение данных через сервис
    const dashboardStats = await analyticsService.getDashboardStats(period);
    
    console.log(`📊 Dashboard статистика получена: ${dashboardStats.overview.totalUsers} пользователей, ${dashboardStats.overview.totalQuotes} цитат`);
    
    res.json({
      success: true,
      data: dashboardStats,
      timestamp: new Date().toISOString(),
      fallbackMode: dashboardStats.fallbackMode || false
    });

  } catch (error) {
    console.error('📊 Ошибка получения dashboard статистики:', error);
    
    res.status(500).json({
      success: false,
      error: 'Не удалось получить статистику дашборда',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Получение статистики retention пользователей
 * @route GET /api/analytics/retention
 * @returns {ApiResponse<RetentionData[]>}
 */
router.get('/retention', async (req, res) => {
  try {
    console.log('📊 RETENTION endpoint: получение статистики удержания');
    
    const retentionData = await analyticsService.getUserRetentionStats();
    
    console.log(`📊 Retention данные получены для ${retentionData.length} когорт`);
    
    res.json({
      success: true,
      data: retentionData,
      timestamp: new Date().toISOString(),
      metadata: {
        cohortsCount: retentionData.length,
        avgRetentionWeek1: retentionData.length > 0 ? 
          Math.round(retentionData.reduce((sum, c) => sum + c.week1, 0) / retentionData.length) : 0,
        avgRetentionWeek4: retentionData.length > 0 ? 
          Math.round(retentionData.reduce((sum, c) => sum + c.week4, 0) / retentionData.length) : 0
      }
    });

  } catch (error) {
    console.error('📊 Ошибка получения retention статистики:', error);
    
    res.status(500).json({
      success: false,
      error: 'Не удалось получить статистику retention',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Получение топ контента (авторы, категории, цитаты)
 * @route GET /api/analytics/top-content
 * @param {string} [period=30d] - Период анализа
 * @returns {ApiResponse<TopContentData>}
 */
router.get('/top-content', async (req, res) => {
  try {
    console.log('📊 TOP-CONTENT endpoint: получение топ контента');
    
    const { period = '30d' } = req.query;
    
    const topContent = await analyticsService.getTopQuotesAndAuthors(period);
    
    console.log(`📊 Топ контент получен: ${topContent.topAuthors.length} авторов, ${topContent.topCategories.length} категорий`);
    
    res.json({
      success: true,
      data: topContent,
      timestamp: new Date().toISOString(),
      period,
      fallbackMode: topContent.fallbackMode || false
    });

  } catch (error) {
    console.error('📊 Ошибка получения топ контента:', error);
    
    res.status(500).json({
      success: false,
      error: 'Не удалось получить топ контент',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// TRACKING ENDPOINTS
// ========================================

/**
 * Трекинг UTM кликов
 * @route POST /api/analytics/track-utm
 * @param {Object} body - UTM данные
 * @param {string} body.utm_source - Источник
 * @param {string} body.utm_medium - Канал
 * @param {string} body.utm_campaign - Кампания
 * @param {string} body.utm_content - Контент
 * @param {string} body.user_id - ID пользователя
 */
router.post('/track-utm', async (req, res) => {
  try {
    console.log('📊 UTM TRACKING: новый клик');
    
    const { utm_source, utm_medium, utm_campaign, utm_content, user_id } = req.body;
    
    // Валидация обязательных полей
    if (!utm_source || !utm_campaign || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные поля: utm_source, utm_campaign, user_id',
        timestamp: new Date().toISOString()
      });
    }

    // Подготовка UTM данных
    const utmData = {
      utm_source,
      utm_medium: utm_medium || 'unknown',
      utm_campaign,
      utm_content: utm_content || '',
      user_agent: req.headers['user-agent'] || '',
      referrer: req.headers.referer || '',
      ip_address: req.ip || req.connection.remoteAddress,
      session_id: req.sessionID || `session_${Date.now()}`
    };

    // Трекинг через сервис
    await analyticsService.trackUTMClick(utmData, user_id);
    
    console.log(`📊 UTM клик записан: ${utm_campaign} от пользователя ${user_id}`);
    
    res.json({
      success: true,
      message: 'UTM клик записан',
      timestamp: new Date().toISOString(),
      tracked: {
        campaign: utm_campaign,
        source: utm_source,
        userId: user_id
      }
    });

  } catch (error) {
    console.error('📊 Ошибка трекинга UTM клика:', error);
    
    res.status(500).json({
      success: false,
      error: 'Не удалось записать UTM клик',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Трекинг использования промокодов
 * @route POST /api/analytics/track-promo
 * @param {Object} body - Данные промокода
 * @param {string} body.promo_code - Промокод
 * @param {string} body.user_id - ID пользователя
 * @param {number} body.order_value - Сумма заказа
 * @param {Object} [body.metadata] - Дополнительные данные
 */
router.post('/track-promo', async (req, res) => {
  try {
    console.log('📊 PROMO TRACKING: использование промокода');
    
    const { promo_code, user_id, order_value, metadata = {} } = req.body;
    
    // Валидация обязательных полей
    if (!promo_code || !user_id || typeof order_value !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Обязательные поля: promo_code, user_id, order_value (number)',
        timestamp: new Date().toISOString()
      });
    }

    // Валидация суммы заказа
    if (order_value < 0) {
      return res.status(400).json({
        success: false,
        error: 'Сумма заказа не может быть отрицательной',
        timestamp: new Date().toISOString()
      });
    }

    // Трекинг через сервис
    await analyticsService.trackPromoCodeUsage(promo_code, user_id, order_value, metadata);
    
    console.log(`📊 Промокод записан: ${promo_code} от пользователя ${user_id}, сумма ${order_value}`);
    
    res.json({
      success: true,
      message: 'Использование промокода записано',
      timestamp: new Date().toISOString(),
      tracked: {
        promoCode: promo_code,
        userId: user_id,
        orderValue: order_value
      }
    });

  } catch (error) {
    console.error('📊 Ошибка трекинга промокода:', error);
    
    res.status(500).json({
      success: false,
      error: 'Не удалось записать использование промокода',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Общий трекинг действий пользователей
 * @route POST /api/analytics/track-action
 * @param {Object} body - Данные действия
 * @param {string} body.user_id - ID пользователя
 * @param {string} body.action - Тип действия
 * @param {Object} [body.metadata] - Метаданные действия
 */
router.post('/track-action', async (req, res) => {
  try {
    console.log('📊 ACTION TRACKING: действие пользователя');
    
    const { user_id, action, metadata = {} } = req.body;
    
    // Валидация обязательных полей
    if (!user_id || !action) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные поля: user_id, action',
        timestamp: new Date().toISOString()
      });
    }

    // Трекинг через сервис
    await analyticsService.trackUserAction(user_id, action, metadata);
    
    console.log(`📊 Действие записано: ${action} от пользователя ${user_id}`);
    
    res.json({
      success: true,
      message: 'Действие пользователя записано',
      timestamp: new Date().toISOString(),
      tracked: {
        userId: user_id,
        action: action
      }
    });

  } catch (error) {
    console.error('📊 Ошибка трекинга действия:', error);
    
    res.status(500).json({
      success: false,
      error: 'Не удалось записать действие пользователя',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// ДОПОЛНИТЕЛЬНЫЕ ENDPOINTS
// ========================================

/**
 * Экспорт данных аналитики
 * @route GET /api/analytics/export
 * @param {string} [format=json] - Формат экспорта (json, csv)
 * @param {string} [period=30d] - Период данных
 */
router.get('/export', async (req, res) => {
  try {
    console.log('📊 EXPORT: экспорт данных аналитики');
    
    const { format = 'json', period = '30d' } = req.query;
    
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Доступные форматы: json, csv',
        timestamp: new Date().toISOString()
      });
    }

    // Получение всех данных для экспорта
    const [dashboardStats, retentionData, topContent] = await Promise.all([
      analyticsService.getDashboardStats(period),
      analyticsService.getUserRetentionStats(),
      analyticsService.getTopQuotesAndAuthors(period)
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      period,
      dashboard: dashboardStats,
      retention: retentionData,
      topContent
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=reader-analytics-${period}-${Date.now()}.json`);
      res.json(exportData);
    } else {
      // CSV формат (упрощенный)
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=reader-analytics-${period}-${Date.now()}.csv`);
      
      const csvData = this.convertToCSV(exportData);
      res.send(csvData);
    }

    console.log(`📊 Данные экспортированы в формате ${format}`);

  } catch (error) {
    console.error('📊 Ошибка экспорта данных:', error);
    
    res.status(500).json({
      success: false,
      error: 'Не удалось экспортировать данные',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Получение метаданных аналитики
 * @route GET /api/analytics/metadata
 */
router.get('/metadata', async (req, res) => {
  try {
    console.log('📊 METADATA: получение метаданных');
    
    const metadata = {
      availablePeriods: ['1d', '7d', '30d', '90d'],
      supportedFormats: ['json', 'csv'],
      trackingEnabled: {
        utm: true,
        promoCodes: true,
        userActions: true
      },
      lastUpdate: new Date().toISOString(),
      version: '3.0.0'
    };
    
    res.json({
      success: true,
      data: metadata,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('📊 Ошибка получения метаданных:', error);
    
    res.status(500).json({
      success: false,
      error: 'Не удалось получить метаданные',
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// ERROR HANDLING
// ========================================

/**
 * Catch-all для несуществующих endpoints
 */
router.use('*', (req, res) => {
  console.log(`📊 Analytics: Неизвестный endpoint: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: 'Analytics endpoint не найден',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /api/analytics/test',
      'GET /api/analytics/dashboard',
      'GET /api/analytics/retention',
      'GET /api/analytics/top-content',
      'GET /api/analytics/export',
      'GET /api/analytics/metadata',
      'POST /api/analytics/track-utm',
      'POST /api/analytics/track-promo',
      'POST /api/analytics/track-action'
    ],
    timestamp: new Date().toISOString()
  });
});

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Конвертация данных в CSV формат
 * @param {Object} data - Данные для конвертации
 * @returns {string} CSV строка
 */
function convertToCSV(data) {
  const headers = ['Metric', 'Value', 'Period'];
  const rows = [
    ['Total Users', data.dashboard.overview.totalUsers, data.period],
    ['New Users', data.dashboard.overview.newUsers, data.period],
    ['Total Quotes', data.dashboard.overview.totalQuotes, data.period],
    ['Active Users', data.dashboard.overview.activeUsers, data.period],
    ['Promo Usage', data.dashboard.overview.promoUsage, data.period]
  ];

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

console.log('📊 Analytics API: Все endpoints настроены с полной реализацией');

module.exports = router;