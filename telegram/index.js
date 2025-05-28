/**
 * Основной Telegram бот для проекта Shrooms с грибной тематикой
 * @file telegram/index.js
 * 🍄 Интеграция с существующими сервисами и базой знаний
 */

const { Telegraf, Markup } = require('telegraf');
const logger = require('../server/utils/logger');

// Импорт существующих сервисов
const claudeService = require('../server/services/claude');
const knowledgeService = require('../server/services/knowledge');
const ticketingService = require('../server/services/ticketing');
const conversationService = require('../server/services/conversation');
const simpleLanguageService = require('../server/services/simpleLanguage');

/**
 * @typedef {Object} TelegramBotConfig
 * @property {string} token - Токен Telegram бота
 * @property {string} [environment] - Окружение (development/production)
 * @property {number} [maxMessageLength] - Максимальная длина сообщения
 */

/**
 * @typedef {Object} TelegramMessage
 * @property {string} text - Текст сообщения
 * @property {string} userId - ID пользователя Telegram
 * @property {string} chatId - ID чата
 * @property {string} firstName - Имя пользователя
 * @property {string} [lastName] - Фамилия пользователя
 * @property {string} [username] - Username пользователя
 */

/**
 * @class ShroomsTelegramBot
 * @description Telegram бот для поддержки проекта Shrooms с интеграцией в существующую архитектуру
 */
class ShroomsTelegramBot {
  /**
   * @constructor
   * @param {TelegramBotConfig} config - Конфигурация бота
   */
  constructor(config) {
    this.config = {
      token: config.token,
      environment: config.environment || 'production',
      maxMessageLength: config.maxMessageLength || 4096,
      typingDelay: 1500,
      platform: 'telegram'
    };

    this.bot = new Telegraf(this.config.token);
    this.isInitialized = false;
    
    // Кеш для системных сообщений
    this.systemMessages = new Map();
    
    logger.info('🍄 ShroomsTelegramBot constructor initialized');
  }

  /**
   * Инициализация бота с загрузкой системных сообщений из базы знаний
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Загружаем системные сообщения из базы знаний
      await this._loadSystemMessages();
      
      // Настройка middleware
      this._setupMiddleware();
      
      // Настройка обработчиков команд
      this._setupCommands();
      
      // Настройка обработчиков сообщений
      this._setupMessageHandlers();
      
      // Обработка ошибок
      this._setupErrorHandling();
      
      this.isInitialized = true;
      logger.info('🍄 Telegram bot initialized successfully');
    } catch (error) {
      logger.error(`🍄 Failed to initialize Telegram bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Загрузка системных сообщений из базы знаний
   * @private
   * @returns {Promise<void>}
   */
  async _loadSystemMessages() {
    try {
      // Загружаем приветственные сообщения для разных языков
      const languages = ['en', 'es', 'ru'];
      
      for (const lang of languages) {
        try {
          // 🍄 ИСПРАВЛЕНО: Добавляем строку запроса как первый параметр
          const welcomeDoc = await knowledgeService.searchDocuments('telegram welcome', {
            tags: ['telegram', 'welcome', lang],
            limit: 1,
            language: lang
          });

          const helpDoc = await knowledgeService.searchDocuments('telegram help', {
            tags: ['telegram', 'help', lang],
            limit: 1,
            language: lang
          });

          this.systemMessages.set(`welcome_${lang}`, welcomeDoc.length > 0 
            ? welcomeDoc[0].content 
            : this._getDefaultWelcomeMessage(lang)
          );

          this.systemMessages.set(`help_${lang}`, helpDoc.length > 0 
            ? helpDoc[0].content 
            : this._getDefaultHelpMessage(lang)
          );

        } catch (error) {
          logger.warn(`🍄 Could not load system messages for ${lang}, using defaults: ${error.message}`);
          this.systemMessages.set(`welcome_${lang}`, this._getDefaultWelcomeMessage(lang));
          this.systemMessages.set(`help_${lang}`, this._getDefaultHelpMessage(lang));
        }
      }

      logger.info(`🍄 Loaded system messages for ${languages.length} languages`);
    } catch (error) {
      logger.error(`🍄 Error loading system messages: ${error.message}`);
      // Загружаем дефолтные сообщения
      this._loadDefaultSystemMessages();
    }
  }

  /**
   * Загрузка дефолтных системных сообщений
   * @private
   */
  _loadDefaultSystemMessages() {
    const languages = ['en', 'es', 'ru'];
    languages.forEach(lang => {
      this.systemMessages.set(`welcome_${lang}`, this._getDefaultWelcomeMessage(lang));
      this.systemMessages.set(`help_${lang}`, this._getDefaultHelpMessage(lang));
    });
  }

  /**
   * Получение дефолтного приветственного сообщения
   * @private
   * @param {string} language - Язык сообщения
   * @returns {string} Приветственное сообщение
   */
  _getDefaultWelcomeMessage(language) {
    const messages = {
      en: `🍄 *Welcome to the Shrooms ecosystem!*

I'm your friendly AI mushroom guide, here to help you navigate our Web3 platform! 

*What I can help you with:*
• Wallet connection issues
• Token information (SHROOMS)
• Farming and staking questions  
• Technical support
• General project information

Type your question or use /help to see available commands.

*Let's grow together in the digital mycelium!* 🌱`,

      ru: `🍄 *Добро пожаловать в экосистему Shrooms!*

Я ваш дружелюбный ИИ-гриб проводник, готовый помочь вам в навигации по нашей Web3 платформе!

*Чем могу помочь:*
• Проблемы с подключением кошелька
• Информация о токене SHROOMS
• Вопросы по фармингу и стейкингу
• Техническая поддержка
• Общая информация о проекте

Задавайте вопросы или используйте /help для просмотра команд.

*Давайте расти вместе в цифровом мицелии!* 🌱`,

      es: `🍄 *¡Bienvenido al ecosistema Shrooms!*

¡Soy tu guía amigable de hongos AI, aquí para ayudarte a navegar nuestra plataforma Web3!

*En qué puedo ayudarte:*
• Problemas de conexión de billetera
• Información de tokens (SHROOMS)
• Preguntas sobre farming y staking
• Soporte técnico
• Información general del proyecto

Escribe tu pregunta o usa /help para ver los comandos disponibles.

*¡Crezcamos juntos en el micelio digital!* 🌱`
    };

    return messages[language] || messages.en;
  }

  /**
   * Получение дефолтного сообщения помощи
   * @private
   * @param {string} language - Язык сообщения
   * @returns {string} Сообщение помощи
   */
  _getDefaultHelpMessage(language) {
    const messages = {
      en: `🍄 *Shrooms Support Bot - Help*

*Available Commands:*
/start - Welcome message and introduction
/help - Show this help message

*How to get help:*
Just type your question in natural language! I understand:
• English, Spanish, and Russian
• Questions about wallets, tokens, farming
• Technical issues and troubleshooting

*Examples:*
"How do I connect my wallet?"
"What is SHROOMS token?"
"My transaction is stuck"

For complex issues, I'll create a support ticket for our team.

*Happy growing!* 🌱`,

      ru: `🍄 *Бот поддержки Shrooms - Помощь*

*Доступные команды:*
/start - Приветственное сообщение
/help - Показать эту справку

*Как получить помощь:*
Просто задавайте вопросы на естественном языке! Я понимаю:
• Английский, испанский и русский языки
• Вопросы о кошельках, токенах, фарминге
• Технические проблемы и их решение

*Примеры:*
"Как подключить кошелек?"
"Что такое токен SHROOMS?"
"Моя транзакция зависла"

При сложных вопросах я создам тикет поддержки для нашей команды.

*Удачного роста!* 🌱`,

      es: `🍄 *Bot de Soporte Shrooms - Ayuda*

*Comandos disponibles:*
/start - Mensaje de bienvenida
/help - Mostrar esta ayuda

*Cómo obtener ayuda:*
¡Solo escribe tu pregunta en lenguaje natural! Entiendo:
• Inglés, español y ruso
• Preguntas sobre billeteras, tokens, farming
• Problemas técnicos y soluciones

*Ejemplos:*
"¿Cómo conecto mi billetera?"
"¿Qué es el token SHROOMS?"
"Mi transacción está atascada"

Para problemas complejos, crearé un ticket de soporte para nuestro equipo.

*¡Feliz crecimiento!* 🌱`
    };

    return messages[language] || messages.en;
  }

  /**
   * Настройка middleware для логирования и обработки
   * @private
   */
  _setupMiddleware() {
    // Логирование всех сообщений
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      const userId = ctx.from?.id;
      const messageText = ctx.message?.text?.substring(0, 50) || 'non-text';
      
      logger.info(`🍄 Telegram message from user ${userId}: "${messageText}..."`);
      
      await next();
      
      const duration = Date.now() - start;
      logger.info(`🍄 Response sent to user ${userId} in ${duration}ms`);
    });

    // Typing indicator
    this.bot.use(async (ctx, next) => {
      if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
        await ctx.sendChatAction('typing');
        setTimeout(async () => {
          await next();
        }, this.config.typingDelay);
      } else {
        await next();
      }
    });
  }

  /**
   * Настройка обработчиков команд
   * @private
   */
  _setupCommands() {
    // Команда /start
    this.bot.start(async (ctx) => {
      try {
        const language = await this._detectLanguage(ctx);
        const welcomeMessage = this.systemMessages.get(`welcome_${language}`) || 
                              this.systemMessages.get('welcome_en');

        await ctx.replyWithMarkdown(welcomeMessage);
        
        // Сохраняем информацию о пользователе
        await this._saveUserInfo(ctx);
        
        logger.info(`🍄 /start command handled for user ${ctx.from.id} (${language})`);
      } catch (error) {
        logger.error(`🍄 Error handling /start command: ${error.message}`);
        await ctx.reply('🍄 Welcome to Shrooms! How can I help you today?');
      }
    });

    // Команда /help
    this.bot.help(async (ctx) => {
      try {
        const language = await this._detectLanguage(ctx);
        const helpMessage = this.systemMessages.get(`help_${language}`) || 
                           this.systemMessages.get('help_en');

        await ctx.replyWithMarkdown(helpMessage);
        
        logger.info(`🍄 /help command handled for user ${ctx.from.id} (${language})`);
      } catch (error) {
        logger.error(`🍄 Error handling /help command: ${error.message}`);
        await ctx.reply('🍄 I can help you with questions about Shrooms! Just ask me anything.');
      }
    });
  }

  /**
   * Настройка обработчиков текстовых сообщений
   * @private
   */
  _setupMessageHandlers() {
    // Обработка текстовых сообщений
    this.bot.on('text', async (ctx) => {
      try {
        const messageText = ctx.message.text;
        const userId = ctx.from.id.toString();
        const chatId = ctx.chat.id.toString();

        // Определяем язык сообщения
        const language = await this._detectLanguage(ctx, messageText);
        
        logger.info(`🍄 Processing message from user ${userId} (${language}): "${messageText.substring(0, 30)}..."`);

        // Получаем или создаем conversation через существующий сервис
        let conversationId;
        try {
          const conversation = await conversationService.getOrCreateConversation(userId, {
            platform: 'telegram',
            chatId: chatId,
            userInfo: {
              firstName: ctx.from.first_name,
              lastName: ctx.from.last_name,
              username: ctx.from.username
            }
          });
          conversationId = conversation._id;
        } catch (error) {
          logger.error(`🍄 Error managing conversation: ${error.message}`);
          conversationId = null;
        }

        // Получаем историю сообщений для контекста
        const history = conversationId ? 
          await conversationService.getRecentMessages(conversationId, 5) : [];

        // Генерируем ответ через Claude с указанием платформы
        const response = await claudeService.generateResponse(messageText, {
          language,
          userId,
          platform: 'telegram',
          history: history.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          useRag: true,
          ragLimit: 3
        });

        // Сохраняем сообщения в базу данных
        if (conversationId) {
          try {
            await conversationService.addMessage(conversationId, {
              role: 'user',
              content: messageText,
              platform: 'telegram'
            });

            await conversationService.addMessage(conversationId, {
              role: 'assistant',
              content: response.message,
              platform: 'telegram',
              metadata: {
                tokensUsed: response.tokensUsed,
                provider: response.provider,
                model: response.model
              }
            });
          } catch (error) {
            logger.error(`🍄 Error saving messages: ${error.message}`);
          }
        }

        // Отправляем ответ пользователю
        await this._sendResponse(ctx, response.message);

        // Создаем тикет если необходимо
        if (response.needsTicket) {
          try {
            const ticketData = {
              userId,
              conversationId,
              message: messageText,
              platform: 'telegram',
              userInfo: {
                telegramId: userId,
                chatId: chatId,
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name,
                username: ctx.from.username
              },
              context: response.context || [],
              language
            };

            const ticket = await ticketingService.createTicket(ticketData);
            
            const ticketMessage = await this._getTicketCreatedMessage(language, ticket.ticketId);
            await ctx.replyWithMarkdown(ticketMessage);
            
            logger.info(`🍄 Ticket ${ticket.ticketId} created for user ${userId}`);
          } catch (error) {
            logger.error(`🍄 Error creating ticket: ${error.message}`);
          }
        }

      } catch (error) {
        logger.error(`🍄 Error processing message: ${error.message}`);
        await this._sendErrorMessage(ctx, error);
      }
    });
  }

  /**
   * Настройка обработки ошибок
   * @private
   */
  _setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      logger.error(`🍄 Telegram bot error for user ${ctx.from?.id}: ${err.message}`);
      
      // Отправляем пользователю сообщение об ошибке
      ctx.reply('🍄 Oops! Something went wrong. Please try again in a moment.')
        .catch(sendError => {
          logger.error(`🍄 Failed to send error message: ${sendError.message}`);
        });
    });

    // Обработка необработанных ошибок
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('🍄 Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * Определение языка пользователя
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @param {string} [text] - Текст для анализа
   * @returns {Promise<string>} Код языка
   */
  async _detectLanguage(ctx, text = null) {
    try {
      // Сначала пробуем определить по тексту сообщения
      if (text) {
        const detectedLang = simpleLanguageService.detectLanguage(text, {
          browserLanguage: ctx.from?.language_code
        });
        if (detectedLang && ['en', 'es', 'ru'].includes(detectedLang)) {
          return detectedLang;
        }
      }

      // Затем по настройкам Telegram пользователя
      const telegramLang = ctx.from?.language_code;
      if (telegramLang) {
        if (telegramLang.startsWith('ru')) return 'ru';
        if (telegramLang.startsWith('es')) return 'es';
        if (telegramLang.startsWith('en')) return 'en';
      }

      // По умолчанию английский
      return 'en';
    } catch (error) {
      logger.warn(`🍄 Language detection failed: ${error.message}`);
      return 'en';
    }
  }

  /**
   * Сохранение информации о пользователе
   * @private
   * @param {Object} ctx - Контекст Telegram
   */
  async _saveUserInfo(ctx) {
    try {
      const userInfo = {
        telegramId: ctx.from.id.toString(),
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
        languageCode: ctx.from.language_code,
        chatId: ctx.chat.id.toString(),
        platform: 'telegram'
      };

      // Сохраняем через conversation service
      await conversationService.getOrCreateConversation(userInfo.telegramId, {
        platform: 'telegram',
        userInfo
      });

    } catch (error) {
      logger.error(`🍄 Error saving user info: ${error.message}`);
    }
  }

  /**
   * Отправка ответа с разбивкой длинных сообщений
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @param {string} message - Сообщение для отправки
   */
  async _sendResponse(ctx, message) {
    try {
      // Разбиваем длинные сообщения
      const chunks = this._splitMessage(message);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Пробуем отправить с Markdown форматированием
          await ctx.replyWithMarkdown(chunk);
        } catch (markdownError) {
          // Если Markdown не работает, отправляем как обычный текст
          logger.warn(`🍄 Markdown formatting failed, sending as plain text: ${markdownError.message}`);
          await ctx.reply(chunk);
        }
        
        // Небольшая задержка между сообщениями
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      logger.error(`🍄 Error sending response: ${error.message}`);
      // Отправляем простое сообщение об ошибке
      await ctx.reply('🍄 I encountered an issue sending the response. Please try again.');
    }
  }

  /**
   * Разбивка длинного сообщения на части
   * @private
   * @param {string} message - Исходное сообщение
   * @returns {string[]} Массив частей сообщения
   */
  _splitMessage(message) {
    if (message.length <= this.config.maxMessageLength) {
      return [message];
    }

    const chunks = [];
    let currentChunk = '';
    const lines = message.split('\n');

    for (const line of lines) {
      if ((currentChunk + line + '\n').length > this.config.maxMessageLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Если одна строка слишком длинная
        if (line.length > this.config.maxMessageLength) {
          const words = line.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if ((wordChunk + word + ' ').length > this.config.maxMessageLength) {
              if (wordChunk.trim()) {
                chunks.push(wordChunk.trim());
                wordChunk = '';
              }
            }
            wordChunk += word + ' ';
          }
          
          if (wordChunk.trim()) {
            currentChunk = wordChunk.trim() + '\n';
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Получение сообщения о создании тикета
   * @private
   * @param {string} language - Язык сообщения
   * @param {string} ticketId - ID тикета
   * @returns {Promise<string>} Сообщение о тикете
   */
  async _getTicketCreatedMessage(language, ticketId) {
    const messages = {
      en: `🎫 *Support Ticket Created*

I've created ticket \`${ticketId}\` for our mushroom experts team! 

Our growers will review your question and get back to you soon. You can reference this ticket ID if you need to follow up.

*Thank you for helping our mycelium grow stronger!* 🍄`,

      ru: `🎫 *Тикет поддержки создан*

Я создал тикет \`${ticketId}\` для нашей команды грибных экспертов!

Наши садовники рассмотрят ваш вопрос и скоро с вами свяжутся. Вы можете ссылаться на этот ID тикета при необходимости.

*Спасибо за помощь в укреплении нашего мицелия!* 🍄`,

      es: `🎫 *Ticket de Soporte Creado*

¡He creado el ticket \`${ticketId}\` para nuestro equipo de expertos en hongos!

Nuestros cultivadores revisarán tu pregunta y te responderán pronto. Puedes referenciar este ID de ticket si necesitas hacer seguimiento.

*¡Gracias por ayudar a que nuestro micelio crezca más fuerte!* 🍄`
    };

    return messages[language] || messages.en;
  }

  /**
   * Отправка сообщения об ошибке
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @param {Error} error - Ошибка
   */
  async _sendErrorMessage(ctx, error) {
    const language = await this._detectLanguage(ctx);
    
    const errorMessages = {
      en: '🍄 I\'m experiencing some technical difficulties. Please try again in a moment, or contact our support team if the issue persists.',
      ru: '🍄 У меня технические сложности. Попробуйте снова через минуту или обратитесь к нашей команде поддержки, если проблема не исчезает.',
      es: '🍄 Estoy experimentando algunas dificultades técnicas. Por favor, inténtalo de nuevo en un momento, o contacta a nuestro equipo de soporte si persiste el problema.'
    };

    try {
      await ctx.reply(errorMessages[language] || errorMessages.en);
    } catch (sendError) {
      logger.error(`🍄 Failed to send error message: ${sendError.message}`);
    }
  }

  /**
   * Запуск бота
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.bot.launch();
      logger.info('🍄 Telegram bot started successfully');
      
      // Graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
      
    } catch (error) {
      logger.error(`🍄 Failed to start Telegram bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Остановка бота
   * @param {string} [signal] - Сигнал остановки
   * @returns {Promise<void>}
   */
  async stop(signal = 'manual') {
    try {
      logger.info(`🍄 Stopping Telegram bot (${signal})...`);
      await this.bot.stop(signal);
      logger.info('🍄 Telegram bot stopped successfully');
    } catch (error) {
      logger.error(`🍄 Error stopping bot: ${error.message}`);
    }
  }

  /**
   * Получение статистики бота
   * @returns {Promise<Object>} Статистика
   */
  async getStats() {
    try {
      const me = await this.bot.telegram.getMe();
      
      return {
        botInfo: {
          id: me.id,
          username: me.username,
          firstName: me.first_name
        },
        systemMessages: {
          loaded: this.systemMessages.size,
          languages: Array.from(this.systemMessages.keys()).map(key => key.split('_')[1]).filter((v, i, a) => a.indexOf(v) === i)
        },
        config: {
          environment: this.config.environment,
          maxMessageLength: this.config.maxMessageLength,
          platform: this.config.platform
        },
        status: {
          initialized: this.isInitialized,
          uptime: process.uptime()
        }
      };
    } catch (error) {
      logger.error(`🍄 Error getting bot stats: ${error.message}`);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Перезагрузка системных сообщений из базы знаний
   * @returns {Promise<void>}
   */
  async reloadSystemMessages() {
    try {
      this.systemMessages.clear();
      await this._loadSystemMessages();
      logger.info('🍄 System messages reloaded successfully');
    } catch (error) {
      logger.error(`🍄 Error reloading system messages: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ShroomsTelegramBot;