/**
 * @fileoverview Модель месячных отчетов для бота "Читатель"
 * 📋 MERGED: Объединены старая и новая модели
 * - Сохранены все поля старой модели (additionalSurvey, analysis, specialOffer, feedback, monthStats)
 * - Добавлены новые поля (weeklyReports, generationMethod, monthlyMetrics, evolution, isRead)
 * - Добавлены новые методы и виртуальные поля
 * @author g1orgi89
 */

const mongoose = require('mongoose');

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
      'Материнство и семья',
      // Lowercase versions for compatibility
      'поиск уверенности',
      'женственность',
      'баланс',
      'любовь и отношения',
      'вдохновение и рост',
      'материнство и семья'
    ]
  },
  mainTheme: {
    type: String
  },
  satisfaction: {
    type: Number,
    min: 1,
    max: 5
  },
  responses: [{
    type: String
  }],
  respondedAt: {
    type: Date
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
  },
  personalGrowth: {
    type: String,
    required: true,
    maxlength: 2000
  },
  recommendations: {
    type: String,
    required: true,
    maxlength: 2000
  },
  bookSuggestions: [{
    type: String
  }]
}, { _id: false });

/**
 * Схема специального предложения
 */
const specialOfferSchema = new mongoose.Schema({
  discount: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 25
  },
  validUntil: {
    type: Date,
    required: true
  },
  books: [{
    type: String
  }],
  promoCode: {
    type: String,
    uppercase: true,
    match: /^[A-Z0-9]{6,12}$/
  }
}, { _id: false });

/**
 * 📋 NEW: Схема эволюции пользователя через месяц
 */
const evolutionSchema = new mongoose.Schema({
  weeklyChanges: {
    type: String,
    maxlength: 1000
  },
  deepPatterns: {
    type: String,
    maxlength: 1000
  },
  psychologicalInsight: {
    type: String,
    maxlength: 1000
  }
}, { _id: false });

/**
 * 📋 NEW: Схема агрегированных метрик месяца
 */
const monthlyMetricsSchema = new mongoose.Schema({
  totalQuotes: {
    type: Number,
    default: 0,
    min: 0
  },
  uniqueAuthors: {
    type: Number,
    default: 0,
    min: 0
  },
  activeDays: {
    type: Number,
    default: 0,
    min: 0
  },
  weeksActive: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  topThemes: [{
    type: String
  }],
  emotionalTrend: {
    type: String,
    enum: ['растущая', 'стабильная', 'меняющаяся', 'смешанная'],
    default: 'смешанная'
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
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true,
    min: 2024
  },
  
  // 📋 NEW: Ссылки на еженедельные отчёты (для агрегации)
  weeklyReports: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WeeklyReport'
  }],
  
  // 📋 NEW: Метод генерации отчёта
  generationMethod: {
    type: String,
    enum: ['weekly_reports', 'top_quotes', 'mixed', 'claude', 'openai', 'manual'],
    default: 'weekly_reports'
  },
  
  // 📋 NEW: Агрегированные метрики месяца
  monthlyMetrics: monthlyMetricsSchema,
  
  // 📋 NEW: Эволюция через месяц (мета-анализ)
  evolution: evolutionSchema,
  
  // Дополнительный опрос
  additionalSurvey: additionalSurveySchema,
  
  // Анализ от Анны
  analysis: {
    type: monthlyAnalysisSchema,
    required: true
  },
  
  // Специальное предложение
  specialOffer: {
    type: specialOfferSchema,
    required: true
  },
  
  // Дата отправки
  sentAt: {
    type: Date,
    default: Date.now
  },
  
  // 📋 NEW: Статус прочтения
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  
  // Обратная связь
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    whatLikes: {
      type: String,
      maxlength: 1000
    },
    whatImprove: {
      type: String,
      maxlength: 1000
    },
    newFeatures: {
      type: String,
      maxlength: 1000
    },
    comment: {
      type: String,
      maxlength: 1000
    },
    respondedAt: {
      type: Date
    }
  },
  
  // Техническая информация
  telegramMessageId: {
    type: String
  },
  generatedBy: {
    type: String,
    default: 'claude',
    enum: ['claude', 'openai', 'manual']
  },
  generationTime: {
    type: Number
  },
  
  // OLD: Статистика за месяц (legacy, сохранено для совместимости)
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

// ============ ИНДЕКСЫ ============

monthlyReportSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });
monthlyReportSchema.index({ userId: 1, sentAt: -1 });
monthlyReportSchema.index({ month: 1, year: 1 });
monthlyReportSchema.index({ sentAt: -1 });
monthlyReportSchema.index({ 'feedback.rating': 1 });
monthlyReportSchema.index({ generationMethod: 1 });
monthlyReportSchema.index({ isRead: 1 });

// ============ ВИРТУАЛЬНЫЕ ПОЛЯ ============

monthlyReportSchema.virtual('monthIdentifier').get(function() {
  const monthStr = this.month.toString().padStart(2, '0');
  return `${this.year}-${monthStr}`;
});

monthlyReportSchema.virtual('monthName').get(function() {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  return months[this.month - 1];
});

monthlyReportSchema.virtual('periodName').get(function() {
  return `${this.monthName} ${this.year}`;
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

monthlyReportSchema.virtual('weeksCount').get(function() {
  return this.weeklyReports ? this.weeklyReports.length : 0;
});

monthlyReportSchema.virtual('isFromWeeklyReports').get(function() {
  return this.generationMethod === 'weekly_reports' && this.weeksCount >= 3;
});

// ============ МЕТОДЫ ЭКЗЕМПЛЯРА ============

monthlyReportSchema.methods = {
  /**
   * Добавить ответ на дополнительный опрос
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
   * Добавить обратную связь
   */
  async addFeedback(rating, feedback = {}) {
    this.feedback = {
      rating,
      whatLikes: feedback.whatLikes,
      whatImprove: feedback.whatImprove,
      newFeatures: feedback.newFeatures,
      comment: feedback.comment,
      respondedAt: new Date()
    };
    return this.save();
  },

  /**
   * Обновить статистику месяца (legacy)
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
   * 📋 NEW: Отметить отчет как прочитанный
   */
  markAsRead() {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  },

  /**
   * 📋 NEW: Проверить истекло ли предложение
   */
  isOfferExpired() {
    return this.specialOffer.validUntil < new Date();
  },

  /**
   * 📋 NEW: Дней до истечения предложения
   */
  getDaysUntilOfferExpires() {
    const now = new Date();
    const validUntil = this.specialOffer.validUntil;
    const diffTime = validUntil - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * 📋 NEW: Получить краткую сводку для отображения
   */
  getSummary() {
    return {
      id: this._id,
      oderId: this.userId,
      month: this.month,
      year: this.year,
      period: this.periodName,
      monthlyMetrics: this.monthlyMetrics,
      monthStats: this.monthStats,
      generationMethod: this.generationMethod,
      weeksCount: this.weeksCount,
      isRead: this.isRead,
      hasFeedback: this.hasFeedback,
      rating: this.feedback?.rating,
      sentAt: this.sentAt
    };
  },

  /**
   * Получить форматированный текст для Telegram
   */
  toTelegramFormat() {
    const totalQuotes = this.monthlyMetrics?.totalQuotes || this.monthStats?.totalQuotes || 0;
    const mood = this.additionalSurvey?.mood || 'не указана';
    
    const statsText = `\n📊 *Статистика:*\n└ Цитат сохранено: ${totalQuotes}\n└ Доминирующая тема: ${mood}\n└ Эмоциональная динамика: развитие через размышления\n`;

    const booksText = (this.analysis.bookSuggestions || []).map((book, i) => 
      `${i + 1}. ${book}`
    ).join('\n');

    return `📈 *Ваш персональный разбор месяца*\n\n🎉 Поздравляю! Вы с «Читателем» уже месяц!\n\n${statsText}\n\n🧠 *Психологический анализ:*\n${this.analysis.psychologicalProfile}\n\n📈 *Ваш личностный рост:*\n${this.analysis.personalGrowth}\n\n💡 *Персональные рекомендации:*\n${this.analysis.recommendations}\n\n📚 *Специально для вас* (скидка ${this.specialOffer.discount}% до ${this.specialOffer.validUntil.toLocaleDateString()}):\n${booksText}\n\nПродолжайте собирать моменты вдохновения! 📖`;
  },

  /**
   * Получить краткую информацию (legacy)
   */
  toSummary() {
    return this.getSummary();
  }
};

// ============ СТАТИЧЕСКИЕ МЕТОДЫ ============

monthlyReportSchema.statics = {
  /**
   * Найти отчет для конкретного месяца пользователя
   */
  async findByUserMonth(userId, month, year) {
    return this.findOne({ userId, month, year });
  },

  /**
   * Получить последние отчеты пользователя
   */
  async getUserRecentReports(userId, limit = 3) {
    return this.find({ userId })
      .sort({ sentAt: -1 })
      .limit(limit);
  },

  /**
   * Получить отчеты пользователя (alias)
   */
  async getUserReports(userId, limit = 12) {
    return this.find({ userId })
      .sort({ year: -1, month: -1 })
      .limit(limit)
      .lean();
  },

  /**
   * Проверить есть ли отчет для месяца
   */
  async hasReportForMonth(userId, month, year) {
    const count = await this.countDocuments({ userId, month, year });
    return count > 0;
  },

  /**
   * 📋 NEW: Получить отчёт со связанными еженедельными отчётами
   */
  async getWithWeeklyReports(userId, month, year) {
    return this.findOne({ userId, month, year })
      .populate({
        path: 'weeklyReports',
        select: 'weekNumber analysis metrics sentAt'
      })
      .exec();
  },

  /**
   * Получить пользователей для генерации месячных отчетов
   */
  async getUsersNeedingMonthlyReports(month, year) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const UserProfile = mongoose.model('UserProfile');
    
    const eligibleUsers = await UserProfile.find({
      registeredAt: { $lte: oneMonthAgo },
      isActive: true,
      isBlocked: false,
      isOnboardingComplete: true
    });
    
    const usersWithReports = await this.distinct('userId', { month, year });
    
    return eligibleUsers.filter(user => 
      !usersWithReports.includes(user.userId)
    );
  },

  /**
   * Получить статистику месячных отчетов
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
   * Получить статистику по периоду
   */
  async getMonthlyStats(startDate, endDate) {
    return this.aggregate([
      {
        $match: {
          sentAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: '$year',
            month: '$month'
          },
          totalReports: { $sum: 1 },
          avgRating: { $avg: '$feedback.rating' },
          readCount: {
            $sum: { $cond: ['$isRead', 1, 0] }
          },
          feedbackCount: {
            $sum: { $cond: [{ $exists: ['$feedback.rating', true] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      }
    ]);
  },

  /**
   * Получить распределение тем месяца
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
   * Получить предложения по улучшению
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

// ============ MIDDLEWARE ============

monthlyReportSchema.pre('save', function(next) {
  // Автоматически заполняем validUntil (7 дней)
  if (this.isNew && this.specialOffer && !this.specialOffer.validUntil) {
    this.specialOffer.validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  // Генерируем промокод если не указан
  if (this.isNew && this.specialOffer && !this.specialOffer.promoCode) {
    this.specialOffer.promoCode = `MONTH${this.specialOffer.discount}`;
  }
  
  // Синхронизируем monthlyMetrics и monthStats
  if (this.monthlyMetrics && this.monthlyMetrics.totalQuotes) {
    if (!this.monthStats) this.monthStats = {};
    this.monthStats.totalQuotes = this.monthlyMetrics.totalQuotes;
    this.monthStats.authorsCount = this.monthlyMetrics.uniqueAuthors;
  }
  
  next();
});

monthlyReportSchema.post('save', function(doc) {
  const method = doc.generationMethod || 'unknown';
  console.log(`📈 Monthly report saved: ${doc.userId} for ${doc.monthName} ${doc.year} (${method})`);
});

const MonthlyReport = mongoose.model('MonthlyReport', monthlyReportSchema);

module.exports = MonthlyReport;
