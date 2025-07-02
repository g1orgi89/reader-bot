/**
 * @fileoverview MongoDB model для месячных отчетов проекта "Читатель"
 */

const mongoose = require('mongoose');

/**
 * @typedef {Object} AdditionalSurvey
 * @property {string} mood - Настроение месяца
 * @property {string} mainTheme - Главная тема месяца
 * @property {number} satisfaction - Удовлетворенность от 1 до 5
 * @property {string[]} responses - Дополнительные ответы
 * @property {Date} respondedAt - Время ответа на опрос
 */

/**
 * @typedef {Object} MonthlyAnalysis
 * @property {string} psychologicalProfile - Психологический профиль
 * @property {string} personalGrowth - Анализ личностного роста
 * @property {string} recommendations - Рекомендации от Анны
 * @property {string[]} bookSuggestions - Рекомендуемые книги
 */

/**
 * @typedef {Object} SpecialOffer
 * @property {number} discount - Размер скидки в процентах
 * @property {Date} validUntil - Дата окончания действия
 * @property {string[]} books - Список книг со скидкой
 */

/**
 * @typedef {Object} MonthlyFeedback
 * @property {number} rating - Оценка от 1 до 5 звезд
 * @property {string} comment - Комментарий пользователя
 * @property {Date} respondedAt - Время ответа
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
  additionalSurvey: {
    mood: {
      type: String,
      enum: [
        'поиск уверенности',
        'женственность',
        'баланс',
        'любовь и отношения',
        'вдохновение и рост',
        'материнство и семья'
      ]
    },
    mainTheme: String,
    satisfaction: {
      type: Number,
      min: 1,
      max: 5
    },
    responses: [String],
    respondedAt: Date
  },
  analysis: {
    psychologicalProfile: {
      type: String,
      required: true
    },
    personalGrowth: {
      type: String,
      required: true
    },
    recommendations: {
      type: String,
      required: true
    },
    bookSuggestions: [String]
  },
  specialOffer: {
    discount: {
      type: Number,
      default: 25,
      min: 0,
      max: 100
    },
    validUntil: {
      type: Date,
      required: true
    },
    books: [String]
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    respondedAt: Date
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date
}, {
  timestamps: true
});

// Составной индекс для быстрого поиска по пользователю и месяцу
monthlyReportSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

// Индекс для поиска отчетов за период
monthlyReportSchema.index({ sentAt: 1 });

// Индекс для аналитики обратной связи
monthlyReportSchema.index({ 'feedback.rating': 1, sentAt: 1 });

/**
 * Виртуальное поле для получения названия месяца
 */
monthlyReportSchema.virtual('monthName').get(function() {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  return months[this.month - 1];
});

/**
 * Виртуальное поле для получения полного названия периода
 */
monthlyReportSchema.virtual('periodName').get(function() {
  return `${this.monthName} ${this.year}`;
});

/**
 * Проверяет, истекло ли специальное предложение
 */
monthlyReportSchema.methods.isOfferExpired = function() {
  return this.specialOffer.validUntil < new Date();
};

/**
 * Получает количество дней до истечения предложения
 */
monthlyReportSchema.methods.getDaysUntilOfferExpires = function() {
  const now = new Date();
  const validUntil = this.specialOffer.validUntil;
  const diffTime = validUntil - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Отмечает отчет как прочитанный
 */
monthlyReportSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

/**
 * Статический метод для получения статистики месячных отчетов
 */
monthlyReportSchema.statics.getMonthlyStats = async function(startDate, endDate) {
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
};

/**
 * Статический метод для получения отчетов пользователя
 */
monthlyReportSchema.statics.getUserReports = async function(userId, limit = 12) {
  return this.find({ userId })
    .sort({ year: -1, month: -1 })
    .limit(limit)
    .lean();
};

/**
 * Хук pre-save для валидации данных
 */
monthlyReportSchema.pre('save', function(next) {
  // Проверяем, что specialOffer.validUntil не в прошлом при создании
  if (this.isNew && this.specialOffer.validUntil < new Date()) {
    const error = new Error('Special offer expiration date cannot be in the past');
    return next(error);
  }

  // Устанавливаем дату окончания предложения если не указана
  if (!this.specialOffer.validUntil) {
    this.specialOffer.validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
  }

  next();
});

/**
 * Хук post-save для логирования
 */
monthlyReportSchema.post('save', function(doc) {
  console.log(`📈 Monthly report saved: ${doc.userId} for ${doc.monthName} ${doc.year}`);
});

const MonthlyReport = mongoose.model('MonthlyReport', monthlyReportSchema);

module.exports = MonthlyReport;
