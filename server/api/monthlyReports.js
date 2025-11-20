/**
 * @fileoverview API endpoints for monthly reports and feedback for Reader project
 * @author g1orgi89
 * @updated 2025-01-19 - Added view endpoint, renamed trigger to generate, improved service integration
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Import services and models
const MonthlyReportService = require('../services/monthlyReportService');
const { MonthlyReport, WeeklyReport, UserProfile, Quote } = require('../models');

// Initialize services
const monthlyReportService = new MonthlyReportService();

/**
 * @route GET /api/monthly-reports
 * @description Get monthly reports with filters
 * @access Admin
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      month,
      year,
      userId,
      hasRating,
      sortBy = 'sentAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (userId) filter.userId = userId;
    if (hasRating === 'true') filter['feedback.rating'] = { $exists: true };
    if (hasRating === 'false') filter['feedback.rating'] = { $exists: false };

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      MonthlyReport.find(filter)
        .populate('userId', 'name email telegramUsername')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      MonthlyReport.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error(`Error fetching monthly reports: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly reports'
    });
  }
});

/**
 * @route GET /api/monthly-reports/stats
 * @description Get monthly reports statistics
 * @access Admin
 */
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.sentAt = {};
      if (startDate) dateFilter.sentAt.$gte = new Date(startDate);
      if (endDate) dateFilter.sentAt.$lte = new Date(endDate);
    }

    const [totalReports, avgRating, feedbackStats, themeStats] = await Promise.all([
      MonthlyReport.countDocuments(dateFilter),
      
      MonthlyReport.aggregate([
        { $match: { ...dateFilter, 'feedback.rating': { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$feedback.rating' } } }
      ]),
      
      MonthlyReport.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$feedback.rating',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      MonthlyReport.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$additionalSurvey.mainTheme',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    const responseRate = totalReports > 0 ? 
      feedbackStats.reduce((sum, item) => sum + item.count, 0) / totalReports : 0;

    res.json({
      success: true,
      data: {
        totalReports,
        averageRating: avgRating.length > 0 ? avgRating[0].avgRating : null,
        responseRate: Math.round(responseRate * 100),
        ratingDistribution: feedbackStats,
        popularThemes: themeStats,
        period: {
          startDate: startDate || 'all time',
          endDate: endDate || 'present'
        }
      }
    });

  } catch (error) {
    logger.error(`Error fetching monthly reports stats: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * @route GET /api/monthly-reports/:id
 * @description Get specific monthly report
 * @access User/Admin
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const report = await MonthlyReport.findById(id)
      .populate('userId', 'name email telegramUsername registeredAt');

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Monthly report not found'
      });
    }

    // Get related quotes for context
    const relatedQuotes = await Quote.find({
      userId: report.userId._id,
      monthNumber: report.month,
      yearNumber: report.year
    }).sort({ createdAt: 1 }).limit(10);

    res.json({
      success: true,
      data: {
        report,
        relatedQuotes
      }
    });

  } catch (error) {
    logger.error(`Error fetching monthly report: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly report'
    });
  }
});

/**
 * @route POST /api/monthly-reports/:reportId/view
 * @description Mark monthly report as viewed
 * @access User
 */
router.post('/:reportId/view', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const report = await MonthlyReport.findById(reportId);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Monthly report not found'
      });
    }
    
    // Update viewedAt timestamp and mark as read
    report.viewedAt = new Date();
    report.isRead = true;
    await report.save();
    
    logger.info(`Monthly report ${reportId} marked as viewed`);
    
    res.json({
      success: true,
      message: 'Report marked as viewed',
      data: {
        reportId,
        viewedAt: report.viewedAt,
        isRead: report.isRead
      }
    });
    
  } catch (error) {
    logger.error(`Error marking monthly report as viewed: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark report as viewed'
    });
  }
});

/**
 * @route POST /api/monthly-reports/generate
 * @description Generate monthly report on-demand
 * @access Admin
 */
router.post('/generate', async (req, res) => {
  try {
    const { userId, month, year } = req.body;

    if (userId) {
      // Generate for specific user
      // Use updated MonthlyReportService.generateReport method with parameters
      let report;
      if (month && year) {
        // If month and year provided, use them
        report = await monthlyReportService.generateReport(userId, month, year);
      } else {
        // Otherwise generate for previous month
        const now = new Date();
        const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        report = await monthlyReportService.generateReport(userId, lastMonth, lastYear);
      }
      
      res.json({
        success: true,
        message: 'Monthly report generated for specific user',
        data: { report }
      });
    } else {
      // Generate for all eligible users
      const stats = await monthlyReportService.generateMonthlyReportsForAllUsers();
      
      res.json({
        success: true,
        message: 'Monthly reports generation triggered',
        data: stats
      });
    }

  } catch (error) {
    logger.error(`Error generating monthly reports: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate monthly reports',
      details: error.message
    });
  }
});

/**
 * @route GET /api/monthly-reports/user/:userId
 * @description Get monthly reports for specific user
 * @access User/Admin
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 12 } = req.query;

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const reports = await MonthlyReport.find({ userId })
      .sort({ year: -1, month: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        user: {
          name: user.name,
          email: user.email,
          telegramUsername: user.telegramUsername,
          registeredAt: user.registeredAt
        },
        reports
      }
    });

  } catch (error) {
    logger.error(`Error fetching user monthly reports: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user reports'
    });
  }
});

/**
 * @route GET /api/feedback/stats
 * @description Get feedback statistics for both weekly and monthly reports
 * @access Admin
 */
router.get('/feedback/stats', async (req, res) => {
  try {
    const { startDate, endDate, period = '30d' } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        sentAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default to last 30 days
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      dateFilter.sentAt = { $gte: since };
    }

    const [weeklyFeedback, monthlyFeedback, detailedComments] = await Promise.all([
      WeeklyReport.aggregate([
        { $match: { ...dateFilter, 'feedback.rating': { $exists: true } } },
        {
          $group: {
            _id: '$feedback.rating',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      MonthlyReport.aggregate([
        { $match: { ...dateFilter, 'feedback.rating': { $exists: true } } },
        {
          $group: {
            _id: '$feedback.rating',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      Promise.all([
        WeeklyReport.find({
          ...dateFilter,
          'feedback.comment': { $exists: true, $ne: '' }
        }).populate('userId', 'name telegramUsername').limit(10),
        
        MonthlyReport.find({
          ...dateFilter,
          'feedback.comment': { $exists: true, $ne: '' }
        }).populate('userId', 'name telegramUsername').limit(10)
      ])
    ]);

    // Calculate overall satisfaction
    const calculateSatisfaction = (feedback) => {
      const total = feedback.reduce((sum, item) => sum + item.count, 0);
      const weighted = feedback.reduce((sum, item) => sum + (item._id * item.count), 0);
      return total > 0 ? weighted / total : 0;
    };

    res.json({
      success: true,
      data: {
        weekly: {
          ratingDistribution: weeklyFeedback,
          averageRating: calculateSatisfaction(weeklyFeedback),
          totalResponses: weeklyFeedback.reduce((sum, item) => sum + item.count, 0)
        },
        monthly: {
          ratingDistribution: monthlyFeedback,
          averageRating: calculateSatisfaction(monthlyFeedback),
          totalResponses: monthlyFeedback.reduce((sum, item) => sum + item.count, 0)
        },
        detailedComments: {
          weekly: detailedComments[0],
          monthly: detailedComments[1]
        },
        period: {
          startDate: dateFilter.sentAt?.$gte || 'N/A',
          endDate: dateFilter.sentAt?.$lte || 'present'
        }
      }
    });

  } catch (error) {
    logger.error(`Error fetching feedback stats: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback statistics'
    });
  }
});

/**
 * @route GET /api/feedback/comments
 * @description Get detailed feedback comments
 * @access Admin
 */
router.get('/feedback/comments', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type = 'all', // weekly, monthly, all
      ratingFilter // filter by rating
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {
      'feedback.comment': { $exists: true, $ne: '' }
    };

    if (ratingFilter && !isNaN(ratingFilter)) {
      filter['feedback.rating'] = parseInt(ratingFilter);
    }

    let comments = [];
    let total = 0;

    if (type === 'all' || type === 'weekly') {
      const weeklyComments = await WeeklyReport.find(filter)
        .populate('userId', 'name telegramUsername email')
        .sort({ sentAt: -1 })
        .skip(type === 'weekly' ? skip : 0)
        .limit(type === 'weekly' ? parseInt(limit) : parseInt(limit / 2));
      
      comments.push(...weeklyComments.map(comment => ({ ...comment.toObject(), reportType: 'weekly' })));
    }

    if (type === 'all' || type === 'monthly') {
      const monthlyComments = await MonthlyReport.find(filter)
        .populate('userId', 'name telegramUsername email')
        .sort({ sentAt: -1 })
        .skip(type === 'monthly' ? skip : 0)
        .limit(type === 'monthly' ? parseInt(limit) : parseInt(limit / 2));
      
      comments.push(...monthlyComments.map(comment => ({ ...comment.toObject(), reportType: 'monthly' })));
    }

    if (type === 'all') {
      // Sort combined results by date
      comments.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
      comments = comments.slice(skip, skip + parseInt(limit));
    }

    // Get total count
    if (type === 'all') {
      const [weeklyTotal, monthlyTotal] = await Promise.all([
        WeeklyReport.countDocuments(filter),
        MonthlyReport.countDocuments(filter)
      ]);
      total = weeklyTotal + monthlyTotal;
    } else if (type === 'weekly') {
      total = await WeeklyReport.countDocuments(filter);
    } else {
      total = await MonthlyReport.countDocuments(filter);
    }

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error(`Error fetching feedback comments: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback comments'
    });
  }
});

/**
 * @route GET /api/analytics/themes
 * @description Get popular themes from monthly surveys
 * @access Admin
 */
router.get('/analytics/themes', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.sentAt = {};
      if (startDate) dateFilter.sentAt.$gte = new Date(startDate);
      if (endDate) dateFilter.sentAt.$lte = new Date(endDate);
    }

    const themeStats = await MonthlyReport.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$additionalSurvey.mainTheme',
          count: { $sum: 1 },
          avgRating: { $avg: '$feedback.rating' },
          users: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          theme: '$_id',
          count: 1,
          avgRating: { $round: ['$avgRating', 2] },
          uniqueUsers: { $size: '$users' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        themes: themeStats,
        totalResponses: themeStats.reduce((sum, theme) => sum + theme.count, 0)
      }
    });

  } catch (error) {
    logger.error(`Error fetching theme analytics: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theme analytics'
    });
  }
});

/**
 * @route DELETE /api/monthly-reports/:id
 * @description Delete monthly report (admin only)
 * @access Admin
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const report = await MonthlyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Monthly report not found'
      });
    }

    await MonthlyReport.findByIdAndDelete(id);

    logger.info(`Monthly report ${id} deleted by admin`);

    res.json({
      success: true,
      message: 'Monthly report deleted successfully'
    });

  } catch (error) {
    logger.error(`Error deleting monthly report: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete monthly report'
    });
  }
});

module.exports = router;