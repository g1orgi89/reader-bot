/**
 * @fileoverview Модель цитаты для бота "Читатель"
 * @author g1orgi89
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/reader').Quote} Quote
 */

/**
 * Основная схема цитаты
 */
const quoteSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
    // ID пользователя Telegram
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
    // Текст цитаты
  },
  author: {
    type: String,
    trim: true,
    maxlength: 200
    // Автор цитаты (может быть пустым)
  },
  source: {
    type: String,
    trim: true,
    maxlength: 300
    // Источник (название книги)
  },
  category: {
    type: String,
    enum: ['КРИЗИСЫ', 'Я — ЖЕНЩИНА', 'ЛЮБОВЬ', 'ОТНОШЕНИЯ', 'ДЕНЬГИ', 'ОДИНОЧЕСТВО', 'СМЕРТЬ', 'СЕМЕЙНЫЕ ОТНОШЕНИЯ', 'СМЫСЛ ЖИЗНИ', 'СЧАСТЬЕ', 'ВРЕМЯ И ПРИВЫЧКИ', 'ДОБРО И ЗЛО', 'ОБЩЕСТВО', 'ПОИСК СЕБЯ', 'ДРУГОЕ'],
    default: 'ДРУГОЕ'
    // AI-определенная категория
  },
  weekNumber: {
    type: Number,
    min: 1,
    max: 53,
    index: true
    // ISO номер недели года
  },
  monthNumber: {
    type: Number,
    min: 1,
    max: 12,
    index: true
    // Номер месяца
  },
  yearNumber: {
    type: Number,
    index: true
    // Год
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral'
    // Эмоциональная окраска
  },
  themes: [{
    type: String,
    maxlength: 100
    // AI-определенные темы
  }],
  insights: {
    type: String,
    maxlength: 1000
    // AI-сгенерированные инсайты от Анны
  },
  isEdited: {
    type: Boolean,
    default: false
    // Была ли отредактирована
  },
  editedAt: {
    type: Date
    // Дата последнего редактирования
  },
  isFavorite: {
    type: Boolean,
    default: false
    // Добавлена ли цитата в избранное
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Композитные индексы для оптимизации запросов
quoteSchema.index({ userId: 1, createdAt: -1 });
quoteSchema.index({ userId: 1, weekNumber: 1, yearNumber: 1 });
quoteSchema.index({ userId: 1, monthNumber: 1, yearNumber: 1 });
quoteSchema.index({ category: 1, createdAt: -1 });
quoteSchema.index({ author: 1, createdAt: -1 });
quoteSchema.index({ sentiment: 1 });
// Index for community endpoints - latest quotes across all users
quoteSchema.index({ createdAt: -1 });

// Виртуальные поля
quoteSchema.virtual('displayAuthor').get(function() {
  return this.author || 'Неизвестный автор';
});

quoteSchema.virtual('shortText').get(function() {
  if (this.text.length <= 100) return this.text;
  return this.text.substring(0, 97) + '...';
});

quoteSchema.virtual('ageInDays').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Методы экземпляра
quoteSchema.methods = {
  /**
   * Обновить цитату
   * @param {Object} updates - Обновления
   * @returns {Promise<Quote>}
   */
  async updateQuote(updates) {
    Object.assign(this, updates);
    this.isEdited = true;
    this.editedAt = new Date();
    return this.save();
  },

  /**
   * Получить краткую информацию о цитате
   * @returns {Object}
   */
  toSummary() {
    return {
      id: this._id,
      text: this.shortText,
      author: this.displayAuthor,
      category: this.category,
      sentiment: this.sentiment,
      createdAt: this.createdAt,
      isEdited: this.isEdited
    };
  },

  /**
   * Получить полную информацию для отчета
   * @returns {Object}
   */
  toReportFormat() {
    const author = this.author ? ` (${this.author})` : '';
    return `"${this.text}"${author}`;
  }
};

// Статические методы
quoteSchema.statics = {
  /**
   * Получить цитаты пользователя за период
   * @param {string} userId - ID пользователя
   * @param {Date} startDate - Начальная дата
   * @param {Date} [endDate] - Конечная дата
   * @returns {Promise<Quote[]>}
   */
  async getUserQuotes(userId, startDate, endDate = new Date()) {
    return this.find({
      userId,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ createdAt: 1 });
  },

  /**
   * Получить цитаты пользователя за неделю
   * @param {string} userId - ID пользователя
   * @param {number} weekNumber - Номер недели
   * @param {number} year - Год
   * @returns {Promise<Quote[]>}
   */
  async getWeeklyQuotes(userId, weekNumber, year) {
    return this.find({
      userId,
      weekNumber,
      yearNumber: year
    }).sort({ createdAt: 1 });
  },

  /**
   * Получить цитаты пользователя за месяц
   * @param {string} userId - ID пользователя
   * @param {number} month - Номер месяца
   * @param {number} year - Год
   * @returns {Promise<Quote[]>}
   */
  async getMonthlyQuotes(userId, month, year) {
    return this.find({
      userId,
      monthNumber: month,
      yearNumber: year
    }).sort({ createdAt: 1 });
  },

  /**
   * Подсчитать цитаты пользователя за сегодня
   * @param {string} userId - ID пользователя
   * @returns {Promise<number>}
   */
  async getTodayQuotesCount(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.countDocuments({
      userId,
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
  },

  /**
   * Получить топ авторов за период
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getTopAuthors(startDate = null) {
    const match = startDate ? { 
      createdAt: { $gte: startDate },
      author: { $ne: null, $nin: ['', null] }
    } : { 
      author: { $ne: null, $nin: ['', null] }
    };

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$author',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
  },

  /**
   * Получить топ категории за период
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getTopCategories(startDate = null) {
    const match = startDate ? { createdAt: { $gte: startDate } } : {};

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
  },

  /**
   * Найти похожие цитаты
   * @param {string} text - Текст для поиска
   * @param {string} [excludeUserId] - Исключить пользователя
   * @returns {Promise<Array>}
   */
  async findSimilarQuotes(text, excludeUserId = null) {
    const match = {
      $text: { $search: text }
    };

    if (excludeUserId) {
      match.userId = { $ne: excludeUserId };
    }

    return this.find(match, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(5);
  },

  /**
   * Получить статистику по цитатам
   * @param {string} period - Период ('7d', '30d', '90d')
   * @returns {Promise<Object>}
   */
  async getQuoteStats(period = '7d') {
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalQuotes, avgPerDay, topCategory] = await Promise.all([
      this.countDocuments({ createdAt: { $gte: startDate } }),
      this.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: null,
            avgPerDay: { $avg: '$count' }
          }
        }
      ]),
      this.getTopCategories(startDate)
    ]);

    return {
      totalQuotes,
      avgPerDay: avgPerDay.length > 0 ? Math.round(avgPerDay[0].avgPerDay) : 0,
      topCategory: topCategory.length > 0 ? topCategory[0]._id : 'Другое',
      period
    };
  },

  /**
   * Поиск цитат пользователя
   * @param {string} userId - ID пользователя
   * @param {string} searchText - Текст для поиска
   * @param {number} [limit=20] - Лимит результатов
   * @returns {Promise<Quote[]>}
   */
  async searchUserQuotes(userId, searchText, limit = 20) {
    const searchRegex = new RegExp(searchText, 'i');
    
    return this.find({
      userId,
      $or: [
        { text: searchRegex },
        { author: searchRegex },
        { source: searchRegex }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  }
};

// Middleware перед сохранением
quoteSchema.pre('save', function(next) {
  if (this.isNew) {
    // Use business timezone aware ISO week calculation
    const { getISOWeekInfo, getBusinessNow } = require('../utils/isoWeek');
    const businessNow = getBusinessNow();
    const weekInfo = getISOWeekInfo(businessNow);
    
    // Set ISO week/year based on business timezone (Moscow time)
    this.weekNumber = weekInfo.isoWeek;
    this.yearNumber = weekInfo.isoYear; // Note: ISO year may differ from calendar year at year boundaries
    this.monthNumber = businessNow.getMonth() + 1;
  }
  
  next();
});

// Индекс для текстового поиска
quoteSchema.index({
  text: 'text',
  author: 'text',
  source: 'text'
});

/**
 * @deprecated Use getISOWeekInfo from ../utils/isoWeek.js instead
 * Legacy function kept for backward compatibility
 * Получить номер недели ISO 8601
 * @param {Date} date - Дата
 * @returns {number} Номер недели
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

const Quote = mongoose.model('Quote', quoteSchema);

module.exports = Quote;