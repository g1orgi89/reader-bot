/**
 * @fileoverview Обработчик цитат с геймификацией для бота "Читатель" (ИСПРАВЛЕННАЯ ВЕРСИЯ)
 * @author g1orgi89
 * 📋 NEW: Интеграция с БД Category и BookCatalog вместо хардкода
 */

const { Quote, UserProfile } = require('../models');
const AchievementService = require('./achievementService');
const claudeService = require('./claude');
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
 * Сервис обработки цитат с геймификацией
 */
class QuoteHandler {
  constructor() {
    this.achievementService = new AchievementService();
    this.dailyQuoteLimit = 10;
    this.initializeModels();
    
    // Классические авторы для детекции
    this.classicAuthors = [
      'толстой', 'лев толстой', 'л. толстой',
      'достоевский', 'федор достоевский', 'ф. достоевский',
      'пушкин', 'александр пушкин', 'а. пушкин',
      'чехов', 'антон чехов', 'а. чехов',
      'тургенев', 'иван тургенев', 'и. тургенев',
      'гоголь', 'николай гоголь', 'н. гоголь',
      'лермонтов', 'михаил лермонтов', 'м. лермонтов'
    ];
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
   * Обработать цитату пользователя
   * @param {string} userId - ID пользователя Telegram
   * @param {string} messageText - Текст сообщения с цитатой
   * @returns {Promise<Object>} Результат обработки
   */
  async handleQuote(userId, messageText) {
    try {
      // 1. Проверяем лимит цитат в день
      const todayCount = await this._checkDailyLimit(userId);
      if (todayCount >= this.dailyQuoteLimit) {
        return {
          success: false,
          message: "📖 Вы уже отправили 10 цитат сегодня. Возвращайтесь завтра за новыми открытиями!",
          limitReached: true
        };
      }

      // 2. Парсим цитату
      const parsedQuote = this._parseQuote(messageText);
      
      // 3. Анализируем цитату через AI
      const analysis = await this._analyzeQuote(parsedQuote.text, parsedQuote.author);
      
      // 4. Сохраняем цитату
      const quote = await this._saveQuote(userId, parsedQuote, analysis);
      
      // 5. Обновляем статистику пользователя
      await this._updateUserStatistics(userId, parsedQuote.author);
      
      // 6. Проверяем достижения
      const newAchievements = await this.achievementService.checkAndUnlockAchievements(userId);
      
      // 7. Генерируем ответ в стиле Анны
      const response = await this._generateAnnaResponse(parsedQuote, analysis, todayCount + 1, userId);
      
      return {
        success: true,
        message: response,
        quote,
        newAchievements,
        todayCount: todayCount + 1
      };
      
    } catch (error) {
      console.error('Error handling quote:', error);
      return {
        success: false,
        message: "Произошла ошибка при сохранении цитаты. Попробуйте еще раз.",
        error: error.message
      };
    }
  }

  /**
   * Проверить дневной лимит цитат
   * @param {string} userId - ID пользователя
   * @returns {Promise<number>} Количество цитат сегодня
   * @private
   */
  async _checkDailyLimit(userId) {
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
   * Анализирует цитату с помощью ИИ, используя динамические промпты и категории из БД
   * 
   * Метод получает категории для анализа из БД через this._getAvailableCategories(),
   * загружает промпт для анализа цитаты из PromptService, заменяет плейсхолдеры
   * и отправляет запрос в claudeService для получения анализа. В случае ошибки
   * возвращается fallback анализ с категорией из БД.
   * 
   * @param {string} text - Текст цитаты для анализа
   * @param {string|null} author - Автор цитаты (может быть null)
   * @returns {Promise<QuoteAnalysis>} Объект с результатами анализа цитаты:
   *   - category: строка с названием категории
   *   - themes: массив строк с темами (максимум 3)
   *   - sentiment: строка с эмоциональной окраской ('positive'|'neutral'|'negative')
   *   - insights: строка с психологическими инсайтами
   * @throws {Error} В случае критических ошибок возвращает fallback анализ
   * @since 1.0.0
   */
  async _analyzeQuote(text, author) {
    try {
      // Получаем актуальные категории из БД через метод _getAvailableCategories()
      const categories = await this._getAvailableCategories();
      const categoriesList = categories.map(c => c.name).join(', ');

      // Получаем промпт для анализа цитаты из PromptService из БД методом getActivePrompt('quote_analysis')
      let prompt;
      try {
        const dynamicPrompt = await promptService.getActivePrompt('quote_analysis');
        
        // Заменяем плейсхолдеры {text}, {author}, {categories} в промпте перед отправкой в claudeService
        prompt = dynamicPrompt
          .replace('{text}', text)
          .replace('{author}', author || 'Неизвестен')
          .replace('{categories}', categoriesList);
          
        console.log('📖 Используется динамический промпт из БД для анализа цитаты');
        
      } catch (promptError) {
        // Если не найден — используется fallback промпт
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

      // Отправляем промпт в claudeService.generateResponse
      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'quote_analysis'
      });
      
      // Парсим и валидируем возвращаемый JSON с анализом (category, themes, sentiment, insights)
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
      
      // В случае ошибки — возвращаем fallback анализ с категорией из БД и дефолтными темами/инсайтом
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
   * 📋 NEW: Генерировать ответ в стиле Анны Бусел с рекомендациями из БД
   * @param {ParsedQuote} parsedQuote - Распарсенная цитата
   * @param {QuoteAnalysis} analysis - Анализ цитаты
   * @param {number} todayCount - Количество цитат сегодня
   * @param {string} userId - ID пользователя
   * @returns {Promise<string>} Ответ бота
   * @private
   */
  async _generateAnnaResponse(parsedQuote, analysis, todayCount, userId) {
    const { text, author } = parsedQuote;
    const isClassicAuthor = author && this._isClassicAuthor(author);
    
    // Базовые шаблоны ответов
    const baseTemplates = [
      `✨ Прекрасная цитата! ${author ? `${author} умеет находить глубину в простых словах.` : 'Мудрые слова для размышления.'}`,
      `📖 Замечательный выбор! ${analysis.insights}`,
      `💭 Очень глубоко! Эта мысль о ${analysis.themes[0]} особенно актуальна.`,
      `🌟 Сохранила в ваш личный дневник. ${author ? `${author} - один из моих любимых авторов.` : 'Прекрасная собственная мысль!'}`
    ];

    // Дополнения для классиков
    if (isClassicAuthor) {
      baseTemplates.push(
        `📚 ${author} - классик, который не теряет актуальности. Прекрасный выбор!`,
        `⭐ Русская классика всегда попадает в самое сердце. ${author} - мудрый наставник.`
      );
    }

    const baseResponse = baseTemplates[Math.floor(Math.random() * baseTemplates.length)];
    
    // ИСПРАВЛЕНО: Получаем статистику недели с правильным userId
    const weekQuotes = await this._getWeekQuotesCount(userId);
    
    let fullResponse = `${baseResponse}\n\nСохранил в ваш личный дневник 📖\nЦитат на этой неделе: ${weekQuotes}`;

    // 📋 NEW: Добавляем рекомендацию из БД (30% вероятность)
    if (Math.random() < 0.3) {
      const recommendation = await this._getBookRecommendation(analysis.category, isClassicAuthor);
      if (recommendation) {
        fullResponse += `\n\n💡 ${recommendation}`;
      }
    }

    // Поощрение за активность
    if (todayCount >= 5) {
      fullResponse += '\n\n🔥 Отличная активность сегодня! Вы настоящий коллекционер мудрости.';
    }

    return fullResponse;
  }

  /**
   * Проверить, является ли автор классиком
   * @param {string} author - Автор
   * @returns {boolean}
   * @private
   */
  _isClassicAuthor(author) {
    const authorLower = author.toLowerCase();
    return this.classicAuthors.some(classic => 
      authorLower.includes(classic) || classic.includes(authorLower)
    );
  }

  /**
   * Получить количество цитат за неделю
   * @param {string} userId - ID пользователя
   * @returns {Promise<number>}
   * @private
   */
  async _getWeekQuotesCount(userId) {
    try {
      // Получаем начало и конец текущей недели
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Понедельник как начало недели
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      
      // Подсчитываем цитаты за текущую неделю
      const count = await Quote.countDocuments({
        userId,
        createdAt: {
          $gte: weekStart,
          $lt: weekEnd
        }
      });
      
      return count;
    } catch (error) {
      console.error('Error getting week quotes count:', error);
      return 0;
    }
  }

  /**
   * 📋 NEW: Получить рекомендацию книги из БД на основе категории
   * @param {string} category - Категория цитаты
   * @param {boolean} isClassic - Является ли автор классиком
   * @returns {Promise<string|null>} Рекомендация
   * @private
   */
  async _getBookRecommendation(category, isClassic) {
    try {
      if (this.BookCatalog) {
        // Получаем рекомендации из БД по категории
        const recommendations = await this.BookCatalog.getRecommendationsByThemes([category]);
        
        if (recommendations && recommendations.length > 0) {
          const book = recommendations[0];
          return `Кстати, если вас привлекает тема "${category}", у Анны есть разбор "${book.title}".`;
        }
      }
      
      // Fallback к хардкоду
      return this._getFallbackBookRecommendation(category, isClassic);
      
    } catch (error) {
      console.error('📋 Error getting book recommendation from database:', error);
      return this._getFallbackBookRecommendation(category, isClassic);
    }
  }

  /**
   * 📋 NEW: Fallback рекомендация книги (старая логика)
   * @param {string} category - Категория цитаты
   * @param {boolean} isClassic - Является ли автор классиком
   * @returns {string|null} Рекомендация
   * @private
   */
  _getFallbackBookRecommendation(category, isClassic) {
    const recommendations = {
      'Саморазвитие': [
        'Кстати, если вас привлекает саморазвитие, у Анны есть разбор "Быть собой".',
        'По теме саморазвития рекомендую разбор Анны "Искусство любить" Эриха Фромма.'
      ],
      'Любовь': [
        'Если тема любви вам близка, у Анны есть глубокий разбор "Искусство любить".',
        'По теме отношений рекомендую изучить разбор "Быть собой" от Анны.'
      ],
      'Философия': [
        'Для любителей философии у Анны есть разбор "Письма к молодому поэту" Рильке.',
        'Философские размышления продолжите в разборе "Маленький принц" от Анны.'
      ],
      'Материнство': [
        'Для мам у Анны есть специальный курс "Мудрая мама".',
        'По теме материнства рекомендую изучить подход Анны к балансу жизни.'
      ],
      'Творчество': [
        'Для творческих натур у Анны есть разбор "Письма к молодому поэту".',
        'Развивайте творческое мышление с разбором "Алхимик" от Анны.'
      ]
    };

    const categoryRecs = recommendations[category];
    if (categoryRecs) {
      return categoryRecs[Math.floor(Math.random() * categoryRecs.length)];
    }

    // Общие рекомендации
    const generalRecs = [
      'У Анны есть прекрасные разборы книг для глубокого самопознания.',
      'Загляните в библиотеку разборов Анны - там много созвучного вашим интересам.'
    ];

    return generalRecs[Math.floor(Math.random() * generalRecs.length)];
  }

  /**
   * Обработать достижения пользователя
   * @param {string} userId - ID пользователя
   * @param {Object[]} newAchievements - Новые достижения
   * @returns {Promise<string[]>} Сообщения о достижениях
   */
  async handleAchievements(userId, newAchievements) {
    const messages = [];
    
    for (const achievement of newAchievements) {
      const message = this.achievementService.formatAchievementNotification(achievement);
      messages.push(message);
    }
    
    return messages;
  }

  /**
   * Получить статистику пользователя для команд
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} Статистика пользователя
   */
  async getUserStats(userId) {
    try {
      const [user, totalQuotes, achievementStats] = await Promise.all([
        UserProfile.findOne({ userId }),
        Quote.countDocuments({ userId }),
        this.achievementService.getUserAchievementStats(userId)
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
        daysSinceRegistration: user.daysSinceRegistration,
        achievements: achievementStats
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  /**
   * Поиск цитат пользователя
   * @param {string} userId - ID пользователя
   * @param {string} searchText - Текст для поиска
   * @param {number} limit - Лимит результатов
   * @returns {Promise<Object[]>} Найденные цитаты
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
