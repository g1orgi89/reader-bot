/**
 * Clean Command Handler - simple menu commands for Reader bot
 * @file telegram/handlers/commandHandler.js
 * 🎨 CLEAN UX: Simple responses, accessed via menu button
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');

class CommandHandler {
  constructor() {
    logger.info('✅ CommandHandler initialized for menu button navigation');
  }

  /**
   * Handle /help command
   */
  async handleHelp(ctx) {
    try {
      const helpText = 
        '📖 Справка по боту "Читатель"\n\n' +
        'Основные функции:\n' +
        '• Отправляйте цитаты текстом\n' +
        '• Указывайте автора в скобках: (Толстой)\n' +
        '• Лимит: 10 цитат в день\n\n' +
        'Команды (доступны через кнопку меню 📋):\n' +
        '/stats - ваша статистика чтения\n' +
        '/search - поиск по вашим цитатам\n' +
        '/settings - настройки напоминаний\n' +
        '/help - эта справка\n\n' +
        'Отчеты: каждое воскресенье в 11:00\n\n' +
        'Вопросы? Просто напишите в чат, я передам Анне.';
      
      await ctx.reply(helpText);
      
    } catch (error) {
      logger.error(`Error in handleHelp: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз.');
    }
  }

  /**
   * Handle /search command
   */
  async handleSearch(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      const quotes = await Quote.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10);
      
      if (quotes.length === 0) {
        await ctx.reply(
          '🔍 У вас пока нет сохраненных цитат.\n\n' +
          'Отправьте первую цитату, чтобы начать собирать дневник мудрости!'
        );
        return;
      }

      let searchText = `🔍 Ваши последние ${quotes.length} цитат:\n\n`;
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        const date = quote.createdAt.toLocaleDateString('ru-RU');
        searchText += `${index + 1}. "${quote.text}"${author}\n📅 ${date}\n\n`;
      });

      if (quotes.length === 10) {
        searchText += '💡 Показаны последние 10 цитат. Всего у вас больше!';
      }

      await ctx.reply(searchText);
      
    } catch (error) {
      logger.error(`Error in handleSearch: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при поиске цитат.');
    }
  }

  /**
   * Handle /stats command
   */
  async handleStats(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      const profile = await UserProfile.findOne({ userId });
      if (!profile) {
        await ctx.reply('📖 Профиль не найден. Попробуйте /start');
        return;
      }

      const totalQuotes = await Quote.countDocuments({ userId });
      
      // Calculate days with bot
      const daysWithBot = Math.floor(
        (new Date() - new Date(profile.registeredAt)) / (1000 * 60 * 60 * 24)
      );

      let statsText = 
        `📊 Статистика ${profile.name}\n\n` +
        `📖 Цитат собрано: ${totalQuotes}\n` +
        `🔥 Текущая серия: ${profile.statistics.currentStreak} дней\n` +
        `⭐ Рекорд серии: ${profile.statistics.longestStreak} дней\n` +
        `📅 С ботом: ${daysWithBot} дней\n\n`;

      if (profile.statistics.favoriteAuthors.length > 0) {
        statsText += 'Любимые авторы:\n';
        profile.statistics.favoriteAuthors.slice(0, 5).forEach((author, i) => {
          statsText += `${i + 1}. ${author}\n`;
        });
        statsText += '\n';
      }

      if (profile.achievements.length > 0) {
        statsText += `🏆 Достижения: ${profile.achievements.length}`;
      } else {
        statsText += '🏆 Достижения: пока нет, но скоро будут!';
      }

      await ctx.reply(statsText);
      
    } catch (error) {
      logger.error(`Error in handleStats: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке статистики.');
    }
  }

  /**
   * Handle /settings command
   */
  async handleSettings(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      const profile = await UserProfile.findOne({ userId });
      if (!profile) {
        await ctx.reply('📖 Профиль не найден. Попробуйте /start');
        return;
      }

      const reminderStatus = profile.settings.reminderEnabled ? 'включены' : 'выключены';
      const reminderTimes = profile.settings.reminderTimes.join(', ');

      const settingsText = 
        '⚙️ Настройки\n\n' +
        `📧 Email: ${profile.email}\n` +
        `🔔 Напоминания: ${reminderStatus}\n` +
        `⏰ Время напоминаний: ${reminderTimes}\n\n` +
        'Чтобы изменить настройки, напишите:\n' +
        '• "отключить напоминания" - выключить\n' +
        '• "включить напоминания" - включить\n' +
        '• "время 10:00,20:00" - изменить время';

      await ctx.reply(settingsText, {
        reply_markup: {
          inline_keyboard: [
            [
              { 
                text: profile.settings.reminderEnabled ? "🔕 Выключить напоминания" : "🔔 Включить напоминания",
                callback_data: "toggle_reminders"
              }
            ]
          ]
        }
      });
      
    } catch (error) {
      logger.error(`Error in handleSettings: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке настроек.');
    }
  }

  /**
   * Handle settings callback
   */
  async handleSettingsCallback(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const data = ctx.callbackQuery.data;

      if (data === 'toggle_reminders') {
        const profile = await UserProfile.findOne({ userId });
        if (!profile) {
          await ctx.answerCbQuery('Профиль не найден');
          return;
        }

        profile.settings.reminderEnabled = !profile.settings.reminderEnabled;
        await profile.save();

        const status = profile.settings.reminderEnabled ? 'включены' : 'выключены';
        await ctx.answerCbQuery(`Напоминания ${status}`);
        
        // Update message
        const settingsText = 
          '⚙️ Настройки обновлены\n\n' +
          `📧 Email: ${profile.email}\n` +
          `🔔 Напоминания: ${status}\n` +
          `⏰ Время: ${profile.settings.reminderTimes.join(', ')}`;

        await ctx.editMessageText(settingsText);
      }
      
    } catch (error) {
      logger.error(`Error in handleSettingsCallback: ${error.message}`);
      await ctx.answerCbQuery('Произошла ошибка');
    }
  }

  /**
   * Handle settings text changes
   */
  async handleSettingsText(ctx, messageText) {
    try {
      const userId = ctx.from.id.toString();
      const text = messageText.toLowerCase().trim();

      const profile = await UserProfile.findOne({ userId });
      if (!profile) return false;

      // Turn off reminders
      if (text.includes('отключить напоминания') || text.includes('выключить напоминания')) {
        profile.settings.reminderEnabled = false;
        await profile.save();
        await ctx.reply('🔕 Напоминания отключены');
        return true;
      }

      // Turn on reminders
      if (text.includes('включить напоминания')) {
        profile.settings.reminderEnabled = true;
        await profile.save();
        await ctx.reply('🔔 Напоминания включены');
        return true;
      }

      // Change reminder times
      const timeMatch = text.match(/время\s+(\d{1,2}:\d{2}(?:,\s*\d{1,2}:\d{2})*)/);
      if (timeMatch) {
        const times = timeMatch[1].split(',').map(t => t.trim());
        
        // Validate times
        const validTimes = times.filter(time => /^\d{1,2}:\d{2}$/.test(time));
        
        if (validTimes.length > 0) {
          profile.settings.reminderTimes = validTimes;
          await profile.save();
          await ctx.reply(`⏰ Время напоминаний изменено на: ${validTimes.join(', ')}`);
          return true;
        } else {
          await ctx.reply('❌ Неверный формат времени. Используйте: 09:00,19:00');
          return true;
        }
      }

      return false;
      
    } catch (error) {
      logger.error(`Error in handleSettingsText: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle unknown commands
   */
  async handleUnknownCommand(ctx) {
    try {
      await ctx.reply(
        '❓ Неизвестная команда.\n\n' +
        'Используйте кнопку меню 📋 для доступа к командам\n' +
        'или /help для справки.'
      );
    } catch (error) {
      logger.error(`Error in handleUnknownCommand: ${error.message}`);
    }
  }

  /**
   * Check if message is a command
   */
  isCommand(messageText) {
    return messageText && messageText.startsWith('/');
  }

  /**
   * Check if message is settings-related
   */
  isSettingsMessage(messageText) {
    if (!messageText) return false;
    
    const text = messageText.toLowerCase();
    return text.includes('напоминания') || 
           text.includes('время') || 
           text.includes('настройки');
  }
}

module.exports = { CommandHandler };
