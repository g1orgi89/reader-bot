/**
 * @file Language and document constants
 * @description Constants for supported languages, document categories and file types
 */

/**
 * Supported languages in the application
 * Note: System now supports auto-detection and universal language handling
 * @readonly
 * @enum {string}
 */
const SUPPORTED_LANGUAGES = {
  AUTO: 'auto',
  UNIVERSAL: 'universal',
  ENGLISH: 'en',
  SPANISH: 'es',
  RUSSIAN: 'ru',
  FRENCH: 'fr',
  GERMAN: 'de',
  CHINESE: 'zh',
  JAPANESE: 'ja'
};

/**
 * Legacy language support for backward compatibility
 * @readonly
 * @enum {string}
 * @deprecated Use SUPPORTED_LANGUAGES instead
 */
const LEGACY_LANGUAGES = {
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
  TROUBLESHOOTING: 'troubleshooting',
  PROMPTS: 'prompts',
  TELEGRAM: 'telegram'
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

/**
 * Check if a language is supported
 * @param {string} language - Language code to check
 * @returns {boolean} True if language is supported
 */
function isLanguageSupported(language) {
  return Object.values(SUPPORTED_LANGUAGES).includes(language);
}

/**
 * Get default language for new documents
 * @returns {string} Default language code
 */
function getDefaultLanguage() {
  return SUPPORTED_LANGUAGES.AUTO;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  LEGACY_LANGUAGES,
  DOCUMENT_CATEGORIES,
  SUPPORTED_FILE_TYPES,
  isLanguageSupported,
  getDefaultLanguage
};