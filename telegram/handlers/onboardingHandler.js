/**
 * Onboarding handler for Reader bot
 * Handles the 7-question test, email collection, and traffic source
 * @file telegram/handlers/onboardingHandler.js
 */

const { UserProfile } = require('../../server/models');

/**
 * @typedef {import('../../server/types/reader').TestResults} TestResults
 * @typedef {import('../../server/types/reader').UserProfileData} UserProfileData
 */

/**
 * Onboarding states for state management
 * @readonly
 * @enum {string}
 */
const ONBOARDING_STATES = {
  START: 'onboarding_start',
  TEST_Q1_NAME: 'test_q1_name',
  TEST_Q2_LIFESTYLE: 'test_q2_lifestyle', 
  TEST_Q3_TIME: 'test_q3_time',
  TEST_Q4_PRIORITIES: 'test_q4_priorities',
  TEST_Q5_READING: 'test_q5_reading',
  TEST_Q6_PHRASE: 'test_q6_phrase',
  TEST_Q7_TIME_AMOUNT: 'test_q7_time_amount',
  COLLECT_EMAIL: 'collect_email',
  COLLECT_SOURCE: 'collect_source',
  COMPLETE: 'complete'
};

/**
 * Test questions configuration for Reader bot onboarding
 * @type {Object.<string, Object>}
 */
const TEST_QUESTIONS = {
  q1: {
    text: "📝 Вопрос 1 из 7\n\nКак вас зовут?",
    type: 'text',
    placeholder: "Введите ваше имя"
  },
  q2: {
    text: "📝 Вопрос 2 из 7\n\nРасскажите о себе:",
    type: 'buttons',
    options: [
      "Я мама (дети - главная забота)",
      "Замужем, балансирую дом/работу/себя", 
      "Без отношений, изучаю мир и себя"
    ]
  },
  q3: {
    text: "📝 Вопрос 3 из 7\n\nКак вы находите время для себя?",
    type: 'buttons',
    options: [
      "Рано утром, пока все спят",
      "Поздно вечером, когда дела закончены",
      "Урывками в течение дня",
      "Время для себя? Какое время для себя?"
    ]
  },
  q4: {
    text: "📝 Вопрос 4 из 7\n\nЧто сейчас важнее всего в вашей жизни?",
    type: 'buttons',
    options: [
      "Семья и близкие отношения",
      "Карьера и профессиональный рост",
      "Самопознание и внутренняя гармония",
      "Стабильность и финансовая безопасность"
    ]
  },
  q5: {
    text: "📝 Вопрос 5 из 7\n\nЧто вы чувствуете, читая хорошие книги?",
    type: 'buttons',
    options: [
      "Вдохновение и желание действовать",
      "Покой и внутреннюю гармонию",
      "Понимание себя и мира вокруг",
      "Эмоциональный отклик и сопереживание"
    ]
  },
  q6: {
    text: "📝 Вопрос 6 из 7\n\nКакая фраза вам ближе?",
    type: 'buttons',
    options: [
      "\"Хорошая жизнь строится, а не дается по умолчанию\"",
      "\"В каждом слове — целая жизнь\"",
      "\"Счастье внутри нас, а не во внешних обстоятельствах\"",
      "\"Любовь — это решение любить каждый день\""
    ]
  },
  q7: {
    text: "📝 Вопрос 7 из 7\n\nСколько времени в неделю вы читаете?",
    type: 'buttons',
    options: [
      "Меньше часа (читаю редко)",
      "1-3 часа (несколько раз в неделю)",
      "4-7 часов (почти каждый день)",
      "Больше 7 часов (чтение - моя страсть)"
    ]
  }
};

/**
 * Traffic source options for analytics
 * @type {Array<{text: string, value: string}>}
 */
const TRAFFIC_SOURCES = [
  { text: "📱 Instagram", value: "Instagram" },
  { text: "💬 Telegram", value: "Telegram" },
  { text: "📺 YouTube", value: "YouTube" },
  { text: "🧵 Threads", value: "Threads" },
  { text: "👥 От друзей", value: "Друзья" },
  { text: "❓ Другое", value: "Другое" }
];

/**
 * OnboardingHandler class for managing user registration flow
 */
class OnboardingHandler {
  constructor() {
    this.userStates = new Map(); // In-memory state storage
  }

  /**
   * Handle /start command - begin onboarding process
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async handleStart(ctx) {
    const userId = ctx.from.id.toString();
    
    // Check if user already completed onboarding
    const existingProfile = await UserProfile.findOne({ userId });
    if (existingProfile && existingProfile.isOnboardingComplete) {
      await ctx.reply(
        `📖 Здравствуйте, ${existingProfile.name}!\n\nВы уже зарегистрированы в «Читателе». Просто отправьте цитату, которая вас вдохновила!`
      );
      return;
    }

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

    this.setState(userId, ONBOARDING_STATES.START);
  }

  /**
   * Handle callback queries during onboarding
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async handleCallback(ctx) {
    const userId = ctx.from.id.toString();
    const callbackData = ctx.callbackQuery.data;

    try {
      if (callbackData === 'start_test') {
        await this.startTest(ctx);
      } else if (callbackData.startsWith('test_q')) {
        await this.handleTestAnswer(ctx, callbackData);
      } else if (callbackData.startsWith('source_')) {
        await this.handleSourceSelection(ctx, callbackData);
      }

      // Acknowledge callback to remove loading state
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('❌ Error handling onboarding callback:', error);
      await ctx.answerCbQuery("Произошла ошибка. Попробуйте еще раз.");
    }
  }

  /**
   * Handle text messages during onboarding
   * @param {Object} ctx - Telegram context
   * @returns {Promise<boolean>} - Returns true if message was handled by onboarding
   */
  async handleTextMessage(ctx) {
    const userId = ctx.from.id.toString();
    const state = this.getState(userId);
    const messageText = ctx.message.text.trim();

    if (!state || state === ONBOARDING_STATES.COMPLETE) {
      return false; // Not in onboarding process
    }

    try {
      switch (state) {
        case ONBOARDING_STATES.TEST_Q1_NAME:
          await this.handleNameInput(ctx, messageText);
          return true;

        case ONBOARDING_STATES.COLLECT_EMAIL:
          await this.handleEmailInput(ctx, messageText);
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error('❌ Error handling onboarding text message:', error);
      await ctx.reply("Произошла ошибка. Попробуйте еще раз.");
      return true;
    }
  }

  /**
   * Start the test process
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async startTest(ctx) {
    const userId = ctx.from.id.toString();
    
    // Initialize test data
    this.setTestData(userId, {
      answers: {},
      currentQuestion: 1
    });

    await this.askQuestion(ctx, 'q1');
    this.setState(userId, ONBOARDING_STATES.TEST_Q1_NAME);
  }

  /**
   * Ask a specific test question
   * @param {Object} ctx - Telegram context
   * @param {string} questionKey - Question key (q1, q2, etc.)
   * @returns {Promise<void>}
   */
  async askQuestion(ctx, questionKey) {
    const question = TEST_QUESTIONS[questionKey];
    
    if (question.type === 'text') {
      await ctx.editMessageText(question.text, {
        reply_markup: { force_reply: true }
      });
    } else if (question.type === 'buttons') {
      const keyboard = question.options.map((option, index) => [{
        text: option,
        callback_data: `test_${questionKey}_${index}`
      }]);

      await ctx.editMessageText(question.text, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  /**
   * Handle test answer from buttons
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Callback data
   * @returns {Promise<void>}
   */
  async handleTestAnswer(ctx, callbackData) {
    const userId = ctx.from.id.toString();
    const [, questionKey, answerIndex] = callbackData.split('_');
    const questionNum = parseInt(questionKey.replace('q', ''));
    
    const testData = this.getTestData(userId);
    const question = TEST_QUESTIONS[questionKey];
    const answer = question.options[parseInt(answerIndex)];

    // Save answer
    testData.answers[`question${questionNum}`] = answer;
    this.setTestData(userId, testData);

    // Progress to next question or finish test
    if (questionNum < 7) {
      const nextQuestionKey = `q${questionNum + 1}`;
      await this.askQuestion(ctx, nextQuestionKey);
      
      // Update state for text questions
      if (nextQuestionKey === 'q1') {
        this.setState(userId, ONBOARDING_STATES.TEST_Q1_NAME);
      } else {
        this.setState(userId, `test_${nextQuestionKey}`);
      }
    } else {
      await this.finishTest(ctx);
    }
  }

  /**
   * Handle name input for question 1
   * @param {Object} ctx - Telegram context
   * @param {string} name - User's name
   * @returns {Promise<void>}
   */
  async handleNameInput(ctx, name) {
    const userId = ctx.from.id.toString();
    
    if (name.length < 2 || name.length > 50) {
      await ctx.reply("Пожалуйста, введите корректное имя (от 2 до 50 символов):");
      return;
    }

    // Save name in test data
    const testData = this.getTestData(userId);
    testData.answers.question1_name = name;
    this.setTestData(userId, testData);

    // Continue to question 2
    await this.askQuestion(ctx, 'q2');
    this.setState(userId, ONBOARDING_STATES.TEST_Q2_LIFESTYLE);
  }

  /**
   * Finish the test and collect email
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async finishTest(ctx) {
    const userId = ctx.from.id.toString();
    const testData = this.getTestData(userId);

    const completionMessage = `✅ Тест завершен! Спасибо за ответы.

Теперь мне нужен ваш email для отправки еженедельных отчетов и персональных рекомендаций.

📧 Введите ваш email адрес:`;

    await ctx.editMessageText(completionMessage);
    this.setState(userId, ONBOARDING_STATES.COLLECT_EMAIL);
  }

  /**
   * Handle email input
   * @param {Object} ctx - Telegram context
   * @param {string} email - User's email
   * @returns {Promise<void>}
   */
  async handleEmailInput(ctx, email) {
    const userId = ctx.from.id.toString();
    
    if (!this.validateEmail(email)) {
      await ctx.reply(`❌ Некорректный email адрес. Пожалуйста, введите правильный email:

Пример: your.email@gmail.com`);
      return;
    }

    // Save email in test data
    const testData = this.getTestData(userId);
    testData.email = email;
    this.setTestData(userId, testData);

    await this.collectSource(ctx);
  }

  /**
   * Show traffic source selection
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async collectSource(ctx) {
    const userId = ctx.from.id.toString();

    const sourceMessage = `📊 Последний вопрос!

Откуда вы узнали о боте «Читатель»?
Это поможет нам лучше понимать наших читателей.`;

    const keyboard = TRAFFIC_SOURCES.map(source => [{
      text: source.text,
      callback_data: `source_${source.value.toLowerCase()}`
    }]);

    await ctx.reply(sourceMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });

    this.setState(userId, ONBOARDING_STATES.COLLECT_SOURCE);
  }

  /**
   * Handle traffic source selection
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Source callback data
   * @returns {Promise<void>}
   */
  async handleSourceSelection(ctx, callbackData) {
    const userId = ctx.from.id.toString();
    const sourceValue = callbackData.replace('source_', '');
    
    // Find the actual source value
    const source = TRAFFIC_SOURCES.find(s => 
      s.value.toLowerCase() === sourceValue
    );

    if (!source) {
      await ctx.answerCbQuery("Ошибка выбора источника. Попробуйте еще раз.");
      return;
    }

    const testData = this.getTestData(userId);
    testData.source = source.value;

    await this.completeOnboarding(ctx, testData);
  }

  /**
   * Complete the onboarding process
   * @param {Object} ctx - Telegram context
   * @param {Object} testData - Collected test data
   * @returns {Promise<void>}
   */
  async completeOnboarding(ctx, testData) {
    const userId = ctx.from.id.toString();
    
    try {
      // Prepare user profile data
      const userProfileData = {
        userId: userId,
        telegramUsername: ctx.from.username || '',
        name: testData.answers.question1_name,
        email: testData.email,
        testResults: {
          name: testData.answers.question1_name,
          lifestyle: testData.answers.question2 || '',
          timeForSelf: testData.answers.question3 || '',
          priorities: testData.answers.question4 || '',
          readingFeelings: testData.answers.question5 || '',
          closestPhrase: testData.answers.question6 || '',
          readingTime: testData.answers.question7 || ''
        },
        source: testData.source,
        preferences: {
          mainThemes: [], // Will be analyzed later
          personalityType: '', // Will be analyzed later
          recommendationStyle: '' // Will be analyzed later
        },
        registeredAt: new Date(),
        isOnboardingComplete: true
      };

      // Save to database
      await UserProfile.findOneAndUpdate(
        { userId },
        userProfileData,
        { upsert: true, new: true }
      );

      const completionMessage = `🎉 Регистрация завершена!

Добро пожаловать в «Читатель», ${testData.answers.question1_name}!

Теперь главная фишка «Читателя»:
📖 Каждый раз, когда встречаете цитату, которая зажигает что-то важное - просто копируйте и присылайте сюда.

Попробуйте прямо сейчас! Пришлите любую цитату, которая вам нравится.

💡 Хватит сидеть в телефоне - читайте книги!`;

      await ctx.editMessageText(completionMessage);

      // Clean up temporary data
      this.clearUserData(userId);
      this.setState(userId, ONBOARDING_STATES.COMPLETE);

      console.log(`✅ User ${userId} (${testData.answers.question1_name}) completed onboarding from ${testData.source}`);

    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
      await ctx.editMessageText(
        `❌ Произошла ошибка при завершении регистрации. Пожалуйста, попробуйте позже или обратитесь в поддержку.`
      );
    }
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean}
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 100;
  }

  /**
   * Get user's current onboarding state
   * @param {string} userId - User ID
   * @returns {string|null}
   */
  getState(userId) {
    return this.userStates.get(`${userId}_state`);
  }

  /**
   * Set user's onboarding state
   * @param {string} userId - User ID
   * @param {string} state - New state
   */
  setState(userId, state) {
    this.userStates.set(`${userId}_state`, state);
  }

  /**
   * Get user's test data
   * @param {string} userId - User ID
   * @returns {Object}
   */
  getTestData(userId) {
    return this.userStates.get(`${userId}_test`) || { answers: {} };
  }

  /**
   * Set user's test data
   * @param {string} userId - User ID
   * @param {Object} data - Test data
   */
  setTestData(userId, data) {
    this.userStates.set(`${userId}_test`, data);
  }

  /**
   * Clear all user data from memory
   * @param {string} userId - User ID
   */
  clearUserData(userId) {
    this.userStates.delete(`${userId}_state`);
    this.userStates.delete(`${userId}_test`);
  }

  /**
   * Check if user is in onboarding process
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  isInOnboarding(userId) {
    const state = this.getState(userId);
    return state && state !== ONBOARDING_STATES.COMPLETE;
  }
}

module.exports = {
  OnboardingHandler,
  ONBOARDING_STATES,
  TEST_QUESTIONS,
  TRAFFIC_SOURCES
};