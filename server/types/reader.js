/**
 * @fileoverview Типы данных для бота "Читатель"
 * @author g1orgi89
 */

/**
 * @typedef {Object} Quote
 * @property {string} userId - ID пользователя Telegram
 * @property {string} text - Текст цитаты
 * @property {string} [author] - Автор цитаты (если указан)
 * @property {string} [source] - Источник цитаты (книга, статья и т.д.)
 * @property {string} category - AI-определенная тема/категория
 * @property {number} weekNumber - Номер недели в году
 * @property {number} monthNumber - Номер месяца
 * @property {Date} createdAt - Дата создания
 * @property {Date} [updatedAt] - Дата обновления
 * @property {boolean} [isDeleted=false] - Флаг удаления
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} userId - ID пользователя Telegram
 * @property {string} name - Имя пользователя
 * @property {string} [email] - Email адрес для отчетов
 * @property {string} [telegramUsername] - Username в Telegram
 * @property {Object} testResults - Результаты вступительного теста
 * @property {string} testResults.status - Статус прохождения теста ('completed', 'in_progress', 'not_started')
 * @property {Array<TestAnswer>} testResults.answers - Ответы на вопросы теста
 * @property {string} testResults.personality - Определенный тип личности
 * @property {Date} testResults.completedAt - Дата завершения теста
 * @property {Object} preferences - Настройки пользователя
 * @property {boolean} preferences.remindersEnabled - Включены ли напоминания
 * @property {Array<string>} preferences.reminderTimes - Время напоминаний ['09:00', '19:00']
 * @property {string} preferences.reminderFrequency - Частота напоминаний
 * @property {string} preferences.language - Язык интерфейса ('ru', 'en')
 * @property {string} source - Откуда узнал о боте
 * @property {Date} registeredAt - Дата регистрации
 * @property {Date} [lastActiveAt] - Последняя активность
 * @property {Object} statistics - Статистика пользователя
 * @property {number} statistics.totalQuotes - Общее количество цитат
 * @property {number} statistics.currentStreak - Текущая серия дней подряд
 * @property {number} statistics.longestStreak - Самая длинная серия
 * @property {Array<string>} statistics.favoriteAuthors - Любимые авторы
 * @property {Object} statistics.categoriesCount - Количество цитат по категориям
 */

/**
 * @typedef {Object} TestAnswer
 * @property {number} questionNumber - Номер вопроса
 * @property {string} question - Текст вопроса
 * @property {string} answer - Ответ пользователя
 * @property {string} [selectedOption] - Выбранная опция (для вопросов с вариантами)
 */

/**
 * @typedef {Object} ContentItem
 * @property {string} key - Уникальный ключ контента
 * @property {string} content - Сам текст/промпт/шаблон
 * @property {string} language - Язык контента ('ru', 'en', 'es')
 * @property {string} type - Тип контента ('prompt', 'template', 'message', 'book_analysis')
 * @property {boolean} isActive - Активен ли контент
 * @property {Object} [metadata] - Дополнительная информация
 * @property {string} [metadata.title] - Заголовок
 * @property {string} [metadata.description] - Описание
 * @property {Array<string>} [metadata.tags] - Теги
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата обновления
 * @property {string} [createdBy] - Кто создал
 */

/**
 * @typedef {Object} BookAnalysis
 * @property {string} id - Уникальный ID разбора
 * @property {string} title - Название книги
 * @property {string} author - Автор книги
 * @property {string} description - Описание разбора
 * @property {string} content - Полный текст разбора
 * @property {number} price - Цена в долларах
 * @property {Array<string>} categories - Категории/темы книги
 * @property {Array<string>} keywords - Ключевые слова для поиска
 * @property {string} coverImageUrl - URL обложки
 * @property {string} purchaseUrl - Ссылка на покупку с UTM метками
 * @property {boolean} isActive - Активен ли разбор
 * @property {Date} createdAt - Дата создания
 * @property {Date} [updatedAt] - Дата обновления
 */

/**
 * @typedef {Object} WeeklyReport
 * @property {string} userId - ID пользователя
 * @property {number} weekNumber - Номер недели
 * @property {number} year - Год
 * @property {Array<Quote>} quotes - Цитаты за неделю
 * @property {string} analysis - Анализ недели от AI
 * @property {Array<BookAnalysis>} recommendations - Рекомендованные разборы
 * @property {string} [promoCode] - Промокод со скидкой
 * @property {Date} createdAt - Дата создания отчета
 * @property {boolean} emailSent - Отправлен ли email
 * @property {Date} [emailSentAt] - Дата отправки email
 */

/**
 * @typedef {Object} MonthlyReport
 * @property {string} userId - ID пользователя
 * @property {number} monthNumber - Номер месяца
 * @property {number} year - Год
 * @property {Array<Quote>} quotes - Все цитаты за месяц
 * @property {string} psychologicalAnalysis - Психологический анализ
 * @property {Object} trends - Тренды и динамика
 * @property {Array<string>} trends.dominantThemes - Доминирующие темы
 * @property {string} trends.emotionalDynamics - Эмоциональная динамика
 * @property {Array<BookAnalysis>} personalizedRecommendations - Персональные рекомендации
 * @property {string} [specialPromoCode] - Специальный промокод (25%)
 * @property {Date} createdAt - Дата создания
 * @property {boolean} emailSent - Отправлен ли email
 */

/**
 * @typedef {Object} Reminder
 * @property {string} userId - ID пользователя
 * @property {string} type - Тип напоминания ('daily', 'weekly', 'monthly')
 * @property {string} message - Текст напоминания
 * @property {Date} scheduledAt - Запланированное время отправки
 * @property {boolean} sent - Отправлено ли
 * @property {Date} [sentAt] - Время отправки
 * @property {string} frequency - Частота ('daily', 'every_other_day', 'twice_weekly', 'weekly')
 * @property {number} weeksSinceRegistration - Недель с регистрации
 */

/**
 * @typedef {Object} Analytics
 * @property {string} userId - ID пользователя  
 * @property {string} action - Действие ('quote_added', 'link_clicked', 'promo_used', 'report_viewed')
 * @property {Object} [metadata] - Дополнительные данные
 * @property {string} [metadata.quoteId] - ID цитаты
 * @property {string} [metadata.linkUrl] - URL ссылки
 * @property {string} [metadata.promoCode] - Промокод
 * @property {string} [metadata.source] - Источник действия
 * @property {string} [metadata.utmSource] - UTM source
 * @property {string} [metadata.utmMedium] - UTM medium
 * @property {string} [metadata.utmCampaign] - UTM campaign
 * @property {Date} timestamp - Время события
 * @property {string} [sessionId] - ID сессии
 * @property {string} [ip] - IP адрес
 * @property {string} [userAgent] - User Agent
 */

/**
 * @typedef {Object} PromoCode
 * @property {string} code - Код промокода
 * @property {string} type - Тип ('weekly', 'monthly', 'personal', 'special')
 * @property {number} discountPercent - Размер скидки в процентах
 * @property {Date} validFrom - Действует с
 * @property {Date} validUntil - Действует до
 * @property {Array<string>} applicableToBooks - ID книг, к которым применим
 * @property {number} [maxUses] - Максимальное количество использований
 * @property {number} usedCount - Количество использований
 * @property {Array<string>} usedByUsers - Пользователи, которые использовали
 * @property {boolean} isActive - Активен ли промокод
 * @property {Date} createdAt - Дата создания
 * @property {string} [description] - Описание промокода
 */

/**
 * @typedef {Object} BotState
 * @property {string} userId - ID пользователя
 * @property {string} currentState - Текущее состояние бота
 * @property {Object} [stateData] - Данные состояния
 * @property {Date} updatedAt - Время обновления состояния
 */

/**
 * @typedef {Object} FeedbackData
 * @property {string} userId - ID пользователя
 * @property {string} type - Тип отзыва ('weekly_report', 'monthly_report', 'general')
 * @property {number} [rating] - Оценка (1-5 звезд)
 * @property {string} [feedbackText] - Текст отзыва
 * @property {Object} [answers] - Ответы на конкретные вопросы
 * @property {Date} createdAt - Дата создания
 * @property {string} [reportId] - ID отчета, к которому относится отзыв
 */

// Состояния бота для навигации
/**
 * @typedef {string} BotStateType
 * @description Возможные состояния бота
 * - 'start' - Начальное состояние
 * - 'taking_test' - Прохождение теста
 * - 'test_question_{number}' - Конкретный вопрос теста
 * - 'collecting_email' - Сбор email
 * - 'collecting_source' - Сбор источника
 * - 'waiting_quote' - Ожидание цитаты
 * - 'searching_quotes' - Поиск по цитатам
 * - 'editing_quote' - Редактирование цитаты
 * - 'viewing_stats' - Просмотр статистики
 * - 'settings_menu' - Меню настроек
 * - 'setting_reminders' - Настройка напоминаний
 * - 'giving_feedback' - Дача обратной связи
 */

/**
 * @typedef {Object} QuoteAnalysisResult
 * @property {string} category - Определенная категория
 * @property {number} confidence - Уверенность в определении (0-1)
 * @property {Array<string>} themes - Выявленные темы
 * @property {string} sentiment - Эмоциональная окраска ('positive', 'negative', 'neutral')
 * @property {Array<string>} suggestedBooks - Предложенные книги на основе цитаты
 */

/**
 * @typedef {Object} EmailTemplate
 * @property {string} templateId - ID шаблона
 * @property {string} name - Название шаблона
 * @property {string} subject - Тема письма
 * @property {string} htmlContent - HTML содержимое
 * @property {string} textContent - Текстовое содержимое
 * @property {Array<string>} variables - Переменные для подстановки
 * @property {string} type - Тип шаблона ('weekly_report', 'monthly_report', 'welcome')
 * @property {boolean} isActive - Активен ли шаблон
 * @property {Date} createdAt - Дата создания
 * @property {Date} [updatedAt] - Дата обновления
 */

module.exports = {
    // Экспортируем пустой объект для совместимости с JSDoc
    // Все типы определены через @typedef и доступны глобально
};