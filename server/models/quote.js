/**
 * @fileoverview Модель цитат для бота "Читатель" - обновленная версия
 * @author g1orgi89
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/reader').Quote} Quote
 */

/**
 * Схема цитаты для проекта "Читатель"
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
    maxlength: 1000,
    description: 'Текст цитаты (лимит 1000 символов)'
  },
  author: {
    type: String,
    maxlength: 200,
    description: 'Автор цитаты (может быть пустым)'
  },
  source: {
    type: String,
    maxlength: 300,
    description: 'Источник книги'
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Саморазвитие',
      'Любовь',
      'Философия',
      'Мотивация',
      'Мудрость',
      'Творчество',
      'Отношения',
      'Материнство',
      'Женственность',
      'Другое'
    ],
    index: true,
    description: 'AI-определенная категория'
  },
  weekNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 53,
    index: true,
    description: 'Номер недели года (ISO)'
  },
  monthNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    index: true,
    description: 'Номер месяца'
  },
  yearNumber: {
    type: Number,
    required: true,
    index: true,
    description: 'Год'
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral',
    description: 'Эмоциональная окраска'
  },
  themes: [{
    type: String,
    description: 'AI-определенные темы'
  }],
  
  // Техническая информация
  telegramMessageId: {
    type: String,
    description: 'ID сообщения в Telegram'
  },
  
  // История изменений
  editedAt: {
    type: Date,
    description: 'Дата последнего редактирования'
  },
  
  editHistory: [{
    oldText: String,
    newText: String,
    editedAt: { type: Date, default: Date.now }
  }],
  
  // Флаги
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Составные индексы для оптимизации
quoteSchema.index({ userId: 1, createdAt: -1 });
quoteSchema.index({ userId: 1, weekNumber: 1, yearNumber: 1 });
quoteSchema.index({ userId: 1, monthNumber: 1, yearNumber: 1 });
quoteSchema.index({ userId: 1, category: 1 });
quoteSchema.index({ userId: 1, isDeleted: 1 });
quoteSchema.index({ category: 1, createdAt: -1 });
quoteSchema.index({ createdAt: -1 });

// Виртуальные поля
quoteSchema.virtual('isRecent').get(function() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return this.createdAt > weekAgo;
});

quoteSchema.virtual('shortText').get(function() {
  return this.text.length > 100 ? this.text.substring(0, 97) + '...' : this.text;
});

quoteSchema.virtual('wordCount').get(function() {
  return this.text.split(/\s+/).filter(word => word.length > 0).length;
});

quoteSchema.virtual('hasAuthor').get(function() {
  return !!this.author && this.author.trim().length > 0;
});

// Методы экземпляра
quoteSchema.methods = {
  /**
   * Редактировать текст цитаты
   * @param {string} newText - Новый текст
   * @returns {Promise<Quote>}
   */
  async editText(newText) {
    // Добавляем в историю
    this.editHistory.push({
      oldText: this.text,
      newText: newText,
      editedAt: new Date()
    });
    
    this.text = newText;
    this.editedAt = new Date();
    
    return this.save();
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
   * Восстановить цитату
   * @returns {Promise<Quote>}
   */
  async restore() {
    this.isDeleted = false;
    return this.save();
  },

  /**
   * Обновить AI-анализ цитаты
   * @param {Object} analysis - Результат анализа
   * @param {string} analysis.category - Категория
   * @param {Array<string>} analysis.themes - Темы
   * @param {string} analysis.sentiment - Эмоциональная окраска
   * @returns {Promise<Quote>}
   */
  async updateAnalysis(analysis) {
    if (analysis.category) this.category = analysis.category;
    if (analysis.themes) this.themes = analysis.themes;
    if (analysis.sentiment) this.sentiment = analysis.sentiment;
    
    return this.save();
  },

  /**
   * Получить отформатированное представление для отчета
   * @returns {string}
   */
  toReportFormat() {
    const authorText = this.hasAuthor ? ` (${this.author})` : '';
    return `"${this.text}"${authorText}`;
  },

  /**
   * Получить краткое представление
   * @returns {Object}
   */
  toSummary() {
    return {
      id: this._id,
      text: this.shortText,
      author: this.author,
      category: this.category,
      sentiment: this.sentiment,
      createdAt: this.createdAt,
      hasAuthor: this.hasAuthor,
      isRecent: this.isRecent
    };
  }
};

// Статические методы
quoteSchema.statics = {
  /**
   * Создать новую цитату с автоматическим заполнением недели/месяца
   * @param {Object} quoteData - Данные цитаты
   * @returns {Promise<Quote>}
   */
  async createWithTimeData(quoteData) {
    const now = new Date();
    
    const quote = new this({
      ...quoteData,
      weekNumber: this.getWeekNumber(now),
      monthNumber: now.getMonth() + 1,
      yearNumber: now.getFullYear()
    });
    
    return quote.save();
  },

  /**
   * Найти цитаты пользователя за неделю
   * @param {string} userId - ID пользователя
   * @param {number} weekNumber - Номер недели
   * @param {number} year - Год
   * @returns {Promise<Quote[]>}
   */
  async findByUserWeek(userId, weekNumber, year) {
    return this.find({
      userId,
      weekNumber,
      yearNumber: year,
      isDeleted: false
    }).sort({ createdAt: 1 });
  },

  /**
   * Найти цитаты пользователя за месяц
   * @param {string} userId - ID пользователя
   * @param {number} month - Номер месяца
   * @param {number} year - Год
   * @returns {Promise<Quote[]>}
   */
  async findByUserMonth(userId, month, year) {
    return this.find({
      userId,
      monthNumber: month,
      yearNumber: year,
      isDeleted: false
    }).sort({ createdAt: 1 });
  },

  /**
   * Получить последние цитаты пользователя
   * @param {string} userId - ID пользователя
   * @param {number} [limit=20] - Количество цитат
   * @returns {Promise<Quote[]>}
   */
  async getUserRecentQuotes(userId, limit = 20) {
    return this.find({
      userId,
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  },

  /**
   * Поиск цитат по тексту
   * @param {string} userId - ID пользователя
   * @param {string} searchText - Текст для поиска
   * @param {number} [limit=10] - Лимит результатов
   * @returns {Promise<Quote[]>}
   */
  async searchByText(userId, searchText, limit = 10) {
    const searchRegex = new RegExp(searchText, 'i');
    
    return this.find({
      userId,
      isDeleted: false,
      $or: [
        { text: searchRegex },
        { author: searchRegex },
        { source: searchRegex }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  },

  /**
   * Подсчитать цитаты пользователя за сегодня
   * @param {string} userId - ID пользователя
   * @returns {Promise<number>}
   */
  async countTodayQuotes(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.countDocuments({
      userId,
      isDeleted: false,
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
  },

  /**
   * Получить статистику категорий пользователя
   * @param {string} userId - ID пользователя
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getCategoryStats(userId, startDate = null) {
    const match = {
      userId,
      isDeleted: false
    };
    
    if (startDate) {
      match.createdAt = { $gte: startDate };
    }
    
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  },

  /**
   * Получить топ авторов пользователя
   * @param {string} userId - ID пользователя
   * @param {number} [limit=10] - Лимит результатов
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getTopAuthors(userId, limit = 10, startDate = null) {
    const match = {
      userId,
      isDeleted: false,
      author: { $exists: true, $ne: null, $ne: '' }
    };
    
    if (startDate) {
      match.createdAt = { $gte: startDate };
    }
    
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$author',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
  },

  /**
   * Получить популярные цитаты (повторяющиеся тексты)
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getPopularQuotes(startDate = null) {
    const match = { isDeleted: false };
    
    if (startDate) {
      match.createdAt = { $gte: startDate };
    }
    
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$text',
          author: { $first: '$author' },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
  },

  /**
   * Получить номер недели по ISO стандарту
   * @param {Date} date - Дата
   * @returns {number} Номер недели
   */
  getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  },

  /**
   * Получить пользователей с цитатами за период (для отчетов)
   * @param {Date} startDate - Начальная дата
   * @param {Date} endDate - Конечная дата
   * @returns {Promise<Array>}
   */
  async getUsersWithQuotesInPeriod(startDate, endDate) {
    return this.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$userId',
          quotesCount: { $sum: 1 },
          quotes: { $push: '$$ROOT' }
        }
      },
      { $match: { quotesCount: { $gt: 0 } } }
    ]);
  }
};

// Middleware перед сохранением
quoteSchema.pre('save', function(next) {
  // Автоматически заполняем временные поля для новых цитат
  if (this.isNew) {
    const now = this.createdAt || new Date();
    
    if (!this.weekNumber) {
      this.weekNumber = this.constructor.getWeekNumber(now);
    }
    
    if (!this.monthNumber) {
      this.monthNumber = now.getMonth() + 1;
    }

    if (!this.yearNumber) {
      this.yearNumber = now.getFullYear();
    }
    
    // Устанавливаем дефолтную категорию если не указана
    if (!this.category) {
      this.category = 'Другое';
    }
  }
  
  next();
});

const Quote = mongoose.model('Quote', quoteSchema);

module.exports = Quote;