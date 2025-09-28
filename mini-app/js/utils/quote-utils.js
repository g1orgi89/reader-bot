/**
 * 🔧 Quote Utils — нормализация и дубликаты
 * Глобальные утилиты для работы с цитатами.
 * Без зависимостей. Vanilla JS. Экспорт в window.
 */

/**
 * Глобальный индекс дубликатов цитат
 * Структура: { "normalized_text|normalized_author": true }
 */
window.QUOTE_DUP_INDEX = window.QUOTE_DUP_INDEX || {};

/**
 * Нормализация текста цитаты для проверки дубликатов
 * Удаляем кавычки, выравниваем тире, схлопываем пробелы, убираем точки в конце, в нижний регистр
 * @param {string} text - Исходный текст
 * @returns {string} Нормализованный текст
 */
function normalizeQuoteText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
        // Убираем различные виды кавычек
        .replace(/[«»""''„"]/g, '')
        // Выравниваем разные тире на обычный дефис
        .replace(/[—–−]/g, '-')
        // Схлопываем множественные пробелы в один
        .replace(/\s+/g, ' ')
        // Убираем точки и многоточия в конце (включая пробелы после них)
        .replace(/[.\u2026]+\s*$/g, '')
        // Убираем пробелы в начале и конце
        .trim()
        // Приводим к нижнему регистру
        .toLowerCase();
}

/**
 * Создание ключа дубликата из текста и автора
 * @param {string} text - Текст цитаты
 * @param {string} author - Автор цитаты
 * @returns {string} Ключ для индекса дубликатов
 */
function createDuplicateKey(text, author) {
    const normalizedText = normalizeQuoteText(text);
    const normalizedAuthor = normalizeQuoteText(author || '');
    return `${normalizedText}|${normalizedAuthor}`;
}

/**
 * Проверка, является ли цитата дубликатом
 * @param {Array} existingQuotes - Массив существующих цитат
 * @param {string} newText - Текст новой цитаты
 * @param {string} newAuthor - Автор новой цитаты
 * @returns {boolean} true если цитата является дубликатом
 */
function isDuplicateQuote(existingQuotes, newText, newAuthor) {
    if (!newText) return false;
    
    const newKey = createDuplicateKey(newText, newAuthor);
    
    // Быстрая проверка через индекс
    if (window.QUOTE_DUP_INDEX[newKey]) {
        return true;
    }
    
    // Проверяем через массив цитат (для надежности)
    return existingQuotes.some(quote => {
        const existingKey = createDuplicateKey(quote.text, quote.author);
        return existingKey === newKey;
    });
}

/**
 * Добавление цитаты в индекс дубликатов
 * @param {Object} quote - Объект цитаты с полями text и author
 */
function addQuoteToDuplicateIndex(quote) {
    if (!quote || !quote.text) return;
    
    const key = createDuplicateKey(quote.text, quote.author);
    window.QUOTE_DUP_INDEX[key] = true;
}

/**
 * Перестройка индекса дубликатов из массива цитат
 * @param {Array} quotes - Массив всех цитат
 */
function rebuildDuplicateIndex(quotes) {
    // Очищаем старый индекс
    window.QUOTE_DUP_INDEX = {};
    
    // Заполняем новый индекс
    if (Array.isArray(quotes)) {
        quotes.forEach(quote => {
            addQuoteToDuplicateIndex(quote);
        });
    }
    
    console.log(`🔧 QuoteUtils: Rebuilt duplicate index with ${Object.keys(window.QUOTE_DUP_INDEX).length} quotes`);
}

/**
 * Удаление цитаты из индекса дубликатов
 * @param {Object} quote - Объект цитаты с полями text и author
 */
function removeQuoteFromDuplicateIndex(quote) {
    if (!quote || !quote.text) return;
    
    const key = createDuplicateKey(quote.text, quote.author);
    delete window.QUOTE_DUP_INDEX[key];
}

// Экспорт в глобальное пространство имен
window.QuoteUtils = {
    normalizeQuoteText,
    createDuplicateKey,
    isDuplicateQuote,
    addQuoteToDuplicateIndex,
    rebuildDuplicateIndex,
    removeQuoteFromDuplicateIndex
};

// Инициализируем индекс дубликатов при загрузке, если есть сохраненные цитаты
document.addEventListener('DOMContentLoaded', () => {
    // Попытка инициализации из state, если доступен
    if (window.appState && window.appState.get) {
        const existingQuotes = window.appState.get('quotes.items') || [];
        if (existingQuotes.length > 0) {
            rebuildDuplicateIndex(existingQuotes);
        }
    }
});

console.log('🔧 QuoteUtils loaded successfully');