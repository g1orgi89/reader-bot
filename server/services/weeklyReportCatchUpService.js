/**
 * @fileoverview Weekly Report Catch-Up Service
 * @description Generates missing weekly reports for past completed weeks
 * @author Reader Bot Team
 */

const Quote = require('../models/quote');
const WeeklyReport = require('../models/weeklyReport');
const WeeklyReportService = require('./weeklyReportService');
const { 
  getBusinessNow, 
  getISOWeekInfo, 
  getPreviousCompleteISOWeek,
  getISOWeekRange 
} = require('../utils/isoWeek');

/**
 * @class WeeklyReportCatchUpService
 * @description Service to generate missing weekly reports for past N completed weeks
 */
class WeeklyReportCatchUpService {
  constructor() {
    this.weeklyReportService = new WeeklyReportService();
    this.lookbackWeeks = parseInt(process.env.CATCHUP_LOOKBACK_WEEKS) || 8;
    this.logger = require('../utils/logger');
  }

  /**
   * Find missing weeks where quotes exist but no weekly report was generated
   * @returns {Promise<Array<{isoWeek: number, isoYear: number}>>}
   */
  async findMissingWeeks() {
    try {
      const businessNow = getBusinessNow();
      const currentWeekInfo = getISOWeekInfo(businessNow);
      
      const missingWeeks = [];
      
      // Check past N weeks
      for (let weekOffset = 1; weekOffset <= this.lookbackWeeks; weekOffset++) {
        let targetWeek = currentWeekInfo.isoWeek - weekOffset;
        let targetYear = currentWeekInfo.isoYear;
        
        // Handle year boundary
        if (targetWeek < 1) {
          targetYear = currentWeekInfo.isoYear - 1;
          const weeksInPrevYear = this.getWeeksInISOYear(targetYear);
          targetWeek = weeksInPrevYear + targetWeek;
        }
        
        // Check if week is fully completed (ended at least 1 day ago)
        const weekRange = getISOWeekRange(targetWeek, targetYear);
        const oneDayAfterWeekEnd = new Date(weekRange.end.getTime() + 24 * 60 * 60 * 1000);
        
        if (businessNow < oneDayAfterWeekEnd) {
          continue; // Week not fully completed yet
        }
        
        // Check if quotes exist for this week
        const quotesExist = await Quote.exists({
          weekNumber: targetWeek,
          yearNumber: targetYear
        });
        
        if (!quotesExist) {
          continue; // No quotes for this week
        }
        
        // Get distinct users who have quotes for this week
        const usersWithQuotes = await Quote.distinct('userId', {
          weekNumber: targetWeek,
          yearNumber: targetYear
        });
        
        if (usersWithQuotes.length === 0) {
          continue;
        }
        
        // Check which users are missing reports
        const existingReports = await WeeklyReport.find({
          weekNumber: targetWeek,
          year: targetYear
        }).distinct('userId');
        
        const usersNeedingReports = usersWithQuotes.filter(
          userId => !existingReports.includes(userId)
        );
        
        if (usersNeedingReports.length > 0) {
          missingWeeks.push({
            isoWeek: targetWeek,
            isoYear: targetYear,
            usersNeedingReports
          });
        }
      }
      
      return missingWeeks;
    } catch (error) {
      this.logger.error('Error finding missing weeks:', error);
      throw error;
    }
  }

  /**
   * Generate weekly report for a specific week and year
   * @param {number} isoWeek - ISO week number
   * @param {number} isoYear - ISO year
   * @param {Array<string>} userIds - User IDs needing reports
   * @returns {Promise<number>} Number of reports generated
   */
  async generateWeek(isoWeek, isoYear, userIds) {
    let generatedCount = 0;
    
    try {
      this.logger.info(`Generating reports for week ${isoWeek}/${isoYear} for ${userIds.length} users`);
      
      for (const userId of userIds) {
        try {
          // Check if report already exists (race condition protection)
          const existingReport = await WeeklyReport.findOne({
            userId,
            weekNumber: isoWeek,
            year: isoYear
          });
          
          if (existingReport) {
            this.logger.debug(`Report already exists for user ${userId}, week ${isoWeek}/${isoYear}`);
            continue;
          }
          
          // Get quotes for this user and week
          const quotes = await Quote.find({
            userId,
            weekNumber: isoWeek,
            yearNumber: isoYear
          }).sort({ createdAt: 1 });
          
          if (quotes.length === 0) {
            this.logger.debug(`No quotes found for user ${userId}, week ${isoWeek}/${isoYear}`);
            continue;
          }
          
          // Generate the weekly report
          const weekRange = getISOWeekRange(isoWeek, isoYear);
          await this.weeklyReportService.generateWeeklyReport(
            userId, 
            weekRange.start, 
            weekRange.end,
            {
              isoWeekNumber: isoWeek,
              isoYear: isoYear
            }
          );
          
          generatedCount++;
          this.logger.info(`Generated catch-up report for user ${userId}, week ${isoWeek}/${isoYear}`);
          
        } catch (userError) {
          this.logger.error(`Error generating report for user ${userId}, week ${isoWeek}/${isoYear}:`, userError);
          // Continue with other users
        }
      }
      
      return generatedCount;
    } catch (error) {
      this.logger.error(`Error generating week ${isoWeek}/${isoYear}:`, error);
      throw error;
    }
  }

  /**
   * Main catch-up process
   * @returns {Promise<{totalGenerated: number, weeksProcessed: number}>}
   */
  async run() {
    try {
      this.logger.info('Starting weekly report catch-up service...');
      
      const missingWeeks = await this.findMissingWeeks();
      
      if (missingWeeks.length === 0) {
        this.logger.info('No missing weekly reports found');
        return { totalGenerated: 0, weeksProcessed: 0 };
      }
      
      this.logger.info(`Found ${missingWeeks.length} weeks with missing reports`);
      
      let totalGenerated = 0;
      
      for (const week of missingWeeks) {
        try {
          const generated = await this.generateWeek(
            week.isoWeek, 
            week.isoYear, 
            week.usersNeedingReports
          );
          totalGenerated += generated;
          
          // Small delay to avoid overwhelming the system
          await this.delay(1000);
          
        } catch (weekError) {
          this.logger.error(`Error processing week ${week.isoWeek}/${week.isoYear}:`, weekError);
          // Continue with other weeks
        }
      }
      
      this.logger.info(`Catch-up completed: ${totalGenerated} reports generated across ${missingWeeks.length} weeks`);
      
      return {
        totalGenerated,
        weeksProcessed: missingWeeks.length
      };
      
    } catch (error) {
      this.logger.error('Error in catch-up service:', error);
      throw error;
    }
  }

  /**
   * Utility method to add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get number of weeks in ISO year (helper method)
   * @param {number} isoYear - ISO year
   * @returns {number} Number of weeks (52 or 53)
   */
  getWeeksInISOYear(isoYear) {
    const jan1 = new Date(isoYear, 0, 1);
    const dec31 = new Date(isoYear, 11, 31);
    
    const jan1Day = jan1.getDay();
    const dec31Day = dec31.getDay();
    
    return (jan1Day === 4 || dec31Day === 4) ? 53 : 52;
  }
}

module.exports = WeeklyReportCatchUpService;