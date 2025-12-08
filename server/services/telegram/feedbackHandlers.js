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
 */
function registerFeedbackHandlers(bot) {
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

      // Visual star representations
      const starDisplay = ['★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'][rating - 1];

      // Edit the original message to remove keyboard and show selected rating
      try {
        await ctx.editMessageText(
          `Ваша оценка: ${starDisplay}\n\nСпасибо!`,
          { reply_markup: { inline_keyboard: [] } }
        );
      } catch (editError) {
        // If edit fails, it's not critical, continue
        logger.warn('⚠️ Could not edit message:', editError.message);
      }

      // Save rating to database immediately
      await saveFeedback(userId, rating, '', 'monthly_report');

      // Store state for comment follow-up
      feedbackStates.set(userId, {
        rating,
        timestamp: Date.now(),
        messageId: ctx.callbackQuery.message.message_id
      });

      // Prompt for comment with ForceReply
      if (rating <= 3) {
        // For low ratings, enforce minimum length
        await ctx.reply(
          `Пожалуйста, расскажите, что можно улучшить в приложении «Читатель»?\n` +
          `(Минимум 10 символов, максимум 300)`,
          {
            reply_markup: {
              force_reply: true,
              selective: true
            }
          }
        );
      } else {
        // For high ratings, comment is optional
        await ctx.reply(
          `Рады, что вам нравится приложение «Читатель»! 📚✨\n\n` +
          `Если хотите что-то добавить, напишите комментарий (необязательно, до 300 символов):`,
          {
            reply_markup: {
              force_reply: true,
              selective: true
            }
          }
        );
      }
    } catch (error) {
      logger.error('❌ Error handling feedback rating callback:', error);
      await ctx.answerCbQuery('Ошибка при сохранении оценки');
    }
  });

  /**
   * Handle text messages as potential feedback comments
   * Only processes if user is in feedback state and message is a reply to our ForceReply
   */
  bot.on('text', async (ctx, next) => {
    try {
      const userId = ctx.from.id.toString();
      const state = feedbackStates.get(userId);

      // Check if this is a reply to our ForceReply prompt
      const isReplyToBot = ctx.message.reply_to_message && 
                          ctx.message.reply_to_message.from.is_bot;

      // Check if this text is a feedback comment
      if (state && state.rating && isReplyToBot && !ctx.message.text.startsWith('/')) {
        const text = ctx.message.text.trim();

        // For low ratings (≤3), enforce minimum length of 10 characters
        if (state.rating <= 3 && text.length < 10) {
          await ctx.reply(
            `Пожалуйста, напишите чуть подробнее (минимум 10 символов).\n` +
            `Это поможет нам лучше понять, что улучшить в приложении «Читатель».`,
            {
              reply_markup: {
                force_reply: true,
                selective: true
              }
            }
          );
          return;
        }

        // Validate text length (max 300 characters)
        if (text.length > 300) {
          await ctx.reply(
            `Пожалуйста, сократите комментарий до 300 символов.\n` +
            `Текущая длина: ${text.length} символов.`,
            {
              reply_markup: {
                force_reply: true,
                selective: true
              }
            }
          );
          return;
        }

        // Update the existing feedback record with the comment
        try {
          // Find the most recent feedback for this user and update it
          const feedback = await Feedback.findOneAndUpdate(
            { 
              telegramId: userId,
              rating: state.rating,
              text: '' // Find the one without comment (just saved)
            },
            { 
              text: text.substring(0, 300),
              updatedAt: new Date()
            },
            { 
              sort: { createdAt: -1 },
              new: true
            }
          );

          if (feedback) {
            logger.info(`✅ Feedback updated with comment: ${feedback._id}`);
          } else {
            // If not found, create new feedback with comment
            await saveFeedback(userId, state.rating, text);
          }
        } catch (dbError) {
          logger.error('❌ Error updating feedback with comment:', dbError);
          // Fallback: save as new feedback
          await saveFeedback(userId, state.rating, text);
        }

        await ctx.reply('Спасибо! Ваш комментарий сохранён 💬');

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
        { text: '★☆☆☆☆', callback_data: 'fb:rate:1' },
        { text: '★★☆☆☆', callback_data: 'fb:rate:2' },
        { text: '★★★☆☆', callback_data: 'fb:rate:3' }
      ],
      [
        { text: '★★★★☆', callback_data: 'fb:rate:4' },
        { text: '★★★★★', callback_data: 'fb:rate:5' }
      ]
    ]
  };

  await ctx.reply(
    `Как вам приложение «Читатель» в этом месяце?`,
    {
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
            { text: '★☆☆☆☆', callback_data: 'fb:rate:1' },
            { text: '★★☆☆☆', callback_data: 'fb:rate:2' },
            { text: '★★★☆☆', callback_data: 'fb:rate:3' }
          ],
          [
            { text: '★★★★☆', callback_data: 'fb:rate:4' },
            { text: '★★★★★', callback_data: 'fb:rate:5' }
          ]
        ]
      };

      await bot.telegram.sendMessage(
        userId,
        `Как вам приложение «Читатель» в этом месяце?`,
        {
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
