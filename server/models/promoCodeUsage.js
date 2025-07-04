/**
 * Promo Code Usage tracking model for Reader Bot analytics
 * @file server/models/promoCodeUsage.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @typedef {Object} PromoCodeUsageData
 * @property {string} promoCode - The promo code used
 * @property {string} userId - User ID who used the code
 * @property {number} orderValue - Order value in USD
 * @property {number} discount - Discount percentage applied
 * @property {number} discountAmount - Actual discount amount in USD
 * @property {Date} timestamp - When the code was used
 * @property {string} source - Where the code was generated (reader_bot, manual, etc.)
 * @property {Object} metadata - Additional tracking data
 */

const promoCodeUsageSchema = new mongoose.Schema({
  promoCode: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  orderValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  discount: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  discountAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    required: true,
    index: true,
    enum: [
      'reader_bot',
      'telegram_bot',
      'manual',
      'instagram',
      'youtube',
      'email_campaign',
      'affiliate',
      'other'
    ],
    default: 'reader_bot'
  },
  // Product/book information
  product: {
    title: String,
    category: {
      type: String,
      enum: ['book_analysis', 'course', 'consultation', 'bundle', 'other']
    },
    originalPrice: Number
  },
  // User information at time of purchase
  userInfo: {
    registrationDate: Date,
    totalQuotes: Number,
    weeksSinceRegistration: Number,
    source: String, // How user found the bot
    lastActivity: Date
  },
  // Campaign tracking
  campaign: {
    name: String,
    type: {
      type: String,
      enum: ['weekly_report', 'monthly_report', 'achievement', 'announcement', 'reminder', 'other']
    },
    reportId: String // Link to specific report that generated this code
  },
  // Additional metadata
  metadata: {
    userAgent: String,
    ip: String,
    country: String,
    device: String,
    sessionId: String,
    referrer: String
  }
}, {
  timestamps: true,
  collection: 'promoCodeUsages'
});

// Compound indexes for efficient analytics queries
promoCodeUsageSchema.index({ promoCode: 1, timestamp: -1 });
promoCodeUsageSchema.index({ userId: 1, timestamp: -1 });
promoCodeUsageSchema.index({ source: 1, timestamp: -1 });
promoCodeUsageSchema.index({ 'campaign.type': 1, timestamp: -1 });
promoCodeUsageSchema.index({ timestamp: -1, orderValue: -1 });

/**
 * Pre-save hook to calculate discount amount and validate data
 */
promoCodeUsageSchema.pre('save', function(next) {
  // Calculate discount amount if not provided
  if (this.orderValue && this.discount && !this.discountAmount) {
    this.discountAmount = Math.round((this.orderValue * this.discount / 100) * 100) / 100;
  }

  // Ensure promo code is uppercase
  if (this.promoCode) {
    this.promoCode = this.promoCode.toUpperCase();
  }

  next();
});

/**
 * Post-save hook for logging
 */
promoCodeUsageSchema.post('save', function(doc) {
  logger.info('🎁 Promo code usage tracked:', {
    userId: doc.userId,
    promoCode: doc.promoCode,
    orderValue: doc.orderValue,
    discount: doc.discount,
    discountAmount: doc.discountAmount,
    source: doc.source,
    timestamp: doc.timestamp
  });
});

/**
 * Static method to get promo code performance stats
 * @param {string} promoCode - Promo code
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Promo code performance
 */
promoCodeUsageSchema.statics.getPromoCodePerformance = async function(promoCode, startDate, endDate) {
  try {
    const results = await this.aggregate([
      {
        $match: {
          promoCode: promoCode.toUpperCase(),
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalUsages: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          totalRevenue: { $sum: '$orderValue' },
          totalDiscount: { $sum: '$discountAmount' },
          avgOrderValue: { $avg: '$orderValue' },
          sources: { $addToSet: '$source' }
        }
      },
      {
        $project: {
          totalUsages: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalDiscount: { $round: ['$totalDiscount', 2] },
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          sourceCount: { $size: '$sources' },
          revenueAfterDiscount: {
            $round: [{ $subtract: ['$totalRevenue', '$totalDiscount'] }, 2]
          }
        }
      }
    ]);

    return results[0] || {
      totalUsages: 0,
      uniqueUsers: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      avgOrderValue: 0,
      sourceCount: 0,
      revenueAfterDiscount: 0
    };
  } catch (error) {
    logger.error('Error getting promo code performance:', error);
    throw error;
  }
};

/**
 * Static method to get top performing promo codes
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {number} limit - Number of codes to return
 * @returns {Promise<Array>} Top promo codes
 */
promoCodeUsageSchema.statics.getTopPromoCodes = async function(startDate, endDate, limit = 10) {
  try {
    return await this.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$promoCode',
          totalUsages: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          totalRevenue: { $sum: '$orderValue' },
          totalDiscount: { $sum: '$discountAmount' },
          avgDiscount: { $avg: '$discount' },
          lastUsed: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          promoCode: '$_id',
          totalUsages: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalDiscount: { $round: ['$totalDiscount', 2] },
          avgDiscount: { $round: ['$avgDiscount', 1] },
          lastUsed: 1,
          revenueAfterDiscount: {
            $round: [{ $subtract: ['$totalRevenue', '$totalDiscount'] }, 2]
          }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit }
    ]);
  } catch (error) {
    logger.error('Error getting top promo codes:', error);
    throw error;
  }
};

/**
 * Static method to get revenue trends by source
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Revenue by source
 */
promoCodeUsageSchema.statics.getRevenueBySource = async function(startDate, endDate) {
  try {
    return await this.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$source',
          totalUsages: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          totalRevenue: { $sum: '$orderValue' },
          totalDiscount: { $sum: '$discountAmount' },
          avgOrderValue: { $avg: '$orderValue' }
        }
      },
      {
        $project: {
          source: '$_id',
          totalUsages: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalDiscount: { $round: ['$totalDiscount', 2] },
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          revenueAfterDiscount: {
            $round: [{ $subtract: ['$totalRevenue', '$totalDiscount'] }, 2]
          },
          conversionRate: {
            $multiply: [
              { $divide: ['$uniqueUsers', '$totalUsages'] },
              100
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);
  } catch (error) {
    logger.error('Error getting revenue by source:', error);
    throw error;
  }
};

/**
 * Static method to get daily revenue trends
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Daily revenue trends
 */
promoCodeUsageSchema.statics.getDailyRevenueTrends = async function(startDate, endDate) {
  try {
    return await this.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          totalUsages: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          totalRevenue: { $sum: '$orderValue' },
          totalDiscount: { $sum: '$discountAmount' },
          avgOrderValue: { $avg: '$orderValue' }
        }
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          },
          totalUsages: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalDiscount: { $round: ['$totalDiscount', 2] },
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          revenueAfterDiscount: {
            $round: [{ $subtract: ['$totalRevenue', '$totalDiscount'] }, 2]
          }
        }
      },
      { $sort: { date: 1 } }
    ]);
  } catch (error) {
    logger.error('Error getting daily revenue trends:', error);
    throw error;
  }
};

/**
 * Static method to get campaign effectiveness
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Campaign effectiveness data
 */
promoCodeUsageSchema.statics.getCampaignEffectiveness = async function(startDate, endDate) {
  try {
    return await this.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          'campaign.type': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$campaign.type',
          totalUsages: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          totalRevenue: { $sum: '$orderValue' },
          totalDiscount: { $sum: '$discountAmount' },
          avgOrderValue: { $avg: '$orderValue' },
          campaigns: { $addToSet: '$campaign.name' }
        }
      },
      {
        $project: {
          campaignType: '$_id',
          totalUsages: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalDiscount: { $round: ['$totalDiscount', 2] },
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          campaignCount: { $size: '$campaigns' },
          revenueAfterDiscount: {
            $round: [{ $subtract: ['$totalRevenue', '$totalDiscount'] }, 2]
          },
          avgRevenuePerCampaign: {
            $round: [
              { $divide: ['$totalRevenue', { $size: '$campaigns' }] },
              2
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);
  } catch (error) {
    logger.error('Error getting campaign effectiveness:', error);
    throw error;
  }
};

/**
 * Instance method to enrich usage with user data
 * @param {Object} userData - Additional user data
 * @returns {Promise<PromoCodeUsage>} Updated usage document
 */
promoCodeUsageSchema.methods.enrichUserData = async function(userData) {
  try {
    this.userInfo = { ...this.userInfo.toObject(), ...userData };
    return await this.save();
  } catch (error) {
    logger.error('Error enriching promo code usage with user data:', error);
    throw error;
  }
};

/**
 * Virtual for calculating savings percentage
 */
promoCodeUsageSchema.virtual('savingsPercentage').get(function() {
  if (!this.orderValue || this.orderValue === 0) return 0;
  return Math.round((this.discountAmount / this.orderValue) * 100);
});

/**
 * Virtual for calculating final price
 */
promoCodeUsageSchema.virtual('finalPrice').get(function() {
  return Math.round((this.orderValue - this.discountAmount) * 100) / 100;
});

// Ensure virtuals are included in JSON output
promoCodeUsageSchema.set('toJSON', { virtuals: true });
promoCodeUsageSchema.set('toObject', { virtuals: true });

/**
 * Create and export the PromoCodeUsage model
 */
const PromoCodeUsage = mongoose.model('PromoCodeUsage', promoCodeUsageSchema);

module.exports = PromoCodeUsage;