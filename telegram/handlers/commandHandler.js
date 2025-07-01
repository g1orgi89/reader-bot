/**
 * @fileoverview Обработчик команд пользователя для бота "Читатель"
 * @author g1orgi89
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');

/**
 * @typedef {import('../../server/types/reader').UserProfile} UserProfile
 * @typedef {import('../../server/types/reader').Quote} Quote
 */

/**
 * Класс для обработки команд пользователя
 */
class CommandHandler {
  constructor() {
    /**
     * @type {Object} - Список доступных команд
     */
    this.commands = {
      help: this.handleHelp.bind(this),
      stats: this.handleStats.bind(this),
      search: this.handleSearch.bind(this),
      settings: this.handleSettings.bind(this)
    };

    logger.info('📖 CommandHandler initialized');
  }

  /**
   * Обработка команды /help
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async handleHelp(ctx) {
    try {
      const helpText = `📖 *Команды бота «Читатель»:*

/start - начать работу с ботом
/help - эта справка  
/search - поиск по вашим цитатам
/stats - ваша статистика чтения
/settings - настройки напоминаний

*Как пользоваться:*
• Просто отправляйте цитаты текстом
• Указывайте автора в скобках: (Толстой)
• Лимит: 10 цитат в день

*Отчеты:* каждое воскресенье в 11:00
*Вопросы:* пишите прямо в чат, я передам Анне

💡 Хватит сидеть в телефоне - читайте книги!

_«Читатель» создан психологом Анной Бусел для превращения случайных цитат в персональный дневник роста._`;
      
      await ctx.reply(helpText, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error(`📖 Error in /help command: ${error.message}`);
      await ctx.reply('📖 Я могу помочь вам с сохранением цитат и рекомендациями книг! Просто отправьте мне цитату.');
    }
  }

  /**
   * Обработка команды /search
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async handleSearch(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      // Получаем последние цитаты пользователя
      const quotes = await Quote.find({ userId })
        .sort({ createdAt: -1 })
        .limit(15);
      
      if (quotes.length === 0) {
        await ctx.reply(
          "📖 У вас пока нет сохраненных цитат. Отправьте первую!\n\n" +
          "💡 Просто напишите любую цитату, которая вам нравится."
        );
        return;
      }

      let searchText = "🔍 *Ваши последние цитаты:*\n\n";
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` _(${quote.author})_` : '';
        const date = quote.createdAt.toLocaleDateString('ru-RU');
        const truncatedText = quote.text.length > 80 
          ? quote.text.substring(0, 80) + '...' 
          : quote.text;
        
        searchText += `${index + 1}. "${truncatedText}"${author}\n`;
        searchText += `    📅 ${date} | 🏷️ ${quote.category}\n\n`;
      });

      searchText += "_Для более детального поиска напишите ключевое слово после команды: /search любовь_";

      await ctx.reply(searchText, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error(`📖 Error in /search command: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при поиске цитат. Попробуйте позже.');
    }
  }

  /**
   * Обработка команды /search с поисковым запросом
   * @param {Object} ctx - Telegram context
   * @param {string} searchQuery - Поисковый запрос
   * @returns {Promise<void>}
   */
  async handleSearchWithQuery(ctx, searchQuery) {
    try {
      const userId = ctx.from.id.toString();
      
      // Поиск по тексту, автору и категории
      const quotes = await Quote.searchUserQuotes(userId, searchQuery, 10);
      
      if (quotes.length === 0) {
        await ctx.reply(
          `🔍 По запросу "${searchQuery}" ничего не найдено.\n\n` +
          "Попробуйте другие ключевые слова или посмотрите все цитаты командой /search"
        );
        return;
      }

      let searchText = `🔍 *Найдено по запросу "${searchQuery}":*\n\n`;
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` _(${quote.author})_` : '';
        const date = quote.createdAt.toLocaleDateString('ru-RU');
        
        searchText += `${index + 1}. "${quote.text}"${author}\n`;
        searchText += `    📅 ${date} | 🏷️ ${quote.category}\n\n`;
      });

      await ctx.reply(searchText, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error(`📖 Error in search with query: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при поиске. Попробуйте еще раз.');
    }
  }

  /**
   * Обработка команды /stats
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async handleStats(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile || !userProfile.isOnboardingComplete) {
        await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        return;
      }

      // Получаем актуальную статистику
      const totalQuotes = await Quote.countDocuments({ userId });
      const todayQuotes = await Quote.getTodayQuotesCount(userId);
      
      // Статистика за неделю
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekQuotes = await Quote.countDocuments({
        userId,
        createdAt: { $gte: weekStart }
      });

      // Статистика за месяц
      const monthStart = new Date();
      monthStart.setDate(monthStart.getDate() - 30);
      const monthQuotes = await Quote.countDocuments({
        userId,
        createdAt: { $gte: monthStart }
      });

      // Топ категории
      const topCategories = await Quote.aggregate([
        { $match: { userId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 }
      ]);

      // Формируем статистику
      const daysSinceRegistration = Math.floor(
        (new Date() - userProfile.registeredAt) / (1000 * 60 * 60 * 24)
      );

      let statsText = `📊 *Ваша статистика в «Читателе»:*\n\n`;
      statsText += `📖 Цитат собрано: *${totalQuotes}*\n`;
      statsText += `📅 Сегодня: ${todayQuotes}/10\n`;
      statsText += `📈 За неделю: ${weekQuotes}\n`;
      statsText += `📆 За месяц: ${monthQuotes}\n\n`;
      
      statsText += `🔥 Текущая серия: *${userProfile.statistics.currentStreak}* дней\n`;
      statsText += `⭐ Рекорд серии: *${userProfile.statistics.longestStreak}* дней\n`;
      statsText += `📚 С ботом: ${daysSinceRegistration} дней\n\n`;

      // Любимые авторы
      if (userProfile.statistics.favoriteAuthors.length > 0) {
        statsText += `*Любимые авторы:*\n`;
        userProfile.statistics.favoriteAuthors.slice(0, 3).forEach((author, i) => {
          statsText += `${i + 1}. ${author}\n`;
        });
        statsText += '\n';
      }

      // Топ категории
      if (topCategories.length > 0) {
        statsText += `*Популярные темы:*\n`;
        topCategories.forEach((cat, i) => {
          statsText += `${i + 1}. ${cat._id} (${cat.count})\n`;
        });
        statsText += '\n';
      }

      // Достижения
      statsText += `🏆 *Достижения:* ${userProfile.achievements.length}\n\n`;

      // Мотивационное сообщение
      if (totalQuotes === 0) {
        statsText += `🌱 Время отправить первую цитату!`;
      } else if (totalQuotes < 10) {
        statsText += `📖 Отличное начало! Продолжайте собирать мудрость.`;
      } else if (totalQuotes < 50) {
        statsText += `✨ Впечатляющая коллекция! Вы на верном пути.`;
      } else {
        statsText += `🌟 Вы истинный коллекционер мудрости!`;
      }

      statsText += `\n\n💡 Продолжайте собирать моменты вдохновения!`;

      await ctx.reply(statsText, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error(`📖 Error in /stats command: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при получении статистики. Попробуйте позже.');
    }
  }

  /**
   * Обработка команды /settings
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async handleSettings(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile || !userProfile.isOnboardingComplete) {
        await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        return;
      }

      const reminderStatus = userProfile.settings.reminderEnabled 
        ? "✅ Включены" 
        : "❌ Выключены";
      
      const reminderTimes = userProfile.settings.reminderTimes.length > 0
        ? userProfile.settings.reminderTimes.join(', ')
        : "Не настроены";

      await ctx.reply("⚙️ *Настройки напоминаний:*", {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ 
              text: `Напоминания: ${reminderStatus}`,
              callback_data: "toggle_reminders"
            }],
            [{ 
              text: `⏰ Время: ${reminderTimes}`,
              callback_data: "change_reminder_time"
            }],
            [{ 
              text: "📊 Экспорт цитат",
              callback_data: "export_quotes"
            }],
            [{ 
              text: "🔙 Закрыть",
              callback_data: "close_settings"
            }]
          ]
        }
      });
      
    } catch (error) {
      logger.error(`📖 Error in /settings command: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке настроек. Попробуйте позже.');
    }
  }

  /**
   * Обработка callback'ов настроек
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback'а
   * @returns {Promise<boolean>} true если callback был обработан
   */
  async handleSettingsCallback(ctx, callbackData) {
    try {
      await ctx.answerCbQuery();
      const userId = ctx.from.id.toString();

      switch (callbackData) {
        case 'toggle_reminders':
          await this._toggleReminders(ctx, userId);
          return true;
          
        case 'change_reminder_time':
          await this._showTimeSettings(ctx, userId);
          return true;
          
        case 'export_quotes':
          await this._exportQuotes(ctx, userId);
          return true;
          
        case 'close_settings':
          await ctx.deleteMessage();
          return true;
          
        default:
          if (callbackData.startsWith('set_time_')) {
            await this._setReminderTime(ctx, userId, callbackData);
            return true;
          }
          return false;
      }
    } catch (error) {
      logger.error(`📖 Error in settings callback: ${error.message}`);
      await ctx.answerCbQuery("Произошла ошибка. Попробуйте еще раз.");
      return true;
    }
  }

  /**
   * Переключение напоминаний
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} userId - ID пользователя
   */
  async _toggleReminders(ctx, userId) {
    const userProfile = await UserProfile.findOne({ userId });
    
    userProfile.settings.reminderEnabled = !userProfile.settings.reminderEnabled;
    await userProfile.save();

    const status = userProfile.settings.reminderEnabled ? "включены" : "выключены";
    const statusIcon = userProfile.settings.reminderEnabled ? "✅" : "❌";
    
    await ctx.editMessageText(
      `⚙️ Напоминания ${status} ${statusIcon}\n\n` +
      "Вы можете настроить время напоминаний или полностью отключить их.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ 
              text: `Напоминания: ${statusIcon} ${status}`,
              callback_data: "toggle_reminders"
            }],
            [{ 
              text: "⏰ Настроить время",
              callback_data: "change_reminder_time"
            }],
            [{ 
              text: "🔙 Назад",
              callback_data: "close_settings"
            }]
          ]
        }
      }
    );
  }

  /**
   * Показать настройки времени
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} userId - ID пользователя
   */
  async _showTimeSettings(ctx, userId) {
    await ctx.editMessageText(
      "⏰ *Выберите время для напоминаний:*\n\n" +
      "Напоминания помогают не забывать сохранять интересные цитаты.",
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🌅 Утром (09:00)", callback_data: "set_time_09:00" },
              { text: "🌆 Вечером (19:00)", callback_data: "set_time_19:00" }
            ],
            [
              { text: "🌅🌆 Утром и вечером", callback_data: "set_time_both" }
            ],
            [
              { text: "🚫 Отключить", callback_data: "set_time_none" }
            ],
            [
              { text: "🔙 Назад", callback_data: "close_settings" }
            ]
          ]
        }
      }
    );
  }

  /**
   * Установить время напоминаний
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} userId - ID пользователя
   * @param {string} callbackData - Данные callback'а
   */
  async _setReminderTime(ctx, userId, callbackData) {
    const userProfile = await UserProfile.findOne({ userId });
    
    const timeOption = callbackData.replace('set_time_', '');
    
    switch (timeOption) {
      case '09:00':
        userProfile.settings.reminderTimes = ['09:00'];
        userProfile.settings.reminderEnabled = true;
        break;
      case '19:00':
        userProfile.settings.reminderTimes = ['19:00'];
        userProfile.settings.reminderEnabled = true;
        break;
      case 'both':
        userProfile.settings.reminderTimes = ['09:00', '19:00'];
        userProfile.settings.reminderEnabled = true;
        break;
      case 'none':
        userProfile.settings.reminderTimes = [];
        userProfile.settings.reminderEnabled = false;
        break;
    }

    await userProfile.save();

    let message = "⚙️ *Настройки сохранены!*\n\n";
    
    if (userProfile.settings.reminderEnabled) {
      const times = userProfile.settings.reminderTimes.join(' и ');
      message += `✅ Напоминания включены в ${times}\n\n`;
      message += "Частота напоминаний будет уменьшаться со временем:\n";
      message += "• 1-я неделя: каждый день\n";
      message += "• 2-3 недели: через день\n";
      message += "• 4+ недели: 2-3 раза в неделю";
    } else {
      message += "❌ Напоминания отключены";
    }

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 К настройкам", callback_data: "close_settings" }]
        ]
      }
    });
  }

  /**
   * Экспорт цитат пользователя
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} userId - ID пользователя
   */
  async _exportQuotes(ctx, userId) {
    try {
      const quotes = await Quote.find({ userId })
        .sort({ createdAt: 1 });

      if (quotes.length === 0) {
        await ctx.editMessageText(
          "📖 У вас пока нет цитат для экспорта.\n\nОтправьте первую цитату!",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 Назад", callback_data: "close_settings" }]
              ]
            }
          }
        );
        return;
      }

      // Формируем текстовый файл с цитатами
      let exportText = `📖 Мои цитаты из бота «Читатель»\n`;
      exportText += `Экспорт от ${new Date().toLocaleDateString('ru-RU')}\n`;
      exportText += `Всего цитат: ${quotes.length}\n\n`;
      exportText += `${'='.repeat(50)}\n\n`;

      quotes.forEach((quote, index) => {
        exportText += `${index + 1}. "${quote.text}"\n`;
        if (quote.author) {
          exportText += `   — ${quote.author}\n`;
        }
        exportText += `   📅 ${quote.createdAt.toLocaleDateString('ru-RU')}\n`;
        exportText += `   🏷️ ${quote.category}\n\n`;
      });

      exportText += `${'='.repeat(50)}\n`;
      exportText += `Создано ботом «Читатель» от психолога Анны Бусел\n`;
      exportText += `💡 Хватит сидеть в телефоне - читайте книги!`;

      // Отправляем как документ
      const buffer = Buffer.from(exportText, 'utf8');
      const filename = `quotes_${new Date().toISOString().split('T')[0]}.txt`;

      await ctx.replyWithDocument({
        source: buffer,
        filename: filename
      }, {
        caption: `📖 Ваши цитаты (${quotes.length} шт.)\n\nСохраните файл для личного архива!`
      });

      await ctx.deleteMessage();

    } catch (error) {
      logger.error(`📖 Error exporting quotes: ${error.message}`);
      await ctx.editMessageText(
        "📖 Произошла ошибка при экспорте. Попробуйте позже.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Назад", callback_data: "close_settings" }]
            ]
          }
        }
      );
    }
  }

  /**
   * Проверка прав доступа к команде
   * @param {string} command - Команда
   * @param {string} userId - ID пользователя
   * @returns {Promise<boolean>} Есть ли доступ
   */
  async hasAccess(command, userId) {
    // Все команды доступны зарегистрированным пользователям
    if (command === 'help') return true; // help доступен всем

    const userProfile = await UserProfile.findOne({ userId });
    return userProfile && userProfile.isOnboardingComplete;
  }

  /**
   * Получить список доступных команд
   * @returns {Array<string>} Список команд
   */
  getAvailableCommands() {
    return Object.keys(this.commands);
  }

  /**
   * Получить статистику команд
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      totalCommands: Object.keys(this.commands).length,
      availableCommands: this.getAvailableCommands(),
      features: {
        userStatistics: true,
        quoteSearch: true,
        reminderSettings: true,
        quoteExport: true,
        helpSystem: true
      }
    };
  }
}

module.exports = { CommandHandler };