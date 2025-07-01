/**
 * @fileoverview API маршруты для отчетов проекта "Читатель"
 * @author g1orgi89
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Сервисы
const weeklyReportService = require('../services/weeklyReportService');
const telegramReportService = require('../services/telegramReportService');
const cronService = require('../services/cronService');

/**
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/api').ApiResponse} ApiResponse
 */

/**
 * GET /api/reports/stats
 * Получение статистики отчетов
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const stats = await weeklyReportService.getReportsStatistics(Number(days));
    
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
 * POST /api/reports/weekly/generate
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
 * GET /api/reports/weekly/:userId
 * Получение еженедельных отчетов пользователя
 */
router.get('/weekly/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    const reports = await weeklyReportService.getUserReports(userId, Number(limit));
    
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
          dominantThemes: report.analysis.dominantThemes,
          emotionalTone: report.analysis.emotionalTone
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
 * POST /api/reports/weekly/:reportId/feedback
 * Добавление обратной связи к отчету
 */
router.post('/weekly/:reportId/feedback', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }
    
    const updatedReport = await weeklyReportService.addReportFeedback(reportId, rating, comment);
    
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
 * POST /api/reports/weekly/:reportId/read
 * Отметить отчет как прочитанный
 */
router.post('/weekly/:reportId/read', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const updatedReport = await weeklyReportService.markReportAsRead(reportId);
    
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
 * GET /api/reports/telegram/status
 * Проверка статуса Telegram сервиса
 */
router.get('/telegram/status', async (req, res) => {
  try {
    const serviceInfo = await telegramReportService.getServiceInfo();
    
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
 * POST /api/reports/telegram/test
 * Тестовая отправка отчета в Telegram
 */
router.post('/telegram/test', async (req, res) => {
  try {
    const { userId, reportId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    let report;
    
    if (reportId) {
      // Отправляем существующий отчет
      const WeeklyReport = require('../models/weeklyReport');
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
 * GET /api/reports/cron/status
 * Получение статуса cron задач
 */
router.get('/cron/status', async (req, res) => {
  try {
    const status = cronService.getJobsStatus();
    const schedule = cronService.getSchedule();
    
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
 * POST /api/reports/cron/restart/:jobName
 * Перезапуск конкретной cron задачи
 */
router.post('/cron/restart/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const success = cronService.restartJob(jobName);
    
    if (success) {
      res.json({
        success: true,
        data: {
          jobName,
          message: `Job ${jobName} restarted successfully`
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

/**
 * GET /api/reports/popular-themes
 * Получение популярных тем в отчетах
 */
router.get('/popular-themes', async (req, res) => {
  try {
    const { days = 30, limit = 10 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    const WeeklyReport = require('../models/weeklyReport');
    
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
 * GET /api/reports/analytics/overview
 * Общая аналитика отчетов
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    const WeeklyReport = require('../models/weeklyReport');
    
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

module.exports = router;
