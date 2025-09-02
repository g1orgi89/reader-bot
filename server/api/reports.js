/**
 * @fileoverview API маршруты для отчетов проекта "Читатель"
 * Обновлено для работы с реальными данными и новым фронтендом
 * @author g1orgi89
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// 🔧 ИСПРАВЛЕНЫ ИМПОРТЫ: Безопасная загрузка моделей с обработкой ошибок
let WeeklyReport, MonthlyReport, UserProfile, Quote;

try {
  WeeklyReport = require('../models/weeklyReport');
  logger.info('✅ WeeklyReport model loaded');
} catch (error) {
  logger.error('❌ Failed to load WeeklyReport model:', error.message);
  WeeklyReport = null;
}

try {
  MonthlyReport = require('../models/monthlyReport');
  logger.info('✅ MonthlyReport model loaded');
} catch (error) {
  logger.error('❌ Failed to load MonthlyReport model:', error.message);
  MonthlyReport = null;
}

try {
  UserProfile = require('../models/userProfile');
  logger.info('✅ UserProfile model loaded');
} catch (error) {
  logger.error('❌ Failed to load UserProfile model:', error.message);
  UserProfile = null;
}

try {
  Quote = require('../models/quote');
  logger.info('✅ Quote model loaded');
} catch (error) {
  logger.error('❌ Failed to load Quote model:', error.message);
  Quote = null;
}

// 🔧 FIX: Безопасная загрузка сервисов с обработкой ошибок и правильными экземплярами
let weeklyReportService, monthlyReportService, telegramReportService, cronService;

try {
  const WeeklyReportService = require('../services/weeklyReportService');
  weeklyReportService = new WeeklyReportService(); // Создаем экземпляр класса
  logger.info('✅ weeklyReportService instance created');
} catch (error) {
  logger.warn('⚠️ weeklyReportService not available:', error.message);
  weeklyReportService = null;
}

try {
  const MonthlyReportService = require('../services/monthlyReportService');
  monthlyReportService = new MonthlyReportService(); // Создаем экземпляр класса
  logger.info('✅ monthlyReportService instance created');
} catch (error) {
  logger.warn('⚠️ monthlyReportService not available:', error.message);
  monthlyReportService = null;
}

try {
  telegramReportService = require('../services/telegramReportService');
  logger.info('✅ telegramReportService loaded');
} catch (error) {
  logger.warn('⚠️ telegramReportService not available:', error.message);
  telegramReportService = null;
}

try {
  const { CronService } = require('../services/cronService');
  cronService = new CronService();
  logger.info('✅ cronService instance created');
} catch (error) {
  logger.warn('⚠️ cronService not available:', error.message);
  cronService = null;
}

/**
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/api').ApiResponse} ApiResponse
 */

/**
 * Middleware для проверки доступности моделей
 */
function checkModelsAvailable(req, res, next) {
  if (!WeeklyReport || !UserProfile || !Quote) {
    return res.status(503).json({
      success: false,
      error: 'Database models not available',
      details: 'Some required models failed to load'
    });
  }
  next();
}

/**
 * GET /api/reports/stats
 * Получение статистики отчетов
 */
router.get('/stats', checkModelsAvailable, async (req, res) => {
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
      MonthlyReport ? MonthlyReport.countDocuments({ sentAt: { $gte: startDate } }) : 0,
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
      generatedAt: new Date().toISOString(),
      servicesStatus: {
        weeklyReportService: !!weeklyReportService,
        monthlyReportService: !!monthlyReportService,
        telegramReportService: !!telegramReportService,
        cronService: !!cronService
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error(`📖 Error getting reports stats: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reports statistics',
      details: error.message
    });
  }
});

/**
 * GET /api/reports/analytics/overview
 * Общая аналитика отчетов
 */
router.get('/analytics/overview', checkModelsAvailable, async (req, res) => {
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
    logger.error(`📖 Error getting analytics overview: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview',
      details: error.message
    });
  }
});

/**
 * GET /api/reports/popular-themes
 * Получение популярных тем в отчетах
 */
router.get('/popular-themes', checkModelsAvailable, async (req, res) => {
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
    logger.error(`📖 Error getting popular themes: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular themes',
      details: error.message
    });
  }
});

/**
 * GET /api/reports/list
 * Получение списка отчетов с фильтрацией
 */
router.get('/list', checkModelsAvailable, async (req, res) => {
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
    
    if ((type === 'all' || type === 'monthly') && MonthlyReport) {
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
    logger.error(`📖 Error getting reports list: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reports list',
      details: error.message
    });
  }
});

/**
 * POST /api/reports/weekly/generate
 * Ручной запуск генерации еженедельных отчетов
 */
router.post('/weekly/generate', checkModelsAvailable, async (req, res) => {
  try {
    const { weekNumber, year, userId } = req.body;
    
    logger.info(`📖 Manual weekly reports generation requested`, { weekNumber, year, userId });

    if (!weeklyReportService) {
      return res.status(503).json({
        success: false,
        error: 'Weekly report service not available'
      });
    }
    
    if (userId) {
      // 🔧 FIX: Генерация для конкретного пользователя с правильными параметрами
      
      // Получаем пользователя
      const userProfile = await UserProfile.findOne({ userId }).lean();
      if (!userProfile) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          userId
        });
      }

      // Получаем цитаты за текущую неделю
      const currentWeek = weeklyReportService.getCurrentWeekNumber();
      const currentYear = new Date().getFullYear();
      
      const quotes = await Quote.find({
        userId,
        $or: [
          { weekNumber: currentWeek, yearNumber: currentYear },
          { 
            createdAt: { 
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Последние 7 дней
            }
          }
        ]
      }).lean();

      if (quotes.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No quotes found for this user in the current week',
            userId,
            weekNumber: currentWeek,
            year: currentYear
          }
        });
      }

      // Генерируем отчет с правильными параметрами
      const reportData = await weeklyReportService.generateWeeklyReport(userId, quotes, userProfile);
      
      // Сохраняем отчет в базу данных
      const savedReport = await WeeklyReport.create({
        ...reportData,
        sentAt: new Date()
      });

      // Отправляем в Telegram (если доступно)
      let sendSuccess = false;
      if (telegramReportService && typeof telegramReportService.sendWeeklyReport === 'function') {
        try {
          sendSuccess = await telegramReportService.sendWeeklyReport(savedReport);
        } catch (telegramError) {
          logger.warn('Failed to send to Telegram:', telegramError.message);
        }
      }
      
      res.json({
        success: true,
        data: {
          report: {
            id: savedReport._id,
            userId: savedReport.userId,
            weekNumber: savedReport.weekNumber,
            year: savedReport.year,
            quotesCount: quotes.length,
            analysis: savedReport.analysis
          },
          telegramSent: sendSuccess,
          telegramAvailable: !!telegramReportService
        }
      });
    } else {
      // Генерация для всех пользователей
      if (!cronService) {
        return res.status(503).json({
          success: false,
          error: 'Cron service not available for bulk generation'
        });
      }
      
      // TODO: Реализовать bulk генерацию через cronService
      res.json({
        success: true,
        data: {
          message: 'Bulk generation not yet implemented',
          note: 'Use userId parameter for individual report generation'
        }
      });
    }
  } catch (error) {
    logger.error(`📖 Error in manual weekly reports generation: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly reports',
      details: error.message
    });
  }
});

/**
 * GET /api/reports/weekly/:userId/stats
 * Получение статистики за неделю для конкретного пользователя
 */
router.get('/weekly/:userId/stats', checkModelsAvailable, async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info(`📊 Получение статистики за неделю для пользователя ${userId}`);
    
    // Определяем временные рамки (последние 7 полных дней включая сегодня)
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 6); // 7 дней включая сегодня
    const to = new Date(startOfToday);
    to.setDate(to.getDate() + 1); // до начала завтра
    
    // Временные рамки для предыдущей недели
    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - 7);
    const prevTo = new Date(from);
    
    logger.info(`📅 Период: с ${from.toISOString()} до ${to.toISOString()}`);
    logger.info(`📅 Предыдущая неделя: с ${prevFrom.toISOString()} до ${prevTo.toISOString()}`);
    
    // Получаем цитаты за текущую неделю
    const currentWeekQuotes = await Quote.find({
      userId,
      createdAt: { $gte: from, $lt: to }
    }).lean();
    
    // Получаем цитаты за предыдущую неделю
    const prevWeekQuotes = await Quote.find({
      userId,
      createdAt: { $gte: prevFrom, $lt: prevTo }
    }).lean();
    
    // Базовые метрики текущей недели
    const quotes = currentWeekQuotes.length;
    const uniqueAuthors = new Set(
      currentWeekQuotes
        .filter(q => q.author && q.author.trim())
        .map(q => q.author.trim())
    ).size;
    
    // Активные дни (количество уникальных дат)
    const activeDays = new Set(
      currentWeekQuotes.map(q => q.createdAt.toISOString().split('T')[0])
    ).size;
    
    // Последняя цитата
    const latestQuoteAt = currentWeekQuotes.length > 0 
      ? Math.max(...currentWeekQuotes.map(q => new Date(q.createdAt).getTime()))
      : null;
    
    // Расчет серии дней (streak) - считаем назад от сегодня
    let streakDays = 0;
    const quoteDateSet = new Set(
      currentWeekQuotes.map(q => q.createdAt.toISOString().split('T')[0])
    );
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(startOfToday);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      if (quoteDateSet.has(dateStr)) {
        streakDays++;
      } else {
        break; // Прерываем серию при первом пропуске
      }
    }
    
    // Метрики предыдущей недели
    const prevWeekQuotesCount = prevWeekQuotes.length;
    const prevWeekUniqueAuthors = new Set(
      prevWeekQuotes
        .filter(q => q.author && q.author.trim())
        .map(q => q.author.trim())
    ).size;
    const prevWeekActiveDays = new Set(
      prevWeekQuotes.map(q => q.createdAt.toISOString().split('T')[0])
    ).size;
    
    // Цели и прогресс
    const targetQuotes = 14; // По требованию - фиксированное значение 14
    const targetDays = 7;
    const progressQuotesPct = Math.min(Math.round((quotes / targetQuotes) * 100), 100);
    const progressDaysPct = Math.min(Math.round((activeDays / targetDays) * 100), 100);
    
    // Доминирующие темы из последнего еженедельного отчета
    let dominantThemes = [];
    try {
      const latestReport = await WeeklyReport.findOne({ userId })
        .sort({ sentAt: -1 })
        .lean();
      
      if (latestReport && latestReport.analysis && latestReport.analysis.dominantThemes) {
        dominantThemes = latestReport.analysis.dominantThemes;
      }
    } catch (reportError) {
      logger.warn(`⚠️ Ошибка получения доминирующих тем: ${reportError.message}`);
    }
    
    const statsData = {
      from: from.toISOString(),
      to: to.toISOString(),
      quotes,
      uniqueAuthors,
      activeDays,
      streakDays,
      targetQuotes,
      progressQuotesPct,
      targetDays,
      progressDaysPct,
      dominantThemes,
      prevWeek: {
        quotes: prevWeekQuotesCount,
        uniqueAuthors: prevWeekUniqueAuthors,
        activeDays: prevWeekActiveDays
      },
      latestQuoteAt: latestQuoteAt ? new Date(latestQuoteAt).toISOString() : null
    };
    
    logger.info(`✅ Статистика рассчитана: ${quotes} цитат, ${uniqueAuthors} авторов, ${activeDays} дней`);
    
    res.json({
      success: true,
      data: statsData
    });
    
  } catch (error) {
    logger.error(`📖 Error getting weekly stats: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get weekly statistics',
      details: error.message
    });
  }
});

/**
 * GET /api/reports/weekly/:userId
 * Получение еженедельных отчетов пользователя
 */
router.get('/weekly/:userId', checkModelsAvailable, async (req, res) => {
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
          quotesCount: Array.isArray(report.quotes) ? report.quotes.length : (report.quotesCount || 0),
          sentAt: report.sentAt,
          isRead: report.isRead,
          feedback: report.feedback,
          // Keep legacy top-level fields
          dominantThemes: report.analysis?.dominantThemes || [],
          emotionalTone: report.analysis?.emotionalTone || '',
          // NEW: full analysis block
          analysis: {
            summary: report.analysis?.summary || '',
            insights: report.analysis?.insights || '',
            emotionalTone: report.analysis?.emotionalTone || '',
            dominantThemes: report.analysis?.dominantThemes || []
          },
          recommendations: report.recommendations || []
        })),
        total: reports.length
      }
    });
  } catch (error) {
    logger.error(`📖 Error getting user reports: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user reports',
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
    logger.info('🤖 Проверка статуса Telegram сервиса');
    
    const serviceInfo = {
      botStatus: telegramReportService ? 'active' : 'disabled',
      lastReportSent: WeeklyReport ? await WeeklyReport.findOne().sort({ sentAt: -1 }).select('sentAt') : null,
      nextScheduledReport: 'Воскресенье, 11:00 МСК',
      serviceUptime: process.uptime(),
      checkedAt: new Date().toISOString(),
      available: {
        telegramReportService: !!telegramReportService,
        weeklyReportService: !!weeklyReportService,
        cronService: !!cronService
      }
    };
    
    res.json({
      success: true,
      data: serviceInfo
    });
  } catch (error) {
    logger.error(`📖 Error getting Telegram service status: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Telegram service status',
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
    logger.info('⏰ Проверка статуса cron задач');
    
    const status = {
      weeklyReports: {
        enabled: !!cronService,
        schedule: '0 11 * * 0', // Каждое воскресенье в 11:00
        nextRun: 'Воскресенье, 11:00 МСК',
        lastRun: null
      },
      monthlyReports: {
        enabled: !!cronService && !!monthlyReportService,
        schedule: '0 12 1 * *', // 1 числа каждого месяца в 12:00
        nextRun: '1 число месяца, 12:00 МСК',
        lastRun: null
      },
      reminders: {
        enabled: !!cronService,
        schedule: '0 9,19 * * *', // Ежедневно в 9:00 и 19:00
        nextRun: 'Ежедневно в 9:00 и 19:00 МСК',
        lastRun: null
      }
    };
    
    const schedule = {
      timezone: 'Europe/Moscow',
      jobs: Object.keys(status).length,
      cronServiceAvailable: !!cronService
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
    logger.error(`📖 Error getting cron status: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cron status',
      details: error.message
    });
  }
});

// Fallback endpoints for graceful degradation
router.use((req, res, next) => {
  logger.warn(`📖 Reports API: Unknown endpoint ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Reports endpoint not found',
    path: req.path,
    availableEndpoints: [
      'GET /api/reports/stats',
      'GET /api/reports/analytics/overview',
      'GET /api/reports/popular-themes',
      'GET /api/reports/list',
      'GET /api/reports/weekly/:userId',
      'POST /api/reports/weekly/generate',
      'GET /api/reports/telegram/status',
      'GET /api/reports/cron/status'
    ]
  });
});

module.exports = router;