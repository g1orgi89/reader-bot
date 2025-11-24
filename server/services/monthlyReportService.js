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
   * ✅ FIX: Добавлена синхронизация monthStats
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
    const analysis = await this.generateAnalysisWithClaude(prompt, user.name);

    // 📋 NEW: Агрегируем рекомендации из недельных отчётов
    const bookRecommendations = this.aggregateBookRecommendations(weeklyReports);
    
    logger.info(`📚 Aggregated ${bookRecommendations.length} book recommendations from ${weeklyReports.length} weekly reports`);

    // Создаем отчёт
    const report = new MonthlyReport({
      userId: user.userId,
      month,
      year,
      weeklyReports: weeklyReports.map(r => r._id),
      generationMethod: 'weekly_reports',
      monthlyMetrics,
      // ✅ FIX: Синхронизируем monthStats для совместимости с фронтендом
      monthStats: {
        totalQuotes: monthlyMetrics.totalQuotes,
        authorsCount: monthlyMetrics.uniqueAuthors,
        averageQuotesPerWeek: monthlyMetrics.weeksActive > 0 
          ? Math.round(monthlyMetrics.totalQuotes / monthlyMetrics.weeksActive) 
          : 0,
        longestStreak: monthlyMetrics.activeDays
      },
      evolution: {
        weeklyChanges: analysis.insights || '',
        deepPatterns: '',
        psychologicalInsight: ''
      },
      analysis: {
        psychologicalProfile: analysis.insights || '',
        personalGrowth: '',
        recommendations: '',
        bookSuggestions: bookRecommendations
      },
      specialOffer: {
        discount: 25,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        books: bookRecommendations.slice(0, 3).map(b => b.title)  // Для совместимости
      }
    });

    await report.save();
    logger.info(`📈 Monthly report saved for user ${user.userId} (${month}/${year}) - ${monthlyMetrics.totalQuotes} quotes, ${monthlyMetrics.uniqueAuthors} authors`);
    return report;
  }

   /**
   * 📋 FIXED: ВАРИАНТ B - Fallback на топ цитаты (БЕЗ selectedTheme)
   * ✅ FIX: Добавлена синхронизация monthStats
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
    const analysis = await this.generateAnalysisWithClaude(prompt, user.name);

    // 📋 NEW: Получаем рекомендации из каталога по темам (fallback)
    let bookRecommendations = [];
    try {
      const BookCatalog = require('../models/BookCatalog');
      const themes = analysis.bookSuggestions || ['ПОИСК СЕБЯ'];
      let recommendations = await BookCatalog.getRecommendationsByThemes(themes, 3);
      
      if (!recommendations || recommendations.length === 0) {
        recommendations = await BookCatalog.getUniversalRecommendations(3);
      }
      
      if (recommendations && recommendations.length > 0) {
        bookRecommendations = recommendations.map(book => ({
          title: book.title,
          author: book.author || null,
          description: book.description,
          price: this.sanitizePrice(book.price),
          priceByn: book.priceByn || null,
          bookSlug: book.bookSlug,
          link: book.utmLink || `https://anna-busel.com/books?utm_source=telegram_bot&utm_medium=monthly_report&utm_content=${book.bookSlug}`,
          reasoning: book.reasoning || 'Рекомендация на основе анализа ваших цитат за месяц'
        }));
      }
      
      logger.info(`📚 Got ${bookRecommendations.length} book recommendations from catalog (fallback)`);
    } catch (error) {
      logger.error(`📚 Error getting book recommendations: ${error.message}`);
    }
    
    // Базовые метрики
    const allQuotes = await Quote.find({
      userId: user.userId,
      monthNumber: month,
      yearNumber: year
    }).lean();

    const uniqueAuthors = [...new Set(allQuotes.map(q => q.author).filter(Boolean))].length;
    const activeDays = [...new Set(allQuotes.map(q => 
      new Date(q.createdAt).toDateString()
    ))].length;

    const monthlyMetrics = {
      totalQuotes: allQuotes.length,
      uniqueAuthors,
      activeDays,
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
      // ✅ FIX: Синхронизируем monthStats для совместимости с фронтендом
      monthStats: {
        totalQuotes: monthlyMetrics.totalQuotes,
        authorsCount: monthlyMetrics.uniqueAuthors,
        averageQuotesPerWeek: 0,
        longestStreak: monthlyMetrics.activeDays
      },
      analysis: {
        psychologicalProfile: analysis.insights || '',
        personalGrowth: '',
        recommendations: '',
        bookSuggestions: bookRecommendations || []
      },
      specialOffer: {
        discount: 25,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        books: bookRecommendations.slice(0, 3).map(b => b.title)
      }
    });

    await report.save();
    logger.info(`📈 Monthly report (fallback) saved for user ${user.userId} (${month}/${year}) - ${monthlyMetrics.totalQuotes} quotes, ${monthlyMetrics.uniqueAuthors} authors`);
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
   * 📋 NEW: Sanitizes price value to ensure it's a valid number
   * @param {any} price - Price value (can be string like "$33" or number)
   * @returns {number} Sanitized price as number
   */
  sanitizePrice(price) {
    if (typeof price === 'number') {
      return price;
    }
    if (typeof price === 'string') {
      // Remove currency symbols and parse
      const cleaned = price.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * 📋 NEW: Агрегирует рекомендации книг из еженедельных отчётов
   * Берёт уникальные книги, сортирует по частоте рекомендаций
   * ✅ FIX: Added price sanitization to handle string prices like "$33"
   * @param {Array} weeklyReports - Массив еженедельных отчётов
   * @returns {Array} Топ-3 книги с полными данными для каталога
   */
  aggregateBookRecommendations(weeklyReports) {
    const booksMap = new Map();
    
    weeklyReports.forEach(report => {
      if (report.recommendations && Array.isArray(report.recommendations)) {
        report.recommendations.forEach(rec => {
          // Используем bookSlug как уникальный ключ
          const key = rec.bookSlug || rec.title;
          
          if (!booksMap.has(key)) {
            // Первое вхождение - сохраняем полные данные
            booksMap.set(key, {
              title: rec.title,
              author: rec.author || null,
              description: rec.description,
              price: this.sanitizePrice(rec.price),
              priceByn: rec.priceByn || null,
              bookSlug: rec.bookSlug,
              link: rec.link,
              reasoning: rec.reasoning || 'Рекомендация на основе анализа ваших цитат за месяц',
              count: 1
            });
          } else {
            // Увеличиваем счётчик для сортировки по популярности
            booksMap.get(key).count++;
          }
        });
      }
    });
    
    // Сортируем по частоте рекомендаций и берём топ-3
    const sortedBooks = Array.from(booksMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    // Убираем служебное поле count перед возвратом
    return sortedBooks.map(({ count, ...book }) => book);
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
    const monthName = this.getMonthName(monthlyMetrics.month || new Date().getMonth() + 1);
    
    const weeklyInsights = weeklyReports.map((report, i) => `
Неделя ${i + 1}:
- Темы: ${report.analysis?.dominantThemes?.join(', ') || 'нет данных'}
- Тон: ${report.analysis?.emotionalTone || 'нейтральный'}
- Суть: ${(report.analysis?.insights || '').substring(0, 250)}
    `).join('\n');

    return `Ты — Анна Бусел, психолог и основатель Книжного клуба. Пишешь персональный МЕСЯЧНЫЙ анализ.

Это НЕ еженедельный отчёт. Месячный должен быть ГЛУБЖЕ:
- Еженедельный = что происходило на этой неделе
- Месячный = ЭВОЛЮЦИЯ через 4 недели, глубинные паттерны, психологический портрет месяца

Проанализируй путь пользователя через недели и верни ТОЛЬКО JSON:
{
  "insights": "..."
}

СТРУКТУРА insights (один связный текст, 5-7 абзацев):

1. ДИНАМИКА ПО НЕДЕЛЯМ (2 абзаца):
   - "В начале ${monthName} вы размышляли о [тема]..."
   - "К середине месяца фокус сместился на [тема]..."  
   - "К концу месяца [как изменились темы/настроение]..."
   - Покажи ЭВОЛЮЦИЮ мышления через месяц

2. ГЛУБИННЫЙ ПСИХОЛОГИЧЕСКИЙ АНАЛИЗ (2-3 абзаца):
   - Что стоит ЗА выбором этих цитат? Какая внутренняя потребность?
   - Какой психологический процесс происходит (поиск опоры, переосмысление, принятие, трансформация)?
   - Что это говорит о текущем жизненном этапе?
   - Задай глубокий вопрос для размышления

3. ВЗГЛЯД ВПЕРЁД (1 абзац):
   - Мягкая рекомендация что делать дальше
   - "Продолжайте собирать цитаты — это ваш личный дневник внутренней жизни"
   - "Чем дольше вы ведёте этот дневник, тем яснее становится ваш путь"
   - Заверши фирменной фразой: «Хорошая жизнь строится, а не даётся по умолчанию»

СТИЛЬ:
- Тёплый, но профессиональный психологический анализ
- Как личная колонка для женского журнала, НЕ как отчёт из системы
- Обращение на "Вы", по имени (${user.name})
- НЕ используй эмодзи
- НЕ делай коротких рубленых предложений
- НЕ используй заголовки, буллеты, нумерацию — только связный текст
- Глубина анализа должна быть ВЫШЕ чем в еженедельном отчёте

ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
Имя: ${user.name}
Месяц: ${monthName}
Всего цитат: ${monthlyMetrics.totalQuotes}
Авторов: ${monthlyMetrics.uniqueAuthors}
Активных недель: ${monthlyMetrics.weeksActive}
Топ темы месяца: ${monthlyMetrics.topThemes.join(', ')}
Эмоциональный тренд: ${monthlyMetrics.emotionalTrend}

ЕЖЕНЕДЕЛЬНЫЕ ИНСАЙТЫ:
${weeklyInsights}

Ответ — ТОЛЬКО JSON {"insights": "..."} без markdown и пояснений.`;
  }

  /**
   * 📋 FIXED: ПРОМПТ для генерации из топ цитат (БЕЗ selectedTheme)
   */
  buildTopQuotesPrompt({ user, topQuotes }) {
    const quotesText = topQuotes.map((q, i) => 
      `${i + 1}. "${q.text}" ${q.author ? `(${q.author})` : ''}`
    ).join('\n');

    return `Ты — Анна Бусел, психолог и основатель Книжного клуба. Пишешь персональный МЕСЯЧНЫЙ анализ на основе цитат.

Проанализируй цитаты и верни ТОЛЬКО JSON:
{
  "insights": "..."
}

СТРУКТУРА insights (один связный текст, 4-5 абзацев):

1. Что говорят эти цитаты о внутреннем мире пользователя?
2. Какой психологический процесс прослеживается?
3. Задай глубокий вопрос для размышления
4. Заверши мотивацией продолжать и фразой: «Хорошая жизнь строится, а не даётся по умолчанию»

СТИЛЬ:
- Тёплый, профессиональный психологический анализ
- Обращение на "Вы", по имени (${user.name})
- НЕ используй эмодзи, заголовки, буллеты — только связный текст

ЦИТАТЫ ПОЛЬЗОВАТЕЛЯ:
${quotesText}

Ответ — ТОЛЬКО JSON {"insights": "..."} без markdown и пояснений.`;
  }

  /**
   * 📋 NEW: Генерирует анализ через Claude с обработкой JSON
   */
  async generateAnalysisWithClaude(prompt, userName = 'читательница') {
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
      
      // Fallback анализ (один блок insights)
      return {
        insights: `Дорогая ${userName},

Этот месяц показал ваш глубокий интерес к познанию себя и мира вокруг. В ваших цитатах прослеживается стремление найти опору и смысл в повседневности.

Как писал Рильке: «Будьте терпеливы ко всему нерешённому в вашем сердце». Ваш выбор цитат говорит о том, что вы находитесь в процессе внутреннего роста — и это прекрасно.

Продолжайте собирать цитаты — это ваш личный дневник внутренней жизни. Чем дольше вы ведёте этот дневник, тем яснее становится ваш путь.

«Хорошая жизнь строится, а не даётся по умолчанию»`
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
