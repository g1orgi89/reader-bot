/**
 * @fileoverview Модель каталога разборов книг Анны Бусел
 * @description Переносим хардкодированные данные из weeklyReportService в БД
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');

/**
 * @typedef {Object} BookCatalogDocument
 * @property {string} title - Название книги/курса
 * @property {string} author - Автор книги (если применимо)
 * @property {string} description - Описание разбора
 * @property {string} price - Цена в формате "$X"
 * @property {string[]} categories - Категории для рекомендаций (14 категорий сайта)
 * @property {string[]} targetThemes - Темы цитат для рекомендаций
 * @property {string} bookSlug - Идентификатор для UTM ссылок
 * @property {boolean} isActive - Активна ли книга для рекомендаций
 * @property {number} priority - Приоритет в рекомендациях (1-10)
 * @property {string} reasoning - Причина рекомендации (шаблон)
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата обновления
 */

const bookCatalogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  author: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null
  },
  
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  price: {
    type: String,
    required: true,
    match: /^\$\d+$/,
    default: '$10'
  },
  
  priceRub: {
    type: Number,
    min: 0,
    default: null
  },
  
  priceByn: {
    type: Number,
    min: 0,
    default: null
  },
  
  categories: [{
    type: String,
    enum: [
      'КРИЗИСЫ',
      'Я — ЖЕНЩИНА',
      'ЛЮБОВЬ',
      'ОТНОШЕНИЯ',
      'ДЕНЬГИ',
      'ОДИНОЧЕСТВО',
      'СМЕРТЬ',
      'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
      'СМЫСЛ ЖИЗНИ',
      'СЧАСТЬЕ',
      'ВРЕМЯ И ПРИВЫЧКИ',
      'ДОБРО И ЗЛО',
      'ОБЩЕСТВО',
      'ПОИСК СЕБЯ'
    ],
    required: true
  }],
  
  targetThemes: [{
    type: String,
    trim: true
  }],
  
  bookSlug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[a-z0-9_-]+$/
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  reasoning: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  }
}, {
  timestamps: true,
  collection: 'book_catalog'
});

// Индексы для оптимизации запросов
bookCatalogSchema.index({ isActive: 1, priority: -1 });
bookCatalogSchema.index({ categories: 1 });
bookCatalogSchema.index({ targetThemes: 1 });
bookCatalogSchema.index({ bookSlug: 1 }, { unique: true });

/**
 * Получить активные книги для рекомендаций
 * @param {string[]} themes - Темы цитат пользователя
 * @param {number} limit - Максимум книг
 * @returns {Promise<BookCatalogDocument[]>}
 */
bookCatalogSchema.statics.getRecommendationsByThemes = async function(themes, limit = 2) {
  const pipeline = [
    // Только активные книги
    { $match: { isActive: true } },
    
    // Добавляем поле relevanceScore на основе совпадений тем
    {
      $addFields: {
        relevanceScore: {
          $size: {
            $setIntersection: ['$categories', themes]
          }
        }
      }
    },
    
    // Сортируем по релевантности, затем по приоритету
    { $sort: { relevanceScore: -1, priority: -1, createdAt: -1 } },
    
    // Ограничиваем результат
    { $limit: limit },
    
    // Убираем временное поле
    { $project: { relevanceScore: 0 } }
  ];
  
  return this.aggregate(pipeline);
};

/**
 * Получить универсальные рекомендации (когда нет подходящих тем)
 * @param {number} limit - Максимум книг
 * @returns {Promise<BookCatalogDocument[]>}
 */
bookCatalogSchema.statics.getUniversalRecommendations = async function(limit = 2) {
  return this.find({
    isActive: true,
    categories: 'ПОИСК СЕБЯ'  // Самая универсальная категория из 14
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

/**
 * Получить книгу по slug для UTM ссылок
 * @param {string} slug - Идентификатор книги
 * @returns {Promise<BookCatalogDocument|null>}
 */
bookCatalogSchema.statics.getBySlug = async function(slug) {
  return this.findOne({ bookSlug: slug, isActive: true });
};

/**
 * Получить статистику каталога
 * @returns {Promise<Object>}
 */
bookCatalogSchema.statics.getStats = async function() {
  const [total, active, categoryStats] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  return {
    total,
    active,
    inactive: total - active,
    categoriesBreakdown: categoryStats.reduce((acc, cat) => {
      acc[cat._id] = cat.count;
      return acc;
    }, {})
  };
};

/**
 * Виртуальное поле для полной UTM ссылки
 */
bookCatalogSchema.virtual('utmLink').get(function() {
  const baseUrl = process.env.ANNA_WEBSITE_URL || "https://anna-busel.com/books";
  const utmParams = new URLSearchParams({
    utm_source: 'telegram_bot',
    utm_medium: 'weekly_report', 
    utm_campaign: 'reader_recommendations',
    utm_content: this.bookSlug
  });
  
  return `${baseUrl}?${utmParams.toString()}`;
});

// Включаем виртуальные поля в JSON
bookCatalogSchema.set('toJSON', { virtuals: true });
bookCatalogSchema.set('toObject', { virtuals: true });

const BookCatalog = mongoose.model('BookCatalog', bookCatalogSchema);

module.exports = BookCatalog;
