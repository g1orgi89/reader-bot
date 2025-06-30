/**
 * @fileoverview Типы данных для бота "Читатель" - полная версия согласно плану миграции
 * @author g1orgi89
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} userId - Telegram user ID
 * @property {string} telegramUsername - @username (авто-определение)
 * @property {string} name - из вопроса 1 теста
 * @property {string} email - ОБЯЗАТЕЛЬНО после теста
 * @property {TestResults} testResults - ответы на 7 вопросов
 * @property {string} source - Instagram/Telegram/YouTube/Threads/Друзья/Другое
 * @property {Object} preferences - AI-анализ теста
 * @property {Array<string>} preferences.mainThemes - AI-анализ интересов
 * @property {string} preferences.personalityType - тип личности по тесту
 * @property {string} preferences.recommendationStyle - стиль рекомендаций
 * @property {UserStatistics} statistics - статистика пользователя
 * @property {Array<UserAchievement>} achievements - достижения пользователя
 * @property {UserSettings} settings - настройки пользователя
 * @property {Date} registeredAt
 * @property {boolean} isOnboardingComplete
 * @property {Date} [lastActiveAt] - последняя активность
 */

/**
 * @typedef {Object} TestResults
 * @property {string} question1_name - Как вас зовут?
 * @property {string} question2_lifestyle - О себе (мама/замужем/свободна)
 * @property {string} question3_time - Как находите время для себя?
 * @property {string} question4_priorities - Что сейчас важнее всего?
 * @property {string} question5_reading_feeling - Что чувствуете, читая книги?
 * @property {string} question6_phrase - Какая фраза ближе?
 * @property {string} question7_reading_time - Сколько времени читаете в неделю?
 * @property {Date} completedAt - дата завершения теста
 */

/**
 * @typedef {Object} UserStatistics
 * @property {number} totalQuotes - общее количество цитат
 * @property {number} currentStreak - текущая серия дней подряд
 * @property {number} longestStreak - самая длинная серия
 * @property {Array<string>} favoriteAuthors - любимые авторы
 * @property {Array<MonthlyQuoteStats>} monthlyQuotes - статистика по месяцам
 */

/**
 * @typedef {Object} MonthlyQuoteStats
 * @property {number} month - номер месяца
 * @property {number} year - год
 * @property {number} count - количество цитат
 */

/**
 * @typedef {Object} UserSettings
 * @property {boolean} reminderEnabled - включены ли напоминания
 * @property {Array<string>} reminderTimes - время напоминаний ['09:00', '19:00']
 * @property {string} language - язык интерфейса (по умолчанию 'ru')
 */

/**
 * @typedef {Object} Quote
 * @property {string} userId - ID пользователя
 * @property {string} text - текст цитаты
 * @property {string} [author] - автор (может быть пустым)
 * @property {string} [source] - источник книги
 * @property {string} category - AI-определенная категория
 * @property {number} weekNumber - номер недели года
 * @property {number} monthNumber - номер месяца
 * @property {number} yearNumber - год
 * @property {string} sentiment - positive, neutral, negative
 * @property {Array<string>} themes - AI-определенные темы
 * @property {Date} createdAt
 * @property {Date} [editedAt] - дата редактирования
 */

/**
 * @typedef {Object} WeeklyReport
 * @property {string} userId - ID пользователя
 * @property {number} weekNumber - номер недели
 * @property {number} year - год
 * @property {Array<string>} quotes - ID цитат за неделю
 * @property {WeeklyAnalysis} analysis - AI-анализ недели
 * @property {Array<BookRecommendation>} recommendations - рекомендации книг
 * @property {PromoCodeData} promoCode - промокод
 * @property {FeedbackData} [feedback] - обратная связь
 * @property {Date} sentAt - дата отправки
 * @property {boolean} isRead - прочитан ли отчет
 * @property {Date} [readAt] - дата прочтения
 */

/**
 * @typedef {Object} WeeklyAnalysis
 * @property {string} summary - краткий анализ недели
 * @property {Array<string>} dominantThemes - доминирующие темы
 * @property {string} emotionalTone - эмоциональный тон
 * @property {string} insights - подробный анализ от Анны
 */

/**
 * @typedef {Object} BookRecommendation
 * @property {string} title - название книги/курса
 * @property {string} description - краткое описание
 * @property {string} price - цена ($8, $12, etc.)
 * @property {string} link - ссылка с UTM метками
 * @property {string} reasoning - почему эта книга подходит
 */

/**
 * @typedef {Object} PromoCodeData
 * @property {string} code - код промокода
 * @property {number} discount - размер скидки
 * @property {Date} validUntil - действует до
 */

/**
 * @typedef {Object} FeedbackData
 * @property {number} [rating] - оценка 1-5 звезд
 * @property {string} [comment] - комментарий пользователя
 * @property {Date} [respondedAt] - дата ответа
 */

/**
 * @typedef {Object} MonthlyReport
 * @property {string} userId - ID пользователя
 * @property {number} month - номер месяца
 * @property {number} year - год
 * @property {AdditionalSurvey} additionalSurvey - дополнительный опрос
 * @property {MonthlyAnalysis} analysis - глубокий анализ
 * @property {Date} sentAt - дата отправки
 * @property {SpecialOffer} specialOffer - специальное предложение
 */

/**
 * @typedef {Object} AdditionalSurvey
 * @property {string} mood - как ощущали месяц
 * @property {string} mainTheme - главная тема месяца
 * @property {number} satisfaction - удовлетворенность 1-5
 * @property {Array<string>} responses - ответы на вопросы
 * @property {Date} respondedAt - дата ответа
 */

/**
 * @typedef {Object} MonthlyAnalysis
 * @property {string} psychologicalProfile - детальный анализ личности
 * @property {string} personalGrowth - анализ роста и изменений
 * @property {string} recommendations - персональные рекомендации
 * @property {Array<string>} bookSuggestions - рекомендации книг
 */

/**
 * @typedef {Object} SpecialOffer
 * @property {number} discount - размер скидки (25%)
 * @property {Date} validUntil - действует до
 * @property {Array<string>} books - список книг
 */

/**
 * @typedef {Object} Achievement
 * @property {string} id - уникальный ID достижения
 * @property {string} name - название
 * @property {string} description - описание
 * @property {string} icon - эмодзи иконка
 * @property {number} targetValue - цель для получения
 * @property {string} type - тип (quotes_count, streak_days, author_variety, classics_count)
 */

/**
 * @typedef {Object} UserAchievement
 * @property {string} achievementId - ID достижения
 * @property {Date} unlockedAt - дата получения
 */

/**
 * @typedef {Object} Reminder
 * @property {string} userId - ID пользователя
 * @property {string} type - тип напоминания
 * @property {string} message - текст напоминания
 * @property {Date} scheduledAt - запланированное время
 * @property {boolean} sent - отправлено ли
 * @property {Date} [sentAt] - время отправки
 * @property {ReminderConfig} config - конфигурация напоминания
 */

/**
 * @typedef {Object} ReminderConfig
 * @property {string} frequency - daily, every_other_day, twice_weekly, weekly
 * @property {Array<string>} times - время отправки ['09:00', '19:00']
 * @property {number} weeksSinceRegistration - недель с регистрации
 */

/**
 * @typedef {Object} UTMClick
 * @property {string} userId - ID пользователя
 * @property {string} source - utm_source
 * @property {string} medium - utm_medium
 * @property {string} campaign - utm_campaign
 * @property {string} content - utm_content
 * @property {Date} timestamp - время клика
 * @property {string} [userAgent] - User Agent
 * @property {string} [referrer] - Referrer
 */

/**
 * @typedef {Object} PromoCodeUsage
 * @property {string} promoCode - использованный промокод
 * @property {string} userId - ID пользователя
 * @property {number} orderValue - сумма заказа
 * @property {number} discount - размер скидки
 * @property {Date} timestamp - время использования
 * @property {string} source - источник ('telegram_bot')
 */

/**
 * @typedef {Object} Announcement
 * @property {string} id - ID анонса
 * @property {string} title - заголовок
 * @property {string} description - описание
 * @property {string} price - цена
 * @property {Array<string>} targetAudience - целевая аудитория
 * @property {string} launchDate - дата запуска
 * @property {string} utmCampaign - UTM кампания
 */

/**
 * @typedef {Object} Ticket
 * @property {string} ticketId - уникальный ID тикета
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID чата
 * @property {string} subject - тема обращения
 * @property {string} initialMessage - изначальное сообщение
 * @property {string} context - контекст пользователя
 * @property {string} priority - приоритет (low, medium, high)
 * @property {string} category - категория (personal_question, technical, complaint)
 * @property {string} language - язык
 * @property {string} email - email пользователя
 * @property {Object} metadata - дополнительные данные
 * @property {Date} createdAt - дата создания
 * @property {string} status - статус (open, closed, resolved)
 */

/**
 * @typedef {Object} BotState
 * @property {string} userId - ID пользователя
 * @property {string} currentState - текущее состояние
 * @property {Object} [stateData] - данные состояния
 * @property {Date} updatedAt - время обновления
 */

// Состояния онбординга
/**
 * @enum {string}
 */
const ONBOARDING_STATES = {
    START: 'onboarding_start',
    TEST_Q1_NAME: 'test_q1_name',
    TEST_Q2_LIFESTYLE: 'test_q2_lifestyle', 
    TEST_Q3_TIME: 'test_q3_time',
    TEST_Q4_PRIORITIES: 'test_q4_priorities',
    TEST_Q5_READING: 'test_q5_reading',
    TEST_Q6_PHRASE: 'test_q6_phrase',
    TEST_Q7_TIME_AMOUNT: 'test_q7_time_amount',
    COLLECT_EMAIL: 'collect_email',
    COLLECT_SOURCE: 'collect_source',
    COMPLETE: 'complete'
};

// Основные состояния бота
/**
 * @enum {string}
 */
const BOT_STATES = {
    ACTIVE: 'active', // основной режим работы
    AWAITING_QUOTE: 'awaiting_quote',
    SEARCH_MODE: 'search_mode',
    SETTINGS_MODE: 'settings_mode',
    FEEDBACK_MODE: 'feedback_mode',
    AWAITING_MONTHLY_SURVEY: 'awaiting_monthly_survey',
    AWAITING_FEEDBACK_WEEKLY: 'awaiting_feedback_weekly',
    AWAITING_FEEDBACK_MONTHLY: 'awaiting_feedback_monthly'
};

/**
 * @typedef {Object} TestQuestion
 * @property {string} text - текст вопроса
 * @property {string} type - тип (text, buttons)
 * @property {Array<string>} [options] - варианты ответов для кнопок
 */

/**
 * @typedef {Object} QuoteAnalysisResult
 * @property {string} category - определенная категория
 * @property {Array<string>} themes - выявленные темы
 * @property {string} sentiment - эмоциональная окраска
 * @property {string} insights - психологический инсайт
 */

/**
 * @typedef {Object} DashboardStats
 * @property {Object} overview - общая статистика
 * @property {number} overview.totalUsers - всего пользователей
 * @property {number} overview.newUsers - новых пользователей
 * @property {number} overview.totalQuotes - всего цитат
 * @property {number} overview.avgQuotesPerUser - среднее цитат на пользователя
 * @property {number} overview.activeUsers - активных пользователей
 * @property {number} overview.promoUsage - использований промокодов
 * @property {Array<SourceStat>} sourceStats - статистика источников
 * @property {Array<UTMStat>} utmStats - статистика UTM
 * @property {string} period - период статистики
 */

/**
 * @typedef {Object} SourceStat
 * @property {string} _id - источник
 * @property {number} count - количество пользователей
 */

/**
 * @typedef {Object} UTMStat
 * @property {string} campaign - кампания
 * @property {number} clicks - количество кликов
 * @property {number} uniqueUsers - уникальных пользователей
 */

/**
 * @typedef {Object} RetentionData
 * @property {string} cohort - когорта (YYYY-MM)
 * @property {number} size - размер когорты
 * @property {number} week1 - retention неделя 1 (%)
 * @property {number} week2 - retention неделя 2 (%)
 * @property {number} week3 - retention неделя 3 (%)
 * @property {number} week4 - retention неделя 4 (%)
 */

/**
 * @typedef {Object} TopContent
 * @property {Array<TopAuthor>} topAuthors - топ авторы
 * @property {Array<TopCategory>} topCategories - топ категории
 * @property {Array<PopularQuote>} popularQuotes - популярные цитаты
 */

/**
 * @typedef {Object} TopAuthor
 * @property {string} _id - имя автора
 * @property {number} count - количество цитат
 */

/**
 * @typedef {Object} TopCategory
 * @property {string} _id - название категории
 * @property {number} count - количество цитат
 */

/**
 * @typedef {Object} PopularQuote
 * @property {string} _id - текст цитаты
 * @property {string} author - автор
 * @property {number} count - количество использований
 */

module.exports = {
    ONBOARDING_STATES,
    BOT_STATES,
    // Экспортируем константы для использования в коде
    // Все типы определены через @typedef и доступны глобально
};