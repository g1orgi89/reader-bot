/**
 * @fileoverview Вспомогательные функции для бота "Читатель"
 * @author g1orgi89
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');

/**
 * Класс с вспомогательными функциями для Telegram бота "Читатель"
 */
class BotHelpers {
  /**
   * Обновить статистику пользователя
   * @param {string} userId - ID пользователя
   * @param {string|null} author - Автор цитаты
   * @returns {Promise<void>}
   */
  static async updateUserStatistics(userId, author = null) {
    try {
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) return;

      await userProfile.updateQuoteStats(author);
      logger.info(`📖 Updated statistics for user ${userId}`);
      
    } catch (error) {
      logger.error(`📖 Error updating user statistics: ${error.message}`);
    }
  }

  /**
   * Проверить достижения пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array>} Новые достижения
   */
  static async checkAchievements(userId) {
    try {
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) return [];

      const newAchievements = [];
      const totalQuotes = userProfile.statistics.totalQuotes;
      const currentStreak = userProfile.statistics.currentStreak;

      // Достижения для проверки
      const achievements = [
        {
          id: 'first_quote',
          name: 'Первые шаги',
          description: 'Сохранили первую цитату',
          icon: '🌱',
          targetValue: 1,
          type: 'quotes_count'
        },
        {
          id: 'wisdom_collector',
          name: 'Коллекционер мудрости', 
          description: 'Собрали 25 цитат',
          icon: '📚',
          targetValue: 25,
          type: 'quotes_count'
        },
        {
          id: 'week_philosopher',
          name: 'Философ недели',
          description: '7 дней подряд с цитатами',
          icon: '🔥',
          targetValue: 7,
          type: 'streak_days'
        },
        {
          id: 'month_sage',
          name: 'Мудрец месяца',
          description: '30 дней подряд с цитатами',
          icon: '🌟',
          targetValue: 30,
          type: 'streak_days'
        },
        {
          id: 'classics_lover',
          name: 'Любитель классики',
          description: '10 цитат классиков',
          icon: '📖',
          targetValue: 10,
          type: 'classics_count'
        },
        {
          id: 'century_collector',
          name: 'Коллекционер века',
          description: '100 цитат в коллекции',
          icon: '💎',
          targetValue: 100,
          type: 'quotes_count'
        }
      ];

      for (const achievement of achievements) {
        // Проверяем, есть ли уже это достижение
        if (userProfile.achievements.some(a => a.achievementId === achievement.id)) {
          continue;
        }

        let unlocked = false;

        switch (achievement.type) {
          case 'quotes_count':
            unlocked = totalQuotes >= achievement.targetValue;
            break;
          case 'streak_days':
            unlocked = currentStreak >= achievement.targetValue;
            break;
          case 'classics_count':
            const classicsCount = await Quote.countDocuments({
              userId,
              author: { $in: ['Толстой', 'Достоевский', 'Пушкин', 'Чехов', 'Тургенев', 'Лермонтов', 'Гоголь'] }
            });
            unlocked = classicsCount >= achievement.targetValue;
            break;
        }

        if (unlocked) {
          await userProfile.addAchievement(achievement.id);
          newAchievements.push(achievement);
        }
      }

      return newAchievements;
      
    } catch (error) {
      logger.error(`📖 Error checking achievements: ${error.message}`);
      return [];
    }
  }

  /**
   * Уведомить о достижениях
   * @param {Object} ctx - Telegram context
   * @param {Array} achievements - Массив достижений
   * @returns {Promise<void>}
   */
  static async notifyAchievements(ctx, achievements) {
    try {
      for (const achievement of achievements) {
        const message = `🎉 *Поздравляю!*

Вы получили достижение:
${achievement.icon} *${achievement.name}*
${achievement.description}

Продолжайте собирать моменты вдохновения!`;

        await ctx.replyWithMarkdown(message);
        
        // Небольшая задержка между уведомлениями
        if (achievements.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      logger.error(`📖 Error notifying achievements: ${error.message}`);
    }
  }

  /**
   * Проверить, является ли сообщение сложным вопросом
   * @param {string} messageText - Текст сообщения
   * @returns {Promise<boolean>}
   */
  static async isComplexQuestion(messageText) {
    const complexQuestionPatterns = [
      /помогите/i,
      /не понимаю/i,
      /проблема/i,
      /консультация/i,
      /не работает/i,
      /ошибка/i,
      /депрессия/i,
      /не знаю что делать/i,
      /можете посоветовать/i,
      /помогите разобраться/i,
      /у меня вопрос/i,
      /как мне быть/i,
      /что делать если/i
    ];

    // Проверяем длину сообщения
    if (messageText.length > 500) return true;
    
    // Проверяем паттерны
    return complexQuestionPatterns.some(pattern => pattern.test(messageText));
  }

  /**
   * Обработать сложный вопрос
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Текст сообщения
   * @param {Object} userProfile - Профиль пользователя
   * @returns {Promise<void>}
   */
  static async handleComplexQuestion(ctx, messageText, userProfile) {
    try {
      // Создаем тикет для Анны (если есть тикетинг система)
      const response = `Этот вопрос требует персонального внимания Анны. 
Я передала ваше сообщение, и она свяжется с вами в ближайшее время.

Ваш контакт для связи:
📱 Telegram: @${userProfile.telegramUsername || 'не указан'}
📧 Email: ${userProfile.email}

💡 А пока продолжайте собирать цитаты - они помогают лучше понять себя!`;

      await ctx.reply(response);
      
      // Логируем для последующей обработки
      logger.info(`📖 Complex question from user ${userProfile.userId}: "${messageText.substring(0, 100)}..."`);
      
    } catch (error) {
      logger.error(`📖 Error handling complex question: ${error.message}`);
      await ctx.reply('📖 Я передам ваш вопрос Анне. Она свяжется с вами в ближайшее время.');
    }
  }

  /**
   * Обработать обычное сообщение
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Текст сообщения
   * @param {Object} userProfile - Профиль пользователя
   * @returns {Promise<void>}
   */
  static async handleGeneralMessage(ctx, messageText, userProfile) {
    try {
      const responses = [
        "Интересная мысль! А что, если записать её как цитату? Даже собственные размышления заслуживают места в вашем дневнике мудрости.",
        "📖 Похоже на глубокую мысль! Попробуйте оформить её как цитату - возможно, это станет важным моментом для размышления.",
        "Мне нравится ваш ход мыслей. В «Читателе» лучше всего работает с цитатами - попробуйте отправить что-то, что вас вдохновило!",
        "💭 Интересно! А знаете, что делает Анна в таких случаях? Ищет мудрую цитату, которая поможет взглянуть на ситуацию под новым углом."
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      await ctx.reply(randomResponse);
      
    } catch (error) {
      logger.error(`📖 Error handling general message: ${error.message}`);
      await ctx.reply('📖 Попробуйте отправить мне цитату - я лучше всего работаю с мудрыми словами!');
    }
  }

  /**
   * Обработать другие callback запросы
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback
   * @returns {Promise<void>}
   */
  static async handleOtherCallbacks(ctx, callbackData) {
    try {
      if (callbackData.startsWith('feedback_')) {
        await this._handleFeedbackCallback(ctx, callbackData);
        return;
      }

      if (callbackData.startsWith('book_')) {
        await this._handleBookCallback(ctx, callbackData);
        return;
      }

      // Если callback не распознан
      await ctx.answerCbQuery("Функция пока не доступна");
      
    } catch (error) {
      logger.error(`📖 Error handling callback: ${error.message}`);
      await ctx.answerCbQuery("Произошла ошибка");
    }
  }

  /**
   * Обработать callback обратной связи
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback
   */
  static async _handleFeedbackCallback(ctx, callbackData) {
    // Пример: feedback_excellent_reportId
    const parts = callbackData.split('_');
    if (parts.length !== 3) return;
    
    const rating = parts[1]; // excellent, good, bad
    const reportId = parts[2];
    
    let responseMessage;
    switch (rating) {
      case 'excellent':
        responseMessage = "🎉 Спасибо за отзыв! Рада, что отчет оказался полезным.";
        break;
      case 'good':
        responseMessage = "👌 Спасибо! Продолжаем работать над улучшениями.";
        break;
      case 'bad':
        responseMessage = "😔 Извините, что отчет не оправдал ожиданий. Мы учтем ваши пожелания.";
        break;
      default:
        responseMessage = "Спасибо за обратную связь!";
    }

    await ctx.editMessageText(responseMessage);
    
    // Здесь можно сохранить обратную связь в базу данных
    logger.info(`📖 Feedback received: ${rating} for report ${reportId}`);
  }

  /**
   * Обработать callback книжных рекомендаций
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback
   */
  static async _handleBookCallback(ctx, callbackData) {
    // Пример: book_details_bookId
    const parts = callbackData.split('_');
    if (parts.length !== 3) return;
    
    const action = parts[1]; // details, buy
    const bookId = parts[2];
    
    if (action === 'details') {
      await ctx.answerCbQuery("Подробности книги скоро будут доступны!");
    } else if (action === 'buy') {
      await ctx.answerCbQuery("Перенаправляем на страницу покупки...");
    }
  }

  /**
   * Получить номер недели ISO
   * @param {Date} [date] - Дата (по умолчанию текущая)
   * @returns {number}
   */
  static getWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Проверить достигнут ли дневной лимит цитат
   * @param {string} userId - ID пользователя
   * @param {number} limit - Лимит цитат
   * @returns {Promise<boolean>}
   */
  static async isDailyLimitReached(userId, limit = 10) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayQuotesCount = await Quote.countDocuments({
        userId,
        createdAt: {
          $gte: today,
          $lt: tomorrow
        }
      });

      return todayQuotesCount >= limit;
      
    } catch (error) {
      logger.error(`📖 Error checking daily limit: ${error.message}`);
      return false;
    }
  }

  /**
   * Получить случайную мотивирующую фразу от Анны
   * @returns {string}
   */
  static getRandomMotivationalQuote() {
    const quotes = [
      "💡 Хватит сидеть в телефоне - читайте книги!",
      "📚 Хорошая жизнь строится, а не дается по умолчанию",
      "🌟 Почитайте в клубе хотя бы несколько лет и ваша жизнь изменится до неузнаваемости",
      "📖 Каждая цитата - это ключ к пониманию себя",
      "✨ Мудрость приходит к тем, кто ее ищет",
      "🔍 В каждой книге есть что-то для вашей души",
      "💎 Собирайте моменты вдохновения каждый день"
    ];

    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  /**
   * Форматировать время "назад"
   * @param {Date} date - Дата
   * @returns {string}
   */
  static formatTimeAgo(date) {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'только что';
    if (diffInMinutes < 60) return `${diffInMinutes} мин. назад`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ч. назад`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} дн. назад`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks} нед. назад`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} мес. назад`;
  }

  /**
   * Склонение слов
   * @param {number} count - Количество
   * @param {Array<string>} forms - Формы слова [1, 2-4, 5+]
   * @returns {string}
   */
  static declension(count, forms) {
    if (count % 10 === 1 && count % 100 !== 11) return forms[0];
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return forms[1];
    return forms[2];
  }

  /**
   * Проверить является ли пользователь новичком
   * @param {Object} userProfile - Профиль пользователя
   * @returns {boolean}
   */
  static isNewUser(userProfile) {
    const daysSinceRegistration = Math.floor((new Date() - userProfile.registeredAt) / (1000 * 60 * 60 * 24));
    return daysSinceRegistration <= 7;
  }

  /**
   * Получить приветственное сообщение в зависимости от времени дня
   * @returns {string}
   */
  static getTimeBasedGreeting() {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 12) return 'Доброе утро';
    if (hour >= 12 && hour < 17) return 'Добрый день';
    if (hour >= 17 && hour < 22) return 'Добрый вечер';
    return 'Доброй ночи';
  }
}

module.exports = BotHelpers;