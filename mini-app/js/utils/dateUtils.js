/**
 * 📅 Утилиты для работы с датами - для еженедельных отчетов
 * @author g1orgi89
 */

/**
 * Business timezone offset in minutes (default: 180 for Europe/Moscow = UTC+3)
 * Can be overridden via BUSINESS_TZ_OFFSET_MIN environment variable
 */
const BUSINESS_TZ_OFFSET_MIN = 180; // Hardcoded for frontend

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
 * Get ISO week key for caching (YYYY-WNN format)
 * @param {Date} [date] - Date to get key for (defaults to business now)
 * @returns {string} ISO week key in format "2024-W01"
 */
function getIsoWeekKey(date = null) {
  const weekInfo = getISOWeekInfo(date);
  return `${weekInfo.isoYear}-W${String(weekInfo.isoWeek).padStart(2, '0')}`;
}

/**
 * Format ISO week label for display
 * @param {number} isoWeek - ISO week number
 * @param {number} isoYear - ISO year
 * @returns {string} Formatted label like "1-7 января 2024"
 */
function formatIsoWeekLabel(isoWeek, isoYear) {
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

// ====================================================================
// LEGACY FUNCTIONS - DEPRECATED FOR REPORTS (kept for compatibility)
// ====================================================================

/**
 * @deprecated Use getISOWeekInfo for reports. Keep for legacy compatibility only.
 * Получение номера недели внутри месяца
 * week = Math.ceil(dayOfMonth / 7)
 * @param {Date} date - Дата
 * @returns {number} Номер недели (1-5)
 */
function getWeekOfMonth(date = new Date()) {
    const dayOfMonth = date.getDate();
    return Math.ceil(dayOfMonth / 7);
}

/**
 * Получение названия месяца на русском
 * @param {Date} date - Дата
 * @returns {string} Название месяца
 */
function getMonthName(date = new Date()) {
    const months = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[date.getMonth()];
}

/**
 * @deprecated Use formatIsoWeekLabel for reports. Keep for legacy compatibility only.
 * Форматирование даты отчета в формате "Месяц, неделя X"
 * @param {Date} date - Дата
 * @returns {string} Отформатированная дата
 */
function formatReportDate(date = new Date()) {
    const monthName = getMonthName(date);
    const weekNumber = getWeekOfMonth(date);
    return `${monthName}, неделя ${weekNumber}`;
}

/**
 * @deprecated Use getIsoWeekKey for reports. Keep for legacy compatibility only.
 * Получение ключа недели для кэширования "year-month-week"
 * @param {Date} date - Дата
 * @returns {string} Ключ недели
 */
function getWeekKey(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    const week = getWeekOfMonth(date);
    return `${year}-${month}-${week}`;
}

/**
 * @deprecated Use getIsoWeekKey comparison for reports. Keep for legacy compatibility only.
 * Проверка, наступила ли новая неделя с последнего обновления
 * @param {string} lastWeekKey - Ключ последней недели
 * @param {Date} currentDate - Текущая дата
 * @returns {boolean} True если новая неделя
 */
function isNewWeek(lastWeekKey, currentDate = new Date()) {
    const currentWeekKey = getWeekKey(currentDate);
    return lastWeekKey !== currentWeekKey;
}

/**
 * Проверка, является ли дата сегодняшним днем
 * @param {Date|string} date - Дата для проверки
 * @returns {boolean} True если дата сегодняшняя
 */
function isToday(date) {
    const today = new Date();
    const checkDate = new Date(date);
    
    return today.getFullYear() === checkDate.getFullYear() &&
           today.getMonth() === checkDate.getMonth() &&
           today.getDate() === checkDate.getDate();
}

/**
 * Получение начала сегодняшнего дня
 * @returns {Date} Начало сегодняшнего дня (00:00:00)
 */
function getStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

/**
 * Нормализация текста для сравнения (убирает пробелы и приводит к нижнему регистру)
 * @param {string} text - Текст для нормализации
 * @returns {string} Нормализованный текст
 */
function normalizeText(text) {
    return text ? text.toLowerCase().replace(/\s+/g, ' ').trim() : '';
}

// Экспорт для browser и node
if (typeof window !== 'undefined') {
    window.DateUtils = {
        // NEW: ISO week functions for reports
        getBusinessNow,
        getISOWeekInfo,
        getISOWeekRange,
        getIsoWeekKey,
        formatIsoWeekLabel,
        
        // LEGACY: Keep for backward compatibility (marked deprecated for reports)
        getWeekOfMonth,
        getMonthName,
        formatReportDate,
        getWeekKey,
        isNewWeek,
        isToday,
        getStartOfToday,
        normalizeText
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // NEW: ISO week functions for reports
        getBusinessNow,
        getISOWeekInfo,
        getISOWeekRange,
        getIsoWeekKey,
        formatIsoWeekLabel,
        
        // LEGACY: Keep for backward compatibility
        getWeekOfMonth,
        getMonthName,
        formatReportDate,
        getWeekKey,
        isNewWeek,
        isToday,
        getStartOfToday,
        normalizeText
    };
}