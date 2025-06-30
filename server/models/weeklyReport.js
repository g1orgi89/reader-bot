/**
 * @fileoverview Модель еженедельных отчетов для бота "Читатель"
 * @author g1orgi89
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/reader').WeeklyAnalysis} WeeklyAnalysis
 * @typedef {import('../types/reader').BookRecommendation} BookRecommendation
 * @typedef {import('../types/reader').PromoCodeData} PromoCodeData
 * @typedef {import('../types/reader').FeedbackData} FeedbackData
 */

/**
 * Схема анализа недели
 */
const weeklyAnalysisSchema = new mongoose.Schema({
  summary: {
    type: String,
    required: true,
    maxlength: 500
    // Краткий анализ недели одним предложением
  },
  dominantThemes: [{
    type: String
    // Доминирующие темы
  }],
  emotionalTone: {
    type: String,
    required: true,
    enum: ['позитивный', 'нейтральный', 'задумчивый', 'вдохновляющий', 'меланхоличный', 'энергичный']
    // Эмоциональный тон недели
  },
  insights: {
    type: String,
    required: true,
    maxlength: 2000
    // Подробный психологический анализ от Анны
  }
}, { _id: false });

/**
 * Схема рекомендации книги
 */
const bookRecommendationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
    // Название книги/курса
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
    // Краткое описание почему подходит
  },
  price: {
    type: String,
    required: true,
    match: /^\$\d+$/
    // Цена в формате $8, $12
  },
  link: {
    type: String,
    required: true
    // Ссылка с UTM метками
  },
  reasoning: {
    type: String,
    required: true,
    maxlength: 300
    // Почему именно эта книга подойдет пользователю
  }
}, { _id: false });

/**
 * Схема промокода
 */
const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
    match: /^[A-Z0-9]{6,12}$/
    // Код промокода
  },
  discount: {
    type: Number,
    required: true,
    min: 5,
    max: 50
    // Размер скидки в процентах
  },
  validUntil: {
    type: Date,
    required: true
    // Действует до
  }
}, { _id: false });

/**
 * Схема обратной связи
 */
const feedbackSchema = new mongoose.Schema({
  rating: {
    type: Number,
    min: 1,
    max: 5
    // Оценка 1-5 звезд
  },
  comment: {
    type: String,
    maxlength: 1000
    // Комментарий пользователя
  },
  respondedAt: {
    type: Date
    // Дата ответа
  }
}, { _id: false });

/**
 * Основная схема еженедельного отчета
 */
const weeklyReportSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
    // ID пользователя Telegram
  },
  weekNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 53
    // Номер недели (ISO)
  },
  year: {
    type: Number,
    required: true
    // Год
  },
  quotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
    // Ссылки на цитаты за неделю
  }],
  analysis: {
    type: weeklyAnalysisSchema,
    required: true
    // AI-анализ недели
  },
  recommendations: [bookRecommendationSchema],
  promoCode: {
    type: promoCodeSchema,
    required: true
    // Промокод со скидкой
  },
  feedback: {
    type: feedbackSchema
    // Обратная связь от пользователя
  },
  sentAt: {
    type: Date,
    default: Date.now
    // Дата отправки отчета
  },
  isRead: {
    type: Boolean,
    default: false
    // Прочитан ли отчет
  },
  readAt: {
    type: Date
    // Дата прочтения
  },
  
  // Техническая информация
  telegramMessageId: {
    type: String
    // ID сообщения отчета в Telegram
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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Составные индексы
weeklyReportSchema.index({ userId: 1, weekNumber: 1, year: 1 }, { unique: true });
weeklyReportSchema.index({ userId: 1, sentAt: -1 });
weeklyReportSchema.index({ weekNumber: 1, year: 1 });
weeklyReportSchema.index({ sentAt: -1 });
weeklyReportSchema.index({ 'feedback.rating': 1 });

// Виртуальные поля
weeklyReportSchema.virtual('quotesCount').get(function() {
  return this.quotes ? this.quotes.length : 0;
});

weeklyReportSchema.virtual('hasFeedback').get(function() {
  return !!(this.feedback && this.feedback.respondedAt);
});

weeklyReportSchema.virtual('weekIdentifier').get(function() {
  return `${this.year}-W${this.weekNumber.toString().padStart(2, '0')}`;
});

weeklyReportSchema.virtual('isRecent').get(function() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return this.sentAt > oneWeekAgo;
});

// Методы экземпляра
weeklyReportSchema.methods = {
  /**
   * Отметить как прочитанный
   * @returns {Promise<WeeklyReport>}
   */
  async markAsRead() {
    if (!this.isRead) {
      this.isRead = true;
      this.readAt = new Date();
      return this.save();
    }
    return this;
  },

  /**
   * Добавить обратную связь
   * @param {number} rating - Оценка 1-5
   * @param {string} [comment] - Комментарий
   * @returns {Promise<WeeklyReport>}
   */
  async addFeedback(rating, comment = null) {
    this.feedback = {
      rating,
      comment,
      respondedAt: new Date()
    };
    return this.save();
  },

  /**
   * Получить форматированный текст для Telegram
   * @returns {string}
   */
  toTelegramFormat() {
    const quotesText = this.quotes.map((quote, index) => {
      // Предполагаем что quotes будут populate
      const authorText = quote.author ? ` (${quote.author})` : '';
      return `✅ "${quote.text}"${authorText}`;
    }).join('\n');

    const recommendationsText = this.recommendations.map((rec, index) => {
      return `${index + 1}. [${rec.title}](${rec.link}) - ${rec.price}\n   ${rec.description}`;
    }).join('\n\n');

    return `📊 *Ваш отчет за неделю*\n\nЗа эту неделю вы сохранили ${this.quotesCount} ${this._declensionQuotes(this.quotesCount)}:\n\n${quotesText}\n\n🎯 *Анализ недели:*\n${this.analysis.insights}\n\n💎 *Рекомендации от Анны:*\n${recommendationsText}\n\n🎁 *Промокод ${this.promoCode.code}* - скидка ${this.promoCode.discount}% до ${this.promoCode.validUntil.toLocaleDateString()}!\n\n---\n💬 Как вам этот отчет?`;
  },

  /**
   * Склонение слова "цитата"
   * @private
   * @param {number} count - Количество
   * @returns {string}
   */
  _declensionQuotes(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  },

  /**
   * Получить краткую информацию
   * @returns {Object}
   */
  toSummary() {
    return {
      id: this._id,
      userId: this.userId,
      weekIdentifier: this.weekIdentifier,
      quotesCount: this.quotesCount,
      dominantThemes: this.analysis.dominantThemes,
      emotionalTone: this.analysis.emotionalTone,
      sentAt: this.sentAt,
      isRead: this.isRead,
      hasFeedback: this.hasFeedback,
      rating: this.feedback?.rating
    };
  }
};

// Статические методы
weeklyReportSchema.statics = {
  /**
   * Найти отчет для конкретной недели пользователя
   * @param {string} userId - ID пользователя
   * @param {number} weekNumber - Номер недели
   * @param {number} year - Год
   * @returns {Promise<WeeklyReport|null>}
   */
  async findByUserWeek(userId, weekNumber, year) {
    return this.findOne({ userId, weekNumber, year })
      .populate('quotes')
      .exec();
  },

  /**
   * Получить последние отчеты пользователя
   * @param {string} userId - ID пользователя
   * @param {number} [limit=5] - Количество отчетов
   * @returns {Promise<WeeklyReport[]>}
   */
  async getUserRecentReports(userId, limit = 5) {
    return this.find({ userId })
      .sort({ sentAt: -1 })
      .limit(limit)
      .populate('quotes')
      .exec();
  },

  /**
   * Получить статистику отчетов
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Object>}
   */
  async getReportsStats(startDate = null) {
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
          reportsWithFeedback: {
            $sum: { $cond: [{ $ne: ['$feedback.rating', null] }, 1, 0] }
          },
          averageRating: { $avg: '$feedback.rating' },
          totalQuotes: { $sum: { $size: '$quotes' } },
          averageQuotesPerReport: { $avg: { $size: '$quotes' } }
        }
      }
    ];

    const result = await this.aggregate(pipeline);
    return result.length ? result[0] : null;
  },

  /**
   * Получить распределение оценок
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getFeedbackDistribution(startDate = null) {
    const match = {
      'feedback.rating': { $exists: true, $ne: null }
    };
    
    if (startDate) {
      match.sentAt = { $gte: startDate };
    }

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$feedback.rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  },

  /**
   * Получить самые популярные темы в отчетах
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getPopularThemes(startDate = null) {
    const match = {};
    if (startDate) {
      match.sentAt = { $gte: startDate };
    }

    return this.aggregate([
      { $match: match },
      { $unwind: '$analysis.dominantThemes' },
      {
        $group: {
          _id: '$analysis.dominantThemes',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
  },

  /**
   * Проверить есть ли отчет для недели
   * @param {string} userId - ID пользователя
   * @param {number} weekNumber - Номер недели
   * @param {number} year - Год
   * @returns {Promise<boolean>}
   */
  async hasReportForWeek(userId, weekNumber, year) {
    const count = await this.countDocuments({ userId, weekNumber, year });
    return count > 0;
  },

  /**
   * Получить пользователей для генерации отчетов
   * @param {number} weekNumber - Номер недели
   * @param {number} year - Год
   * @returns {Promise<Array>}
   */
  async getUsersNeedingReports(weekNumber, year) {
    // Находим пользователей у которых есть цитаты за неделю, но нет отчета
    const Quote = mongoose.model('Quote');
    const UserProfile = mongoose.model('UserProfile');
    
    // Получаем пользователей с цитатами за неделю
    const usersWithQuotes = await Quote.distinct('userId', {
      weekNumber,
      yearNumber: year
    });
    
    // Получаем пользователей у которых уже есть отчет
    const usersWithReports = await this.distinct('userId', {
      weekNumber,
      year
    });
    
    // Находим разность
    const usersNeedingReports = usersWithQuotes.filter(
      userId => !usersWithReports.includes(userId)
    );
    
    // Возвращаем только активных пользователей
    return UserProfile.find({
      userId: { $in: usersNeedingReports },
      isActive: true,
      isBlocked: false,
      isOnboardingComplete: true
    });
  }
};

// Middleware
weeklyReportSchema.pre('save', function(next) {
  // Автоматически заполняем validUntil для промокода (3 дня)
  if (this.isNew && this.promoCode && !this.promoCode.validUntil) {
    this.promoCode.validUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

const WeeklyReport = mongoose.model('WeeklyReport', weeklyReportSchema);

module.exports = WeeklyReport;