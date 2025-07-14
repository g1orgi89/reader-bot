/**
 * @fileoverview Модель шаблонов UTM ссылок для отслеживания
 * @description Переносим хардкодированные UTM ссылки из сервисов в БД
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');

const utmTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  baseUrl: {
    type: String,
    required: true,
    trim: true
  },
  
  utmSource: {
    type: String,
    required: true,
    trim: true,
    default: 'telegram_bot'
  },
  
  utmMedium: {
    type: String,
    required: true,
    trim: true
  },
  
  utmCampaign: {
    type: String,
    required: true,
    trim: true
  },
  
  utmContent: {
    type: String,
    trim: true
  },
  
  utmTerm: {
    type: String,
    trim: true
  },
  
  context: {
    type: String,
    enum: [
      'weekly_report',
      'monthly_report',
      'announcement',
      'book_recommendation',
      'promo_code'
    ],
    required: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'utm_templates'
});

// Индексы
utmTemplateSchema.index({ name: 1 }, { unique: true });
utmTemplateSchema.index({ context: 1, isActive: 1 });

/**
 * Генерировать UTM ссылку по шаблону
 * @param {Object} params - Параметры для подстановки
 * @returns {string} Готовая UTM ссылка
 */
utmTemplateSchema.methods.generateLink = function(params = {}) {
  const utmParams = new URLSearchParams({
    utm_source: this.utmSource,
    utm_medium: this.utmMedium,
    utm_campaign: this.replaceVariables(this.utmCampaign, params),
    ...(this.utmContent && { utm_content: this.replaceVariables(this.utmContent, params) }),
    ...(this.utmTerm && { utm_term: this.replaceVariables(this.utmTerm, params) }),
    ...params.additionalParams
  });
  
  return `${this.baseUrl}?${utmParams.toString()}`;
};

/**
 * Заменить переменные в строке
 * @param {string} str - Строка с переменными
 * @param {Object} params - Параметры для замены
 * @returns {string}
 */
utmTemplateSchema.methods.replaceVariables = function(str, params) {
  return str.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] || match;
  });
};

/**
 * Получить шаблоны по контексту
 * @param {string} context - Контекст использования
 * @returns {Promise<UtmTemplateDocument[]>}
 */
utmTemplateSchema.statics.getByContext = async function(context) {
  return this.find({ context, isActive: true }).sort({ name: 1 });
};

/**
 * Получить статистику шаблонов
 */
utmTemplateSchema.statics.getStats = async function() {
  const [total, active, contextStats] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$context', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  return {
    total,
    active,
    inactive: total - active,
    contextBreakdown: contextStats.reduce((acc, ctx) => {
      acc[ctx._id] = ctx.count;
      return acc;
    }, {})
  };
};

const UtmTemplate = mongoose.model('UtmTemplate', utmTemplateSchema);

module.exports = UtmTemplate;
