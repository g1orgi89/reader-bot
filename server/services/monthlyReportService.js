/**
 * @fileoverview Сервис генерации месячных отчетов для проекта "Читатель"
 * @author g1orgi89
 */

const logger = require('../utils/logger');

/**
 * @typedef {import('../types/reader').UserProfile} UserProfile
 * @typedef {import('../types/reader').Quote} Quote
 * @typedef {import('../types/reader').MonthlyReport} MonthlyReport
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/reader').MonthlyAnalysis} MonthlyAnalysis
 */

/**
 * Сервис месячных отчетов с дополнительным опросом
 */
class MonthlyReportService {
  constructor() {
    this.claudeService = null;
    this.bot = null;
    this.models = null;
    
    logger.info('📖 MonthlyReportService initialized');
  }

  /**
   * Инициализация сервиса с зависимостями
   * @param {Object} dependencies - Зависимости
   * @param {Object} dependencies.claudeService - Сервис Claude
   * @param {Object} dependencies.bot - Telegram bot
   * @param {Object} dependencies.models - Модели базы данных
   */
  initialize(dependencies) {
    this.claudeService = dependencies.claudeService;
    this.bot = dependencies.bot;
    this.models = dependencies.models;
    
    logger.info('📖 MonthlyReportService dependencies initialized');
  }

  /**
   * Генерация месячного отчета для пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<MonthlyReport|null>}
   */
  async generateMonthlyReport(userId) {
    try {
      const { UserProfile, MonthlyReport } = this.models;
      const user = await UserProfile.findOne({ userId });
      
      if (!user) {
        logger.warn(`📖 User ${userId} not found for monthly report`);
        return null;
      }

      // Проверяем, достаточно ли времени прошло (минимум месяц)
      const monthsSinceRegistration = this.getMonthsSinceRegistration(user.registeredAt);
      if (monthsSinceRegistration < 1) {
        logger.info(`📖 User ${userId} registered recently, skipping monthly report`);
        return null;
      }

      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();

      // Проверяем, не отправляли ли уже отчет в этом месяце
      const existingReport = await MonthlyReport.findByUserMonth(userId, month, year);
      if (existingReport) {
        logger.info(`📖 Monthly report for user ${userId} already exists for ${year}-${month}`);
        return existingReport;
      }

      // Сначала отправляем дополнительный опрос
      await this.sendAdditionalSurvey(userId, user);
      
      return null; // Отчет будет создан после ответа на опрос
      
    } catch (error) {
      logger.error(`📖 Error generating monthly report for user ${userId}: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Отправка дополнительного опроса
   * @param {string} userId - ID пользователя
   * @param {UserProfile} user - Профиль пользователя
   * @returns {Promise<void>}
   */
  async sendAdditionalSurvey(userId, user) {
    try {
      const surveyMessage = `📝 *Дополнительный опрос для точности разбора*

Здравствуйте, ${user.name}! Вы с ботом уже месяц. Время подвести итоги и создать персональный психологический анализ.

Сначала небольшой вопрос для точности:

*Как вы ощущали этот месяц? Выберите главную тему:*`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔍 Поиск уверенности", callback_data: "monthly_survey_confidence" }],
          [{ text: "🌸 Женственность и нежность", callback_data: "monthly_survey_femininity" }],
          [{ text: "⚖️ Баланс между «дать» и «взять»", callback_data: "monthly_survey_balance" }],
          [{ text: "💕 Любовь и отношения", callback_data: "monthly_survey_love" }],
          [{ text: "✨ Вдохновение и рост", callback_data: "monthly_survey_growth" }],
          [{ text: "👶 Материнство и семья", callback_data: "monthly_survey_family" }]
        ]
      };

      await this.bot.telegram.sendMessage(userId, surveyMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      // Устанавливаем состояние ожидания ответа
      await this.setUserState(userId, 'awaiting_monthly_survey');
      
      logger.info(`📖 Monthly survey sent to user ${userId}`);
      
    } catch (error) {
      logger.error(`📖 Error sending survey to user ${userId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Обработка ответа на опрос
   * @param {string} userId - ID пользователя
   * @param {string} selectedTheme - Выбранная тема
   * @returns {Promise<MonthlyReport|null>}
   */
  async processSurveyResponse(userId, selectedTheme) {
    try {
      const { UserProfile, Quote, WeeklyReport, MonthlyReport } = this.models;
      
      const user = await UserProfile.findOne({ userId });
      if (!user) {
        logger.warn(`📖 User ${userId} not found for survey processing`);
        return null;
      }

      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();

      // Собираем данные за месяц
      const monthQuotes = await Quote.find({
        userId,
        monthNumber: month,
        yearNumber: year
      }).sort({ createdAt: 1 });

      const weeklyReports = await WeeklyReport.find({
        userId,
        year,
        // Последние 4 недели текущего месяца
        weekNumber: { 
          $gte: this.getFirstWeekOfMonth(month, year),
          $lte: this.getLastWeekOfMonth(month, year)
        }
      }).sort({ weekNumber: 1 });

      // Генерируем глубокий анализ
      const analysis = await this.generateDeepAnalysis(user, monthQuotes, weeklyReports, selectedTheme);
      
      // Подсчитываем статистику за месяц
      const monthStats = await this.calculateMonthStats(userId, month, year);

      // Создаем специальное предложение
      const specialOffer = this.createSpecialOffer(analysis);

      // Создаем месячный отчет
      const report = new MonthlyReport({
        userId,
        month,
        year,
        additionalSurvey: {
          mood: selectedTheme,
          mainTheme: selectedTheme,
          respondedAt: new Date()
        },
        analysis,
        specialOffer,
        monthStats
      });

      await report.save();

      // Отправляем полный месячный отчет
      await this.sendMonthlyReport(userId, report, monthQuotes.length);
      
      // Сбрасываем состояние пользователя
      await this.clearUserState(userId);

      logger.info(`📖 Monthly report created and sent for user ${userId}`);
      return report;
      
    } catch (error) {
      logger.error(`📖 Error processing survey for user ${userId}: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Генерация глубокого психологического анализа
   * @param {UserProfile} user - Профиль пользователя
   * @param {Quote[]} quotes - Цитаты за месяц
   * @param {WeeklyReport[]} weeklyReports - Еженедельные отчеты
   * @param {string} selectedTheme - Выбранная тема месяца
   * @returns {Promise<MonthlyAnalysis>}
   */
  async generateDeepAnalysis(user, quotes, weeklyReports, selectedTheme) {
    try {
      const quotesText = quotes.slice(0, 20).map(q => 
        `"${q.text}" ${q.author ? `(${q.author})` : ''}`
      ).join('\n\n');

      const weeklyInsights = weeklyReports.map(r => r.analysis.insights).join('\n\n');

      const prompt = `Ты психолог Анна Бусел. Создай глубокий персональный месячный анализ пользователя.

Информация о пользователе:
- Имя: ${user.name}
- Первоначальный тест: ${JSON.stringify(user.testResults)}
- Главная тема месяца (по ощущениям): ${selectedTheme}
- Зарегистрирован: ${user.registeredAt.toLocaleDateString()}
- Всего цитат за месяц: ${quotes.length}

Цитаты за месяц (первые 20):
${quotesText}

Анализы прошлых недель:
${weeklyInsights}

Создай персональный психологический анализ в стиле Анны Бусел:
- Глубокий анализ личности на основе всех данных
- Сравнение первоначального теста с реальным поведением
- Анализ эмоциональной динамики через цитаты
- Персональные рекомендации для роста
- Тон: профессиональный, теплый, обращение на "Вы"
- 4-5 абзацев

Верни JSON:
{
  "psychologicalProfile": "Детальный анализ личности",
  "personalGrowth": "Анализ роста и изменений за месяц", 
  "recommendations": "Персональные рекомендации от психолога",
  "bookSuggestions": ["книга1", "книга2", "книга3"]
}`;

      if (!this.claudeService) {
        // Fallback анализ если Claude недоступен
        return this.createFallbackAnalysis(selectedTheme, quotes.length);
      }

      const response = await this.claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'monthly_analysis'
      });
      
      // Парсим JSON ответ
      const analysis = JSON.parse(response.message);
      
      // Валидируем структуру
      if (!analysis.psychologicalProfile || !analysis.personalGrowth || !analysis.recommendations) {
        throw new Error('Invalid analysis structure from Claude');
      }

      return analysis;
      
    } catch (error) {
      logger.error(`📖 Error generating analysis: ${error.message}`, error);
      return this.createFallbackAnalysis(selectedTheme, quotes.length);
    }
  }

  /**
   * Создание fallback анализа
   * @param {string} selectedTheme - Выбранная тема
   * @param {number} quotesCount - Количество цитат
   * @returns {MonthlyAnalysis}
   */
  createFallbackAnalysis(selectedTheme, quotesCount) {
    return {
      psychologicalProfile: `Этот месяц показал вашу глубокую потребность в ${selectedTheme.toLowerCase()}. Ваши ${quotesCount} цитат отражают внутренний поиск и стремление к пониманию себя.`,
      personalGrowth: "За месяц вы продемонстрировали стабильный интерес к саморазвитию и мудрости великих людей.",
      recommendations: "Продолжайте изучать себя через литературу. Особое внимание стоит уделить книгам по психологии и личностному росту.",
      bookSuggestions: ["Искусство любить", "Быть собой", "Письма к молодому поэту"]
    };
  }

  /**
   * Отправка месячного отчета
   * @param {string} userId - ID пользователя
   * @param {MonthlyReport} report - Отчет
   * @param {number} quotesCount - Количество цитат
   * @returns {Promise<void>}
   */
  async sendMonthlyReport(userId, report, quotesCount) {
    try {
      const reportMessage = report.toTelegramFormat();

      const keyboard = {
        inline_keyboard: [
          [{ text: "⭐⭐⭐⭐⭐", callback_data: `monthly_rating_5_${report._id}` }],
          [{ text: "⭐⭐⭐⭐", callback_data: `monthly_rating_4_${report._id}` }],
          [{ text: "⭐⭐⭐", callback_data: `monthly_rating_3_${report._id}` }],
          [{ text: "⭐⭐", callback_data: `monthly_rating_2_${report._id}` }],
          [{ text: "⭐", callback_data: `monthly_rating_1_${report._id}` }]
        ]
      };

      const sentMessage = await this.bot.telegram.sendMessage(userId, reportMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      // Сохраняем ID сообщения
      report.telegramMessageId = sentMessage.message_id.toString();
      await report.save();

      logger.info(`📖 Monthly report sent to user ${userId}`);
      
    } catch (error) {
      logger.error(`📖 Error sending monthly report to user ${userId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Создание специального предложения
   * @param {MonthlyAnalysis} analysis - Анализ пользователя
   * @returns {Object} Специальное предложение
   */
  createSpecialOffer(analysis) {
    return {
      discount: 25,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
      books: analysis.bookSuggestions || ["Искусство любить", "Быть собой"],
      promoCode: `MONTH25`
    };
  }

  /**
   * Подсчет статистики за месяц
   * @param {string} userId - ID пользователя
   * @param {number} month - Месяц
   * @param {number} year - Год
   * @returns {Promise<Object>} Статистика
   */
  async calculateMonthStats(userId, month, year) {
    try {
      const { Quote } = this.models;
      
      const quotes = await Quote.find({
        userId,
        monthNumber: month,
        yearNumber: year
      });

      // Подсчитываем категории
      const categoriesMap = new Map();
      quotes.forEach(quote => {
        if (quote.category) {
          categoriesMap.set(quote.category, (categoriesMap.get(quote.category) || 0) + 1);
        }
      });

      // Подсчитываем уникальных авторов
      const uniqueAuthors = new Set();
      quotes.forEach(quote => {
        if (quote.author) {
          uniqueAuthors.add(quote.author);
        }
      });

      // Подсчитываем среднее количество цитат в неделю
      const weeksInMonth = 4;
      const averageQuotesPerWeek = Math.round((quotes.length / weeksInMonth) * 10) / 10;

      // Подсчитываем самую длинную серию
      const longestStreak = await this.calculateLongestStreakForMonth(userId, month, year);

      return {
        totalQuotes: quotes.length,
        categoriesDistribution: Object.fromEntries(categoriesMap),
        authorsCount: uniqueAuthors.size,
        averageQuotesPerWeek,
        longestStreak
      };
      
    } catch (error) {
      logger.error(`📖 Error calculating month stats: ${error.message}`, error);
      return {
        totalQuotes: 0,
        categoriesDistribution: {},
        authorsCount: 0,
        averageQuotesPerWeek: 0,
        longestStreak: 0
      };
    }
  }

  /**
   * Вспомогательные методы
   */

  /**
   * Получение количества месяцев с регистрации
   * @param {Date} registrationDate - Дата регистрации
   * @returns {number} Количество месяцев
   */
  getMonthsSinceRegistration(registrationDate) {
    const now = new Date();
    const diffTime = Math.abs(now - registrationDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 30);
  }

  /**
   * Получение первой недели месяца
   * @param {number} month - Месяц
   * @param {number} year - Год
   * @returns {number} Номер недели
   */
  getFirstWeekOfMonth(month, year) {
    const firstDay = new Date(year, month - 1, 1);
    return this.getWeekNumber(firstDay);
  }

  /**
   * Получение последней недели месяца
   * @param {number} month - Месяц
   * @param {number} year - Год
   * @returns {number} Номер недели
   */
  getLastWeekOfMonth(month, year) {
    const lastDay = new Date(year, month, 0); // Последний день месяца
    return this.getWeekNumber(lastDay);
  }

  /**
   * Получение номера недели для даты
   * @param {Date} date - Дата
   * @returns {number} Номер недели
   */
  getWeekNumber(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  }

  /**
   * Подсчет самой длинной серии за месяц
   * @param {string} userId - ID пользователя
   * @param {number} month - Месяц
   * @param {number} year - Год
   * @returns {Promise<number>} Самая длинная серия дней
   */
  async calculateLongestStreakForMonth(userId, month, year) {
    try {
      const { Quote } = this.models;
      
      // Получаем все дни месяца с цитатами
      const quotes = await Quote.find({
        userId,
        monthNumber: month,
        yearNumber: year
      }).sort({ createdAt: 1 });

      if (quotes.length === 0) return 0;

      // Группируем по дням
      const daysSet = new Set();
      quotes.forEach(quote => {
        const day = quote.createdAt.toISOString().split('T')[0];
        daysSet.add(day);
      });

      const days = Array.from(daysSet).sort();
      
      let longestStreak = 0;
      let currentStreak = 1;

      for (let i = 1; i < days.length; i++) {
        const prevDate = new Date(days[i - 1]);
        const currDate = new Date(days[i]);
        const diffTime = currDate - prevDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          currentStreak++;
        } else {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
      }

      return Math.max(longestStreak, currentStreak);
      
    } catch (error) {
      logger.error(`📖 Error calculating longest streak: ${error.message}`, error);
      return 0;
    }
  }

  /**
   * Установка состояния пользователя
   * @param {string} userId - ID пользователя
   * @param {string} state - Состояние
   * @returns {Promise<void>}
   */
  async setUserState(userId, state) {
    try {
      const { UserProfile } = this.models;
      await UserProfile.findOneAndUpdate(
        { userId },
        { currentState: state },
        { upsert: true }
      );
    } catch (error) {
      logger.error(`📖 Error setting user state: ${error.message}`, error);
    }
  }

  /**
   * Очистка состояния пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async clearUserState(userId) {
    try {
      const { UserProfile } = this.models;
      await UserProfile.findOneAndUpdate(
        { userId },
        { $unset: { currentState: 1 } }
      );
    } catch (error) {
      logger.error(`📖 Error clearing user state: ${error.message}`, error);
    }
  }

  /**
   * Получение пользователей, которым нужно отправить месячные отчеты
   * @returns {Promise<UserProfile[]>} Пользователи
   */
  async getUsersNeedingMonthlyReports() {
    try {
      const { UserProfile, MonthlyReport } = this.models;
      
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();

      // Получаем активных пользователей, зарегистрированных минимум месяц назад
      const eligibleUsers = await UserProfile.find({
        registeredAt: { $lte: oneMonthAgo },
        isOnboardingComplete: true,
        'statistics.totalQuotes': { $gte: 5 } // Минимум 5 цитат за все время
      });

      // Фильтруем тех, у кого уже есть отчет за этот месяц
      const usersWithReports = await MonthlyReport.distinct('userId', { month, year });
      
      const usersNeedingReports = eligibleUsers.filter(user => 
        !usersWithReports.includes(user.userId)
      );

      logger.info(`📖 Found ${usersNeedingReports.length} users needing monthly reports`);
      return usersNeedingReports;
      
    } catch (error) {
      logger.error(`📖 Error getting users for monthly reports: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Генерация месячных отчетов для всех пользователей
   * @returns {Promise<Object>} Статистика генерации
   */
  async generateMonthlyReportsForAllUsers() {
    try {
      const users = await this.getUsersNeedingMonthlyReports();
      
      let generated = 0;
      let failed = 0;
      const errors = [];

      logger.info(`📖 Starting monthly report generation for ${users.length} users`);

      for (const user of users) {
        try {
          await this.generateMonthlyReport(user.userId);
          generated++;
          
          // Небольшая задержка между отправками
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          failed++;
          errors.push({ userId: user.userId, error: error.message });
          logger.error(`📖 Failed to generate monthly report for ${user.userId}: ${error.message}`);
        }
      }

      const stats = {
        total: users.length,
        generated,
        failed,
        errors
      };

      logger.info(`📖 Monthly reports generation completed: ${generated} generated, ${failed} failed`);
      return stats;
      
    } catch (error) {
      logger.error(`📖 Error in generateMonthlyReportsForAllUsers: ${error.message}`, error);
      return { total: 0, generated: 0, failed: 0, errors: [error.message] };
    }
  }
}

module.exports = { MonthlyReportService };
