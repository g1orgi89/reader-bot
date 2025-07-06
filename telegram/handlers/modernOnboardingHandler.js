/**
 * Clean Onboarding Handler - menu button + simple text for Reader bot
 * @file telegram/handlers/modernOnboardingHandler.js
 * 🎨 CLEAN UX: Menu button, simple text, no visual spam
 * 🔧 FIXED: Message editing errors, robust error handling
 */

const logger = require('../../server/utils/logger');
const { UserProfile } = require('../../server/models');
const claudeService = require('../../server/services/claude');

class ModernOnboardingHandler {
  constructor() {
    /** @type {Map<string, Object>} */
    this.userStates = new Map();
    
    this.testQuestions = [
      {
        id: 'name',
        number: 1,
        type: 'text',
        question: 'Как вас зовут?',
        emoji: '👋'
      },
      {
        id: 'lifestyle',
        number: 2,
        type: 'buttons',
        question: 'Расскажите о себе:',
        emoji: '🌟',
        options: [
          { text: '👶 Я мама (дети - главная забота)', value: 'mother' },
          { text: '⚖️ Замужем, балансирую дом/работу/себя', value: 'married' },
          { text: '🌸 Без отношений, изучаю мир и себя', value: 'single' }
        ]
      },
      {
        id: 'timeForSelf',
        number: 3,
        type: 'buttons',
        question: 'Как находите время для себя?',
        emoji: '⏰',
        options: [
          { text: '🌅 Рано утром, пока все спят', value: 'early_morning' },
          { text: '🌙 Поздно вечером, когда дела сделаны', value: 'late_evening' },
          { text: '📱 Урывками в течение дня', value: 'throughout_day' },
          { text: '🤷‍♀️ Время для себя? Что это?', value: 'no_time' }
        ]
      },
      {
        id: 'priorities',
        number: 4,
        type: 'buttons',
        question: 'Что сейчас важнее всего?',
        emoji: '🎯',
        options: [
          { text: '🧘‍♀️ Найти внутренний баланс', value: 'inner_balance' },
          { text: '💭 Понять свои истинные желания', value: 'true_desires' },
          { text: '💕 Научиться любить себя', value: 'self_love' },
          { text: '🏗️ Построить гармоничные отношения', value: 'relationships' }
        ]
      },
      {
        id: 'readingFeelings',
        number: 5,
        type: 'buttons',
        question: 'Что чувствуете, читая книги?',
        emoji: '📚',
        options: [
          { text: '🔍 Нахожу ответы на свои вопросы', value: 'finding_answers' },
          { text: '⚡ Получаю вдохновение и энергию', value: 'inspiration' },
          { text: '😌 Успокаиваюсь и расслабляюсь', value: 'relaxation' },
          { text: '🌱 Учусь новому о себе и мире', value: 'learning' }
        ]
      },
      {
        id: 'closestPhrase',
        number: 6,
        type: 'buttons',
        question: 'Какая фраза ближе?',
        emoji: '💫',
        options: [
          { text: '✨ "Счастье — это выбор"', value: 'happiness_choice' },
          { text: '❤️ "Любовь начинается с себя"', value: 'love_self' },
          { text: '🌍 "Жизнь — это путешествие"', value: 'life_journey' },
          { text: '🧠 "Мудрость приходит с опытом"', value: 'wisdom_experience' }
        ]
      },
      {
        id: 'readingTime',
        number: 7,
        type: 'buttons',
        question: 'Сколько времени читаете в неделю?',
        emoji: '📖',
        options: [
          { text: '📚 Меньше часа (читаю редко)', value: 'less_hour' },
          { text: '⏰ 1-3 часа (по выходным)', value: 'few_hours' },
          { text: '📖 3-7 часов (несколько раз в неделю)', value: 'regular' },
          { text: '🤓 Больше 7 часов (читаю каждый день)', value: 'daily' }
        ]
      }
    ];

    this.sourceOptions = [
      { text: '📱 Instagram', value: 'Instagram' },
      { text: '💬 Telegram', value: 'Telegram' },
      { text: '📹 YouTube', value: 'YouTube' },
      { text: '🧵 Threads', value: 'Threads' },
      { text: '👥 От друзей', value: 'Друзья' },
      { text: '🔍 Другое', value: 'Другое' }
    ];

    // Очистка каждые 30 минут
    setInterval(() => this.cleanupStaleStates(), 30 * 60 * 1000);
    
    logger.info('✅ ModernOnboardingHandler initialized with clean UX');
  }

  /**
   * Setup bot menu button and commands
   * @param {Object} bot - Telegram bot instance
   */
  async setupMenuButton(bot) {
    try {
      // Устанавливаем menu button
      await bot.telegram.setChatMenuButton({
        menu_button: {
          type: 'commands'
        }
      });

      // Устанавливаем команды для меню
      await bot.telegram.setMyCommands([
        { command: 'stats', description: '📊 Моя статистика' },
        { command: 'search', description: '🔍 Поиск цитат' },
        { command: 'help', description: '❓ Справка' },
        { command: 'settings', description: '⚙️ Настройки' }
      ]);

      logger.info('✅ Menu button and commands configured');
    } catch (error) {
      logger.error(`Error setting up menu button: ${error.message}`);
    }
  }

  /**
   * Handle /start command with simple welcome
   */
  async handleStart(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      // Проверка существующего пользователя
      const existingUser = await UserProfile.findOne({ userId });
      if (existingUser && existingUser.isOnboardingComplete) {
        await ctx.reply(
          '📖 Добро пожаловать обратно!\n\n' +
          '💡 Используйте кнопку меню 📋 (рядом с прикреплением файлов) для навигации'
        );
        return;
      }

      const welcomeMessage = 
        '👋 Здравствуйте!\n\n' +
        'Вы попали в «Читатель» — ваш личный проводник в мире слов и цитат.\n\n' +
        'Меня зовут Анна Бусел, я психолог и основатель «Книжного клуба». ' +
        'Здесь мы превратим ваши случайные цитаты в персональный дневник роста.\n\n' +
        '📝 Сначала пройдём короткий тест (2 минуты) — он поможет мне понять, ' +
        'какие книги будут откликаться именно вам.';

      await ctx.reply(welcomeMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✨ Начать тест", callback_data: "start_test" }]
          ]
        }
      });
      
    } catch (error) {
      logger.error(`Error in handleStart: ${error.message}`);
      await ctx.reply('📖 Здравствуйте! Добро пожаловать в «Читатель». Попробуйте еще раз.');
    }
  }

  /**
   * Handle callback queries
   */
  async handleCallback(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const data = ctx.callbackQuery.data;

      if (data === 'start_test') {
        await this._startTest(ctx);
        await ctx.answerCbQuery('🎯 Начинаем тест!');
        return true;
      }

      if (data.startsWith('answer_')) {
        await this._handleAnswer(ctx, data);
        return true;
      }

      if (data.startsWith('source_')) {
        await this._handleSourceSelection(ctx, data);
        return true;
      }

      return false;
      
    } catch (error) {
      logger.error(`Error in handleCallback: ${error.message}`);
      await ctx.answerCbQuery('❌ Произошла ошибка');
      return false;
    }
  }

  /**
   * Handle text messages
   */
  async handleTextMessage(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const text = ctx.message.text;
      const state = this.userStates.get(userId);

      if (!state) return false;

      if (state.step === 'awaiting_name') {
        await this._handleNameInput(ctx, text);
        return true;
      }

      if (state.step === 'awaiting_email') {
        await this._handleEmailInput(ctx, text);
        return true;
      }

      return false;
      
    } catch (error) {
      logger.error(`Error in handleTextMessage: ${error.message}`);
      return false;
    }
  }

  /**
   * Start test - robust message handling
   */
  async _startTest(ctx) {
    const userId = ctx.from.id.toString();
    
    this.userStates.set(userId, {
      step: 'test_question_1',
      answers: {},
      currentQuestion: 1,
      startTime: Date.now(),
      lastActivity: Date.now(),
      useNewMessages: false // Will use new messages instead of editing
    });

    await this._showQuestion(ctx, 1);
  }

  /**
   * Show question with robust error handling
   */
  async _showQuestion(ctx, questionNumber) {
    try {
      const userId = ctx.from.id.toString();
      const state = this.userStates.get(userId);
      const question = this.testQuestions[questionNumber - 1];
      
      if (!question || !state) return;

      const progress = `📊 ${questionNumber}/${this.testQuestions.length}`;
      
      let message = `${progress}\n\n${question.emoji} Вопрос ${question.number} из ${this.testQuestions.length}\n\n${question.question}`;

      if (question.type === 'text') {
        message += '\n\n💬 Просто напишите ваш ответ:';
        
        // Отправляем новое сообщение
        await ctx.reply(message);
        
        // Установить состояние ожидания текста
        state.step = 'awaiting_name';
        state.lastActivity = Date.now();

      } else if (question.type === 'buttons') {
        const keyboard = {
          inline_keyboard: question.options.map(option => [{
            text: option.text,
            callback_data: `answer_${question.id}_${option.value}`
          }])
        };

        // Пытаемся отредактировать существующее сообщение, если не получается - отправляем новое
        try {
          if (ctx.callbackQuery && ctx.callbackQuery.message) {
            await ctx.editMessageText(message, { reply_markup: keyboard });
          } else {
            await ctx.reply(message, { reply_markup: keyboard });
          }
        } catch (editError) {
          // Если не удалось отредактировать, отправляем новое сообщение
          logger.warn(`Could not edit message, sending new: ${editError.message}`);
          await ctx.reply(message, { reply_markup: keyboard });
        }
      }
      
    } catch (error) {
      logger.error(`Error showing question: ${error.message}`);
      // Graceful fallback
      await this._sendFallbackMessage(ctx, questionNumber);
    }
  }

  /**
   * Fallback message when editing fails
   */
  async _sendFallbackMessage(ctx, questionNumber) {
    try {
      const question = this.testQuestions[questionNumber - 1];
      if (!question) return;

      const message = `${question.emoji} ${question.question}`;

      if (question.type === 'text') {
        await ctx.reply(message + '\n\n💬 Напишите ваш ответ:');
      } else if (question.type === 'buttons') {
        const keyboard = {
          inline_keyboard: question.options.map(option => [{
            text: option.text,
            callback_data: `answer_${question.id}_${option.value}`
          }])
        };
        await ctx.reply(message, { reply_markup: keyboard });
      }
    } catch (error) {
      logger.error(`Error in fallback message: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте /start');
    }
  }

  /**
   * Handle answer - robust message handling
   */
  async _handleAnswer(ctx, callbackData) {
    try {
      const userId = ctx.from.id.toString();
      const state = this.userStates.get(userId);
      
      if (!state) {
        await ctx.answerCbQuery('⏰ Сессия истекла, начните заново с /start');
        return;
      }

      // Парсим ответ: answer_questionId_value
      const parts = callbackData.replace('answer_', '').split('_');
      const questionId = parts[0];
      const value = parts.slice(1).join('_');

      // Сохраняем ответ
      state.answers[questionId] = value;
      state.lastActivity = Date.now();

      await ctx.answerCbQuery('✅ Ответ сохранен');

      // Переход к следующему вопросу
      const nextQuestion = state.currentQuestion + 1;
      
      if (nextQuestion <= this.testQuestions.length) {
        state.currentQuestion = nextQuestion;
        state.step = `test_question_${nextQuestion}`;
        await this._showQuestion(ctx, nextQuestion);
      } else {
        // Тест завершен, переход к email
        await this._collectEmail(ctx);
      }
      
    } catch (error) {
      logger.error(`Error handling answer: ${error.message}`);
      await ctx.answerCbQuery('❌ Ошибка при сохранении ответа');
    }
  }

  /**
   * Handle name input with deletion
   */
  async _handleNameInput(ctx, name) {
    try {
      const userId = ctx.from.id.toString();
      const state = this.userStates.get(userId);
      
      if (!state || state.step !== 'awaiting_name') return;

      // Валидация
      if (!name || name.trim().length < 2) {
        await ctx.reply('📝 Пожалуйста, введите имя (минимум 2 символа).');
        return;
      }

      if (name.trim().length > 50) {
        await ctx.reply('📝 Имя слишком длинное. Максимум 50 символов.');
        return;
      }

      // Удаляем сообщение пользователя для чистоты
      try {
        await ctx.deleteMessage(ctx.message.message_id);
      } catch (e) {
        // Ignore if can't delete
      }

      // Сохраняем имя
      state.answers.name = name.trim();
      state.currentQuestion = 2;
      state.step = 'test_question_2';
      state.lastActivity = Date.now();

      // Показываем следующий вопрос
      await this._showQuestion(ctx, 2);
      
    } catch (error) {
      logger.error(`Error handling name: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз.');
    }
  }

  /**
   * Collect email - simple design
   */
  async _collectEmail(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const state = this.userStates.get(userId);
      
      if (!state) return;

      const message = 
        '📧 Отлично! Тест завершён.\n\n' +
        'Теперь мне нужен ваш email для еженедельных отчетов:\n\n' +
        '📊 Еженедельные отчеты:\n' +
        '• Анализ ваших цитат\n' +
        '• Персональные рекомендации книг\n' +
        '• Эксклюзивные промокоды\n\n' +
        '💌 Введите ваш email:';

      // Отправляем новое сообщение
      await ctx.reply(message);

      state.step = 'awaiting_email';
      state.lastActivity = Date.now();
      
    } catch (error) {
      logger.error(`Error collecting email: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте /start');
    }
  }

  /**
   * Handle email input
   */
  async _handleEmailInput(ctx, email) {
    try {
      const userId = ctx.from.id.toString();
      const state = this.userStates.get(userId);
      
      if (!state || state.step !== 'awaiting_email') return;

      // Валидация email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        await ctx.reply('📧 Пожалуйста, введите корректный email.\n\nНапример: maria@gmail.com');
        return;
      }

      // Удаляем сообщение пользователя
      try {
        await ctx.deleteMessage(ctx.message.message_id);
      } catch (e) {
        // Ignore if can't delete
      }

      // Сохраняем email
      state.answers.email = email.trim();
      state.step = 'selecting_source';
      state.lastActivity = Date.now();

      await this._collectSource(ctx);
      
    } catch (error) {
      logger.error(`Error handling email: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз.');
    }
  }

  /**
   * Collect source - simple list
   */
  async _collectSource(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const state = this.userStates.get(userId);
      
      if (!state) return;

      const message = 
        '🔍 Откуда вы узнали о боте?\n\n' +
        'Это поможет Анне понимать, где искать единомышленников.';

      const keyboard = {
        inline_keyboard: this.sourceOptions.map(option => [{
          text: option.text,
          callback_data: `source_${option.value}`
        }])
      };

      await ctx.reply(message, { reply_markup: keyboard });
      
    } catch (error) {
      logger.error(`Error collecting source: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте /start');
    }
  }

  /**
   * Handle source selection
   */
  async _handleSourceSelection(ctx, callbackData) {
    try {
      const userId = ctx.from.id.toString();
      const state = this.userStates.get(userId);
      
      if (!state) {
        await ctx.answerCbQuery('⏰ Сессия истекла, начните заново с /start');
        return;
      }

      const source = callbackData.replace('source_', '');
      state.answers.source = source;
      state.lastActivity = Date.now();

      await ctx.answerCbQuery('✅ Источник сохранен');
      await this._completeOnboarding(ctx);
      
    } catch (error) {
      logger.error(`Error handling source: ${error.message}`);
      await ctx.answerCbQuery('❌ Ошибка при сохранении');
    }
  }

  /**
   * Complete onboarding - clean final message
   */
  async _completeOnboarding(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const state = this.userStates.get(userId);
      
      if (!state) return;

      // Создаем профиль пользователя
      const userProfile = {
        userId,
        telegramUsername: ctx.from.username || '',
        name: state.answers.name,
        email: state.answers.email,
        testResults: {
          name: state.answers.name,
          lifestyle: state.answers.lifestyle,
          timeForSelf: state.answers.timeForSelf,
          priorities: state.answers.priorities,
          readingFeelings: state.answers.readingFeelings,
          closestPhrase: state.answers.closestPhrase,
          readingTime: state.answers.readingTime
        },
        source: state.answers.source,
        preferences: {
          mainThemes: ['Саморазвитие', 'Мудрость'],
          personalityType: 'Ищущий развития',
          recommendationStyle: 'Практические книги'
        },
        statistics: {
          totalQuotes: 0,
          currentStreak: 0,
          longestStreak: 0,
          favoriteAuthors: [],
          monthlyQuotes: []
        },
        achievements: [],
        settings: {
          reminderEnabled: true,
          reminderTimes: ['09:00', '19:00'],
          language: 'ru'
        },
        registeredAt: new Date(),
        isOnboardingComplete: true
      };

      // Сохранить в БД
      await UserProfile.findOneAndUpdate(
        { userId },
        userProfile,
        { upsert: true, new: true }
      );

      // Показать сообщение о завершении - простой текст
      const completionMessage = 
        `🎉 Добро пожаловать, ${userProfile.name}!\n\n` +
        'Регистрация завершена успешно.\n\n' +
        '📖 Главная фишка бота:\n' +
        'Каждый раз, когда встречаете цитату, которая зажигает что-то важное — просто копируйте и присылайте сюда.\n\n' +
        '💡 Пример:\n' +
        '"В каждом слове — целая жизнь" (Марина Цветаева)\n\n' +
        '📚 Что получите:\n' +
        '• Персональный дневник цитат\n' +
        '• Еженедельные отчеты с анализом\n' +
        '• Рекомендации книг от Анны\n' +
        '• Достижения и статистику\n\n' +
        '🎯 Попробуйте прямо сейчас! Пришлите любую цитату.\n\n' +
        '📖 Хватит сидеть в телефоне — читайте книги!\n\n' +
        '💡 Используйте кнопку меню 📋 (рядом с прикреплением файлов) для навигации';

      await ctx.reply(completionMessage);

      // Очищаем состояние
      this.userStates.delete(userId);
      
      logger.info(`✅ User ${userId} completed onboarding successfully`);
      
    } catch (error) {
      logger.error(`Error completing onboarding: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при завершении регистрации.');
    }
  }

  /**
   * Check if user is in onboarding
   */
  isInOnboarding(userId) {
    return this.userStates.has(userId);
  }

  /**
   * Clean up stale states
   */
  cleanupStaleStates() {
    const staleThreshold = Date.now() - (30 * 60 * 1000); // 30 минут
    let cleaned = 0;

    for (const [userId, state] of this.userStates) {
      if (state.lastActivity < staleThreshold) {
        this.userStates.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} stale onboarding states`);
    }
  }

  /**
   * Get stats
   */
  getStats() {
    const stats = {
      activeUsers: this.userStates.size,
      stepDistribution: {}
    };

    for (const state of this.userStates.values()) {
      stats.stepDistribution[state.step] = (stats.stepDistribution[state.step] || 0) + 1;
    }

    return stats;
  }
}

module.exports = { ModernOnboardingHandler };
