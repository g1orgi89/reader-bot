/**
 * UTM Click tracking model for Reader Bot analytics
 * @file server/models/utmClick.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @typedef {Object} UTMClickData
 * @property {string} userId - User ID who clicked
 * @property {string} source - UTM source (e.g., 'telegram_bot')
 * @property {string} medium - UTM medium (e.g., 'weekly_report')
 * @property {string} campaign - UTM campaign (e.g., 'reader_recommendations')
 * @property {string} content - UTM content (e.g., book title)
 * @property {Date} timestamp - When the click occurred
 * @property {string} userAgent - User's browser agent
 * @property {string} referrer - Referring page
 * @property {Object} metadata - Additional tracking data
 */

const utmClickSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  source: {
    type: String,
    required: true,
    index: true,
    enum: [
      'telegram_bot',
      'instagram',
      'youtube', 
      'threads',
      'email',
      'direct',
      'other'
    ]
  },
  medium: {
    type: String,
    required: true,
    index: true,
    enum: [
      'weekly_report',
      'monthly_report', 
      'monthly_announcement',
      'reminder',
      'chat_recommendation',
      'achievement_notification',
      'other'
    ]
  },
  campaign: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  referrer: {
    type: String,
    default: ''
  },
  // Additional metadata for analytics
  metadata: {
    ip: String,
    country: String,
    device: String,
    browser: String,
    sessionId: String
  }
}, {
  timestamps: true,
  collection: 'utmClicks'
});

// Compound indexes for efficient analytics queries
utmClickSchema.index({ source: 1, medium: 1, timestamp: -1 });
utmClickSchema.index({ campaign: 1, timestamp: -1 });
utmClickSchema.index({ userId: 1, timestamp: -1 });
utmClickSchema.index({ timestamp: -1, source: 1 });

/**
 * Static method to get campaign performance
 * @param {string} campaign - Campaign name
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Campaign performance stats
 */
utmClickSchema.statics.getCampaignPerformance = async function(campaign, startDate, endDate) {
  try {
    const results = await this.aggregate([
      {
        $match: {
          campaign,
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          sources: { $addToSet: '$source' },
          mediums: { $addToSet: '$medium' }
        }
      },
      {
        $project: {
          totalClicks: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          sourceCount: { $size: '$sources' },
          mediumCount: { $size: '$mediums' },
          clickThroughRate: {
            $multiply: [
              { $divide: ['$uniqueUsers', '$totalClicks'] },
              100
            ]
          }
        }
      }
    ]);

    return results[0] || {
      totalClicks: 0,
      uniqueUsers: 0,
      sourceCount: 0,
      mediumCount: 0,
      clickThroughRate: 0
    };
  } catch (error) {
    logger.error('Error getting campaign performance:', error);
    throw error;
  }
};

/**
 * Static method to get top performing campaigns
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {number} limit - Number of campaigns to return
 * @returns {Promise<Array>} Top campaigns
 */
utmClickSchema.statics.getTopCampaigns = async function(startDate, endDate, limit = 10) {
  try {
    return await this.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$campaign',
          totalClicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          lastClick: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          campaign: '$_id',
          totalClicks: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          lastClick: 1,
          avgClicksPerUser: {
            $divide: ['$totalClicks', { $size: '$uniqueUsers' }]
          }
        }
      },
      { $sort: { totalClicks: -1 } },
      { $limit: limit }
    ]);
  } catch (error) {
    logger.error('Error getting top campaigns:', error);
    throw error;
  }
};

/**
 * Static method to get source performance breakdown
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Source performance stats
 */
utmClickSchema.statics.getSourceBreakdown = async function(startDate, endDate) {
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
          totalClicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          campaigns: { $addToSet: '$campaign' }
        }
      },
      {
        $project: {
          source: '$_id',
          totalClicks: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          campaignCount: { $size: '$campaigns' },
          avgClicksPerUser: {
            $divide: ['$totalClicks', { $size: '$uniqueUsers' }]
          }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);
  } catch (error) {
    logger.error('Error getting source breakdown:', error);
    throw error;
  }
};

/**
 * Static method to get daily click trends
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Daily click trends
 */
utmClickSchema.statics.getDailyTrends = async function(startDate, endDate) {
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
          totalClicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          campaigns: { $addToSet: '$campaign' }
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
          totalClicks: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          campaignCount: { $size: '$campaigns' }
        }
      },
      { $sort: { date: 1 } }
    ]);
  } catch (error) {
    logger.error('Error getting daily trends:', error);
    throw error;
  }
};

/**
 * Instance method to enrich click with additional metadata
 * @param {Object} additionalData - Additional metadata to add
 * @returns {Promise<UTMClick>} Updated click document
 */
utmClickSchema.methods.enrichMetadata = async function(additionalData) {
  try {
    this.metadata = { ...this.metadata.toObject(), ...additionalData };
    return await this.save();
  } catch (error) {
    logger.error('Error enriching UTM click metadata:', error);
    throw error;
  }
};

/**
 * Pre-save hook to validate and normalize data
 */
utmClickSchema.pre('save', function(next) {
  // Normalize campaign name
  if (this.campaign) {
    this.campaign = this.campaign.toLowerCase().replace(/\s+/g, '_');
  }

  // Set default content if empty
  if (!this.content && this.campaign) {
    this.content = this.campaign;
  }

  next();
});

/**
 * Post-save hook for logging and analytics
 */
utmClickSchema.post('save', function(doc) {
  logger.info('📊 UTM click tracked:', {
    userId: doc.userId,
    campaign: doc.campaign,
    source: doc.source,
    medium: doc.medium,
    timestamp: doc.timestamp
  });
});

/**
 * Virtual for calculating time since click
 */
utmClickSchema.virtual('timeSinceClick').get(function() {
  return Date.now() - this.timestamp.getTime();
});

/**
 * Virtual for generating tracking URL
 */
utmClickSchema.virtual('trackingUrl').get(function() {
  const baseUrl = process.env.TRACKING_BASE_URL || 'https://anna-busel.com';
  const params = new URLSearchParams({
    utm_source: this.source,
    utm_medium: this.medium,
    utm_campaign: this.campaign,
    utm_content: this.content,
    user_id: this.userId
  });
  
  return `${baseUrl}?${params.toString()}`;
});

// Ensure virtuals are included in JSON output
utmClickSchema.set('toJSON', { virtuals: true });
utmClickSchema.set('toObject', { virtuals: true });

/**
 * Create and export the UTMClick model
 */
const UTMClick = mongoose.model('UTMClick', utmClickSchema);

module.exports = UTMClick;