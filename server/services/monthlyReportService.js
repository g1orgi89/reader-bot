/**
 * @fileoverview Monthly Report Service для проекта "Читатель"
 * 📋 OPTIMIZED: Генерация на основе еженедельных отчётов (экономия AI токенов в 15-20 раз)
 * Fallback: Если недель мало - используем топ-20 цитат
 */

const { MonthlyReport, UserProfile, Quote, WeeklyReport } = require('../models');
const claudeService = require('./claude');

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
    this.monthlyThemes = [
      { id: 'confidence', text: '🔍 Поиск уверенности', key: 'поиск уверенности' },
      { id: 'femininity', text: '🌸 Женственность и нежность', key: 'женственность' },
      { id: 'balance', text: '⚖️ Баланс между «дать» и «взять»', key: 'баланс' },
      { id: 'love', text: '💕 Любовь и отношения', key: 'любовь и отношения' },
      { id: 'growth', text: '✨ Вдохновение и рост', key: 'вдохновение и рост' },
      { id: 'family', text: '👶 Материнство и семья', key: 'материнство и семья' }
    ];

    this.MIN_WEEKS_FOR_REPORT = 3; // Минимум недель для качественного отчёта
    this.bot = null;
  }

  /**
   * Инициализация сервиса
   * @param {Object} bot - Telegram bot instance  
   */
  initialize(bot) {
    this.bot = bot;
    console.log('📈 MonthlyReportService initialized (optimized)');
  }

  /**
   * 📋 MAIN: Генерирует месячный отчет для пользователя
   * @param {string} userId - ID пользователя в Telegram
   * @param {number} [month] - Месяц (если не указан - текущий)
   * @param {number} [year] - Год (если не указан - текущий)
   * @returns {Promise<MonthlyReportData|null>}
   */
  async generateMonthlyReport(userId, month = null, year = null) {
    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Используем указанный месяц или текущий
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    // Проверяем существующий отчет
    const existingReport = await MonthlyReport.findOne({ 
      userId, 
      month: targetMonth, 
      year: targetYear 
    });
    
    if (existingReport) {
      console.log(`📈 Monthly report already exists for user ${userId} for ${targetMonth}/${targetYear}`);
      return existingReport;
    }

    // Проверяем, что пользователь зарегистрирован больше месяца назад
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    if (user.registeredAt > oneMonthAgo) {
      console.log(`📅 User ${userId} registered less than a month ago, skipping monthly report`);
      return null;
    }

    // Отправляем дополнительный опрос
    await this.sendAdditionalSurvey(userId, user, targetMonth, targetYear);
    return null; // Отчет будет создан после ответа на опрос
  }

  /**
   * 📋 NEW: Обрабатывает ответ на опрос и генерирует отчёт (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
   * @param {string} userId - ID пользователя
   * @param {string} selectedThemeId - Выбранная тема
   * @param {number} [month] - Месяц
   * @param {number} [year] - Год
   */
  async processSurveyResponse(userId, selectedThemeId, month = null, year = null) {
    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const selectedTheme = this.monthlyThemes.find(t => t.id === selectedThemeId);
    if (!selectedTheme) {
      throw new Error(`Unknown theme: ${selectedThemeId}`);
    }

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    try {
      // 📋 STEP 1: Получаем еженедельные отчёты за месяц
      const weeklyReports = await this.getMonthlyWeeklyReports(userId, targetMonth, targetYear);
      
      console.log(`📊 Found ${weeklyReports.length} weekly reports for ${userId} in ${targetMonth}/${targetYear}`);

      let report;
      
      // 📋 STEP 2: Выбираем метод генерации (оптимизированный или fallback)
      if (weeklyReports.length >= this.MIN_WEEKS_FOR_REPORT) {
        // ✅ ВАРИАНТ A: Генерация из еженедельных отчётов (ОПТИМИЗИРОВАНО)
        report = await this.generateFromWeeklyReports(
          user,
          weeklyReports,
          selectedTheme.key,
          targetMonth,
          targetYear
        );
      } else {
        // ⚠️ ВАРИАНТ B: Fallback на топ цитаты
        console.log(`⚠️ Only ${weeklyReports.length} weeks, using fallback to top quotes`);
        report = await this.generateFromTopQuotes(
          user,
          selectedTheme.key,
          targetMonth,
          targetYear
        );
      }

      // 📋 STEP 3: Отправляем отчёт пользователю
      await this.sendMonthlyReport(userId, report);
      
      // Очищаем состояние пользователя
      await this.clearUserState(userId);

      console.log(`📈 Monthly report generated and sent to user ${userId} (method: ${report.generationMethod})`);
      return report;

    } catch (error) {
      console.error(`❌ Failed to process monthly survey for user ${userId}:`, error);
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
   * 📋 NEW: ВАРИАНТ A - Генерация из еженедельных отчётов (ОПТИМИЗИРОВАНО)
   * Экономия токенов: в 15-20 раз!
   */
  async generateFromWeeklyReports(user, weeklyReports, selectedTheme, month, year) {
    console.log(`✅ Generating monthly report from ${weeklyReports.length} weekly reports (OPTIMIZED)`);

    // Агрегируем метрики
    const monthlyMetrics = this.aggregateWeeklyMetrics(weeklyReports);

    // Формируем СЖАТЫЙ промпт
    const prompt = this.buildWeeklyReportsPrompt({
      user,
      weeklyReports,
      monthlyMetrics,
      selectedTheme
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
      additionalSurvey: {
        mainTheme: selectedTheme,
        mood: selectedTheme,
        respondedAt: new Date()
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
    return report;
  }

  /**
   * 📋 NEW: ВАРИАНТ B - Fallback на топ цитаты
   */
  async generateFromTopQuotes(user, selectedTheme, month, year) {
    console.log(`⚠️ Generating monthly report from top quotes (FALLBACK)`);

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
      topQuotes,
      selectedTheme
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
      additionalSurvey: {
        mainTheme: selectedTheme,
        mood: selectedTheme,
        respondedAt: new Date()
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
    return report;
  }

  /**
   * 📋 NEW: Агрегирует метрики из еженедельных отчётов
   */
  aggregateWeeklyMetrics(weeklyReports) {
    const totalQuotes = weeklyReports.reduce((sum, r) => sum + (r.metrics?.quotes || 0), 0);
    const authors = new Set();
    const themes = {};
    const emotionalTones = [];

    weeklyReports.forEach(report => {
      // Уникальные авторы
      if (report.metrics?.uniqueAuthors) {
        // Нет списка авторов, используем счётчик
      }

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
   * 📋 NEW: ПРОМПТ для генерации из еженедельных отчётов (СЖАТЫЙ)
   * Экономия: ~400-500 токенов вместо 6000-10000!
   */
  buildWeeklyReportsPrompt({ user, weeklyReports, monthlyMetrics, selectedTheme }) {
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
**Выбранная тема месяца (по ощущениям пользователя):** ${selectedTheme}

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
   * 📋 NEW: ПРОМПТ для генерации из топ цитат (FALLBACK)
   */
  buildTopQuotesPrompt({ user, topQuotes, selectedTheme }) {
    const quotesText = topQuotes.map((q, i) => 
      `${i + 1}. "${q.text}" ${q.author ? `(${q.author})` : ''}`
    ).join('\n');

    return `Ты психолог Анна Бусел. Создай месячный психологический анализ на основе цитат пользователя.

**Пользователь:** ${user.name}
**Выбранная тема месяца:** ${selectedTheme}
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
      console.log(`🧠 Generated monthly analysis via Claude`);
      return analysis;

    } catch (error) {
      console.error('❌ Failed to generate analysis:', error);
      
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
   * Отправляет дополнительный опрос пользователю
   */
  async sendAdditionalSurvey(userId, user, month, year) {
    if (!this.bot) {
      throw new Error('Bot instance not available for sending surveys');
    }

    const surveyMessage = `
📝 *Дополнительный опрос для точности разбора*

Здравствуйте, ${user.name}! Вы с ботом уже месяц. Время подвести итоги и создать персональный психологический анализ.

Сначала небольшой вопрос для точности:

*Как вы ощущали этот месяц? Выберите главную тему:*
    `;

    const keyboard = this.monthlyThemes.map(theme => [{
      text: theme.text,
      callback_data: `monthly_survey_${theme.id}_${month}_${year}`
    }]);

    try {
      await this.bot.telegram.sendMessage(userId, surveyMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      await this.setUserState(userId, 'awaiting_monthly_survey');
      console.log(`📝 Monthly survey sent to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send monthly survey to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Отправляет месячный отчет пользователю
   */
  async sendMonthlyReport(userId, report) {
    if (!this.bot) {
      throw new Error('Bot instance not available for sending reports');
    }

    const methodText = report.generationMethod === 'weekly_reports' ?
      `основе ${report.weeklyReports.length} недельных отчётов` :
      'основе ваших цитат';

    const reportMessage = `
📈 *Ваш персональный разбор месяца*

🎉 Поздравляю! Прошёл месяц работы с «Читателем»!

📊 *Статистика:*
└ Цитат сохранено: ${report.monthlyMetrics.totalQuotes}
└ Уникальных авторов: ${report.monthlyMetrics.uniqueAuthors}
└ Активных дней: ${report.monthlyMetrics.activeDays}
${report.monthlyMetrics.weeksActive > 0 ? `└ Недель активности: ${report.monthlyMetrics.weeksActive}\n` : ''}
${report.monthlyMetrics.topThemes.length > 0 ? `└ Главные темы: ${report.monthlyMetrics.topThemes.slice(0, 3).join(', ')}\n` : ''}

🧠 *Психологический анализ:*
${report.analysis.psychologicalProfile}

📈 *Ваш личностный рост:*
${report.analysis.personalGrowth}

💡 *Персональные рекомендации:*
${report.analysis.recommendations}

📚 *Специально для вас* (скидка ${report.specialOffer.discount}% до ${report.specialOffer.validUntil.toLocaleDateString()}):
${report.analysis.bookSuggestions.map((book, i) => `${i + 1}. ${book}`).join('\n')}

Продолжайте собирать моменты вдохновения! 📖

_Отчёт создан на ${methodText}_
    `;

    const ratingKeyboard = [
      [{ text: "⭐⭐⭐⭐⭐", callback_data: `monthly_rating_5_${report._id}` }],
      [{ text: "⭐⭐⭐⭐", callback_data: `monthly_rating_4_${report._id}` }],
      [{ text: "⭐⭐⭐", callback_data: `monthly_rating_3_${report._id}` }],
      [{ text: "⭐⭐", callback_data: `monthly_rating_2_${report._id}` }],
      [{ text: "⭐", callback_data: `monthly_rating_1_${report._id}` }]
    ];

    try {
      await this.bot.telegram.sendMessage(userId, reportMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: ratingKeyboard
        }
      });

      report.sentAt = new Date();
      await report.save();

      console.log(`📈 Monthly report sent to user ${userId} (method: ${report.generationMethod})`);

    } catch (error) {
      console.error(`❌ Failed to send monthly report to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Генерирует месячные отчеты для всех подходящих пользователей
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
      console.log(`📈 Found ${stats.total} eligible users for monthly reports`);

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
          console.error(`❌ Failed to generate monthly report for user ${user.userId}: ${error.message}`);
        }
      }

      console.log(`📈 Monthly reports generation completed: ${stats.generated} generated, ${stats.failed} failed`);
      return stats;

    } catch (error) {
      console.error(`❌ Error in generateMonthlyReportsForAllUsers: ${error.message}`, error);
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
   * Устанавливает состояние пользователя
   */
  async setUserState(userId, state) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { 'botState.current': state, 'botState.updatedAt': new Date() },
        { upsert: true }
      );
    } catch (error) {
      console.error(`❌ Failed to set user state for ${userId}:`, error);
    }
  }

  /**
   * Очищает состояние пользователя
   */
  async clearUserState(userId) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          'botState.current': 'active',
          'botState.updatedAt': new Date() 
        }
      );
    } catch (error) {
      console.error(`❌ Failed to clear user state for ${userId}:`, error);
    }
  }

  /**
   * Получает статистику месячных отчетов
   */
  async getMonthlyReportStats(days = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const [total, withFeedback, avgRating, byMethod] = await Promise.all([
        MonthlyReport.countDocuments({ sentAt: { $gte: since } }),
        MonthlyReport.countDocuments({ 
          sentAt: { $gte: since },
          'feedback.rating': { $exists: true }
        }),
        MonthlyReport.aggregate([
          { $match: { sentAt: { $gte: since }, 'feedback.rating': { $exists: true } } },
          { $group: { _id: null, avgRating: { $avg: '$feedback.rating' } } }
        ]),
        MonthlyReport.aggregate([
          { $match: { sentAt: { $gte: since } } },
          { $group: { _id: '$generationMethod', count: { $sum: 1 } } }
        ])
      ]);

      return {
        total,
        withFeedback,
        responseRate: total > 0 ? Math.round((withFeedback / total) * 100) : 0,
        averageRating: avgRating.length > 0 ? Math.round(avgRating[0].avgRating * 10) / 10 : null,
        byMethod: byMethod.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        period: `${days} days`
      };

    } catch (error) {
      console.error(`❌ Error getting monthly report stats: ${error.message}`);
      return { total: 0, withFeedback: 0, responseRate: 0, averageRating: null, byMethod: {} };
    }
  }

  /**
   * Получает диагностическую информацию
   */
  getDiagnostics() {
    return {
      initialized: !!this.bot,
      themesAvailable: this.monthlyThemes.length,
      themes: this.monthlyThemes.map(t => t.key),
      minWeeksRequired: this.MIN_WEEKS_FOR_REPORT,
      optimizationEnabled: true,
      status: this.isReady() ? 'ready' : 'not_initialized'
    };
  }

  /**
   * Проверяет готовность сервиса
   */
  isReady() {
    return !!this.bot;
  }
}

module.exports = MonthlyReportService;
