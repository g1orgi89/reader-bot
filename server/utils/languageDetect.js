/**
 * Simple language detection utility
 * @file server/utils/languageDetect.js
 */

/**
 * Detect language based on simple heuristics
 * @param {string} text - Text to analyze
 * @returns {string} Detected language code (en, es, ru)
 */
function detect(text) {
  if (!text || typeof text !== 'string') {
    return 'en'; // Default to English
  }

  const cleanText = text.toLowerCase();

  // Russian: Look for Cyrillic characters
  if (/[а-яё]/i.test(cleanText)) {
    return 'ru';
  }

  // Spanish: Look for Spanish-specific patterns
  const spanishPatterns = [
    /\b(el|la|los|las|de|en|y|a|que|es|se|no|te|le|da|su|por|son|con|para|una|vez|uno|dos|tres|como|pero|todo|bien|cada|mismo|gran|bajo|país|vida|estado|otro|hace|ser|cuando|usar|trabajo|gobierno|último|mundo|sobre|año|puede|después|primera|entre|nacional|donde|siguiente|parte|general|nuevo|estos|estas|tanto|menos|social|segundo|también|conocer|agua|punto|siempre|durante|todos|algo|ello|tiempo|ella|lugar|mejor|aquí|quien|ese|estar|algunos|qué|mientras|esa)\b/i
  ];

  for (const pattern of spanishPatterns) {
    if (pattern.test(cleanText)) {
      return 'es';
    }
  }

  // Default to English for any other case
  return 'en';
}

module.exports = {
  detect
};