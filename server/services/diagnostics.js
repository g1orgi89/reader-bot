/**
 * Сервис для диагностики проблем пользователей
 * Предоставляет быстрые решения перед созданием тикетов
 * @file server/services/diagnostics.js
 * 🍄 ИСПРАВЛЕНО: Убрана зависимость от prompts-fixed.js
 */

const logger = require('../utils/logger');

/**
 * @typedef {Object} DiagnosticResult
 * @property {string} problemType - Тип проблемы
 * @property {string[]} questions - Диагностические вопросы
 * @property {string[]} solutions - Быстрые решения
 * @property {boolean} needsTicket - Требуется ли создание тикета
 * @property {string} response - Готовый ответ для пользователя
 */

// 🍄 ИСПРАВЛЕНО: Inline константы вместо внешнего файла prompts-fixed.js
const DIAGNOSTIC_QUESTIONS = {
  wallet_connection: {
    en: [
      "What wallet are you trying to connect (Xverse, Hiro)?",
      "Do you see any error message?",
      "Is your wallet extension enabled?",
      "Do you have STX for transaction fees?"
    ],
    ru: [
      "Какой кошелек вы пытаетесь подключить (Xverse, Hiro)?",
      "Видите ли вы сообщение об ошибке?",
      "Включено ли расширение кошелька?",
      "Есть ли у вас STX для оплаты комиссий?"
    ],
    es: [
      "¿Qué billetera intentas conectar (Xverse, Hiro)?",
      "¿Ves algún mensaje de error?",
      "¿Está habilitada la extensión de la billetera?",
      "¿Tienes STX para las tarifas de transacción?"
    ]
  },
  
  transaction_stuck: {
    en: [
      "How long has the transaction been pending?",
      "What is the transaction hash?",
      "What type of transaction were you making?",
      "Did you set custom gas fees?"
    ],
    ru: [
      "Как долго транзакция находится в ожидании?",
      "Какой хеш транзакции?",
      "Какой тип транзакции вы выполняли?",
      "Устанавливали ли вы пользовательские комиссии?"
    ],
    es: [
      "¿Cuánto tiempo lleva pendiente la transacción?",
      "¿Cuál es el hash de la transacción?",
      "¿Qué tipo de transacción estabas haciendo?",
      "¿Estableciste tarifas de gas personalizadas?"
    ]
  },
  
  tokens_missing: {
    en: [
      "What tokens are missing?",
      "When did you last see them?",
      "What was your last transaction?",
      "Are you looking at the correct wallet address?"
    ],
    ru: [
      "Какие токены пропали?",
      "Когда вы их видели в последний раз?",
      "Какая была ваша последняя транзакция?",
      "Проверяете ли вы правильный адрес кошелька?"
    ],
    es: [
      "¿Qué tokens faltan?",
      "¿Cuándo los viste por última vez?",
      "¿Cuál fue tu última transacción?",
      "¿Estás mirando la dirección de billetera correcta?"
    ]
  },
  
  staking_issues: {
    en: [
      "What error do you see when staking?",
      "How much are you trying to stake?",
      "Which staking pool are you using?",
      "Do you have enough tokens for fees?"
    ],
    ru: [
      "Какую ошибку вы видите при стейкинге?",
      "Сколько вы пытаетесь застейкать?",
      "Какой пул стейкинга используете?",
      "Достаточно ли у вас токенов для комиссий?"
    ],
    es: [
      "¿Qué error ves al hacer staking?",
      "¿Cuánto intentas apostar?",
      "¿Qué pool de staking estás usando?",
      "¿Tienes suficientes tokens para las tarifas?"
    ]
  },
  
  farming_issues: {
    en: [
      "Which farming pool has the issue?",
      "Are you able to see your deposited tokens?",
      "When did you last harvest rewards?",
      "Do you see any error messages?"
    ],
    ru: [
      "В каком пуле фарминга проблема?",
      "Видите ли вы депозитные токены?",
      "Когда вы в последний раз собирали награды?",
      "Видите ли вы сообщения об ошибках?"
    ],
    es: [
      "¿Qué pool de farming tiene el problema?",
      "¿Puedes ver tus tokens depositados?",
      "¿Cuándo cosechaste recompensas por última vez?",
      "¿Ves algún mensaje de error?"
    ]
  }
};

const QUICK_SOLUTIONS = {
  wallet_connection: {
    en: [
      "1. Refresh the page and try connecting again",
      "2. Make sure your wallet extension is unlocked",
      "3. Clear browser cache and cookies",
      "4. Try connecting in incognito mode",
      "5. Disable other wallet extensions temporarily",
      "6. Check if wallet has sufficient STX for fees"
    ],
    ru: [
      "1. Обновите страницу и попробуйте подключиться снова",
      "2. Убедитесь, что расширение кошелька разблокировано",
      "3. Очистите кеш и куки браузера",
      "4. Попробуйте подключиться в режиме инкогнито",
      "5. Временно отключите другие расширения кошельков",
      "6. Проверьте, достаточно ли STX для комиссий"
    ],
    es: [
      "1. Actualiza la página e intenta conectar de nuevo",
      "2. Asegúrate de que la extensión de la billetera esté desbloqueada",
      "3. Limpia el caché y las cookies del navegador",
      "4. Intenta conectar en modo incógnito",
      "5. Desactiva temporalmente otras extensiones de billetera",
      "6. Verifica que tengas suficiente STX para las tarifas"
    ]
  },
  
  transaction_stuck: {
    en: [
      "1. Check transaction status on Stacks Explorer",
      "2. Wait for network congestion to clear (can take 30-60 minutes)",
      "3. Do not retry the same transaction multiple times",
      "4. Check if you have enough STX for fees",
      "5. Try increasing gas fees for future transactions"
    ],
    ru: [
      "1. Проверьте статус транзакции в Stacks Explorer",
      "2. Подождите пока пройдет перегрузка сети (может занять 30-60 минут)",
      "3. Не пытайтесь повторить ту же транзакцию несколько раз",
      "4. Проверьте, достаточно ли у вас STX для комиссий",
      "5. Попробуйте увеличить комиссии для будущих транзакций"
    ],
    es: [
      "1. Verifica el estado de la transacción en Stacks Explorer",
      "2. Espera a que se despeje la congestión de la red (puede tomar 30-60 minutos)",
      "3. No reintentes la misma transacción múltiples veces",
      "4. Verifica que tengas suficiente STX para las tarifas",
      "5. Intenta aumentar las tarifas de gas para futuras transacciones"
    ]
  },
  
  tokens_missing: {
    en: [
      "1. Check if you're viewing the correct wallet address",
      "2. Look for pending transactions that might not be confirmed",
      "3. Verify transaction history on Stacks Explorer",
      "4. Make sure you didn't send tokens to wrong address",
      "5. Check if tokens are staked or in farming pools"
    ],
    ru: [
      "1. Проверьте, что смотрите на правильный адрес кошелька",
      "2. Поищите ожидающие транзакции, которые могут быть не подтверждены",
      "3. Проверьте историю транзакций в Stacks Explorer",
      "4. Убедитесь, что не отправили токены на неправильный адрес",
      "5. Проверьте, не находятся ли токены в стейкинге или фарминге"
    ],
    es: [
      "1. Verifica que estés viendo la dirección de billetera correcta",
      "2. Busca transacciones pendientes que podrían no estar confirmadas",
      "3. Verifica el historial de transacciones en Stacks Explorer",
      "4. Asegúrate de no haber enviado tokens a la dirección incorrecta",
      "5. Verifica si los tokens están en staking o en pools de farming"
    ]
  },
  
  staking_issues: {
    en: [
      "1. Make sure you have minimum required amount for staking",
      "2. Check that you have enough STX for transaction fees",
      "3. Try refreshing the page and reconnecting wallet",
      "4. Verify that the staking pool is active",
      "5. Check if there are any maintenance periods"
    ],
    ru: [
      "1. Убедитесь, что у вас есть минимальная сумма для стейкинга",
      "2. Проверьте, что у вас достаточно STX для комиссий",
      "3. Попробуйте обновить страницу и переподключить кошелек",
      "4. Убедитесь, что пул стейкинга активен",
      "5. Проверьте, нет ли периодов обслуживания"
    ],
    es: [
      "1. Asegúrate de tener la cantidad mínima requerida para staking",
      "2. Verifica que tengas suficiente STX para las tarifas de transacción",
      "3. Intenta actualizar la página y reconectar la billetera",
      "4. Verifica que el pool de staking esté activo",
      "5. Verifica si hay períodos de mantenimiento"
    ]
  },
  
  farming_issues: {
    en: [
      "1. Check if the farming pool is still active",
      "2. Verify that you have liquidity tokens in the pool",
      "3. Try harvesting rewards to see if they appear",
      "4. Refresh the page and reconnect your wallet",
      "5. Check pool statistics for any changes"
    ],
    ru: [
      "1. Проверьте, активен ли пул фарминга",
      "2. Убедитесь, что у вас есть токены ликвидности в пуле",
      "3. Попробуйте собрать награды чтобы увидеть, появятся ли они",
      "4. Обновите страницу и переподключите кошелек",
      "5. Проверьте статистику пула на предмет изменений"
    ],
    es: [
      "1. Verifica si el pool de farming sigue activo",
      "2. Verifica que tengas tokens de liquidez en el pool",
      "3. Intenta cosechar recompensas para ver si aparecen",
      "4. Actualiza la página y reconecta tu billetera",
      "5. Verifica las estadísticas del pool para cualquier cambio"
    ]
  }
};

/**
 * Класс для диагностики проблем пользователей
 */
class DiagnosticsService {
  constructor() {
    // Паттерны для определения типа проблемы
    this.problemPatterns = {
      wallet_connection: [
        /wallet.*connect/i,
        /connect.*wallet/i,
        /connection.*fail/i,
        /можс[тч]ать.*кош/i,
        /подключ.*кош/i,
        /conectar.*billetera/i,
        /cartera.*conectar/i
      ],
      
      transaction_stuck: [
        /transaction.*stuck/i,
        /tx.*pending/i,
        /транзакц.*заверш/i,
        /транзакц.*застр/i,
        /transacción.*pendiente/i,
        /transacción.*atascada/i
      ],
      
      tokens_missing: [
        /tokens.*disappear/i,
        /missing.*token/i,
        /tokens.*gone/i,
        /токен.*исчез/i,
        /токен.*пропал/i,
        /tokens.*desapareci/i,
        /perdido.*token/i
      ],
      
      staking_issues: [
        /stak.*problem/i,
        /stak.*issue/i,
        /стейк.*проблем/i,
        /стейк.*ошибк/i,
        /problema.*staking/i,
        /error.*staking/i
      ],
      
      farming_issues: [
        /farm.*not.*work/i,
        /farming.*problem/i,
        /фарм.*не.*работ/i,
        /фарм.*проблем/i,
        /farming.*problema/i,
        /problema.*farming/i
      ]
    };
    
    // Ключевые слова для создания тикета
    this.ticketKeywords = [
      // English
      'urgent', 'help', 'error', 'bug', 'problem', 'issue', 'failed', 'broken',
      // Russian  
      'срочно', 'помощь', 'ошибка', 'баг', 'проблема', 'не работает', 'сломал',
      // Spanish
      'urgente', 'ayuda', 'error', 'problema', 'bug', 'fallo', 'roto'
    ];
  }

  /**
   * Анализирует сообщение пользователя и предоставляет диагностику
   * @param {string} message - Сообщение пользователя
   * @param {string} language - Язык пользователя (en, ru, es)
   * @returns {DiagnosticResult} Результат диагностики
   */
  async diagnose(message, language = 'en') {
    try {
      const problemType = this.identifyProblemType(message);
      const needsTicket = this.shouldCreateTicket(message, problemType);
      
      if (!problemType) {
        return {
          problemType: null,
          questions: [],
          solutions: [],
          needsTicket: needsTicket,
          response: this.generateGenericResponse(language, needsTicket)
        };
      }
      
      const questions = this.getQuestions(problemType, language);
      const solutions = this.getSolutions(problemType, language);
      const response = this.generateDiagnosticResponse(
        problemType, 
        questions, 
        solutions, 
        language, 
        needsTicket
      );
      
      logger.info(`Diagnosed problem: ${problemType}, needsTicket: ${needsTicket}`);
      
      return {
        problemType,
        questions,
        solutions,
        needsTicket,
        response
      };
    } catch (error) {
      logger.error(`Diagnostics error: ${error.message}`);
      return {
        problemType: null,
        questions: [],
        solutions: [],
        needsTicket: true,
        response: this.generateErrorResponse(language)
      };
    }
  }

  /**
   * Определяет тип проблемы на основе сообщения
   * @param {string} message - Сообщение пользователя
   * @returns {string|null} Тип проблемы или null
   */
  identifyProblemType(message) {
    for (const [problemType, patterns] of Object.entries(this.problemPatterns)) {
      if (patterns.some(pattern => pattern.test(message))) {
        return problemType;
      }
    }
    return null;
  }

  /**
   * Определяет, нужно ли создавать тикет
   * @param {string} message - Сообщение пользователя  
   * @param {string|null} problemType - Тип проблемы
   * @returns {boolean} Нужно ли создавать тикет
   */
  shouldCreateTicket(message, problemType) {
    // Всегда создаем тикет для определенных типов проблем
    const alwaysTicketTypes = ['tokens_missing', 'transaction_stuck'];
    if (alwaysTicketTypes.includes(problemType)) {
      return true;
    }
    
    // Проверяем наличие ключевых слов
    const hasTicketKeywords = this.ticketKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Проверяем упоминание времени (часы, дни)
    const hasTimeReference = /(\d+\s*(hour|hours|час|часа|часов|hora|horas|day|days|день|дня|дней|día|días))/i.test(message);
    
    return hasTicketKeywords || hasTimeReference || problemType !== null;
  }

  /**
   * Получает диагностические вопросы для типа проблемы
   * @param {string} problemType - Тип проблемы
   * @param {string} language - Язык
   * @returns {string[]} Список вопросов
   */
  getQuestions(problemType, language) {
    return DIAGNOSTIC_QUESTIONS[problemType]?.[language] || [];
  }

  /**
   * Получает быстрые решения для типа проблемы
   * @param {string} problemType - Тип проблемы  
   * @param {string} language - Язык
   * @returns {string[]} Список решений
   */
  getSolutions(problemType, language) {
    return QUICK_SOLUTIONS[problemType]?.[language] || [];
  }

  /**
   * Генерирует ответ с диагностикой
   * @param {string} problemType - Тип проблемы
   * @param {string[]} questions - Диагностические вопросы
   * @param {string[]} solutions - Быстрые решения
   * @param {string} language - Язык
   * @param {boolean} needsTicket - Нужно ли создавать тикет
   * @returns {string} Сформированный ответ
   */
  generateDiagnosticResponse(problemType, questions, solutions, language, needsTicket) {
    const templates = {
      en: {
        greeting: "🍄 I see you're having some trouble in our mycelial network! Let me help identify the issue.",
        solutions_intro: "Here are some quick solutions you can try:",
        questions_intro: "To better diagnose the problem, please tell me:",
        ticket_will_create: "I'll create a support ticket for our mushroom experts to investigate further.",
        ticket_not_needed: "Try these solutions first, and if the problem persists, I can create a support ticket for you."
      },
      ru: {
        greeting: "🍄 Вижу, что у вас возникли трудности в нашей грибной сети! Давайте разберемся с проблемой.",
        solutions_intro: "Вот несколько быстрых решений, которые можно попробовать:",
        questions_intro: "Для более точной диагностики расскажите мне:",
        ticket_will_create: "Я создам тикет поддержки для наших грибных экспертов для дальнейшего расследования.",
        ticket_not_needed: "Сначала попробуйте эти решения, и если проблема сохранится, я могу создать тикет поддержки."
      },
      es: {
        greeting: "🍄 ¡Veo que tienes problemas en nuestra red micelial! Déjame ayudarte a identificar el problema.",
        solutions_intro: "Aquí tienes algunas soluciones rápidas que puedes probar:",
        questions_intro: "Para diagnosticar mejor el problema, dime:",
        ticket_will_create: "Crearé un ticket de soporte para que nuestros expertos hongos investiguen más a fondo.",
        ticket_not_needed: "Prueba estas soluciones primero, y si el problema persiste, puedo crear un ticket de soporte para ti."
      }
    };

    const t = templates[language] || templates.en;
    let response = t.greeting + '\n\n';

    // Добавляем решения
    if (solutions.length > 0) {
      response += t.solutions_intro + '\n';
      solutions.forEach((solution, index) => {
        response += `${index + 1}. ${solution}\n`;
      });
      response += '\n';
    }

    // Добавляем вопросы для диагностики
    if (questions.length > 0 && !needsTicket) {
      response += t.questions_intro + '\n';
      questions.forEach((question, index) => {
        response += `• ${question}\n`;
      });
      response += '\n';
    }

    // Информация о тикете
    if (needsTicket) {
      response += t.ticket_will_create;
    } else {
      response += t.ticket_not_needed;
    }

    return response;
  }

  /**
   * Генерирует общий ответ когда тип проблемы не определен
   * @param {string} language - Язык
   * @param {boolean} needsTicket - Нужно ли создавать тикет
   * @returns {string} Ответ
   */
  generateGenericResponse(language, needsTicket) {
    const templates = {
      en: needsTicket ? 
        "🍄 I understand you're experiencing an issue. Let me create a support ticket for our mushroom experts to help you properly." :
        "🍄 Hi there! I'm Sporus, your friendly mushroom assistant. How can I help you today?",
      ru: needsTicket ?
        "🍄 Понимаю, что у вас возникла проблема. Давайте создам тикет поддержки, чтобы наши грибные эксперты смогли помочь вам должным образом." :
        "🍄 Привет! Я Sporus, ваш дружелюбный грибной помощник. Чем могу помочь?",
      es: needsTicket ?
        "🍄 Entiendo que tienes un problema. Permíteme crear un ticket de soporte para que nuestros expertos hongos te ayuden adecuadamente." :
        "🍄 ¡Hola! Soy Sporus, tu amistoso asistente hongo. ¿Cómo puedo ayudarte hoy?"
    };

    return templates[language] || templates.en;
  }

  /**
   * Генерирует ответ при ошибке диагностики
   * @param {string} language - Язык
   * @returns {string} Ответ
   */
  generateErrorResponse(language) {
    const templates = {
      en: "🍄 I'm having trouble analyzing your message right now. Let me create a support ticket for our experts to assist you.",
      ru: "🍄 У меня возникли трудности с анализом вашего сообщения. Давайте создам тикет поддержки для наших экспертов.",
      es: "🍄 Tengo problemas para analizar tu mensaje ahora. Permíteme crear un ticket de soporte para que nuestros expertos te ayuden."
    };

    return templates[language] || templates.en;
  }

  /**
   * Проверяет, является ли проблема критической
   * @param {string} problemType - Тип проблемы
   * @param {string} message - Сообщение пользователя
   * @returns {boolean} Является ли проблема критической
   */
  isCriticalProblem(problemType, message) {
    const criticalPatterns = [
      /urgent/i,
      /critical/i,
      /срочно/i,
      /критично/i,
      /urgente/i,
      /crítico/i,
      /lost.*money/i,
      /потерял.*деньги/i,
      /perdí.*dinero/i
    ];

    return criticalPatterns.some(pattern => pattern.test(message)) ||
           ['tokens_missing', 'transaction_stuck'].includes(problemType);
  }
}

module.exports = new DiagnosticsService();