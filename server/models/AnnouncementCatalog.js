/**
 * @fileoverview Модель каталога анонсов курсов/интенсивов Анны Бусел
 * @description Переносим хардкодированные данные из announcementService в БД
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');

/**
 * @typedef {Object} AnnouncementCatalogDocument
 * @property {string} title - Заголовок анонса
 * @property {string} description - Описание курса/интенсива
 * @property {string} price - Цена в формате "$X"
 * @property {string[]} targetAudience - Целевая аудитория
 * @property {string} announcementSlug - Идентификатор для UTM кампаний
 * @property {boolean} isActive - Активен ли анонс
 * @property {number} priority - Приоритет показа (1-10)
 * @property {string[]} months - Месяцы для показа анонса
 * @property {string} promoCode - Промокод для скидки
 * @property {number} discount - Размер скидки в процентах
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата обновления
 */

const announcementCatalogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
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
    default: '$25'
  },
  
  targetAudience: [{
    type: String,
    enum: [
      'mothers',
      'self_development', 
      'relationships',
      'love',
      'women',
      'family',
      'personal_growth',
      'all'
    ],
    required: true
  }],
  
  announcementSlug: {
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
  
  months: [{
    type: Number,
    min: 1,
    max: 12
  }],
  
  promoCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'READER15'
  },
  
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 15
  }
}, {
  timestamps: true,
  collection: 'announcement_catalog'
});

// Индексы для оптимизации запросов
announcementCatalogSchema.index({ isActive: 1, priority: -1 });
announcementCatalogSchema.index({ targetAudience: 1 });
announcementCatalogSchema.index({ months: 1 });
announcementCatalogSchema.index({ announcementSlug: 1 }, { unique: true });

/**
 * Получить анонсы для текущего месяца
 * @param {number} month - Номер месяца (1-12)
 * @param {number} limit - Максимум анонсов
 * @returns {Promise<AnnouncementCatalogDocument[]>}
 */
announcementCatalogSchema.statics.getForMonth = async function(month, limit = 4) {
  return this.find({
    isActive: true,
    $or: [
      { months: month },
      { months: { $size: 0 } } // Анонсы без ограничений по месяцам
    ]
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

/**
 * Получить анонс для пользователя по аудитории
 * @param {string[]} userAudience - Аудитория пользователя
 * @param {number} month - Текущий месяц
 * @returns {Promise<AnnouncementCatalogDocument|null>}
 */
announcementCatalogSchema.statics.getForUserAudience = async function(userAudience, month) {
  // Ищем анонсы подходящие по аудитории и месяцу
  const announcements = await this.find({
    isActive: true,
    targetAudience: { $in: userAudience },
    $or: [
      { months: month },
      { months: { $size: 0 } }
    ]
  })
  .sort({ priority: -1, createdAt: -1 });
  
  return announcements.length > 0 ? announcements[0] : null;
};

/**
 * Получить универсальные анонсы (для всех)
 * @param {number} month - Текущий месяц
 * @param {number} limit - Максимум анонсов
 * @returns {Promise<AnnouncementCatalogDocument[]>}
 */
announcementCatalogSchema.statics.getUniversal = async function(month, limit = 2) {
  return this.find({
    isActive: true,
    targetAudience: 'all',
    $or: [
      { months: month },
      { months: { $size: 0 } }
    ]
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

/**
 * Получить анонс по slug
 * @param {string} slug - Идентификатор анонса
 * @returns {Promise<AnnouncementCatalogDocument|null>}
 */
announcementCatalogSchema.statics.getBySlug = async function(slug) {
  return this.findOne({ announcementSlug: slug, isActive: true });
};

/**
 * Получить статистику анонсов
 * @returns {Promise<Object>}
 */
announcementCatalogSchema.statics.getStats = async function() {
  const [total, active, audienceStats, monthStats] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$targetAudience' },
      { $group: { _id: '$targetAudience', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    this.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$months' },
      { $group: { _id: '$months', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  return {
    total,
    active,
    inactive: total - active,
    audienceBreakdown: audienceStats.reduce((acc, aud) => {
      acc[aud._id] = aud.count;
      return acc;
    }, {}),
    monthsBreakdown: monthStats.reduce((acc, month) => {
      acc[month._id] = month.count;
      return acc;
    }, {})
  };
};

/**
 * Виртуальное поле для месяца в текстовом формате
 */
announcementCatalogSchema.virtual('launchMonth').get(function() {
  const currentMonth = new Date().getMonth() + 1;
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  
  return monthNames[currentMonth - 1] + ' ' + new Date().getFullYear();
});

/**
 * Виртуальное поле для UTM ссылки
 */
announcementCatalogSchema.virtual('utmLink').get(function() {
  const baseUrl = process.env.ANNA_WEBSITE_URL || "https://anna-busel.com/courses";
  const currentMonth = new Date().getMonth() + 1;
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const utmParams = new URLSearchParams({
    utm_source: 'telegram_bot',
    utm_medium: 'monthly_announcement',
    utm_campaign: `${monthNames[currentMonth - 1]}_${this.announcementSlug}`,
    utm_content: 'reader_subscribers',
    discount: this.promoCode
  });
  
  return `${baseUrl}?${utmParams.toString()}`;
});

/**
 * Метод экземпляра для проверки доступности в месяце
 * @param {number} month - Номер месяца
 * @returns {boolean}
 */
announcementCatalogSchema.methods.isAvailableInMonth = function(month) {
  return this.months.length === 0 || this.months.includes(month);
};

/**
 * Метод экземпляра для проверки подходящей аудитории
 * @param {string[]} userAudience - Аудитория пользователя
 * @returns {boolean}
 */
announcementCatalogSchema.methods.matchesAudience = function(userAudience) {
  return this.targetAudience.includes('all') || 
         this.targetAudience.some(aud => userAudience.includes(aud));
};

// Включаем виртуальные поля в JSON
announcementCatalogSchema.set('toJSON', { virtuals: true });
announcementCatalogSchema.set('toObject', { virtuals: true });

const AnnouncementCatalog = mongoose.model('AnnouncementCatalog', announcementCatalogSchema);

module.exports = AnnouncementCatalog;
