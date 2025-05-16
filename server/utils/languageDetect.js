/**
 * Улучшенная утилита для определения языка сообщения
 * @file server/utils/languageDetect.js
 */

/**
 * @typedef {string} LanguageCode
 * @description Код языка: 'en', 'ru', 'es'
 */

/**
 * Класс для определения языка сообщения с улучшенной логикой
 */
class LanguageDetector {
  constructor() {
    // Расширенные ключевые слова для каждого языка
    this.languagePatterns = {
      en: {
        keywords: [
          'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'his', 'how', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use',
          'what', 'when', 'where', 'why', 'how', 'which', 'this', 'that', 'these', 'those', 'with', 'have', 'they', 'will', 'from', 'would', 'could', 'should',
          'hello', 'help', 'please', 'thank', 'sorry', 'yes', 'no', 'about', 'tell', 'me', 'more', 'information',
          'wallet', 'token', 'staking', 'farming', 'transaction', 'blockchain', 'crypto', 'shrooms'
        ],
        phrases: [
          'in english', 'tell me', 'what is', 'how to', 'hello', 'thank you', 'please help', 'i need', 'can you',
          'what are', 'where is', 'when will', 'how does', 'how much', 'tell me about'
        ],
        patterns: [
          /\b(what|how|when|where|why|which)\s+(is|are|do|does|can|could|should|would)\b/i,
          /\b(can|could|should|would)\s+\w+/i,
          /\b(i|you|we|they)\s+(am|are|is|was|were|have|had|will|would|could|should)\b/i,
          /\b(tell\s+me|help\s+me|show\s+me)\b/i
        ]
      },
      
      ru: {
        keywords: [
          'что', 'как', 'где', 'когда', 'почему', 'зачем', 'кто', 'куда', 'откуда', 'какой', 'какая', 'какие',
          'и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'из', 'у', 'к', 'о', 'об', 'за', 'под', 'над', 'при', 'без', 'через',
          'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они', 'мне', 'тебе', 'ему', 'ей', 'нам', 'вам', 'им',
          'это', 'этот', 'эта', 'эти', 'тот', 'та', 'те', 'все', 'всё', 'каждый', 'каждая', 'любой',
          'да', 'нет', 'не', 'или', 'если', 'то', 'бы', 'же', 'ли', 'тоже', 'также', 'еще', 'уже',
          'привет', 'помощь', 'спасибо', 'пожалуйста', 'извините', 'здравствуйте', 'пока', 'до свидания',
          'кошелек', 'токен', 'стейкинг', 'фарминг', 'транзакция', 'блокчейн', 'крипта', 'грибы'
        ],
        phrases: [
          'что такое', 'как работает', 'где найти', 'расскажи о', 'помоги мне', 'нужна помощь', 'подскажи',
          'можете помочь', 'не могу понять', 'объясни пожалуйста', 'приветы', 'приветэ'
        ],
        patterns: [
          /[а-яё]/i,
          /\b(что|как|где|когда|почему|зачем)\b/i,
          /\b(может|можно|нужно|надо|должен|должна|хочу|хочется)\b/i,
          /\b(расскажи|помоги|подскажи|объясни)\b/i
        ]
      },
      
      es: {
        keywords: [
          'qué', 'cómo', 'dónde', 'cuándo', 'por qué', 'para qué', 'quién', 'cuál', 'cual', 'como',
          'y', 'en', 'con', 'para', 'por', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
          'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'me', 'te', 'se', 'nos', 'os',
          'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'todo', 'todos', 'todas',
          'sí', 'no', 'o', 'si', 'que', 'pero', 'también', 'muy', 'más', 'menos', 'mucho', 'poco',
          'hola', 'ayuda', 'gracias', 'por favor', 'perdón', 'disculpe', 'hasta luego', 'adiós',
          'billetera', 'cartera', 'token', 'staking', 'farming', 'transacción', 'blockchain', 'crypto', 'hongos'
        ],
        phrases: [
          'qué es', 'cómo funciona', 'dónde está', 'cuéntame sobre', 'ayúdame', 'necesito ayuda', 'puedes ayudar',
          'no entiendo', 'explícame por favor', 'como estas', 'cómo estás', 'que tal', 'hola como estas'
        ],
        patterns: [
          /[ñáéíóúü]/i,
          /\b(qué|cómo|dónde|cuándo|por\s+qué|para\s+qué)\b/i,
          /\b(puede|pueden|necesito|necesita|debo|debe|quiero|quiere)\b/i,
          /\b(ayuda|ayúdame|explica|cuéntame)\b/i,
          /\b(como\s+estas|cómo\s+estás|que\s+tal)\b/i
        ]
      }
    };

    // Кеш языковых предпочтений пользователей
    this.userLanguageCache = new Map();
    this.languageStats = {
      detections: { en: 0, ru: 0, es: 0 },
      totalDetections: 0,
      defaultLanguage: 'en'
    };
  }

  /**
   * Определяет язык сообщения с улучшенной логикой
   * @param {string} message - Текст сообщения
   * @returns {LanguageCode} Код языка
   */
  detect(message) {
    if (!message || typeof message !== 'string') {
      return 'en'; // По умолчанию английский
    }

    const text = message.toLowerCase().trim();
    
    // Быстрые проверки для очень коротких сообщений
    if (text.length <= 10) {
      if (/[а-яё]/.test(text)) return 'ru';
      if (/[ñáéíóúü]/.test(text)) return 'es';
      return 'en';
    }

    // Проверяем на фразы-маркеры (самый высокий приоритет)
    const phraseDetection = this.detectByPhrases(text);
    if (phraseDetection) {
      return phraseDetection;
    }

    // Счета для каждого языка
    const scores = { en: 0, ru: 0, es: 0 };

    // Проверяем ключевые слова и паттерны
    Object.entries(this.languagePatterns).forEach(([lang, data]) => {
      // Проверяем ключевые слова
      data.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          scores[lang] += matches.length;
        }
      });

      // Проверяем фразы (больший вес)
      if (data.phrases) {
        data.phrases.forEach(phrase => {
          const regex = new RegExp(this.escapeRegex(phrase), 'gi');
          if (regex.test(text)) {
            scores[lang] += 3;
          }
        });
      }

      // Проверяем паттерны (средний вес)
      data.patterns.forEach(pattern => {
        if (pattern.test(text)) {
          scores[lang] += 2;
        }
      });
    });

    // Бонусы за характерные символы
    const cyrillicChars = text.match(/[а-яё]/gi);
    if (cyrillicChars) {
      scores.ru += cyrillicChars.length * 0.8;
    }

    const spanishChars = text.match(/[ñáéíóúü]/gi);
    if (spanishChars) {
      scores.es += spanishChars.length * 0.8;
    }

    // Определяем язык с наибольшим счетом
    const maxScore = Math.max(...Object.values(scores));
    
    if (maxScore === 0) {
      return this.detectByStructure(text);
    }

    const detectedLang = Object.entries(scores)
      .reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];

    // Обновляем статистику
    this.languageStats.detections[detectedLang]++;
    this.languageStats.totalDetections++;

    return detectedLang;
  }

  /**
   * Детектирует язык по характерным фразам
   * @param {string} text - Текст для анализа
   * @returns {LanguageCode|null} Код языка или null
   */
  detectByPhrases(text) {
    // Английские маркеры
    if (/\b(in\s+english|tell\s+me\s+about|what\s+is|how\s+to|please\s+help)\b/i.test(text)) {
      return 'en';
    }

    // Русские маркеры
    if (/\b(что\s+такое|как\s+работает|расскажи\s+о|приветэ?)\b/i.test(text)) {
      return 'ru';
    }

    // Испанские маркеры
    if (/\b(cómo\s+estás?|como\s+estas|qué\s+es|ayúdame|gracias)\b/i.test(text)) {
      return 'es';
    }

    return null;
  }

  /**
   * Детектирует язык по грамматической структуре
   * @param {string} text - Текст для анализа
   * @returns {LanguageCode} Код языка
   */
  detectByStructure(text) {
    // Английские конструкции
    if (/\b(what|how|when|where|why)\s+(is|are|do|does|can|could|should|would)/i.test(text)) {
      return 'en';
    }
    
    // Русские конструкции
    if (/\b(что\s+это|как\s+дела|где\s+можно|когда\s+будет)/i.test(text)) {
      return 'ru';
    }
    
    // Испанские конструкции
    if (/\b(qué\s+es|cómo\s+está|dónde\s+está|cuándo\s+será)/i.test(text)) {
      return 'es';
    }
    
    return 'en'; // По умолчанию
  }

  /**
   * Экранирует специальные символы для регулярных выражений
   * @param {string} str - Строка для экранирования
   * @returns {string} Экранированная строка
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Определяет язык с процентом уверенности (улучшенная версия)
   * @param {string} message - Текст сообщения
   * @returns {Object} Объект с языком и процентом уверенности
   */
  detectWithConfidence(message) {
    const detectedLanguage = this.detect(message);
    
    let confidence = 0.5; // Базовая уверенность
    const text = message.toLowerCase();
    
    // Увеличиваем уверенность при наличии характерных элементов
    if (detectedLanguage === 'ru') {
      const cyrillicCount = (text.match(/[а-яё]/g) || []).length;
      const textLength = text.length;
      const cyrillicRatio = cyrillicCount / textLength;
      
      confidence = Math.min(0.95, 0.6 + cyrillicRatio * 0.4);
      
      // Бонус за русские фразы
      if (/\b(что\s+такое|как\s+дела|расскажи|помоги|приветэ?)\b/i.test(text)) {
        confidence = Math.min(0.98, confidence + 0.2);
      }
    } else if (detectedLanguage === 'es') {
      // Проверяем испанские характерные символы и фразы
      const spanishChars = (text.match(/[ñáéíóúü]/g) || []).length;
      confidence = Math.min(0.95, 0.6 + (spanishChars > 0 ? 0.3 : 0));
      
      // Бонус за испанские фразы
      if (/\b(como\s+estas|cómo\s+estás|que\s+tal|hola|gracias)\b/i.test(text)) {
        confidence = Math.min(0.98, confidence + 0.25);
      }
    } else if (detectedLanguage === 'en') {
      // Для английского проверяем отсутствие других языков
      const hasNonLatin = /[а-яёñáéíóúü]/.test(text);
      
      if (!hasNonLatin) {
        confidence = Math.min(0.9, 0.7 + 0.2);
      }
      
      // Бонус за английские фразы
      if (/\b(what\s+is|how\s+to|tell\s+me|in\s+english|please\s+help)\b/i.test(text)) {
        confidence = Math.min(0.98, confidence + 0.25);
      }
    }
    
    // Дополнительная проверка на длину - короткие сообщения менее надежны
    if (message.length < 20) {
      confidence = Math.max(0.4, confidence - 0.2);
    }
    
    return {
      language: detectedLanguage,
      confidence: Math.round(confidence * 100) / 100
    };
  }

  /**
   * Проверяет, является ли текст на определенном языке
   * @param {string} message - Текст для проверки
   * @param {LanguageCode} targetLanguage - Целевой язык
   * @returns {boolean} True если текст на целевом языке
   */
  isLanguage(message, targetLanguage) {
    return this.detect(message) === targetLanguage;
  }

  /**
   * Получает статистику определения языков
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      ...this.languageStats,
      cacheSize: this.userLanguageCache.size,
      supportedLanguages: Object.keys(this.languagePatterns)
    };
  }

  /**
   * Получает список поддерживаемых языков
   * @returns {string[]} Массив кодов языков
   */
  getSupportedLanguages() {
    return Object.keys(this.languagePatterns);
  }

  /**
   * Очищает кеш языковых предпочтений пользователя
   * @param {string} userId - ID пользователя
   */
  clearLanguageCache(userId) {
    this.userLanguageCache.delete(userId);
  }

  /**
   * Очищает весь кеш языковых предпочтений
   */
  clearAllLanguageCache() {
    this.userLanguageCache.clear();
  }
}

// Создаем единственный экземпляр
const languageDetector = new LanguageDetector();

module.exports = {
  detect: (message) => languageDetector.detect(message),
  isLanguage: (message, targetLanguage) => languageDetector.isLanguage(message, targetLanguage),
  detectWithConfidence: (message) => languageDetector.detectWithConfidence(message),
  getStats: () => languageDetector.getStats(),
  getSupportedLanguages: () => languageDetector.getSupportedLanguages(),
  clearLanguageCache: (userId) => languageDetector.clearLanguageCache(userId),
  clearAllLanguageCache: () => languageDetector.clearAllLanguageCache()
};
