/**
 * Language detection service
 * @file server/services/languageDetect.js
 */

/**
 * @typedef {import('../types').SupportedLanguages} SupportedLanguages
 */

const { SUPPORTED_LANGUAGES } = require('../types');

/**
 * @class LanguageDetectService
 * @description Сервис для определения языка сообщений
 */
class LanguageDetectService {
  constructor() {
    // Ключевые слова для каждого языка
    this.languageKeywords = {
      [SUPPORTED_LANGUAGES.EN]: [
        'hello', 'hi', 'help', 'please', 'wallet', 'connect', 'error', 'issue', 'problem',
        'token', 'stake', 'farm', 'harvest', 'support', 'deposit', 'withdraw'
      ],
      [SUPPORTED_LANGUAGES.ES]: [
        'hola', 'ayuda', 'por favor', 'billetera', 'conectar', 'error', 'problema',
        'token', 'apostar', 'cultivar', 'cosechar', 'soporte', 'deposito', 'retirar'
      ],
      [SUPPORTED_LANGUAGES.RU]: [
        'привет', 'помощь', 'пожалуйста', 'кошелек', 'подключить', 'ошибка', 'проблема',
        'токен', 'стейк', 'фарм', 'урожай', 'поддержка', 'депозит', 'вывод'
      ]
    };
    
    // Общие паттерны для языков
    this.languagePatterns = {
      [SUPPORTED_LANGUAGES.EN]: /^[a-zA-Z\s\d\.,!?'"()-]+$/,
      [SUPPORTED_LANGUAGES.ES]: /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s\d\.,!?'"()-]+$/,
      [SUPPORTED_LANGUAGES.RU]: /^[а-яА-ЯёЁ\s\d\.,!?'"()-]+$/
    };
  }

  /**
   * Определяет язык сообщения
   * @param {string} text - Текст для анализа
   * @returns {string} Код языка (en, es, ru)
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      return SUPPORTED_LANGUAGES.EN; // По умолчанию английский
    }
    
    const normalizedText = text.toLowerCase().trim();
    
    // Проверяем на наличие ключевых слов
    const scores = {};
    
    Object.entries(this.languageKeywords).forEach(([lang, keywords]) => {
      scores[lang] = 0;
      keywords.forEach(keyword => {
        if (normalizedText.includes(keyword)) {
          scores[lang]++;
        }
      });
    });
    
    // Находим язык с наибольшим количеством совпадений
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      return Object.keys(scores).find(lang => scores[lang] === maxScore);
    }
    
    // Проверяем по паттернам символов
    for (const [lang, pattern] of Object.entries(this.languagePatterns)) {
      if (pattern.test(normalizedText)) {
        // Дополнительная проверка на кириллицу для русского
        if (lang === SUPPORTED_LANGUAGES.RU && /[а-яё]/i.test(normalizedText)) {
          return SUPPORTED_LANGUAGES.RU;
        }
        // Дополнительная проверка на испанские символы
        if (lang === SUPPORTED_LANGUAGES.ES && /[áéíóúüñ]/i.test(normalizedText)) {
          return SUPPORTED_LANGUAGES.ES;
        }
      }
    }
    
    // По умолчанию возвращаем английский
    return SUPPORTED_LANGUAGES.EN;
  }

  /**
   * Проверяет, поддерживается ли язык
   * @param {string} language - Код языка
   * @returns {boolean} Поддерживается ли язык
   */
  isLanguageSupported(language) {
    return Object.values(SUPPORTED_LANGUAGES).includes(language);
  }

  /**
   * Получает список поддерживаемых языков
   * @returns {string[]} Массив кодов языков
   */
  getSupportedLanguages() {
    return Object.values(SUPPORTED_LANGUAGES);
  }
}

// Экспорт экземпляра сервиса
module.exports = new LanguageDetectService();