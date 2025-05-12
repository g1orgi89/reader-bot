/**
 * Language detection utility for Shrooms Support Bot
 * @file server/utils/languageDetect.js
 */

/**
 * Simple language detection utility
 */
class LanguageDetector {
  constructor() {
    // Language patterns and keywords
    this.patterns = {
      en: {
        keywords: [
          'hello', 'hi', 'hey', 'how', 'what', 'when', 'where', 'why', 'who', 'could', 'should', 'would',
          'please', 'thank', 'thanks', 'sorry', 'help', 'support', 'issue', 'problem', 'error',
          'token', 'wallet', 'connect', 'balance', 'transaction', 'farming', 'staking', 'shrooms'
        ],
        common: [
          'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
          'from', 'into', 'onto', 'upon', 'below', 'under', 'above', 'over', 'across', 'through'
        ]
      },
      es: {
        keywords: [
          'hola', 'buenos', 'días', 'tardes', 'noches', 'cómo', 'qué', 'cuándo', 'dónde', 'por', 'para',
          'por favor', 'gracias', 'perdón', 'ayuda', 'soporte', 'problema', 'error',
          'token', 'cartera', 'conectar', 'saldo', 'transacción', 'cultivo', 'staking', 'shrooms'
        ],
        common: [
          'el', 'la', 'los', 'las', 'un', 'una', 'de', 'en', 'a', 'con', 'por', 'para',
          'es', 'son', 'está', 'están', 'ser', 'estar', 'haber', 'tener', 'hacer', 'decir'
        ]
      },
      ru: {
        keywords: [
          'привет', 'здравствуйте', 'как', 'что', 'когда', 'где', 'зачем', 'почему', 'кто',
          'пожалуйста', 'спасибо', 'извините', 'помощь', 'поддержка', 'проблема', 'ошибка',
          'токен', 'кошелек', 'подключить', 'баланс', 'транзакция', 'фарминг', 'стейкинг', 'шрумс'
        ],
        common: [
          'и', 'в', 'не', 'на', 'с', 'по', 'для', 'за', 'о', 'об', 'от', 'к',
          'у', 'до', 'из', 'без', 'под', 'над', 'через', 'между', 'при', 'про'
        ]
      }
    };

    // Character set patterns
    this.characterSets = {
      cyrillic: /[\u0400-\u04FF]/,
      latin: /[a-zA-Z]/,
      spanish: /[ñáéíóúü]/,
      punctuation: /[¿¡]/
    };
  }

  /**
   * Detect language from text
   * @param {string} text - Text to analyze
   * @param {string} [fallback='en'] - Fallback language if detection fails
   * @returns {string} Detected language code (en, es, ru)
   */
  detectLanguage(text, fallback = 'en') {
    if (!text || typeof text !== 'string') {
      return fallback;
    }

    // Clean and normalize text
    const cleanText = text.toLowerCase().trim();
    
    // Quick check for Cyrillic characters (Russian)
    if (this.characterSets.cyrillic.test(text)) {
      return 'ru';
    }
    
    // Check for Spanish-specific characters or punctuation
    if (this.characterSets.spanish.test(text) || this.characterSets.punctuation.test(text)) {
      return 'es';
    }
    
    // Count language-specific keywords
    const scores = {
      en: 0,
      es: 0,
      ru: 0
    };
    
    // Score based on keywords
    Object.keys(this.patterns).forEach(lang => {
      const keywords = this.patterns[lang].keywords;
      const common = this.patterns[lang].common;
      
      keywords.forEach(keyword => {
        if (cleanText.includes(keyword)) {
          scores[lang] += 3; // Higher weight for specific keywords
        }
      });
      
      common.forEach(word => {
        if (cleanText.includes(word)) {
          scores[lang] += 1; // Lower weight for common words
        }
      });
    });
    
    // Find the language with the highest score
    const detectedLanguage = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );
    
    // Only return detected language if it has a reasonable score
    if (scores[detectedLanguage] > 0) {
      return detectedLanguage;
    }
    
    return fallback;
  }

  /**
   * Validate if a language code is supported
   * @param {string} langCode - Language code to validate
   * @returns {boolean} Whether the language is supported
   */
  isLanguageSupported(langCode) {
    return ['en', 'es', 'ru'].includes(langCode);
  }

  /**
   * Get language from browser language code
   * @param {string} browserLang - Browser language code (e.g., 'en-US', 'es-ES')
   * @returns {string} Simplified language code (en, es, ru)
   */
  getLanguageFromBrowserCode(browserLang) {
    if (!browserLang || typeof browserLang !== 'string') {
      return 'en';
    }
    
    const lang = browserLang.split('-')[0].toLowerCase();
    
    if (this.isLanguageSupported(lang)) {
      return lang;
    }
    
    return 'en';
  }

  /**
   * Get language display name
   * @param {string} langCode - Language code
   * @returns {string} Display name of the language
   */
  getLanguageName(langCode) {
    const names = {
      en: 'English',
      es: 'Español',
      ru: 'Русский'
    };
    
    return names[langCode] || 'English';
  }

  /**
   * Get language flag emoji
   * @param {string} langCode - Language code
   * @returns {string} Flag emoji
   */
  getLanguageFlag(langCode) {
    const flags = {
      en: '🇺🇸',
      es: '🇪🇸',
      ru: '🇷🇺'
    };
    
    return flags[langCode] || '🇺🇸';
  }

  /**
   * Detect and validate language from multiple sources
   * @param {Object} options - Options for language detection
   * @param {string} [options.text] - Text to analyze
   * @param {string} [options.browserLang] - Browser language
   * @param {string} [options.userPreference] - User's preferred language
   * @param {string} [options.fallback='en'] - Fallback language
   * @returns {string} Best guess for user's language
   */
  getBestLanguageGuess(options = {}) {
    const {
      text,
      browserLang,
      userPreference,
      fallback = 'en'
    } = options;
    
    // Priority 1: User's explicit preference
    if (userPreference && this.isLanguageSupported(userPreference)) {
      return userPreference;
    }
    
    // Priority 2: Language detected from text
    if (text) {
      const textLang = this.detectLanguage(text, null);
      if (textLang && textLang !== fallback) {
        return textLang;
      }
    }
    
    // Priority 3: Browser language
    if (browserLang) {
      const browserLangCode = this.getLanguageFromBrowserCode(browserLang);
      if (browserLangCode !== 'en' || !text) {
        return browserLangCode;
      }
    }
    
    // Default fallback
    return fallback;
  }
}

// Export singleton instance
module.exports = new LanguageDetector();
