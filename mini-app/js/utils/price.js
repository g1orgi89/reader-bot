/**
 * 💰 УТИЛИТЫ ДЛЯ РАБОТЫ С ЦЕНАМИ - price.js
 * 
 * Содержит функции для:
 * - Нормализации BYN цен по новым правилам
 * - Маппинга BYN в RUB
 * - Форматирования цен для UI и отчётов
 * 
 * Правила цен (с декабря 2025):
 * - 60 BYN → 80 BYN (все товары)
 * - Исключение: "Тело помнит всё" 80 BYN → 90 BYN
 * - Тиры 100/120/150/200 BYN без изменений
 * 
 * Маппинг BYN → RUB:
 * - 80 BYN → 2400 RUB
 * - 90 BYN → 2700 RUB
 * - 100 BYN → 3000 RUB
 * - 120 BYN → 3600 RUB
 * - 150 BYN → 4500 RUB
 * - 200 BYN → 6000 RUB
 */

/**
 * 💰 Нормализация BYN цены согласно новым правилам
 * - 60 BYN → 80 BYN
 * - Книга "Тело помнит всё" 80 BYN → 90 BYN
 * - Остальные тиры (100/120/150/200) без изменений
 * @param {number} byn - Исходная цена в BYN
 * @param {string} titleOrSlug - Название или slug книги для определения исключений
 * @returns {number} Нормализованная цена в BYN
 */
function normalizeByn(byn, titleOrSlug) {
    // 60 BYN → 80 BYN
    if (byn === 60) return 80;
    
    // Специальный случай: "Тело помнит всё" 80 BYN → 90 BYN
    const isBodyKeepsScore = /тело помнит всё/i.test(String(titleOrSlug || ''));
    if (byn === 80 && isBodyKeepsScore) return 90;
    
    // Остальные тиры без изменений
    return byn;
}

/**
 * 💱 Маппинг BYN в RUB по фиксированной таблице
 * @param {number} byn - Цена в BYN
 * @returns {number|null} Цена в RUB или null если нет маппинга
 */
function mapBynToRub(byn) {
    const map = {
        80: 2400,
        90: 2700,
        100: 3000,
        120: 3600,
        150: 4500,
        200: 6000
    };
    return map[byn] ?? null;
}

/**
 * 💰 Форматирование цены для UI (Mini App)
 * Формат: "{BYN} BYN / {RUB} ₽"
 * @param {number} priceByn - Цена в BYN
 * @param {string} titleOrSlug - Название или slug книги
 * @returns {string} Отформатированная строка цены
 */
function formatPriceUI(priceByn, titleOrSlug) {
    if (!priceByn || priceByn <= 0) {
        return '80 BYN / 2400 ₽'; // Fallback цена
    }
    
    const normalizedByn = normalizeByn(priceByn, titleOrSlug);
    const rub = mapBynToRub(normalizedByn);
    
    if (rub) {
        return `${normalizedByn} BYN / ${rub} ₽`;
    }
    
    return `${normalizedByn} BYN`;
}

/**
 * 💰 Форматирование цены для отчётов (Reports)
 * Формат: "{BYN} BYN / {RUB} RUB" (используем код RUB вместо ₽ для экспорта)
 * @param {number} priceByn - Цена в BYN
 * @param {string} titleOrSlug - Название или slug книги
 * @returns {string} Отформатированная строка цены
 */
function formatPriceReport(priceByn, titleOrSlug) {
    if (!priceByn || priceByn <= 0) {
        return '80 BYN / 2400 RUB'; // Fallback цена
    }
    
    const normalizedByn = normalizeByn(priceByn, titleOrSlug);
    const rub = mapBynToRub(normalizedByn);
    
    if (rub) {
        return `${normalizedByn} BYN / ${rub} RUB`;
    }
    
    return `${normalizedByn} BYN`;
}

// 🌐 ЭКСПОРТ (для использования в других модулях)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeByn,
        mapBynToRub,
        formatPriceUI,
        formatPriceReport
    };
} else {
    // Глобальные функции для браузера
    window.PriceUtils = {
        normalizeByn,
        mapBynToRub,
        formatPriceUI,
        formatPriceReport
    };
    // Также экспортируем отдельно для совместимости
    window.normalizeByn = normalizeByn;
    window.mapBynToRub = mapBynToRub;
    window.formatPriceUI = formatPriceUI;
    window.formatPriceReport = formatPriceReport;
}
