/**
 * @fileoverview Модель месячных отчетов для бота "Читатель"
 * @author g1orgi89
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/reader').MonthlyReport} MonthlyReport
 * @typedef {import('../types/reader').AdditionalSurvey} AdditionalSurvey
 * @typedef {import('../types/reader').MonthlyAnalysis} MonthlyAnalysis
 * @typedef {import('../types/reader').SpecialOffer} SpecialOffer
 */

/**
 * Схема дополнительного опроса
 */
const additionalSurveySchema = new mongoose.Schema({
  mood: {
    type: String,
    enum: [
      'Поиск уверенности',
      'Женственность и нежность',
      'Баланс между «дать» и «взять»',
      'Любовь и отношения',
      'Вдохновение и рост',
      'Материнство и семья'
    ]
    // Как ощущали этот месяц - главная тема
  },
  mainTheme: {
    type: String
    // Главная тема месяца по ощущениям пользователя
  },
  satisfaction: {
    type: Number,
    min: 1,
    max: 5
    // Удовлетворенность месяцем 1-5
  },
  responses: [{
    type: String
    // Дополнительные ответы на вопросы
  }],
  respondedAt: {
    type: Date
    // Дата ответа на опрос
  }
}, { _id: false });

/**
 * Схема месячного анализа
 */
const monthlyAnalysisSchema = new mongoose.Schema({
  psychologicalProfile: {
    type: String,
    required: true,
    maxlength: 3000
    // Детальный анализ личности на основе всех данных
  },
  personalGrowth: {
    type: String,
    required: true,
    maxlength: 2000
    // Анализ роста и изменений за месяц
  },
  recommendations: {
    type: String,
    required: true,
    maxlength: 2000
    // Персональные рекомендации от психолога
  },
  bookSuggestions: [{
    type: String
    // Рекомендации конкретных книг
  }]
}, { _id: false });

/**
 * Схема специального предложения
 */
const specialOfferSchema = new mongoose.Schema({
  discount: {
    type: Number,
    required: true,
    min: 20,
    max: 50,
    default: 25
    // Размер скидки в процентах
  },
  validUntil: {
    type: Date,
    required: true
    // Действует до
  },
  books: [{
    type: String
    // Список книг для специального предложения
  }],
  promoCode: {
    type: String,
    uppercase: true,
    match: /^[A-Z0-9]{6,12}$/
    // Специальный промокод
  }
}, { _id: false });

/**
 * Основная схема месячного отчета
 */
const monthlyReportSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
    // ID пользователя Telegram
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
    // Номер месяца
  },
  year: {
    type: Number,
    required: true
    // Год
  },
  additionalSurvey: {
    type: additionalSurveySchema
    // Дополнительный опрос для точности
  },
  analysis: {
    type: monthlyAnalysisSchema,
    required: true
    // Глубокий психологический анализ
  },
  specialOffer: {
    type: specialOfferSchema,
    required: true
    // Специальное предложение со скидкой
  },
  sentAt: {
    type: Date,
    default: Date.now
    // Дата отправки отчета
  },
  
  // Обратная связь на месячный отчет
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
      // Оценка работы бота за месяц (1-5 звезд)
    },
    whatLikes: {
      type: String,
      maxlength: 1000
      // Что нравится больше всего
    },
    whatImprove: {
      type: String,
      maxlength: 1000
      // Что хотели бы улучшить
    },
    newFeatures: {
      type: String,
      maxlength: 1000
      // Какие функции добавить
    },
    respondedAt: {
      type: Date
      // Дата ответа
    }
  },
  
  // Техническая информация
  telegramMessageId: {
    type: String
    // ID сообщения в Telegram
  },
  generatedBy: {
    type: String,
    default: 'claude',
    enum: ['claude', 'openai', 'manual']
    // Кем сгенерирован анализ
  },
  generationTime: {
    type: Number
    // Время генерации в миллисекундах
  },
  
  // Статистика за месяц
  monthStats: {
    totalQuotes: { type: Number, default: 0 },
    categoriesDistribution: { type: Map, of: Number },
    authorsCount: { type: Number, default: 0 },
    averageQuotesPerWeek: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Составные индексы
monthlyReportSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });
monthlyReportSchema.index({ userId: 1, sentAt: -1 });
monthlyReportSchema.index({ month: 1, year: 1 });
monthlyReportSchema.index({ sentAt: -1 });
monthlyReportSchema.index({ 'feedback.rating': 1 });

// Виртуальные поля
monthlyReportSchema.virtual('monthIdentifier').get(function() {
  const monthStr = this.month.toString().padStart(2, '0');
  return `${this.year}-${monthStr}`;
});

monthlyReportSchema.virtual('hasSurveyResponse').get(function() {
  return !!(this.additionalSurvey && this.additionalSurvey.respondedAt);
});

monthlyReportSchema.virtual('hasFeedback').get(function() {
  return !!(this.feedback && this.feedback.respondedAt);
});

monthlyReportSchema.virtual('isRecent').get(function() {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return this.sentAt > oneMonthAgo;
});

// Методы экземпляра
monthlyReportSchema.methods = {
  /**
   * Добавить ответ на дополнительный опрос
   * @param {string} mood - Выбранная тема месяца
   * @param {number} [satisfaction] - Удовлетворенность
   * @returns {Promise<MonthlyReport>}
   */
  async addSurveyResponse(mood, satisfaction = null) {
    this.additionalSurvey = {
      mood,
      mainTheme: mood,
      satisfaction,
      respondedAt: new Date()
    };
    return this.save();
  },

  /**
   * Добавить обратную связь по месячному отчету
   * @param {number} rating - Оценка 1-5 звезд
   * @param {Object} feedback - Детальная обратная связь
   * @param {string} [feedback.whatLikes] - Что нравится
   * @param {string} [feedback.whatImprove] - Что улучшить
   * @param {string} [feedback.newFeatures] - Новые функции
   * @returns {Promise<MonthlyReport>}
   */
  async addFeedback(rating, feedback = {}) {
    this.feedback = {
      rating,
      whatLikes: feedback.whatLikes,
      whatImprove: feedback.whatImprove,
      newFeatures: feedback.newFeatures,
      respondedAt: new Date()
    };
    return this.save();
  },

  /**
   * Обновить статистику месяца
   * @param {Object} stats - Статистика
   * @returns {Promise<MonthlyReport>}
   */
  async updateMonthStats(stats) {
    this.monthStats = {
      totalQuotes: stats.totalQuotes || 0,
      categoriesDistribution: new Map(Object.entries(stats.categoriesDistribution || {})),
      authorsCount: stats.authorsCount || 0,
      averageQuotesPerWeek: stats.averageQuotesPerWeek || 0,
      longestStreak: stats.longestStreak || 0
    };
    return this.save();
  },

  /**
   * Получить форматированный текст для Telegram
   * @returns {string}
   */
  toTelegramFormat() {
    const statsText = `\n📊 *Статистика:*\n└ Цитат сохранено: ${this.monthStats.totalQuotes}\n└ Доминирующая тема: ${this.additionalSurvey?.mood || 'не указана'}\n└ Эмоциональная динамика: развитие через размышления\n`;

    const booksText = this.analysis.bookSuggestions.map((book, i) => 
      `${i + 1}. ${book}`
    ).join('\n');

    return `📈 *Ваш персональный разбор месяца*\n\n🎉 Поздравляю! Вы с «Читателем» уже месяц!\n\n${statsText}\n\n🧠 *Психологический анализ:*\n${this.analysis.psychologicalProfile}\n\n📈 *Ваш личностный рост:*\n${this.analysis.personalGrowth}\n\n💡 *Персональные рекомендации:*\n${this.analysis.recommendations}\n\n📚 *Специально для вас* (скидка ${this.specialOffer.discount}% до ${this.specialOffer.validUntil.toLocaleDateString()}):\n${booksText}\n\nПродолжайте собирать моменты вдохновения! 📖`;
  },

  /**
   * Получить краткую информацию
   * @returns {Object}
   */
  toSummary() {
    return {
      id: this._id,
      userId: this.userId,
      monthIdentifier: this.monthIdentifier,
      totalQuotes: this.monthStats.totalQuotes,
      mainTheme: this.additionalSurvey?.mood,
      sentAt: this.sentAt,
      hasSurveyResponse: this.hasSurveyResponse,
      hasFeedback: this.hasFeedback,
      rating: this.feedback?.rating,
      specialDiscount: this.specialOffer.discount
    };
  }
};

// Статические методы
monthlyReportSchema.statics = {
  /**
   * Найти отчет для конкретного месяца пользователя
   * @param {string} userId - ID пользователя
   * @param {number} month - Номер месяца
   * @param {number} year - Год
   * @returns {Promise<MonthlyReport|null>}
   */
  async findByUserMonth(userId, month, year) {
    return this.findOne({ userId, month, year });
  },

  /**
   * Получить последние отчеты пользователя
   * @param {string} userId - ID пользователя
   * @param {number} [limit=3] - Количество отчетов
   * @returns {Promise<MonthlyReport[]>}
   */
  async getUserRecentReports(userId, limit = 3) {
    return this.find({ userId })
      .sort({ sentAt: -1 })
      .limit(limit);
  },

  /**
   * Проверить есть ли отчет для месяца
   * @param {string} userId - ID пользователя
   * @param {number} month - Номер месяца
   * @param {number} year - Год
   * @returns {Promise<boolean>}
   */
  async hasReportForMonth(userId, month, year) {
    const count = await this.countDocuments({ userId, month, year });
    return count > 0;
  },

  /**
   * Получить пользователей для генерации месячных отчетов
   * @param {number} month - Номер месяца (прошлого)
   * @param {number} year - Год
   * @returns {Promise<Array>}
   */
  async getUsersNeedingMonthlyReports(month, year) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const UserProfile = mongoose.model('UserProfile');
    
    // Получаем активных пользователей, зарегистрированных минимум месяц назад
    const eligibleUsers = await UserProfile.find({
      registeredAt: { $lte: oneMonthAgo },
      isActive: true,
      isBlocked: false,
      isOnboardingComplete: true
    });
    
    // Фильтруем тех, у кого уже есть отчет за этот месяц
    const usersWithReports = await this.distinct('userId', { month, year });
    
    return eligibleUsers.filter(user => 
      !usersWithReports.includes(user.userId)
    );
  },

  /**
   * Получить статистику месячных отчетов
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Object>}
   */
  async getMonthlyReportsStats(startDate = null) {
    const match = {};
    if (startDate) {
      match.sentAt = { $gte: startDate };
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          reportsWithSurvey: {
            $sum: { $cond: [{ $ne: ['$additionalSurvey.respondedAt', null] }, 1, 0] }
          },
          reportsWithFeedback: {
            $sum: { $cond: [{ $ne: ['$feedback.rating', null] }, 1, 0] }
          },
          averageRating: { $avg: '$feedback.rating' },
          averageQuotesPerMonth: { $avg: '$monthStats.totalQuotes' }
        }
      }
    ];

    const result = await this.aggregate(pipeline);
    return result.length ? result[0] : null;
  },

  /**
   * Получить распределение тем месяца
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getMonthlyThemesDistribution(startDate = null) {
    const match = {
      'additionalSurvey.mood': { $exists: true, $ne: null }
    };
    
    if (startDate) {
      match.sentAt = { $gte: startDate };
    }

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$additionalSurvey.mood',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  },

  /**
   * Получить самые частые предложения улучшений
   * @returns {Promise<Array>}
   */
  async getImprovementSuggestions() {
    return this.aggregate([
      {
        $match: {
          'feedback.whatImprove': { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $project: {
          improvements: '$feedback.whatImprove',
          month: '$month',
          year: '$year'
        }
      },
      { $sort: { year: -1, month: -1 } },
      { $limit: 20 }
    ]);
  }
};

// Middleware
monthlyReportSchema.pre('save', function(next) {
  // Автоматически заполняем validUntil для специального предложения (7 дней)
  if (this.isNew && this.specialOffer && !this.specialOffer.validUntil) {
    this.specialOffer.validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  // Генерируем промокод если не указан
  if (this.isNew && this.specialOffer && !this.specialOffer.promoCode) {
    this.specialOffer.promoCode = `MONTH${this.specialOffer.discount}`;
  }
  
  next();
});

const MonthlyReport = mongoose.model('MonthlyReport', monthlyReportSchema);

module.exports = MonthlyReport;