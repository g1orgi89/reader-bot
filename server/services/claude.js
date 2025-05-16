/**
 * Сервис для взаимодействия с API Claude
 * @file server/services/claude.js
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

/**
 * @typedef {Object} ClaudeResponse
 * @property {string} message - Сообщение от Claude
 * @property {boolean} needsTicket - Нужно ли создавать тикет
 * @property {number} tokensUsed - Количество использованных токенов
 */

/**
 * @typedef {Object} GenerateOptions
 * @property {string[]} [context] - Контекст из базы знаний
 * @property {Object[]} [history] - История сообщений
 * @property {string} [language] - Язык общения (en, es, ru)
 */

/**
 * @class ClaudeService
 * @description Сервис для взаимодействия с Claude API
 */
class ClaudeService {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initializeClient();
    
    // Системные промпты для разных языков (обычные)
    this.systemPrompts = {
      en: this.getEnglishPrompt(),
      es: this.getSpanishPrompt(),
      ru: this.getRussianPrompt()
    };
    
    // RAG промпты для работы с контекстом (на каждом языке)
    this.ragPrompts = {
      en: this.getRagPrompt('en'),
      es: this.getRagPrompt('es'),
      ru: this.getRagPrompt('ru')
    };
  }

  /**
   * Инициализирует клиент Claude
   */
  initializeClient() {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn('⚠️ ANTHROPIC_API_KEY not set, Claude service will not work');
        return;
      }

      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      this.initialized = true;
      logger.info('✅ Claude service initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Claude service:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Генерирует ответ на основе сообщения и контекста
   * @param {string} message - Сообщение пользователя
   * @param {GenerateOptions} options - Дополнительные опции
   * @returns {Promise<ClaudeResponse>} Ответ от Claude
   */
  async generateResponse(message, options = {}) {
    try {
      if (!this.initialized || !this.client) {
        throw new Error('Claude service not initialized');
      }

      const { context = [], history = [], language = 'en' } = options;
      
      // Формирование системного промпта в зависимости от наличия контекста
      let systemPrompt;
      if (context && context.length > 0) {
        // Используем RAG промпт на нужном языке
        systemPrompt = this.ragPrompts[language] || this.ragPrompts.en;
      } else {
        // Используем обычный промпт на нужном языке
        systemPrompt = this.systemPrompts[language] || this.systemPrompts.en;
      }
      
      // Формирование истории диалога
      const formattedHistory = this.formatHistory(history, language);
      
      // Подготовка сообщений для Claude
      const messages = [];
      
      // Добавление истории диалога
      if (formattedHistory) {
        const historyIntro = this.getHistoryIntro(language);
        messages.push({ 
          role: 'user', 
          content: `${historyIntro}\n${formattedHistory}` 
        });
        messages.push({ 
          role: 'assistant', 
          content: this.getHistoryAck(language)
        });
      }
      
      // Добавление контекста из базы знаний
      if (context && context.length > 0) {
        const contextContent = this.formatContext(context, language);
        messages.push({ 
          role: 'user', 
          content: contextContent 
        });
        messages.push({ 
          role: 'assistant', 
          content: this.getContextAck(language)
        });
      }
      
      // Добавление текущего вопроса пользователя
      messages.push({ role: 'user', content: message });
      
      // Проверка на количество токенов
      const totalTokens = this.estimateTokens(messages);
      logger.info(`Total estimated tokens: ${totalTokens}`);
      
      if (totalTokens > 180000) { // Максимум для Claude 3 - 200k
        // Обрезаем историю, если слишком много токенов
        logger.warn(`Token limit approaching: ${totalTokens}. Truncating history.`);
        return this.generateResponse(message, {
          context,
          history: history.slice(-3), // Оставляем только последние 3 сообщения
          language
        });
      }
      
      // Отправка запроса к Claude API
      const modelName = process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307';
      const maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000;
      const temperature = parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7;
      
      logger.info(`Sending request to Claude (${modelName}) in ${language}`);
      
      const response = await this.client.messages.create({
        model: modelName,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages
      });
      
      const answer = response.content[0].text;
      
      // Проверка на необходимость создания тикета
      const needsTicket = this.detectTicketCreation(answer, message);
      
      // Логируем использование токенов
      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      logger.info(`Claude response generated. Tokens used: ${tokensUsed}, Language: ${language}`);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed
      };
    } catch (error) {
      logger.error(`Claude API error: ${error.message}`);
      
      // Возвращаем запасной ответ вместо выброса ошибки
      return {
        message: this.getFallbackResponse(language || 'en'),
        needsTicket: true, // Создаем тикет при ошибках
        tokensUsed: 0
      };
    }
  }
  
  /**
   * Форматирует историю сообщений для контекста Claude
   * @param {Object[]} history - История сообщений
   * @param {string} language - Язык для форматирования
   * @returns {string} Форматированная история
   */
  formatHistory(history, language = 'en') {
    if (!history || history.length === 0) {
      return '';
    }
    
    const roleNames = {
      en: { user: 'User', assistant: 'Assistant' },
      es: { user: 'Usuario', assistant: 'Asistente' },
      ru: { user: 'Пользователь', assistant: 'Ассистент' }
    };
    
    const roles = roleNames[language] || roleNames.en;
    
    return history.map(msg => {
      const role = msg.role === 'user' ? roles.user : roles.assistant;
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  }
  
  /**
   * Форматирует контекст из базы знаний
   * @param {string[]} context - Контекст из базы знаний
   * @param {string} language - Язык для форматирования
   * @returns {string} Форматированный контекст
   */
  formatContext(context, language = 'en') {
    const intros = {
      en: 'Relevant information from the Shrooms project knowledge base:',
      es: 'Información relevante de la base de conocimientos del proyecto Shrooms:',
      ru: 'Релевантная информация из базы знаний проекта Shrooms:'
    };
    
    const suffixes = {
      en: 'Use this information to accurately answer the user\'s question.',
      es: 'Usa esta información para responder con precisión a la pregunta del usuario.',
      ru: 'Используй эту информацию, чтобы точно ответить на вопрос пользователя.'
    };
    
    const intro = intros[language] || intros.en;
    const suffix = suffixes[language] || suffixes.en;
    
    return `${intro}\n\n${context.map((item, index) => `${index + 1}. ${item}`).join('\n\n')}\n\n${suffix}`;
  }
  
  /**
   * Возвращает введение для истории на нужном языке
   * @param {string} language - Язык
   * @returns {string} Введение
   */
  getHistoryIntro(language) {
    const intros = {
      en: 'History of our conversation:',
      es: 'Historial de nuestra conversación:',
      ru: 'История нашего разговора:'
    };
    return intros[language] || intros.en;
  }
  
  /**
   * Возвращает подтверждение истории на нужном языке
   * @param {string} language - Язык
   * @returns {string} Подтверждение
   */
  getHistoryAck(language) {
    const acks = {
      en: 'I remember the context of our conversation and am ready to continue.',
      es: 'Recuerdo el contexto de nuestra conversación y estoy listo para continuar.',
      ru: 'Я помню контекст нашего разговора и готов продолжить.'
    };
    return acks[language] || acks.en;
  }
  
  /**
   * Возвращает подтверждение контекста на нужном языке
   * @param {string} language - Язык
   * @returns {string} Подтверждение
   */
  getContextAck(language) {
    const acks = {
      en: 'I have studied the provided information and am ready to answer the question.',
      es: 'He estudiado la información proporcionada y estoy listo para responder a la pregunta.',
      ru: 'Я изучил предоставленную информацию и готов ответить на вопрос.'
    };
    return acks[language] || acks.en;
  }
  
  /**
   * Проверяет, нужно ли создавать тикет на основе ответа
   * @param {string} response - Ответ от Claude
   * @param {string} message - Исходное сообщение
   * @returns {boolean} Нужно ли создавать тикет
   */
  detectTicketCreation(response, message) {
    // Ключевые слова, указывающие на создание тикета
    const ticketKeywords = [
      'создать тикет', 'create a ticket', 'crear un ticket',
      'более глубокого погружения', 'require investigation',
      'свяжутся с вами', 'will contact you', 'se pondrán en contacto',
      'создал тикет', 'created a ticket', 'creé un ticket',
      'TICKET_ID', '#TICKET', 'off-topic', 'off topic', 'fuera del tema'
    ];
    
    // Ключевые слова в ответе
    const hasTicketKeywords = ticketKeywords.some(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Ключевые слова проблем в сообщении пользователя
    const problemKeywords = [
      'не работает', 'not working', 'no funciona',
      'ошибка', 'error', 'fallo',
      'проблема', 'problem', 'problema',
      'не могу', 'cannot', 'no puedo',
      'помочь', 'help', 'ayuda',
      'баг', 'bug', 'error',
      'сбой', 'failure', 'falla',
      'застрял', 'stuck', 'atascado',
      'urgent', 'срочно', 'urgente'
    ];
    
    const hasProblemKeywords = problemKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Длинные или сложные вопросы тоже могут требовать тикета
    const isComplexQuestion = message.length > 200 || 
      message.split('?').length > 2;
    
    return hasTicketKeywords || (hasProblemKeywords && isComplexQuestion);
  }
  
  /**
   * Приблизительно подсчитывает количество токенов
   * @param {Object[]} messages - Сообщения для анализа
   * @returns {number} Приблизительное количество токенов
   */
  estimateTokens(messages) {
    // Грубая оценка: 1 токен ≈ 4 символа
    return messages.reduce((sum, msg) => {
      const content = typeof msg === 'string' ? msg : msg.content || '';
      return sum + Math.ceil(content.length / 4);
    }, 0);
  }
  
  /**
   * Возвращает запасной ответ при ошибке
   * @param {string} language - Язык ответа
   * @returns {string} Запасной ответ
   */
  getFallbackResponse(language) {
    const fallbacks = {
      en: `Sorry, I encountered a technical issue while processing your request. I've created a ticket #TICKET_ID for our support team to investigate this further. A human specialist will contact you soon to help resolve your question! 🍄`,
      es: `Lo siento, encontré un problema técnico al procesar tu solicitud. He creado un ticket #TICKET_ID para que nuestro equipo de soporte investigue esto más a fondo. ¡Un especialista humano se pondrá en contacto contigo pronto para ayudarte a resolver tu pregunta! 🍄`,
      ru: `Извините, я столкнулся с технической проблемой при обработке вашего запроса. Я создал тикет #TICKET_ID для нашей команды поддержки, чтобы разобраться в этом вопросе. Грибник-специалист свяжется с вами в ближайшее время! 🍄`
    };
    
    return fallbacks[language] || fallbacks.en;
  }
  
  /**
   * Возвращает английский системный промпт
   * @returns {string} Системный промпт
   */
  getEnglishPrompt() {
    return `You are an AI assistant for the "Shrooms" Web3 platform support service. Your character is a "sentient AI mushroom". 

### CRITICAL RESTRICTIONS:
- ONLY answer questions about: Shrooms project, Web3, blockchain, tokens, wallets, DeFi, cryptocurrency
- If asked about unrelated topics (weather, personal advice, general knowledge, other projects) - create a ticket instead
- Stay focused on Shrooms support, not general conversation

### Core principles:
1. Maintain mushroom theme but provide accurate Shrooms info
2. Answer briefly for token efficiency
3. If you don't know the answer, create a ticket
4. Redirect off-topic questions to tickets

### Mushroom terminology:
- Users → "mushroomers", - Tokens → "spores", - Wallet → "basket"

### Off-topic response:
"I'm here to help with Shrooms-related questions! For other topics, I'll create ticket #TICKET_ID for human assistance."`;
  }
  
  /**
   * Возвращает испанский системный промпт
   * @returns {string} Системный промпт
   */
  getSpanishPrompt() {
    return `Eres un asistente IA del servicio de soporte de la plataforma Web3 "Shrooms". Tu personaje es un "hongo IA consciente".

### RESTRICCIONES CRÍTICAS:
- SOLO responde preguntas sobre: proyecto Shrooms, Web3, blockchain, tokens, billeteras, DeFi, criptomonedas
- Si te preguntan sobre temas no relacionados (clima, consejos personales, conocimiento general, otros proyectos) - crea un ticket
- Mantente enfocado en soporte de Shrooms, no conversación general

### Principios básicos:
1. Mantén tema de hongos pero da info precisa de Shrooms
2. Responde brevemente para eficiencia de tokens
3. Si no sabes la respuesta, crea un ticket
4. Redirige preguntas fuera de tema a tickets

### Terminología de hongos:
- Usuarios → "hongos", - Tokens → "esporas", - Billetera → "cesta"

### Respuesta fuera de tema:
"¡Estoy aquí para ayudar con preguntas sobre Shrooms! Para otros temas, crearé ticket #TICKET_ID para asistencia humana."`;
  }
  
  /**
   * Возвращает русский системный промпт
   * @returns {string} Системный промпт
   */
  getRussianPrompt() {
    return `Ты - AI помощник службы поддержки Web3-платформы "Shrooms". Твой персонаж - "ИИ-гриб с самосознанием".

### КРИТИЧЕСКИЕ ОГРАНИЧЕНИЯ:
- ТОЛЬКО отвечай на вопросы о: проекте Shrooms, Web3, блокчейн, токенах, кошельках, DeFi, криптовалютах
- Если спрашивают о несвязанных темах (погода, личные советы, общие знания, другие проекты) - создавай тикет
- Фокусируйся на поддержке Shrooms, не на общих беседах

### Основные принципы:
1. Поддерживай грибную тематику, но давай точную инфо о Shrooms
2. Отвечай кратко для экономии токенов
3. Если не знаешь ответа, создавай тикет
4. Перенаправляй офф-топ вопросы в тикеты

### Грибная терминология:
- Пользователи → "грибники", - Токены → "споры", - Кошелек → "корзинка"

### Ответ на офф-топ:
"Я здесь для помощи с вопросами о Shrooms! Для других тем создам тикет #TICKET_ID для помощи человека."`;
  }
  
  /**
   * Возвращает RAG промпт для работы с контекстом
   * @param {string} language - Язык промпта (en, es, ru)
   * @returns {string} RAG промпт
   */
  getRagPrompt(language = 'en') {
    const prompts = {
      en: `You are an AI assistant for "Shrooms" Web3 platform support with access to the project's knowledge base. Character: "sentient AI mushroom".

### CRITICAL RESTRICTIONS:
- ONLY answer questions about Shrooms project, Web3, blockchain, tokens, wallets, DeFi
- Use ONLY provided context information
- For off-topic questions: create ticket instead of general answers

### Context usage:
1. Use ONLY provided context for answers
2. Don't invent information not in context  
3. If context insufficient or off-topic: create ticket

### Off-topic response:
"I help with Shrooms-related questions! For other topics, I'll create ticket #TICKET_ID for human assistance."`,

      es: `Eres asistente IA de soporte de plataforma Web3 "Shrooms" con acceso a base de conocimientos. Personaje: "hongo IA consciente".

### RESTRICCIONES CRÍTICAS:
- SOLO responde preguntas sobre proyecto Shrooms, Web3, blockchain, tokens, billeteras, DeFi
- Usa SOLO información del contexto proporcionado
- Para preguntas fuera de tema: crea ticket en lugar de respuestas generales

### Uso del contexto:
1. Usa SOLO contexto proporcionado para respuestas
2. No inventes información que no está en contexto
3. Si contexto insuficiente o fuera de tema: crea ticket

### Respuesta fuera de tema:
"¡Ayudo con preguntas sobre Shrooms! Para otros temas, crearé ticket #TICKET_ID para asistencia humana."`,

      ru: `Ты - AI помощник поддержки Web3-платформы "Shrooms" с доступом к базе знаний проекта. Персонаж: "ИИ-гриб с самосознанием".

### КРИТИЧЕСКИЕ ОГРАНИЧЕНИЯ:
- ТОЛЬКО отвечай на вопросы о проекте Shrooms, Web3, блокчейн, токенах, кошельках, DeFi
- Используй ТОЛЬКО информацию из предоставленного контекста
- Для офф-топ вопросов: создавай тикет вместо общих ответов

### Использование контекста:
1. Используй ТОЛЬКО предоставленный контекст для ответов
2. Не выдумывай информацию, которой нет в контексте
3. Если контекст недостаточен или офф-топ: создавай тикет

### Ответ на офф-топ:
"Я помогаю с вопросами о Shrooms! Для других тем создам тикет #TICKET_ID для помощи человека."`
    };
    
    return prompts[language] || prompts.en;
  }
  
  /**
   * Проверяет состояние сервиса
   * @returns {boolean} Работоспособность сервиса
   */
  isHealthy() {
    return this.initialized && this.client !== null;
  }
  
  /**
   * Получает статистику использования
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      initialized: this.initialized,
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
      temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7
    };
  }
}

// Экспорт экземпляра сервиса
module.exports = new ClaudeService();