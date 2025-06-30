/**
 * @fileoverview Модель цитат для бота "Читатель"
 * @author g1orgi89
 */

const mongoose = require('mongoose');
const { QUOTE_CATEGORIES } = require('../types');

/**
 * @typedef {import('../types/reader').Quote} Quote
 */

/**
 * Схема цитаты
 */
const quoteSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    description: 'ID пользователя Telegram'
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000,
    description: 'Текст цитаты'
  },
  author: {
    type: String,
    maxlength: 200,
    description: 'Автор цитаты (если указан)'
  },
  source: {
    type: String,
    maxlength: 300,
    description: 'Источник цитаты (книга, статья и т.д.)'
  },
  category: {
    type: String,
    enum: Object.values(QUOTE_CATEGORIES),
    default: QUOTE_CATEGORIES.OTHER,
    index: true,
    description: 'AI-определенная тема/категория'
  },
  weekNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 53,
    index: true,
    description: 'Номер недели в году'
  },
  monthNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    index: true,
    description: 'Номер месяца'
  },
  year: {
    type: Number,
    required: true,
    index: true,
    description: 'Год'
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
    description: 'Флаг удаления'
  },
  // Метаданные для анализа
  analysisData: {
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      description: 'Уверенность в определении категории'
    },
    themes: [{
      type: String,
      description: 'Выявленные темы'
    }],
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      description: 'Эмоциональная окраска'
    },
    suggestedBooks: [{
      type: String,
      description: 'ID предложенных книг'
    }]
  },
  // Технические поля
  telegramMessageId: {
    type: String,
    description: 'ID сообщения в Telegram'
  },
  editHistory: [{
    oldText: String,
    newText: String,
    editedAt: Date,
    description: 'История редактирования'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для оптимизации запросов
quoteSchema.index({ userId: 1, createdAt: -1 });
quoteSchema.index({ userId: 1, weekNumber: 1, year: 1 });
quoteSchema.index({ userId: 1, monthNumber: 1, year: 1 });
quoteSchema.index({ category: 1, createdAt: -1 });
quoteSchema.index({ userId: 1, isDeleted: 1 });
quoteSchema.index({ createdAt: -1 });

// Виртуальные поля
quoteSchema.virtual('isRecent').get(function() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return this.createdAt > weekAgo;
});

quoteSchema.virtual('wordCount').get(function() {
  return this.text.split(/\s+/).length;
});

// Методы экземпляра
quoteSchema.methods = {
  /**
   * Добавить запись в историю редактирования
   * @param {string} newText - Новый текст
   * @returns {void}
   */
  addToEditHistory(newText) {
    this.editHistory.push({
      oldText: this.text,
      newText: newText,
      editedAt: new Date()
    });
    this.text = newText;
  },

  /**
   * Мягкое удаление цитаты
   * @returns {Promise<Quote>}
   */
  async softDelete() {
    this.isDeleted = true;
    return this.save();
  },

  /**
   * Восстановить удаленную цитату
   * @returns {Promise<Quote>}
   */
  async restore() {
    this.isDeleted = false;
    return this.save();
  },

  /**
   * Получить краткое представление цитаты
   * @returns {Object}
   */
  toSummary() {
    return {
      id: this._id,
      text: this.text.length > 100 ? this.text.substring(0, 97) + '...' : this.text,
      author: this.author,
      category: this.category,
      createdAt: this.createdAt
    };
  }
};

// Статические методы
quoteSchema.statics = {
  /**
   * Найти цитаты пользователя за определенную неделю
   * @param {string} userId - ID пользователя
   * @param {number} weekNumber - Номер недели
   * @param {number} year - Год
   * @returns {Promise<Quote[]>}
   */
  async findByUserWeek(userId, weekNumber, year) {
    return this.find({
      userId,
      weekNumber,
      year,
      isDeleted: false
    }).sort({ createdAt: -1 });
  },

  /**
   * Найти цитаты пользователя за определенный месяц
   * @param {string} userId - ID пользователя
   * @param {number} monthNumber - Номер месяца
   * @param {number} year - Год
   * @returns {Promise<Quote[]>}
   */
  async findByUserMonth(userId, monthNumber, year) {
    return this.find({
      userId,
      monthNumber,
      year,
      isDeleted: false
    }).sort({ createdAt: -1 });
  },

  /**
   * Получить статистику цитат пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>}
   */
  async getUserStats(userId) {
    const pipeline = [
      { $match: { userId, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalQuotes: { $sum: 1 },
          categories: { $push: '$category' },
          authors: { $push: '$author' },
          firstQuote: { $min: '$createdAt' },
          lastQuote: { $max: '$createdAt' }
        }
      }
    ];

    const result = await this.aggregate(pipeline);
    if (!result.length) return null;

    const stats = result[0];
    
    // Подсчет категорий
    const categoriesCount = stats.categories.reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Подсчет авторов (только не пустые)
    const authorsCount = stats.authors.filter(author => author).reduce((acc, author) => {
      acc[author] = (acc[author] || 0) + 1;
      return acc;
    }, {});

    return {
      totalQuotes: stats.totalQuotes,
      categoriesCount,
      authorsCount,
      favoriteAuthors: Object.entries(authorsCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([author, count]) => ({ author, count })),
      firstQuote: stats.firstQuote,
      lastQuote: stats.lastQuote,
      daysSinceFirst: Math.floor((new Date() - stats.firstQuote) / (1000 * 60 * 60 * 24))
    };
  },

  /**
   * Поиск цитат по тексту
   * @param {string} userId - ID пользователя
   * @param {string} searchText - Текст для поиска
   * @param {number} [limit=10] - Количество результатов
   * @returns {Promise<Quote[]>}
   */
  async searchByText(userId, searchText, limit = 10) {
    return this.find({
      userId,
      isDeleted: false,
      $or: [
        { text: { $regex: searchText, $options: 'i' } },
        { author: { $regex: searchText, $options: 'i' } },
        { source: { $regex: searchText, $options: 'i' } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  },

  /**
   * Получить цитаты по категории
   * @param {string} userId - ID пользователя
   * @param {string} category - Категория
   * @param {number} [limit=20] - Количество результатов
   * @returns {Promise<Quote[]>}
   */
  async findByCategory(userId, category, limit = 20) {
    return this.find({
      userId,
      category,
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  },

  /**
   * Получить случайную цитату пользователя
   * @param {string} userId - ID пользователя
   * @param {string} [category] - Фильтр по категории
   * @returns {Promise<Quote|null>}
   */
  async getRandomQuote(userId, category = null) {
    const match = { userId, isDeleted: false };
    if (category) match.category = category;

    const pipeline = [
      { $match: match },
      { $sample: { size: 1 } }
    ];

    const result = await this.aggregate(pipeline);
    return result.length ? result[0] : null;
  },

  /**
   * Получить тренды категорий по месяцам
   * @param {string} userId - ID пользователя
   * @param {number} [monthsBack=6] - Количество месяцев назад
   * @returns {Promise<Object>}
   */
  async getCategoryTrends(userId, monthsBack = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const pipeline = [
      {
        $match: {
          userId,
          isDeleted: false,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            month: '$monthNumber',
            year: '$year',
            category: '$category'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: { month: '$_id.month', year: '$_id.year' },
          categories: {
            $push: {
              category: '$_id.category',
              count: '$count'
            }
          },
          totalQuotes: { $sum: '$count' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ];

    return this.aggregate(pipeline);
  }
};

// Middleware перед сохранением
quoteSchema.pre('save', function(next) {
  // Автоматически заполняем номер недели и месяца если не указаны
  if (this.isNew) {
    const now = new Date();
    
    if (!this.weekNumber) {
      this.weekNumber = getWeekNumber(this.createdAt || now);
    }
    
    if (!this.monthNumber) {
      this.monthNumber = (this.createdAt || now).getMonth() + 1;
    }

    if (!this.year) {
      this.year = (this.createdAt || now).getFullYear();
    }
  }
  
  next();
});

/**
 * Получить номер недели в году
 * @param {Date} date - Дата
 * @returns {number} Номер недели
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const Quote = mongoose.model('Quote', quoteSchema);

module.exports = Quote;