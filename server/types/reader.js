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
 * @property {UserPreferences} preferences - AI-analyzed preferences from