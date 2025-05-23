/**
 * Минимальные fallback промпты для Shrooms AI Support Bot
 * @file server/config/prompts.js
 * 🍄 ОБНОВЛЕНО: Очищен от сложных промптов, теперь только fallback система
 * 
 * ⚠️ ВАЖНО: Основные промпты теперь управляются через админ-панель и хранятся в MongoDB!
 * Этот файл содержит только минимальные fallback промпты на случай недоступности БД.
 * 
 * МИГРАЦИЯ ЗАВЕРШЕНА: Промпты переведены на управление через PromptService
 */

const { 
  FALLBACK_PROMPTS, 
  RAG_FALLBACK_PROMPTS, 
  TICKET_DETECTION_FALLBACK,
  CATEGORIZATION_FALLBACK,
  SUBJECT_FALLBACK 
} = require('./fallbackPrompts');

/**
 * 🍄 УСТАРЕВШИЕ ФУНКЦИИ: Сохранены для обратной совместимости
 * В новом коде используйте PromptService напрямую!
 */

/**
 * @deprecated Используйте promptService.getActivePrompt() вместо этой функции
 * Получить системный промпт (LEGACY FALLBACK)
 * @param {string} type - Тип промпта
 * @param {string} [language='en'] - Язык промпта
 * @returns {string} Fallback промпт
 */
function getSystemPrompt(type, language = 'en') {
  console.warn('🍄 DEPRECATED: getSystemPrompt() - используйте promptService.getActivePrompt()');
  
  const normalizedLanguage = ['en', 'es', 'ru'].includes(language) ? language : 'en';
  
  switch (type) {
    case 'rag':
      return `${FALLBACK_PROMPTS[normalizedLanguage]}\n\n${RAG_FALLBACK_PROMPTS[normalizedLanguage]}`;
    case 'ticket':
      return TICKET_DETECTION_FALLBACK;
    case 'categorization':
      return CATEGORIZATION_FALLBACK;
    case 'subject':
      return SUBJECT_FALLBACK;
    case 'basic':
    default:
      return FALLBACK_PROMPTS[normalizedLanguage];
  }
}

/**
 * @deprecated Используйте promptService.getActivePrompt() вместо этой функции
 * Создать контекстный промпт для RAG (LEGACY FALLBACK)
 * @param {string[]} context - Контекст из базы знаний
 * @param {string} userMessage - Сообщение пользователя
 * @param {string} language - Язык пользователя
 * @returns {string} Контекстный промпт
 */
function createContextPrompt(context, userMessage, language = 'en') {
  console.warn('🍄 DEPRECATED: createContextPrompt() - используйте promptService.getActivePrompt("rag")');
  
  if (!context || context.length === 0) {
    return getSystemPrompt('basic', language);
  }

  const normalizedLanguage = ['en', 'es', 'ru'].includes(language) ? language : 'en';
  
  const contextHeaders = {
    en: '### Relevant information from knowledge base:',
    es: '### Información relevante de la base de conocimientos:',
    ru: '### Релевантная информация из базы знаний:'
  };
  
  const sourceHeaders = {
    en: 'Source',
    es: 'Fuente', 
    ru: 'Источник'
  };
  
  const useOnlyHeaders = {
    en: '### USE ONLY the above information to answer the user\'s question.\nIf information is insufficient, suggest creating a support ticket.\n\n### User\'s question:',
    es: '### USA SOLO la información anterior para responder la pregunta del usuario.\nSi la información es insuficiente, sugiere crear un ticket de soporte.\n\n### Pregunta del usuario:',
    ru: '### ИСПОЛЬЗУЙ ТОЛЬКО приведенную выше информацию для ответа на вопрос пользователя.\nЕсли информации недостаточно, предложи создать тикет поддержки.\n\n### Вопрос пользователя:'
  };

  const contextSection = `${contextHeaders[normalizedLanguage]}\n\n${context.map((item, index) => `**${sourceHeaders[normalizedLanguage]} ${index + 1}:**\n${item}`).join('\n\n')}\n\n${useOnlyHeaders[normalizedLanguage]}\n${userMessage}`;

  return `${getSystemPrompt('rag', normalizedLanguage)}\n\n${contextSection}`;
}

/**
 * @deprecated Функция больше не используется в новой архитектуре
 * Получить локализованный промпт (LEGACY FALLBACK)
 * @param {string} key - Ключ промпта
 * @param {string} language - Язык
 * @returns {string} Простое сообщение
 */
function getLocalizedPrompt(key, language = 'en') {
  console.warn('🍄 DEPRECATED: getLocalizedPrompt() - локализованные промпты теперь в PromptService');
  
  // Простые fallback сообщения
  const fallbackMessages = {
    en: {
      greeting: "Hello! I'm Sporus, your AI assistant for Shrooms. How can I help you?",
      error: "I'm experiencing technical difficulties. Please try again.",
      outOfScope: "I can only help with questions about the Shrooms project."
    },
    ru: {
      greeting: "Привет! Я Sporus, твой ИИ-помощник для Shrooms. Как могу помочь?",
      error: "У меня технические проблемы. Попробуйте еще раз.",
      outOfScope: "Я могу помочь только с вопросами о проекте Shrooms."
    },
    es: {
      greeting: "¡Hola! Soy Sporus, tu asistente IA para Shrooms. ¿Cómo puedo ayudarte?",
      error: "Estoy experimentando dificultades técnicas. Inténtalo de nuevo.",
      outOfScope: "Solo puedo ayudar con preguntas sobre el proyecto Shrooms."
    }
  };
  
  const normalizedLanguage = ['en', 'es', 'ru'].includes(language) ? language : 'en';
  return fallbackMessages[normalizedLanguage]?.[key] || fallbackMessages.en[key] || "I can help you with Shrooms project questions.";
}

/**
 * Заменить плейсхолдеры в промпте (LEGACY FUNCTION)
 * @param {string} prompt - Промпт с плейсхолдерами
 * @param {Object} replacements - Объект с заменами
 * @returns {string} Промпт с заменеными значениями
 */
function replacePromptPlaceholders(prompt, replacements = {}) {
  let result = prompt;
  
  Object.entries(replacements).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(placeholder, value);
  });
  
  if (replacements.ticketId) {
    result = result.replace(/TICKET_ID/g, replacements.ticketId);
  }
  
  return result;
}

/**
 * Валидация промптов (LEGACY FUNCTION)
 * @param {string} prompt - Промпт для валидации
 * @returns {boolean} Валиден ли промпт
 */
function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }
  
  if (prompt.length > 100000) {
    return false;
  }
  
  return true;
}

/**
 * 🍄 ЭКСПОРТ: Минимальный набор для обратной совместимости
 * 
 * ⚠️ НОВЫЙ КОД ДОЛЖЕН ИСПОЛЬЗОВАТЬ:
 * const promptService = require('../services/promptService');
 * const prompt = await promptService.getActivePrompt('basic', 'en');
 */
module.exports = {
  // Экспортируем fallback промпты для совместимости
  FALLBACK_PROMPTS,
  RAG_FALLBACK_PROMPTS,
  TICKET_DETECTION_FALLBACK,
  CATEGORIZATION_FALLBACK,
  SUBJECT_FALLBACK,
  
  // DEPRECATED функции для обратной совместимости
  getSystemPrompt,
  createContextPrompt,
  getLocalizedPrompt,
  replacePromptPlaceholders,
  validatePrompt,
  
  // Константы для старого кода (DEPRECATED)
  BASIC_SYSTEM_PROMPTS: FALLBACK_PROMPTS,
  RAG_SYSTEM_PROMPTS: RAG_FALLBACK_PROMPTS,
  TICKET_DETECTION_PROMPT: TICKET_DETECTION_FALLBACK,
  TICKET_CATEGORIZATION_PROMPT: CATEGORIZATION_FALLBACK,
  TICKET_SUBJECT_PROMPT: SUBJECT_FALLBACK,
  LANGUAGE_SPECIFIC_PROMPTS: {
    en: { greeting: "Hello! I'm Sporus, your AI assistant for Shrooms." },
    ru: { greeting: "Привет! Я Sporus, твой ИИ-помощник для Shrooms." },
    es: { greeting: "¡Hola! Soy Sporus, tu asistente IA para Shrooms." }
  }
};
