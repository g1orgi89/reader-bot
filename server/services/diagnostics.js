/**
 * Сервис для диагностики проблем пользователей
 * Предоставляет быстрые решения перед созданием тикетов
 * @file server/services/diagnostics.js
 */

const { DIAGNOSTIC_QUESTIONS, QUICK_SOLUTIONS } = require('../config/prompts-fixed');
const logger = require('../utils/logger');

/**
 * @typedef {Object} DiagnosticResult
 * @property {string} problemType - Тип проблемы
 * @property {string[]} questions - Диагностические вопросы
 * @property {string[]} solutions - Быстрые решения
 * @property {boolean} needsTicket - Требуется ли создание тикета
 * @property {string} response - Готовый ответ для пользователя
 */

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
