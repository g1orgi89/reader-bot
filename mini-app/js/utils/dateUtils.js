/**
 * 📅 Утилиты для работы с датами - для еженедельных отчетов
 * @author g1orgi89
 */

/**
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