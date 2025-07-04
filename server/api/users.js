/**
 * Users API routes for Reader Bot
 * @file server/api/users.js
 */

const express = require('express');
const router = express.Router();

// Middleware
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

// Models - импортируем из центрального файла
const models = require('../models');
const { UserProfile, Quote, WeeklyReport, MonthlyReport } = models;

/**
 * @typedef {Object} UserStats
 * @property {number} totalUsers - Total number of users
 * @property {number} newUsersToday - New users registered today
 * @property {number} activeUsers - Active users (with current streak > 0)
 * @property {number} totalQuotes - Total quotes in the system
 * @property {number} avgQuotesPerUser - Average quotes per user
 * @property {number} weeklyReports - Total weekly reports sent
 * @property {number} monthlyReports - Total monthly reports sent
 */

/**
 * Get users statistics
 * @route GET /api/users/stats
 * @access Private (Admin only)
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    logger.info('📊 Fetching user statistics...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      newUsersToday,
      activeUsers,
      totalQuotes,
      weeklyReports,
      monthlyReports
    ] = await Promise.all([
      UserProfile.countDocuments({ isOnboardingComplete: true }),
      UserProfile.countDocuments({ 
        isOnboardingComplete: true,
        registeredAt: { $gte: today }
      }),
      UserProfile.countDocuments({ 
        isOnboardingComplete: true,
        'statistics.currentStreak': { $gt: 0 }
      }),
      Quote.countDocuments(),
      WeeklyReport.countDocuments(),
      MonthlyReport.countDocuments()
    ]);

    const avgQuotesPerUser = totalUsers > 0 ? Math.round(totalQuotes / totalUsers * 10) / 10 : 0;

    /**
     * @type {UserStats}
     */
    const stats = {
      totalUsers,
      newUsersToday,
      activeUsers,
      totalQuotes,
      avgQuotesPerUser,
      weeklyReports,
      monthlyReports
    };

    logger.info('✅ User statistics fetched successfully', stats);
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('❌ Error fetching user statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics',
      details: error.message
    });
  }
});

/**
 * Get list of users with pagination
 * @route GET /api/users
 * @access Private (Admin only)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @query {string} search - Search term for name or email
 * @query {string} source - Filter by traffic source
 * @query {string} sortBy - Sort field (registeredAt, name, totalQuotes)
 * @query {string} sortOrder - Sort order (asc, desc)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      source = '',
      sortBy = 'registeredAt',
      sortOrder = 'desc'
    } = req.query;

    logger.info('📋 Fetching users list', { page, limit, search, source, sortBy, sortOrder });

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    const query = { isOnboardingComplete: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { telegramUsername: { $regex: search, $options: 'i' } }
      ];
    }

    if (source) {
      query.source = source;
    }

    // Build sort object
    const sortObj = {};
    const validSortFields = ['registeredAt', 'name', 'statistics.totalQuotes', 'email'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'registeredAt';
    sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries
    const [users, totalCount] = await Promise.all([
      UserProfile.find(query)
        .select('-testResults.question1_name -testResults.question2_lifestyle -testResults.question3_time') // Hide sensitive test data
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      UserProfile.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    logger.info(`✅ Fetched ${users.length} users (page ${pageNum}/${totalPages})`);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null
        }
      }
    });

  } catch (error) {
    logger.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      details: error.message
    });
  }
});

/**
 * Get detailed user information
 * @route GET /api/users/:userId
 * @access Private (Admin only)
 */
router.get('/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    logger.info(`📋 Fetching user details for: ${userId}`);

    // Get user profile
    const user = await UserProfile.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's quotes (last 10)
    const quotes = await Quote.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get user's reports
    const [weeklyReports, monthlyReports] = await Promise.all([
      WeeklyReport.find({ userId })
        .sort({ weekNumber: -1 })
        .limit(5)
        .lean(),
      MonthlyReport.find({ userId })
        .sort({ month: -1 })
        .limit(3)
        .lean()
    ]);

    // Calculate additional statistics
    const [totalQuotes, weeklyCount, monthlyCount] = await Promise.all([
      Quote.countDocuments({ userId }),
      WeeklyReport.countDocuments({ userId }),
      MonthlyReport.countDocuments({ userId })
    ]);

    const userDetails = {
      profile: user,
      statistics: {
        totalQuotes,
        weeklyReports: weeklyCount,
        monthlyReports: monthlyCount,
        daysSinceRegistration: Math.floor((Date.now() - user.registeredAt.getTime()) / (1000 * 60 * 60 * 24))
      },
      recentQuotes: quotes,
      recentReports: {
        weekly: weeklyReports,
        monthly: monthlyReports
      }
    };

    logger.info(`✅ User details fetched for: ${userId}`);
    res.json({
      success: true,
      data: userDetails
    });

  } catch (error) {
    logger.error(`❌ Error fetching user details for ${req.params.userId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details',
      details: error.message
    });
  }
});

/**
 * Search users by various criteria
 * @route GET /api/users/search
 * @access Private (Admin only)
 * @query {string} q - Search query
 * @query {string} type - Search type (name, email, telegram, quotes)
 */
router.get('/search', requireAdmin, async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    logger.info(`🔍 Searching users: "${q}" (type: ${type})`);

    let searchQuery = { isOnboardingComplete: true };

    switch (type) {
      case 'name':
        searchQuery.name = { $regex: q, $options: 'i' };
        break;
      case 'email':
        searchQuery.email = { $regex: q, $options: 'i' };
        break;
      case 'telegram':
        searchQuery.telegramUsername = { $regex: q, $options: 'i' };
        break;
      case 'quotes':
        // Search in quotes and get user IDs
        const quotesWithUsers = await Quote.find({
          $or: [
            { text: { $regex: q, $options: 'i' } },
            { author: { $regex: q, $options: 'i' } }
          ]
        }).distinct('userId');
        searchQuery.userId = { $in: quotesWithUsers };
        break;
      default: // 'all'
        searchQuery.$or = [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { telegramUsername: { $regex: q, $options: 'i' } }
        ];
    }

    const users = await UserProfile.find(searchQuery)
      .select('userId name email telegramUsername source registeredAt statistics')
      .sort({ registeredAt: -1 })
      .limit(50)
      .lean();

    logger.info(`✅ Found ${users.length} users matching search: "${q}"`);

    res.json({
      success: true,
      data: {
        users,
        query: q,
        type,
        resultsCount: users.length
      }
    });

  } catch (error) {
    logger.error(`❌ Error searching users with query "${req.query.q}":`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to search users',
      details: error.message
    });
  }
});

/**
 * Get traffic sources statistics
 * @route GET /api/users/sources
 * @access Private (Admin only)
 */
router.get('/sources', requireAdmin, async (req, res) => {
  try {
    logger.info('📊 Fetching traffic sources statistics...');

    const sources = await UserProfile.aggregate([
      { $match: { isOnboardingComplete: true } },
      { 
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          avgQuotes: { $avg: '$statistics.totalQuotes' },
          avgStreak: { $avg: '$statistics.currentStreak' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = sources.reduce((sum, source) => sum + source.count, 0);

    const sourcesWithPercentage = sources.map(source => ({
      source: source._id || 'Unknown',
      count: source.count,
      percentage: total > 0 ? Math.round((source.count / total) * 100) : 0,
      avgQuotes: Math.round(source.avgQuotes || 0),
      avgStreak: Math.round(source.avgStreak || 0)
    }));

    logger.info(`✅ Traffic sources statistics fetched (${sources.length} sources)`);

    res.json({
      success: true,
      data: {
        sources: sourcesWithPercentage,
        totalUsers: total
      }
    });

  } catch (error) {
    logger.error('❌ Error fetching traffic sources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch traffic sources',
      details: error.message
    });
  }
});

module.exports = router;
