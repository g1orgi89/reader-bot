/**
 * Сервис для работы с AI моделями и RAG
 * @file server/services/aiService.js
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const { getConfig } = require('../config');
const tokenCounter = require('../utils/tokenCounter');
const vectorStoreService = require('./vectorStore');
const { 
  getSystemPrompt, 
  createContextPrompt, 
  getLocalizedPrompt 
} = require('../config/prompts');

/**
 * @typedef {Object} AIResponse
 * @property {string} message - Ответ от AI
 * @property {boolean} needsTicket - Нужно ли создавать тикет
 * @property {number} tokensUsed - Количество использованных токенов
 */

/**
 * @typedef {Object} AIOptions
 * @property {string[]} [context] - Контекст из базы знаний
 * @property {Object[]} [history] - История сообщений
 * @property {string} [language] - Язык общения
 */

/**
 * @class AIService
 * @description Сервис для взаимодействия с AI моделями и RAG
 */
class AIService {
  constructor() {
    const claudeConfig = getConfig('claude');
    
    this.client = new Anthropic({
      apiKey: claudeConfig.apiKey,
    });
    
    this.model = claudeConfig.model;
    this.maxTokens = claude