/**
 * @fileoverview Unified ISO 8601 week calculations with business timezone support
 * @description Provides business timezone aware ISO week calculations using configurable offset minutes.
 * Used everywhere instead of duplicated logic in quote model & WeeklyReportService.
 * @author Reader Bot Team
 */

/**
 * Business timezone offset in minutes (default: 180 for Europe/Moscow = UTC+3)
 * Can be overridden via BUSINESS_TZ_OFFSET_MIN environment variable
 */
const BUSINESS_TZ_OFFSET_MIN = parseInt(process.env.BUSINESS_TZ_OFFSET_MIN) || 180;

/**
 * Get current business time with timezone offset applied
 * @returns {Date} Current date/time adjusted for business timezone
 */
function getBusinessNow() {
  const now = new Date();
  // Apply business timezone offset
  const businessTime = new Date(now.getTime() + (BUSINESS_TZ_OFFSET_MIN * 60 * 1000));
  return businessTime;
}

/**
 * Get ISO week information for a given date in business timezone
 * @param {Date} [date] - Date to calculate for (defaults to business now)
 * @returns {{isoWeek: number, isoYear: number, businessDate: Date}}
 */
function getISOWeekInfo(date = null) {
  const businessDate = date || getBusinessNow();
  
  // Convert to UTC for ISO week calculation
  const d = new Date(Date.UTC(
    businessDate.getFullYear(), 
    businessDate.getMonth(), 
    businessDate.getDate()
  ));
  
  // ISO 8601 week calculation
  const dayNum = d.getUTCDay() || 7; // Monday = 1, Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday of the same week
  
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const isoYear = d.getUTCFullYear();
  
  return {
    isoWeek,
    isoYear,
    businessDate
  };
}

/**
 * Get the date range for a specific ISO week and year
 * @param {number} isoWeek - ISO week number (1-53)
 * @param {number} isoYear - ISO year
 * @returns {{start: Date, end: Date, isoWeek: number, isoYear: number}}
 */
function getISOWeekRange(isoWeek, isoYear) {
  // Find January 4th of the given year (always in week 1)
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayOfWeek = jan4.getUTCDay() || 7; // Monday = 1, Sunday = 7
  
  // Find Monday of week 1
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - jan4DayOfWeek + 1);
  
  // Calculate Monday of the target week
  const mondayOfTargetWeek = new Date(mondayOfWeek1);
  mondayOfTargetWeek.setUTCDate(mondayOfWeek1.getUTCDate() + (isoWeek - 1) * 7);
  
  // Calculate Sunday of the target week  
  const sundayOfTargetWeek = new Date(mondayOfTargetWeek);
  sundayOfTargetWeek.setUTCDate(mondayOfTargetWeek.getUTCDate() + 6);
  sundayOfTargetWeek.setUTCHours(23, 59, 59, 999);
  
  // Convert back to business timezone
  const start = new Date(mondayOfTargetWeek.getTime() - (BUSINESS_TZ_OFFSET_MIN * 60 * 1000));
  const end = new Date(sundayOfTargetWeek.getTime() - (BUSINESS_TZ_OFFSET_MIN * 60 * 1000));
  
  start.setHours(0, 0, 0, 0);
  
  return {
    start,
    end,
    isoWeek,
    isoYear
  };
}

/**
 * Get previous complete ISO week info (for weekly reports)
 * @returns {{start: Date, end: Date, isoWeek: number, isoYear: number}}
 */
function getPreviousCompleteISOWeek() {
  const businessNow = getBusinessNow();
  const currentWeekInfo = getISOWeekInfo(businessNow);
  
  let prevWeek = currentWeekInfo.isoWeek - 1;
  let prevYear = currentWeekInfo.isoYear;
  
  // Handle year boundary
  if (prevWeek < 1) {
    prevYear = currentWeekInfo.isoYear - 1;
    prevWeek = weeksInISOYear(prevYear);
  }
  
  return getISOWeekRange(prevWeek, prevYear);
}

/**
 * Calculate number of weeks in an ISO year
 * @param {number} isoYear - ISO year
 * @returns {number} Number of weeks (52 or 53)
 */
function weeksInISOYear(isoYear) {
  // ISO year has 53 weeks if January 1st or December 31st is a Thursday
  const jan1 = new Date(isoYear, 0, 1);
  const dec31 = new Date(isoYear, 11, 31);
  
  const jan1Day = jan1.getDay();
  const dec31Day = dec31.getDay();
  
  return (jan1Day === 4 || dec31Day === 4) ? 53 : 52;
}

/**
 * Convert date to business timezone adjusted date for ISO week calculation
 * @param {Date} date - Input date
 * @returns {Date} Date adjusted for business timezone
 */
function toBusinessTimezone(date) {
  return new Date(date.getTime() + (BUSINESS_TZ_OFFSET_MIN * 60 * 1000));
}

/**
 * Get ISO week key for caching (YYYY-WNN format)
 * @param {Date} [date] - Date to get key for (defaults to business now)
 * @returns {string} ISO week key in format "2024-W01"
 */
function getISOWeekKey(date = null) {
  const weekInfo = getISOWeekInfo(date);
  return `${weekInfo.isoYear}-W${String(weekInfo.isoWeek).padStart(2, '0')}`;
}

/**
 * Format ISO week label for display
 * @param {number} isoWeek - ISO week number
 * @param {number} isoYear - ISO year
 * @returns {string} Formatted label like "1-7 января 2024"
 */
function formatISOWeekLabel(isoWeek, isoYear) {
  const range = getISOWeekRange(isoWeek, isoYear);
  
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  
  const startDay = range.start.getDate();
  const endDay = range.end.getDate();
  const startMonth = months[range.start.getMonth()];
  const endMonth = months[range.end.getMonth()];
  const startYear = range.start.getFullYear();
  const endYear = range.end.getFullYear();
  
  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay}-${endDay} ${startMonth} ${startYear}`;
  } else if (startYear === endYear) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${startYear}`;
  } else {
    return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
  }
}

module.exports = {
  getBusinessNow,
  getISOWeekInfo,
  getISOWeekRange,
  getPreviousCompleteISOWeek,
  weeksInISOYear,
  toBusinessTimezone,
  getISOWeekKey,
  formatISOWeekLabel,
  BUSINESS_TZ_OFFSET_MIN
};