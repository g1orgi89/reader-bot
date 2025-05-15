/**
 * Сервис для определения языка текста
 * @file server/services/languageDetect.js
 */

const logger = require('../utils/logger');

/**
 * @class LanguageDetectService
 * @description Сервис для определения языка текста
 */
class LanguageDetectService {
  constructor() {
    // Ключевые слова для определения языков
    this.languagePatterns = {
      // Русский язык
      ru: {
        keywords: [
          'привет', 'здравствуйте', 'спасибо', 'пожалуйста', 'помогите',
          'как', 'что', 'где', 'когда', 'почему', 'кто', 'токен', 'кошелек',
          'блокчейн', 'грибы', 'проблема', 'ошибка', 'не работает', 'подключить',
          'стейкинг', 'фарминг', 'ликвидность'
        ],
        alphabet: /[а-яё]/i
      },
      
      // Испанский язык
      es: {
        keywords: [
          'hola', 'gracias', 'por favor', 'ayuda', 'como', 'que', 'donde',
          'cuando', 'porque', 'quien', 'token', 'billetera', 'blockchain',
          'hongos', 'problema', 'error', 'no funciona', 'conectar',
          'staking', 'farming', 'liquidez'
        ],
        alphabet: /[áéíóúüñ]/i
      },
      
      // Английский язык (по умолчанию)
      en: {
        keywords: [
          'hello', 'hi', 'thanks', 'please', 'help', 'how', 'what', 'where',
          'when', 'why', 'who', 'token', 'wallet', 'blockchain', 'mushrooms',
          'problem', 'error', 'not working', 'connect', 'staking', 'farming',
          'liquidity'
        ],
        alphabet: /[a-z]/i
      }
    };
  }

  /**
   * Определяет язык текста
   * @param {string} text - Текст для анализа
   * @returns {string} Код языка (en, es, ru)
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      logger.warn('Invalid text provided for language detection');
      return 'en'; // По умолчанию английский
    }

    const normalizedText = text.toLowerCase().trim();
    
    // Если текст очень короткий (меньше 3 символов), возвращаем английский
    if (normalizedText.length < 3) {
      return 'en';
    }

    const scores = {
      en: 0,
      es: 0,
      ru: 0
    };

    // Анализ по ключевым словам
    Object.keys(this.languagePatterns).forEach(lang => {
      const pattern = this.languagePatterns[lang];
      
      // Проверяем наличие ключевых слов
      pattern.keywords.forEach(keyword => {
        if (normalizedText.includes(keyword)) {
          scores[lang] += 2; // Высокий вес для ключевых слов
        }
      });
      
      // Проверяем наличие специфичных для языка символов
      const alphabetMatches = normalizedText.match(pattern.alphabet);
      if (alphabetMatches) {
        scores[lang] += alphabetMatches.length * 0.1;
      }
    });

    // Дополнительные правила для русского языка
    if (/[а-яё]/i.test(normalizedText)) {
      scores.ru += 5;
    }

    // Дополнительные правила для испанского языка
    if (/[ñáéíóúü]/i.test(normalizedText)) {
      scores.es += 3;
    }

    // Специфичные паттерны для каждого языка
    const russianPatterns = [
      /\b(как|что|где|когда|почему|кто)\b/i,
      /\b(не|нет|да)\b/i,
      /\b(и|или|но|а)\b/i
    ];

    const spanishPatterns = [
      /\b(como|que|donde|cuando|porque|quien)\b/i,
      /\b(no|si|y|o|pero)\b/i,
      /\b(el|la|los|las|un|una)\b/i
    ];

    const englishPatterns = [
      /\b(how|what|where|when|why|who)\b/i,
      /\b(the|a|an|and|or|but)\b/i,
      /\b(is|are|was|were|have|has)\b/i
    ];

    // Проверяем специфичные паттерны
    russianPatterns.forEach(pattern => {
      if (pattern.test(normalizedText)) {
        scores.ru += 1;
      }
    });

    spanishPatterns.forEach(pattern => {
      if (pattern.test(normalizedText)) {
        scores.es += 1;
      }
    });

    englishPatterns.forEach(pattern => {
      if (pattern.test(normalizedText)) {
        scores.en += 1;
      }
    });

    // Определяем язык с наивысшим счетом
    const detectedLanguage = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );

    // Если все счета равны нулю или очень низкие, возвращаем английский
    if (scores[detectedLanguage] < 0.5) {
      logger.info(`Language detection uncertain for text: "${text.substring(0, 50)}...", defaulting to English`);
      return 'en';
    }

    logger.info(`Detected language: ${detectedLanguage} for text: "${text.substring(0, 50)}..." (scores: ${JSON.stringify(scores)})`);
    return detectedLanguage;
  }

  /**
   * Проверяет, поддерживается ли язык
   * @param {string} languageCode - Код языка
   * @returns {boolean} Поддерживается ли язык
   */
  isLanguageSupported(languageCode) {
    return ['en', 'es', 'ru'].includes(languageCode);
  }

  /**
   * Получает список поддерживаемых языков
   * @returns {Object} Объект с информацией о поддерживаемых языках
   */
  getSupportedLanguages() {
    return {
      en: {
        name: 'English',
        nativeName: 'English',
        code: 'en'
      },
      es: {
        name: 'Spanish',
        nativeName: 'Español',
        code: 'es'
      },
      ru: {
        name: 'Russian',
        nativeName: 'Русский',
        code: 'ru'
      }
    };
  }

  /**
   * Получает название языка по коду
   * @param {string} languageCode - Код языка
   * @param {boolean} [native=false] - Возвращать ли название на родном языке
   * @returns {string} Название языка
   */
  getLanguageName(languageCode, native = false) {
    const languages = this.getSupportedLanguages();
    const language = languages[languageCode];
    
    if (!language) {
      return 'Unknown';
    }
    
    return native ? language.nativeName : language.name;
  }

  /**
   * Анализирует надежность определения языка
   * @param {string} text - Текст для анализа
   * @returns {Object} Объект с информацией о надежности
   */
  getDetectionConfidence(text) {
    if (!text || typeof text !== 'string') {
      return {
        language: 'en',
        confidence: 0,
        reliable: false
      };
    }

    const normalizedText = text.toLowerCase().trim();
    const wordCount = normalizedText.split(/\s+/).length;
    
    // Базовая оценка надежности
    let confidence = 0;
    
    // Длина текста влияет на надежность
    if (normalizedText.length > 50) confidence += 0.3;
    if (normalizedText.length > 100) confidence += 0.3;
    
    // Количество слов влияет на надежность
    if (wordCount > 5) confidence += 0.2;
    if (wordCount > 10) confidence += 0.2;
    
    const detectedLanguage = this.detectLanguage(text);
    
    // Проверяем наличие специфичных символов
    if (detectedLanguage === 'ru' && /[а-яё]/i.test(normalizedText)) {
      confidence += 0.5;
    } else if (detectedLanguage === 'es' && /[ñáéíóúü]/i.test(normalizedText)) {
      confidence += 0.4;
    }
    
    // Максимальная уверенность 1.0
    confidence = Math.min(confidence, 1.0);
    
    return {
      language: detectedLanguage,
      confidence: Math.round(confidence * 100) / 100,
      reliable: confidence > 0.7,
      wordCount,
      textLength: normalizedText.length
    };
  }
}

// Экспорт экземпляра сервиса
module.exports = new LanguageDetectService();