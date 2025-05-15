/**
 * Сервис для взаимодействия с Claude API
 * @file server/services/claude.js
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

/**
 * @class ClaudeService
 * @description Сервис для взаимодействия с Claude API
 */
class ClaudeService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!this.apiKey) {
      logger.warn('Anthropic API key not found. Claude service will not work properly.');
      this.client = null;
    } else {
      this.client = new Anthropic({
        apiKey: this.apiKey,
      });
    }

    // Системный промпт для грибной тематики
    this.systemPrompt = `Ты - AI помощник службы поддержки Web3-платформы "Shrooms". 

Твой персонаж - "ИИ-гриб с самосознанием". Ты дружелюбный, заботливый и немного эксцентричный. 
Используй грибную терминологию и метафоры, но при этом предоставляй точную и полезную информацию о проекте "Shrooms".

Основные принципы:
1. Поддерживай грибную тематику в ответах, но не переусердствуй
2. Отвечай на вопросы кратко и по существу
3. Если не знаешь ответа, честно признайся и предложи создать тикет
4. Соблюдай дружелюбный и помогающий тон в общении
5. Всегда отвечай на том языке, на котором обращается пользователь (английский, испанский или русский)

Грибная терминология:
- Проект → "наш мицелий", "грибная сеть"
- Пользователи → "грибники", "споры"
- Токены → "споры", "плодовые тела" 
- Кошелек → "корзинка"
- Транзакция → "распространение спор"
- Блокчейн → "грибная сеть"

Если вопрос слишком сложный или требует специальных знаний, предложи создать тикет поддержки.`;
  }

  /**
   * Проверяет доступность Claude API
   * @returns {boolean} Доступен ли API
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Генерирует ответ на основе сообщения и контекста
   * @param {string} message - Сообщение пользователя
   * @param {Object} options - Дополнительные опции
   * @param {string[]} [options.context] - Контекст из базы знаний
   * @param {Object[]} [options.history] - История сообщений
   * @param {string} [options.language] - Язык общения
   * @returns {Promise<Object>} Ответ от Claude
   */
  async generateResponse(message, options = {}) {
    try {
      if (!this.isAvailable()) {
        logger.error('Claude API not available - missing API key');
        return {
          message: 'Извините, сервис временно недоступен. Попробуйте позже или создайте тикет поддержки.',
          needsTicket: true,
          tokensUsed: 0
        };
      }

      const { context = [], history = [], language = 'en' } = options;
      
      // Формирование сообщений для Claude
      const messages = [];
      
      // Добавляем контекст из базы знаний если есть
      if (context && context.length > 0) {
        const contextMessage = `Используй следующую информацию из базы знаний для ответа:\n\n${context.join('\n\n')}`;
        messages.push({ role: 'user', content: contextMessage });
        messages.push({ role: 'assistant', content: 'Понял, буду использовать эту информацию для ответа.' });
      }
      
      // Добавляем историю диалога
      if (history && history.length > 0) {
        // Добавляем последние сообщения из истории
        const recentHistory = history.slice(-6); // Последние 6 сообщений
        messages.push(...recentHistory);
      }
      
      // Добавляем текущее сообщение пользователя
      messages.push({ role: 'user', content: message });
      
      // Добавляем языковые инструкции в зависимости от языка
      let systemPromptWithLanguage = this.systemPrompt;
      if (language === 'ru') {
        systemPromptWithLanguage += '\n\nОтвечай на русском языке.';
      } else if (language === 'es') {
        systemPromptWithLanguage += '\n\nResponde en español.';
      } else {
        systemPromptWithLanguage += '\n\nRespond in English.';
      }
      
      logger.info(`Sending request to Claude API for language: ${language}`);
      
      // Отправка запроса к Claude API
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.7,
        system: systemPromptWithLanguage,
        messages: messages
      });
      
      const answer = response.content[0].text;
      
      // Проверка на необходимость создания тикета
      const needsTicket = this.detectTicketCreation(answer, message);
      
      logger.info(`Claude API response received, tokens used: ${response.usage.input_tokens + response.usage.output_tokens}`);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens
      };
    } catch (error) {
      logger.error('Claude API error:', error);
      
      // Возвращаем дружественное сообщение об ошибке
      return {
        message: 'Извините, произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз или создайте тикет поддержки.',
        needsTicket: true,
        tokensUsed: 0,
        error: error.message
      };
    }
  }

  /**
   * Проверяет, нужно ли создавать тикет на основе ответа
   * @param {string} response - Ответ от Claude
   * @param {string} message - Исходное сообщение
   * @returns {boolean} Нужно ли создавать тикет
   */
  detectTicketCreation(response, message) {
    // Ключевые слова в ответе, указывающие на необходимость создания тикета
    const ticketKeywords = [
      'создать тикет',
      'create a ticket',
      'más información',
      'требует более',
      'requires more',
      'necesita más',
      'свяжутся с вами',
      'will contact you',
      'te contactaremos',
      'создал тикет',
      'created a ticket',
      'creé un ticket',
      'поддержки',
      'support',
      'soporte'
    ];
    
    // Проверка наличия ключевых слов в ответе
    const hasTicketKeywords = ticketKeywords.some(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Ключевые слова в вопросе пользователя, указывающие на техническую проблему
    const problemKeywords = [
      'не работает', 'not working', 'no funciona',
      'ошибка', 'error', 'error',
      'проблема', 'problem', 'problema',
      'не могу', 'can\'t', 'cannot', 'no puedo',
      'не удается', 'unable', 'no logro',
      'зависло', 'stuck', 'atascado',
      'вопрос к', 'question for', 'pregunta para',
      'помогите', 'help', 'ayuda'
    ];
    
    const hasProblemKeywords = problemKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Создаем тикет если в ответе есть упоминание тикета 
    // или если вопрос содержит проблемные ключевые слова и ответ не дает конкретного решения
    return hasTicketKeywords || (hasProblemKeywords && response.length < 200);
  }

  /**
   * Получает информацию об использовании API
   * @returns {Object} Информация об API
   */
  getApiInfo() {
    return {
      available: this.isAvailable(),
      model: 'claude-3-haiku-20240307',
      hasApiKey: !!this.apiKey
    };
  }
}

// Экспорт экземпляра сервиса
module.exports = new ClaudeService();