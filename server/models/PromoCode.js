/**
 * @fileoverview Модель системы промокодов и скидок
 * @description Переносим хардкодированные промокоды из сервисов в БД
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');

/**
 * @typedef {Object} PromoCodeDocument
 * @property {string} code - Код промокода (например, READER20)
 * @property {string} description - Описание промокода
 * @property {number} discount - Размер скидки в процентах
 * @property {string} discountType - Тип скидки (percentage, fixed)
 * @property {number} maxUses - Максимальное количество использований
 * @property {number} currentUses - Текущее количество использований
 * @property {Date} validFrom - Действителен с
 * @property {Date} validUntil - Действителен до
 * @property {boolean} isActive - Активен ли промокод
 * @property {string[]} usageContext - Контекст использования
 * @property {string[]} targetAudience - Целевая аудитория
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата обновления
 */

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: /^[A-Z0-9]+$/,
    maxlength: 20
  },
  
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  discount: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  
  maxUses: {
    type: Number,
    min: 1,
    default: 1000
  },
  
  currentUses: {
    type: Number,
    min: 0,
    default: 0
  },
  
  validFrom: {
    type: Date,
    default: Date.now
  },
  
  validUntil: {
    type: Date,
    required: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  usageContext: [{
    type: String,
    enum: [
      'weekly_report',
      'monthly_report', 
      'announcement',
      'welcome_bonus',
      'achievement_reward',
      'special_offer',
      'general'
    ],
    default: 'general'
  }],
  
  targetAudience: [{
    type: String,
    enum: [
      'new_users',
      'active_users',
      'mothers',
      'self_development',
      'relationships',
      'all'
    ],
    default: 'all'
  }]
}, {
  timestamps: true,
  collection: 'promo_codes'
});

// Индексы для оптимизации запросов
promoCodeSchema.index({ code: 1 }, { unique: true });
promoCodeSchema.index({ isActive: 1, validUntil: 1 });
promoCodeSchema.index({ usageContext: 1 });
promoCodeSchema.index({ targetAudience: 1 });

/**
 * Получить активные промокоды по контексту
 * @param {string} context - Контекст использования
 * @param {number} limit - Максимум промокодов
 * @returns {Promise<PromoCodeDocument[]>}
 */
promoCodeSchema.statics.getActiveByContext = async function(context, limit = 5) {
  const now = new Date();
  
  return this.find({
    isActive: true,
    usageContext: context,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $expr: { $lt: ['$currentUses', '$maxUses'] }
  })
  .sort({ discount: -1, createdAt: -1 })
  .limit(limit);
};

/**
 * Получить случайный промокод для контекста
 * @param {string} context - Контекст использования
 * @param {string[]} audience - Целевая аудитория
 * @returns {Promise<PromoCodeDocument|null>}
 */
promoCodeSchema.statics.getRandomForContext = async function(context, audience = ['all']) {
  const now = new Date();
  
  const promoCodes = await this.find({
    isActive: true,
    usageContext: context,
    targetAudience: { $in: audience },
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $expr: { $lt: ['$currentUses', '$maxUses'] }
  });
  
  if (promoCodes.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * promoCodes.length);
  return promoCodes[randomIndex];
};

/**
 * Проверить валидность промокода
 * @param {string} code - Код промокода
 * @returns {Promise<{valid: boolean, promoCode?: PromoCodeDocument, reason?: string}>}
 */
promoCodeSchema.statics.validateCode = async function(code) {
  const promoCode = await this.findOne({ code: code.toUpperCase() });
  
  if (!promoCode) {
    return { valid: false, reason: 'Промокод не найден' };
  }
  
  if (!promoCode.isActive) {
    return { valid: false, reason: 'Промокод неактивен' };
  }
  
  const now = new Date();
  
  if (promoCode.validFrom > now) {
    return { valid: false, reason: 'Промокод еще не действует' };
  }
  
  if (promoCode.validUntil < now) {
    return { valid: false, reason: 'Промокод истек' };
  }
  
  if (promoCode.currentUses >= promoCode.maxUses) {
    return { valid: false, reason: 'Превышено максимальное количество использований' };
  }
  
  return { valid: true, promoCode };
};

/**
 * Использовать промокод (увеличить счетчик)
 * @param {string} code - Код промокода
 * @returns {Promise<boolean>}
 */
promoCodeSchema.statics.useCode = async function(code) {
  const result = await this.findOneAndUpdate(
    { 
      code: code.toUpperCase(),
      isActive: true,
      $expr: { $lt: ['$currentUses', '$maxUses'] }
    },
    { $inc: { currentUses: 1 } },
    { new: true }
  );
  
  return !!result;
};

/**
 * Получить статистику промокодов
 * @returns {Promise<Object>}
 */
promoCodeSchema.statics.getStats = async function() {
  const now = new Date();
  
  const [total, active, expired, exhausted, contextStats] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ 
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] }
    }),
    this.countDocuments({ validUntil: { $lt: now } }),
    this.countDocuments({ $expr: { $gte: ['$currentUses', '$maxUses'] } }),
    this.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$usageContext' },
      { $group: { _id: '$usageContext', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  return {
    total,
    active,
    inactive: total - active,
    expired,
    exhausted,
    contextBreakdown: contextStats.reduce((acc, ctx) => {
      acc[ctx._id] = ctx.count;
      return acc;
    }, {})
  };
};

/**
 * Виртуальное поле для проверки истечения срока
 */
promoCodeSchema.virtual('isExpired').get(function() {
  return this.validUntil < new Date();
});

/**
 * Виртуальное поле для проверки исчерпания лимита
 */
promoCodeSchema.virtual('isExhausted').get(function() {
  return this.currentUses >= this.maxUses;
});

/**
 * Виртуальное поле для оставшихся использований
 */
promoCodeSchema.virtual('remainingUses').get(function() {
  return Math.max(0, this.maxUses - this.currentUses);
});

/**
 * Виртуальное поле для процента использования
 */
promoCodeSchema.virtual('usagePercentage').get(function() {
  return Math.round((this.currentUses / this.maxUses) * 100);
});

/**
 * Метод экземпляра для проверки валидности
 * @returns {boolean}
 */
promoCodeSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validUntil >= now && 
         this.currentUses < this.maxUses;
};

/**
 * Метод экземпляра для проверки подходящего контекста
 * @param {string} context - Контекст использования
 * @returns {boolean}
 */
promoCodeSchema.methods.isValidForContext = function(context) {
  return this.isValid() && this.usageContext.includes(context);
};

/**
 * Метод экземпляра для проверки подходящей аудитории
 * @param {string[]} audience - Аудитория пользователя
 * @returns {boolean}
 */
promoCodeSchema.methods.isValidForAudience = function(audience) {
  return this.isValid() && (
    this.targetAudience.includes('all') ||
    this.targetAudience.some(aud => audience.includes(aud))
  );
};

// Включаем виртуальные поля в JSON
promoCodeSchema.set('toJSON', { virtuals: true });
promoCodeSchema.set('toObject', { virtuals: true });

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCode;
