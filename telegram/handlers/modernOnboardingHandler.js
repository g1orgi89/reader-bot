/**
 * Modern Onboarding Handler with beautiful test design for Reader bot
 * @file telegram/handlers/modernOnboardingHandler.js
 * 🎨 VISUAL UX: Beautiful test panels, elegant progress indicators
 * 📖 READER THEME: Book-focused onboarding for Anna Busel's project
 */

const logger = require('../../server/utils/logger');
const { UserProfile } = require('../../server/models');
const claudeService = require('../../server/services/claude');

/**
 * @typedef {Object} OnboardingState
 * @property {string} step - Current onboarding step
 * @property {Object} answers - Collected answers
 * @property {number} startTime - When onboarding started
 * @property {number} lastActivity - Last activity timestamp
 */

/**
 * @class ModernOnboardingHandler
 * @description Modern beautiful onboarding flow with elegant test design
 */
class ModernOnboardingHandler {
  constructor() {
    /** @type {Map<string, OnboardingState>} */
    this.userStates = new Map();
    
    // Test questions with beautiful formatting
    this.testQuestions = [
      {
        id: 'name',
        number: 1,
        type: 'text',
        question: 'Как вас зовут?',
        description: 'Расскажите, как к вам обращаться',
        placeholder: 'Например: Мария',
        emoji: '👋'
      },
      {
        id: 'lifestyle',
        number: 2,
        type: 'buttons',
        question: 'Расскажите о себе:',
        description: 'Выберите наиболее близкий вариант',
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
        description: 'Ваша стратегия личного времени',
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
        description: 'Выберите главный приоритет в жизни',
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
        description: 'Ваши эмоции от чтения',
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
        description: 'Выберите то, что резонирует с вами',
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
        description: 'Честно оцените свое время на чтение',
        emoji: '📖',
        options: [
          { text: '📚 Меньше часа (читаю редко)', value: 'less_hour' },
          { text: '⏰ 1-3 часа (по выходным)', value: 'few_hours' },
          { text: '📖 3-7 часов (несколько раз в неделю)', value: 'regular' },
          { text: '🤓 Больше 7 часов (читаю каждый день)', value: 'daily' }
        ]
      }
    ];

    // Source options for traffic attribution
    this.sourceOptions = [
      { text: '📱 Instagram', value: 'Instagram' },
      { text: '💬 Telegram', value: 'Telegram' },
      { text: '📹 YouTube', value: 'YouTube' },
      { text: '🧵 Threads', value: 'Threads' },
      { text: '👥 От друзей', value: 'Друзья' },
      { text: '🔍 Другое', value: 'Другое' }
    ];

    this.stateCleanupInterval = 30 * 60 * 1000; // 30 minutes
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleStates();
    }, 10 * 60 * 1000); // Clean up every 10 minutes
    
    logger.info('🎨 ModernOnboardingHandler initialized with beautiful test design');
  }

  /**
   * Handle /start command with beautiful welcome
   * @param {Object} ctx - Telegram context
   */
  async handleStart(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      // Check if user already exists
      const existingUser = await UserProfile.findOne({ userId });
      if (existingUser && existingUser.isOnboardingComplete) {
        await ctx.reply('📖 Добро пожаловать обратно! Используйте /menu для навигации.');
        return;
      }

      const welcomeMessage = `
╭─────────────────────────╮
│    📖 ДОБРО ПОЖАЛОВАТЬ   │
│        В ЧИТАТЕЛЬ       │
╰─────────────────────────╯

Здравствуйте! 👋

Вы попали в «Читатель» — ваш личный 
проводник в мире слов и цитат.

┌─────────────────────────┐
│  Меня зовут Анна Бусел  │
│                         │
│  🧠 Психолог            │
│  📚 Основатель          │
│     «Книжного клуба»    │
└─────────────────────────┘

Здесь мы превратим ваши случайные 
цитаты в персональный дневник роста.

💡 Сначала пройдём короткий тест 
   (2 минуты) — он поможет мне понять, 
   какие книги будут откликаться 
   именно вам.

┌─────────────────────────┐
│     ГОТОВЫ НАЧАТЬ?      │
└─────────────────────────┘`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "✨ Начать тест", callback_data: "start_beautiful_test" }],
          [{ text: "❓ Что это за бот?", callback_data: "about_bot" }]
        ]
      };

      await ctx.reply(welcomeMessage, { reply_markup: keyboard });
      
      // Initialize user state
      this._initializeUserState(userId);
      
    } catch (error) {
      logger.error(`🎨 Error in handleStart: ${error.message}`);
      await ctx.reply('📖 Здравствуйте! Добро пожаловать в «Читатель». Попробуйте еще раз.');
    }
  }

  /**
   * Handle callback queries for onboarding
   * @param {Object} ctx - Telegram context
   * @returns {Promise<boolean>} - True if handled
   */
  async handleCallback(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const callbackData = ctx.callbackQuery.data;

      if (callbackData === 'start_beautiful_test') {
        await this._startTest(ctx);
        await ctx.answerCbQuery('🎯 Начинаем тест!');
        return true;
      }

      if (callbackData === 'about_bot') {
        await this._showAboutBot(ctx);
        await ctx.answerCbQuery('ℹ️ О боте');
        return true;
      }

      if (callbackData.startsWith('test_answer_')) {
        await this._handleTestAnswer(ctx, callbackData);
        return true;
      }

      if (callbackData.startsWith('source_')) {
        await this._handleSourceSelection(ctx, callbackData);
        return true;
      }

      if (callbackData === 'skip_email') {
        await this._handleEmailSkip(ctx);
        return true;
      }

      if (callbackData === 'restart_test') {
        await this._restartTest(ctx);
        await ctx.answerCbQuery('🔄 Тест перезапущен');
        return true;
      }

      return false;
      
    } catch (error) {
      logger.error(`🎨 Error in handleCallback: ${error.message}`);
      await ctx.answerCbQuery('❌ Произошла ошибка');
      return false;
    }
  }

  /**
   * Handle text messages during onboarding
   * @param {Object} ctx - Telegram context
   * @returns {Promise<boolean>} - True if handled
   */
  async handleTextMessage(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const messageText = ctx.message.text;
      const userState = this.userStates.get(userId);

      if (!userState) return false;

      // Handle name input
      if (userState.step === 'awaiting_name') {
        await this._handleNameInput(ctx, messageText);
        return true;
      }

      // Handle email input
      if (userState.step === 'awaiting_email') {
        await this._handleEmailInput(ctx, messageText);
        return true;
      }

      return false;
      
    } catch (error) {
      logger.error(`🎨 Error in handleTextMessage: ${error.message}`);
      return false;
    }
  }

  /**
   * Start the beautiful test
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _startTest(ctx) {
    const userId = ctx.from.id.toString();
    
    // Update state to first question
    this.userStates.set(userId, {
      step: 'test_question_1',
      answers: {},
      startTime: Date.now(),
      lastActivity: Date.now()
    });

    await this._showTestQuestion(ctx, 1);
  }

  /**
   * Show test question with beautiful formatting
   * @private
   * @param {Object} ctx - Telegram context
   * @param {number} questionNumber - Question number (1-7)
   */
  async _showTestQuestion(ctx, questionNumber) {
    try {
      const question = this.testQuestions[questionNumber - 1];
      if (!question) {
        logger.error(`🎨 Question ${questionNumber} not found`);
        return;
      }

      const progressBar = this._createProgressBar(questionNumber, this.testQuestions.length);
      
      let questionPanel = `
╭─────────────────────────╮
│      📝 ТЕСТ АННЫ       │
╰─────────────────────────╯

${progressBar}

${question.emoji} Вопрос ${question.number} из ${this.testQuestions.length}

┌─────────────────────────┐
│  ${question.question.toUpperCase()}  │
└─────────────────────────┘

💭 ${question.description}
`;

      if (question.type === 'text') {
        questionPanel += `
💡 ${question.placeholder}

Напишите ваш ответ:`;

        await ctx.editMessageText(questionPanel, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "⏭️ Пропустить", callback_data: `test_answer_skip_${question.id}` }],
              [{ text: "🔄 Перезапустить тест", callback_data: "restart_test" }]
            ]
          }
        });

        // Update state to await text input
        const userId = ctx.from.id.toString();
        const userState = this.userStates.get(userId);
        if (userState) {
          userState.step = 'awaiting_name';
          userState.lastActivity = Date.now();
        }

      } else if (question.type === 'buttons') {
        const keyboard = {
          inline_keyboard: [
            ...question.options.map(option => [{
              text: option.text,
              callback_data: `test_answer_${question.id}_${option.value}`
            }]),
            [{ text: "🔄 Перезапустить тест", callback_data: "restart_test" }]
          ]
        };

        await ctx.editMessageText(questionPanel, { reply_markup: keyboard });
      }
      
    } catch (error) {
      logger.error(`🎨 Error showing test question: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке вопроса. Попробуйте /start');
    }
  }

  /**
   * Handle test answer
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Callback data
   */
  async _handleTestAnswer(ctx, callbackData) {
    try {
      const userId = ctx.from.id.toString();
      const userState = this.userStates.get(userId);
      
      if (!userState) {
        await ctx.answerCbQuery('⏰ Сессия истекла, начните заново с /start');
        return;
      }

      // Parse callback data: test_answer_{questionId}_{value}
      const parts = callbackData.replace('test_answer_', '').split('_');
      const questionId = parts[0];
      const answerValue = parts.slice(1).join('_');

      // Save answer
      userState.answers[questionId] = answerValue;
      userState.lastActivity = Date.now();

      // Find current question number
      const currentQuestion = this.testQuestions.find(q => q.id === questionId);
      const nextQuestionNumber = currentQuestion ? currentQuestion.number + 1 : 8;

      await ctx.answerCbQuery('✅ Ответ сохранен');

      // Show next question or proceed to email collection
      if (nextQuestionNumber <= this.testQuestions.length) {
        userState.step = `test_question_${nextQuestionNumber}`;
        await this._showTestQuestion(ctx, nextQuestionNumber);
      } else {
        // Test completed, collect email
        await this._collectEmail(ctx);
      }
      
    } catch (error) {
      logger.error(`🎨 Error handling test answer: ${error.message}`);
      await ctx.answerCbQuery('❌ Ошибка при сохранении ответа');
    }
  }

  /**
   * Handle name input
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} name - User's name
   */
  async _handleNameInput(ctx, name) {
    try {
      const userId = ctx.from.id.toString();
      const userState = this.userStates.get(userId);
      
      if (!userState || userState.step !== 'awaiting_name') return;

      // Validate name
      if (!name || name.trim().length < 2) {
        await ctx.reply(
          '📝 Пожалуйста, введите имя (минимум 2 символа).\n\n' +
          'Например: Мария, Анна, Елена'
        );
        return;
      }

      if (name.trim().length > 50) {
        await ctx.reply('📝 Имя слишком длинное. Максимум 50 символов.');
        return;
      }

      // Save name and move to next question
      userState.answers.name = name.trim();
      userState.step = 'test_question_2';
      userState.lastActivity = Date.now();

      // Send confirmation and show next question
      await ctx.reply(`✨ Приятно познакомиться, ${name.trim()}!`);
      await this._showTestQuestion(ctx, 2);
      
    } catch (error) {
      logger.error(`🎨 Error handling name input: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз.');
    }
  }

  /**
   * Collect email with beautiful panel
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _collectEmail(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userState = this.userStates.get(userId);
      
      if (!userState) return;

      const emailPanel = `
╭─────────────────────────╮
│    📧 ПОЧТИ ГОТОВО!     │
╰─────────────────────────╯

🎉 Тест завершён! Отлично справились.

Теперь мне нужен ваш email для 
отправки еженедельных отчетов:

┌─────────────────────────┐
│  📊 ЕЖЕНЕДЕЛЬНЫЕ ОТЧЕТЫ │
│                         │
│  💎 Анализ ваших цитат  │
│  📚 Персональные        │
│      рекомендации книг  │
│  🎁 Эксклюзивные        │
│      промокоды          │
└─────────────────────────┘

💌 Введите ваш email:
Например: maria@example.com`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "⏭️ Пропустить email", callback_data: "skip_email" }],
          [{ text: "🔄 Перезапустить тест", callback_data: "restart_test" }]
        ]
      };

      await ctx.editMessageText(emailPanel, { reply_markup: keyboard });

      // Update state
      userState.step = 'awaiting_email';
      userState.lastActivity = Date.now();
      
    } catch (error) {
      logger.error(`🎨 Error collecting email: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте /start');
    }
  }

  /**
   * Handle email input
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} email - User's email
   */
  async _handleEmailInput(ctx, email) {
    try {
      const userId = ctx.from.id.toString();
      const userState = this.userStates.get(userId);
      
      if (!userState || userState.step !== 'awaiting_email') return;

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        await ctx.reply(
          '📧 Пожалуйста, введите корректный email.\n\n' +
          'Например: maria@gmail.com'
        );
        return;
      }

      // Save email and proceed to source selection
      userState.answers.email = email.trim();
      userState.step = 'selecting_source';
      userState.lastActivity = Date.now();

      await ctx.reply('✅ Email сохранен!');
      await this._collectSource(ctx);
      
    } catch (error) {
      logger.error(`🎨 Error handling email input: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз.');
    }
  }

  /**
   * Handle email skip
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _handleEmailSkip(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userState = this.userStates.get(userId);
      
      if (!userState) return;

      userState.answers.email = `${userId}@temp.reader`;
      userState.step = 'selecting_source';
      userState.lastActivity = Date.now();

      await ctx.answerCbQuery('⏭️ Email пропущен');
      await this._collectSource(ctx);
      
    } catch (error) {
      logger.error(`🎨 Error handling email skip: ${error.message}`);
      await ctx.answerCbQuery('❌ Произошла ошибка');
    }
  }

  /**
   * Collect traffic source
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _collectSource(ctx) {
    try {
      const sourcePanel = `
╭─────────────────────────╮
│   🔍 ПОСЛЕДНИЙ ВОПРОС   │
╰─────────────────────────╯

🤔 Откуда вы узнали о боте?

Это поможет Анне понимать, 
где искать единомышленников.

┌─────────────────────────┐
│    ВЫБЕРИТЕ ИСТОЧНИК:   │
└─────────────────────────┘`;

      const keyboard = {
        inline_keyboard: this.sourceOptions.map(option => [{
          text: option.text,
          callback_data: `source_${option.value}`
        }])
      };

      await ctx.editMessageText(sourcePanel, { reply_markup: keyboard });
      
    } catch (error) {
      logger.error(`🎨 Error collecting source: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте /start');
    }
  }

  /**
   * Handle source selection
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Callback data
   */
  async _handleSourceSelection(ctx, callbackData) {
    try {
      const userId = ctx.from.id.toString();
      const userState = this.userStates.get(userId);
      
      if (!userState) {
        await ctx.answerCbQuery('⏰ Сессия истекла, начните заново с /start');
        return;
      }

      const source = callbackData.replace('source_', '');
      userState.answers.source = source;
      userState.lastActivity = Date.now();

      await ctx.answerCbQuery('✅ Источник сохранен');
      await this._completeOnboarding(ctx);
      
    } catch (error) {
      logger.error(`🎨 Error handling source selection: ${error.message}`);
      await ctx.answerCbQuery('❌ Ошибка при сохранении источника');
    }
  }

  /**
   * Complete onboarding process
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _completeOnboarding(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userState = this.userStates.get(userId);
      
      if (!userState) return;

      // Analyze test results with AI
      const preferences = await this._analyzeTestResults(userState.answers);

      // Create user profile
      const userProfile = {
        userId,
        telegramUsername: ctx.from.username || '',
        name: userState.answers.name,
        email: userState.answers.email,
        testResults: {
          name: userState.answers.name,
          lifestyle: userState.answers.lifestyle,
          timeForSelf: userState.answers.timeForSelf,
          priorities: userState.answers.priorities,
          readingFeelings: userState.answers.readingFeelings,
          closestPhrase: userState.answers.closestPhrase,
          readingTime: userState.answers.readingTime
        },
        source: userState.answers.source,
        preferences,
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

      // Save to database
      await UserProfile.findOneAndUpdate(
        { userId },
        userProfile,
        { upsert: true, new: true }
      );

      // Show completion message
      await this._showCompletionMessage(ctx, userProfile);

      // Clean up state
      this.userStates.delete(userId);
      
      logger.info(`🎨 User ${userId} completed onboarding successfully`);
      
    } catch (error) {
      logger.error(`🎨 Error completing onboarding: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при завершении регистрации. Попробуйте /start');
    }
  }

  /**
   * Show completion message
   * @private
   * @param {Object} ctx - Telegram context
   * @param {Object} userProfile - User profile
   */
  async _showCompletionMessage(ctx, userProfile) {
    try {
      const completionMessage = `
╭─────────────────────────╮
│   🎉 ДОБРО ПОЖАЛОВАТЬ!  │
╰─────────────────────────╯

Здравствуйте, ${userProfile.name}! 
Регистрация завершена успешно.

┌─────────────────────────┐
│   ГЛАВНАЯ ФИШКА БОТА:   │
└─────────────────────────┘

📝 Каждый раз, когда встречаете 
   цитату, которая зажигает что-то 
   важное — просто копируйте и 
   присылайте сюда.

💡 Пример:
   "В каждом слове — целая жизнь" 
   (Марина Цветаева)

┌─────────────────────────┐
│     ЧТО ПОЛУЧИТЕ:       │
└─────────────────────────┘

📚 Персональный дневник цитат
📊 Еженедельные отчеты с анализом
💎 Рекомендации книг от Анны
🏆 Достижения и статистику
🎁 Эксклюзивные промокоды

🎯 Попробуйте прямо сейчас! 
   Пришлите любую цитату, которая 
   вам нравится.

📖 Хватит сидеть в телефоне — 
   читайте книги!`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "📖 Открыть главное меню", callback_data: "nav_main" }],
          [{ text: "❓ Как пользоваться ботом?", callback_data: "nav_help" }]
        ]
      };

      await ctx.editMessageText(completionMessage, { reply_markup: keyboard });
      
    } catch (error) {
      logger.error(`🎨 Error showing completion message: ${error.message}`);
      await ctx.reply(
        `🎉 Добро пожаловать, ${userProfile.name}! Регистрация завершена.\n\n` +
        `💡 Отправьте любую цитату, чтобы начать!\n\n` +
        `Используйте /menu для навигации.`
      );
    }
  }

  /**
   * Analyze test results with AI
   * @private
   * @param {Object} answers - Test answers
   * @returns {Promise<Object>} - Analyzed preferences
   */
  async _analyzeTestResults(answers) {
    try {
      const prompt = `Проанализируй результаты теста пользователя как психолог Анна Бусел и определи предпочтения для рекомендаций книг:

Ответы пользователя:
- Имя: ${answers.name}
- Образ жизни: ${answers.lifestyle}
- Время для себя: ${answers.timeForSelf}
- Приоритеты: ${answers.priorities}
- Чувства при чтении: ${answers.readingFeelings}
- Близкая фраза: ${answers.closestPhrase}
- Время на чтение: ${answers.readingTime}

Верни JSON с анализом:
{
  "mainThemes": ["тема1", "тема2", "тема3"],
  "personalityType": "краткое описание типа личности",
  "recommendationStyle": "стиль рекомендаций"
}`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'onboarding_analysis'
      });

      return JSON.parse(response.message);
      
    } catch (error) {
      logger.error(`🎨 Error analyzing test results: ${error.message}`);
      
      // Fallback analysis
      return {
        mainThemes: ['Саморазвитие', 'Мудрость', 'Отношения'],
        personalityType: 'Ищущий развития и понимания',
        recommendationStyle: 'Практические книги с глубоким смыслом'
      };
    }
  }

  /**
   * Show about bot information
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _showAboutBot(ctx) {
    try {
      const aboutMessage = `
╭─────────────────────────╮
│     📖 О ПРОЕКТЕ        │
╰─────────────────────────╯

«Читатель» — это персональный 
дневник цитат с AI-анализом 
от психолога Анны Бусел.

┌─────────────────────────┐
│    КАК ЭТО РАБОТАЕТ:    │
└─────────────────────────┘

1️⃣ Присылайте боту цитаты 
   из книг или свои мысли

2️⃣ ИИ анализирует ваши 
   интересы и эмоции

3️⃣ Каждое воскресенье получаете 
   персональный отчет

4️⃣ Анна рекомендует книги 
   именно для вас

┌─────────────────────────┐
│     ЧТО ПОЛУЧИТЕ:       │
└─────────────────────────┘

📚 Личный дневник мудрости
🧠 Психологический анализ
💎 Рекомендации от эксперта
🎁 Скидки на разборы книг
📈 Трекинг личного роста

💫 Превратите чтение в инструмент 
   самопознания и развития!`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "✨ Начать тест", callback_data: "start_beautiful_test" }],
          [{ text: "🔙 Назад", callback_data: "show_welcome" }]
        ]
      };

      await ctx.editMessageText(aboutMessage, { reply_markup: keyboard });
      
    } catch (error) {
      logger.error(`🎨 Error showing about bot: ${error.message}`);
      await ctx.answerCbQuery('❌ Ошибка загрузки информации');
    }
  }

  /**
   * Restart test
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _restartTest(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      // Reset state
      this.userStates.set(userId, {
        step: 'test_question_1',
        answers: {},
        startTime: Date.now(),
        lastActivity: Date.now()
      });

      await this._showTestQuestion(ctx, 1);
      
    } catch (error) {
      logger.error(`🎨 Error restarting test: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте /start');
    }
  }

  /**
   * Create progress bar for test
   * @private
   * @param {number} current - Current question
   * @param {number} total - Total questions
   * @returns {string} - Progress bar
   */
  _createProgressBar(current, total) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 10);
    const empty = 10 - filled;
    
    return `📊 Прогресс: ${'▓'.repeat(filled)}${'░'.repeat(empty)} ${percentage}%`;
  }

  /**
   * Initialize user state
   * @private
   * @param {string} userId - User ID
   */
  _initializeUserState(userId) {
    this.userStates.set(userId, {
      step: 'welcome',
      answers: {},
      startTime: Date.now(),
      lastActivity: Date.now()
    });
  }

  /**
   * Check if user is in onboarding
   * @param {string} userId - User ID
   * @returns {boolean} - True if in onboarding
   */
  isInOnboarding(userId) {
    return this.userStates.has(userId);
  }

  /**
   * Clean up stale onboarding states
   */
  cleanupStaleStates() {
    const staleThreshold = Date.now() - this.stateCleanupInterval;
    let cleanedCount = 0;

    for (const [userId, state] of this.userStates) {
      if (state.lastActivity < staleThreshold) {
        this.userStates.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🎨 Cleaned up ${cleanedCount} stale onboarding states`);
    }
  }

  /**
   * Get onboarding statistics
   * @returns {Object} - Onboarding stats
   */
  getStats() {
    const stepCounts = {};
    let totalDuration = 0;
    let completedCount = 0;

    for (const state of this.userStates.values()) {
      stepCounts[state.step] = (stepCounts[state.step] || 0) + 1;
      
      if (state.step === 'completed') {
        completedCount++;
        totalDuration += (Date.now() - state.startTime);
      }
    }

    return {
      activeUsers: this.userStates.size,
      stepDistribution: stepCounts,
      completedSessions: completedCount,
      averageDuration: completedCount > 0 ? Math.round(totalDuration / completedCount / 1000) : 0,
      staleCleanupInterval: this.stateCleanupInterval
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.userStates.clear();
    logger.info('🎨 ModernOnboardingHandler cleanup completed');
  }
}

module.exports = { ModernOnboardingHandler };