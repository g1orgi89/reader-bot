/**
 * @file Language and document constants
 * @description Constants for supported languages, document categories and file types
 */

/**
 * Supported languages in the application
 * @readonly
 * @enum {string}
 */
const SUPPORTED_LANGUAGES = {
  ENGLISH: 'en',
  SPANISH: 'es',
  RUSSIAN: 'ru'
};

/**
 * Document categories for knowledge base
 * @readonly
 * @enum {string}
 */
const DOCUMENT_CATEGORIES = {
  GENERAL: 'general',
  USER_GUIDE: 'user-guide',
  TOKENOMICS: 'tokenomics',
  TECHNICAL: 'technical',
  TROUBLESHOOTING: 'troubleshooting'
};

/**
 * Supported file types for upload
 * @readonly
 * @enum {string}
 */
const SUPPORTED_FILE_TYPES = {
  TEXT: '.txt',
  MARKDOWN: '.md',
  PDF: '.pdf',
  CSV: '.csv'
};

module.exports = {
  SUPPORTED_LANGUAGES,
  DOCUMENT_CATEGORIES,
  SUPPORTED_FILE_TYPES
};
