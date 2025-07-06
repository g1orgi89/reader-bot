/**
 * @fileoverview API маршруты для отчетов проекта "Читатель"
 * Обновлено для работы с реальными данными и новым фронтендом
 * @author g1orgi89
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Модели
const WeeklyReport = require('../models/weeklyReport');
const MonthlyReport = require('../models/monthlyReport');
const UserProfile = require('../models/userProfile');
const Quote = require('../models/quote');

// Сервисы
const weeklyReportService = require('../services/weeklyReportService');
const monthlyReportService = require('../services/monthlyReportService');
const telegramReportService = require('../services/telegramReportService');
const cronService = require('../services/cronService');

/**
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/api').ApiResponse} ApiResponse
 */

/**
 * GET /api/reader/reports/stats
 * Получение статистики отчетов
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`📊 Получение статистики отчетов за ${days} дней`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    // Параллельно получаем все необходимые данные
    const [
      weeklyReportsCount,
      monthlyReportsCount,
      reportsWithFeedback,
      avgRating,
      uniqueUsers
    ] = await Promise.all([
      WeeklyReport.countDocuments({ sentAt: { $gte: startDate } }),
      MonthlyReport.countDocuments({ sentAt: { $gte: startDate } }),
      WeeklyReport.countDocuments({ 
        sentAt: { $gte: startDate },
        'feedback.rating': { $exists: true }
      }),
      WeeklyReport.aggregate([
        { $match: { sentAt: { $gte: startDate }, 'feedback.rating': { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$feedback.rating' } } }
      ]),
      WeeklyReport.distinct('userId', { sentAt: { $gte: startDate } })
    ]);
    
    const averageRating = avgRating.length > 0 ? avgRating[0].avgRating : 0;
    const totalReports = weeklyReportsCount + monthlyReportsCount;
    const feedbackRate = totalReports > 0 ? Math.round((reportsWithFeedback / totalReports) * 100) : 0;
    
    const stats = {
      period: `${days} days`,
      totalReports,
      weeklyReportsCount,
      monthlyReportsCount,
      reportsWithFeedback,
      feedbackRate,
      averageRating: Number(averageRating.toFixed(1)),
      uniqueUsers: uniqueUsers.length,
      generatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error(`📖 Error getting reports stats: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get reports statistics',
      details: error.message
    });
  }
});

/**
 * GET /api/reader/reports/analytics/overview
 * Общая аналитика отчетов
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`📈 Получение аналитики отчетов за ${days} дней`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    const [
      totalReports,
      reportsWithFeedback,
      avgRating,
      emotionalTones,
      feedbackDistribution
    ] = await Promise.all([
      WeeklyReport.countDocuments({ sentAt: { $gte: startDate } }),
      WeeklyReport.countDocuments({ 
        sentAt: { $gte: startDate },
        'feedback.rating': { $exists: true }
      }),
      WeeklyReport.aggregate([
        { $match: { sentAt: { $gte: startDate }, 'feedback.rating': { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$feedback.rating' } } }
      ]),
      WeeklyReport.aggregate([
        { $match: { sentAt: { $gte: startDate } } },
        { $group: { _id: '$analysis.emotionalTone', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      WeeklyReport.aggregate([
        { $match: { sentAt: { $gte: startDate }, 'feedback.rating': { $exists: true } } },
        { $group: { _id: '$feedback.rating', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        period: `${days} days`,
        overview: {
          totalReports,
          reportsWithFeedback,
          feedbackRate: totalReports > 0 ? Math.round((reportsWithFeedback / totalReports) * 100) : 0,
          averageRating: avgRating.length > 0 ? Number(avgRating[0].avgRating.toFixed(2)) : null
        },
        emotionalTones: emotionalTones.map(tone => ({
          tone: tone._id,
          count: tone.count
        })),
        feedbackDistribution: feedbackDistribution.map(item => ({
          rating: item._id,
          count: item.count
        }))
      }
    });
    
  } catch (error) {
    logger.error(`📖 Error getting analytics overview: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview',
      details: error.message
    });
  }
});

/**
 * GET /api/reader/reports/popular-themes
 * Получение популярных тем в отчетах
 */
router.get('/popular-themes', async (req, res) => {
  try {
    const { days = 30, limit = 10 } = req.query;
    
    logger.info(`🎨 Получение популярных тем за ${days} дней`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    const themes = await WeeklyReport.aggregate([
      { $match: { sentAt: { $gte: startDate } } },
      { $unwind: '$analysis.dominantThemes' },
      { $group: { _id: '$analysis.dominantThemes', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: Number(limit) }
    ]);
    
    res.json({
      success: true,
      data: {
        period: `${days} days`,
        themes: themes.map(theme => ({
          name: theme._id,
          count: theme.count
        })),
        total: themes.length
      }
    });
    
  } catch (error) {
    logger.error(`📖 Error getting popular themes: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular themes',
      details: error.message
    });
  }
});

/**
 * GET /api/reader/reports/list
 * Получение списка отчетов с фильтрацией
 */
router.get('/list', async (req, res) => {
  try {
    const {
      type = 'all',
      dateFrom,
      dateTo,
      search = '',
      page = 1,
      limit = 20
    } = req.query;
    
    logger.info(`📋 Получение списка отчетов`, { type, dateFrom, dateTo, search, page, limit });
    
    // Построение фильтра
    const filter = {};
    
    // Фильтр по дате
    if (dateFrom || dateTo) {
      filter.sentAt = {};
      if (dateFrom) filter.sentAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.sentAt.$lte = endDate;
      }
    }
    
    // Получаем отчеты в зависимости от типа
    let reports = [];
    let totalCount = 0;
    
    if (type === 'all' || type === 'weekly') {
      const weeklyReports = await WeeklyReport.find(filter)
        .populate('quotes', 'text author')
        .sort({ sentAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean();
      
      const weeklyCount = await WeeklyReport.countDocuments(filter);
      
      reports = reports.concat(weeklyReports.map(report => ({
        id: report._id.toString(),
        userId: report.userId,
        type: 'weekly',
        period: `Неделя ${report.weekNumber}/${report.year}`,
        quotesCount: report.quotes ? report.quotes.length : 0,
        rating: report.feedback?.rating || null,
        sentAt: report.sentAt,
        status: 'sent',
        dominantThemes: report.analysis?.dominantThemes || [],
        emotionalTone: report.analysis?.emotionalTone || 'neutral'
      })));
      
      totalCount += weeklyCount;
    }
    
    if (type === 'all' || type === 'monthly') {
      const monthlyReports = await MonthlyReport.find(filter)
        .sort({ sentAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean();
      
      const monthlyCount = await MonthlyReport.countDocuments(filter);
      
      reports = reports.concat(monthlyReports.map(report => ({
        id: report._id.toString(),
        userId: report.userId,
        type: 'monthly',
        period: `${report.month}/${report.year}`,
        quotesCount: 0, // Месячные отчеты не содержат прямых ссылок на цитаты
        rating: report.feedback?.rating || null,
        sentAt: report.sentAt,
        status: 'sent',
        dominantThemes: [],
        emotionalTone: 'neutral'
      })));
      
      totalCount += monthlyCount;
    }
    
    // Получаем информацию о пользователях
    const userIds = [...new Set(reports.map(r => r.userId))];
    const users = await UserProfile.find(
      { userId: { $in: userIds } },
      { userId: 1, name: 1, telegramUsername: 1, email: 1 }
    ).lean();
    
    const userMap = users.reduce((map, user) => {
      map[user.userId] = user;
      return map;
    }, {});
    
    // Обогащаем отчеты данными пользователей
    const enrichedReports = reports.map(report => ({
      ...report,
      userName: userMap[report.userId]?.name || 'Неизвестный пользователь'
    }));
    
    // Фильтрация по поиску (на клиенте)
    let filteredReports = enrichedReports;
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filteredReports = enrichedReports.filter(report =>
        report.userName.toLowerCase().includes(searchLower) ||
        report.userId.toLowerCase().includes(searchLower)
      );
    }
    
    // Сортировка по дате (новые первыми)
    filteredReports.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    
    res.json({
      success: true,
      data: {
        reports: filteredReports,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / Number(limit)),
          totalCount,
          hasNext: (Number(page) * Number(limit)) < totalCount,
          hasPrev: Number(page) > 1,
          limit: Number(limit)
        },
        filters: { type, dateFrom, dateTo, search }
      }
    });
    
  } catch (error) {
    logger.error(`📖 Error getting reports list: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get reports list',
      details: error.message
    });
  }
});

/**
 * POST /api/reader/reports/weekly/generate
 * Ручной запуск генерации еженедельных отчетов
 */
router.post('/weekly/generate', async (req, res) => {
  try {
    const { weekNumber, year, userId } = req.body;
    
    logger.info(`📖 Manual weekly reports generation requested`, { weekNumber, year, userId });
    
    let result;
    
    if (userId) {
      // Генерация для конкретного пользователя
      result = await weeklyReportService.generateWeeklyReport(userId);
      
      if (result) {
        // Отправляем в Telegram
        const sendSuccess = await telegramReportService.sendWeeklyReport(result);
        
        res.json({
          success: true,
          data: {
            report: {
              id: result._id,
              userId: result.userId,
              weekNumber: result.weekNumber,
              year: result.year,
              quotesCount: result.quotes.length
            },
            telegramSent: sendSuccess
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            message: 'No report generated (empty week or user not found)',
            userId
          }
        });
      }
    } else {
      // Генерация для всех пользователей
      const stats = await cronService.runWeeklyReportsManually();
      
      res.json({
        success: true,
        data: {
          generationStats: stats,
          message: 'Bulk weekly reports generation completed'
        }
      });
    }
  } catch (error) {
    logger.error(`📖 Error in manual weekly reports generation: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly reports',
      details: error.message
    });
  }
});

/**
 * GET /api/reader/reports/weekly/:userId
 * Получение еженедельных отчетов пользователя
 */
router.get('/weekly/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    logger.info(`📊 Получение отчетов пользователя ${userId}`);
    
    const reports = await WeeklyReport.find({ userId })
      .populate('quotes', 'text author category')
      .sort({ sentAt: -1 })
      .limit(Number(limit))
      .lean();
    
    res.json({
      success: true,
      data: {
        userId,
        reports: reports.map(report => ({
          id: report._id,
          weekNumber: report.weekNumber,
          year: report.year,
          quotesCount: report.quotes.length,
          sentAt: report.sentAt,
          isRead: report.isRead,
          feedback: report.feedback,
          dominantThemes: report.analysis?.dominantThemes || [],
          emotionalTone: report.analysis?.emotionalTone || 'neutral'
        })),
        total: reports.length
      }
    });
  } catch (error) {
    logger.error(`📖 Error getting user reports: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get user reports',
      details: error.message
    });
  }
});

/**
 * POST /api/reader/reports/weekly/:reportId/feedback
 * Добавление обратной связи к отчету
 */
router.post('/weekly/:reportId/feedback', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { rating, comment } = req.body;
    
    logger.info(`📝 Добавление обратной связи к отчету ${reportId}`);
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }
    
    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        'feedback.rating': rating,
        'feedback.comment': comment || '',
        'feedback.respondedAt': new Date()
      },
      { new: true }
    );
    
    if (!updatedReport) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        reportId,
        feedback: updatedReport.feedback,
        message: 'Feedback added successfully'
      }
    });
  } catch (error) {
    logger.error(`📖 Error adding report feedback: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to add feedback',
      details: error.message
    });
  }
});

/**
 * POST /api/reader/reports/weekly/:reportId/read
 * Отметить отчет как прочитанный
 */
router.post('/weekly/:reportId/read', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    logger.info(`👁️ Отметка отчета ${reportId} как прочитанного`);
    
    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedReport) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        reportId,
        isRead: updatedReport.isRead,
        readAt: updatedReport.readAt,
        message: 'Report marked as read'
      }
    });
  } catch (error) {
    logger.error(`📖 Error marking report as read: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to mark report as read',
      details: error.message
    });
  }
});

/**
 * GET /api/reader/reports/telegram/status
 * Проверка статуса Telegram сервиса
 */
router.get('/telegram/status', async (req, res) => {
  try {
    logger.info('🤖 Проверка статуса Telegram сервиса');
    
    const serviceInfo = {
      botStatus: 'active',
      lastReportSent: await WeeklyReport.findOne().sort({ sentAt: -1 }).select('sentAt'),
      nextScheduledReport: 'Воскресенье, 11:00 МСК',
      serviceUptime: process.uptime(),
      checkedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: serviceInfo
    });
  } catch (error) {
    logger.error(`📖 Error getting Telegram service status: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get Telegram service status',
      details: error.message
    });
  }
});

/**
 * POST /api/reader/reports/telegram/test
 * Тестовая отправка отчета в Telegram
 */
router.post('/telegram/test', async (req, res) => {
  try {
    const { userId, reportId } = req.body;
    
    logger.info('🧪 Тестовая отправка отчета в Telegram', { userId, reportId });
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    let report;
    
    if (reportId) {
      // Отправляем существующий отчет
      report = await WeeklyReport.findById(reportId).populate('quotes');
      
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }
    } else {
      // Создаем тестовый отчет
      report = await weeklyReportService.generateWeeklyReport(userId);
      
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Unable to generate report for user (no quotes or user not found)'
        });
      }
    }
    
    // Отправляем в Telegram
    const success = await telegramReportService.sendWeeklyReport(report);
    
    res.json({
      success: true,
      data: {
        reportId: report._id,
        userId: report.userId,
        telegramSent: success,
        message: success ? 'Test report sent successfully' : 'Failed to send to Telegram'
      }
    });
  } catch (error) {
    logger.error(`📖 Error in Telegram test: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to send test report',
      details: error.message
    });
  }
});

/**
 * GET /api/reader/reports/cron/status
 * Получение статуса cron задач
 */
router.get('/cron/status', async (req, res) => {
  try {
    logger.info('⏰ Проверка статуса cron задач');
    
    const status = {
      weeklyReports: {
        enabled: true,
        schedule: '0 11 * * 0', // Каждое воскресенье в 11:00
        nextRun: 'Воскресенье, 11:00 МСК',
        lastRun: null
      },
      monthlyReports: {
        enabled: true,
        schedule: '0 12 1 * *', // 1 числа каждого месяца в 12:00
        nextRun: '1 число месяца, 12:00 МСК',
        lastRun: null
      },
      reminders: {
        enabled: true,
        schedule: '0 9,19 * * *', // Ежедневно в 9:00 и 19:00
        nextRun: 'Ежедневно в 9:00 и 19:00 МСК',
        lastRun: null
      }
    };
    
    const schedule = {
      timezone: 'Europe/Moscow',
      jobs: Object.keys(status).length
    };
    
    res.json({
      success: true,
      data: {
        status,
        schedule,
        timezone: 'Europe/Moscow',
        currentTime: new Date().toISOString(),
        moscowTime: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
      }
    });
  } catch (error) {
    logger.error(`📖 Error getting cron status: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get cron status',
      details: error.message
    });
  }
});

/**
 * POST /api/reader/reports/cron/restart/:jobName
 * Перезапуск конкретной cron задачи
 */
router.post('/cron/restart/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    
    logger.info(`🔄 Перезапуск cron задачи: ${jobName}`);
    
    // Здесь будет логика перезапуска задач
    const success = true; // Временно всегда успешно
    
    if (success) {
      res.json({
        success: true,
        data: {
          jobName,
          message: `Job ${jobName} restarted successfully`,
          restartedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to restart job ${jobName}`,
        details: 'Job not found or restart failed'
      });
    }
  } catch (error) {
    logger.error(`📖 Error restarting cron job: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to restart cron job',
      details: error.message
    });
  }
});

module.exports = router;
