/**
 * @fileoverview API роуты для аналитики "Читатель"
 * @description Обеспечивает REST API для дашборда админ-панели
 * @author g1orgi89
 */

const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

/**
 * @typedef {import('../types/reader').DashboardStats} DashboardStats
 * @typedef {import('../types/reader').RetentionData} RetentionData
 */

/**
 * GET /api/analytics/dashboard
 * Основная статистика дашборда
 * @param {Object} req - Express request
 * @param {Object} req.query - Query параметры
 * @param {string} [req.query.period='7d'] - Период (1d, 7d, 30d, 90d)
 * @param {Object} res - Express response
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    console.log(`📊 Запрос статистики дашборда для периода: ${period}`);
    
    const stats = await analyticsService.getDashboardStats(period);
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('📊 Ошибка получения статистики дашборда:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка получения статистики дашборда',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/analytics/retention
 * Статистика retention по когортам
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
router.get('/retention', async (req, res) => {
  try {
    console.log('📊 Запрос статистики retention');
    
    const retentionData = await analyticsService.getUserRetentionStats();
    
    res.json({
      success: true,
      data: retentionData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('📊 Ошибка получения retention статистики:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка получения статистики retention',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/analytics/top-content
 * Топ контент: авторы, категории, цитаты
 * @param {Object} req - Express request
 * @param {Object} req.query - Query параметры
 * @param {string} [req.query.period='30d'] - Период
 * @param {Object} res - Express response
 */
router.get('/top-content', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    console.log(`📊 Запрос топ контента для периода: ${period}`);
    
    const topContent = await analyticsService.getTopQuotesAndAuthors(period);
    
    res.json({
      success: true,
      data: topContent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('📊 Ошибка получения топ контента:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка получения топ контента',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/analytics/track-utm
 * Трекинг UTM кликов
 * @param {Object} req - Express request
 * @param {Object} req.body - Данные для трекинга
 * @param {string} req.body.utm_source - UTM источник
 * @param {string} req.body.utm_medium - UTM медиум
 * @param {string} req.body.utm_campaign - UTM кампания
 * @param {string} [req.body.utm_content] - UTM контент
 * @param {string} req.body.user_id - ID пользователя
 * @param {Object} res - Express response
 */
router.post('/track-utm', async (req, res) => {
  try {
    const { 
      utm_source, 
      utm_medium, 
      utm_campaign, 
      utm_content, 
      user_id 
    } = req.body;

    // Валидация обязательных полей
    if (!utm_source || !utm_medium || !utm_campaign || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные UTM параметры или user_id'
      });
    }

    console.log(`📊 Трекинг UTM клика: ${utm_campaign} от пользователя ${user_id}`);

    await analyticsService.trackUTMClick({
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      user_agent: req.headers['user-agent'],
      referrer: req.headers.referer,
      ip_address: req.ip,
      session_id: req.sessionID
    }, user_id);

    res.json({
      success: true,
      message: 'UTM клик записан'
    });
  } catch (error) {
    console.error('📊 Ошибка трекинга UTM клика:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка записи UTM клика',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/analytics/track-promo
 * Трекинг использования промокодов
 * @param {Object} req - Express request
 * @param {Object} req.body - Данные об использовании промокода
 * @param {string} req.body.promo_code - Промокод
 * @param {string} req.body.user_id - ID пользователя
 * @param {number} req.body.order_value - Сумма заказа
 * @param {string} [req.body.source] - Источник
 * @param {string} [req.body.report_type] - Тип отчета
 * @param {Array} [req.body.books_purchased] - Купленные книги
 * @param {Object} res - Express response
 */
router.post('/track-promo', async (req, res) => {
  try {
    const { 
      promo_code, 
      user_id, 
      order_value, 
      source, 
      report_type, 
      books_purchased 
    } = req.body;

    // Валидация обязательных полей
    if (!promo_code || !user_id || !order_value) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные поля: promo_code, user_id, order_value'
      });
    }

    if (order_value <= 0) {
      return res.status(400).json({
        success: false,
        error: 'order_value должно быть больше 0'
      });
    }

    console.log(`📊 Трекинг промокода: ${promo_code} пользователь ${user_id}, сумма ${order_value}`);

    await analyticsService.trackPromoCodeUsage(promo_code, user_id, order_value, {
      source,
      reportType: report_type,
      booksPurchased: books_purchased
    });

    res.json({
      success: true,
      message: 'Использование промокода записано'
    });
  } catch (error) {
    console.error('📊 Ошибка трекинга промокода:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка записи использования промокода',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/analytics/track-action
 * Трекинг действий пользователей
 * @param {Object} req - Express request
 * @param {Object} req.body - Данные о действии
 * @param {string} req.body.user_id - ID пользователя
 * @param {string} req.body.action - Тип действия
 * @param {Object} [req.body.metadata] - Дополнительные данные
 * @param {Object} res - Express response
 */
router.post('/track-action', async (req, res) => {
  try {
    const { user_id, action, metadata = {} } = req.body;

    // Валидация обязательных полей
    if (!user_id || !action) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные поля: user_id, action'
      });
    }

    // Валидация типа действия
    const validActions = [
      'quote_added',
      'link_clicked', 
      'promo_used',
      'report_viewed',
      'feedback_given',
      'achievement_unlocked',
      'search_performed',
      'settings_changed'
    ];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Недопустимый тип действия. Допустимые: ${validActions.join(', ')}`
      });
    }

    console.log(`📊 Трекинг действия: ${action} от пользователя ${user_id}`);

    await analyticsService.trackUserAction(user_id, action, metadata);

    res.json({
      success: true,
      message: 'Действие пользователя записано'
    });
  } catch (error) {
    console.error('📊 Ошибка трекинга действия:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка записи действия пользователя',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/analytics/stats/overview
 * Расширенная статистика для экспорта
 * @param {Object} req - Express request
 * @param {Object} req.query - Query параметры
 * @param {string} [req.query.period='30d'] - Период
 * @param {Object} res - Express response
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    console.log(`📊 Запрос расширенной статистики для периода: ${period}`);
    
    const [dashboardStats, retentionData, topContent] = await Promise.all([
      analyticsService.getDashboardStats(period),
      analyticsService.getUserRetentionStats(),
      analyticsService.getTopQuotesAndAuthors(period)
    ]);

    res.json({
      success: true,
      data: {
        dashboard: dashboardStats,
        retention: retentionData,
        topContent,
        exportDate: new Date().toISOString(),
        period
      }
    });
  } catch (error) {
    console.error('📊 Ошибка получения расширенной статистики:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка получения расширенной статистики',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/analytics/health
 * Проверка здоровья сервиса аналитики
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
router.get('/health', async (req, res) => {
  try {
    // Проверяем доступность моделей
    const { UTMClick, PromoCodeUsage, UserAction } = require('../models/analytics');
    
    const checks = {
      utmClickModel: await UTMClick.countDocuments().limit(1),
      promoUsageModel: await PromoCodeUsage.countDocuments().limit(1),
      userActionModel: await UserAction.countDocuments().limit(1),
      analyticsService: analyticsService.name === 'AnalyticsService'
    };

    const isHealthy = Object.values(checks).every(check => 
      typeof check === 'number' ? check >= 0 : check === true
    );

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'Analytics API',
      timestamp: new Date().toISOString(),
      checks
    });
  } catch (error) {
    console.error('📊 Ошибка проверки здоровья аналитики:', error);
    res.status(503).json({
      success: false,
      service: 'Analytics API',
      error: 'Сервис аналитики недоступен',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;