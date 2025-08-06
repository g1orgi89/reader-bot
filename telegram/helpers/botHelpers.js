/**
 * @fileoverview Вспомогательные функции для Telegram бота "Читатель"
 * @author g1orgi89
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');
const claudeService = require('../../server/services/claude');

/**
 * @typedef {import('../../server/types/reader').UserProfile} UserProfile
 * @typedef {import('../../server/types/reader').Quote} Quote
 * @typedef {import('../../server/types/reader').Achievement} Achievement
 */

/**
 * Вспомогательные функции для бота "Читатель"
 */
class BotHelpers {
  
  /**
   * Проверка, является ли сообщение сложным вопросом
   * @param {string} message - Текст сообщения
   * @returns {boolean} true если требует внимания Анны
   */
  static isComplexQuestion(message) {
    const { ComplexQuestionHandler } = require('../handlers/complexQuestionHandler');
    const handler = new ComplexQuestionHandler();
    return handler.isComplexQuestion(message);
  }

  /**
   * Обработка сложного вопроса
   * @param {Object} ctx - Telegram context
   * @param {string} message - Текст сообщения
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<void>}
   */
  static async handleComplexQuestion(ctx, message, userProfile) {
    const { ComplexQuestionHandler } = require('../handlers/complexQuestionHandler');
    const handler = new ComplexQuestionHandler();
    await handler.handleComplexQuestion(ctx, message, userProfile);
  }

  /**
   * Обработка общего сообщения через AI Анны Бусел
   * @param {Object} ctx - Telegram context
   * @param {string} message - Текст сообщения
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<void>}
   */
  static async handleGeneralMessage(ctx, message, userProfile) {
    try {
      // Создаем контекст для AI ответа
      const context = BotHelpers._buildAIContext(userProfile, message);
      
      const prompt = `Ты психолог Анна Бусел, основатель "Книжного клуба от психолога". Ответь пользователю в своем стиле:

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
${context}

СООБЩЕНИЕ: "${message}"

СТИЛЬ ОТВЕТА:
- Обращайся на "Вы"
- Тон сдержанный, профессиональный
- Минимум эмодзи
- Связывай ответ с книгами/чтением когда уместно
- Используй фирменные фразы: "Хватит сидеть в телефоне - читайте книги!"
- Можешь рекомендовать свои разборы книг если подходит к теме

Дай короткий, полезный ответ (максимум 2-3 предложения).`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: userProfile.userId,
        context: 'general_conversation'
      });

      await ctx.reply(response.message);
      
    } catch (error) {
      logger.error(`📖 Error in general message handling: ${error.message}`);
      
      // Fallback ответ в стиле Анны
      const fallbackResponses = [
        "📖 Интересный вопрос! Над этим стоит поразмышлять.\n\n💡 Хватит сидеть в телефоне - читайте книги!",
        "📖 Благодарю за сообщение. Каждая мысль важна для понимания себя.",
        "📖 Это глубокий вопрос, который заслуживает размышления.\n\nПопробуйте найти ответы в хорошей книге!",
        "📖 Понимаю ваш интерес к этой теме. Литература часто дает лучшие ответы, чем мы ожидаем."
      ];
      
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      await ctx.reply(randomResponse);
    }
  }

  /**
   * Построение контекста для AI
   * @private
   * @param {UserProfile} userProfile - Профиль пользователя
   * @param {string} message - Сообщение пользователя
   * @returns {string} Контекст
   */
  static _buildAIContext(userProfile, message) {
    let context = `Имя: ${userProfile.name}\n`;
    
    // Основные предпочтения из теста
    if (userProfile.testResults) {
      context += `Образ жизни: ${userProfile.testResults.question2_lifestyle || 'не указано'}\n`;
      context += `Приоритеты: ${userProfile.testResults.question4_priorities || 'не указано'}\n`;
    }
    
    // Статистика активности
    context += `Цитат собрано: ${userProfile.statistics.totalQuotes}\n`;
    context += `Дней с ботом: ${Math.floor((new Date() - userProfile.registeredAt) / (1000 * 60 * 60 * 24))}\n`;
    
    // Интересы (если определены)
    if (userProfile.preferences?.mainThemes) {
      context += `Интересы: ${userProfile.preferences.mainThemes.join(', ')}\n`;
    }

    return context;
  }

  /**
   * Обработка других callback'ов
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback'а
   * @returns {Promise<void>}
   */
  static async handleOtherCallbacks(ctx, callbackData) {
    try {
      // Проверяем callback'и настроек
      const { CommandHandler } = require('../handlers/commandHandler');
      const commandHandler = new CommandHandler();
      
      if (await commandHandler.handleSettingsCallback(ctx, callbackData)) {
        return;
      }

      // Callback'и обратной связи (для будущих отчетов)
      if (callbackData.startsWith('feedback_')) {
        await BotHelpers._handleFeedbackCallback(ctx, callbackData);
        return;
      }

      // Callback'и достижений
      if (callbackData.startsWith('achievement_')) {
        await BotHelpers._handleAchievementCallback(ctx, callbackData);
        return;
      }

      // Неизвестный callback
      await ctx.answerCbQuery("Функция временно недоступна.");
      
    } catch (error) {
      logger.error(`📖 Error handling callback: ${error.message}`);
      await ctx.answerCbQuery("Произошла ошибка. Попробуйте еще раз.");
    }
  }

  /**
   * Обработка feedback callback'ов
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback'а
   */
  static async _handleFeedbackCallback(ctx, callbackData) {
    await ctx.answerCbQuery("Спасибо за обратную связь!");
    
    // Здесь будет логика для еженедельных/месячных отчетов
    // Пока что простой ответ
    await ctx.editMessageText(
      "💌 Благодарю за обратную связь! Ваше мнение поможет улучшить работу бота.",
      { reply_markup: { inline_keyboard: [] } }
    );
  }

  /**
   * Обработка achievement callback'ов
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback'а
   */
  static async _handleAchievementCallback(ctx, callbackData) {
    await ctx.answerCbQuery("Поздравляем с достижением!");
    
    // Здесь можно добавить логику показа детальной информации о достижении
    await ctx.editMessageText(
      "🏆 Продолжайте собирать достижения! Каждая цитата приближает вас к новым открытиям.",
      { reply_markup: { inline_keyboard: [] } }
    );
  }

  /**
   * Обновление статистики пользователя (вызывается из QuoteHandler)
   * @param {string} userId - ID пользователя
   * @param {string|null} author - Автор цитаты
   * @returns {Promise<void>}
   */
  static async updateUserStatistics(userId, author) {
    const { ModernQuoteHandler } = require('../handlers/modernQuoteHandler');
    const handler = new ModernQuoteHandler();
    await handler.updateUserStatistics(userId, author);
  }

  /**
   * Проверка достижений (вызывается из QuoteHandler)
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array<Achievement>>} Новые достижения
   */
  static async checkAchievements(userId) {
    const { ModernQuoteHandler } = require('../handlers/modernQuoteHandler');
    const handler = new ModernQuoteHandler();
    return await handler.checkAchievements(userId);
  }

  /**
   * Уведомление о достижениях (вызывается из QuoteHandler)
   * @param {Object} ctx - Telegram context
   * @param {Array<Achievement>} achievements - Достижения
   * @returns {Promise<void>}
   */
  static async notifyAchievements(ctx, achievements) {
    const { ModernQuoteHandler } = require('../handlers/modernQuoteHandler');
    const handler = new ModernQuoteHandler();
    await handler.notifyAchievements(ctx, achievements);
  }

  /**
   * Проверка, является ли сообщение цитатой
   * @param {string} message - Текст сообщения
   * @returns {boolean} true если похоже на цитату
   */
  static isQuoteMessage(message) {
    // Простые эвристики для определения цитаты
    const quotePattterns = [
      /^".*"/,          // Начинается и заканчивается кавычками
      /\([^)]+\)$/,     // Заканчивается автором в скобках
      /^«.*»/,          // Русские кавычки
      /—\s*[А-ЯA-Z]/,  // Тире с именем автора
    ];

    // Проверяем паттерны цитат
    if (quotePattterns.some(pattern => pattern.test(message))) {
      return true;
    }

    // Проверяем длину и содержание (цитаты обычно вдумчивые, не вопросы)
    if (message.length > 20 && message.length < 500 && !message.includes('?')) {
      return true;
    }

    return false;
  }

  /**
   * Обработка цитаты (вызывается из главного роутера)
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Текст цитаты
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<void>}
   */
  static async handleQuote(ctx, messageText, userProfile) {
    const { ModernQuoteHandler } = require('../handlers/modernQuoteHandler');
    const handler = new ModernQuoteHandler();
    await handler.handleQuote(ctx, messageText, userProfile);
  }

  /**
   * Форматирование числа цитат с правильным склонением
   * @param {number} count - Количество цитат
   * @returns {string} Склонение
   */
  static declensionQuotes(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  }

  /**
   * Получение дружелюбного времени ("2 дня назад")
   * @param {Date} date - Дата
   * @returns {string} Отформатированное время
   */
  static getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 5) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays} дня назад`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} мес. назад`;
    return `${Math.floor(diffDays / 365)} года назад`;
  }

  /**
   * Получение мотивационного сообщения на основе статистики
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {string} Мотивационное сообщение
   */
  static getMotivationalMessage(userProfile) {
    const totalQuotes = userProfile.statistics.totalQuotes;
    const currentStreak = userProfile.statistics.currentStreak;
    const daysSinceReg = Math.floor((new Date() - userProfile.registeredAt) / (1000 * 60 * 60 * 24));

    if (totalQuotes === 0) {
      return "🌱 Время отправить первую цитату! Начните свой дневник мудрости.";
    }

    if (currentStreak >= 7) {
      return `🔥 Невероятно! ${currentStreak} дней подряд с цитатами. Вы на пути к мудрости!`;
    }

    if (totalQuotes >= 50) {
      return "🌟 Вы собрали впечатляющую коллекцию мудрости! Каждая цитата - это шаг к пониманию себя.";
    }

    if (totalQuotes >= 25) {
      return "✨ Четверть сотни цитат! Ваш внутренний мир обогащается с каждым днем.";
    }

    if (daysSinceReg >= 30) {
      return "📚 Месяц с ботом! Время подвести итоги и поразмышлять о пройденном пути.";
    }

    if (daysSinceReg >= 7) {
      return "📖 Неделя размышлений! Привычка к мудрости уже формируется.";
    }

    return "💡 Продолжайте собирать моменты вдохновения! Каждая цитата важна.";
  }

  /**
   * Получение рекомендации времени для напоминания
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Array<string>} Рекомендуемые времена
   */
  static getRecommendedReminderTimes(userProfile) {
    // Анализируем время активности пользователя
    const lifestyle = userProfile.testResults?.question2_lifestyle;
    const timeForSelf = userProfile.testResults?.question3_time;

    if (lifestyle?.includes('мама')) {
      // Для мам - рано утром или поздно вечером
      return ['06:30', '22:00'];
    }

    if (timeForSelf?.includes('утром')) {
      return ['08:00', '20:00'];
    }

    if (timeForSelf?.includes('вечером')) {
      return ['09:00', '21:00'];
    }

    // По умолчанию - утро и вечер
    return ['09:00', '19:00'];
  }

  /**
   * Создание сводки активности пользователя
   * @param {string} userId - ID пользователя
   * @param {number} days - Количество дней для анализа
   * @returns {Promise<Object>} Сводка активности
   */
  static async getActivitySummary(userId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const quotes = await Quote.find({
        userId,
        createdAt: { $gte: startDate }
      }).sort({ createdAt: 1 });

      const summary = {
        totalQuotes: quotes.length,
        dailyAverage: Math.round((quotes.length / days) * 10) / 10,
        topCategories: {},
        topAuthors: {},
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        weekDays: Array(7).fill(0), // 0 = Sunday
        timePattern: Array(24).fill(0)
      };

      quotes.forEach(quote => {
        // Категории
        summary.topCategories[quote.category] = (summary.topCategories[quote.category] || 0) + 1;
        
        // Авторы
        if (quote.author) {
          summary.topAuthors[quote.author] = (summary.topAuthors[quote.author] || 0) + 1;
        }
        
        // Настроение
        summary.sentimentDistribution[quote.sentiment] += 1;
        
        // Дни недели
        const dayOfWeek = quote.createdAt.getDay();
        summary.weekDays[dayOfWeek] += 1;
        
        // Часы
        const hour = quote.createdAt.getHours();
        summary.timePattern[hour] += 1;
      });

      return summary;
      
    } catch (error) {
      logger.error(`📖 Error getting activity summary: ${error.message}`);
      return null;
    }
  }

  /**
   * Проверка лимитов пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} Информация о лимитах
   */
  static async checkUserLimits(userId) {
    try {
      // Проверяем дневной лимит цитат
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayQuotes = await Quote.countDocuments({
        userId,
        createdAt: { $gte: today }
      });

      const dailyLimit = 10;
      const remaining = Math.max(0, dailyLimit - todayQuotes);

      return {
        daily: {
          used: todayQuotes,
          limit: dailyLimit,
          remaining: remaining,
          canAddMore: remaining > 0
        },
        resetTime: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      };
      
    } catch (error) {
      logger.error(`📖 Error checking user limits: ${error.message}`);
      return {
        daily: { used: 0, limit: 10, remaining: 10, canAddMore: true },
        resetTime: new Date()
      };
    }
  }

  /**
   * Получение статистики всех helper'ов
   * @returns {Object} Общая статистика
   */
  static getStats() {
    return {
      features: {
        complexQuestionDetection: true,
        generalAIConversation: true,
        quoteProcessing: true,
        achievementSystem: true,
        statisticsTracking: true,
        motivationalMessages: true,
        activityAnalysis: true,
        userLimitChecking: true
      },
      integrations: {
        claudeAI: true,
        ticketingService: true,
        userProfiles: true,
        quoteAnalysis: true
      }
    };
  }
}

module.exports = BotHelpers;