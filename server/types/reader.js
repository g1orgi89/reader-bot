/**
 * @fileoverview Shared types for Reader Bot - Anna Busel's quote collection project
 * @module server/types/reader
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} userId - Telegram user ID
 * @property {string} telegramUsername - @username (auto-detected)
 * @property {string} name - User's name from test question 1
 * @property {string} email - REQUIRED after test completion
 * @property {TestResults} testResults - Answers to 7 onboarding questions
 * @property {string} source - Traffic source (Instagram/Telegram/YouTube/Threads/Друзья/Другое)
 * @property {UserPreferences} preferences - AI-analyzed preferences
 * @property {Date} registeredAt - Registration date
 * @property {boolean} isOnboardingComplete - Onboarding completion status
 */

/**
 * @typedef {Object} TestResults
 * @property {string} name - How are you called?
 * @property {string} lifestyle - About yourself (mom/married/single)
 * @property {string} timeForSelf - How do you find time for yourself?
 * @property {string} priorities - What's most important right now?
 * @property {string} readingFeelings - What do you feel when reading books?
 * @property {string} closestPhrase - Which phrase is closer to you?
 * @property {string} readingTime - How much time do you spend reading per week?
 */

/**
 * @typedef {Object} UserPreferences
 * @property {string[]} mainThemes - AI-analyzed interests
 * @property {string} personalityType - Personality type from test
 * @property {string} recommendationStyle - Style of recommendations
 */

/**
 * @typedef {Object} Quote
 * @property {string} userId - User ID
 * @property {string} text - Quote text
 * @property {string} [author] - Quote author
 * @property {string} [source] - Book source
 * @property {string} category - AI-determined category
 * @property {number} weekNumber - Week number of the year
 * @property {number} monthNumber - Month number
 * @property {Date} createdAt - Creation date
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
 * @property {Date} sentAt - When report was sent
 * @property {boolean} isRead - Whether report was read
 */

/**
 * @typedef {Object} WeeklyAnalysis
 * @property {string} summary - Brief week summary
 * @property {string[]} dominantThemes - Dominant themes
 * @property {string} emotionalTone - Emotional tone
 * @property {string} insights - Psychological insights from Anna
 * @property {string} personalGrowth - Personal growth observations
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
 * @property {string} description - Promo code description
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
 */

/**
 * @typedef {Object} AdditionalSurvey
 * @property {string} mainTheme - Main theme of the month
 * @property {string} mood - How did you feel this month?
 * @property {number} satisfaction - Satisfaction rating (1-5)
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
 * @typedef {Object} UserStatistics
 * @property {number} totalQuotes - Total quotes collected
 * @property {number} currentStreak - Current daily streak
 * @property {number} longestStreak - Longest daily streak
 * @property {string[]} favoriteAuthors - Favorite authors
 * @property {MonthlyQuoteCount[]} monthlyQuotes - Monthly quote counts
 */

/**
 * @typedef {Object} MonthlyQuoteCount
 * @property {number} month - Month number
 * @property {number} year - Year
 * @property {number} count - Quote count for the month
 */

module.exports = {
  // This file contains JSDoc type definitions only
  // No actual exports needed - types are used for documentation
};