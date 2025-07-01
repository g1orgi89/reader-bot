/**
 * @fileoverview Сервис генерации еженедельных отчетов для проекта "Читатель"
 * @author g1orgi89
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const claudeService = require('./claude');

/**
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/reader').WeeklyAnalysis} WeeklyAnalysis
 * @typedef {import('../types/reader').BookRecommendation} BookRecommendation
 * @typedef {import('../types/reader').PromoCodeData} PromoCodeData
 */

/**
 * @class WeeklyReportService
 * @description Сервис для генерации еженедельных отчетов с AI-анализом
 */
class WeeklyReportService {
  constructor() {
    this.WeeklyReport = null;
    this.Quote = null;
    this.UserProfile = null;
    
    // Инициализация моделей
    this._initializeModels();
  }

  /**
   * Инициализация моделей MongoDB
   * @private
   */
  _initializeModels() {
    try {
      this.WeeklyReport = require('../models/weeklyReport');
      this.Quote = require('../models/quote');
      this.UserProfile = require('../models/userProfile');
      logger.info('📖 WeeklyReportService models initialized');
    } catch (error) {
      logger.error(`📖 Failed to initialize models: ${error.message}`);
    }
  }

  /**
   * Генерация еженедельного отчета для пользователя
   * @param {string} userId - ID пользователя Telegram
   * @returns {Promise<WeeklyReport|null>} Созданный отчет или null
   */
  async generateWeeklyReport(userId) {
    try {
      const user = await this.UserProfile.findOne({ userId });
      if (!user || !user.isOnboardingComplete) {
        logger.warn(`📖 User ${userId} not found or onboarding incomplete`);
        return null;
      }

      const { weekNumber, year } = this._getCurrentWeek();
      
      // Проверяем, не отправляли ли уже отчет
      const existingReport = await this.WeeklyReport.findByUserWeek(userId, weekNumber, year);
      if (existingReport) {
        logger.info(`📖 Weekly report for user ${userId} week ${weekNumber}/${year} already exists`);
        return existingReport;
      }

      // Получаем цитаты за неделю
      const weekQuotes = await this.Quote.getWeeklyQuotes(userId, weekNumber, year);
      
      if (weekQuotes.length === 0) {
        logger.info(`📖 No quotes for user ${userId} week ${weekNumber}/${year}, sending encouragement`);
        return await this._generateEmptyWeekReport(userId, user);
      }

      logger.info(`📖 Generating weekly report for user ${userId} with ${weekQuotes.length} quotes`);

      // AI-анализ недели через Claude
      const analysis = await this._analyzeWeeklyQuotes(weekQuotes, user);
      
      // Подбор рекомендаций книг
      const recommendations = await this._getBookRecommendations(analysis, user);
      
      // Генерация промокода
      const promoCode = this._generatePromoCode();

      // Создание отчета
      const report = new this.WeeklyReport({
        userId,
        weekNumber,
        year,
        quotes: weekQuotes.map(q => q._id),
        analysis,
        recommendations,
        promoCode
      });

      await report.save();
      logger.info(`📖 Weekly report created for user ${userId}: ${report._id}`);

      return report;
    } catch (error) {
      logger.error(`📖 Error generating weekly report for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * AI-анализ цитат за неделю через Claude
   * @private
   * @param {Array} quotes - Цитаты за неделю
   * @param {Object} userProfile - Профиль пользователя
   * @returns {Promise<WeeklyAnalysis>} Анализ недели
   */
  async _analyzeWeeklyQuotes(quotes, userProfile) {
    try {
      const quotesText = quotes.map(q => 
        `"${q.text}" ${q.author ? `(${q.author})` : ''}`
      ).join('\n\n');
      
      const prompt = `Ты психолог Анна Бусел. Проанализируй цитаты пользователя за неделю и дай психологический анализ.

Имя пользователя: ${userProfile.name}
Результаты теста: ${JSON.stringify(userProfile.testResults)}

Цитаты за неделю:
${quotesText}

Напиши анализ в стиле Анны Бусел:
- Тон: теплый, профессиональный, обращение на "Вы"
- Глубокий психологический анализ
- Связь с результатами первоначального теста
- Выводы о текущем состоянии и интересах
- 2-3 абзаца

Верни JSON:
{
  "summary": "Краткий анализ недели одним предложением",
  "dominantThemes": ["тема1", "тема2"],
  "emotionalTone": "позитивный/нейтральный/задумчивый/вдохновляющий/меланхоличный/энергичный",
  "insights": "Подробный психологический анализ от Анны"
}`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'weekly_report_analysis'
      });
      
      try {
        const analysis = JSON.parse(response.message);
        
        // Валидация структуры
        if (!analysis.summary || !analysis.insights || !analysis.emotionalTone) {
          throw new Error('Invalid analysis structure');
        }
        
        return {
          summary: analysis.summary.substring(0, 500),
          dominantThemes: analysis.dominantThemes || ['саморазвитие'],
          emotionalTone: analysis.emotionalTone || 'позитивный',
          insights: analysis.insights.substring(0, 2000)
        };
      } catch (parseError) {
        logger.error(`📖 Failed to parse AI analysis: ${parseError.message}`);
        return this._getFallbackAnalysis(quotes, userProfile);
      }
    } catch (error) {
      logger.error(`📖 Error in AI analysis: ${error.message}`);
      return this._getFallbackAnalysis(quotes, userProfile);
    }
  }

  /**
   * Подбор рекомендаций книг на основе анализа
   * @private
   * @param {WeeklyAnalysis} analysis - Анализ недели
   * @param {Object} userProfile - Профиль пользователя
   * @returns {Promise<BookRecommendation[]>} Рекомендации книг
   */
  async _getBookRecommendations(analysis, userProfile) {
    try {
      const prompt = `Ты психолог Анна Бусел. На основе анализа недели пользователя, подбери 2-3 рекомендации из твоих разборов книг.

Имя: ${userProfile.name}
Анализ недели: ${analysis.insights}
Доминирующие темы: ${analysis.dominantThemes.join(', ')}

Доступные разборы книг Анны Бусел:
- "Искусство любить" Эриха Фромма ($8) - о построении здоровых отношений
- "Письма к молодому поэту" Рильке ($8) - о творчестве и самопознании
- "Быть собой" курс ($12) - о самопринятии и аутентичности
- "Женщина, которая читает, опасна" ($10) - о женственности и силе
- "Алхимик" Пауло Коэльо ($8) - о поиске смысла жизни
- "Маленький принц" ($6) - о простых истинах жизни

Верни JSON массив рекомендаций:
[
  {
    "title": "Название книги/курса",
    "price": "$8",
    "description": "Краткое описание почему подходит",
    "reasoning": "Почему именно эта книга подойдет пользователю на основе анализа"
  }
]

Максимум 3 рекомендации, самые подходящие.`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'book_recommendations'
      });
      
      try {
        const recommendations = JSON.parse(response.message);
        
        // Добавляем UTM ссылки
        return recommendations.map(rec => ({
          title: rec.title,
          description: rec.description.substring(0, 500),
          price: rec.price,
          reasoning: rec.reasoning.substring(0, 300),
          link: this._generateUTMLink(rec.title, userProfile.userId)
        }));
      } catch (parseError) {
        logger.error(`📖 Failed to parse book recommendations: ${parseError.message}`);
        return this._getFallbackRecommendations(userProfile.userId);
      }
    } catch (error) {
      logger.error(`📖 Error getting book recommendations: ${error.message}`);
      return this._getFallbackRecommendations(userProfile.userId);
    }
  }

  /**
   * Генерация промокода
   * @private
   * @returns {PromoCodeData} Данные промокода
   */
  _generatePromoCode() {
    const codes = ['READER20', 'WISDOM20', 'QUOTES20', 'BOOKS20'];
    const selectedCode = codes[Math.floor(Math.random() * codes.length)];
    
    return {
      code: selectedCode,
      discount: 20,
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 дня
    };
  }

  /**
   * Генерация UTM ссылки
   * @private
   * @param {string} bookTitle - Название книги
   * @param {string} userId - ID пользователя
   * @returns {string} UTM ссылка
   */
  _generateUTMLink(bookTitle, userId) {
    const baseUrl = "https://anna-busel.com/books";
    const utmParams = new URLSearchParams({
      utm_source: 'telegram_bot',
      utm_medium: 'weekly_report',
      utm_campaign: 'reader_recommendations',
      utm_content: bookTitle.toLowerCase().replace(/\s+/g, '_'),
      user_id: userId
    });
    
    return `${baseUrl}?${utmParams.toString()}`;
  }

  /**
   * Генерация отчета для пустой недели
   * @private
   * @param {string} userId - ID пользователя
   * @param {Object} user - Профиль пользователя
   * @returns {Promise<null>} null - отчет не создается
   */
  async _generateEmptyWeekReport(userId, user) {
    // Для пустых недель отчет не создается в БД, только отправляется сообщение
    logger.info(`📖 Generated empty week encouragement for user ${userId}`);
    return null;
  }

  /**
   * Резервный анализ при ошибке AI
   * @private
   * @param {Array} quotes - Цитаты
   * @param {Object} userProfile - Профиль пользователя
   * @returns {WeeklyAnalysis} Резервный анализ
   */
  _getFallbackAnalysis(quotes, userProfile) {
    const themes = this._extractThemesFromQuotes(quotes);
    
    return {
      summary: "Ваши цитаты отражают глубокий внутренний поиск и стремление к мудрости",
      dominantThemes: themes,
      emotionalTone: "позитивный",
      insights: `${userProfile.name}, эта неделя показывает ваш интерес к глубоким жизненным вопросам. Вы ищете ответы и вдохновение в словах мудрых людей. Ваши цитаты говорят о стремлении к росту и пониманию себя.`
    };
  }

  /**
   * Извлечение тем из цитат (резервный метод)
   * @private
   * @param {Array} quotes - Цитаты
   * @returns {string[]} Темы
   */
  _extractThemesFromQuotes(quotes) {
    const themes = new Set();
    
    quotes.forEach(quote => {
      if (quote.category && quote.category !== 'Другое') {
        themes.add(quote.category.toLowerCase());
      }
      if (quote.themes && quote.themes.length > 0) {
        quote.themes.forEach(theme => themes.add(theme.toLowerCase()));
      }
    });
    
    return Array.from(themes).slice(0, 3);
  }

  /**
   * Резервные рекомендации
   * @private
   * @param {string} userId - ID пользователя
   * @returns {BookRecommendation[]} Резервные рекомендации
   */
  _getFallbackRecommendations(userId) {
    return [
      {
        title: "Искусство любить",
        price: "$8",
        description: "О построении здоровых отношений с собой и миром",
        reasoning: "Подходит для глубокого самопознания",
        link: this._generateUTMLink("Искусство любить", userId)
      }
    ];
  }

  /**
   * Получение текущей недели
   * @private
   * @returns {Object} Номер недели и год
   */
  _getCurrentWeek() {
    const now = new Date();
    const weekNumber = this._getWeekNumber(now);
    const year = now.getFullYear();
    
    return { weekNumber, year };
  }

  /**
   * Получение номера недели ISO 8601
   * @private
   * @param {Date} date - Дата
   * @returns {number} Номер недели
   */
  _getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Склонение слова "цитата"
   * @private
   * @param {number} count - Количество
   * @returns {string} Правильное склонение
   */
  _declensionQuotes(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  }

  /**
   * Генерация отчетов для всех активных пользователей
   * @param {number} [weekNumber] - Номер недели (по умолчанию текущая)
   * @param {number} [year] - Год (по умолчанию текущий)
   * @returns {Promise<Object>} Статистика генерации
   */
  async generateWeeklyReportsForAllUsers(weekNumber = null, year = null) {
    try {
      const { weekNumber: currentWeek, year: currentYear } = this._getCurrentWeek();
      const targetWeek = weekNumber || currentWeek;
      const targetYear = year || currentYear;

      logger.info(`📖 Starting bulk weekly report generation for week ${targetWeek}/${targetYear}`);

      // Получаем пользователей, которым нужны отчеты
      const usersNeedingReports = await this.WeeklyReport.getUsersNeedingReports(targetWeek, targetYear);
      
      let generated = 0;
      let skipped = 0;
      let errors = 0;

      for (const user of usersNeedingReports) {
        try {
          const report = await this.generateWeeklyReport(user.userId);
          if (report) {
            generated++;
            logger.info(`📖 Generated report for user ${user.userId}`);
          } else {
            skipped++;
            logger.info(`📖 Skipped report for user ${user.userId} (no quotes)`);
          }
        } catch (error) {
          errors++;
          logger.error(`📖 Failed to generate report for user ${user.userId}: ${error.message}`);
        }
      }

      const stats = {
        week: `${targetWeek}/${targetYear}`,
        totalUsers: usersNeedingReports.length,
        generated,
        skipped,
        errors,
        timestamp: new Date()
      };

      logger.info(`📖 Bulk report generation completed: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      logger.error(`📖 Error in bulk report generation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получение статистики отчетов
   * @param {number} [days=30] - Количество дней для анализа
   * @returns {Promise<Object>} Статистика
   */
  async getReportsStatistics(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        totalReports,
        reportsWithFeedback,
        avgRating,
        topThemes,
        feedbackDistribution
      ] = await Promise.all([
        this.WeeklyReport.countDocuments({ sentAt: { $gte: startDate } }),
        this.WeeklyReport.countDocuments({ 
          sentAt: { $gte: startDate },
          'feedback.rating': { $exists: true }
        }),
        this.WeeklyReport.aggregate([
          { $match: { sentAt: { $gte: startDate }, 'feedback.rating': { $exists: true } } },
          { $group: { _id: null, avgRating: { $avg: '$feedback.rating' } } }
        ]),
        this.WeeklyReport.getPopularThemes(startDate),
        this.WeeklyReport.getFeedbackDistribution(startDate)
      ]);

      return {
        period: `${days} days`,
        totalReports,
        reportsWithFeedback,
        feedbackRate: totalReports > 0 ? Math.round((reportsWithFeedback / totalReports) * 100) : 0,
        averageRating: avgRating.length > 0 ? Number(avgRating[0].avgRating.toFixed(2)) : null,
        topThemes: topThemes.slice(0, 5),
        feedbackDistribution,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`📖 Error getting reports statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получение отчетов пользователя
   * @param {string} userId - ID пользователя
   * @param {number} [limit=10] - Лимит отчетов
   * @returns {Promise<Array>} Отчеты пользователя
   */
  async getUserReports(userId, limit = 10) {
    try {
      return await this.WeeklyReport.getUserRecentReports(userId, limit);
    } catch (error) {
      logger.error(`📖 Error getting user reports for ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Отметить отчет как прочитанный
   * @param {string} reportId - ID отчета
   * @returns {Promise<WeeklyReport>} Обновленный отчет
   */
  async markReportAsRead(reportId) {
    try {
      const report = await this.WeeklyReport.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }
      
      return await report.markAsRead();
    } catch (error) {
      logger.error(`📖 Error marking report as read ${reportId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Добавить обратную связь к отчету
   * @param {string} reportId - ID отчета
   * @param {number} rating - Оценка 1-5
   * @param {string} [comment] - Комментарий
   * @returns {Promise<WeeklyReport>} Обновленный отчет
   */
  async addReportFeedback(reportId, rating, comment = null) {
    try {
      const report = await this.WeeklyReport.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }
      
      return await report.addFeedback(rating, comment);
    } catch (error) {
      logger.error(`📖 Error adding feedback to report ${reportId}: ${error.message}`);
      throw error;
    }
  }
}

// Экспортируем единственный экземпляр
module.exports = new WeeklyReportService();