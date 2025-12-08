/**
 * @fileoverview Telegram bot handlers for feedback collection
 * Handles /feedback command and monthly feedback prompts with inline rating buttons
 * @author g1orgi89
 */

const Feedback = require('../../models/Feedback');
const { UserProfile } = require('../../models');
const logger = require('../../utils/logger');

/**
 * State management for feedback collection
 * Maps telegramId to { feedbackId, timestamp } for awaiting comment on existing feedback
 */
const awaitingOnce = new Map();

/**
 * Create keyboard with one-row golden star buttons
 * @returns {Object} Inline keyboard markup with 5 star buttons in a single row
 */
function starsRowKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '⭐️☆☆☆☆', callback_data: 'fb:rate:1' },
        { text: '⭐️⭐️☆☆☆', callback_data: 'fb:rate:2' },
        { text: '⭐️⭐️⭐️☆☆', callback_data: 'fb:rate:3' },
        { text: '⭐️⭐️⭐️⭐️☆', callback_data: 'fb:rate:4' },
        { text: '⭐️⭐️⭐️⭐️⭐️', callback_data: 'fb:rate:5' }
      ]
    ]
  };
}

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
      const telegramId = ctx.from.id.toString();

      // Validate rating
      if (rating < 1 || rating > 5) {
        await ctx.answerCbQuery('Неверный рейтинг');
        return;
      }

      // Answer callback query immediately
      await ctx.answerCbQuery();

      // Lookup userId by telegramId (optional)
      let userId = null;
      try {
        const userProfile = await UserProfile.findOne({ userId: telegramId }).lean();
        if (userProfile) {
          userId = userProfile._id;
        }
      } catch (lookupError) {
        logger.warn(`⚠️ Could not lookup userId for telegramId ${telegramId}:`, lookupError.message);
        // Continue without userId - it's optional
      }

      // Create a single Feedback document
      const feedback = new Feedback({
        telegramId,
        userId, // May be null
        rating,
        context: 'monthly_report',
        source: 'telegram',
        text: '' // Will be updated later if user sends comment
      });

      await feedback.save();
      logger.info(`✅ Feedback created: ${feedback._id} from user ${telegramId}, rating: ${rating}`);

      // Visual star representations
      const starDisplay = ['⭐️☆☆☆☆', '⭐️⭐️☆☆☆', '⭐️⭐️⭐️☆☆', '⭐️⭐️⭐️⭐️☆', '⭐️⭐️⭐️⭐️⭐️'][rating - 1];

      // Edit the original message to remove keyboard and show selected rating
      try {
        await ctx.editMessageText(
          `Ваша оценка: ${starDisplay}\n\nСпасибо за вашу оценку!`,
          { reply_markup: { inline_keyboard: [] } }
        );
      } catch (editError) {
        // If edit fails, it's not critical, continue
        logger.warn('⚠️ Could not edit message:', editError.message);
      }

      // Store feedbackId in awaitingOnce state for comment follow-up
      awaitingOnce.set(telegramId, {
        feedbackId: feedback._id.toString(),
        timestamp: Date.now()
      });

      // Prompt for comment with ForceReply
      await ctx.reply(
        `Напишите, что улучшить в приложении «Читатель»:`,
        {
          reply_markup: {
            force_reply: true,
            input_field_placeholder: 'Напишите, что улучшить…',
            selective: true
          }
        }
      );
    } catch (error) {
      logger.error('❌ Error handling feedback rating callback:', error);
      await ctx.answerCbQuery('Ошибка при сохранении оценки');
    }
  });

  /**
   * Handle text messages as potential feedback comments
   * Only processes if user is in awaitingOnce state and message is a reply to our ForceReply
   */
  bot.on('text', async (ctx, next) => {
    try {
      const telegramId = ctx.from.id.toString();
      const state = awaitingOnce.get(telegramId);

      // Check if this is a reply to our ForceReply prompt
      const isReplyToBot = ctx.message.reply_to_message && 
                          ctx.message.reply_to_message.from.is_bot;

      // Check if this text is a feedback comment
      if (state && state.feedbackId && isReplyToBot && !ctx.message.text.startsWith('/')) {
        const text = ctx.message.text.trim();

        // Update the existing feedback document by _id with the comment text
        try {
          const feedback = await Feedback.findByIdAndUpdate(
            state.feedbackId,
            { 
              text: text,
              updatedAt: new Date()
            },
            { 
              new: true
            }
          );

          if (feedback) {
            logger.info(`✅ Feedback ${feedback._id} updated with comment`);
            await ctx.reply('Спасибо! Ваш комментарий сохранён 💬');
          } else {
            logger.error(`❌ Feedback ${state.feedbackId} not found for update`);
            await ctx.reply('Спасибо за ваш отзыв!');
          }
        } catch (dbError) {
          logger.error('❌ Error updating feedback with comment:', dbError);
          await ctx.reply('Спасибо за ваш отзыв!');
        }

        // Clean up state
        awaitingOnce.delete(telegramId);
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
  await ctx.reply(
    `Как вам приложение «Читатель» в этом месяце?`,
    {
      reply_markup: starsRowKeyboard()
    }
  );
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
      await bot.telegram.sendMessage(
        userId,
        `Как вам приложение «Читатель» в этом месяце?`,
        {
          reply_markup: starsRowKeyboard()
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

  for (const [telegramId, state] of awaitingOnce.entries()) {
    if (state.timestamp < oneHourAgo) {
      awaitingOnce.delete(telegramId);
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
  starsRowKeyboard
};
