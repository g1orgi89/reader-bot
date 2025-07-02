/**
 * @fileoverview Shared types and constants for Reader Bot - Anna Busel's quote collection project
 * @module server/types/reader
 */

/**
 * Состояния онбординга пользователей
 * @readonly
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

/**
 * Категории цитат для AI-анализа
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
  SPIRITUALITY: 'Духовность',
  LIFE: 'Жизнь'
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
 * @typedef {Object} UserProfile
 * @property {string} userId - Telegram user ID
 * @property {string} telegramUsername - @username (auto-detected)
 * @property {string} name - User's name from test question 1
 * @property {string} email - REQUIRED after test completion
 * @property {TestResults} testResults - Answers to 7 onboarding questions
 * @property {string} source - Traffic source (Instagram/Telegram/YouTube/Threads/Друзья/Другое)
 * @property {UserPreferences} preferences - AI-analyzed preferences
 * @property {UserStatistics} statistics - User statistics
 * @property {Achievement[]} achievements - User achievements
 * @property {UserSettings} settings - User settings
 * @property {Date} registeredAt - Registration date
 * @property {boolean} isOnboardingComplete - Onboarding completion status
 */

/**
 * @typedef {Object} TestResults
 * @property {string} question1_name - How are you called?
 * @property {string} question2_lifestyle - About yourself (mom/married/single)
 * @property {string} question3_time - How do you find time for yourself?
 * @property {string} question4_priorities - What's most important right now?
 * @property {string} question5_reading_feeling - What do you feel when reading books?
 * @property {string} question6_phrase - Which phrase is closer to you?
 * @property {string} question7_reading_time - How much time do you spend reading per week?
 * @property {Date} completedAt - When test was completed
 */

/**
 * @typedef {Object} UserPreferences
 * @property {string[]} mainThemes - AI-analyzed interests
 * @property {string} personalityType - Personality type from test
 * @property {string} recommendationStyle - Style of recommendations
 */

/**
 * @typedef {Object} UserStatistics
 * @property {number} totalQuotes - Total quotes collected
 * @property {number} currentStreak - Current daily streak
 * @property {number} longestStreak - Longest daily streak
 * @property {string[]} favoriteAuthors - Favorite authors
 * @property {MonthlyQuoteCount[]} monthlyQuotes - Monthly quote counts
 */

/**
 * @typedef {Object} UserSettings
 * @property {boolean} reminderEnabled - Whether reminders are enabled
 * @property {string[]} reminderTimes - Reminder times (e.g., ['09:00', '19:00'])
 * @property {string} language - User language preference
 */

/**
 * @typedef {Object} MonthlyQuoteCount
 * @property {number} month - Month number
 * @property {number} year - Year
 * @property {number} count - Quote count for the month
 */

/**
 * @typedef {Object} Quote
 * @property {string} userId - User ID
 * @property {string} text - Quote text
 * @property {string} [author] - Quote author
 * @property {string} [source] - Book source
 * @property {string} category - AI-determined category
 * @property {string[]} themes - AI-determined themes
 * @property {string} sentiment - Sentiment analysis (positive/neutral/negative)
 * @property {number} weekNumber - Week number of the year
 * @property {number} monthNumber - Month number
 * @property {number} yearNumber - Year number
 * @property {Date} createdAt - Creation date
 * @property {Date} [editedAt] - Last edit date
 */

/**
 * @typedef {Object} WeeklyReport
 * @property {string} userId - User ID
 * @property {number} weekNumber - Week number
 * @property {number} year - Year
 * @property {string[]} quotes - Quote IDs for the week
 * @property {WeeklyAnalysis} analysis - AI analysis
 * @property {BookRecommendation[]} recommendations - Book recommendations from Anna
 * @property {PromoCode} promoCode - Promo code for the week
 * @property {ReportFeedback} [feedback] - User feedback
 * @property {Date} sentAt - When report was sent
 * @property {boolean} isRead - Whether report was read
 * @property {Date} [readAt] - When report was read
 */

/**
 * @typedef {Object} WeeklyAnalysis
 * @property {string} summary - Brief week summary
 * @property {string[]} dominantThemes - Dominant themes
 * @property {string} emotionalTone - Emotional tone
 * @property {string} insights - Psychological insights from Anna
 */

/**
 * @typedef {Object} BookRecommendation
 * @property {string} title - Book title
 * @property {string} description - Book description
 * @property {string} price - Price
 * @property {string} link - UTM link
 * @property {string} reasoning - Why this book is recommended
 */

/**
 * @typedef {Object} PromoCode
 * @property {string} code - Promo code
 * @property {number} discount - Discount percentage
 * @property {Date} validUntil - Valid until date
 */

/**
 * @typedef {Object} ReportFeedback
 * @property {number} rating - Rating from 1-5 (5=excellent, 4=good, 2=bad)
 * @property {string} [comment] - Optional detailed feedback
 * @property {Date} respondedAt - When feedback was given
 */

/**
 * @typedef {Object} MonthlyReport
 * @property {string} userId - User ID
 * @property {number} month - Month number
 * @property {number} year - Year
 * @property {AdditionalSurvey} additionalSurvey - Additional survey for accuracy
 * @property {MonthlyAnalysis} analysis - Deep psychological analysis
 * @property {Date} sentAt - When report was sent
 * @property {SpecialOffer} specialOffer - Special offer with 25% discount
 * @property {ReportFeedback} [feedback] - User feedback
 */

/**
 * @typedef {Object} AdditionalSurvey
 * @property {string} mainTheme - Main theme of the month
 * @property {string} [mood] - How did you feel this month?
 * @property {number} [satisfaction] - Satisfaction rating (1-5)
 * @property {string[]} [responses] - Additional survey responses
 * @property {Date} respondedAt - When survey was completed
 */

/**
 * @typedef {Object} MonthlyAnalysis
 * @property {string} psychologicalProfile - Detailed personality analysis
 * @property {string} personalGrowth - Growth and changes analysis for the month
 * @property {string} recommendations - Personal recommendations from psychologist
 * @property {string[]} bookSuggestions - Suggested books
 */

/**
 * @typedef {Object} SpecialOffer
 * @property {number} discount - Discount percentage (25%)
 * @property {Date} validUntil - Valid until date (7 days)
 * @property {string[]} books - Books included in the offer
 */

/**
 * @typedef {Object} Achievement
 * @property {string} id - Unique achievement ID
 * @property {string} name - Achievement name
 * @property {string} description - Achievement description
 * @property {string} icon - Achievement emoji
 * @property {number} targetValue - Target value for achievement
 * @property {string} type - Achievement type (quotes_count, streak_days, author_variety)
 */

/**
 * @typedef {Object} UserAchievement
 * @property {string} achievementId - Achievement ID
 * @property {Date} unlockedAt - When achievement was unlocked
 */

module.exports = {
  ONBOARDING_STATES,
  QUOTE_CATEGORIES,
  TRAFFIC_SOURCES
};
