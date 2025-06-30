/**
 * Helper methods for Reader Telegram Bot - completing the implementation
 * @file telegram/helpers/botHelpers.js
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');
const claudeService = require('../../server/services/claude');
const ticketingService = require('../../server/services/ticketing');
const conversationService = require('../../server/services/conversation');
const messageService = require('../../server/services/message');

/**
 * Helper methods for ReaderTelegramBot
 * These are the missing implementations from the main bot class
 */
class BotHelpers {
  
  /**
   * Check if message is a complex question needing Anna's personal attention
   * @param {string} message - Message text
   * @returns {Promise<boolean>}
   */
  static async isComplexQuestion(message) {
    const complexPatterns = [
      /помогите/i,
      /не понимаю/i,
      /проблема/i,
      /консультация/i,
      /не работает/i,
      /ошибка/i,
      /депрессия/i,
      /не знаю что делать/i,
      /можете посоветовать/i,
      /помогите разобраться/i
    ];

    // Check for complex question patterns
    if (complexPatterns.some(pattern => pattern.test(message))) {
      return true;
    }

    // Check message length (very long messages often need personal attention)
    if (message.length > 500) {
      return true;
    }

    return false;
  }

  /**
   * Handle complex question that needs Anna's attention
   * @param {Object} ctx - Telegram context
   * @param {string} message - Message text
   * @param {Object} userProfile - User profile
   */
  static async handleComplexQuestion(ctx, message, userProfile) {
    const userId = ctx.from.id.toString();

    try {
      // Create ticket through existing ticketing service
      const ticket = await ticketingService.createTicket({
        userId: userId,
        conversationId: ctx.chat.id.toString(),
        subject: `Вопрос от ${userProfile.name} (@${userProfile.telegramUsername})`,
        initialMessage: message,
        context: `Пользователь: ${userProfile.name}\nEmail: ${userProfile.email}\nТелеграм: @${userProfile.telegramUsername}\nИсточник: ${userProfile.source}`,
        priority: 'medium',
        category: 'personal_question',
        language: 'ru',
        email: userProfile.email,
        metadata: {
          source: 'telegram_bot',
          userRegistered: userProfile.registeredAt,
          totalQuotes: await Quote.countDocuments({ userId })
        }
      });

      const responseMessage = `📝 Этот вопрос требует персонального внимания Анны.

Я передала ваше сообщение, и она свяжется с вами в ближайшее время.

*Ваш контакт для связи:*
📱 Telegram: @${userProfile.telegramUsername}
📧 Email: ${userProfile.email}

*Номер обращения:* ${ticket.ticketId}`;

      await ctx.replyWithMarkdown(responseMessage);

      logger.info(`📖 Complex question ticket created: ${ticket.ticketId} for user ${userId}`);

    } catch (error) {
      logger.error(`📖 Error creating ticket: ${error.message}`);
      await ctx.reply("📝 Произошла ошибка при передаче вопроса Анне. Попробуйте написать позже или обратитесь по email.");
    }
  }

  /**
   * Handle general message with Anna Busel's AI
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Message text
   * @param {Object} userProfile - User profile
   */
  static async handleGeneralMessage(ctx, messageText, userProfile) {
    const userId = ctx.from.id.toString();

    try {
      // Get conversation context
      let conversationId;
      try {
        const conversation = await conversationService.getOrCreateConversation(userId, {
          platform: 'telegram',
          chatId: ctx.chat.id.toString(),
          userInfo: {
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username
          }
        });
        conversationId = conversation._id;
      } catch (error) {
        logger.error(`📖 Error managing conversation: ${error.message}`);
        conversationId = null;
      }

      // Get message history
      let history = [];
      try {
        if (conversationId) {
          history = await messageService.getRecentMessages(conversationId, 5);
        }
      } catch (error) {
        logger.error(`📖 Error getting message history: ${error.message}`);
        history = [];
      }

      // Generate Anna Busel's response
      const systemContext = `You are Anna Busel, a psychologist and founder of "Book Club by Psychologist". 
      You help people understand themselves through books and quotes. 
      User's name: ${userProfile.name}. 
      User's test results: ${JSON.stringify(userProfile.testResults)}.
      Respond in Russian, use "Вы" form.
      Style: warm, professional, book-focused.
      Use phrases like "Хватит сидеть в телефоне - читайте книги!" when appropriate.`;

      const response = await claudeService.generateResponse(messageText, {
        userId,
        platform: 'telegram',
        history: history.map(msg => ({
          role: msg.role,
          content: msg.text
        })),
        useRag: true,
        ragLimit: 3,
        systemContext
      });

      // Save messages to database
      if (conversationId) {
        try {
          await messageService.create({
            text: messageText,
            role: 'user',
            userId,
            conversationId,
            metadata: { source: 'telegram' }
          });

          await messageService.create({
            text: response.message,
            role: 'assistant',
            userId,
            conversationId,
            metadata: { 
              source: 'telegram',
              tokensUsed: response.tokensUsed
            }
          });
        } catch (error) {
          logger.error(`📖 Error saving messages: ${error.message}`);
        }
      }

      await BotHelpers.sendResponse(ctx, response.message);

    } catch (error) {
      logger.error(`📖 Error generating response: ${error.message}`);
      await ctx.reply("📖 Извините, у меня возникли технические трудности. Попробуйте еще раз через минуту.");
    }
  }

  /**
   * Handle other callback queries (feedback, recommendations, etc.)
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Callback data
   */
  static async handleOtherCallbacks(ctx, callbackData) {
    // Handle feedback callbacks (for weekly/monthly reports)
    if (callbackData.startsWith('feedback_')) {
      const [, type, rating, reportId] = callbackData.split('_');
      
      // TODO: Implement feedback handling with WeeklyReport/MonthlyReport models
      await ctx.answerCbQuery("Спасибо за обратную связь!");
      await ctx.editMessageText(
        `✅ Спасибо за оценку! Ваш отзыв поможет сделать отчеты лучше.`
      );
      return;
    }

    // Handle book recommendation callbacks
    if (callbackData.startsWith('book_')) {
      const bookTitle = callbackData.replace('book_', '').replace(/_/g, ' ');
      
      // TODO: Track UTM clicks and redirect to Anna's books
      await ctx.answerCbQuery(`Перехожу к книге: ${bookTitle}`);
      return;
    }

    // Default handler
    await ctx.answerCbQuery("Функция пока недоступна.");
  }

  /**
   * Update user statistics after quote submission
   * @param {string} userId - User ID
   * @param {string|null} author - Quote author
   */
  static async updateUserStatistics(userId, author) {
    try {
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) return;

      // Update total quotes
      userProfile.statistics.totalQuotes += 1;

      // Update favorite authors
      if (author && !userProfile.statistics.favoriteAuthors.includes(author)) {
        userProfile.statistics.favoriteAuthors.push(author);
        if (userProfile.statistics.favoriteAuthors.length > 10) {
          userProfile.statistics.favoriteAuthors = userProfile.statistics.favoriteAuthors.slice(-10);
        }
      }

      // Update streak
      const lastQuote = await Quote.findOne({ userId }).sort({ createdAt: -1 }).skip(1);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (lastQuote) {
        const lastQuoteDate = new Date(lastQuote.createdAt);
        lastQuoteDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((today - lastQuoteDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          userProfile.statistics.currentStreak += 1;
          if (userProfile.statistics.currentStreak > userProfile.statistics.longestStreak) {
            userProfile.statistics.longestStreak = userProfile.statistics.currentStreak;
          }
        } else if (daysDiff > 1) {
          userProfile.statistics.currentStreak = 1;
        }
      } else {
        userProfile.statistics.currentStreak = 1;
        userProfile.statistics.longestStreak = 1;
      }

      await userProfile.save();
    } catch (error) {
      logger.error(`📖 Error updating user statistics: ${error.message}`);
    }
  }

  /**
   * Send response with message splitting for long texts
   * @param {Object} ctx - Telegram context
   * @param {string} message - Message to send
   * @param {number} maxLength - Maximum message length
   */
  static async sendResponse(ctx, message, maxLength = 4096) {
    try {
      const chunks = BotHelpers.splitMessage(message, maxLength);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          await ctx.replyWithMarkdown(chunk);
        } catch (markdownError) {
          await ctx.reply(chunk);
        }
        
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      logger.error(`📖 Error sending response: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при отправке ответа. Попробуйте еще раз.');
    }
  }

  /**
   * Split long message into chunks
   * @param {string} message - Original message
   * @param {number} maxLength - Maximum length per chunk
   * @returns {string[]} Array of message chunks
   */
  static splitMessage(message, maxLength = 4096) {
    if (message.length <= maxLength) {
      return [message];
    }

    const chunks = [];
    let currentChunk = '';
    const lines = message.split('\n');

    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If one line is too long
        if (line.length > maxLength) {
          const words = line.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if ((wordChunk + word + ' ').length > maxLength) {
              if (wordChunk.trim()) {
                chunks.push(wordChunk.trim());
                wordChunk = '';
              }
            }
            wordChunk += word + ' ';
          }
          
          if (wordChunk.trim()) {
            currentChunk = wordChunk.trim() + '\n';
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Check if user has reached achievements
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of new achievements
   */
  static async checkAchievements(userId) {
    try {
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) return [];

      const newAchievements = [];
      const totalQuotes = await Quote.countDocuments({ userId });

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
          id: 'classics_lover',
          name: 'Любитель классики',
          description: '10 цитат классиков',
          icon: '📖',
          targetValue: 10,
          type: 'classics_count'
        }
      ];

      for (const achievement of achievements) {
        // Check if user already has this achievement
        if (userProfile.achievements.some(a => a.achievementId === achievement.id)) {
          continue;
        }

        let unlocked = false;

        switch (achievement.type) {
          case 'quotes_count':
            unlocked = totalQuotes >= achievement.targetValue;
            break;
          case 'streak_days':
            unlocked = userProfile.statistics.currentStreak >= achievement.targetValue;
            break;
          case 'classics_count':
            const classicsCount = await Quote.countDocuments({
              userId,
              author: { $in: ['Толстой', 'Достоевский', 'Пушкин', 'Чехов', 'Тургенев'] }
            });
            unlocked = classicsCount >= achievement.targetValue;
            break;
        }

        if (unlocked) {
          userProfile.achievements.push({
            achievementId: achievement.id,
            unlockedAt: new Date()
          });
          newAchievements.push(achievement);
        }
      }

      if (newAchievements.length > 0) {
        await userProfile.save();
      }

      return newAchievements;
    } catch (error) {
      logger.error(`📖 Error checking achievements: ${error.message}`);
      return [];
    }
  }

  /**
   * Notify user about new achievements
   * @param {Object} ctx - Telegram context
   * @param {Array} achievements - Array of achievements
   */
  static async notifyAchievements(ctx, achievements) {
    for (const achievement of achievements) {
      const message = `🎉 *Поздравляю!*

Вы получили достижение:
${achievement.icon} *${achievement.name}*
${achievement.description}

Продолжайте собирать моменты вдохновения!`;

      try {
        await ctx.replyWithMarkdown(message);
      } catch (error) {
        await ctx.reply(message.replace(/\*/g, ''));
      }
    }
  }
}

module.exports = BotHelpers;