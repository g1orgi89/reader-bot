/**
 * Token counter utility for Anthropic API
 * @file server/utils/tokenCounter.js
 */

/**
 * Counts tokens in messages for Anthropic API
 * Uses a simple approximation since Anthropic doesn't provide a tokenizer library
 */
class TokenCounter {
  /**
   * Approximate token count for English text
   * @param {string} text - Text to count tokens for
   * @returns {number} Approximate token count
   */
  countTokensInText(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // Anthropic models use a similar tokenization to OpenAI
    // Rough approximation: 4 characters per token for English
    // For other languages, the ratio might be different
    
    // Count words as a baseline
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    
    // Count special characters and punctuation
    const specialChars = (text.match(/[.,!?;:'"()\[\]{}\-_]/g) || []).length;
    
    // Each word is roughly 1.3 tokens, special chars are 0.5 tokens
    const approximateTokens = Math.ceil(words.length * 1.3 + specialChars * 0.5);
    
    return Math.max(1, approximateTokens);
  }

  /**
   * Count tokens in an array of messages
   * @param {import('../types').Message[]} messages - Array of messages
   * @returns {number} Total token count
   */
  countTokensInMessages(messages) {
    if (!Array.isArray(messages)) {
      return 0;
    }

    let totalTokens = 0;
    
    messages.forEach(message => {
      // Add tokens for role
      totalTokens += 2; // Role identifier costs ~2 tokens
      
      // Add tokens for content
      if (message.content) {
        totalTokens += this.countTokensInText(message.content);
      }
      
      // Add overhead for message structure
      totalTokens += 3; // Message structure overhead
    });
    
    return totalTokens;
  }

  /**
   * Count tokens for a complete conversation including system prompt
   * @param {string} systemPrompt - System prompt
   * @param {import('../types').Message[]} messages - Conversation messages
   * @param {string[]} [context] - Additional context from knowledge base
   * @returns {number} Total token count
   */
  countTotalTokens(systemPrompt, messages = [], context = []) {
    let totalTokens = 0;
    
    // System prompt tokens
    if (systemPrompt) {
      totalTokens += this.countTokensInText(systemPrompt);
      totalTokens += 2; // Role overhead for system message
    }
    
    // Context tokens (if using RAG)
    if (context && context.length > 0) {
      const contextText = context.join('\n\n');
      totalTokens += this.countTokensInText(contextText);
      totalTokens += 3; // Additional overhead for context injection
    }
    
    // Message tokens
    totalTokens += this.countTokensInMessages(messages);
    
    // Add buffer for response generation (estimated)
    totalTokens += 1000; // Reserve tokens for response
    
    return totalTokens;
  }

  /**
   * Check if token count is within limits
   * @param {number} tokenCount - Current token count
   * @param {number} [maxTokens] - Maximum allowed tokens (default: 100000)
   * @returns {boolean} Whether token count is within limits
   */
  isWithinLimit(tokenCount, maxTokens = 100000) {
    return tokenCount <= maxTokens;
  }

  /**
   * Truncate messages to fit within token limit
   * @param {import('../types').Message[]} messages - Messages to truncate
   * @param {number} maxTokens - Maximum token limit
   * @param {boolean} [preserveSystemMessages] - Whether to preserve system messages
   * @returns {import('../types').Message[]} Truncated messages
   */
  truncateMessages(messages, maxTokens, preserveSystemMessages = true) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    const result = [];
    let currentTokens = 0;
    
    // If preserving system messages, add them first
    if (preserveSystemMessages) {
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (message.role === 'system') {
          const messageTokens = this.countTokensInMessages([message]);
          if (currentTokens + messageTokens <= maxTokens) {
            result.push(message);
            currentTokens += messageTokens;
          }
        }
      }
    }
    
    // Add other messages from the end (most recent first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      
      // Skip system messages if we already processed them
      if (preserveSystemMessages && message.role === 'system') {
        continue;
      }
      
      const messageTokens = this.countTokensInMessages([message]);
      
      if (currentTokens + messageTokens <= maxTokens) {
        result.unshift(message);
        currentTokens += messageTokens;
      } else {
        break;
      }
    }
    
    return result;
  }

  /**
   * Get token usage statistics for a response
   * @param {number} inputTokens - Input tokens used
   * @param {number} outputTokens - Output tokens used
   * @returns {import('../types').TokenUsage} Token usage statistics
   */
  getTokenUsage(inputTokens, outputTokens) {
    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };
  }

  /**
   * Estimate cost for token usage (approximate)
   * @param {import('../types').TokenUsage} tokenUsage - Token usage statistics
   * @param {string} [model] - Model name ('claude-3-haiku', 'claude-3-sonnet', etc.)
   * @returns {number} Estimated cost in USD
   */
  estimateCost(tokenUsage, model = 'claude-3-haiku') {
    // Pricing as of 2024 (approximate)
    const pricing = {
      'claude-3-haiku': {
        input: 0.00025 / 1000,  // $0.25 per 1M input tokens
        output: 0.00125 / 1000  // $1.25 per 1M output tokens
      },
      'claude-3-sonnet': {
        input: 0.003 / 1000,    // $3 per 1M input tokens
        output: 0.015 / 1000    // $15 per 1M output tokens
      },
      'claude-3-opus': {
        input: 0.015 / 1000,    // $15 per 1M input tokens
        output: 0.075 / 1000    // $75 per 1M output tokens
      }
    };
    
    const modelPricing = pricing[model] || pricing['claude-3-haiku'];
    
    const inputCost = tokenUsage.inputTokens * modelPricing.input;
    const outputCost = tokenUsage.outputTokens * modelPricing.output;
    
    return Number((inputCost + outputCost).toFixed(6));
  }
}

// Export singleton instance
module.exports = new TokenCounter();
