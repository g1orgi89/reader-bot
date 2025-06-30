/**
 * @fileoverview Обработчик онбординга для бота "Читатель"
 * @author g1orgi89
 */

const logger = require('../../server/utils/logger');
const { UserProfile } = require('../../server/models');
const { ONBOARDING_STATES } = require('../../server/types/reader');

/**
 * @typedef {import('../../server/types/reader').TestResults} TestResults
 * @typedef {import('../../server/types/reader').UserProfile} UserProfile
 */

/**
 * Класс для обработки онбординга новых пользователей
 */
class OnboardingHandler {
  constructor() {
    /**
     * @type {Map<string, Object>} - Состояния пользователей в процессе онбординга
     */
    this.userStates = new Map();
    
    /**
     * @type {Object} - Вопросы теста
     */
    this.testQuestions = {
      1: {
        text: "Вопрос 1 из 7\n\nКак вас зовут?",
        type: 'text'
      },
      2: {
        text: "Вопрос 2 из 7\n\nРасскажите о себе:",
        type: 'buttons',
        options: [
          "Я мама (дети - главная забота)",
          "Замужем, балансирую дом/работу/себя", 
          "Без отношений, изучаю мир и себя"
        ]
      },
      3: {
        text: "Вопрос 3 из 7\n\nКак находите время для себя?",
        type: 'buttons',
        options: [
          "Рано утром, пока все спят",
          "Поздно вечером, когда дела сделаны",
          "Урывками в течение дня",
          "Время для себя? Что это?"
        ]
      },
      4: {
        text: "Вопрос 4 из 7\n\nЧто сейчас важнее всего?",
        type: 'buttons',
        options: [
          "Найти внутренний баланс",
          "Понять свои истинные желания", 
          "Научиться любить себя",
          "Построить гармоничные отношения"
        ]
      },
      5: {
        text: "Вопрос 5 из 7\n\nЧто чувствуете, читая книги?",
        type: 'buttons',
        options: [
          "Нахожу ответы на свои вопросы",
          "Получаю вдохновение и энергию",
          "Успокаиваюсь и расслабляюсь",
          "Учусь новому о себе и мире"
        ]
      },
      6: {
        text: "Вопрос 6 из 7\n\nКакая фраза ближе?",
        type: 'buttons',
        options: [
          "\"Счастье — это выбор\"",
          "\"Любовь начинается с себя\"",
          "\"Жизнь — это путешествие\"",
          "\"Мудрость приходит с опытом\""
        ]
      },
      7: {
        text: "Вопрос 7 из 7\n\nСколько времени читаете в неделю?",
        type: 'buttons',
        options: [
          "Меньше часа (читаю редко)",
          "1-3 часа (по выходным)",
          "3-7 часов (несколько раз в неделю)",
          "Больше 7 часов (читаю каждый день)"
        ]
      }
    };

    logger.info('📖 OnboardingHandler initialized');
  }

  /**
   * Обработка команды /start
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async handleStart(ctx) {
    const userId = ctx.from.id.toString();
    
    try {
      // Проверяем, есть ли уже пользователь в базе
      const existingUser = await UserProfile.findOne({ userId });
      
      if (existingUser && existingUser.isOnboardingComplete) {
        // Пользователь уже зарегистрирован
        await this._sendWelcomeBackMessage(ctx, existingUser);
        return;
      }

      // Начинаем онбординг
      await this._startOnboarding(ctx);
      
    } catch (error) {
      logger.error(`📖 Error in handleStart: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз через минуту.');
    }
  }

  /**
   * Начать процесс онбординга
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _startOnboarding(ctx) {
    const userId = ctx.from.id.toString();
    
    const welcomeMessage = `👋 Здравствуйте!

Вы попали в «Читатель» - ваш личный проводник в мире слов и цитат.

Меня зовут Анна Бусел, я психолог и основатель «Книжного клуба». 
Здесь мы превратим ваши случайные цитаты в персональный дневник роста.

📝 Сначала пройдём короткий тест (2 минуты) - он поможет мне понять, какие книги будут откликаться именно вам.`;
    
    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [[
          { text: "Начать тест", callback_data: "start_test" }
        ]]
      }
    });

    // Сохраняем состояние пользователя
    this.userStates.set(userId, {
      state: ONBOARDING_STATES.START,
      testAnswers: {},
      startTime: new Date()
    });
  }

  /**
   * Обработка callback запросов
   * @param {Object} ctx - Telegram context
   * @returns {Promise<boolean>} - true если callback был обработан
   */
  async handleCallback(ctx) {
    const userId = ctx.from.id.toString();
    const callbackData = ctx.callbackQuery.data;
    
    try {
      await ctx.answerCbQuery();

      if (callbackData === 'start_test') {
        await this._startTest(ctx);
        return true;
      }

      if (callbackData.startsWith('test_q')) {
        await this._handleTestAnswer(ctx, callbackData);
        return true;
      }

      if (callbackData.startsWith('source_')) {
        await this._handleSourceSelection(ctx, callbackData);
        return true;
      }

      return false;
      
    } catch (error) {
      logger.error(`📖 Error in handleCallback: ${error.message}`);
      await ctx.answerCbQuery("Произошла ошибка. Попробуйте еще раз.");
      return true;
    }
  }

  /**
   * Обработка текстовых сообщений во время онбординга
   * @param {Object} ctx - Telegram context
   * @returns {Promise<boolean>} - true если сообщение было обработано
   */
  async handleTextMessage(ctx) {
    const userId = ctx.from.id.toString();
    const messageText = ctx.message.text;
    
    if (!this.userStates.has(userId)) {
      return false; // Пользователь не в процессе онбординга
    }

    const userState = this.userStates.get(userId);
    
    try {
      switch (userState.state) {
        case ONBOARDING_STATES.TEST_Q1_NAME:
          await this._handleNameInput(ctx, messageText);
          return true;
          
        case ONBOARDING_STATES.COLLECT_EMAIL:
          await this._handleEmailInput(ctx, messageText);
          return true;
          
        default:
          return false;
      }
    } catch (error) {
      logger.error(`📖 Error in handleTextMessage: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз.');
      return true;
    }
  }

  /**
   * Начать тест
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _startTest(ctx) {
    const userId = ctx.from.id.toString();
    
    // Показать первый вопрос
    await this._showTestQuestion(ctx, 1);
    
    // Обновить состояние
    const userState = this.userStates.get(userId);
    userState.state = ONBOARDING_STATES.TEST_Q1_NAME;
    userState.currentQuestion = 1;
  }

  /**
   * Показать вопрос теста
   * @private
   * @param {Object} ctx - Telegram context
   * @param {number} questionNumber - Номер вопроса
   */
  async _showTestQuestion(ctx, questionNumber) {
    const question = this.testQuestions[questionNumber];
    
    if (question.type === 'text') {
      await ctx.reply(question.text, {
        reply_markup: { force_reply: true }
      });
    } else if (question.type === 'buttons') {
      const keyboard = question.options.map((option, index) => [
        { text: option, callback_data: `test_q${questionNumber}_${index}` }
      ]);
      
      await ctx.reply(question.text, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  /**
   * Обработка ответа на вопрос теста
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback
   */
  async _handleTestAnswer(ctx, callbackData) {
    const userId = ctx.from.id.toString();
    const userState = this.userStates.get(userId);
    
    // Парсим callback данные: test_q2_1 -> question 2, option 1
    const match = callbackData.match(/test_q(\d+)_(\d+)/);
    if (!match) return;
    
    const questionNumber = parseInt(match[1]);
    const optionIndex = parseInt(match[2]);
    
    const question = this.testQuestions[questionNumber];
    const selectedAnswer = question.options[optionIndex];
    
    // Сохраняем ответ
    userState.testAnswers[`question${questionNumber}`] = selectedAnswer;
    
    // Переходим к следующему вопросу или завершаем тест
    if (questionNumber < 7) {
      const nextQuestion = questionNumber + 1;
      await this._showTestQuestion(ctx, nextQuestion);
      userState.currentQuestion = nextQuestion;
      userState.state = this._getStateForQuestion(nextQuestion);
    } else {
      // Тест завершен, переходим к сбору email
      await this._collectEmail(ctx);
    }
  }

  /**
   * Обработка ввода имени
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} name - Введенное имя
   */
  async _handleNameInput(ctx, name) {
    const userId = ctx.from.id.toString();
    const userState = this.userStates.get(userId);
    
    if (name.length < 2 || name.length > 50) {
      await ctx.reply("Пожалуйста, введите корректное имя (от 2 до 50 символов):");
      return;
    }
    
    // Сохраняем имя
    userState.testAnswers.question1 = name.trim();
    
    // Переходим ко второму вопросу
    await this._showTestQuestion(ctx, 2);
    userState.currentQuestion = 2;
    userState.state = ONBOARDING_STATES.TEST_Q2_LIFESTYLE;
  }

  /**
   * Сбор email
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _collectEmail(ctx) {
    const userId = ctx.from.id.toString();
    const userState = this.userStates.get(userId);
    
    userState.state = ONBOARDING_STATES.COLLECT_EMAIL;
    
    await ctx.reply(
      "Отлично! Теперь мне нужен ваш email для отправки еженедельных отчетов:",
      { reply_markup: { force_reply: true } }
    );
  }

  /**
   * Обработка ввода email
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} email - Введенный email
   */
  async _handleEmailInput(ctx, email) {
    const userId = ctx.from.id.toString();
    
    if (!this._validateEmail(email)) {
      await ctx.reply("Пожалуйста, введите корректный email адрес:");
      return;
    }
    
    const userState = this.userStates.get(userId);
    userState.email = email.trim().toLowerCase();
    
    // Переходим к выбору источника
    await this._collectSource(ctx);
  }

  /**
   * Сбор источника трафика
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _collectSource(ctx) {
    const userId = ctx.from.id.toString();
    const userState = this.userStates.get(userId);
    
    userState.state = ONBOARDING_STATES.COLLECT_SOURCE;
    
    await ctx.reply("Откуда Вы узнали о боте?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Instagram", callback_data: "source_instagram" }],
          [{ text: "Telegram", callback_data: "source_telegram" }],
          [{ text: "YouTube", callback_data: "source_youtube" }],
          [{ text: "Threads", callback_data: "source_threads" }],
          [{ text: "От друзей", callback_data: "source_friends" }],
          [{ text: "Другое", callback_data: "source_other" }]
        ]
      }
    });
  }

  /**
   * Обработка выбора источника
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Данные callback
   */
  async _handleSourceSelection(ctx, callbackData) {
    const userId = ctx.from.id.toString();
    const userState = this.userStates.get(userId);
    
    const sourceMap = {
      'source_instagram': 'Instagram',
      'source_telegram': 'Telegram',
      'source_youtube': 'YouTube',
      'source_threads': 'Threads',
      'source_friends': 'Друзья',
      'source_other': 'Другое'
    };
    
    const source = sourceMap[callbackData];
    if (!source) return;
    
    userState.source = source;
    
    // Завершаем онбординг
    await this._completeOnboarding(ctx);
  }

  /**
   * Завершение онбординга
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _completeOnboarding(ctx) {
    const userId = ctx.from.id.toString();
    const userState = this.userStates.get(userId);
    
    try {
      // Создаем или обновляем профиль пользователя
      const userData = {
        userId,
        telegramUsername: ctx.from.username || null,
        name: userState.testAnswers.question1,
        email: userState.email,
        testResults: {
          question1_name: userState.testAnswers.question1,
          question2_lifestyle: userState.testAnswers.question2 || '',
          question3_time: userState.testAnswers.question3 || '',
          question4_priorities: userState.testAnswers.question4 || '',
          question5_reading_feeling: userState.testAnswers.question5 || '',
          question6_phrase: userState.testAnswers.question6 || '',
          question7_reading_time: userState.testAnswers.question7 || '',
          completedAt: new Date()
        },
        source: userState.source,
        telegramData: {
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          languageCode: ctx.from.language_code,
          chatId: ctx.chat.id.toString()
        }
      };
      
      const userProfile = await UserProfile.findOneAndUpdate(
        { userId },
        userData,
        { upsert: true, new: true }
      );
      
      // Завершаем онбординг
      await userProfile.completeOnboarding();
      
      // Очищаем состояние
      this.userStates.delete(userId);
      
      // Отправляем сообщение о завершении
      const completionMessage = `🎉 Регистрация завершена!

Теперь главная фишка «Читателя»:
Каждый раз, когда встречаете цитату, которая зажигает что-то важное - просто копируйте и присылайте сюда.

Попробуйте прямо сейчас! Пришлите любую цитату, которая вам нравится.

📖 Хватит сидеть в телефоне - читайте книги!`;

      await ctx.reply(completionMessage);
      
      logger.info(`📖 User ${userId} completed onboarding`);
      
    } catch (error) {
      logger.error(`📖 Error completing onboarding: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при завершении регистрации. Попробуйте еще раз.');
    }
  }

  /**
   * Отправить приветствие вернувшемуся пользователю
   * @private
   * @param {Object} ctx - Telegram context
   * @param {Object} userProfile - Профиль пользователя
   */
  async _sendWelcomeBackMessage(ctx, userProfile) {
    const totalQuotes = userProfile.statistics.totalQuotes || 0;
    const daysSince = Math.floor((new Date() - userProfile.registeredAt) / (1000 * 60 * 60 * 24));
    
    const welcomeMessage = `📖 С возвращением, ${userProfile.name}!

У вас уже ${totalQuotes} цитат в личном дневнике.
С ботом: ${daysSince} дней

💡 Отправьте новую цитату или используйте команды:
/stats - ваша статистика
/search - поиск по цитатам
/help - справка

Продолжайте собирать моменты вдохновения! 📚`;

    await ctx.reply(welcomeMessage);
  }

  /**
   * Проверить, находится ли пользователь в процессе онбординга
   * @param {string} userId - ID пользователя
   * @returns {boolean}
   */
  isInOnboarding(userId) {
    return this.userStates.has(userId);
  }

  /**
   * Валидация email
   * @private
   * @param {string} email - Email для проверки
   * @returns {boolean}
   */
  _validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Получить состояние для номера вопроса
   * @private
   * @param {number} questionNumber - Номер вопроса
   * @returns {string}
   */
  _getStateForQuestion(questionNumber) {
    const stateMap = {
      2: ONBOARDING_STATES.TEST_Q2_LIFESTYLE,
      3: ONBOARDING_STATES.TEST_Q3_TIME,
      4: ONBOARDING_STATES.TEST_Q4_PRIORITIES,
      5: ONBOARDING_STATES.TEST_Q5_READING,
      6: ONBOARDING_STATES.TEST_Q6_PHRASE,
      7: ONBOARDING_STATES.TEST_Q7_TIME_AMOUNT
    };
    
    return stateMap[questionNumber] || ONBOARDING_STATES.START;
  }

  /**
   * Очистить устаревшие состояния (старше 1 часа)
   */
  cleanupStaleStates() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [userId, state] of this.userStates.entries()) {
      if (state.startTime < oneHourAgo) {
        this.userStates.delete(userId);
        logger.info(`📖 Cleaned up stale onboarding state for user ${userId}`);
      }
    }
  }

  /**
   * Получить статистику онбординга
   * @returns {Object}
   */
  getStats() {
    return {
      activeOnboardings: this.userStates.size,
      states: Array.from(this.userStates.values()).reduce((acc, state) => {
        acc[state.state] = (acc[state.state] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

module.exports = { OnboardingHandler };