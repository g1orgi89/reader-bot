/**
 * @fileoverview Обработчик команд Telegram бота "Читатель" с расширенными настройками напоминаний
 * 📋 UPDATED: Добавлена обработка месячных отчётов (опрос и рейтинг)
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
    this.reminderService = null; // Будет инициализирован позже
    this.monthlyReportService = null; // 📋 NEW: Сервис месячных отчётов
  }

  /**
   * Инициализация с зависимостями
   * @param {Object} dependencies - Зависимости
   * @param {Object} dependencies.reminderService - Сервис напоминаний
   * @param {Object} dependencies.monthlyReportService - 📋 NEW: Сервис месячных отчётов
   */
  initialize(dependencies) {
    this.reminderService = dependencies.reminderService;
    this.monthlyReportService = dependencies.monthlyReportService; // 📋 NEW
  }

  /**
   * Обработать команду /help
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleHelp(ctx) {
    const helpText = `📖 *Команды бота \"Читатель\":*\n\n/start - начать работу с ботом\n/help - эта справка  \n/search - поиск по вашим цитатам\n/stats - статистика и достижения\n/settings - настройки напоминаний\n\n*Как пользоваться:*\n• Просто отправляйте цитаты текстом\n• Указывайте автора в скобках: (Толстой)\n• Лимит: 10 цитат в день\n\n*Примеры:*\n\\`\"Счастье внутри нас\" (Будда)\\`\n\\`Жизнь прекрасна - Неизвестный автор\\`\n\\`Мудрость приходит с опытом\\`\n\n*Вопросы:* пишите прямо в чат, я передам Анне\n\n📚 \"Хватит сидеть в телефоне - читайте книги!\"`;\n    \n    await ctx.reply(helpText, { parse_mode: 'Markdown' });
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
        await ctx.reply(`📖 У вас пока нет сохраненных цитат.\n\nОтправьте первую цитату прямо сейчас!\n\n*Пример:*\n\\`\"В каждом слове — целая жизнь\" (Марина Цветаева)\\``, 
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Формируем список цитат
      let searchText = `🔍 *Ваши последние цитаты:*\\n\\n`;
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        const shortText = quote.text.length > 80 ? 
          quote.text.substring(0, 77) + '...' : quote.text;
        
        const dateStr = quote.createdAt.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short'
        });
        
        searchText += `${index + 1}. \"${shortText}\"${author}\\n`;
        searchText += `   📅 ${dateStr} • ${quote.category}\\n\\n`;
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
   * Обработать команду /stats - НОВЫЙ РАСШИРЕННЫЙ ФОРМАТ
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

      // Получаем детальный прогресс по достижениям
      const achievementProgress = await this.achievementService.getUserAchievementProgress(userId);
      
      // Формируем основную статистику
      const statsText = `📊 *Статистика ${stats.name}:*\n\n📖 Цитаты: ${stats.totalQuotes} | Серия: ${stats.currentStreak} ${this._getDaysWord(stats.currentStreak)} | Рекорд: ${stats.longestStreak} ${this._getDaysWord(stats.longestStreak)}\n🕐 С ботом: ${stats.daysSinceRegistration} ${this._getDaysWord(stats.daysSinceRegistration)}\n\n👤 *Любимые авторы:* ${stats.favoriteAuthors.length > 0 ? stats.favoriteAuthors.slice(0, 3).join(', ') : 'Пока не определились'}\n\n${this._formatAchievementsInStats(achievementProgress)}\n\n💡 Продолжайте собирать моменты вдохновения!`;

      // Кнопки для дополнительных действий
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔍 Поиск цитат", callback_data: "quick_search" }],
          [{ text: "⚙️ Настройки", callback_data: "open_settings" }]
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
   * 📖 ОБНОВЛЕНО: Обработать команду /settings с расширенными настройками напоминаний
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

      // Получаем информацию о текущем расписании напоминаний
      const reminderInfo = this.reminderService ? 
        this._getReminderScheduleInfo(user) : 
        'сервис недоступен';

      const reminderStatus = user.settings.reminderEnabled ? "✅ включены" : "❌ выключены";
      const reminderTimes = user.settings.reminderTimes.length > 0 ? 
        user.settings.reminderTimes.join(', ') : 'не установлено';

      const settingsText = `⚙️ *Настройки профиля:*\n\n👤 *Профиль:*\n└ Имя: ${user.name}\n└ Email: ${user.email}\n└ Источник: ${user.source}\n\n🔔 *Напоминания:*\n└ Статус: ${reminderStatus}\n└ Время: ${reminderTimes}\n└ Расписание: ${reminderInfo}\n\n📊 *Статистика:*\n└ Зарегистрирован: ${user.registeredAt.toLocaleDateString('ru-RU')}\n└ Онбординг: ${user.isOnboardingComplete ? 'завершен' : 'не завершен'}\n└ Язык: ${user.settings.language}`;

      const keyboard = {
        inline_keyboard: [
          [{
            text: user.settings.reminderEnabled ? "🔕 Отключить напоминания" : "🔔 Включить напоминания",
            callback_data: "toggle_reminders"
          }],
          [{ text: "⏰ Изменить время", callback_data: "change_reminder_time" }],
          [{ text: "📊 Частота напоминаний", callback_data: "reminder_frequency_info" }],
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
   * 📖 НОВОЕ: Получить информацию о расписании напоминаний для пользователя
   * @param {Object} user - Пользователь
   * @returns {string} Информация о расписании
   * @private
   */
  _getReminderScheduleInfo(user) {
    if (!this.reminderService) {
      return 'сервис недоступен';
    }

    const config = this.reminderService.getReminderConfigForUser(user);
    const registrationDate = new Date(user.registeredAt);
    const now = new Date();
    const weeksSinceRegistration = Math.floor((now - registrationDate) / (1000 * 60 * 60 * 24 * 7));

    const scheduleInfo = {
      'every_other_day': 'через день',
      'twice_weekly': '2 раза в неделю (пн, чт)',
      'weekly': '1 раз в неделю (пн)'
    };

    const stage = weeksSinceRegistration === 0 ? 'новичок' :
                  weeksSinceRegistration <= 3 ? 'активный' : 'опытный';

    return `${scheduleInfo[config.frequency] || config.frequency} (${stage})`;
  }

  /**
   * 📖 НОВОЕ: Показать подробную информацию о частоте напоминаний
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async showReminderFrequencyInfo(ctx) {
    const frequencyText = `🔔 *Как работают напоминания:*\n\nЧастота напоминаний меняется по мере вашего знакомства с ботом:\n\n*📖 Первая неделя (новичок):*\n└ Через день в 19:00\n└ Помогаем привыкнуть к боту\n\n*🎯 2-4 недели (активный):*\n└ 2 раза в неделю (пн, чт) в 19:00\n└ Поддерживаем интерес\n\n*⭐ Месяц+ (опытный):*\n└ 1 раз в неделю (пн) в 19:00\n└ Ненавязчивые напоминания\n\n*💡 Умная логика:*\n• Пропускаем если вы уже были активны сегодня\n• Отключаем автоматически если заблокировали бота\n• Учитываем ваши настройки времени\n\n*⚙️ Персонализация:*\n• Можете выбрать удобное время\n• Можете полностью отключить\n• Анонсы продуктов (25 числа) отдельно`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "⏰ Изменить время", callback_data: "change_reminder_time" }],
        [{ text: "🔙 К настройкам", callback_data: "open_settings" }]
      ]
    };

    await ctx.reply(frequencyText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * 📖 ОБНОВЛЕНО: Переключить напоминания с улучшенной обратной связью
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
      
      let responseText = `${emoji} Напоминания ${statusText}.\n\n`;

      if (newStatus) {
        const scheduleInfo = this._getReminderScheduleInfo(user);
        responseText += `Теперь я буду напоминать вам о цитатах.\n\n*Ваше расписание:* ${scheduleInfo}\n*Время:* ${user.settings.reminderTimes.join(', ')}\n\n💡 Частота напоминаний умная - она адаптируется под ваш опыт использования бота.`;
      } else {
        responseText += `Вы больше не будете получать напоминания о цитатах.`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: "⚙️ Другие настройки", callback_data: "open_settings" }],
          [{ text: "📊 Моя статистика", callback_data: "quick_stats" }]
        ]
      };

      await ctx.reply(responseText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error in toggleReminders:', error);
      await ctx.reply('Произошла ошибка при изменении настроек.');
    }
  }

  /**
   * 📖 НОВОЕ: Изменить время напоминаний
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async changeReminderTime(ctx) {
    const timeText = `⏰ *Выберите удобное время для напоминаний:*\n\nКогда вам удобнее получать напоминания о цитатах?`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🌅 Утром (9:00)", callback_data: "set_time_09:00" }],
        [{ text: "🌆 Вечером (19:00)", callback_data: "set_time_19:00" }],
        [{ text: "🌙 Поздно вечером (21:00)", callback_data: "set_time_21:00" }],
        [{ text: "⏰ Другое время", callback_data: "set_custom_time" }],
        [{ text: "🔙 Назад", callback_data: "open_settings" }]
      ]
    };

    await ctx.reply(timeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * 📖 НОВОЕ: Установить время напоминаний
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} time - Время в формате HH:MM
   * @returns {Promise<void>}
   */
  async setReminderTime(ctx, time) {
    try {
      const userId = ctx.from.id.toString();
      const user = await UserProfile.findOne({ userId });
      
      if (!user) {
        await ctx.reply('Профиль не найден.');
        return;
      }

      // Обновляем настройки напоминаний через ReminderService
      if (this.reminderService) {
        await this.reminderService.updateReminderSettings(userId, {
          enabled: user.settings.reminderEnabled,
          times: [time]
        });
      } else {
        // Fallback если сервис недоступен
        user.settings.reminderTimes = [time];
        await user.save();
      }

      const scheduleInfo = this._getReminderScheduleInfo(user);
      
      await ctx.reply(`✅ Время напоминаний изменено на ${time}\n\n*Ваше новое расписание:*\n└ Время: ${time}\n└ Частота: ${scheduleInfo}\n└ Статус: ${user.settings.reminderEnabled ? 'включены' : 'отключены'}\n\n${user.settings.reminderEnabled ? 
  '🎯 Следующее напоминание придет согласно вашему расписанию.' : 
  '💡 Не забудьте включить напоминания в настройках.'
}`, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error in setReminderTime:', error);
      await ctx.reply('Произошла ошибка при изменении времени напоминаний.');
    }
  }

  /**
   * Форматировать достижения для отображения в статистике
   * @param {Array} achievementProgress - Прогресс по достижениям
   * @returns {string} Отформатированный текст достижений
   * @private
   */
  _formatAchievementsInStats(achievementProgress) {
    if (!achievementProgress || achievementProgress.length === 0) {
      return '🏆 *Достижения:* загружаются...';
    }

    const unlocked = achievementProgress.filter(a => a.isUnlocked);
    const locked = achievementProgress.filter(a => !a.isUnlocked);
    
    let achievementsText = `🏆 *Достижения (${unlocked.length}/${achievementProgress.length}):*\\n`;

    // Показываем полученные достижения
    unlocked.forEach(achievement => {
      achievementsText += `✅ ${achievement.icon} ${achievement.name}\\n`;
    });

    // Показываем заблокированные с прогрессом
    locked.forEach(achievement => {
      const progressBar = this._createProgressBar(achievement.progress);
      const progressText = `${achievement.currentValue}/${achievement.targetValue}`;
      achievementsText += `🔒 ${achievement.icon} ${achievement.name} ${progressBar} ${progressText}\\n`;
    });

    // Добавляем совет для ближайшего достижения
    const nextAchievement = locked.find(a => a.progress > 0) || locked[0];
    if (nextAchievement) {
      const hint = this._getAchievementHint(nextAchievement);
      achievementsText += `\\n💭 *Совет:* ${hint}`;
    }

    return achievementsText;
  }

  /**
   * Показать справку по достижениям
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async showAchievementsGuide(ctx) {
    const guideText = `📚 *Справка по достижениям:*\n\n🎯 *Как получать достижения:*\n\n🌱 *Первые шаги* - отправьте первую цитату\n📚 *Коллекционер мудрости* - соберите 25 цитат\n🔥 *Философ недели* - отправляйте цитаты 7 дней подряд\n📖 *Любитель классики* - 10 цитат от классиков\n💭 *Мыслитель* - 10 собственных мыслей (без автора)\n🏃‍♀️ *Марафонец чтения* - соберите 50 цитат\n🌈 *Разносторонний читатель* - цитаты из 5 категорий\n⭐ *Постоянство* - месяц активного использования\n\n💡 *Советы:*\n• Отправляйте цитаты каждый день для серий\n• Указывайте авторов в скобках: (Толстой)\n• Пробуйте разные темы и категории\n• Добавляйте собственные мысли\n\n📖 \"Каждая цитата - это ступенька к мудрости!\"`;

    await ctx.reply(guideText, { parse_mode: 'Markdown' });
  }

  /**
   * Получить подсказку как получить достижение
   * @param {Object} achievement - Достижение
   * @returns {string} Подсказка
   * @private
   */
  _getAchievementHint(achievement) {
    const hints = {
      'first_quote': 'Отправьте любую цитату боту',
      'wisdom_collector': 'Отправляйте по цитате каждый день',
      'week_philosopher': 'Отправляйте цитаты 7 дней подряд',
      'classics_lover': 'Добавляйте цитаты Толстого, Достоевского, Пушкина',
      'thinker': 'Отправляйте собственные мысли без указания автора',
      'marathon_reader': 'Продолжайте собирать цитаты каждый день',
      'diverse_reader': 'Попробуйте разные темы: любовь, мотивация, философия',
      'monthly_consistent': 'Используйте бот активно в течение месяца'
    };
    
    return hints[achievement.id] || 'Продолжайте отправлять цитаты!';
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
        await ctx.reply(`🔍 По запросу \"${searchText}\" ничего не найдено.\n\nПопробуйте другие слова или проверьте написание.`);
        return;
      }

      let resultText = `🔍 *Результаты поиска \"${searchText}\":*\\n\\n`;
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        const shortText = quote.text.length > 70 ? 
          quote.text.substring(0, 67) + '...' : quote.text;
        
        resultText += `${index + 1}. \"${shortText}\"${author}\\n`;
        resultText += `   📅 ${quote.ageInDays} дн. назад • ${quote.category}\\n\\n`;
      });

      resultText += `📊 Найдено: ${quotes.length} ${this._getQuotesWord(quotes.length)}`;

      await ctx.reply(resultText, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('Error in handleTextSearch:', error);
      await ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
    }
  }

  /**
   * Создать прогресс-бар для достижений
   * @param {number} progress - Прогресс в процентах (0-100)
   * @returns {string} Прогресс-бар
   * @private
   */
  _createProgressBar(progress) {
    const filledBlocks = Math.round(progress / 14.3); // 7 блоков вместо 10 для компактности
    const emptyBlocks = 7 - filledBlocks;
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
   * 📋 NEW: Обработка ответа на месячный опрос
   * Format: monthly_survey_{themeId}_{month}_{year}
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} data - Callback data
   * @returns {Promise<void>}
   */
  async handleMonthlySurvey(ctx, data) {
    try {
      const userId = ctx.from.id.toString();
      
      // Парсим callback data: monthly_survey_confidence_11_2025
      const parts = data.split('_');
      const themeId = parts[2];
      const month = parts[3] ? parseInt(parts[3]) : null;
      const year = parts[4] ? parseInt(parts[4]) : null;

      // Показываем индикатор загрузки
      await ctx.reply('⏳ Генерирую ваш персональный месячный отчёт...\n\nЭто может занять несколько секунд.');

      // Вызываем метод monthlyReportService
      if (this.monthlyReportService) {
        await this.monthlyReportService.processSurveyResponse(userId, themeId, month, year);
      } else {
        throw new Error('MonthlyReportService not initialized');
      }

      // Отчёт будет отправлен внутри processSurveyResponse
      // Удаляем сообщение с кнопками опроса
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Игнорируем ошибку если не удалось удалить
      }

    } catch (error) {
      console.error('Error in handleMonthlySurvey:', error);
      await ctx.reply('❌ Произошла ошибка при генерации отчёта. Попробуйте позже или обратитесь к администратору.');
    }
  }

  /**
   * 📋 NEW: Обработка рейтинга месячного отчёта
   * Format: monthly_rating_{rating}_{reportId}
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} data - Callback data
   * @returns {Promise<void>}
   */
  async handleMonthlyRating(ctx, data) {
    try {
      const { MonthlyReport } = require('../models');
      
      // Парсим callback data: monthly_rating_5_673abc123def456
      const parts = data.split('_');
      const rating = parseInt(parts[2]);
      const reportId = parts[3];

      // Находим отчёт и обновляем рейтинг
      const report = await MonthlyReport.findById(reportId);
      
      if (!report) {
        await ctx.answerCbQuery('⚠️ Отчёт не найден');
        return;
      }

      // Сохраняем рейтинг
      report.feedback = {
        rating,
        respondedAt: new Date()
      };
      await report.save();

      // Благодарим за отзыв
      const stars = '⭐'.repeat(rating);
      await ctx.reply(`${stars}\n\nСпасибо за оценку! Ваше мнение поможет нам стать лучше.\n\n💬 Хотите добавить комментарий к оценке? Просто напишите его в чат.`);

      // Удаляем кнопки рейтинга
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Игнорируем ошибку если не удалось удалить
      }

      console.log(`📈 Monthly report ${reportId} rated ${rating} stars`);

    } catch (error) {
      console.error('Error in handleMonthlyRating:', error);
      await ctx.answerCbQuery('❌ Ошибка при сохранении оценки');
    }
  }

  /**
   * 📖 ОБНОВЛЕНО: Обработать callback запросы с новыми функциями
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleCallback(ctx) {
    const data = ctx.callbackQuery.data;

    try {
      switch (data) {
        case 'quick_search':
          await this.handleSearch(ctx);
          break;
        
        case 'quick_stats':
          await this.handleStats(ctx);
          break;
        
        case 'open_settings':
          await this.handleSettings(ctx);
          break;
        
        case 'toggle_reminders':
          await this.toggleReminders(ctx);
          break;
        
        case 'change_reminder_time':
          await this.changeReminderTime(ctx);
          break;
        
        case 'reminder_frequency_info':
          await this.showReminderFrequencyInfo(ctx);
          break;
        
        case 'achievements_guide':
          await this.showAchievementsGuide(ctx);
          break;
        
        case 'search_text':
          await ctx.reply('🔍 Напишите слово или фразу для поиска в ваших цитатах:');
          break;
        
        case 'search_author':
          await ctx.reply('👤 Напишите имя автора для поиска:');
          break;
        
        case 'search_category':
          await this._showCategorySearch(ctx);
          break;
        
        case 'close_settings':
          await ctx.deleteMessage();
          break;
        
        case 'set_custom_time':
          await ctx.reply('⏰ Напишите время в формате ЧЧ:ММ (например, 10:30):');
          break;
        
        default:
          // 📋 NEW: Обработка месячного опроса
          if (data.startsWith('monthly_survey_')) {
            await this.handleMonthlySurvey(ctx, data);
          } 
          // 📋 NEW: Обработка рейтинга месячного отчёта
          else if (data.startsWith('monthly_rating_')) {
            await this.handleMonthlyRating(ctx, data);
          }
          else if (data.startsWith('category_')) {
            await this._handleCategorySearch(ctx, data.replace('category_', ''));
          } else if (data.startsWith('set_time_')) {
            const time = data.replace('set_time_', '');
            await this.setReminderTime(ctx, time);
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
        await ctx.reply(`📚 В категории \"${category}\" пока нет цитат.\n\nДобавьте первую цитату по этой теме!`);
        return;
      }

      let resultText = `📚 *Цитаты в категории \"${category}\":*\\n\\n`;
      
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        const shortText = quote.text.length > 70 ? 
          quote.text.substring(0, 67) + '...' : quote.text;
        
        resultText += `${index + 1}. \"${shortText}\"${author}\\n\\n`;
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
