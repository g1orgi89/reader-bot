/**
 * @fileoverview API роуты для управления пользователями в админ-панели "Читатель"
 * @author g1orgi89
 */

const express = require('express');
const router = express.Router();
const UserProfile = require('../models/userProfile');
const Quote = require('../models/quote');
const WeeklyReport = require('../models/weeklyReport');
const MonthlyReport = require('../models/monthlyReport');
const { requireAdmin } = require('../middleware/auth');

/**
 * @typedef {import('../types/reader').UserProfile} UserProfile
 * @typedef {import('../types/reader').UserListResponse} UserListResponse
 * @typedef {import('../types/reader').UserDetailResponse} UserDetailResponse
 */

/**
 * GET /api/users
 * Получить список пользователей с фильтрацией и пагинацией
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      source = '',
      status = '',
      dateFilter = '',
      sortBy = 'registeredAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('👥 Запрос списка пользователей:', { page, limit, search, source, status, dateFilter });

    // Построение фильтра
    let filter = {};

    // Поиск по имени или email
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { telegramUsername: { $regex: search, $options: 'i' } }
      ];
    }

    // Фильтр по источнику
    if (source) {
      filter.source = source;
    }

    // Фильтр по статусу
    switch (status) {
      case 'active':
        filter.isActive = true;
        filter.isBlocked = false;
        break;
      case 'inactive':
        filter.$or = [
          { isActive: false },
          { isBlocked: true }
        ];
        break;
      case 'completed_onboarding':
        filter.isOnboardingComplete = true;
        break;
    }

    // Фильтр по дате
    if (dateFilter) {
      const now = new Date();
      let startDate;

      switch (dateFilter) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      if (startDate) {
        filter.registeredAt = { $gte: startDate };
      }
    }

    // Параметры пагинации
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Параметры сортировки
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Выполнение запроса
    const [users, totalCount] = await Promise.all([
      UserProfile.find(filter)
        .select('userId name email source registeredAt lastActiveAt isOnboardingComplete isActive isBlocked statistics.totalQuotes telegramUsername')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      UserProfile.countDocuments(filter)
    ]);

    // Получение дополнительной информации для каждого пользователя
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Последняя активность (из цитат)
        const lastQuote = await Quote.findOne({ userId: user.userId })
          .sort({ createdAt: -1 })
          .select('createdAt')
          .lean();

        // Статус активности
        const now = new Date();
        const daysSinceRegistration = Math.floor((now - new Date(user.registeredAt)) / (1000 * 60 * 60 * 24));
        const daysSinceLastActive = user.lastActiveAt 
          ? Math.floor((now - new Date(user.lastActiveAt)) / (1000 * 60 * 60 * 24))
          : null;

        let activityStatus = 'inactive';
        if (user.isActive && !user.isBlocked) {
          if (daysSinceLastActive <= 1) {
            activityStatus = 'active';
          } else if (daysSinceLastActive <= 7) {
            activityStatus = 'recent';
          }
        }

        return {
          ...user,
          daysSinceRegistration,
          daysSinceLastActive,
          activityStatus,
          lastQuoteDate: lastQuote?.createdAt || null,
          quotesCount: user.statistics?.totalQuotes || 0
        };
      })
    );

    const totalPages = Math.ceil(totalCount / limitNum);

    /** @type {UserListResponse} */
    const response = {
      users: usersWithStats,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      filters: {
        search,
        source,
        status,
        dateFilter
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Ошибка получения списка пользователей:', error);
    res.status(500).json({ error: 'Ошибка получения списка пользователей' });
  }
});

/**
 * GET /api/users/stats
 * Получить общую статистику пользователей
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    console.log('📊 Запрос статистики пользователей');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      newUsersThisMonth,
      completedOnboarding,
      sourceStats,
      retentionStats
    ] = await Promise.all([
      // Общее количество пользователей
      UserProfile.countDocuments({}),
      
      // Активные пользователи (активность за последнюю неделю)
      UserProfile.countDocuments({
        lastActiveAt: { $gte: weekAgo },
        isActive: true,
        isBlocked: false
      }),
      
      // Новые пользователи за неделю
      UserProfile.countDocuments({
        registeredAt: { $gte: weekAgo }
      }),
      
      // Новые пользователи за месяц
      UserProfile.countDocuments({
        registeredAt: { $gte: monthAgo }
      }),
      
      // Завершили онбординг
      UserProfile.countDocuments({
        isOnboardingComplete: true
      }),
      
      // Статистика по источникам
      UserProfile.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Retention rate (примерная оценка)
      UserProfile.aggregate([
        {
          $match: {
            registeredAt: { $gte: monthAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalRegistered: { $sum: 1 },
            stillActive: {
              $sum: {
                $cond: [
                  { $gte: ['$lastActiveAt', weekAgo] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    // Вычисление retention rate
    const retentionRate = retentionStats.length > 0 && retentionStats[0].totalRegistered > 0
      ? Math.round((retentionStats[0].stillActive / retentionStats[0].totalRegistered) * 100)
      : 0;

    // Изменения по сравнению с предыдущим периодом (упрощенная версия)
    const prevWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newUsersPrevWeek = await UserProfile.countDocuments({
      registeredAt: { $gte: prevWeekStart, $lt: weekAgo }
    });

    const newUsersChange = newUsersPrevWeek > 0 
      ? Math.round(((newUsersThisWeek - newUsersPrevWeek) / newUsersPrevWeek) * 100)
      : 0;

    const stats = {
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      newUsersThisMonth,
      completedOnboarding,
      retentionRate,
      newUsersChange,
      sourceStats,
      generatedAt: new Date()
    };

    res.json(stats);

  } catch (error) {
    console.error('❌ Ошибка получения статистики пользователей:', error);
    res.status(500).json({ error: 'Ошибка получения статистики пользователей' });
  }
});

/**
 * GET /api/users/:userId
 * Получить детальную информацию о пользователе
 */
router.get('/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('👤 Запрос деталей пользователя:', userId);

    const user = await UserProfile.findOne({ userId }).lean();
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем дополнительную информацию
    const [quotes, weeklyReports, monthlyReports, recentQuotes] = await Promise.all([
      // Статистика цитат
      Quote.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalQuotes: { $sum: 1 },
            categories: { $push: '$category' },
            authors: { $push: '$author' }
          }
        }
      ]),
      
      // Еженедельные отчеты
      WeeklyReport.find({ userId })
        .sort({ weekNumber: -1 })
        .limit(5)
        .select('weekNumber year sentAt feedback')
        .lean(),
      
      // Месячные отчеты
      MonthlyReport.find({ userId })
        .sort({ year: -1, month: -1 })
        .limit(3)
        .select('month year sentAt feedback')
        .lean(),
      
      // Последние цитаты
      Quote.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('text author category createdAt')
        .lean()
    ]);

    // Обработка статистики цитат
    const quoteStats = quotes.length > 0 ? quotes[0] : { totalQuotes: 0, categories: [], authors: [] };
    
    // Подсчет популярных категорий и авторов
    const categoryCount = {};
    const authorCount = {};
    
    quoteStats.categories.forEach(cat => {
      if (cat) categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    
    quoteStats.authors.forEach(author => {
      if (author) authorCount[author] = (authorCount[author] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
      
    const topAuthors = Object.entries(authorCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    // Вычисление дополнительных метрик
    const daysSinceRegistration = Math.floor((new Date() - new Date(user.registeredAt)) / (1000 * 60 * 60 * 24));
    const daysSinceLastActive = user.lastActiveAt 
      ? Math.floor((new Date() - new Date(user.lastActiveAt)) / (1000 * 60 * 60 * 24))
      : null;

    /** @type {UserDetailResponse} */
    const userDetail = {
      ...user,
      daysSinceRegistration,
      daysSinceLastActive,
      quoteStats: {
        total: quoteStats.totalQuotes,
        topCategories,
        topAuthors,
        recent: recentQuotes
      },
      reports: {
        weekly: weeklyReports,
        monthly: monthlyReports
      },
      engagement: {
        quotesPerDay: daysSinceRegistration > 0 ? (quoteStats.totalQuotes / daysSinceRegistration).toFixed(2) : 0,
        streakStatus: user.statistics?.currentStreak > 0 ? 'active' : 'inactive',
        longestStreak: user.statistics?.longestStreak || 0
      }
    };

    res.json(userDetail);

  } catch (error) {
    console.error('❌ Ошибка получения деталей пользователя:', error);
    res.status(500).json({ error: 'Ошибка получения деталей пользователя' });
  }
});

/**
 * GET /api/users/export
 * Экспорт данных пользователей
 */
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const { format = 'json', includeQuotes = 'false' } = req.query;
    console.log('📥 Экспорт пользователей:', { format, includeQuotes });

    // Получаем всех пользователей
    const users = await UserProfile.find({})
      .select('-botState -telegramData')
      .lean();

    let exportData = users;

    // Если нужно включить цитаты
    if (includeQuotes === 'true') {
      exportData = await Promise.all(
        users.map(async (user) => {
          const quotes = await Quote.find({ userId: user.userId })
            .select('text author category createdAt')
            .lean();
          
          return {
            ...user,
            quotes
          };
        })
      );
    }

    // Определяем формат ответа
    if (format === 'csv') {
      // Преобразование в CSV
      const csv = convertToCSV(exportData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=reader-users.csv');
      res.send(csv);
    } else {
      // JSON формат
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=reader-users.json');
      res.json({
        exportedAt: new Date(),
        totalUsers: exportData.length,
        includeQuotes: includeQuotes === 'true',
        users: exportData
      });
    }

  } catch (error) {
    console.error('❌ Ошибка экспорта пользователей:', error);
    res.status(500).json({ error: 'Ошибка экспорта данных' });
  }
});

/**
 * POST /api/users/:userId/message
 * Отправить сообщение пользователю
 */
router.post('/:userId/message', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { message, messageType = 'announcement' } = req.body;

    console.log('💬 Отправка сообщения пользователю:', { userId, messageType });

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    const user = await UserProfile.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // TODO: Здесь должна быть интеграция с Telegram Bot для отправки сообщения
    // Пока что просто логируем
    console.log(`📨 Сообщение для ${user.name} (${userId}): ${message}`);

    // В реальной реализации здесь будет:
    // await telegramBot.sendMessage(userId, message);

    res.json({
      success: true,
      message: 'Сообщение отправлено',
      sentTo: {
        userId: user.userId,
        name: user.name,
        telegramUsername: user.telegramUsername
      },
      sentAt: new Date()
    });

  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error);
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

/**
 * PUT /api/users/:userId
 * Обновить данные пользователя
 */
router.put('/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, isActive, isBlocked, notes } = req.body;

    console.log('✏️ Обновление пользователя:', { userId, updates: Object.keys(req.body) });

    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
    
    const user = await UserProfile.findOneAndUpdate(
      { userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      success: true,
      message: 'Пользователь обновлен',
      user: user.toSummary()
    });

  } catch (error) {
    console.error('❌ Ошибка обновления пользователя:', error);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

/**
 * Вспомогательная функция для конвертации в CSV
 * @param {Array} data - Данные для конвертации
 * @returns {string} CSV строка
 */
function convertToCSV(data) {
  if (!data.length) return '';

  // Определяем заголовки
  const headers = [
    'userId',
    'name', 
    'email',
    'source',
    'registeredAt',
    'lastActiveAt',
    'isOnboardingComplete',
    'isActive',
    'totalQuotes',
    'currentStreak',
    'longestStreak'
  ];

  // Создаем CSV
  const csvContent = [
    headers.join(','),
    ...data.map(user => [
      user.userId,
      `"${user.name || ''}"`,
      user.email,
      user.source,
      user.registeredAt,
      user.lastActiveAt || '',
      user.isOnboardingComplete,
      user.isActive,
      user.statistics?.totalQuotes || 0,
      user.statistics?.currentStreak || 0,
      user.statistics?.longestStreak || 0
    ].join(','))
  ].join('\n');

  return csvContent;
}

module.exports = router;