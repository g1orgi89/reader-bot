/**
 * Clean Weekly Report Handler - simple reports for Reader bot
 * @file telegram/handlers/weeklyReportHandler.js
 * 🎨 CLEAN UX: Simple text reports, no visual clutter
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote, WeeklyReport } = require('../../server/models');
const claudeService = require('../../server/services/claude');

class WeeklyReportHandler {
  constructor() {
    this.bot = null;
    logger.info('✅ WeeklyReportHandler initialized with clean design');
  }

  /**
   * Set bot instance
   */
  setBotInstance(bot) {
    this.bot = bot;
  }

  /**
   * Generate weekly report for user
   */
  async generateWeeklyReport(userId) {
    try {
      const user = await UserProfile.findOne({ userId });
      if (!user || !user.isOnboardingComplete) {
        logger.warn(`User ${userId} not found or onboarding incomplete`);
        return null;
      }

      const weekNumber = this._getCurrentWeekNumber();
      const year = new Date().getFullYear();

      // Check if report already sent
      const existingReport = await WeeklyReport.findOne({ userId, weekNumber, year });
      if (existingReport) {
        logger.info(`Weekly report already exists for user ${userId}, week ${weekNumber}`);
        return existingReport;
      }

      // Get quotes for this week
      const weekQuotes = await Quote.find({
        userId,
        weekNumber,
        yearNumber: year
      }).sort({ createdAt: 1 });

      if (weekQuotes.length === 0) {
        await this._sendEmptyWeekReport(userId, user);
        return null;
      }

      // Generate AI analysis
      const analysis = await this._analyzeWeeklyQuotes(weekQuotes, user);
      
      // Get book recommendations
      const recommendations = await this._getBookRecommendations(analysis, user);
      
      // Generate promo code
      const promoCode = this._generatePromoCode();

      // Create report
      const report = new WeeklyReport({
        userId,
        weekNumber,
        year,
        quotes: weekQuotes.map(q => q._id),
        analysis,
        recommendations,
        promoCode
      });

      await report.save();

      // Send report
      await this._sendWeeklyReport(userId, report, weekQuotes, user);

      return report;
      
    } catch (error) {
      logger.error(`Error generating weekly report for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Send weekly report to user
   * @private
   */
  async _sendWeeklyReport(userId, report, quotes, user) {
    try {
      if (!this.bot) {
        logger.error('Bot instance not set');
        return;
      }

      // Format quotes list
      const quotesText = quotes.map((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        return `• "${quote.text}"${author}`;
      }).join('\n');

      // Format recommendations
      let recommendationsText = '';
      if (report.recommendations && report.recommendations.length > 0) {
        recommendationsText = report.recommendations.map((rec, index) => {
          return `📚 "${rec.title}" - ${rec.price}\n   ${rec.description}`;
        }).join('\n\n');
      }

      const reportMessage = 
        `📊 Ваш отчет за неделю\n\n` +
        `Здравствуйте, ${user.name}!\n\n` +
        `За эту неделю вы сохранили ${quotes.length} ${this._getDeclension(quotes.length, 'цитату', 'цитаты', 'цитат')}:\n\n` +
        `${quotesText}\n\n` +
        `🎯 Анализ недели:\n${report.analysis.insights}\n\n`;

      let finalMessage = reportMessage;

      if (recommendationsText) {
        finalMessage += `💎 Рекомендации от Анны:\n${recommendationsText}\n\n`;
      }

      if (report.promoCode) {
        finalMessage += 
          `🎁 Промокод ${report.promoCode.code} - скидка ${report.promoCode.discount}% ` +
          `до ${report.promoCode.validUntil.toLocaleDateString('ru-RU')}!\n\n`;
      }

      finalMessage += '💬 Как вам этот отчет?';

      // Send with feedback buttons
      await this.bot.telegram.sendMessage(userId, finalMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👍 Отлично", callback_data: `feedback_excellent_${report._id}` },
              { text: "👌 Хорошо", callback_data: `feedback_good_${report._id}` },
              { text: "👎 Плохо", callback_data: `feedback_bad_${report._id}` }
            ]
          ]
        }
      });

      logger.info(`Weekly report sent to user ${userId}`);
      
    } catch (error) {
      logger.error(`Error sending weekly report: ${error.message}`);
    }
  }

  /**
   * Send empty week report
   * @private
   */
  async _sendEmptyWeekReport(userId, user) {
    try {
      if (!this.bot) return;

      const encouragementMessage = 
        `📖 Отчет за неделю\n\n` +
        `Здравствуйте, ${user.name}!\n\n` +
        `На этой неделе вы не сохранили ни одной цитаты.\n\n` +
        `💭 Помните: "Хватит сидеть в телефоне - читайте книги!"\n\n` +
        `Каждая цитата - это ступенька к лучшему пониманию себя. ` +
        `Начните с одной прямо сейчас!\n\n` +
        `📚 Попробуйте найти что-то вдохновляющее в книге, которую читаете, ` +
        `или вспомните мудрые слова, которые когда-то вас тронули.`;

      await this.bot.telegram.sendMessage(userId, encouragementMessage);
      
    } catch (error) {
      logger.error(`Error sending empty week report: ${error.message}`);
    }
  }

  /**
   * Analyze weekly quotes with AI
   * @private
   */
  async _analyzeWeeklyQuotes(quotes, userProfile) {
    try {
      const quotesText = quotes.map(q => `"${q.text}" ${q.author ? `(${q.author})` : ''}`).join('\n\n');
      
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
  "emotionalTone": "позитивный/нейтральный/задумчивый/etc",
  "insights": "Подробный психологический анализ от Анны"
}`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'weekly_report'
      });
      
      return JSON.parse(response.message);
    } catch (error) {
      logger.error(`Error analyzing weekly quotes: ${error.message}`);
      
      // Fallback analysis
      return {
        summary: "Ваши цитаты отражают глубокий внутренний поиск",
        dominantThemes: ["саморазвитие", "мудрость"],
        emotionalTone: "позитивный",
        insights: "Эта неделя показывает ваш интерес к глубоким жизненным вопросам. Вы ищете ответы и вдохновение в словах мудрых людей."
      };
    }
  }

  /**
   * Get book recommendations
   * @private
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

Максимум 2 рекомендации, самые подходящие.`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram', 
        userId: 'book_recommendations'
      });
      
      const recommendations = JSON.parse(response.message);
      
      // Add UTM links
      return recommendations.map(rec => ({
        ...rec,
        link: this._generateUTMLink(rec.title, userProfile.userId)
      }));
    } catch (error) {
      logger.error(`Error getting book recommendations: ${error.message}`);
      
      // Fallback recommendation
      return [
        {
          title: "Искусство любить",
          price: "$8",
          description: "О построении здоровых отношений с собой и миром",
          reasoning: "Подходит для глубокого самопознания",
          link: this._generateUTMLink("Искусство любить", userProfile.userId)
        }
      ];
    }
  }

  /**
   * Generate promo code
   * @private
   */
  _generatePromoCode() {
    const codes = ['READER20', 'WISDOM20', 'QUOTES20', 'BOOKS20'];
    return {
      code: codes[Math.floor(Math.random() * codes.length)],
      discount: 20,
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
    };
  }

  /**
   * Generate UTM link
   * @private
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
   * Get current week number
   * @private
   */
  _getCurrentWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
  }

  /**
   * Get word declension
   * @private
   */
  _getDeclension(count, one, few, many) {
    if (count % 10 === 1 && count % 100 !== 11) return one;
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return few;
    return many;
  }

  /**
   * Handle feedback callback
   */
  async handleFeedback(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;
      
      if (!callbackData.startsWith('feedback_')) return false;

      const parts = callbackData.split('_');
      const rating = parts[1]; // excellent, good, bad
      const reportId = parts[2];

      // Update report with feedback
      const updateData = {
        'feedback.rating': this._convertRatingToNumber(rating),
        'feedback.respondedAt': new Date()
      };

      await WeeklyReport.findByIdAndUpdate(reportId, updateData);

      let responseMessage;
      switch (rating) {
        case 'excellent':
          responseMessage = "🎉 Спасибо за отзыв! Рада, что отчет оказался полезным.";
          break;
        case 'good':
          responseMessage = "👌 Спасибо за отзыв! Продолжаем улучшать отчеты.";
          break;
        case 'bad':
          responseMessage = "😔 Извините, что отчет не оправдал ожиданий. Мы работаем над улучшениями.";
          break;
        default:
          responseMessage = "Спасибо за отзыв!";
      }

      await ctx.answerCbQuery(responseMessage);
      
      // Update message to remove buttons
      const originalText = ctx.callbackQuery.message.text;
      const updatedText = originalText.replace('💬 Как вам этот отчет?', `📝 Спасибо за оценку "${rating}"!`);
      
      await ctx.editMessageText(updatedText);

      return true;
      
    } catch (error) {
      logger.error(`Error handling feedback: ${error.message}`);
      await ctx.answerCbQuery('Произошла ошибка');
      return false;
    }
  }

  /**
   * Convert rating to number
   * @private
   */
  _convertRatingToNumber(rating) {
    switch (rating) {
      case 'excellent': return 5;
      case 'good': return 4;
      case 'bad': return 2;
      default: return 3;
    }
  }

  /**
   * Generate reports for all active users
   */
  async generateWeeklyReportsForAllUsers() {
    try {
      const activeUsers = await UserProfile.find({
        isOnboardingComplete: true,
        'settings.reminderEnabled': true
      });

      logger.info(`Generating weekly reports for ${activeUsers.length} users`);

      for (const user of activeUsers) {
        try {
          await this.generateWeeklyReport(user.userId);
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Failed to generate report for user ${user.userId}: ${error.message}`);
        }
      }

      logger.info('Weekly reports generation completed');
      
    } catch (error) {
      logger.error(`Error generating weekly reports for all users: ${error.message}`);
    }
  }
}

module.exports = { WeeklyReportHandler };
