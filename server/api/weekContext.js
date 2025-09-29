/**
 * @fileoverview Week Context API - provides current/previous week info and report status
 * @description Returns context object with current, previous week info, and last report details
 * @author Reader Bot Team
 */

const express = require('express');
const router = express.Router();
const WeeklyReport = require('../models/weeklyReport');
const { 
  getBusinessNow, 
  getISOWeekInfo, 
  getPreviousCompleteISOWeek,
  getISOWeekRange,
  formatISOWeekLabel 
} = require('../utils/isoWeek');

/**
 * GET /api/reader/week-context
 * Returns week context information for frontend
 * 
 * Query params:
 * - userId (required): User ID to check for reports
 * 
 * Response:
 * {
 *   success: true,
 *   current: {
 *     week: number,
 *     year: number,
 *     start: Date,
 *     end: Date,
 *     label: string
 *   },
 *   previous: {
 *     week: number,
 *     year: number,
 *     start: Date,
 *     end: Date,
 *     label: string,
 *     hasReport: boolean
 *   },
 *   lastReport: {
 *     id: string,
 *     week: number,
 *     year: number,
 *     sentAt: Date
 *   } | null,
 *   serverNow: Date
 * }
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId parameter is required'
      });
    }
    
    const businessNow = getBusinessNow();
    const currentWeekInfo = getISOWeekInfo(businessNow);
    const previousWeekInfo = getPreviousCompleteISOWeek();
    
    // Get current week range
    const currentWeekRange = getISOWeekRange(currentWeekInfo.isoWeek, currentWeekInfo.isoYear);
    
    // Check if previous week has a report
    const previousWeekReport = await WeeklyReport.findOne({
      userId: userId,
      weekNumber: previousWeekInfo.isoWeek,
      year: previousWeekInfo.isoYear
    });
    
    // Get the most recent report for this user
    const lastReport = await WeeklyReport.findOne({
      userId: userId
    }).sort({ sentAt: -1, createdAt: -1 });
    
    const context = {
      success: true,
      current: {
        week: currentWeekInfo.isoWeek,
        year: currentWeekInfo.isoYear,
        start: currentWeekRange.start,
        end: currentWeekRange.end,
        label: formatISOWeekLabel(currentWeekInfo.isoWeek, currentWeekInfo.isoYear)
      },
      previous: {
        week: previousWeekInfo.isoWeek,
        year: previousWeekInfo.isoYear,
        start: previousWeekInfo.start,
        end: previousWeekInfo.end,
        label: formatISOWeekLabel(previousWeekInfo.isoWeek, previousWeekInfo.isoYear),
        hasReport: !!previousWeekReport
      },
      lastReport: lastReport ? {
        id: lastReport._id,
        week: lastReport.weekNumber,
        year: lastReport.year,
        sentAt: lastReport.sentAt
      } : null,
      serverNow: businessNow
    };
    
    res.json(context);
    
  } catch (error) {
    console.error('Error in week-context API:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/reader/week-context/status
 * Quick status check for week context without detailed data
 */
router.get('/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId parameter is required'
      });
    }
    
    const businessNow = getBusinessNow();
    const currentWeekInfo = getISOWeekInfo(businessNow);
    const previousWeekInfo = getPreviousCompleteISOWeek();
    
    // Quick check for previous week report
    const hasReportForPreviousWeek = await WeeklyReport.exists({
      userId: userId,
      weekNumber: previousWeekInfo.isoWeek,
      year: previousWeekInfo.isoYear
    });
    
    res.json({
      success: true,
      currentWeek: currentWeekInfo.isoWeek,
      currentYear: currentWeekInfo.isoYear,
      previousWeek: previousWeekInfo.isoWeek,
      previousYear: previousWeekInfo.isoYear,
      hasPreviousWeekReport: !!hasReportForPreviousWeek,
      serverNow: businessNow
    });
    
  } catch (error) {
    console.error('Error in week-context status API:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;