/**
 * @fileoverview Monthly Report Service для проекта "Читатель"
 * Генерирует месячные психологические отчеты с дополнительными опросами
 */

const { MonthlyReport, UserProfile, Quote, WeeklyReport } = require('../models');
const { claudeService } = require('./claudeService');
const { bot } = require('../../telegram');

/**
 * @typedef {Object} MonthlyAnalysis
 * @property {string} psychologicalProfile - Глубокий анализ личности
 * @property {string} personalGrowth - Анализ роста за месяц
 * @property {string} recommendations - Персональные рекомендации
 * @property {string[]} bookSuggestions - Рекомендуемые книги
 */

/**
 * @typedef {Object} SpecialOffer
 * @property {number} discount - Размер скидки в процентах
 * @property {Date} validUntil - Дата окончания действия
 * @property {string[]} books - Список книг со скидкой
 */

/**
 * @typedef {Object} MonthlyReportData
 * @property {string} userId
 * @property {number} month
 * @property {number} year
 * @property {Object} additionalSurvey
 * @property {MonthlyAnalysis} analysis
 * @property {SpecialOffer} specialOffer
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
  }

  /**
   * Генерирует месячный отчет для пользователя
   * @param {string} userId - ID пользователя в Telegram
   * @returns {Promise<MonthlyReportData|null>}
   */
  async generateMonthlyReport(userId) {
    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    // Проверяем, не отправляли ли уже отчет в этом месяце
    const existingReport = await MonthlyReport.findOne({ userId, month, year });
    if (existingReport) {
      console.log(`📈 Monthly report already exists for user ${userId} for ${month}/${year}`);
      return existingReport;
    }

    // Проверяем, что пользователь зарегистрирован больше месяца назад
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    if (user.registeredAt > oneMonthAgo) {
      console.log(`📅 User ${userId} registered less than a month ago, skipping monthly report`);
      return null;
    }

    // Сначала отправляем дополнительный опрос
    await this.sendAdditionalSurvey(userId, user);
    return null; // Отчет будет создан после ответа на опрос
  }

  /**
   * Отправляет дополнительный опрос пользователю
   * @param {string} userId - ID пользователя
   * @param {Object} user - Профиль пользователя
   */
  async sendAdditionalSurvey(userId, user) {
    const surveyMessage = `
📝 *Дополнительный опрос для точности разбора*

Здравствуйте, ${user.name}! Вы с ботом уже месяц. Время подвести итоги и создать персональный психологический анализ.

Сначала небольшой вопрос для точности:

*Как вы ощущали этот месяц? Выберите главную тему:*
    `;

    const keyboard = this.monthlyThemes.map(theme => [
      { text: theme.text, callback_data: `monthly_survey_${theme.id}` }
    ]);

    try {
      await bot.telegram.sendMessage(userId, surveyMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      // Устанавливаем состояние ожидания ответа
      await this.setUserState(userId, 'awaiting_monthly_survey');
      console.log(`📝 Monthly survey sent to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send monthly survey to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Обрабатывает ответ на месячный опрос
   * @param {string} userId - ID пользователя
   * @param {string} selectedThemeId - Выбранная тема
   */
  async processSurveyResponse(userId, selectedThemeId) {
    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const selectedTheme = this.monthlyThemes.find(t => t.id === selectedThemeId);
    if (!selectedTheme) {
      throw new Error(`Unknown theme: ${selectedThemeId}`);
    }

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    try {
      // Собираем данные за месяц
      const monthQuotes = await Quote.find({
        userId,
        monthNumber: month,
        yearNumber: year
      }).sort({ createdAt: 1 });

      const weeklyReports = await WeeklyReport.find({
        userId,
        year,
        // Последние 4-6 недель
        weekNumber: { $gte: this.getWeekNumber() - 5 }
      }).sort({ weekNumber: 1 });

      // Генерируем глубокий анализ
      const analysis = await this.generateDeepAnalysis(
        user, 
        monthQuotes, 
        weeklyReports, 
        selectedTheme.key
      );

      // Создаем месячный отчет
      const report = new MonthlyReport({
        userId,
        month,
        year,
        additionalSurvey: {
          mainTheme: selectedTheme.key,
          mood: selectedTheme.key,
          respondedAt: new Date()
        },
        analysis,
        specialOffer: {
          discount: 25,
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
          books: this.selectBooksForOffer(analysis)
        }
      });

      await report.save();

      // Отправляем полный месячный отчет
      await this.sendMonthlyReport(userId, report, monthQuotes.length);
      
      // Очищаем состояние пользователя
      await this.clearUserState(userId);

      console.log(`📈 Monthly report generated and sent to user ${userId}`);
      return report;

    } catch (error) {
      console.error(`❌ Failed to process monthly survey for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Генерирует глубокий психологический анализ
   * @param {Object} user - Профиль пользователя
   * @param {Array} quotes - Цитаты за месяц
   * @param {Array} weeklyReports - Еженедельные отчеты
   * @param {string} selectedTheme - Выбранная тема месяца
   * @returns {Promise<MonthlyAnalysis>}
   */
  async generateDeepAnalysis(user, quotes, weeklyReports, selectedTheme) {
    const quotesText = quotes.slice(0, 20).map(q => 
      `"${q.text}" ${q.author ? `(${q.author})` : ''}`
    ).join('\n\n');

    const weeklyInsights = weeklyReports.map(r => r.analysis?.insights || '').join('\n\n');

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

    try {
      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'monthly_analysis',
        context: 'monthly_report'
      });
      
      const analysis = JSON.parse(response.message);
      console.log(`🧠 Generated deep analysis for user ${user.userId}`);
      return analysis;

    } catch (error) {
      console.error('❌ Failed to generate deep analysis:', error);
      // Fallback анализ
      return {
        psychologicalProfile: `Этот месяц показал вашу глубокую потребность в ${selectedTheme.toLowerCase()}. Ваши цитаты отражают внутренний поиск и стремление к пониманию себя.`,
        personalGrowth: "За месяц вы продемонстрировали стабильный интерес к саморазвитию и мудрости великих людей.",
        recommendations: "Продолжайте изучать себя через литературу. Особое внимание стоит уделить книгам по психологии и личностному росту.",
        bookSuggestions: ["Искусство любить", "Быть собой", "Письма к молодому поэту"]
      };
    }
  }

  /**
   * Отправляет месячный отчет пользователю
   * @param {string} userId - ID пользователя
   * @param {Object} report - Данные отчета
   * @param {number} quotesCount - Количество цитат за месяц
   */
  async sendMonthlyReport(userId, report, quotesCount) {
    const reportMessage = `
📈 *Ваш персональный разбор месяца*

🎉 Поздравляю! Вы с «Читателем» уже месяц!

📊 *Статистика:*
└ Цитат сохранено: ${quotesCount}
└ Доминирующая тема: ${report.additionalSurvey.mainTheme}
└ Эмоциональная динамика: развитие через размышления

🧠 *Психологический анализ:*
${report.analysis.psychologicalProfile}

📈 *Ваш личностный рост:*
${report.analysis.personalGrowth}

💡 *Персональные рекомендации:*
${report.analysis.recommendations}

📚 *Специально для вас* (скидка ${report.specialOffer.discount}% до ${report.specialOffer.validUntil.toLocaleDateString()}):
${report.analysis.bookSuggestions.map((book, i) => `${i + 1}. ${book}`).join('\n')}

Продолжайте собирать моменты вдохновения! 📖
    `;

    const ratingKeyboard = [
      [{ text: "⭐⭐⭐⭐⭐", callback_data: `monthly_rating_5_${report._id}` }],
      [{ text: "⭐⭐⭐⭐", callback_data: `monthly_rating_4_${report._id}` }],
      [{ text: "⭐⭐⭐", callback_data: `monthly_rating_3_${report._id}` }],
      [{ text: "⭐⭐", callback_data: `monthly_rating_2_${report._id}` }],
      [{ text: "⭐", callback_data: `monthly_rating_1_${report._id}` }]
    ];

    try {
      await bot.telegram.sendMessage(userId, reportMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: ratingKeyboard
        }
      });

      // Обновляем статус отчета
      report.sentAt = new Date();
      await report.save();

      console.log(`📈 Monthly report sent to user ${userId}`);

    } catch (error) {
      console.error(`❌ Failed to send monthly report to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Выбирает книги для специального предложения
   * @param {MonthlyAnalysis} analysis - Анализ пользователя
   * @returns {string[]}
   */
  selectBooksForOffer(analysis) {
    const allBooks = [
      "Искусство любить (Эрих Фромм)",
      "Письма к молодому поэту (Рильке)", 
      "Быть собой (курс Анны)",
      "Женщина, которая читает, опасна",
      "Алхимик (Пауло Коэльо)",
      "Маленький принц"
    ];

    // Возвращаем книги из анализа или случайные 3
    if (analysis.bookSuggestions && analysis.bookSuggestions.length > 0) {
      return analysis.bookSuggestions.slice(0, 3);
    }

    return allBooks.slice(0, 3);
  }

  /**
   * Получает номер текущей недели
   * @returns {number}
   */
  getWeekNumber() {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const millisecsInDay = 86400000;
    return Math.ceil((((now - onejan) / millisecsInDay) + onejan.getDay() + 1) / 7);
  }

  /**
   * Устанавливает состояние пользователя
   * @param {string} userId - ID пользователя
   * @param {string} state - Состояние
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
   * @param {string} userId - ID пользователя
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
}

module.exports = { MonthlyReportService };
