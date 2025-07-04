/**
 * @fileoverview TypeScript types для проекта "Читатель" - Reader Analytics
 * @description Shared типы для аналитики, используемые в server и client
 * @version 4.0.0
 */

/**
 * @namespace ReaderTypes
 * @description Пространство имен для всех типов проекта "Читатель"
 */

// ========================================
// ОСНОВНЫЕ ТИПЫ ДАННЫХ
// ========================================

/**
 * Базовый ответ API
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Статус успеха операции
 * @property {any} [data] - Данные ответа (если успешно)
 * @property {string} [error] - Сообщение об ошибке (если неуспешно)
 * @property {string} timestamp - Время ответа ISO string
 * @property {boolean} [fallbackMode] - Режим fallback данных
 * @property {Object} [metadata] - Дополнительные метаданные
 */

/**
 * Обзорная статистика дашборда
 * @typedef {Object} DashboardOverview
 * @property {number} totalUsers - Общее количество пользователей
 * @property {number} newUsers - Новые пользователи за период
 * @property {number} totalQuotes - Общее количество цитат за период
 * @property {number} avgQuotesPerUser - Среднее количество цитат на пользователя
 * @property {number} activeUsers - Активные пользователи за период
 * @property {number} promoUsage - Количество использованных промокодов
 */

/**
 * Полная статистика дашборда
 * @typedef {Object} DashboardStats
 * @property {DashboardOverview} overview - Обзорная статистика
 * @property {SourceStats[]} sourceStats - Статистика источников трафика
 * @property {UTMStats[]} utmStats - Статистика UTM кампаний
 * @property {string} period - Период данных (1d, 7d, 30d, 90d)
 * @property {string} timestamp - Время генерации данных
 * @property {boolean} [fallbackMode] - Режим fallback данных
 */

/**
 * Статистика источников трафика
 * @typedef {Object} SourceStats
 * @property {string} _id - Название источника (Instagram, Telegram, YouTube, etc.)
 * @property {number} count - Количество пользователей из этого источника
 */

/**
 * Статистика UTM кампаний
 * @typedef {Object} UTMStats
 * @property {string} _id - ID кампании (или поле campaign)
 * @property {string} [campaign] - Название кампании
 * @property {number} clicks - Общее количество кликов
 * @property {number} uniqueUsers - Количество уникальных пользователей
 */

/**
 * Данные retention пользователей
 * @typedef {Object} RetentionData
 * @property {string} cohort - Когорта в формате YYYY-MM
 * @property {number} size - Размер когорты (количество пользователей)
 * @property {number} week1 - Retention на 1 неделе (%)
 * @property {number} week2 - Retention на 2 неделе (%)
 * @property {number} week3 - Retention на 3 неделе (%)
 * @property {number} week4 - Retention на 4 неделе (%)
 */

/**
 * Топ контент
 * @typedef {Object} TopContentData
 * @property {TopAuthor[]} topAuthors - Топ авторы цитат
 * @property {TopCategory[]} topCategories - Топ категории
 * @property {PopularQuote[]} popularQuotes - Популярные цитаты
 * @property {boolean} [fallbackMode] - Режим fallback данных
 */

/**
 * Топ автор
 * @typedef {Object} TopAuthor
 * @property {string} _id - Имя автора
 * @property {number} count - Количество цитат этого автора
 */

/**
 * Топ категория
 * @typedef {Object} TopCategory
 * @property {string} _id - Название категории
 * @property {number} count - Количество цитат в этой категории
 */

/**
 * Популярная цитата
 * @typedef {Object} PopularQuote
 * @property {string} _id - Текст цитаты
 * @property {string} [author] - Автор цитаты (может быть null)
 * @property {number} count - Количество раз, когда цитата была сохранена
 */

// ========================================
// ТИПЫ ДЛЯ ТРЕКИНГА
// ========================================

/**
 * Данные UTM клика для трекинга
 * @typedef {Object} UTMClickData
 * @property {string} utm_source - Источник (Instagram, Telegram, etc.)
 * @property {string} utm_medium - Канал (weekly_report, monthly_announcement, etc.)
 * @property {string} utm_campaign - Кампания (reader_recommendations, book_promo, etc.)
 * @property {string} [utm_content] - Контент (необязательно)
 * @property {string} [user_agent] - User Agent браузера
 * @property {string} [referrer] - Referrer URL
 * @property {string} [ip_address] - IP адрес пользователя
 * @property {string} [session_id] - ID сессии
 */

/**
 * Данные использования промокода
 * @typedef {Object} PromoCodeUsageData
 * @property {string} promo_code - Промокод (READER20, WISDOM20, etc.)
 * @property {string} user_id - ID пользователя Telegram
 * @property {number} order_value - Сумма заказа в долларах
 * @property {Object} [metadata] - Дополнительные данные
 * @property {string} [metadata.source] - Источник использования (telegram_bot, website)
 * @property {string} [metadata.reportType] - Тип отчета (weekly, monthly)
 * @property {string[]} [metadata.booksPurchased] - Купленные книги
 */

/**
 * Данные действия пользователя
 * @typedef {Object} UserActionData
 * @property {string} user_id - ID пользователя Telegram
 * @property {string} action - Тип действия (quote_sent, report_viewed, achievement_unlocked, etc.)
 * @property {Object} [metadata] - Метаданные действия
 * @property {string} [metadata.quoteId] - ID цитаты (для действий с цитатами)
 * @property {string} [metadata.reportId] - ID отчета (для действий с отчетами)
 * @property {string} [metadata.achievementId] - ID достижения
 * @property {any} [metadata.additionalData] - Любые дополнительные данные
 */

// ========================================
// ТИПЫ МОДЕЛЕЙ ДАННЫХ
// ========================================

/**
 * Профиль пользователя в системе "Читатель"
 * @typedef {Object} UserProfile
 * @property {string} userId - Telegram user ID
 * @property {string} [telegramUsername] - @username в Telegram
 * @property {string} name - Имя пользователя (из теста)
 * @property {string} email - Email для связи (обязательно после теста)
 * @property {TestResults} testResults - Результаты онбординг теста (7 вопросов)
 * @property {string} source - Источник трафика (Instagram/Telegram/YouTube/Threads/Друзья/Другое)
 * @property {UserPreferences} [preferences] - AI-анализ предпочтений
 * @property {UserStatistics} statistics - Статистика пользователя
 * @property {Achievement[]} achievements - Разблокированные достижения
 * @property {UserSettings} settings - Настройки пользователя
 * @property {Date} registeredAt - Дата регистрации
 * @property {boolean} isOnboardingComplete - Завершен ли онбординг
 */

/**
 * Результаты теста пользователя
 * @typedef {Object} TestResults
 * @property {string} name - Как вас зовут?
 * @property {string} lifestyle - О себе (мама/замужем/свободна)
 * @property {string} timeForSelf - Как находите время для себя?
 * @property {string} priorities - Что сейчас важнее всего?
 * @property {string} readingFeelings - Что чувствуете, читая книги?
 * @property {string} closestPhrase - Какая фраза ближе?
 * @property {string} readingTime - Сколько времени читаете в неделю?
 */

/**
 * Предпочтения пользователя (AI-анализ)
 * @typedef {Object} UserPreferences
 * @property {string[]} mainThemes - Основные темы интересов
 * @property {string} personalityType - Тип личности по тесту
 * @property {string} recommendationStyle - Стиль рекомендаций
 */

/**
 * Статистика пользователя
 * @typedef {Object} UserStatistics
 * @property {number} totalQuotes - Общее количество цитат
 * @property {number} currentStreak - Текущая серия дней подряд
 * @property {number} longestStreak - Самая длинная серия
 * @property {string[]} favoriteAuthors - Любимые авторы
 * @property {MonthlyQuoteStat[]} monthlyQuotes - Статистика по месяцам
 */

/**
 * Статистика цитат по месяцам
 * @typedef {Object} MonthlyQuoteStat
 * @property {number} month - Номер месяца (1-12)
 * @property {number} year - Год
 * @property {number} count - Количество цитат
 */

/**
 * Достижение пользователя
 * @typedef {Object} Achievement
 * @property {string} achievementId - ID достижения
 * @property {Date} unlockedAt - Дата разблокировки
 */

/**
 * Настройки пользователя
 * @typedef {Object} UserSettings
 * @property {boolean} reminderEnabled - Включены ли напоминания
 * @property {string[]} reminderTimes - Время напоминаний (['09:00', '19:00'])
 * @property {string} language - Язык интерфейса
 */

/**
 * Цитата пользователя
 * @typedef {Object} Quote
 * @property {string} userId - ID пользователя
 * @property {string} text - Текст цитаты (макс 1000 символов)
 * @property {string} [author] - Автор цитаты (может быть пустым)
 * @property {string} [source] - Источник книги
 * @property {string} category - AI-определенная категория
 * @property {number} weekNumber - Номер недели года (ISO)
 * @property {number} monthNumber - Номер месяца (1-12)
 * @property {number} yearNumber - Год
 * @property {string} [sentiment] - Эмоциональная окраска (positive, neutral, negative)
 * @property {string[]} [themes] - AI-определенные темы
 * @property {Date} createdAt - Дата создания
 * @property {Date} [editedAt] - Дата редактирования
 */

/**
 * Еженедельный отчет
 * @typedef {Object} WeeklyReport
 * @property {string} userId - ID пользователя
 * @property {number} weekNumber - Номер недели года
 * @property {number} year - Год
 * @property {string[]} quotes - ID цитат за неделю
 * @property {ReportAnalysis} analysis - AI-анализ недели
 * @property {BookRecommendation[]} recommendations - Рекомендации книг от Анны
 * @property {PromoCode} promoCode - Промокод недели
 * @property {ReportFeedback} [feedback] - Обратная связь от пользователя
 * @property {Date} sentAt - Дата отправки
 * @property {boolean} isRead - Прочитан ли отчет
 * @property {Date} [readAt] - Дата прочтения
 */

/**
 * Анализ отчета (еженедельного/месячного)
 * @typedef {Object} ReportAnalysis
 * @property {string} summary - Краткий анализ одним предложением
 * @property {string[]} dominantThemes - Доминирующие темы
 * @property {string} emotionalTone - Эмоциональный тон
 * @property {string} insights - Подробный психологический анализ от Анны
 */

/**
 * Рекомендация книги
 * @typedef {Object} BookRecommendation
 * @property {string} title - Название книги/курса
 * @property {string} description - Краткое описание
 * @property {string} price - Цена ($8, $12, etc.)
 * @property {string} link - Ссылка с UTM метками
 * @property {string} reasoning - Почему эта книга подходит
 */

/**
 * Промокод
 * @typedef {Object} PromoCode
 * @property {string} code - Код (READER20, WISDOM20, etc.)
 * @property {number} discount - Размер скидки в процентах
 * @property {Date} validUntil - Дата истечения
 */

/**
 * Обратная связь по отчету
 * @typedef {Object} ReportFeedback
 * @property {number} [rating] - Оценка 1-5 звезд
 * @property {string} [comment] - Комментарий пользователя
 * @property {Date} [respondedAt] - Дата ответа
 */

// ========================================
// ТИПЫ ДЛЯ FRONTEND КОМПОНЕНТОВ
// ========================================

/**
 * Конфигурация графика
 * @typedef {Object} ChartConfig
 * @property {string} type - Тип графика (line, bar, doughnut, etc.)
 * @property {Object} data - Данные для графика
 * @property {Object} options - Опции Chart.js
 */

/**
 * Настройки дашборда
 * @typedef {Object} DashboardSettings
 * @property {string} currentPeriod - Текущий период (1d, 7d, 30d, 90d)
 * @property {boolean} autoRefresh - Автообновление включено
 * @property {number} refreshInterval - Интервал обновления в миллисекундах
 * @property {boolean} fallbackMode - Режим fallback данных
 */

/**
 * Состояние уведомления
 * @typedef {Object} NotificationState
 * @property {string} type - Тип уведомления (success, error, warning)
 * @property {string} message - Сообщение
 * @property {number} [duration] - Длительность показа в миллисекундах
 * @property {boolean} [persistent] - Постоянное уведомление
 */

// ========================================
// ТИПЫ ДЛЯ API ENDPOINTS
// ========================================

/**
 * Запрос на получение статистики дашборда
 * @typedef {Object} DashboardStatsRequest
 * @property {string} [period] - Период данных (по умолчанию 7d)
 */

/**
 * Запрос на трекинг UTM клика
 * @typedef {Object} TrackUTMRequest
 * @property {string} utm_source - Источник
 * @property {string} utm_medium - Канал
 * @property {string} utm_campaign - Кампания
 * @property {string} [utm_content] - Контент
 * @property {string} user_id - ID пользователя
 */

/**
 * Запрос на трекинг промокода
 * @typedef {Object} TrackPromoRequest
 * @property {string} promo_code - Промокод
 * @property {string} user_id - ID пользователя
 * @property {number} order_value - Сумма заказа
 * @property {Object} [metadata] - Дополнительные данные
 */

/**
 * Запрос на экспорт данных
 * @typedef {Object} ExportDataRequest
 * @property {string} [format] - Формат экспорта (json, csv)
 * @property {string} [period] - Период данных
 */

// ========================================
// КОНСТАНТЫ И ЕНУМЫ
// ========================================

/**
 * Доступные периоды аналитики
 * @readonly
 * @enum {string}
 */
const ANALYTICS_PERIODS = {
  ONE_DAY: '1d',
  ONE_WEEK: '7d', 
  ONE_MONTH: '30d',
  THREE_MONTHS: '90d'
};

/**
 * Источники трафика
 * @readonly
 * @enum {string}
 */
const TRAFFIC_SOURCES = {
  INSTAGRAM: 'Instagram',
  TELEGRAM: 'Telegram',
  YOUTUBE: 'YouTube',
  THREADS: 'Threads',
  FRIENDS: 'Друзья',
  OTHER: 'Другое'
};

/**
 * Категории цитат
 * @readonly
 * @enum {string}
 */
const QUOTE_CATEGORIES = {
  SELF_DEVELOPMENT: 'Саморазвитие',
  LOVE: 'Любовь',
  PHILOSOPHY: 'Философия',
  MOTIVATION: 'Мотивация',
  WISDOM: 'Мудрость',
  CREATIVITY: 'Творчество',
  RELATIONSHIPS: 'Отношения',
  PSYCHOLOGY: 'Психология'
};

/**
 * Типы достижений
 * @readonly
 * @enum {string}
 */
const ACHIEVEMENT_TYPES = {
  QUOTES_COUNT: 'quotes_count',
  STREAK_DAYS: 'streak_days',
  AUTHOR_VARIETY: 'author_variety',
  CLASSICS_COUNT: 'classics_count'
};

/**
 * Типы уведомлений
 * @readonly
 * @enum {string}
 */
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// ========================================
// ЭКСПОРТ ТИПОВ
// ========================================

// Для использования в Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Основные типы (через JSDoc)
    ANALYTICS_PERIODS,
    TRAFFIC_SOURCES,
    QUOTE_CATEGORIES,
    ACHIEVEMENT_TYPES,
    NOTIFICATION_TYPES
  };
}

// Для использования в браузере
if (typeof window !== 'undefined') {
  window.ReaderTypes = {
    ANALYTICS_PERIODS,
    TRAFFIC_SOURCES,
    QUOTE_CATEGORIES,
    ACHIEVEMENT_TYPES,
    NOTIFICATION_TYPES
  };
}

console.log('📚 Reader Types v4.0.0 загружены');

/**
 * @description Все типы определены через JSDoc и доступны для использования
 * в проекте "Читатель". Этот файл обеспечивает типобезопасность между
 * frontend и backend компонентами.
 * 
 * @example
 * // Использование типа в функции
 * function processDashboardStats(stats) {
 *   // @type {DashboardStats}
 *   console.log(stats.overview.totalUsers);
 * }
 * 
 * @example
 * // Использование константы
 * const period = ReaderTypes.ANALYTICS_PERIODS.ONE_WEEK;
 */