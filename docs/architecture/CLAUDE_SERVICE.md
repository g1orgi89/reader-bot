# Claude Service Documentation

## Overview

The Claude Service is a fully typed service for integrating with Anthropic's Claude API in the Shrooms Support Bot. It provides automatic language detection, RAG (Retrieval Augmented Generation) support, and intelligent ticket creation.

## Features

- **Full TypeScript-style typing with JSDoc**
- **Multi-language support** (English, Spanish, Russian)
- **Automatic language detection**
- **RAG integration** for knowledge base queries
- **Intelligent ticket detection**
- **Token counting and optimization**
- **Conversation history management**
- **Graceful error handling**
- **Performance monitoring**

## Architecture

```
claude.js
├── ClaudeService (main class)
├── Token Management
├── Language Detection
├── RAG Support
├── Ticket Detection
└── Error Handling
```

## Key Components

### 1. ClaudeService Class

Main service class that handles all Claude API interactions.

```javascript
/**
 * @typedef {Object} ClaudeGenerateOptions
 * @property {string[]} [context] - Context from knowledge base
 * @property {Message[]} [history] - Conversation history
 * @property {string} [language] - Language for response (en, es, ru)
 * @property {number} [maxTokens] - Maximum tokens for response
 * @property {number} [temperature] - Temperature for response generation
 */

const claude = new ClaudeService({
  apiKey: 'your-api-key',
  model: 'claude-3-haiku-20240307',
  enableRAG: true
});
```

### 2. Response Generation

Generate responses with full context awareness:

```javascript
const response = await claude.generateResponse('How do I connect my wallet?', {
  context: ['Wallet connection guide...'],
  history: conversationHistory,
  language: 'en'
});

// Response type: ClaudeResponse
// {
//   message: string,
//   needsTicket: boolean,
//   tokensUsed: number,
//   language: string,
//   usage: TokenUsage
// }
```

### 3. Language Detection

Automatic detection of user language:

```javascript
// Auto-detects language from message content
const language = languageDetector.detectLanguage('Привет, как дела?');
// Returns: 'ru'

// Multi-source language detection
const bestLanguage = languageDetector.getBestLanguageGuess({
  text: message,
  browserLang: 'es-ES',
  userPreference: 'ru'
});
```

### 4. Token Management

Intelligent token counting and optimization:

```javascript
// Count tokens
const tokens = tokenCounter.countTotalTokens(
  systemPrompt,
  conversationHistory,
  ragContext
);

// Check limits
if (!tokenCounter.isWithinLimit(tokens)) {
  // Auto-truncate history
  const truncated = tokenCounter.truncateMessages(history, 80000);
}

// Get usage statistics
const usage = tokenCounter.getTokenUsage(inputTokens, outputTokens);
const cost = tokenCounter.estimateCost(usage, 'claude-3-haiku');
```

### 5. RAG Integration

Seamless integration with knowledge base:

```javascript
// With context from knowledge base
const response = await claude.generateResponse(question, {
  context: [
    'Document 1 content...',
    'Document 2 content...'
  ],
  history: conversationHistory
});

// Claude automatically:
// 1. Uses RAG system prompt
// 2. Includes context in conversation
// 3. Maintains mushroom personality
// 4. Cites sources appropriately
```

### 6. Ticket Detection

Automatic ticket creation detection:

```javascript
// Multi-level ticket detection:
// 1. AI-powered analysis using Claude
// 2. Keyword-based fallback
// 3. Context-aware decision making

const response = await claude.generateResponse(userMessage);

if (response.needsTicket) {
  console.log('Creating ticket:', response.ticketReason);
  // Create ticket in ticketing system
}
```

## Configuration

### Environment Variables

```env
# Claude Configuration
ANTHROPIC_API_KEY=your_api_key_here
CLAUDE_MODEL=claude-3-haiku-20240307
CLAUDE_MAX_TOKENS=1000
CLAUDE_TEMPERATURE=0.7

# Feature Flags
ENABLE_RAG=true
ENABLE_ANALYTICS=true
```

### System Prompts

The service uses three main system prompts:

1. **Basic Prompt**: Standard mushroom-themed AI assistant
2. **RAG Prompt**: For knowledge base queries with context
3. **Ticket Detection Prompt**: For analyzing whether tickets should be created

All prompts maintain the grubny personality while adapting to different use cases.

## Error Handling

Comprehensive error handling with graceful fallbacks:

```javascript
// Auto-retry logic
// Graceful degradation
// User-friendly error messages in detected language
// Automatic ticket creation for API errors

try {
  const response = await claude.generateResponse(message);
} catch (error) {
  // Service automatically handles:
  // - Rate limiting (429)
  // - API errors (5xx)
  // - Invalid requests (4xx)
  // Returns appropriate error message in user's language
}
```

## Performance Optimizations

### Token Optimization

- Automatic history truncation
- Smart context compression
- Token estimation before API calls
- Model-specific optimizations

### Caching

```javascript
// Conversation state caching
// Response caching for common queries
// Token count caching
// Performance metrics tracking
```

### Batching

```javascript
// Automatic batching of ticket detection
// Conversation history compression
// Context deduplication
```

## Testing

### Unit Tests

```javascript
// Token counter tests
describe('TokenCounter', () => {
  it('should count tokens accurately', () => {
    const tokens = tokenCounter.countTokensInText('Hello world');
    expect(tokens).toBeGreaterThan(0);
  });
});

// Language detection tests
describe('LanguageDetector', () => {
  it('should detect Russian correctly', () => {
    const lang = languageDetector.detectLanguage('Привет');
    expect(lang).toBe('ru');
  });
});
```

### Integration Tests

```javascript
// Full conversation flow tests
// RAG integration tests
// Ticket creation tests
// Multi-language tests
```

## Monitoring

### Metrics Tracked

- Token usage per conversation
- Response times
- Language detection accuracy
- Ticket creation rates
- Error rates by type

### Logging

```javascript
// Detailed Claude interaction logs
logger.logClaudeInteraction(request, response, { duration });

// Performance metrics
logger.logPerformance({
  method: 'generateResponse',
  duration: 1500,
  tokensUsed: 1024
});
```

## Usage Examples

### Basic Conversation

```javascript
const claude = new ClaudeService(config);

// Generate greeting
const greeting = await claude.generateGreeting('en');

// Handle user message
const response = await claude.generateResponse('How do I stake SHROOMS?', {
  language: 'en',
  history: []
});

console.log(response.message);
// "Welcome to our mushroom kingdom! To stake your SHROOMS tokens..."
```

### With Knowledge Base

```javascript
// Search knowledge base first
const context = await knowledgeService.search('staking SHROOMS');

// Generate response with context
const response = await claude.generateResponse(question, {
  context: context.map(doc => doc.content),
  history: conversationHistory,
  language: 'en'
});
```

### Multi-language Support

```javascript
// Automatic language detection
const response = await claude.generateResponse('¿Cómo conectar mi billetera?');
// Responds in Spanish with mushroom-themed personality

// Explicit language setting
const response = await claude.generateResponse('Hello', {
  language: 'ru'
});
// Forces response in Russian
```

## Best Practices

### 1. Token Management

```javascript
// Always check token limits
const estimated = claude.estimateTokenUsage(message, history);
if (estimated > 90000) {
  // Truncate or summarize history
}
```

### 2. Error Handling

```javascript
// Always handle potential errors
try {
  const response = await claude.generateResponse(message);
  return response;
} catch (error) {
  logger.error('Claude error', error);
  return fallbackResponse(message);
}
```

### 3. Language Support

```javascript
// Use comprehensive language detection
const language = languageDetector.getBestLanguageGuess({
  text: message,
  browserLang: req.headers['accept-language'],
  userPreference: user.preferredLanguage
});
```

### 4. Context Management

```javascript
// Optimize context inclusion
const relevantContext = context
  .slice(0, 3)  // Limit context items
  .map(doc => doc.content.substring(0, 1000));  // Truncate long docs
```

## Troubleshooting

### Common Issues

1. **High Token Usage**
   - Enable automatic history truncation
   - Limit RAG context size
   - Monitor token counting accuracy

2. **Slow Response Times**
   - Use faster models for simpler tasks
   - Implement response caching
   - Optimize prompt length

3. **Language Detection Errors**
   - Update language patterns
   - Add more keywords
   - Implement user feedback loop

### Debug Mode

```javascript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Detailed token counting
logger.debug('Token breakdown', {
  system: systemTokens,
  history: historyTokens,
  context: contextTokens
});
```

## Future Improvements

1. **Streaming Responses**
   - Implement Server-Sent Events
   - Progressive content loading
   - Real-time typing indicators

2. **Advanced RAG**
   - Semantic search improvements
   - Context ranking
   - Multi-modal support

3. **Analytics**
   - Conversation quality metrics
   - User satisfaction tracking
   - A/B testing framework

## Contributing

When modifying the Claude Service:

1. Maintain JSDoc typing
2. Update tests
3. Consider multilingual impact
4. Monitor token usage
5. Test error scenarios

## Support

For issues with the Claude Service:

1. Check logs for detailed errors
2. Verify API key and permissions
3. Test with simple prompts first
4. Monitor token usage patterns
