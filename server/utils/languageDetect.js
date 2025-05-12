/**
 * Language detection utility
 * @file server/utils/languageDetect.js
 */

// Import types for JSDoc
require('../types');

/**
 * Language patterns for simple detection
 */
const LANGUAGE_PATTERNS = {
  en: {
    patterns: [
      /\b(the|and|of|to|in|is|for|with|on|at|from|by|as|or|but|this|that|a|an)\b/gi,
      /\b(how|what|when|where|why|which|who|can|could|would|should|will)\b/gi,
      /\b(hello|hi|help|please|thank|thanks|sorry)\b/gi
    ],
    stopWords: ['the', 'and', 'of', 'to', 'in', 'is', 'for', 'with']
  },
  es: {
    patterns: [
      /\b(el|la|de|en|y|a|que|es|por|para|con|su|se|del|al|un|una|lo)\b/gi,
      /\b(como|que|cuando|donde|por|porque|quien|cual|puede|podria|seria|debe)\b/gi,
      /\b(hola|ayuda|ayudar|por favor|gracias|perdon|disculpe)\b/gi
    ],
    stopWords: ['el', 'la', 'de', 'en', 'y', 'a', 'que', 'es']
  },
  ru: {
    patterns: [
      /\b(в|и|на|с|по|от|за|к|из|для|о|об|при|у|до|без|через|со|под|над)\b/gi,
      /\b(как|что|когда|где|почему|который|кто|может|мог|должен|будет|есть)\b/gi,
      /\b(привет|помощь|помогите|пожалуйста|спасибо|извините|простите)\b/gi
    ],
    stopWords: ['в', 'и', 'на', 'с', 'по', 'от', 'за', 'к']
  }
};

/**
 * Detect language from text using pattern matching
 * @param {string} text - Text to analyze
 * @returns {Language} Detected language (en, es, or ru)
 */
function detect(text) {
  if (!text || typeof text !== 'string') {
    return 'en'; // Default to English for invalid input
  }

  // Normalize text: lowercase and remove extra whitespace
  const normalizedText = text.toLowerCase().trim();
  
  // If text is too short, default to English
  if (normalizedText.length < 10) {
    return 'en';
  }

  // Count matches for each language
  const scores = {
    en: 0,
    es: 0,
    ru: 0
  };

  // Check each language pattern
  for (const [language, config] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of config.patterns) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        scores[language] += matches.length;
      }
    }
    
    // Bonus points for stop words
    for (const stopWord of config.stopWords) {
      const regex = new RegExp(`\\b${stopWord}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        scores[language] += matches.length * 2; // Double weight for stop words
      }
    }
  }

  // Additional checks for Cyrillic (Russian)
  const cyrillicRegex = /[а-яё]/gi;
  const cyrillicMatches = normalizedText.match(cyrillicRegex);
  if (cyrillicMatches && cyrillicMatches.length > normalizedText.length * 0.3) {
    scores.ru += 10; // Strong bonus for Cyrillic script
  }

  // Additional checks for Spanish
  const spanishSpecialChars = /[ñáéíóúü]/gi;
  const spanishMatches = normalizedText.match(spanishSpecialChars);
  if (spanishMatches) {
    scores.es += spanishMatches.length * 2;
  }

  // Find the language with the highest score
  let detectedLanguage = 'en';
  let maxScore = scores.en;

  for (const [language, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLanguage = language;
    }
  }

  // Fallback to English if no clear winner
  return maxScore > 0 ? detectedLanguage : 'en';
}

/**
 * Get confidence score for language detection
 * @param {string} text - Text to analyze
 * @param {Language} language - Language to check confidence for
 * @returns {number} Confidence score (0-1)
 */
function getConfidence(text, language) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const normalizedText = text.toLowerCase().trim();
  
  if (normalizedText.length < 10) {
    return language === 'en' ? 0.5 : 0; // Default to English for short text
  }

  const config = LANGUAGE_PATTERNS[language];
  if (!config) {
    return 0;
  }

  let matches = 0;
  let totalPossible = 0;

  // Count pattern matches
  for (const pattern of config.patterns) {
    const found = normalizedText.match(pattern);
    if (found) {
      matches += found.length;
    }
    totalPossible += 3; // Assume max 3 matches per pattern
  }

  // Count stop word matches
  for (const stopWord of config.stopWords) {
    const regex = new RegExp(`\\b${stopWord}\\b`, 'gi');
    const found = normalizedText.match(regex);
    if (found) {
      matches += found.length * 2;
    }
    totalPossible += 4; // Assume max 2 matches per stop word with double weight
  }

  // Calculate confidence as ratio of matches to total possible
  const confidence = Math.min(1, matches / totalPossible);
  
  return confidence;
}

/**
 * Detect multiple languages in text (if mixed language content)
 * @param {string} text - Text to analyze
 * @returns {Object} Object with language scores
 */
function detectMultiple(text) {
  if (!text || typeof text !== 'string') {
    return { en: 1, es: 0, ru: 0 }; // Default to English
  }

  const normalizedText = text.toLowerCase().trim();
  const scores = { en: 0, es: 0, ru: 0 };
  
  // Get raw scores for all languages
  for (const [language, config] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of config.patterns) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        scores[language] += matches.length;
      }
    }
  }

  // Normalize scores to percentages
  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
  if (totalScore === 0) {
    return { en: 1, es: 0, ru: 0 }; // Default to English if no matches
  }

  for (const language in scores) {
    scores[language] = scores[language] / totalScore;
  }

  return scores;
}

/**
 * Check if text is likely to be in a specific language
 * @param {string} text - Text to analyze
 * @param {Language} language - Language to check
 * @param {number} [threshold=0.5] - Confidence threshold (0-1)
 * @returns {boolean} True if text is likely in the specified language
 */
function isLanguage(text, language, threshold = 0.5) {
  return getConfidence(text, language) >= threshold;
}

module.exports = {
  detect,
  getConfidence,
  detectMultiple,
  isLanguage
};
