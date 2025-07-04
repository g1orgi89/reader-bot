/**
 * Analytics API routes for Reader Bot
 * @file server/api/analytics.js
 */

const express = require('express');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { createErrorResponse } = require('../constants/errorCodes');

const router = express.Router();

/**
 * @typedef {Object} DashboardStats
 * @property {Object} overview - Overview statistics
 * @property {Array} sourceStats - Traffic source statistics
 * @property {Array} utmStats - UTM campaign statistics
 * @property {string} period - Time period for stats
 */

/**
 * @typedef {Object} RetentionData
 * @property {string} cohort - Cohort identifier (YYYY-MM)
 * @property {number} size - Cohort size
 * @property {number} week1 - Week 1 retention %
 * @property {number} week2 - Week 2 retention %
 * @property {number} week3 - Week 3 retention %
 * @property {number} week4 - Week 4 retention %
 */

/**
 * Get start date based on period string
 * @param {string} dateRange - Date range (1d, 7d, 30d, 90d)
 * @returns {Date} Start date
 */
function getStartDate(dateRange) {
  const now = new Date();
  switch (dateRange) {
    case '1d': return new Date(now.setDate(now.getDate() - 1));
    case '7d': return new Date(now.setDate(now.getDate() - 7));
    case '30d': return new Date(now.setDate(now.getDate() - 30));
    case '90d': return new Date(now.setDate(now.getDate() - 90));
    default: return new Date(now.setDate(now.getDate() - 7));
  }
}

/**
 * Main dashboard statistics endpoint
 * GET /api/analytics/dashboard
 */
router.get('/dashboard', requireAdminAuth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const startDate = getStartDate(period);
    
    logger.info(`📊 Admin fetching dashboard stats for period: ${period}`, { 
      admin: req.admin?.username,
      startDate: startDate.toISOString()
    });

    // Import models dynamically to avoid circular dependencies
    const UserProfile = require('../models/userProfile');
    const Quote = require('../models/quote');
    const UTMClick = require('../models/utmClick');
    const PromoCodeUsage = require('../models/promoCodeUsage');

    // Parallel execution of all stats queries
    const [
      totalUsers,
      newUsers,
      totalQuotes,
      activeUsers,
      sourceStats,
      utmStats,
      promoUsage
    ] = await Promise.all([
      // Total registered users
      UserProfile.countDocuments({ isOnboardingComplete: true }),
      
      // New users in period
      UserProfile.countDocuments({
        isOnboardingComplete: true,
        registeredAt: { $gte: startDate }
      }),
      
      // Total quotes in period
      Quote.countDocuments({ createdAt: { $gte: startDate } }),
      
      // Active users (who sent quotes in period)
      Quote.distinct('userId', { createdAt: { $gte: startDate } }),
      
      // Source statistics
      UserProfile.aggregate([
        { $match: { registeredAt: { $gte: startDate } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // UTM statistics (if UTMClick model exists)
      UTMClick.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { 
          $group: { 
            _id: '$campaign', 
            clicks: { $sum: 1 }, 
            users: { $addToSet: '$userId' } 
          } 
        },
        { 
          $project: { 
            campaign: '$_id', 
            clicks: 1, 
            uniqueUsers: { $size: '$users' } 
          } 
        },
        { $sort: { clicks: -1 } }
      ]).catch(() => []), // Handle if UTMClick model doesn't exist
      
      // Promo code usage (if PromoCodeUsage model exists)
      PromoCodeUsage.countDocuments({
        timestamp: { $gte: startDate }
      }).catch(() => 0) // Handle if PromoCodeUsage model doesn't exist
    ]);

    // Calculate average quotes per user
    const avgQuotesPerUser = totalUsers > 0 ? Math.round((totalQuotes / totalUsers) * 10) / 10 : 0;

    const dashboardStats = {
      overview: {
        totalUsers,
        newUsers,
        totalQuotes,
        avgQuotesPerUser,
        activeUsers: activeUsers.length,
        promoUsage
      },
      sourceStats,
      utmStats,
      period
    };

    logger.info(`✅ Dashboard stats retrieved: ${totalUsers} users, ${totalQuotes} quotes, ${activeUsers.length} active users`);

    res.json({
      success: true,
      data: dashboardStats
    });

  } catch (error) {
    logger.error('❌ Error fetching dashboard stats:', {
      error: error.message,
      stack: error.stack,
      period: req.query.period
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch dashboard statistics');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * User retention analysis endpoint
 * GET /api/analytics/retention
 */
router.get('/retention', requireAdminAuth, async (req, res) => {
  try {
    logger.info('📈 Admin fetching retention data', { admin: req.admin?.username });

    const UserProfile = require('../models/userProfile');
    const Quote = require('../models/quote');

    // Get cohorts (users grouped by registration month)
    const cohorts = await UserProfile.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$registeredAt' },
            month: { $month: '$registeredAt' }
          },
          users: { $push: '$userId' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const retentionData = [];

    for (const cohort of cohorts) {
      const cohortUsers = cohort.users;
      const cohortDate = new Date(cohort._id.year, cohort._id.month - 1, 1);
      
      const retention = {
        cohort: `${cohort._id.year}-${cohort._id.month.toString().padStart(2, '0')}`,
        size: cohortUsers.length,
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0
      };

      // Calculate retention for each week
      for (let week = 1; week <= 4; week++) {
        const weekStart = new Date(cohortDate);
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const activeInWeek = await Quote.distinct('userId', {
          userId: { $in: cohortUsers },
          createdAt: { $gte: weekStart, $lt: weekEnd }
        });

        retention[`week${week}`] = Math.round((activeInWeek.length / cohortUsers.length) * 100);
      }

      retentionData.push(retention);
    }

    logger.info(`✅ Retention data retrieved for ${retentionData.length} cohorts`);

    res.json({
      success: true,
      data: retentionData
    });

  } catch (error) {
    logger.error('❌ Error fetching retention data:', {
      error: error.message,
      stack: error.stack
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch retention data');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * Top content (quotes, authors, categories) endpoint
 * GET /api/analytics/top-content
 */
router.get('/top-content', requireAdminAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const startDate = getStartDate(period);

    logger.info(`📚 Admin fetching top content for period: ${period}`, { 
      admin: req.admin?.username 
    });

    const Quote = require('../models/quote');

    // Parallel execution of aggregation queries
    const [topAuthors, topCategories, popularQuotes] = await Promise.all([
      // Top authors
      Quote.aggregate([
        { $match: { createdAt: { $gte: startDate }, author: { $ne: null, $ne: '' } } },
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Top categories
      Quote.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Most popular quotes (by text)
      Quote.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$text', author: { $first: '$author' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    const topContent = {
      topAuthors,
      topCategories,
      popularQuotes
    };

    logger.info(`✅ Top content retrieved: ${topAuthors.length} authors, ${topCategories.length} categories, ${popularQuotes.length} popular quotes`);

    res.json({
      success: true,
      data: topContent
    });

  } catch (error) {
    logger.error('❌ Error fetching top content:', {
      error: error.message,
      stack: error.stack,
      period: req.query.period
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch top content');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * Track UTM click endpoint
 * POST /api/analytics/track-utm
 */
router.post('/track-utm', async (req, res) => {
  try {
    const { utm_source, utm_medium, utm_campaign, utm_content, user_id } = req.body;

    if (!utm_source || !utm_campaign || !user_id) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'utm_source, utm_campaign, and user_id are required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Try to import UTMClick model (may not exist yet)
    try {
      const UTMClick = require('../models/utmClick');
      
      const utmClick = new UTMClick({
        userId: user_id,
        source: utm_source,
        medium: utm_medium,
        campaign: utm_campaign,
        content: utm_content,
        timestamp: new Date(),
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      await utmClick.save();

      logger.info('📊 UTM click tracked:', {
        userId: user_id,
        campaign: utm_campaign,
        source: utm_source
      });

    } catch (modelError) {
      // If UTMClick model doesn't exist, just log the tracking attempt
      logger.info('📊 UTM click tracked (model not available):', {
        userId: user_id,
        campaign: utm_campaign,
        source: utm_source,
        note: 'UTMClick model not found, event logged only'
      });
    }

    res.json({ success: true, message: 'UTM click tracked' });

  } catch (error) {
    logger.error('❌ Error tracking UTM click:', {
      error: error.message,
      body: req.body
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR', 'Failed to track UTM click');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * Track promo code usage endpoint
 * POST /api/analytics/track-promo
 */
router.post('/track-promo', async (req, res) => {
  try {
    const { promo_code, user_id, order_value } = req.body;

    if (!promo_code || !user_id) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'promo_code and user_id are required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Try to import PromoCodeUsage model (may not exist yet)
    try {
      const PromoCodeUsage = require('../models/promoCodeUsage');
      
      const promoUsage = new PromoCodeUsage({
        promoCode: promo_code,
        userId: user_id,
        orderValue: order_value || 0,
        discount: getDiscountForPromoCode(promo_code),
        timestamp: new Date(),
        source: 'reader_bot'
      });

      await promoUsage.save();

      logger.info('🎁 Promo code usage tracked:', {
        userId: user_id,
        promoCode: promo_code,
        orderValue: order_value
      });

    } catch (modelError) {
      // If PromoCodeUsage model doesn't exist, just log the tracking attempt
      logger.info('🎁 Promo code usage tracked (model not available):', {
        userId: user_id,
        promoCode: promo_code,
        orderValue: order_value,
        note: 'PromoCodeUsage model not found, event logged only'
      });
    }

    res.json({ success: true, message: 'Promo code usage tracked' });

  } catch (error) {
    logger.error('❌ Error tracking promo code usage:', {
      error: error.message,
      body: req.body
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR', 'Failed to track promo code usage');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * User activity timeline endpoint
 * GET /api/analytics/user-activity
 */
router.get('/user-activity', requireAdminAuth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const startDate = getStartDate(period);

    logger.info(`📅 Admin fetching user activity for period: ${period}`, { 
      admin: req.admin?.username 
    });

    const Quote = require('../models/quote');
    const UserProfile = require('../models/userProfile');

    // Get daily activity data
    const dailyActivity = await Quote.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          quotes: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
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
          quotes: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get hourly activity pattern
    const hourlyActivity = await Quote.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const activityData = {
      daily: dailyActivity,
      hourly: hourlyActivity
    };

    logger.info(`✅ User activity retrieved: ${dailyActivity.length} days, ${hourlyActivity.length} hours`);

    res.json({
      success: true,
      data: activityData
    });

  } catch (error) {
    logger.error('❌ Error fetching user activity:', {
      error: error.message,
      stack: error.stack,
      period: req.query.period
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user activity');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * Get discount percentage for promo code
 * @param {string} promoCode - Promo code
 * @returns {number} Discount percentage
 */
function getDiscountForPromoCode(promoCode) {
  // Common Reader bot promo codes
  const discountMap = {
    'READER20': 20,
    'WISDOM20': 20,
    'QUOTES20': 20,
    'BOOKS20': 20,
    'MONTH25': 25,
    'READER15': 15
  };

  return discountMap[promoCode] || 0;
}

/**
 * Export data endpoint
 * GET /api/analytics/export
 */
router.get('/export', requireAdminAuth, async (req, res) => {
  try {
    const { type = 'dashboard', period = '30d' } = req.query;
    
    logger.info(`📤 Admin exporting ${type} data for period: ${period}`, { 
      admin: req.admin?.username 
    });

    let exportData = {};

    switch (type) {
      case 'dashboard':
        // Get dashboard data for export
        const dashboardResponse = await fetch(`${req.protocol}://${req.get('host')}/api/analytics/dashboard?period=${period}`, {
          headers: { Authorization: req.headers.authorization }
        });
        exportData = await dashboardResponse.json();
        break;

      case 'retention':
        // Get retention data for export
        const retentionResponse = await fetch(`${req.protocol}://${req.get('host')}/api/analytics/retention`, {
          headers: { Authorization: req.headers.authorization }
        });
        exportData = await retentionResponse.json();
        break;

      case 'top-content':
        // Get top content data for export
        const contentResponse = await fetch(`${req.protocol}://${req.get('host')}/api/analytics/top-content?period=${period}`, {
          headers: { Authorization: req.headers.authorization }
        });
        exportData = await contentResponse.json();
        break;

      default:
        const errorResponse = createErrorResponse('INVALID_REQUEST', 'Invalid export type');
        return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Add export metadata
    const exportResponse = {
      exportType: type,
      period,
      generatedAt: new Date().toISOString(),
      generatedBy: req.admin?.username || 'admin',
      data: exportData.data || exportData
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="reader-analytics-${type}-${period}-${new Date().toISOString().split('T')[0]}.json"`);
    
    res.json(exportResponse);

    logger.info(`✅ Analytics data exported: ${type}`, { admin: req.admin?.username });

  } catch (error) {
    logger.error('❌ Error exporting analytics data:', {
      error: error.message,
      type: req.query.type,
      period: req.query.period
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR', 'Failed to export analytics data');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

module.exports = router;