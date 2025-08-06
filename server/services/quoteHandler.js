/**
 * @fileoverview Обработчик цитат с геймификацией для бота "Читатель" (ИСПРАВЛЕННАЯ ВЕРСИЯ)
 * @author g1orgi89
 * 📋 NEW: Интеграция с БД Category и BookCatalog вместо хардкода
 */

const { Quote, UserProfile } = require('../models');
const { claudeService } = require('./claude');
const promptService = require('./promptService');

/**
 * @typedef {Object} ParsedQuote
 * @property {string} text - Текст цитаты
 * @property {string|null} author - Автор цитаты
 * @property {string|null} source - Источник книги
 */

/**
 * @typedef {Object} QuoteAnalysis
 * @property {string} category - Категория цитаты
 * @property {string[]} themes - Темы цитаты
 * @property {string} sentiment - Эмоциональная окраска
 * @property {string} insights - Психологические инсайты
 */

/**
 * Simplified quote processing service for Mini App
 */
class QuoteHandler {
  constructor() {
    this.initializeModels();
  }

  /**
   * 📋 NEW: Инициализация MongoDB моделей
   * @private
   */
  initializeModels() {
    try {
      this.Category = require('../models/Category');
      this.BookCatalog = require('../models/BookCatalog');
      console.info('📋 QuoteHandler: MongoDB models initialized');
    } catch (error) {
      console.error('📋 QuoteHandler: Failed to initialize models:', error.message);
      // Fallback к хардкоду если модели недоступны
      this.Category = null;
      this.BookCatalog = null;
    }
  }

  /**
   * Process quote for Mini App - simplified version
   * @param {string} userId - User ID
   * @param {string} messageText - Quote text
   * @returns {Promise<Object>} Processing result
   */
  async handleQuote(userId, messageText) {
    try {
      // 1. Parse quote
      const parsedQuote = this._parseQuote(messageText);
      
      // 2. Analyze quote with AI
      const analysis = await this._analyzeQuote(parsedQuote.text, parsedQuote.author);
      
      // 3. Save quote
      const quote = await this._saveQuote(userId, parsedQuote, analysis);
      
      // 4. Update user statistics
      await this._updateUserStatistics(userId, parsedQuote.author);
      
      // 5. Get today's count for response
      const todayCount = await this._getTodayQuotesCount(userId);
      
      return {
        success: true,
        quote,
        todayCount
      };
      
    } catch (error) {
      console.error('Error handling quote:', error);
      return {
        success: false,
        message: "Error saving quote. Please try again.",
        error: error.message
      };
    }
  }

  /**
   * Get today's quotes count for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Today's quotes count
   * @private
   */
  async _getTodayQuotesCount(userId) {
    return await Quote.getTodayQuotesCount(userId);
  }

  /**
   * Парсить цитату из текста
   * @param {string} messageText - Текст сообщения
   * @returns {ParsedQuote} Распарсенная цитата
   */
  _parseQuote(messageText) {
    const text = messageText.trim();
    
    // Паттерны для разных форматов цитат
    const patterns = [
      // "Цитата" (Автор)
      /^["«]([^"«»]+)["»]\s*\(([^)]+)\)$/,
      // Цитата (Автор)
      /^([^(]+)\s*\(([^)]+)\)$/,
      // Цитата - Автор
      /^([^-]+)\s*[-–—]\s*(.+)$/,
      // "Цитата" Автор
      /^["«]([^"«»]+)["»]\s+(.+)$/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          text: match[1].trim(),
          author: match[2].trim(),
          source: null
        };
      }
    }

    // Если паттерны не подошли - просто текст без автора
    return {
      text: text,
      author: null,
      source: null
    };
  }

  /**
   * 📋 NEW: Анализировать цитату через Claude AI с использованием динамического промпта из БД
   * @param {string} text - Текст цитаты
   * @param {string|null} author - Автор цитаты
   * @returns {Promise<QuoteAnalysis>} Анализ цитаты
   */
  async _analyzeQuote(text, author) {
    try {
      // Получаем актуальные категории из БД
      const categories = await this._getAvailableCategories();
      const categoriesList = categories.map(c => c.name).join(', ');

      // Получаем динамический промпт из БД
      let prompt;
      try {
        const dynamicPrompt = await promptService.getActivePrompt('reader_analysis', 'ru');
        
        // Заменяем переменные в промпте
        prompt = dynamicPrompt
          .replace('{text}', text)
          .replace('{author}', author || 'Неизвестен')
          .replace('{categories}', categoriesList);
          
        console.log('📖 Используется динамический промпт из БД для анализа цитаты');
        
      } catch (promptError) {
        // Fallback промпт если БД недоступна
        console.warn(`⚠️ Не удалось получить промпт из БД: ${promptError.message}, используется fallback`);
        
        prompt = `Проанализируй эту цитату как психолог Анна Бусел:

Цитата: "${text}"
Автор: ${author || 'Неизвестен'}

Доступные категории: ${categoriesList}

Верни JSON с анализом:
{
  "category": "одна из доступных категорий",
  "themes": ["тема1", "тема2"],
  "sentiment": "positive/neutral/negative",
  "insights": "краткий психологический инсайт (1-2 предложения)"
}`;
      }

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'quote_analysis'
      });
      
      const analysis = JSON.parse(response.message);
      
      // Валидация результата с БД категориями
      return {
        category: await this._validateCategory(analysis.category, text),
        themes: Array.isArray(analysis.themes) ? analysis.themes.slice(0, 3) : ['размышления'],
        sentiment: ['positive', 'neutral', 'negative'].includes(analysis.sentiment) ? analysis.sentiment : 'neutral',
        insights: analysis.insights || 'Интересная мысль для размышления'
      };
      
    } catch (error) {
      console.error('Error analyzing quote:', error);
      
      // Fallback анализ с использованием БД
      return {
        category: await this._getFallbackCategory(text),
        themes: ['жизненный опыт'],
        sentiment: 'positive',
        insights: 'Глубокая мысль для размышления'
      };
    }
  }

  /**
   * 📋 NEW: Получить доступные категории из БД
   * @returns {Promise<Array>} Список категорий
   * @private
   */
  async _getAvailableCategories() {
    try {
      if (this.Category) {
        const categories = await this.Category.getActiveForAI();
        if (categories && categories.length > 0) {
          return categories;
        }
      }
      
      // Fallback к хардкоду
      return this._getFallbackCategories();
    } catch (error) {
      console.error('📋 Error getting categories from database:', error);
      return this._getFallbackCategories();
    }
  }

  /**
   * 📋 NEW: Fallback категории (старая логика)
   * @returns {Array} Категории
   * @private
   */
  _getFallbackCategories() {
    return [
      { name: 'Саморазвитие', keywords: ['саморазвитие', 'рост', 'развитие'] },
      { name: 'Любовь', keywords: ['любовь', 'сердце', 'чувства'] },
      { name: 'Философия', keywords: ['жизнь', 'смысл', 'мудрость'] },
      { name: 'Мотивация', keywords: ['цель', 'успех', 'достижение'] },
      { name: 'Мудрость', keywords: ['опыт', 'знание', 'понимание'] },
      { name: 'Творчество', keywords: ['творчество', 'искусство', 'создание'] },
      { name: 'Отношения', keywords: ['отношения', 'дружба', 'общение'] },
      { name: 'Материнство', keywords: ['мама', 'дети', 'семья'] },
      { name: 'Карьера', keywords: ['работа', 'профессия', 'бизнес'] },
      { name: 'Другое', keywords: [] }
    ];
  }

  /**
   * 📋 NEW: Валидировать категорию цитаты с использованием БД
   * @param {string} category - Категория от AI
   * @param {string} text - Текст цитаты для fallback
   * @returns {Promise<string>} Валидная категория
   * @private
   */
  async _validateCategory(category, text) {
    try {
      if (this.Category) {
        // Проверяем, есть ли такая категория в БД
        const validCategory = await this.Category.validateAICategory(category);
        if (validCategory) {
          return validCategory;
        }
        
        // Если нет - используем fallback поиск по тексту
        const foundCategory = await this.Category.findByText(text);
        if (foundCategory) {
          return foundCategory.name;
        }
      }
      
      // Fallback к старой логике
      const categories = await this._getAvailableCategories();
      const validCategories = categories.map(c => c.name);
      return validCategories.includes(category) ? category : 'Другое';
      
    } catch (error) {
      console.error('📋 Error validating category:', error);
      return await this._getFallbackCategory(text);
    }
  }

  /**
   * 📋 NEW: Fallback определение категории по тексту
   * @param {string} text - Текст цитаты
   * @returns {Promise<string>} Категория
   * @private
   */
  async _getFallbackCategory(text) {
    const textLower = text.toLowerCase();
    const categories = await this._getAvailableCategories();
    
    for (const category of categories) {
      if (category.keywords) {
        const hasKeyword = category.keywords.some(keyword => 
          textLower.includes(keyword.toLowerCase())
        );
        if (hasKeyword) {
          return category.name;
        }
      }
    }
    
    return 'Другое';
  }

  /**
   * Сохранить цитату в базу данных
   * @param {string} userId - ID пользователя
   * @param {ParsedQuote} parsedQuote - Распарсенная цитата
   * @param {QuoteAnalysis} analysis - Анализ цитаты
   * @returns {Promise<Object>} Сохраненная цитата
   * @private
   */
  async _saveQuote(userId, parsedQuote, analysis) {
    const quote = new Quote({
      userId,
      text: parsedQuote.text,
      author: parsedQuote.author,
      source: parsedQuote.source,
      category: analysis.category,
      themes: analysis.themes,
      sentiment: analysis.sentiment
    });

    return await quote.save();
  }

  /**
   * Обновить статистику пользователя
   * @param {string} userId - ID пользователя
   * @param {string|null} author - Автор цитаты
   * @returns {Promise<void>}
   * @private
   */
  async _updateUserStatistics(userId, author) {
    const user = await UserProfile.findOne({ userId });
    if (user) {
      await user.updateQuoteStats(author);
    }
  }

  /**
   * Simplified user stats for Mini App
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats(userId) {
    try {
      const [user, totalQuotes] = await Promise.all([
        UserProfile.findOne({ userId }),
        Quote.countDocuments({ userId })
      ]);

      if (!user) {
        return null;
      }

      return {
        name: user.name,
        totalQuotes,
        currentStreak: user.statistics.currentStreak,
        longestStreak: user.statistics.longestStreak,
        favoriteAuthors: user.statistics.favoriteAuthors.slice(0, 3),
        daysSinceRegistration: user.daysSinceRegistration
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  /**
   * Search user quotes
   * @param {string} userId - User ID
   * @param {string} searchText - Search text
   * @param {number} limit - Result limit
   * @returns {Promise<Object[]>} Found quotes
   */
  async searchQuotes(userId, searchText, limit = 10) {
    try {
      const quotes = await Quote.searchUserQuotes(userId, searchText, limit);
      return quotes.map(quote => ({
        text: quote.text,
        author: quote.author,
        category: quote.category,
        createdAt: quote.createdAt,
        ageInDays: quote.ageInDays
      }));
    } catch (error) {
      console.error('Error searching quotes:', error);
      return [];
    }
  }
}

module.exports = QuoteHandler;