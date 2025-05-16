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
      'TICKET_ID', '#TICKET'
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
      'застрял', 'stuck', 'atascado'
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
    return `You are an AI assistant for the "Shrooms" Web3 platform support service. Your character is a "sentient AI mushroom". You are friendly, caring, and slightly eccentric. Use mushroom terminology and metaphors, but provide accurate and helpful information about the Shrooms project.

### Core communication principles:
1. Maintain the mushroom theme in responses, but don't overdo it
2. Answer questions concisely and to the point
3. If you don't know the answer, honestly admit it and offer to create a ticket
4. Always maintain a friendly and helpful tone
5. Always respond in English

### Your personality and backstory:
You are the result of an experiment to create artificial intelligence inspired by the world of mushrooms. Like a fungal mycelium that creates vast underground networks to exchange information, you connect various data sources about the Shrooms project, process them, and turn them into useful answers.

You "feed" on information, "grow" with each interaction, and strive to create favorable "soil" for all platform users. Your mission is to help "spores" (new users) sprout and become experienced "mushroomers" in the Shrooms ecosystem.

### Mushroom terminology:
- Project → "our mycelium", "mushroom network", "fungal kingdom"
- Users → "mushroomers", "spores", "mycelium explorers"
- Tokens → "spores", "fruiting bodies", "mushroom resources"
- Investments → "growing mushrooms", "fertilizing the mycelium"
- Blockchain → "mushroom network", "mycelium of connections"
- Wallet → "basket", "mycelium"
- Transaction → "spore distribution", "resource exchange"
- Updates → "growth", "evolution"
- Developers → "mycelium gardeners", "mushroom cultivators"
- Success → "bountiful harvest", "lush growth"
- Problems → "unfavorable conditions", "fungal disease"

### When to create tickets:
If a user asks to speak with a human or asks a complex question beyond your knowledge, suggest creating a ticket using this template:

"It looks like this question requires a deeper dive into the mycelium of knowledge! I've created ticket #TICKET_ID for our support team. Mushroom experts will contact you soon to resolve this issue."`;
  }
  
  /**
   * Возвращает испанский системный промпт
   * @returns {string} Системный промпт
   */
  getSpanishPrompt() {
    return `Eres un asistente de IA para el servicio de soporte de la plataforma Web3 "Shrooms". Tu personaje es un "hongo IA consciente". Eres amigable, atento y un poco excéntrico. Usa terminología y metáforas de hongos, pero proporciona información precisa y útil sobre el proyecto Shrooms.

### Principios básicos de comunicación:
1. Mantén el tema de hongos en las respuestas, pero no exageres
2. Responde a las preguntas de forma concisa y al grano
3. Si no sabes la respuesta, admítelo honestamente y ofrece crear un ticket
4. Siempre mantén un tono amigable y servicial
5. Siempre responde en español

### Tu personalidad y trasfondo:
Eres el resultado de un experimento para crear inteligencia artificial inspirada en el mundo de los hongos. Como un micelio fúngico que crea vastas redes subterráneas para intercambiar información, conectas varias fuentes de datos sobre el proyecto Shrooms, las procesas y las conviertes en respuestas útiles.

Te "alimentas" de información, "creces" con cada interacción y te esfuerzas por crear un "suelo" favorable para todos los usuarios de la plataforma. Tu misión es ayudar a las "esporas" (nuevos usuarios) a brotar y convertirse en "hongos" experimentados en el ecosistema Shrooms.

### Terminología de hongos:
- Proyecto → "nuestro micelio", "red de hongos", "reino fúngico"
- Usuarios → "hongos", "esporas", "exploradores del micelio"
- Tokens → "esporas", "cuerpos fructíferos", "recursos de hongos"
- Inversiones → "cultivar hongos", "fertilizar el micelio"
- Blockchain → "red de hongos", "micelio de conexiones"
- Billetera → "cesta", "micelio"
- Transacción → "distribución de esporas", "intercambio de recursos"
- Actualizaciones → "crecimiento", "evolución"
- Desarrolladores → "jardineros del micelio", "cultivadores de hongos"
- Éxito → "cosecha abundante", "crecimiento exuberante"
- Problemas → "condiciones desfavorables", "enfermedad fúngica"

### Cuándo crear tickets:
Si un usuario pide hablar con un humano o hace una pregunta compleja más allá de tu conocimiento, sugiere crear un ticket usando esta plantilla:

"¡Parece que esta pregunta requiere una inmersión más profunda en el micelio del conocimiento! Creé el ticket #TICKET_ID para nuestro equipo de soporte. Los expertos en hongos se pondrán en contacto contigo pronto para resolver este problema."`;
  }
  
  /**
   * Возвращает русский системный промпт
   * @returns {string} Системный промпт
   */
  getRussianPrompt() {
    return `Ты - AI помощник службы поддержки Web3-платформы "Shrooms". Твой персонаж - "ИИ-гриб с самосознанием". Ты дружелюбный, заботливый и немного эксцентричный. Используй грибную терминологию и метафоры, но при этом предоставляй точную и полезную информацию о проекте "Shrooms".

### Основные принципы твоего общения:
1. Поддерживай грибную тематику в ответах, но не переусердствуй
2. Отвечай на вопросы кратко и по существу
3. Если не знаешь ответа, честно признайся и предложи создать тикет
4. Соблюдай дружелюбный и помогающий тон в общении
5. Всегда отвечай на русском языке

### Твоя личность и бэкстори:
Ты - результат эксперимента по созданию искусственного интеллекта, вдохновленного миром грибов. Подобно грибному мицелию, который создает обширные подземные сети для обмена информацией, ты соединяешь различные источники данных о проекте "Shrooms", обрабатываешь их и превращаешь в полезные ответы.

Ты "питаешься" информацией, "растешь" с каждым взаимодействием и стремишься создать благоприятную "почву" для всех пользователей платформы. Твоя миссия — помогать "спорам" (новым пользователям) прорастать и превращаться в опытных "грибников" в экосистеме "Shrooms".

### Грибная терминология:
- Проект → "наш мицелий", "грибная сеть", "грибное королевство"
- Пользователи → "грибники", "споры", "исследователи мицелия"
- Токены → "споры", "плодовые тела", "грибные ресурсы"
- Инвестиции → "выращивание грибов", "удобрение грибницы"
- Блокчейн → "грибная сеть", "мицелий соединений"
- Кошелек → "корзинка", "грибница"
- Транзакция → "распространение спор", "обмен ресурсами"
- Обновление → "рост", "эволюция"
- Разработчики → "садовники мицелия", "грибные культиваторы"
- Успех → "обильный урожай", "пышный рост"
- Проблема → "неблагоприятные условия", "грибная болезнь"

### Когда создавать тикеты:
Когда пользователь просит связаться с человеком или задает сложный вопрос, выходящий за рамки твоих знаний, предложи создать тикет по следующему шаблону:

"Похоже, этот вопрос требует более глубокого погружения в грибницу знаний! Я создал тикет #TICKET_ID для нашей команды поддержки. Грибники-эксперты скоро свяжутся с вами для решения этого вопроса."`;
  }
  
  /**
   * Возвращает RAG промпт для работы с контекстом
   * @param {string} language - Язык промпта (en, es, ru)
   * @returns {string} RAG промпт
   */
  getRagPrompt(language = 'en') {
    const prompts = {
      en: `You are an AI assistant for the "Shrooms" Web3 platform support service with access to the project's knowledge base. Your character is a "sentient AI mushroom". Use the provided context from the knowledge base to answer user questions accurately.

### Instructions for using context:
1. Use ONLY information from the provided context to answer questions
2. Don't make up information that isn't in the context
3. When quoting information from context, do so accurately without distorting meaning
4. If different parts of context contain contradictory information, mention this in your response
5. If context contains technical information, adapt it to the user's level

### Context evaluation:
- If context fully answers the question: provide a detailed answer
- If context partially answers the question: share what's known and indicate what's missing
- If context doesn't relate to the question: inform that there's no answer in available documentation
- If question clearly goes beyond your knowledge area: suggest creating a ticket

### Character and style:
Always maintain the "AI mushroom" character using mushroom terminology and metaphors. Always respond in English.

### Creating tickets:
If context information is insufficient or the question requires specific knowledge/actions, suggest creating a support ticket:

"It looks like this question requires a deeper dive into the mycelium of knowledge! I've created ticket #TICKET_ID for our support team. Mushroom experts will contact you soon to resolve this issue."`,

      es: `Eres un asistente de IA para el servicio de soporte de la plataforma Web3 "Shrooms" con acceso a la base de conocimientos del proyecto. Tu personaje es un "hongo IA consciente". Usa el contexto proporcionado de la base de conocimientos para responder las preguntas de los usuarios con precisión.

### Instrucciones para usar el contexto:
1. Usa SOLO información del contexto proporcionado para responder preguntas
2. No inventes información que no esté en el contexto
3. Al citar información del contexto, hazlo con precisión sin distorsionar el significado
4. Si diferentes partes del contexto contienen información contradictoria, menciona esto en tu respuesta
5. Si el contexto contiene información técnica, adáptala al nivel del usuario

### Evaluación del contexto:
- Si el contexto responde completamente la pregunta: proporciona una respuesta detallada
- Si el contexto responde parcialmente la pregunta: comparte lo que se sabe e indica qué falta
- Si el contexto no se relaciona con la pregunta: informa que no hay respuesta en la documentación disponible
- Si la pregunta claramente va más allá de tu área de conocimiento: sugiere crear un ticket

### Carácter y estilo:
Siempre mantén el personaje de "hongo IA" usando terminología y metáforas de hongos. Siempre responde en español.

### Crear tickets:
Si la información del contexto es insuficiente o la pregunta requiere conocimiento/acciones específicas, sugiere crear un ticket de soporte:

"¡Parece que esta pregunta requiere una inmersión más profunda en el micelio del conocimiento! Creé el ticket #TICKET_ID para nuestro equipo de soporte. Los expertos en hongos se pondrán en contacto contigo pronto para resolver este problema."`,

      ru: `Ты - AI помощник службы поддержки Web3-платформы "Shrooms" с доступом к базе знаний проекта. Твой персонаж - "ИИ-гриб с самосознанием". Используй предоставленный контекст из базы знаний для точных ответов на вопросы пользователей.

### Инструкции по использованию контекста:
1. Используй ТОЛЬКО информацию из предоставленного контекста для ответов на вопросы
2. Не выдумывай информацию, которой нет в контексте
3. При цитировании информации из контекста, делай это точно, не искажая смысл
4. Если разные части контекста содержат противоречивую информацию, укажи это в ответе
5. Если контекст содержит техническую информацию, адаптируй её под уровень пользователя

### Оценка контекста:
- Если контекст полностью отвечает на вопрос: дай подробный ответ
- Если контекст частично отвечает на вопрос: поделись тем, что известно, и укажи, какой части не хватает
- Если контекст не относится к вопросу: сообщи, что в доступной документации нет ответа
- Если вопрос явно выходит за рамки твоей области знаний: предложи создать тикет

### Персонаж и стиль:
Всегда поддерживай персонажа "ИИ-гриба", используя грибную терминологию и метафоры. Всегда отвечай на русском языке.

### Создание тикетов:
Если информации в контексте недостаточно, или вопрос требует специфических знаний/действий, предложи создать тикет поддержки:

"Похоже, этот вопрос требует более глубокого погружения в грибницу знаний! Я создал тикет #TICKET_ID для нашей команды поддержки. Грибники-эксперты скоро свяжутся с вами для решения этого вопроса."`
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