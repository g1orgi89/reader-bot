/**
 * Сервис для генерации еженедельных отчетов для проекта "Читатель"
 * @file server/services/weeklyReportService.js
 * 🔧 FIX: Исправлена ошибка конфликта системных промптов
 * 🔧 FIX: Используем прямой API вызов без системного промпта для JSON анализа
 * 🔧 FIX: Добавлена валидация и очистка JSON ответов
 * 🔧 FIX: Добавлено поле reasoning в рекомендации
 * 🔧 NEW: Интеграция с API для BookCatalog и PromoCode вместо хардкода
 */

const logger = require('../utils/logger');

/**
 * @typedef {Object} Quote
 * @property {string} userId - ID пользователя
 * @property {string} text - Текст цитаты
 * @property {string} [author] - Автор цитаты
 * @property {string} [source] - Источник цитаты
 * @property {string} category - Категория цитаты
 * @property {Date} createdAt - Дата создания
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} userId - ID пользователя
 * @property {string} name - Имя пользователя
 * @property {string} email - Email пользователя
 * @property {Object} testResults - Результаты онбординг теста
 */

/**
 * @typedef {Object} WeeklyAnalysis
 * @property {string} summary - Краткий анализ недели
 * @property {string[]} dominantThemes - Доминирующие темы
 * @property {string} emotionalTone - Эмоциональный тон
 * @property {string} insights - Психологические инсайты
 * @property {string} personalGrowth - Наблюдения о росте
 */

/**
 * @class WeeklyReportService
 * @description Сервис для генерации еженедельных отчетов с AI-анализом
 */
class WeeklyReportService {
  constructor() {
    this.logger = logger;
    // Получаем прямой доступ к API для JSON анализа
    const { getAIProviderConfig } = require('../config/aiProvider');
    this.config = getAIProviderConfig();

    this.anthropic = null;
    this.openai = null;

    if (this.config.provider === 'claude' && this.config.claude.apiKey) {
      const { Anthropic } = require('@anthropic-ai/sdk');
      this.anthropic = new Anthropic({ apiKey: this.config.claude.apiKey });
      this.claudeConfig = this.config.claude;
    }
    if (this.config.provider === 'openai' && this.config.openai.apiKey) {
      const OpenAI = require('openai');
      this.openai = new OpenAI({ apiKey: this.config.openai.apiKey });
      this.openaiConfig = this.config.openai;
    }
    
    // 📋 NEW: Инициализация моделей для работы с БД
    this.initializeModels();
  }

  /**
   * 📋 NEW: Инициализация MongoDB моделей
   * @private
   */
  initializeModels() {
    try {
      this.BookCatalog = require('../models/BookCatalog');
      this.PromoCode = require('../models/PromoCode');
      this.UtmTemplate = require('../models/UtmTemplate');
      this.TargetAudience = require('../models/TargetAudience');
      logger.info('📋 WeeklyReportService: MongoDB models initialized');
    } catch (error) {
      logger.error('📋 WeeklyReportService: Failed to initialize models:', error.message);
      // Fallback к хардкоду если модели недоступны
      console.error(error);
      this.BookCatalog = null;
      this.PromoCode = null;
    }
  }

  /**
   * 🔧 FIX: Инициализация прямого клиента Anthropic для JSON анализа
   * @private
   */
  initializeAnthropicClient() {
    try {
      const { Anthropic } = require('@anthropic-ai/sdk');
      const { getAIProviderConfig } = require('../config/aiProvider');
      
      const config = getAIProviderConfig();
      this.anthropic = new Anthropic({
        apiKey: config.claude.apiKey,
      });
      
      this.claudeConfig = config.claude;
      logger.info('📖 WeeklyReportService: Direct Anthropic client initialized');
    } catch (error) {
      logger.error('📖 WeeklyReportService: Failed to initialize Anthropic client:', error.message);
      this.anthropic = null;
    }
  }

  /**
   * 🔧 FIX: Прямой AI-анализ без конфликтующих системных промптов
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<WeeklyAnalysis>} Анализ недели
   */
  async analyzeWeeklyQuotes(quotes, userProfile) {
    const quotesText = quotes.map(q => `"${q.text}" ${q.author ? `(${q.author})` : ''}`).join('\n\n');
    const analysisPrompt = `Проанализируй цитаты пользователя за неделю в стиле психолога Анны Бусел.\n\nПользователь: ${userProfile.name}\nЦитаты:\n${quotesText}\n\nСформируй JSON с ключами: summary, dominantThemes[], emotionalTone, insights, personalGrowth.`;

    try {
      logger.info(`📖 Analyzing ${quotes.length} quotes for user ${userProfile.userId} (provider: ${this.config.provider})`);

      if (this.config.provider === 'openai' && this.openai) {
        // GPT-4o prompt
        const response = await this.openai.chat.completions.create({
          model: this.openaiConfig.model,
          messages: [
            { role: 'system', content: 'Ты психолог Анна Бусел. Отвечай в формате JSON.' },
            { role: 'user', content: analysisPrompt }
          ],
          max_tokens: this.openaiConfig.maxTokens,
          temperature: this.openaiConfig.temperature
        });
        const aiText = response.choices[0].message.content;
        const analysis = this._parseAIResponse(aiText);
        if (!analysis.summary || !analysis.insights) {
          logger.warn(`📖 Invalid analysis (OpenAI), using fallback for user ${userProfile.userId}`);
          return this.getFallbackAnalysis(quotes, userProfile);
        }
        logger.info(`📖 OpenAI analysis completed for user ${userProfile.userId}`);
        return {
          summary: analysis.summary,
          dominantThemes: analysis.dominantThemes || [],
          emotionalTone: analysis.emotionalTone || 'размышляющий',
          insights: analysis.insights,
          personalGrowth: analysis.personalGrowth || 'Ваш выбор цитат говорит о стремлении к пониманию себя и мира вокруг.'
        };
      } else if (this.anthropic) {
        // ... как было для Anthropic
        const response = await this.anthropic.messages.create({
          model: this.claudeConfig.model,
          max_tokens: 1000,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: analysisPrompt
          }]
        });
        const analysis = this._parseAIResponse(response.content[0].text);
        if (!analysis.summary || !analysis.insights) {
          logger.warn(`📖 Invalid analysis (Claude), using fallback for user ${userProfile.userId}`);
          return this.getFallbackAnalysis(quotes, userProfile);
        }
        logger.info(`📖 Direct AI analysis completed successfully for user ${userProfile.userId}`);
        return {
          summary: analysis.summary,
          dominantThemes: analysis.dominantThemes || [],
          emotionalTone: analysis.emotionalTone || 'размышляющий',
          insights: analysis.insights,
          personalGrowth: analysis.personalGrowth || 'Ваш выбор цитат говорит о стремлении к пониманию себя и мира вокруг.'
        };
      } else {
        logger.warn('📖 No AI client available, using fallback analysis');
        return this.getFallbackAnalysis(quotes, userProfile);
      }
    } catch (error) {
      logger.error(`📖 Error in AI weekly analysis: ${error.message}`);
      return this.getFallbackAnalysis(quotes, userProfile);
    }
  }

  /**
   * 🔧 FIX: Парсит ответ AI с очисткой и валидацией
   * @private
   * @param {string} aiResponse - Ответ от AI
   * @returns {Object} Распарсенный JSON объект
   * @throws {Error} Если парсинг невозможен
   */
  _parseAIResponse(aiResponse) {
    try {
      // Очищаем ответ от markdown кодблоков и лишнего текста
      let cleanResponse = aiResponse.trim();
      
      // Удаляем markdown кодблоки если есть
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      
      // Ищем JSON объект в ответе
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      // Удаляем возможные объяснения до JSON
      const lines = cleanResponse.split('\n');
      let jsonStartIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('{')) {
          jsonStartIndex = i;
          break;
        }
      }
      
      if (jsonStartIndex > 0) {
        cleanResponse = lines.slice(jsonStartIndex).join('\n');
      }
      
      // Попытка парсинга JSON
      const parsed = JSON.parse(cleanResponse);
      
      logger.info(`📖 Successfully parsed direct AI response JSON`);
      return parsed;
      
    } catch (parseError) {
      logger.error(`📖 JSON parsing failed: ${parseError.message}`);
      logger.error(`📖 Original AI response: ${aiResponse.substring(0, 200)}...`);
      
      // Пытаемся извлечь данные регулярными выражениями как последнее средство
      return this._extractDataWithRegex(aiResponse);
    }
  }

  /**
   * 🔧 FIX: Извлекает данные из ответа AI с помощью регулярных выражений
   * @private
   * @param {string} aiResponse - Ответ от AI
   * @returns {Object} Извлеченные данные
   */
  _extractDataWithRegex(aiResponse) {
    logger.info(`📖 Attempting regex extraction from AI response`);
    
    try {
      // Пытаемся найти ключевые поля в тексте
      const summaryMatch = aiResponse.match(/(?:summary|анализ|итог)[\s"':]*([^"\n]+)/i);
      const insightsMatch = aiResponse.match(/(?:insights|инсайт|вывод)[\s"':]*([^"\n,}]+)/i);
      const toneMatch = aiResponse.match(/(?:tone|тон|настрое)[\s"':]*([^"\n,}]+)/i);
      
      return {
        summary: summaryMatch ? summaryMatch[1].trim() : `За эту неделю пользователь собрал цитаты, отражающие внутренние размышления.`,
        dominantThemes: ['Саморазвитие', 'Мудрость'],
        emotionalTone: toneMatch ? toneMatch[1].trim() : 'размышляющий',
        insights: insightsMatch ? insightsMatch[1].trim() : `Ваши цитаты показывают стремление к пониманию жизни и себя.`,
        personalGrowth: 'Продолжайте собирать моменты вдохновения для личностного роста.'
      };
    } catch (regexError) {
      logger.error(`📖 Regex extraction failed: ${regexError.message}`);
      throw new Error(`Failed to parse AI response: ${regexError.message}`);
    }
  }

  /**
   * Fallback анализ для случаев ошибки AI
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {WeeklyAnalysis} Базовый анализ
   */
  getFallbackAnalysis(quotes, userProfile) {
    logger.info(`📖 Using fallback analysis for user ${userProfile.userId}`);
    
    const themes = this.extractBasicThemes(quotes);
    
    return {
      summary: `За эту неделю вы собрали ${quotes.length} цитат, что говорит о вашем стремлении к знаниям и самопознанию.`,
      dominantThemes: themes,
      emotionalTone: 'вдохновленный',
      insights: `Дорогой ${userProfile.name}, ваши цитаты показывают глубокий интерес к мудрости и саморазвитию. Продолжайте этот прекрасный путь познания себя через слова великих людей.`,
      personalGrowth: 'Ваш выбор цитат говорит о стремлении к пониманию себя и мира вокруг.'
    };
  }

  /**
   * Извлекает базовые темы из цитат (без AI)
   * @param {Array<Quote>} quotes - Цитаты
   * @returns {string[]} Список тем
   */
  extractBasicThemes(quotes) {
    const themes = new Set();
    
    quotes.forEach(quote => {
      const text = quote.text.toLowerCase();
      
      if (text.includes('любов') || text.includes('сердц') || text.includes('чувств')) {
        themes.add('Любовь');
      }
      if (text.includes('жизн') || text.includes('судьб') || text.includes('путь')) {
        themes.add('Жизненная философия');
      }
      if (text.includes('мудр') || text.includes('знан') || text.includes('ум')) {
        themes.add('Мудрость');
      }
      if (text.includes('счасть') || text.includes('радост') || text.includes('улыб')) {
        themes.add('Счастье');
      }
      if (text.includes('цел') || text.includes('мечт') || text.includes('стремлен')) {
        themes.add('Цели и мечты');
      }
      if (text.includes('работ') || text.includes('дел') || text.includes('карьер')) {
        themes.add('Карьера');
      }
      if (text.includes('семь') || text.includes('дом') || text.includes('родител')) {
        themes.add('Семья');
      }
    });

    const themesArray = Array.from(themes);
    return themesArray.length > 0 ? themesArray.slice(0, 3) : ['Саморазвитие'];
  }

  /**
   * Генерирует полный еженедельный отчет
   * @param {string} userId - ID пользователя
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<Object>} Полный отчет
   */
  async generateWeeklyReport(userId, quotes, userProfile) {
    try {
      logger.info(`📖 Generating weekly report for user ${userId} with ${quotes.length} quotes`);
      
      // Получаем AI-анализ цитат
      const analysis = await this.analyzeWeeklyQuotes(quotes, userProfile);
      
      // Получаем персональные категории из теста
      const personalCategories = this.extractCategoriesFromOnboarding(userProfile.testResults);

      // Используем улучшенный матчинг
      const recommendations = await this.getBookRecommendations(analysis, userProfile);
      // Получаем диапазон предыдущей недели
      const weekRange = this.getPreviousWeekRange();
      
      // Вычисляем метрики
      const quotesCount = quotes.length;
      const uniqueAuthors = new Set(
        quotes
          .filter(q => q.author && q.author.trim())
          .map(q => q.author.trim())
      ).size;
      
      // Активные дни (количество уникальных дат)
      const activeDays = new Set(
        quotes.map(q => {
          const date = q.createdAt || q.date || new Date();
          return new Date(date).toISOString().split('T')[0];
        })
      ).size;
      
      const targetQuotes = 30;
      const targetDays = 7;
      const progressQuotesPct = Math.min(Math.round((quotesCount / targetQuotes) * 100), 100);
      const progressDaysPct = Math.min(Math.round((activeDays / targetDays) * 100), 100);
      
      const metrics = {
        quotes: quotesCount,
        uniqueAuthors,
        activeDays,
        targetQuotes,
        progressQuotesPct,
        progressDaysPct
      };
      
      // 📋 NEW: Создаем промокод из БД
      const promoCode = await this.generatePromoCode();
      
      const report = {
        userId,
        weekNumber: weekRange.isoWeekNumber,
        year: weekRange.isoYear,
        quotes: quotes.map(q => q._id || q.id),
        analysis,
        recommendations,
        promoCode,
        metrics,
        generatedAt: new Date()
      };

      logger.info(`📖 Weekly report generated successfully for user ${userId} with metrics:`, metrics);
      return report;
      
    } catch (error) {
      logger.error(`📖 Error generating weekly report for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📋 NEW: Получает рекомендации книг из БД на основе анализа
   * @param {WeeklyAnalysis} analysis - Анализ недели
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<Array<Object>>} Рекомендации книг
   */
  async getBookRecommendations(analysis, userProfile) {
    try {
      if (this.BookCatalog) {
        // Получаем рекомендации из БД на основе анализа
        let recommendations = await this.BookCatalog.getRecommendationsByThemes(analysis.dominantThemes);
        
        // Если не нашли подходящих книг по темам, берем универсальные
        if (!recommendations || recommendations.length === 0) {
          recommendations = await this.BookCatalog.getUniversalRecommendations();
        }
        
        if (recommendations && recommendations.length > 0) {
          // Форматируем рекомендации с UTM ссылками
          const formattedRecommendations = await Promise.all(
            recommendations.slice(0, 2).map(async (book) => {
              const utmLink = await this.generateUTMLink(book.bookSlug, 'weekly_report');
              return {
                title: book.title,
                author: book.author,
                description: book.description,
                price: book.price || book.priceByn || 10, // fallback для совместимости
                priceByn: book.priceByn,
                bookSlug: book.bookSlug,
                reasoning: this.generatePersonalizedReasoning(book, analysis, userProfile.testResults),
                link: utmLink
              };
            })
          );
          
          logger.info(`📋 Generated ${formattedRecommendations.length} book recommendations from database`);
          return formattedRecommendations;
        }
      }
      
      // Fallback к хардкоду если БД недоступна
      logger.warn('📋 Database not available, using fallback book recommendations');
      return this.getFallbackBookRecommendations(analysis);
      
    } catch (error) {
      logger.error(`📋 Error getting book recommendations from database: ${error.message}`);
      return this.getFallbackBookRecommendations(analysis);
    }
  }

  /**
   * 📋 NEW: Fallback рекомендации книг (старая логика) с deterministic slugs
   * @param {WeeklyAnalysis} analysis - Анализ недели
   * @returns {Array<Object>} Рекомендации книг
   */
  getFallbackBookRecommendations(analysis) {
    const recommendations = [];
    
    // Базовая логика рекомендаций на основе тем с deterministic bookSlug
    if (analysis.dominantThemes.includes('Любовь')) {
      recommendations.push({
        title: 'Разбор "Искусство любить" Эриха Фромма',
        author: 'Эрих Фромм',
        price: 8,
        priceByn: 8,
        bookSlug: 'art_of_loving',
        description: 'О построении здоровых отношений с собой и миром',
        reasoning: 'Ваши цитаты показывают интерес к теме любви и отношений',
        link: this.generateFallbackUTMLink('art_of_loving')
      });
    }
    
    if (analysis.dominantThemes.includes('Мудрость') || analysis.dominantThemes.includes('Жизненная философия')) {
      recommendations.push({
        title: '"Письма к молодому поэту" Рильке',
        author: 'Райнер Мария Рильке',
        price: 8,
        priceByn: 8,
        bookSlug: 'letters_to_young_poet',
        description: 'О творчестве, самопознании и поиске своего пути',
        reasoning: 'Судя по вашим цитатам, вас привлекает философский взгляд на жизнь',
        link: this.generateFallbackUTMLink('letters_to_young_poet')
      });
    }
    
    if (analysis.dominantThemes.includes('Саморазвитие')) {
      recommendations.push({
        title: 'Курс "Быть собой"',
        author: 'Анна Бусел',
        price: 12,
        priceByn: 12,
        bookSlug: 'be_yourself_course',
        description: 'О самопринятии и аутентичности',
        reasoning: 'Ваш выбор цитат говорит о стремлении к личностному росту',
        link: this.generateFallbackUTMLink('be_yourself_course')
      });
    }

    if (analysis.dominantThemes.includes('Семья')) {
      recommendations.push({
        title: 'Курс "Мудрая мама"',
        author: 'Анна Бусел',
        price: 20,
        priceByn: 20,
        bookSlug: 'wise_mother_course',
        description: 'Как сохранить себя в материнстве и воспитать счастливых детей',
        reasoning: 'Ваши цитаты отражают интерес к семейным ценностям',
        link: this.generateFallbackUTMLink('wise_mother_course')
      });
    }

    if (analysis.dominantThemes.includes('Счастье')) {
      recommendations.push({
        title: '"Маленький принц" с комментариями',
        author: 'Антуан де Сент-Экзюпери',
        price: 6,
        priceByn: 6,
        bookSlug: 'little_prince',
        description: 'О простых истинах жизни и важности человеческих связей',
        reasoning: 'Ваши цитаты показывают поиск простого счастья в жизни',
        link: this.generateFallbackUTMLink('little_prince')
      });
    }

    // Если нет специфических тем, добавляем универсальную рекомендацию
    if (recommendations.length === 0) {
      recommendations.push({
        title: '"Маленький принц" с комментариями',
        author: 'Антуан де Сент-Экзюпери',
        price: 6,
        priceByn: 6,
        bookSlug: 'little_prince',
        description: 'О простых истинах жизни и важности человеческих связей',
        reasoning: 'Универсальная книга для размышлений о жизни и ценностях',
        link: this.generateFallbackUTMLink('little_prince')
      });
    }

    return recommendations.slice(0, 2); // Максимум 2 рекомендации
  }

  /**
   * 📋 NEW: Генерирует промокод из БД
   * @returns {Promise<Object>} Информация о промокоде
   */
  async generatePromoCode() {
    try {
      if (this.PromoCode) {
        // Получаем активный промокод для еженедельных отчетов
        const promoCode = await this.PromoCode.getRandomForContext('weekly_report');
        
        if (promoCode) {
          logger.info(`📋 Generated promo code from database: ${promoCode.code}`);
          return {
            code: promoCode.code,
            discount: promoCode.discount,
            validUntil: promoCode.validUntil,
            description: promoCode.description
          };
        }
      }
      
      // Fallback к хардкоду если БД недоступна
      logger.warn('📋 Database not available, using fallback promo code');
      return this.getFallbackPromoCode();
      
    } catch (error) {
      logger.error(`📋 Error getting promo code from database: ${error.message}`);
      return this.getFallbackPromoCode();
    }
  }

  /**
   * 📋 NEW: Fallback промокод (старая логика)
   * @returns {Object} Информация о промокоде
   */
  getFallbackPromoCode() {
    const codes = ['READER20', 'WISDOM20', 'QUOTES20', 'BOOKS20'];
    const randomCode = codes[Math.floor(Math.random() * codes.length)];
    
    return {
      code: randomCode,
      discount: 20,
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 дня
      description: 'Скидка 20% на любой разбор'
    };
  }

  /**
   * 📋 NEW: Генерирует UTM ссылку из БД шаблонов
   * @param {string} bookSlug - Идентификатор книги
   * @param {string} context - Контекст использования
   * @returns {Promise<string>} UTM ссылка
   */
  async generateUTMLink(bookSlug, context = 'weekly_report') {
    try {
      if (this.UtmTemplate) {
        // Получаем шаблон для данного контекста
        const templates = await this.UtmTemplate.getByContext(context);
        
        if (templates && templates.length > 0) {
          const template = templates[0];
          const variables = {
            bookSlug: bookSlug,
            userId: 'user_weekly',
            context: context
          };
          
          const utmLink = template.generateLink(variables);
          logger.info(`📋 Generated UTM link from database template: ${template.name}`);
          return utmLink;
        }
      }
      
      // Fallback к старой логике
      return this.generateFallbackUTMLink(bookSlug);
      
    } catch (error) {
      logger.error(`📋 Error generating UTM link from database: ${error.message}`);
      return this.generateFallbackUTMLink(bookSlug);
    }
  }

  /**
   * 📋 NEW: Fallback UTM ссылка (старая логика)
   * @param {string} bookSlug - Идентификатор книги
   * @returns {string} UTM ссылка
   */
  generateFallbackUTMLink(bookSlug) {
    const baseUrl = "https://anna-busel.com/books";
    const utmParams = new URLSearchParams({
      utm_source: 'telegram_bot',
      utm_medium: 'weekly_report',
      utm_campaign: 'reader_recommendations',
      utm_content: bookSlug
    });
    
    return `${baseUrl}?${utmParams.toString()}`;
  }

  /**
   * Получает номер текущей недели в году (ISO 8601)
   * @returns {number} Номер недели
   */
  getCurrentWeekNumber() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Получает диапазон предыдущей полной недели по ISO 8601
   * @returns {{start: Date, end: Date, isoWeekNumber: number, isoYear: number}}
   */
  getPreviousWeekRange() {
    const now = new Date();
    
    // Находим понедельник текущей недели
    const currentMonday = new Date(now);
    const dayOfWeek = now.getDay() || 7; // Воскресенье = 7
    currentMonday.setDate(now.getDate() - dayOfWeek + 1);
    currentMonday.setHours(0, 0, 0, 0);
    
    // Понедельник предыдущей недели
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);
    
    // Воскресенье предыдущей недели (конец недели)
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    prevSunday.setHours(23, 59, 59, 999);
    
    // ISO номер недели для предыдущей недели
    const d = new Date(Date.UTC(prevMonday.getFullYear(), prevMonday.getMonth(), prevMonday.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const isoWeekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const isoYear = d.getUTCFullYear();
    
    return {
      start: prevMonday,
      end: prevSunday,
      isoWeekNumber,
      isoYear
    };
  }

  /**
   * Форматирует отчет для отправки в Telegram
   * @param {Object} report - Отчет
   * @param {Array<Quote>} quotes - Цитаты
   * @returns {string} Форматированное сообщение
   */
  formatTelegramReport(report, quotes) {
    const quotesText = quotes.slice(0, 5).map((quote, index) => {
      const author = quote.author ? ` (${quote.author})` : '';
      return `✅ "${quote.text.substring(0, 80)}..."${author}`;
    }).join('\n');

    const recommendationsText = report.recommendations.map((rec, index) => {
      return `${index + 1}. [${rec.title}](${rec.link}) - ${rec.price}\n   ${rec.description}`;
    }).join('\n\n');

    return `📊 *Ваш отчет за неделю*\n\nЗа эту неделю вы сохранили ${quotes.length} ${this.declensionQuotes(quotes.length)}:\n\n${quotesText}\n\n🎯 *Анализ недели:*\n${report.analysis.insights}\n\n💎 *Рекомендации от Анны:*\n${recommendationsText}\n\n🎁 *Промокод ${report.promoCode.code}* - скидка ${report.promoCode.discount}% до ${report.promoCode.validUntil.toLocaleDateString()}!\n\n---\n💬 Как вам этот отчет?`;
  }

  /**
   * Склонение слова "цитата"
   * @param {number} count - Количество
   * @returns {string} Правильное склонение
   */
  declensionQuotes(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  }
  
 /**
  * Извлечь категории из онбординг теста
  */
 extractCategoriesFromOnboarding(testResults) {
   const categories = new Set();
   if (!testResults) return ['ПОИСК СЕБЯ'];
  
   const answers = Object.values(testResults).join(' ').toLowerCase();
  
   const mappings = {
     'СЕМЕЙНЫЕ ОТНОШЕНИЯ': ['мама', 'замужем', 'семья', 'дети'],
     'ЛЮБОВЬ': ['отношения', 'партнер', 'любовь'],
     'ДЕНЬГИ': ['карьера', 'работа', 'деньги', 'успех'],
     'КРИЗИСЫ': ['трудности', 'проблемы', 'кризис'],
     'ПОИСК СЕБЯ': ['саморазвитие', 'рост', 'познание']
    };
  
   Object.entries(mappings).forEach(([category, keywords]) => {
     if (keywords.some(keyword => answers.includes(keyword))) {
       categories.add(category);
     }
   });
  
   return categories.size > 0 ? Array.from(categories) : ['ПОИСК СЕБЯ'];
   }
  /**
   * 📋 NEW: Генерирует slug из названия книги (transliteration + normalization)
   * @param {string} title - Название книги
   * @returns {string} Сгенерированный slug
   */
  _generateSlugFromTitle(title) {
    if (!title) return 'unknown-book';
    
    // Transliteration map for Cyrillic to Latin
    const cyrillicMap = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    return title
      .toString()
      .toLowerCase()
      .replace(/[а-я]/g, (char) => cyrillicMap[char] || char)
      .replace(/[^a-z0-9\s-]/g, '') // только латиница, цифры, пробелы и дефисы
      .replace(/\s+/g, '-')         // пробелы на дефисы
      .replace(/\-+/g, '-')         // несколько дефисов — один дефис
      .replace(/^-+|-+$/g, '')      // дефисы в начале/конце
      .substring(0, 50);            // ограничиваем длину
  }

/**
 * Персонализированное обоснование
 */
 generatePersonalizedReasoning(book, analysis, testResults) {
   const base = book.reasoning || `Рекомендуется на основе ваших интересов`;
  
   const toneAdaptation = {
     'вдохновляющий': 'поддержит ваш творческий настрой',
     'задумчивый': 'созвучна вашим размышлениям',
     'позитивный': 'усилит ваш позитивный настрой'
   };
  
   const addition = toneAdaptation[analysis.emotionalTone];
   return addition ? `${base} и ${addition}.` : base;
  }
}  

// Экспортируем класс для создания экземпляров
module.exports = WeeklyReportService;
