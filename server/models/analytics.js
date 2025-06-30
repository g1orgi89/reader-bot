/**
 * @fileoverview Модели для аналитики проекта "Читатель"
 * @author g1orgi89
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/reader').UTMClick} UTMClick
 * @typedef {import('../types/reader').PromoCodeUsage} PromoCodeUsage
 */

/**
 * Схема для отслеживания UTM кликов
 */
const utmClickSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    description: 'ID пользователя'
  },
  source: {
    type: String,
    required: true,
    description: 'utm_source (telegram_bot, email, etc.)'
  },
  medium: {
    type: String,
    required: true,
    description: 'utm_medium (weekly_report, monthly_report, etc.)'
  },
  campaign: {
    type: String,
    required: true,
    description: 'utm_campaign (reader_recommendations, etc.)'
  },
  content: {
    type: String,
    description: 'utm_content (book_title, etc.)'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'Время клика'
  },
  userAgent: {
    type: String,
    description: 'User Agent браузера'
  },
  referrer: {
    type: String,
    description: 'Referrer URL'
  },
  ipAddress: {
    type: String,
    description: 'IP адрес (хешированный)'
  },
  sessionId: {
    type: String,
    description: 'ID сессии'
  }
}, {
  timestamps: true
});

// Индексы для аналитики
utmClickSchema.index({ userId: 1, timestamp: -1 });
utmClickSchema.index({ source: 1, medium: 1, campaign: 1 });
utmClickSchema.index({ campaign: 1, timestamp: -1 });
utmClickSchema.index({ timestamp: -1 });

/**
 * Схема для отслеживания использования промокодов
 */
const promoCodeUsageSchema = new mongoose.Schema({
  promoCode: {
    type: String,
    required: true,
    uppercase: true,
    index: true,
    description: 'Использованный промокод'
  },
  userId: {
    type: String,
    required: true,
    index: true,
    description: 'ID пользователя'
  },
  orderValue: {
    type: Number,
    required: true,
    min: 0,
    description: 'Сумма заказа в долларах'
  },
  discount: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    description: 'Размер скидки в процентах'
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0,
    description: 'Сумма скидки в долларах'
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0,
    description: 'Итоговая сумма после скидки'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'Время использования'
  },
  source: {
    type: String,
    default: 'telegram_bot',
    enum: ['telegram_bot', 'website', 'email', 'manual'],
    description: 'Источник промокода'
  },
  reportType: {
    type: String,
    enum: ['weekly', 'monthly', 'special'],
    description: 'Тип отчета, откуда промокод'
  },
  booksPurchased: [{
    type: String,
    description: 'Список купленных книг/курсов'
  }]
}, {
  timestamps: true
});

// Индексы для аналитики промокодов
promoCodeUsageSchema.index({ promoCode: 1, timestamp: -1 });
promoCodeUsageSchema.index({ userId: 1, timestamp: -1 });
promoCodeUsageSchema.index({ timestamp: -1 });
promoCodeUsageSchema.index({ source: 1, reportType: 1 });

/**
 * Схема для общей аналитики действий пользователей
 */
const userActionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    description: 'ID пользователя'
  },
  action: {
    type: String,
    required: true,
    enum: [
      'quote_added',
      'link_clicked', 
      'promo_used',
      'report_viewed',
      'feedback_given',
      'achievement_unlocked',
      'search_performed',
      'settings_changed'
    ],
    description: 'Тип действия'
  },
  metadata: {
    quoteId: String,
    linkUrl: String,
    promoCode: String,
    reportId: String,
    achievementId: String,
    searchQuery: String,
    settingChanged: String,
    description: 'Дополнительные данные действия'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'Время действия'
  },
  sessionId: {
    type: String,
    description: 'ID сессии пользователя'
  },
  platform: {
    type: String,
    default: 'telegram',
    enum: ['telegram', 'web', 'mobile'],
    description: 'Платформа'
  }
}, {
  timestamps: true
});

// Индексы для аналитики действий
userActionSchema.index({ userId: 1, timestamp: -1 });
userActionSchema.index({ action: 1, timestamp: -1 });
userActionSchema.index({ timestamp: -1 });

// Статические методы для UTMClick
utmClickSchema.statics = {
  /**
   * Записать клик по UTM ссылке
   * @param {Object} clickData - Данные клика
   * @returns {Promise<UTMClick>}
   */
  async recordClick(clickData) {
    return this.create({
      ...clickData,
      timestamp: new Date()
    });
  },

  /**
   * Получить статистику UTM кампаний
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getCampaignStats(startDate = null) {
    const match = {};
    if (startDate) {
      match.timestamp = { $gte: startDate };
    }

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            campaign: '$campaign',
            source: '$source',
            medium: '$medium'
          },
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          campaign: '$_id.campaign',
          source: '$_id.source',
          medium: '$_id.medium',
          clicks: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { clicks: -1 } }
    ]);
  },

  /**
   * Получить топ источники трафика
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getTopSources(startDate = null) {
    const match = {};
    if (startDate) {
      match.timestamp = { $gte: startDate };
    }

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$source',
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          source: '$_id',
          clicks: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { clicks: -1 } }
    ]);
  }
};

// Статические методы для PromoCodeUsage
promoCodeUsageSchema.statics = {
  /**
   * Записать использование промокода
   * @param {Object} usageData - Данные использования
   * @returns {Promise<PromoCodeUsage>}
   */
  async recordUsage(usageData) {
    const discountAmount = usageData.orderValue * (usageData.discount / 100);
    const finalAmount = usageData.orderValue - discountAmount;

    return this.create({
      ...usageData,
      discountAmount,
      finalAmount,
      timestamp: new Date()
    });
  },

  /**
   * Получить статистику промокодов
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Object>}
   */
  async getPromoStats(startDate = null) {
    const match = {};
    if (startDate) {
      match.timestamp = { $gte: startDate };
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalUsages: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalDiscounts: { $sum: '$discountAmount' },
          uniqueUsers: { $addToSet: '$userId' },
          popularCodes: { $push: '$promoCode' }
        }
      }
    ];

    const result = await this.aggregate(pipeline);
    if (!result.length) return null;

    const stats = result[0];
    
    // Подсчет самых популярных промокодов
    const codeFrequency = stats.popularCodes.reduce((acc, code) => {
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});

    return {
      totalUsages: stats.totalUsages,
      totalRevenue: stats.totalRevenue,
      totalDiscounts: stats.totalDiscounts,
      uniqueUsers: stats.uniqueUsers.length,
      averageOrderValue: stats.totalRevenue / stats.totalUsages,
      topCodes: Object.entries(codeFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([code, count]) => ({ code, count }))
    };
  },

  /**
   * Получить конверсию по источникам
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getConversionBySource(startDate = null) {
    const match = {};
    if (startDate) {
      match.timestamp = { $gte: startDate };
    }

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$source',
          usages: { $sum: 1 },
          revenue: { $sum: '$finalAmount' },
          averageOrder: { $avg: '$finalAmount' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);
  }
};

// Статические методы для UserAction
userActionSchema.statics = {
  /**
   * Записать действие пользователя
   * @param {string} userId - ID пользователя
   * @param {string} action - Тип действия
   * @param {Object} [metadata] - Дополнительные данные
   * @returns {Promise<UserAction>}
   */
  async recordAction(userId, action, metadata = {}) {
    return this.create({
      userId,
      action,
      metadata,
      timestamp: new Date()
    });
  },

  /**
   * Получить активность пользователя
   * @param {string} userId - ID пользователя
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getUserActivity(userId, startDate = null) {
    const match = { userId };
    if (startDate) {
      match.timestamp = { $gte: startDate };
    }

    return this.find(match)
      .sort({ timestamp: -1 })
      .limit(100);
  },

  /**
   * Получить статистику действий
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getActionStats(startDate = null) {
    const match = {};
    if (startDate) {
      match.timestamp = { $gte: startDate };
    }

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          action: '$_id',
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }
};

const UTMClick = mongoose.model('UTMClick', utmClickSchema);
const PromoCodeUsage = mongoose.model('PromoCodeUsage', promoCodeUsageSchema);
const UserAction = mongoose.model('UserAction', userActionSchema);

module.exports = {
  UTMClick,
  PromoCodeUsage,
  UserAction
};