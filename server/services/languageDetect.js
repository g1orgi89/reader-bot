/**
 * Сервис для определения языка текста
 * @file server/services/languageDetect.js
 */

const logger = require('../utils/logger');

/**
 * @class LanguageDetectService
 * @description Сервис для определения языка сообщений пользователей
 */
class LanguageDetectService {
  constructor() {
    // Словари ключевых слов для каждого поддерживаемого языка
    this.languageDictionaries = {
      en: {
        keywords: [
          'the', 'and', 'you', 'that', 'was', 'for', 'are', 'with', 'his', 'they',
          'hello', 'help', 'what', 'how', 'when', 'where', 'why', 'can', 'could',
          'wallet', 'connect', 'token', 'farming', 'staking', 'bitcoin', 'crypto'
        ],
        patterns: [
          /\bis\b/gi, /\bare\b/gi, /\bthe\b/gi, /\band\b/gi, /\bcan\b/gi,
          /\bhow\s+to\b/gi, /\bwhat\s+is\b/gi, /\bi\s+need\b/gi
        ]
      },
      es: {
        keywords: [
          'el', 'la', 'de', 'que', 'y', 'en', 'con', 'no', 'te', 'lo',
          'hola', 'ayuda', 'qué', 'cómo', 'cuándo', 'dónde', 'por', 'puedo', 'podría',
          'billetera', 'conectar', 'token', 'cultivo', 'apuesta', 'bitcoin', 'cripto'
        ],
        patterns: [
          /\bes\b/gi, /\bson\b/gi, /\bel\b/gi, /\bla\b/gi, /\bde\b/gi,
          /\bcómo\s+puedo\b/gi, /\bqué\s+es\b/gi, /\bnecesito\b/gi
        ]
      },
      ru: {
        keywords: [
          'и', 'в', 'не', 'что', 'он', 'на', 'я', 'с', 'как', 'а',
          'привет', 'помощь', 'что', 'как', 'когда', 'где', 'почему', 'могу', 'можно',
          'кошелек', 'подключить', 'токен', 'фарминг', 'стейкинг', 'биткоин', 'крипто'
        ],
        patterns: [
          /\bэто\b/gi, /\bесть\b/gi, /\bтот\b/gi, /\bкак\b/gi, /\bчто\b/gi,
          /\bкак\s+можно\b/gi, /\bчто\s+такое\b/gi, /\bмне\s+нужно\b/gi
        ]
      }
    };
    
    // Пороги уверенности для определения языка
    this.confidenceThreshold = 0.3;
    this.defaultLanguage = 'en';
  }

  /**
   * Определяет язык текста
   * @param {string} text - Текст для анализа
   * @returns {string} Код языка (en, es, ru)
   */
  detectLanguage(text) {
    try {
      if (!text || typeof text !== 'string') {
        logger.warn('Invalid text for language detection');
        return this.defaultLanguage;
      }

      // Очистка и подготовка текста
      const cleanText = this.normalizeText(text);
      
      if (cleanText.length < 3) {
        return this.defaultLanguage;
      }

      // Подсчет совпадений для каждого языка
      const scores = {};
      
      for (const [lang, dictionary] of Object.entries(this.languageDictionaries)) {
        scores[lang] = this.calculateLanguageScore(cleanText, dictionary);
      }

      // Определение языка с наивысшим счетом
      const detectedLanguage = this.selectBestLanguage(scores);
      
      logger.info(`Language detected: ${detectedLanguage} for text: "${text.substring(0, 50)}..."`);
      
      return detectedLanguage;
    } catch (error) {
      logger.error('Language detection error:', error.message);
      return this.defaultLanguage;
    }
  }

  /**
   * Нормализует текст для анализа
   * @param {string} text - Исходный текст
   * @returns {string} Нормализованный текст
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF\u0400-\u04FF]/g, ' ') // Убираем знаки препинания, оставляем диакритики и кириллицу
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Вычисляет счет для языка
   * @param {string} text - Нормализованный текст
   * @param {Object} dictionary - Словарь языка
   * @returns {number} Счет языка
   */
  calculateLanguageScore(text, dictionary) {
    let score = 0;
    const words = text.split(/\s+/);
    const totalWords = words.length;

    // Проверка ключевых слов
    let keywordMatches = 0;
    for (const keyword of dictionary.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = (text.match(regex) || []).length;
      keywordMatches += matches;
    }

    // Проверка паттернов
    let patternMatches = 0;
    for (const pattern of dictionary.patterns) {
      const matches = (text.match(pattern) || []).length;
      patternMatches += matches;
    }

    // Вычисление итогового счета
    score = (keywordMatches * 2 + patternMatches) / Math.max(totalWords, 1);
    
    return score;
  }

  /**
   * Выбирает язык с наивысшим счетом
   * @param {Object} scores - Счета для каждого языка
   * @returns {string} Код определенного языка
   */
  selectBestLanguage(scores) {
    let bestLanguage = this.defaultLanguage;
    let maxScore = 0;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore && score >= this.confidenceThreshold) {
        maxScore = score;
        bestLanguage = lang;
      }
    }

    // Дополнительные эвристики для повышения точности
    if (maxScore < this.confidenceThreshold) {
      // Если уверенность низкая, используем дополнительные проверки
      bestLanguage = this.performAdditionalChecks(scores);
    }

    return bestLanguage;
  }

  /**
   * Выполняет дополнительные проверки для определения языка
   * @param {Object} scores - Счета для каждого языка
   * @returns {string} Код языка
   */
  performAdditionalChecks(scores) {
    // Если есть хотя бы минимальное совпадение с русским, предпочитаем его
    // (так как кириллица явно указывает на русский)
    if (scores.ru > 0) {
      return 'ru';
    }

    // Между английским и испанским выбираем тот, у кого выше счет
    if (scores.es > scores.en) {
      return 'es';
    }

    return this.defaultLanguage;
  }

  /**
   * Проверяет, является ли язык поддерживаемым
   * @param {string} languageCode - Код языка
   * @returns {boolean} Поддерживается ли язык
   */
  isSupportedLanguage(languageCode) {
    return ['en', 'es', 'ru'].includes(languageCode);
  }

  /**
   * Возвращает список поддерживаемых языков
   * @returns {string[]} Массив кодов поддерживаемых языков
   */
  getSupportedLanguages() {
    return Object.keys(this.languageDictionaries);
  }

  /**
   * Определяет язык на основе заголовков HTTP (Accept-Language)
   * @param {string} acceptLanguageHeader - Заголовок Accept-Language
   * @returns {string} Код языка
   */
  detectFromHeader(acceptLanguageHeader) {
    if (!acceptLanguageHeader) {
      return this.defaultLanguage;
    }

    try {
      // Парсим заголовок Accept-Language
      const languages = acceptLanguageHeader
        .split(',')
        .map(lang => {
          const parts = lang.trim().split(';');
          const code = parts[0].split('-')[0].toLowerCase();
          const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1.0;
          return { code, quality };
        })
        .sort((a, b) => b.quality - a.quality);

      // Найти первый поддерживаемый язык
      for (const lang of languages) {
        if (this.isSupportedLanguage(lang.code)) {
          return lang.code;
        }
      }
    } catch (error) {
      logger.warn('Error parsing Accept-Language header:', error.message);
    }

    return this.defaultLanguage;
  }

  /**
   * Получает статистику работы сервиса
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      supportedLanguages: this.getSupportedLanguages(),
      defaultLanguage: this.defaultLanguage,
      confidenceThreshold: this.confidenceThreshold,
      totalKeywords: Object.values(this.languageDictionaries)
        .reduce((sum, dict) => sum + dict.keywords.length, 0),
      totalPatterns: Object.values(this.languageDictionaries)
        .reduce((sum, dict) => sum + dict.patterns.length, 0)
    };
  }
}

// Экспорт экземпляра сервиса
module.exports = new LanguageDetectService();