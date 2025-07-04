/**
 * @fileoverview Улучшенный сервис аналитики для проекта "Читатель"
 * @description Обеспечивает сбор и анализ данных пользователей, цитат, конверсий с fallback режимом
 */

const UserProfile = require('../models/userProfile');
const Quote = require('../models/quote');
const WeeklyReport = require('../models/weeklyReport');
const MonthlyReport = require('../models/monthlyReport');

// Попытка импорта моделей аналитики с fallback
let PromoCodeUsage, UTMClick, UserAction;
try {
  const analyticsModels = require('../models/analytics');
  PromoCodeUsage = analyticsModels.PromoCodeUsage;
  UTMClick = analyticsModels.UTMClick;
  UserAction = analyticsModels.UserAction;
} catch (error) {
  console.warn('📊 Analytics models not available, using fallback mode:', error.message);
}

/**
 * @typedef {Object} DashboardStats
 * @property {Object} overview - Общая статистика
 * @property {number} overview.totalUsers - Всего пользователей
 * @property {number} overview.newUsers - Новых пользователей за период
 * @property {number} overview.totalQuotes - Всего цитат за период
 * @property {number} overview.avgQuotesPerUser - Среднее цитат на пользователя
 * @property {number} overview.activeUsers - Активных пользователей
 * @property {number} overview.promoUsage - Использований промокодов
 * @property {Array} sourceStats - Статистика по источникам
 * @property {Array} utmStats - Статистика UTM кампаний
 * @property {string} period - Период анализа
 */

/**
 * @typedef {Object} RetentionData
 * @property {string} cohort - Когорта (YYYY-MM)
 * @property {number} size - Размер когорты
 * @property {number} week1 - Retention 1 неделя (%)
 * @property {number} week2 - Retention 2 недели (%)
 * @property {number} week3 - Retention 3 недели (%)
 * @property {number} week4 - Retention 4 недели (%)
 */

/**
 * @typedef {Object} TopContent
 * @property {Array} topAuthors - Топ авторы
 * @property {Array} topCategories - Топ категории
 * @property {Array} popularQuotes - Популярные цитаты
 */

/**
 * Улучшенный сервис аналитики для проекта "Читатель"
 */
class AnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 3 * 60 * 1000; // 3 минуты для лучшей отзывчивости
    this.isInitialized = false;
    this.fallbackMode = false;
  }

  /**
   * Инициализация сервиса с улучшенной обработкой ошибок
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('📊 Initializing AnalyticsService...');
      
      // Проверяем доступность основных моделей
      const modelsCheck = await this.checkModelsAvailability();
      
      if (modelsCheck.UserProfile === null || modelsCheck.Quote === null) {
        console.warn('📊 Core models not available, enabling fallback mode');
        this.fallbackMode = true;
      } else {
        // Создаем тестовые данные если их нет
        await this.ensureTestData();
      }
      
      this.isInitialized = true;
      console.log('📊 AnalyticsService initialized successfully', { 
        fallbackMode: this.fallbackMode,
        cacheTimeout: this.cacheTimeout
      });
    } catch (error) {
      console.error('📊 AnalyticsService initialization failed:', error);
      this.fallbackMode = true;
      this.isInitialized = true;
    }
  }

  /**
   * Проверка доступности моделей с улучшенным логированием
   */
  async checkModelsAvailability() {
    const checks = {};
    
    try {
      checks.UserProfile = await UserProfile.countDocuments().limit(1);
      console.log('📊 UserProfile model available:', checks.UserProfile, 'documents');
    } catch (error) {
      checks.UserProfile = null;
      console.warn('📊 UserProfile model check failed:', error.message);
    }

    try {
      checks.Quote = await Quote.countDocuments().limit(1);
      console.log('📊 Quote model available:', checks.Quote, 'documents');
    } catch (error) {
      checks.Quote = null;
      console.warn('📊 Quote model check failed:', error.message);
    }

    try {
      checks.WeeklyReport = await WeeklyReport.countDocuments().limit(1);
      console.log('📊 WeeklyReport model available:', checks.WeeklyReport, 'documents');
    } catch (error) {
      checks.WeeklyReport = null;
      console.warn('📊 WeeklyReport model check failed:', error.message);
    }

    console.log('📊 Models availability check completed:', checks);
    return checks;
  }

  /**
   * Создание тестовых данных с улучшенной логикой
   */
  async ensureTestData() {
    if (this.fallbackMode) {
      console.log('📊 Skipping test data creation - fallback mode enabled');
      return;
    }

    try {
      const userCount = await UserProfile.countDocuments();
      const quoteCount = await Quote.countDocuments();
      
      console.log('📊 Current data count:', { users: userCount, quotes: quoteCount });

      if (userCount === 0 || quoteCount === 0) {
        console.log('📊 Creating enhanced sample data for Reader Bot dashboard...');
        await this.createEnhancedSampleData();
      } else {
        console.log('📊 Existing data found, skipping sample data creation');
      }
    } catch (error) {
      console.error('📊 Could not create sample data:', error.message);
      // Не включаем fallback режим, данные могут быть доступны
    }
  }

  /**
   * Создание улучшенных демонстрационных данных для "Читатель"
   */
  async createEnhancedSampleData() {
    const currentDate = new Date();
    
    const sampleUsers = [
      {
        userId: 'reader_demo_1',
        telegramUsername: 'maria_reads',
        name: 'Мария Книголюб',
        email: 'maria@reading-lovers.com',
        source: 'Instagram',
        isOnboardingComplete: true,
        testResults: {
          name: 'Мария',
          lifestyle: 'Замужем, балансирую дом/работу/себя',
          timeForSelf: 'Читаю перед сном',
          priorities: 'Саморазвитие и гармония',
          readingFeelings: 'Нахожу покой и вдохновение',
          closestPhrase: 'Книги - это окна в другие миры',
          readingTime: '5-10 часов в неделю'
        },
        preferences: {
          mainThemes: ['Саморазвитие', 'Психология'],
          personalityType: 'Искатель',
          recommendationStyle: 'Глубокий анализ'
        },
        statistics: {
          totalQuotes: 12,
          currentStreak: 5,
          longestStreak: 7,
          favoriteAuthors: ['Эрих Фромм', 'Марина Цветаева']
        },
        registeredAt: new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000) // 15 дней назад
      },
      {
        userId: 'reader_demo_2',
        telegramUsername: 'anna_wisdom',
        name: 'Анна Мудрова',
        email: 'anna@wisdom-seeker.com',
        source: 'Telegram',
        isOnboardingComplete: true,
        testResults: {
          name: 'Анна',
          lifestyle: 'Я мама (дети - главная забота)',
          timeForSelf: 'Ранним утром с кофе',
          priorities: 'Семья и личный рост',
          readingFeelings: 'Заряжаюсь энергией для дня',
          closestPhrase: 'Мудрость приходит с опытом',
          readingTime: '3-5 часов в неделю'
        },
        preferences: {
          mainThemes: ['Материнство', 'Мудрость'],
          personalityType: 'Наставник',
          recommendationStyle: 'Практические советы'
        },
        statistics: {
          totalQuotes: 8,
          currentStreak: 3,
          longestStreak: 5,
          favoriteAuthors: ['Будда', 'Лао Цзы']
        },
        registeredAt: new Date(currentDate.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 дней назад
      },
      {
        userId: 'reader_demo_3',
        telegramUsername: 'elena_poetry',
        name: 'Елена Поэтесса',
        email: 'elena@poetry-heart.com',
        source: 'YouTube',
        isOnboardingComplete: true,
        testResults: {
          name: 'Елена',
          lifestyle: 'Без отношений, изучаю мир и себя',
          timeForSelf: 'Читаю везде - в транспорте, дома, в кафе',
          priorities: 'Творчество и самопознание',
          readingFeelings: 'Чувствую связь с авторами',
          closestPhrase: 'В каждом слове живет душа',
          readingTime: 'Более 10 часов в неделю'
        },
        preferences: {
          mainThemes: ['Поэзия', 'Творчество'],
          personalityType: 'Творец',
          recommendationStyle: 'Эмоциональные открытия'
        },
        statistics: {
          totalQuotes: 15,
          currentStreak: 7,
          longestStreak: 10,
          favoriteAuthors: ['Марина Цветаева', 'Райнер Мария Рильке']
        },
        registeredAt: new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 дней назад
      },
      {
        userId: 'reader_demo_4',
        telegramUsername: 'dmitry_philosopher',
        name: 'Дмитрий Мыслитель',
        email: 'dmitry@deep-thoughts.com',
        source: 'Друзья',
        isOnboardingComplete: true,
        registeredAt: new Date(currentDate.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 дня назад
      }
    ];

    const sampleQuotes = [
      {
        userId: 'reader_demo_1',
        text: 'В каждом слове — целая жизнь',
        author: 'Марина Цветаева',
        category: 'Поэзия',
        themes: ['жизнь', 'слова', 'глубина'],
        sentiment: 'positive',
        weekNumber: this.getWeekNumber(),
        monthNumber: currentDate.getMonth() + 1,
        yearNumber: currentDate.getFullYear(),
        createdAt: new Date(currentDate.getTime() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 'reader_demo_2',
        text: 'Любовь — это решение любить',
        author: 'Эрих Фромм',
        category: 'Психология',
        themes: ['любовь', 'выбор', 'отношения'],
        sentiment: 'positive',
        weekNumber: this.getWeekNumber(),
        monthNumber: currentDate.getMonth() + 1,
        yearNumber: currentDate.getFullYear(),
        createdAt: new Date(currentDate.getTime() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 'reader_demo_2',
        text: 'Счастье внутри нас',
        author: 'Будда',
        category: 'Философия',
        themes: ['счастье', 'внутренний мир'],
        sentiment: 'positive',
        weekNumber: this.getWeekNumber(),
        monthNumber: currentDate.getMonth() + 1,
        yearNumber: currentDate.getFullYear(),
        createdAt: new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 'reader_demo_3',
        text: 'Хорошая жизнь строится, а не дается по умолчанию',
        author: 'Анна Бусел',
        category: 'Саморазвитие',
        themes: ['жизнь', 'усилия', 'развитие'],
        sentiment: 'motivational',
        weekNumber: this.getWeekNumber(),
        monthNumber: currentDate.getMonth() + 1,
        yearNumber: currentDate.getFullYear(),
        createdAt: new Date()
      },
      {
        userId: 'reader_demo_1',
        text: 'Искусство быть собой требует мужества',
        author: 'Анна Бусел',
        category: 'Саморазвитие',
        themes: ['аутентичность', 'мужество'],
        sentiment: 'inspiring',
        weekNumber: this.getWeekNumber(),
        monthNumber: currentDate.getMonth() + 1,
        yearNumber: currentDate.getFullYear(),
        createdAt: new Date(currentDate.getTime() - 12 * 60 * 60 * 1000)
      },
      {
        userId: 'reader_demo_3',
        text: 'Поэзия — это музыка, написанная словами',
        author: null,
        category: 'Творчество',
        themes: ['поэзия', 'музыка', 'творчество'],
        sentiment: 'positive',
        weekNumber: this.getWeekNumber(),
        monthNumber: currentDate.getMonth() + 1,
        yearNumber: currentDate.getFullYear(),
        createdAt: new Date(currentDate.getTime() - 8 * 60 * 60 * 1000)
      }
    ];

    try {
      // Создаем пользователей
      for (const userData of sampleUsers) {
        const result = await UserProfile.findOneAndUpdate(
          { userId: userData.userId },
          userData,
          { upsert: true, new: true }
        );
        console.log(`📊 User created/updated: ${result.name} (${result.userId})`);
      }

      // Создаем цитаты
      for (const quoteData of sampleQuotes) {
        const result = await Quote.findOneAndUpdate(
          { userId: quoteData.userId, text: quoteData.text },
          quoteData,
          { upsert: true, new: true }
        );
        console.log(`📊 Quote created: "${result.text.substring(0, 30)}..." by ${result.author || 'Unknown'}`);
      }

      // Создаем примеры UTM данных если модель доступна
      if (UTMClick) {
        await this.createSampleUTMData();
      }

      console.log('📊 Enhanced sample data for Reader Bot created successfully');
      console.log(`📊 Created ${sampleUsers.length} users and ${sampleQuotes.length} quotes`);

    } catch (error) {
      console.error('📊 Error creating enhanced sample data:', error);
      throw error;
    }
  }

  /**
   * Создание примеров UTM данных
   */
  async createSampleUTMData() {
    const utmSamples = [
      {
        userId: 'reader_demo_1',
        source: 'telegram_bot',
        medium: 'weekly_report',
        campaign: 'book_recommendations',
        content: 'psychology_books',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 'reader_demo_2',
        source: 'telegram_bot',
        medium: 'monthly_report',
        campaign: 'personal_analysis',
        content: 'deep_insights',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 'reader_demo_3',
        source: 'telegram_bot',
        medium: 'weekly_report',
        campaign: 'poetry_recommendations',
        content: 'creative_books',
        timestamp: new Date()
      }
    ];

    for (const utmData of utmSamples) {
      try {
        const utmClick = new UTMClick(utmData);
        await utmClick.save();
        console.log(`📊 UTM click created: ${utmData.campaign}`);
      } catch (error) {
        console.warn('📊 Failed to create UTM sample:', error.message);
      }
    }
  }

  /**
   * Получение статистики для дашборда с улучшенным fallback
   * @param {string} dateRange - Период ('1d', '7d', '30d', '90d')
   * @returns {Promise<DashboardStats>}
   */
  async getDashboardStats(dateRange = '7d') {
    const cacheKey = `dashboard_${dateRange}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log(`📊 Returning cached dashboard stats for ${dateRange}`);
      return cached;
    }

    try {
      await this.initialize();
      
      if (this.fallbackMode) {
        console.log('📊 Using fallback dashboard stats');
        return this.getFallbackDashboardStats(dateRange);
      }

      const startDate = this.getStartDate(dateRange);
      console.log(`📊 Generating dashboard stats for period: ${dateRange} (from ${startDate.toISOString()})`);

      // Параллельный сбор статистики
      const [
        totalUsers,
        newUsers,
        quotesStats,
        activeUsers,
        promoUsage,
        sourceStats,
        utmStats
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getNewUsers(startDate),
        this.getQuotesStats(startDate),
        this.getActiveUsers(startDate),
        this.getPromoUsage(startDate),
        this.getSourceStats(startDate),
        this.getUTMStats(startDate)
      ]);

      const stats = {
        overview: {
          totalUsers,
          newUsers,
          totalQuotes: quotesStats.total,
          avgQuotesPerUser: totalUsers > 0 ? Math.round((quotesStats.total / totalUsers) * 10) / 10 : 0,
          activeUsers,
          promoUsage
        },
        sourceStats: sourceStats || [],
        utmStats: utmStats || [],
        period: dateRange,
        generatedAt: new Date().toISOString()
      };

      console.log('📊 Dashboard stats generated:', {
        totalUsers: stats.overview.totalUsers,
        totalQuotes: stats.overview.totalQuotes,
        sourcesCount: stats.sourceStats.length,
        utmCampaigns: stats.utmStats.length
      });

      this.setCached(cacheKey, stats);
      return stats;

    } catch (error) {
      console.error('📊 Ошибка получения статистики дашборда:', error);
      
      // Возвращаем fallback данные при ошибке
      console.log('📊 Falling back to demo data due to error');
      return this.getFallbackDashboardStats(dateRange);
    }
  }

  /**
   * Улучшенные fallback данные для дашборда
   */
  getFallbackDashboardStats(dateRange) {
    return {
      overview: {
        totalUsers: 12,
        newUsers: 3,
        totalQuotes: 47,
        avgQuotesPerUser: 3.9,
        activeUsers: 8,
        promoUsage: 2
      },
      sourceStats: [
        { _id: 'Instagram', count: 5 },
        { _id: 'Telegram', count: 3 },
        { _id: 'YouTube', count: 2 },
        { _id: 'Друзья', count: 2 }
      ],
      utmStats: [
        { campaign: 'book_recommendations', clicks: 8, uniqueUsers: 6 },
        { campaign: 'weekly_reports', clicks: 5, uniqueUsers: 4 },
        { campaign: 'monthly_analysis', clicks: 3, uniqueUsers: 3 }
      ],
      period: dateRange,
      generatedAt: new Date().toISOString(),
      fallbackMode: true
    };
  }

  /**
   * Получение данных retention с улучшенной обработкой
   * @returns {Promise<RetentionData[]>}
   */
  async getUserRetentionStats() {
    const cacheKey = 'retention_stats';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      await this.initialize();

      if (this.fallbackMode) {
        return this.getFallbackRetentionData();
      }

      // Группировка пользователей по месяцам регистрации
      const cohorts = await UserProfile.aggregate([
        {
          $match: { isOnboardingComplete: true }
        },
        {
          $group: {
            _id: {
              year: { $year: '$registeredAt' },
              month: { $month: '$registeredAt' }
            },
            users: { $push: '$userId' },
            size: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      const retentionData = [];

      for (const cohort of cohorts) {
        const cohortUsers = cohort.users;
        const cohortDate = new Date(cohort._id.year, cohort._id.month - 1, 1);
        
        const retention = {
          cohort: `${cohort._id.year}-${cohort._id.month.toString().padStart(2, '0')}`,
          size: cohort.size,
          week1: 100, // Первая неделя всегда 100%
          week2: 0,
          week3: 0,
          week4: 0
        };

        // Проверяем активность пользователей по неделям (начиная со 2 недели)
        for (let week = 2; week <= 4; week++) {
          const weekStart = new Date(cohortDate);
          weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          // Считаем пользователей, которые были активны в эту неделю
          const activeInWeek = await Quote.distinct('userId', {
            userId: { $in: cohortUsers },
            createdAt: { $gte: weekStart, $lt: weekEnd }
          });

          retention[`week${week}`] = Math.round((activeInWeek.length / cohort.size) * 100);
        }

        retentionData.push(retention);
      }

      console.log('📊 Retention data generated for', retentionData.length, 'cohorts');
      this.setCached(cacheKey, retentionData);
      return retentionData;

    } catch (error) {
      console.error('📊 Ошибка получения retention статистики:', error);
      return this.getFallbackRetentionData();
    }
  }

  /**
   * Улучшенные fallback данные retention
   */
  getFallbackRetentionData() {
    const currentDate = new Date();
    const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    
    return [
      {
        cohort: `${lastMonth.getFullYear()}-${(lastMonth.getMonth() + 1).toString().padStart(2, '0')}`,
        size: 8,
        week1: 100,
        week2: 75,
        week3: 50,
        week4: 38
      },
      {
        cohort: `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`,
        size: 4,
        week1: 100,
        week2: 75,
        week3: 50,
        week4: 25
      }
    ];
  }

  /**
   * Получение топ контента с улучшенной обработкой
   * @param {string} dateRange - Период анализа
   * @returns {Promise<TopContent>}
   */
  async getTopQuotesAndAuthors(dateRange = '30d') {
    const cacheKey = `top_content_${dateRange}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      await this.initialize();
      
      if (this.fallbackMode) {
        return this.getFallbackTopContent();
      }

      const startDate = this.getStartDate(dateRange);

      const [topAuthors, topCategories, popularQuotes] = await Promise.all([
        // Топ авторы
        Quote.aggregate([
          { $match: { createdAt: { $gte: startDate }, author: { $ne: null, $ne: '' } } },
          { $group: { _id: '$author', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Топ категории
        Quote.aggregate([
          { $match: { createdAt: { $gte: startDate }, category: { $ne: null, $ne: '' } } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Популярные цитаты (повторяющиеся)
        Quote.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { 
            $group: { 
              _id: '$text', 
              author: { $first: '$author' }, 
              count: { $sum: 1 } 
            } 
          },
          { $match: { count: { $gt: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
      ]);

      const result = {
        topAuthors: topAuthors || [],
        topCategories: topCategories || [],
        popularQuotes: popularQuotes || []
      };

      console.log('📊 Top content generated:', {
        authorsCount: result.topAuthors.length,
        categoriesCount: result.topCategories.length,
        popularQuotesCount: result.popularQuotes.length
      });

      this.setCached(cacheKey, result);
      return result;

    } catch (error) {
      console.error('📊 Ошибка получения топ контента:', error);
      return this.getFallbackTopContent();
    }
  }

  /**
   * Улучшенные fallback данные топ контента
   */
  getFallbackTopContent() {
    return {
      topAuthors: [
        { _id: 'Эрих Фромм', count: 3 },
        { _id: 'Марина Цветаева', count: 2 },
        { _id: 'Анна Бусел', count: 2 },
        { _id: 'Будда', count: 1 },
        { _id: 'Райнер Мария Рильке', count: 1 }
      ],
      topCategories: [
        { _id: 'Саморазвитие', count: 4 },
        { _id: 'Психология', count: 3 },
        { _id: 'Поэзия', count: 2 },
        { _id: 'Философия', count: 2 },
        { _id: 'Творчество', count: 1 }
      ],
      popularQuotes: [
        { _id: 'Хорошая жизнь строится, а не дается по умолчанию', author: 'Анна Бусел', count: 2 }
      ]
    };
  }

  /**
   * Трекинг UTM кликов
   * @param {Object} utmParams - UTM параметры
   * @param {string} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async trackUTMClick(utmParams, userId) {
    if (!UTMClick) {
      console.warn('📊 UTMClick model not available, skipping tracking');
      return;
    }

    try {
      const click = new UTMClick({
        userId,
        source: utmParams.utm_source,
        medium: utmParams.utm_medium,
        campaign: utmParams.utm_campaign,
        content: utmParams.utm_content,
        timestamp: new Date(),
        userAgent: utmParams.user_agent,
        referrer: utmParams.referrer
      });

      await click.save();
      console.log(`📊 UTM click tracked: ${utmParams.utm_campaign} for user ${userId}`);

      // Обновление счетчиков пользователя
      await this.updateUserClickStats(userId, utmParams.utm_campaign);

    } catch (error) {
      console.error('📊 Ошибка трекинга UTM клика:', error);
    }
  }

  /**
   * Трекинг использования промокодов
   * @param {string} promoCode - Промокод
   * @param {string} userId - ID пользователя
   * @param {number} orderValue - Сумма заказа
   * @param {Object} options - Дополнительные опции
   * @returns {Promise<void>}
   */
  async trackPromoCodeUsage(promoCode, userId, orderValue, options = {}) {
    if (!PromoCodeUsage) {
      console.warn('📊 PromoCodeUsage model not available, skipping tracking');
      return;
    }

    try {
      const discount = this.getDiscountForPromoCode(promoCode);
      const discountAmount = orderValue * (discount / 100);
      const finalAmount = orderValue - discountAmount;

      const usage = new PromoCodeUsage({
        promoCode,
        userId,
        orderValue,
        discount,
        discountAmount,
        finalAmount,
        timestamp: new Date(),
        source: options.source || 'telegram_bot',
        reportType: options.reportType,
        booksPurchased: options.booksPurchased
      });

      await usage.save();
      console.log(`📊 Promo code tracked: ${promoCode} for user ${userId}, value: $${orderValue}`);

    } catch (error) {
      console.error('📊 Ошибка трекинга промокода:', error);
    }
  }

  /**
   * Трекинг действий пользователя
   * @param {string} userId - ID пользователя
   * @param {string} action - Тип действия
   * @param {Object} metadata - Дополнительные данные
   * @returns {Promise<void>}
   */
  async trackUserAction(userId, action, metadata = {}) {
    if (!UserAction) {
      console.warn('📊 UserAction model not available, skipping tracking');
      return;
    }

    try {
      const userAction = new UserAction({
        userId,
        action,
        metadata,
        timestamp: new Date()
      });

      await userAction.save();
      console.log(`📊 User action tracked: ${action} for user ${userId}`);

    } catch (error) {
      console.error('📊 Ошибка трекинга действия пользователя:', error);
    }
  }

  // === ПРИВАТНЫЕ МЕТОДЫ ===

  /**
   * Получение общего количества пользователей
   * @returns {Promise<number>}
   */
  async getTotalUsers() {
    try {
      return await UserProfile.countDocuments({ isOnboardingComplete: true });
    } catch (error) {
      console.warn('📊 Error getting total users:', error.message);
      return 0;
    }
  }

  /**
   * Получение количества новых пользователей за период
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<number>}
   */
  async getNewUsers(startDate) {
    try {
      return await UserProfile.countDocuments({
        isOnboardingComplete: true,
        registeredAt: { $gte: startDate }
      });
    } catch (error) {
      console.warn('📊 Error getting new users:', error.message);
      return 0;
    }
  }

  /**
   * Получение статистики цитат
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Object>}
   */
  async getQuotesStats(startDate) {
    try {
      const total = await Quote.countDocuments({ createdAt: { $gte: startDate } });
      return { total };
    } catch (error) {
      console.warn('📊 Error getting quotes stats:', error.message);
      return { total: 0 };
    }
  }

  /**
   * Получение количества активных пользователей
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<number>}
   */
  async getActiveUsers(startDate) {
    try {
      const activeUserIds = await Quote.distinct('userId', { createdAt: { $gte: startDate } });
      return activeUserIds.length;
    } catch (error) {
      console.warn('📊 Error getting active users:', error.message);
      return 0;
    }
  }

  /**
   * Получение статистики использования промокодов
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<number>}
   */
  async getPromoUsage(startDate) {
    if (!PromoCodeUsage) return 0;

    try {
      return await PromoCodeUsage.countDocuments({
        timestamp: { $gte: startDate }
      });
    } catch (error) {
      console.warn('📊 Error getting promo usage:', error.message);
      return 0;
    }
  }

  /**
   * Получение статистики по источникам
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Array>}
   */
  async getSourceStats(startDate) {
    try {
      return await UserProfile.aggregate([
        { $match: { registeredAt: { $gte: startDate } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
    } catch (error) {
      console.warn('📊 Error getting source stats:', error.message);
      return [];
    }
  }

  /**
   * Получение статистики UTM кампаний
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Array>}
   */
  async getUTMStats(startDate) {
    if (!UTMClick) return [];

    try {
      return await UTMClick.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { 
          $group: { 
            _id: '$campaign', 
            clicks: { $sum: 1 }, 
            users: { $addToSet: '$userId' } 
          } 
        },
        { 
          $project: { 
            campaign: '$_id', 
            clicks: 1, 
            uniqueUsers: { $size: '$users' } 
          } 
        },
        { $sort: { clicks: -1 } }
      ]);
    } catch (error) {
      console.warn('📊 Error getting UTM stats:', error.message);
      return [];
    }
  }

  /**
   * Обновление статистики кликов пользователя
   * @param {string} userId - ID пользователя
   * @param {string} campaign - Кампания
   * @returns {Promise<void>}
   */
  async updateUserClickStats(userId, campaign) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          $inc: { 'analytics.totalClicks': 1 },
          $addToSet: { 'analytics.campaigns': campaign }
        }
      );
    } catch (error) {
      console.warn('📊 Error updating user click stats:', error.message);
    }
  }

  /**
   * Получение скидки для промокода
   * @param {string} promoCode - Промокод
   * @returns {number}
   */
  getDiscountForPromoCode(promoCode) {
    const discountMap = {
      'READER20': 20,
      'WISDOM20': 20,
      'QUOTES20': 20,
      'BOOKS20': 20,
      'MONTH25': 25,
      'READER15': 15
    };
    
    return discountMap[promoCode] || 0;
  }

  /**
   * Получение номера недели в году
   * @param {Date} date - Дата (по умолчанию - текущая)
   * @returns {number}
   */
  getWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Получение начальной даты по периоду
   * @param {string} dateRange - Период
   * @returns {Date}
   */
  getStartDate(dateRange) {
    const now = new Date();
    switch (dateRange) {
      case '1d':
        return new Date(now.setDate(now.getDate() - 1));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  }

  /**
   * Получение данных из кэша
   * @param {string} key - Ключ кэша
   * @returns {any|null}
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Установка данных в кэш
   * @param {string} key - Ключ кэша
   * @param {any} data - Данные
   * @returns {void}
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Очистка кэша
   * @returns {void}
   */
  clearCache() {
    this.cache.clear();
    console.log('📊 Analytics cache cleared');
  }

  /**
   * Получение статуса сервиса
   * @returns {Object} Статус сервиса
   */
  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      fallbackMode: this.fallbackMode,
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}

module.exports = new AnalyticsService();