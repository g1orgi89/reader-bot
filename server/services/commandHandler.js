/**
 * @fileoverview Обработчик команд Telegram бота "Читатель"
 * @author g1orgi89
 */

const QuoteHandler = require('./quoteHandler');
const AchievementService = require('./achievementService');
const { Quote, UserProfile } = require('../models');

/**
 * Сервис обработки команд Telegram бота
 */
class CommandHandler {
  constructor() {
    this.quoteHandler = new QuoteHandler();
    this.achievementService = new AchievementService();
  }

  /**
   * Обработать команду /help
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleHelp(ctx) {
    const helpText = `📖 *Команды бота "Читатель":*

/start - начать работу с ботом
/help - эта справка  
/search - поиск по вашим цитатам
/stats - ваша статистика чтения
/settings - настройки напоминаний

*Как пользоваться:*
• Просто отправляйте цитаты текстом
• Указывайте автора в скобках: (Толстой)
• Лимит: 10 цитат в день

*Примеры:*
\`"Счастье внутри нас" (Будда)\`
\`Жизнь прекрасна - Неизвестный автор\`
\`Мудрость приходит с опытом\`

*Отчеты:* каждое воскресенье в 11:00
*Вопросы:* пишите прямо в чат, я передам Анне

📚 "Хватит сидеть в телефоне - читайте книги!"`;
    
    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }

  /**
   * Обработать команду /search
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleSearch(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      // Получаем последние 15 цитат пользователя
      const quotes = await Quote.find({ userId })
        .sort({ createdAt: -1 })
        .limit(15);
      
      if (quotes.length === 0) {
        await ctx.reply(`📖 У вас пока нет сохраненных цитат.

Отправьте первую цитату прямо сейчас!

*Пример:*
\`"В каждом слове — целая жизнь" (Марина Цветаева)\``, 
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Формируем список цитат
      let searchText = `🔍 *Ваши последние цитаты:*\n\n`;
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        const shortText = quote.text.length > 80 ? 
          quote.text.substring(0, 77) + '...' : quote.text;
        
        const dateStr = quote.createdAt.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short'
        });
        
        searchText += `${index + 1}. "${shortText}"${author}\n`;
        searchText += `   📅 ${dateStr} • ${quote.category}\n\n`;
      });

      searchText += `📊 Всего цитат: ${quotes.length}${quotes.length >= 15 ? '+' : ''}`;

      // Добавляем кнопки для детального поиска
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔍 Поиск по тексту", callback_data: "search_text" }],
          [{ text: "👤 Поиск по автору", callback_data: "search_author" }],
          [{ text: "📚 По категориям", callback_data: "search_category" }]
        ]
      };

      await ctx.reply(searchText, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error in handleSearch:', error);
      await ctx.reply('Произошла ошибка при поиске цитат. Попробуйте позже.');
    }
  }

  /**
   * Обработать команду /stats
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleStats(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const stats = await this.quoteHandler.getUserStats(userId);
      
      if (!stats) {
        await ctx.reply('Данные статистики недоступны. Попробуйте позже.');
        return;
      }

      // Получаем недавние достижения
      const recentAchievements = stats.achievements.recentAchievements;
      
      const statsText = `📊 *Статистика ${stats.name}:*

📖 *Цитаты:*
└ Всего собрано: ${stats.totalQuotes}
└ Текущая серия: ${stats.currentStreak} ${this._getDaysWord(stats.currentStreak)}
└ Рекорд серии: ${stats.longestStreak} ${this._getDaysWord(stats.longestStreak)}

🕐 *Время с ботом:*
└ ${stats.daysSinceRegistration} ${this._getDaysWord(stats.daysSinceRegistration)}

👤 *Любимые авторы:*
${stats.favoriteAuthors.length > 0 ? 
  stats.favoriteAuthors.map((author, i) => `${i + 1}. ${author}`).join('\n') :
  'Пока не определились'
}

🏆 *Достижения:*
└ Получено: ${stats.achievements.unlockedAchievements}/${stats.achievements.totalAchievements}
└ Прогресс: ${stats.achievements.completionRate}%

${recentAchievements.length > 0 ? 
  `*Последние достижения:*\n${recentAchievements.map(a => `${a.icon} ${a.name}`).join('\n')}` : 
  '*Новых достижений пока нет*'
}

💡 Продолжайте собирать моменты вдохновения!`;

      // Кнопки для дополнительных действий
      const keyboard = {
        inline_keyboard: [
          [{ text: "🏆 Все достижения", callback_data: "show_achievements" }],
          [{ text: "📈 Прогресс по месяцам", callback_data: "show_monthly_stats" }],
          [{ text: "🔍 Найти цитаты", callback_data: "quick_search" }]
        ]
      };

      await ctx.reply(statsText, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error in handleStats:', error);
      await ctx.reply('Произошла ошибка при получении статистики. Попробуйте позже.');
    }
  }

  /**
   * Обработать команду /settings
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleSettings(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const user = await UserProfile.findOne({ userId });
      
      if (!user) {
        await ctx.reply('Профиль не найден. Попробуйте команду /start');
        return;
      }

      const reminderStatus = user.settings.reminderEnabled ? "✅ включены" : "❌ выключены";
      const reminderTimes = user.settings.reminderTimes.length > 0 ? 
        user.settings.reminderTimes.join(', ') : 'не установлено';

      const settingsText = `⚙️ *Настройки профиля:*

👤 *Профиль:*
└ Имя: ${user.name}
└ Email: ${user.email}
└ Источник: ${user.source}

🔔 *Напоминания:*
└ Статус: ${reminderStatus}
└ Время: ${reminderTimes}

📊 *Статистика:*
└ Зарегистрирован: ${user.registeredAt.toLocaleDateString('ru-RU')}
└ Онбординг: ${user.isOnboardingComplete ? 'завершен' : 'не завершен'}
└ Язык: ${user.settings.language}`;

      const keyboard = {
        inline_keyboard: [
          [{
            text: user.settings.reminderEnabled ? "🔕 Отключить напоминания" : "🔔 Включить напоминания",
            callback_data: "toggle_reminders"
          }],
          [{ text: "⏰ Изменить время", callback_data: "change_reminder_time" }],
          [{ text: "📧 Изменить email", callback_data: "change_email" }],
          [{ text: "🔙 Назад", callback_data: "close_settings" }]
        ]
      };

      await ctx.reply(settingsText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error in handleSettings:', error);
      await ctx.reply('Произошла ошибка при загрузке настроек. Попробуйте позже.');
    }
  }

  /**
   * Показать все достижения пользователя
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async showAchievements(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const progress = await this.achievementService.getUserAchievementProgress(userId);
      
      if (progress.length === 0) {
        await ctx.reply('Ошибка загрузки достижений. Попробуйте позже.');
        return;
      }

      // Группируем достижения по статусу
      const unlocked = progress.filter(p => p.isUnlocked);
      const locked = progress.filter(p => !p.isUnlocked);

      let achievementsText = `🏆 *Ваши достижения:*\n\n`;

      // Полученные достижения
      if (unlocked.length > 0) {
        achievementsText += `✅ *Получено (${unlocked.length}):*\n`;
        unlocked.forEach(achievement => {
          const date = achievement.unlockedAt.toLocaleDateString('ru-RU');
          achievementsText += `${achievement.icon} ${achievement.name}\n`;
          achievementsText += `   ${achievement.description}\n`;
          achievementsText += `   📅 Получено: ${date}\n\n`;
        });
      }

      // Заблокированные достижения с прогрессом
      if (locked.length > 0) {
        achievementsText += `🔒 *В процессе (${locked.length}):`\n`;
        locked.forEach(achievement => {
          const progressBar = this._createProgressBar(achievement.progress);
          achievementsText += `${achievement.icon} ${achievement.name}\n`;
          achievementsText += `   ${progressBar} ${achievement.currentValue}/${achievement.targetValue}\n`;
          achievementsText += `   ${achievement.description}\n\n`;
        });
      }

      const completionRate = Math.round((unlocked.length / progress.length) * 100);
      achievementsText += `📊 Прогресс: ${completionRate}% (${unlocked.length}/${progress.length})`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "📊 Статистика", callback_data: "show_stats" }],
          [{ text: "🔍 Найти цитаты", callback_data: "quick_search" }],
          [{ text: "🔙 Назад", callback_data: "close_achievements" }]
        ]
      };

      await ctx.reply(achievementsText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error in showAchievements:', error);
      await ctx.reply('Произошла ошибка при загрузке достижений. Попробуйте позже.');
    }
  }

  /**
   * Обработать поиск по тексту
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} searchText - Текст для поиска
   * @returns {Promise<void>}
   */
  async handleTextSearch(ctx, searchText) {
    try {
      const userId = ctx.from.id.toString();
      const quotes = await this.quoteHandler.searchQuotes(userId, searchText, 10);
      
      if (quotes.length === 0) {
        await ctx.reply(`🔍 По запросу "${searchText}" ничего не найдено.

Попробуйте другие слова или проверьте написание.`);
        return;
      }

      let resultText = `🔍 *Результаты поиска "${searchText}":*\n\n`;
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        const shortText = quote.text.length > 70 ? 
          quote.text.substring(0, 67) + '...' : quote.text;
        
        resultText += `${index + 1}. "${shortText}"${author}\n`;
        resultText += `   📅 ${quote.ageInDays} дн. назад • ${quote.category}\n\n`;
      });

      resultText += `📊 Найдено: ${quotes.length} ${this._getQuotesWord(quotes.length)}`;

      await ctx.reply(resultText, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('Error in handleTextSearch:', error);
      await ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
    }
  }

  /**
   * Переключить напоминания
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async toggleReminders(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const user = await UserProfile.findOne({ userId });
      
      if (!user) {
        await ctx.reply('Профиль не найден.');
        return;
      }

      const newStatus = !user.settings.reminderEnabled;
      user.settings.reminderEnabled = newStatus;
      await user.save();

      const statusText = newStatus ? "включены" : "отключены";
      const emoji = newStatus ? "🔔" : "🔕";
      
      await ctx.reply(`${emoji} Напоминания ${statusText}.

${newStatus ? 
  'Теперь я буду напоминать вам о цитатах в установленное время.' : 
  'Вы больше не будете получать напоминания о цитатах.'
}`);

    } catch (error) {
      console.error('Error in toggleReminders:', error);
      await ctx.reply('Произошла ошибка при изменении настроек.');
    }
  }

  /**
   * Создать прогресс-бар для достижений
   * @param {number} progress - Прогресс в процентах (0-100)
   * @returns {string} Прогресс-бар
   * @private
   */
  _createProgressBar(progress) {
    const filledBlocks = Math.round(progress / 10);
    const emptyBlocks = 10 - filledBlocks;
    return '▓'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  }

  /**
   * Получить правильное склонение слова "день"
   * @param {number} count - Количество дней
   * @returns {string} Склонение
   * @private
   */
  _getDaysWord(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'день';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'дня';
    return 'дней';
  }

  /**
   * Получить правильное склонение слова "цитата"
   * @param {number} count - Количество цитат
   * @returns {string} Склонение
   * @private
   */
  _getQuotesWord(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитата';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  }

  /**
   * Обработать callback запросы
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleCallback(ctx) {
    const data = ctx.callbackQuery.data;

    try {
      switch (data) {
        case 'show_achievements':
          await this.showAchievements(ctx);
          break;
        
        case 'show_stats':
          await this.handleStats(ctx);
          break;
        
        case 'quick_search':
          await this.handleSearch(ctx);
          break;
        
        case 'toggle_reminders':
          await this.toggleReminders(ctx);
          break;
        
        case 'search_text':
          await ctx.reply('🔍 Напишите слово или фразу для поиска в ваших цитатах:');
          // Здесь нужно установить состояние ожидания ввода
          break;
        
        case 'search_author':
          await ctx.reply('👤 Напишите имя автора для поиска:');
          // Здесь нужно установить состояние ожидания ввода
          break;
        
        case 'search_category':
          await this._showCategorySearch(ctx);
          break;
        
        case 'close_settings':
        case 'close_achievements':
          await ctx.deleteMessage();
          break;
        
        default:
          if (data.startsWith('category_')) {
            await this._handleCategorySearch(ctx, data.replace('category_', ''));
          }
          break;
      }

      // Отвечаем на callback query
      await ctx.answerCbQuery();

    } catch (error) {
      console.error('Error in handleCallback:', error);
      await ctx.answerCbQuery('Произошла ошибка');
    }
  }

  /**
   * Показать поиск по категориям
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   * @private
   */
  async _showCategorySearch(ctx) {
    const categories = [
      'Саморазвитие', 'Любовь', 'Философия', 'Мотивация', 
      'Мудрость', 'Творчество', 'Отношения', 'Материнство'
    ];

    const keyboard = {
      inline_keyboard: categories.map(category => ([{
        text: category,
        callback_data: `category_${category}`
      }]))
    };

    await ctx.reply('📚 Выберите категорию для поиска:', {
      reply_markup: keyboard
    });
  }

  /**
   * Обработать поиск по категории
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} category - Категория
   * @returns {Promise<void>}
   * @private
   */
  async _handleCategorySearch(ctx, category) {
    try {
      const userId = ctx.from.id.toString();
      const quotes = await Quote.find({ 
        userId, 
        category 
      }).sort({ createdAt: -1 }).limit(10);

      if (quotes.length === 0) {
        await ctx.reply(`📚 В категории "${category}" пока нет цитат.

Добавьте первую цитату по этой теме!`);
        return;
      }

      let resultText = `📚 *Цитаты в категории "${category}":*\n\n`;
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        const shortText = quote.text.length > 70 ? 
          quote.text.substring(0, 67) + '...' : quote.text;
        
        resultText += `${index + 1}. "${shortText}"${author}\n\n`;
      });

      resultText += `📊 Показано: ${quotes.length} ${this._getQuotesWord(quotes.length)}`;

      await ctx.reply(resultText, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('Error in _handleCategorySearch:', error);
      await ctx.reply('Произошла ошибка при поиске по категории.');
    }
  }
}

module.exports = CommandHandler;