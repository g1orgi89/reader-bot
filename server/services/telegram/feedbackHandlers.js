/**
 * @fileoverview Telegram bot handlers for feedback collection
 * Handles /feedback command and monthly feedback prompts with inline rating buttons
 * @author g1orgi89
 */

const Feedback = require('../../models/Feedback');
const logger = require('../../utils/logger');

/**
 * State management for feedback collection
 * Maps userId to current feedback state
 */
const feedbackStates = new Map();

/**
 * Register feedback handlers with the bot
 * @param {Object} bot - Telegraf bot instance
 * @param {String} appWebAppUrl - URL of the Mini App (optional, for future deep linking)
 */
function registerFeedbackHandlers(bot, appWebAppUrl = '') {
  if (!bot) {
    logger.error('❌ Cannot register feedback handlers: bot is null or undefined');
    return;
  }

  logger.info('📋 Registering feedback handlers...');

  /**
   * Handle /feedback command
   */
  bot.command('feedback', async (ctx) => {
    try {
      await sendFeedbackPrompt(ctx);
    } catch (error) {
      logger.error('❌ Error handling /feedback command:', error);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
  });

  /**
   * Handle feedback rating callbacks (fb:rate:<rating>)
   */
  bot.action(/^fb:rate:(\d)$/, async (ctx) => {
    try {
      const rating = parseInt(ctx.match[1]);
      const userId = ctx.from.id.toString();

      // Validate rating
      if (rating < 1 || rating > 5) {
        await ctx.answerCbQuery('Неверный рейтинг');
        return;
      }

      // Answer callback query immediately
      await ctx.answerCbQuery();

      // Store state for potential follow-up
      feedbackStates.set(userId, {
        rating,
        timestamp: Date.now()
      });

      // If rating is low (≤3), ask for comment
      if (rating <= 3) {
        await ctx.reply(
          `Спасибо за оценку ${rating} ⭐\n\n` +
          `Пожалуйста, расскажите, что можно улучшить?\n` +
          `(Максимум 300 символов)\n\n` +
          `Или отправьте /skip чтобы пропустить.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // For high ratings, save immediately without comment
        await saveFeedback(userId, rating, '');
        await ctx.reply(
          `Спасибо за отличную оценку ${rating} ⭐!\n\n` +
          `Рады, что вам нравится Reader Bot! 📚✨`,
          { parse_mode: 'Markdown' }
        );
        
        // Clean up state
        feedbackStates.delete(userId);
      }
    } catch (error) {
      logger.error('❌ Error handling feedback rating callback:', error);
      await ctx.answerCbQuery('Ошибка при сохранении оценки');
    }
  });

  /**
   * Handle /skip command to skip feedback comment
   */
  bot.command('skip', async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const state = feedbackStates.get(userId);

      if (!state || !state.rating) {
        await ctx.reply('Нет активного запроса на обратную связь.');
        return;
      }

      // Save feedback without comment
      await saveFeedback(userId, state.rating, '');
      await ctx.reply(
        `Спасибо за вашу оценку ${state.rating} ⭐!\n\n` +
        `Мы продолжаем работать над улучшением бота. 💪`,
        { parse_mode: 'Markdown' }
      );

      // Clean up state
      feedbackStates.delete(userId);
    } catch (error) {
      logger.error('❌ Error handling skip command:', error);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
  });

  /**
   * Handle text messages as potential feedback comments
   * Only processes if user is in feedback state
   */
  bot.on('text', async (ctx, next) => {
    try {
      const userId = ctx.from.id.toString();
      const state = feedbackStates.get(userId);

      // Check if this text is a feedback comment
      if (state && state.rating && !ctx.message.text.startsWith('/')) {
        const text = ctx.message.text.trim();

        // Validate text length
        if (text.length > 300) {
          await ctx.reply(
            `Пожалуйста, сократите комментарий до 300 символов.\n` +
            `Текущая длина: ${text.length} символов.`
          );
          return;
        }

        // Save feedback with comment
        await saveFeedback(userId, state.rating, text);
        await ctx.reply(
          `Спасибо за отзыв! Мы обязательно учтём ваши пожелания. 🙏\n\n` +
          `Ваша оценка: ${state.rating} ⭐`,
          { parse_mode: 'Markdown' }
        );

        // Clean up state
        feedbackStates.delete(userId);
        return;
      }

      // Not a feedback comment, pass to next handler
      await next();
    } catch (error) {
      logger.error('❌ Error handling text as feedback:', error);
      await next();
    }
  });

  logger.info('✅ Feedback handlers registered successfully');
}

/**
 * Send feedback prompt with rating buttons
 * @param {Object} ctx - Telegraf context
 */
async function sendFeedbackPrompt(ctx) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '⭐', callback_data: 'fb:rate:1' },
        { text: '⭐⭐', callback_data: 'fb:rate:2' },
        { text: '⭐⭐⭐', callback_data: 'fb:rate:3' }
      ],
      [
        { text: '⭐⭐⭐⭐', callback_data: 'fb:rate:4' },
        { text: '⭐⭐⭐⭐⭐', callback_data: 'fb:rate:5' }
      ]
    ]
  };

  await ctx.reply(
    `📋 *Как вам Reader Bot в этом месяце?*\n\n` +
    `Пожалуйста, оцените ваш опыт работы с ботом:`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

/**
 * Save feedback to database
 * @param {String} telegramId - User's Telegram ID
 * @param {Number} rating - Rating (1-5)
 * @param {String} text - Feedback text (optional)
 * @param {String} context - Feedback context (default: 'monthly_report')
 */
async function saveFeedback(telegramId, rating, text = '', context = 'monthly_report') {
  try {
    const feedback = new Feedback({
      telegramId,
      rating,
      text: text.trim().substring(0, 300), // Ensure max 300 chars
      context,
      source: 'telegram'
    });

    await feedback.save();
    
    logger.info(`✅ Feedback saved: ${feedback._id} from user ${telegramId}, rating: ${rating}`);
    
    return feedback;
  } catch (error) {
    logger.error('❌ Error saving feedback:', error);
    throw error;
  }
}

/**
 * Send monthly feedback request to active users
 * Called by cron job
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<String>} userIds - Array of Telegram user IDs to send to
 */
async function sendMonthlyFeedbackRequest(bot, userIds = []) {
  if (!bot) {
    logger.error('❌ Cannot send monthly feedback: bot is null or undefined');
    return { sent: 0, failed: 0 };
  }

  logger.info(`📋 Sending monthly feedback request to ${userIds.length} users...`);

  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      const keyboard = {
        inline_keyboard: [
          [
            { text: '⭐', callback_data: 'fb:rate:1' },
            { text: '⭐⭐', callback_data: 'fb:rate:2' },
            { text: '⭐⭐⭐', callback_data: 'fb:rate:3' }
          ],
          [
            { text: '⭐⭐⭐⭐', callback_data: 'fb:rate:4' },
            { text: '⭐⭐⭐⭐⭐', callback_data: 'fb:rate:5' }
          ]
        ]
      };

      await bot.telegram.sendMessage(
        userId,
        `📋 *Как вам Reader Bot в этом месяце?*\n\n` +
        `Пожалуйста, оцените ваш опыт работы с ботом:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );

      sent++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error(`❌ Failed to send feedback request to user ${userId}:`, error.message);
      failed++;
    }
  }

  logger.info(`📋 Monthly feedback request complete: ${sent} sent, ${failed} failed`);
  
  return { sent, failed };
}

/**
 * Clean up old feedback states (older than 1 hour)
 * Should be called periodically
 */
function cleanupOldStates() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  let cleaned = 0;

  for (const [userId, state] of feedbackStates.entries()) {
    if (state.timestamp < oneHourAgo) {
      feedbackStates.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`🧹 Cleaned up ${cleaned} old feedback states`);
  }
}

// Clean up old states every hour
setInterval(cleanupOldStates, 60 * 60 * 1000);

module.exports = {
  registerFeedbackHandlers,
  sendFeedbackPrompt,
  sendMonthlyFeedbackRequest,
  saveFeedback
};
