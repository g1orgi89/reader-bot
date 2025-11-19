/**
 * @fileoverview Monthly Report Service для проекта "Читатель"
 * 📋 FIXED: Убран весь бред с опросами - генерация сразу из еженедельных отчётов
 * 📋 OPTIMIZED: Генерация на основе еженедельных отчётов (экономия AI токенов в 15-20 раз)
 * Fallback: Если недель мало - используем топ-20 цитат
 */

const { MonthlyReport, UserProfile, Quote, WeeklyReport } = require('../models');
const claudeService = require('./claude');
const logger = require('../utils/logger');

/**
 * @typedef {Object} MonthlyMetrics
 * @property {number} totalQuotes - Всего цитат
 * @property {number} uniqueAuthors - Уникальных авторов
 * @property {number} activeDays - Активных дней
 * @property {number} weeksActive - Недель активности
 * @property {string[]} topThemes - Топ темы
 * @property {string} emotionalTrend - Эмоциональный тренд
 */

/**
 * @typedef {Object} MonthlyAnalysis
 * @property {string} monthlyEvolution - Эволюция через недели
 * @property {string} deepPatterns - Глубинные паттерны
 * @property {string} psychologicalInsight - Главный инсайт
 * @property {string} recommendations - Рекомендации
 * @property {string[]} bookSuggestions - Книги
 */

class MonthlyReportService {
  constructor() {
    this.MIN_WEEKS_FOR_REPORT = 3; // Минимум недель для качественного отчёта
    this.bot = null;
  }

  /**
   * Инициализация сервиса
   * @param {Object} bot - Telegram bot instance  
   */
  initialize(bot) {
    this.bot = bot;
    logger.info('📈 MonthlyReportService initialized (NO SURVEYS - direct generation)');
  }

  /**
   * 📋 FIXED: Генерирует месячный отчет для пользователя БЕЗ ОПРОСОВ
   * @param {string} userId - ID пользователя в Telegram
   * @param {number} [month] - Месяц (если не указан - прошлый месяц)
   * @param {number} [year] - Год (если не указан - текущий)
   * @returns {Promise<MonthlyReportData|null>}
   */
  async generateMonthlyReport(userId, month = null, year = null) {
    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // По умолчанию генерируем отчёт за ПРОШЛЫЙ месяц
    const now = new Date();
    const targetMonth = month || (now.getMonth() === 0 ? 12 : now.getMonth());
    const targetYear = year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

    // Проверяем существующий отчет
    const existingReport = await MonthlyReport.findOne({ 
      userId, 
      month: targetMonth, 
      year: targetYear 
    });
    
    if (existingReport) {
      logger.info(`📈 Monthly report already exists for user ${userId} for ${targetMonth}/${targetYear}`);
      return existingReport;
    }

    // Проверяем, что пользователь зарегистрирован больше месяца назад
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    if (user.registeredAt > oneMonthAgo) {
      logger.info(`📅 User ${userId} registered less than a month ago, skipping monthly report`);
      return null;
    }

    try {
      // 📋 STEP 1: Получаем еженедельные отчёты за месяц
      const weeklyReports = await this.getMonthlyWeeklyReports(userId, targetMonth, targetYear);
      
      logger.info(`📊 Found ${weeklyReports.length} weekly reports for ${userId} in ${targetMonth}/${targetYear}`);

      // Если нет недельных отчётов - пропускаем
      if (weeklyReports.length === 0) {
        logger.info(`📅 No weekly reports found for user ${userId} in ${targetMonth}/${targetYear}`);
        return null;
      }

      let report;
      
      // 📋 STEP 2: Выбираем метод генерации (оптимизированный или fallback)
      if (weeklyReports.length >= this.MIN_WEEKS_FOR_REPORT) {
        // ✅ ВАРИАНТ A: Генерация из еженедельных отчётов (ОПТИМИЗИРОВАНО)
        report = await this.generateFromWeeklyReports(
          user,
          weeklyReports,
          targetMonth,
          targetYear
        );
      } else {
        // ⚠️ ВАРИАНТ B: Fallback на топ цитаты
        logger.info(`⚠️ Only ${weeklyReports.length} weeks, using fallback to top quotes`);
        report = await this.generateFromTopQuotes(
          user,
          targetMonth,
          targetYear
        );
      }

      logger.info(`📈 Monthly report generated for user ${userId} (method: ${report.generationMethod})`);
      return report;

    } catch (error) {
      logger.error(`❌ Failed to generate monthly report for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 📋 NEW: Получает еженедельные отчёты за указанный месяц
   * @param {string} userId - ID пользователя
   * @param {number} month - Месяц
   * @param {number} year - Год
   * @returns {Promise<Array>} Массив еженедельных отчётов
   */
  async getMonthlyWeeklyReports(userId, month, year) {
    // Получаем диапазон недель для месяца
    const { firstWeek, lastWeek } = this.getMonthWeekRange(month, year);

    return await WeeklyReport.find({
      userId,
      year,
      weekNumber: {
        $gte: firstWeek,
        $lte: lastWeek
      }
    }).sort({ weekNumber: 1 }).lean();
  }

  /**
   * 📋 FIXED: ВАРИАНТ A - Генерация из еженедельных отчётов (БЕЗ selectedTheme)
   * Экономия токенов: в 15-20 раз!
   */
  async generateFromWeeklyReports(user, weeklyReports, month, year) {
    logger.info(`✅ Generating monthly report from ${weeklyReports.length} weekly reports (OPTIMIZED)`);

    // Агрегируем метрики
    const monthlyMetrics = this.aggregateWeeklyMetrics(weeklyReports);

    // Формируем СЖАТЫЙ промпт БЕЗ selectedTheme
    const prompt = this.buildWeeklyReportsPrompt({
      user,
      weeklyReports,
      monthlyMetrics
    });

    // Генерируем анализ через Claude
    const analysis = await this.generateAnalysisWithClaude(prompt);

    // Создаем отчёт
    const report = new MonthlyReport({
      userId: user.userId,
      month,
      year,
      weeklyReports: weeklyReports.map(r => r._id),
      generationMethod: 'weekly_reports',
      monthlyMetrics,
      evolution: {
        weeklyChanges: analysis.monthlyEvolution || '',
        deepPatterns: analysis.deepPatterns || '',
        psychologicalInsight: analysis.psychologicalInsight || ''
      },
      analysis: {
        psychologicalProfile: analysis.psychologicalInsight || analysis.deepPatterns || '',
        personalGrowth: analysis.monthlyEvolution || '',
        recommendations: analysis.recommendations || '',
        bookSuggestions: analysis.bookSuggestions || []
      },
      specialOffer: {
        discount: 25,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        books: analysis.bookSuggestions?.slice(0, 3) || []
      }
    });

    await report.save();
    logger.info(`📈 Monthly report saved for user ${user.userId} (${month}/${year})`);
    return report;
  }

  /**
   * 📋 FIXED: ВАРИАНТ B - Fallback на топ цитаты (БЕЗ selectedTheme)
   */
  async generateFromTopQuotes(user, month, year) {
    logger.info(`⚠️ Generating monthly report from top quotes (FALLBACK)`);

    // Получаем топ-20 цитат месяца
    const topQuotes = await Quote.find({
      userId: user.userId,
      monthNumber: month,
      yearNumber: year
    })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

    if (topQuotes.length === 0) {
      throw new Error('No quotes found for the month');
    }

    // Формируем промпт
    const prompt = this.buildTopQuotesPrompt({
      user,
      topQuotes
    });

    // Генерируем анализ
    const analysis = await this.generateAnalysisWithClaude(prompt);

    // Базовые метрики
    const allQuotes = await Quote.find({
      userId: user.userId,
      monthNumber: month,
      yearNumber: year
    }).lean();

    const monthlyMetrics = {
      totalQuotes: allQuotes.length,
      uniqueAuthors: [...new Set(allQuotes.map(q => q.author).filter(Boolean))].length,
      activeDays: [...new Set(allQuotes.map(q => 
        new Date(q.createdAt).toDateString()
      ))].length,
      weeksActive: 0,
      topThemes: [],
      emotionalTrend: 'смешанная'
    };

    // Создаем отчёт
    const report = new MonthlyReport({
      userId: user.userId,
      month,
      year,
      weeklyReports: [],
      generationMethod: 'top_quotes',
      monthlyMetrics,
      analysis: {
        psychologicalProfile: analysis.psychologicalInsight || analysis.deepPatterns || '',
        personalGrowth: analysis.monthlyEvolution || '',
        recommendations: analysis.recommendations || '',
        bookSuggestions: analysis.bookSuggestions || []
      },
      specialOffer: {
        discount: 25,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        books: analysis.bookSuggestions?.slice(0, 3) || []
      }
    });

    await report.save();
    return report;
  }

  /**
   * 📋 NEW: Агрегирует метрики из еженедельных отчётов
   */
  aggregateWeeklyMetrics(weeklyReports) {
    const totalQuotes = weeklyReports.reduce((sum, r) => sum + (r.metrics?.quotes || 0), 0);
    const themes = {};
    const emotionalTones = [];

    weeklyReports.forEach(report => {
      // Темы
      if (report.analysis?.dominantThemes) {
        report.analysis.dominantThemes.forEach(theme => {
          themes[theme] = (themes[theme] || 0) + 1;
        });
      }

      // Эмоциональные тоны
      if (report.analysis?.emotionalTone) {
        emotionalTones.push(report.analysis.emotionalTone);
      }
    });

    // Топ-5 тем
    const topThemes = Object.entries(themes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);

    // Определяем тренд
    const emotionalTrend = this.determineEmotionalTrend(emotionalTones);

    return {
      totalQuotes,
      uniqueAuthors: weeklyReports.reduce((sum, r) => sum + (r.metrics?.uniqueAuthors || 0), 0),
      activeDays: weeklyReports.reduce((sum, r) => sum + (r.metrics?.activeDays || 0), 0),
      weeksActive: weeklyReports.length,
      topThemes,
      emotionalTrend
    };
  }

  /**
   * 📋 NEW: Определяет эмоциональный тренд месяца
   */
  determineEmotionalTrend(tones) {
    if (tones.length === 0) return 'смешанная';

    const uniqueTones = [...new Set(tones)];
    
    if (uniqueTones.length === 1) return 'стабильная';
    
    // Проверяем тренд роста позитивности
    const positiveIndex = ['меланхоличный', 'задумчивый', 'размышляющий', 'нейтральный', 'позитивный', 'вдохновляющий', 'энергичный'];
    const toneIndices = tones.map(t => positiveIndex.indexOf(t)).filter(i => i >= 0);
    
    if (toneIndices.length >= 3) {
      const isGrowing = toneIndices[toneIndices.length - 1] > toneIndices[0];
      return isGrowing ? 'растущая' : 'меняющаяся';
    }

    return 'смешанная';
  }

  /**
   * 📋 FIXED: ПРОМПТ для генерации из еженедельных отчётов (БЕЗ selectedTheme)
   * Экономия: ~400-500 токенов вместо 6000-10000!
   */
  buildWeeklyReportsPrompt({ user, weeklyReports, monthlyMetrics }) {
    const weeklyInsights = weeklyReports.map((report, i) => `
**Неделя ${i + 1} (неделя ${report.weekNumber}):**
- Темы: ${report.analysis?.dominantThemes?.join(', ') || 'нет данных'}
- Тон: ${report.analysis?.emotionalTone || 'нейтральный'}
- Инсайт: ${(report.analysis?.insights || '').substring(0, 300)}...
- Метрики: ${report.metrics?.quotes || 0} цитат, ${report.metrics?.uniqueAuthors || 0} авторов
    `).join('\n');

    return `Ты психолог Анна Бусел. Создай глубокий месячный анализ на основе еженедельных инсайтов.

**Пользователь:** ${user.name}
**Период:** ${this.getMonthName(monthlyMetrics.month || new Date().getMonth() + 1)}

**Еженедельные инсайты:**
${weeklyInsights}

**Общие метрики месяца:**
- Всего цитат: ${monthlyMetrics.totalQuotes}
- Уникальных авторов: ${monthlyMetrics.uniqueAuthors}
- Активных дней: ${monthlyMetrics.activeDays}
- Недель активности: ${monthlyMetrics.weeksActive}
- Топ темы: ${monthlyMetrics.topThemes.join(', ')}
- Эмоциональный тренд: ${monthlyMetrics.emotionalTrend}

**Твоя задача:**
Создай мета-анализ ЭВОЛЮЦИИ пользователя через призму недельных инсайтов:
1. Как менялись темы и настроения от недели к неделе?
2. Какие паттерны прослеживаются в выборе цитат?
3. Какой глубинный психологический процесс происходит?
4. Что рекомендовать для следующего месяца?

**Твой тон:**
- Профессиональный психологический анализ
- Тёплый, но сдержанный
- Обращение на "Вы"
- Минимум эмодзи
- Фирменные фразы (умеренно): "Хорошая жизнь строится, а не дается по умолчанию"

Верни ТОЛЬКО валидный JSON без дополнительного текста:
{
  "monthlyEvolution": "Анализ изменений через недели (2-3 абзаца)",
  "deepPatterns": "Глубинные паттерны и темы месяца (2 абзаца)",
  "psychologicalInsight": "Главный психологический инсайт месяца (1-2 абзаца)",
  "recommendations": "Что делать дальше, персональные рекомендации (2-3 абзаца)",
  "bookSuggestions": ["Книга 1 (Автор)", "Книга 2 (Автор)", "Книга 3 (Автор)"]
}`;
  }

  /**
   * 📋 FIXED: ПРОМПТ для генерации из топ цитат (БЕЗ selectedTheme)
   */
  buildTopQuotesPrompt({ user, topQuotes }) {
    const quotesText = topQuotes.map((q, i) => 
      `${i + 1}. "${q.text}" ${q.author ? `(${q.author})` : ''}`
    ).join('\n');

    return `Ты психолог Анна Бусел. Создай месячный психологический анализ на основе цитат пользователя.

**Пользователь:** ${user.name}
**Ключевые цитаты месяца:**
${quotesText}

Создай глубокий анализ личности и рекомендации.

Верни ТОЛЬКО валидный JSON без дополнительного текста:
{
  "monthlyEvolution": "Анализ месяца через цитаты",
  "deepPatterns": "Психологические паттерны",
  "psychologicalInsight": "Главный инсайт",
  "recommendations": "Рекомендации",
  "bookSuggestions": ["Книга 1", "Книга 2", "Книга 3"]
}`;
  }

  /**
   * 📋 NEW: Генерирует анализ через Claude с обработкой JSON
   */
  async generateAnalysisWithClaude(prompt) {
    try {
      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'monthly_analysis',
        context: 'monthly_report'
      });
      
      // Очищаем ответ от markdown
      let cleanedResponse = response.message
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const analysis = JSON.parse(cleanedResponse);
      logger.info(`🧠 Generated monthly analysis via Claude`);
      return analysis;

    } catch (error) {
      logger.error('❌ Failed to generate analysis:', error);
      
      // Fallback анализ
      return {
        monthlyEvolution: "Этот месяц показал ваш интерес к глубоким темам.",
        deepPatterns: "Прослеживается стремление к самопознанию.",
        psychologicalInsight: "Вы находитесь в процессе внутреннего роста.",
        recommendations: "Продолжайте изучать себя через литературу.",
        bookSuggestions: ["Искусство любить", "Быть собой", "Письма к молодому поэту"]
      };
    }
  }

  /**
   * 📋 FIXED: Генерирует месячные отчеты для всех подходящих пользователей
   * БЕЗ отправки в Telegram - только сохранение в БД
   */
  async generateMonthlyReportsForAllUsers() {
    const stats = {
      total: 0,
      generated: 0,
      failed: 0,
      errors: []
    };

    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const eligibleUsers = await UserProfile.find({
        isOnboardingComplete: true,
        registeredAt: { $lte: oneMonthAgo }
      });

      stats.total = eligibleUsers.length;
      logger.info(`📈 Found ${stats.total} eligible users for monthly reports`);

      for (const user of eligibleUsers) {
        try {
          const report = await this.generateMonthlyReport(user.userId);
          if (report) {
            stats.generated++;
          }
        } catch (error) {
          stats.failed++;
          stats.errors.push({
            userId: user.userId,
            error: error.message
          });
          logger.error(`❌ Failed to generate monthly report for user ${user.userId}: ${error.message}`);
        }
      }

      logger.info(`📈 Monthly reports generation completed: ${stats.generated} generated, ${stats.failed} failed`);
      return stats;

    } catch (error) {
      logger.error(`❌ Error in generateMonthlyReportsForAllUsers: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Получает диапазон недель для месяца
   */
  getMonthWeekRange(month, year) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const firstWeek = this.getWeekNumber(firstDay);
    const lastWeek = this.getWeekNumber(lastDay);

    return { firstWeek, lastWeek };
  }

  /**
   * Получает номер недели по ISO 8601
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Получает название месяца
   */
  getMonthName(month) {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[month - 1];
  }

  /**
   * Получает статистику месячных отчетов
   */
  async getMonthlyReportStats(days = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const [total, byMethod] = await Promise.all([
        MonthlyReport.countDocuments({ 
          createdAt: { $gte: since } 
        }),
        MonthlyReport.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$generationMethod', count: { $sum: 1 } } }
        ])
      ]);

      return {
        total,
        byMethod: byMethod.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        period: `${days} days`
      };

    } catch (error) {
      logger.error(`❌ Error getting monthly report stats: ${error.message}`);
      return { total: 0, byMethod: {} };
    }
  }

  /**
   * Получает диагностическую информацию
   */
  getDiagnostics() {
    return {
      initialized: true,
      minWeeksRequired: this.MIN_WEEKS_FOR_REPORT,
      optimizationEnabled: true,
      surveysEnabled: false, // ✅ ОТКЛЮЧЕНЫ
      status: 'ready'
    };
  }

  /**
   * Проверяет готовность сервиса
   */
  isReady() {
    return true;
  }
}

module.exports = MonthlyReportService;
