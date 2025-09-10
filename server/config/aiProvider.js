/**
 * @file Configuration for AI Provider
 * @description Конфигурация AI провайдеров для Reader Bot
 */

/**
 * @typedef {Object} AIProviderConfig
 * @property {'claude'|'openai'} provider - Выбранный AI провайдер
 * @property {Object} claude - Конфигурация Claude
 * @property {Object} openai - Конфигурация OpenAI
 */

/**
 * Получение конфигурации для выбранного AI провайдера
 * @returns {AIProviderConfig}
 */
function getAIProviderConfig() {
  const provider = process.env.AI_PROVIDER || 'claude'; // По умолчанию используем Claude
  
  return {
    provider,
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
      temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7
    }
  };
}

/**
 * Получение конфигурации для embeddings (всегда OpenAI)
 * @returns {Object}
 */
function getEmbeddingProviderConfig() {
  return {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002'
  };
}

module.exports = {
  getAIProviderConfig,
  getEmbeddingProviderConfig
};
