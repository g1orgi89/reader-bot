/**
 * 🛠️ ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 * Размер: 2 KB - общие функции для Mini App
 * 
 * Содержит утилиты, которые используются в разных частях приложения:
 * - Форматирование данных
 * - Работа с датами
 * - Манипуляции со строками
 * - Общие UI хелперы
 */

// 📅 ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ

/**
 * Форматирует дату в читаемый формат
 * @param {Date|string} date - Дата для форматирования
 * @returns {string} Отформатированная дата
 */
function formatDate(date) {
    // Реализация будет добавлена
}

/**
 * Получает относительное время (например, "2 дня назад")
 * @param {Date|string} date - Дата
 * @returns {string} Относительное время
 */
function getRelativeTime(date) {
    // Реализация будет добавлена
}

// 📝 ФУНКЦИИ ДЛЯ РАБОТЫ СО СТРОКАМИ

/**
 * Обрезает текст до указанной длины
 * @param {string} text - Исходный текст
 * @param {number} maxLength - Максимальная длина
 * @returns {string} Обрезанный текст
 */
function truncateText(text, maxLength) {
    // Реализация будет добавлена
}

/**
 * Экранирует HTML символы для безопасного отображения
 * @param {string} text - Исходный текст
 * @returns {string} Экранированный текст
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Извлекает инициалы из имени пользователя
 * @param {string} fullName - Полное имя
 * @returns {string} Инициалы
 */
function getInitials(fullName) {
    // Реализация будет добавлена
}

// 🎨 UI ХЕЛПЕРЫ

/**
 * Добавляет CSS класс с анимацией
 * @param {HTMLElement} element - DOM элемент
 * @param {string} className - CSS класс
 */
function addClassWithAnimation(element, className) {
    // Реализация будет добавлена
}

/**
 * Показывает уведомление пользователю
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип уведомления (success, error, info)
 */
function showNotification(message, type = 'info') {
    // Реализация будет добавлена
}

// 📊 ФУНКЦИИ ДЛЯ РАБОТЫ С ДАННЫМИ

/**
 * Группирует массив объектов по заданному ключу
 * @param {Array} array - Массив для группировки
 * @param {string} key - Ключ для группировки
 * @returns {Object} Сгруппированные данные
 */
function groupBy(array, key) {
    // Реализация будет добавлена
}

/**
 * Дебаунс функция для оптимизации поиска
 * @param {Function} func - Функция для дебаунса
 * @param {number} delay - Задержка в мс
 * @returns {Function} Дебаунс функция
 */
function debounce(func, delay) {
    // Реализация будет добавлена
}

// 🔢 МАТЕМАТИЧЕСКИЕ УТИЛИТЫ

/**
 * Вычисляет процент выполнения
 * @param {number} current - Текущее значение
 * @param {number} target - Целевое значение
 * @returns {number} Процент выполнения
 */
function calculateProgress(current, target) {
    // Реализация будет добавлена
}

// 🌐 ЭКСПОРТ (для использования в других модулях)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        getRelativeTime,
        truncateText,
        escapeHtml,
        getInitials,
        showNotification,
        groupBy,
        debounce,
        calculateProgress
    };
} else {
    // Глобальные функции для браузера
    window.formatDate = formatDate;
    window.getRelativeTime = getRelativeTime;
    window.truncateText = truncateText;
    window.escapeHtml = escapeHtml;
    window.getInitials = getInitials;
    window.showNotification = showNotification;
    window.groupBy = groupBy;
    window.debounce = debounce;
    window.calculateProgress = calculateProgress;
}