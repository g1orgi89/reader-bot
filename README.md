# Shrooms AI Support Bot 🍄

AI-powered support bot for the Shrooms Web3 project, built with Claude API integration and inspired by [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook) best practices.

## 🚀 Project Overview

The Shrooms Support Bot provides multilingual (EN/ES/RU) customer support for the Shrooms Web3 platform using advanced RAG (Retrieval-Augmented Generation) techniques and document reranking algorithms adapted from Anthropic's examples.

### Key Features

- **🧠 Advanced RAG System**: Implements retrieval and reranking patterns from anthropic-cookbook
- **🍄 Mushroom-themed AI**: Unique personality with Web3 expertise and fungal metaphors
- **🌐 Multi-platform Support**: Web widget and Telegram bot
- **📚 Smart Knowledge Base**: Contextual responses with document reranking
- **🎫 Intelligent Ticketing**: Automatic escalation for complex issues
- **🔒 Security First**: Rate limiting, authentication, and input validation

## 🏗️ Architecture

Our architecture follows patterns from anthropic-cookbook, specifically:

```
shrooms-support-bot/
├── server/              # Main API server with Claude integration
│   ├── api/            # RESTful endpoints
│   ├── config/         # Configuration and prompts
│   │   ├── index.js    # Main config following Anthropic patterns
│   │   └── prompts.js  # Multi-language prompt templates
│   ├── models/         # Database models with enhanced metadata
│   ├── services/       # Business logic (Claude, RAG, Ticketing)
│   ├── types/          # Comprehensive JSDoc type definitions
│   └── utils/          # Utility functions
├── client/             # Frontend components
├── telegram/           # Telegram bot implementation
├── scripts/            # Automation scripts
└── knowledge/          # Structured knowledge base
```

## 🧠 RAG Implementation

Following [anthropic-cookbook/skills/retrieval_augmented_generation](https://github.com/anthropics/anthropic-cookbook/tree/main/skills/retrieval_augmented_generation):

### 1. Three-Tier Retrieval System

- **Level 1**: Basic vector similarity search
- **Level 2**: Enhanced with document summaries
- **Level 3**: Advanced reranking using Claude API

### 2. Document Reranking

Implements the reranking strategy from anthropic-cookbook:
```javascript
// Adapted from anthropic-cookbook patterns
function rerankDocuments(query, documents, k = 3) {
  // Send documents to Claude for intelligent reranking
  // Return top k most relevant documents
}
```

### 3. Context Management

- Smart context window management
- Token counting and optimization
- Graceful degradation for long conversations

## 🍄 Mushroom-Themed Prompts

Our prompts blend Anthropic's best practices with Shrooms' unique personality:

```javascript
// Multi-language support with mushroom theming
const systemPrompt = `You are a wise, friendly mushroom 🍄 
who knows everything about crypto and Web3...`;
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 5.0+
- Qdrant (vector database)
- Anthropic API key
- OpenAI API key (for embeddings)

### Installation

1. **Clone & Install**
```bash
git clone https://github.com/g1orgi89/shrooms-support-bot.git
cd shrooms-support-bot
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Load Knowledge Base**
```bash
npm run load-kb
```

4. **Start Development Server**
```bash
npm run dev
```

## 🛠️ Development

### Type Safety with JSDoc

Following Anthropic's documentation standards:

```javascript
/**
 * Enhanced Claude API response with retrieval details
 * @typedef {Object} ClaudeResponse
 * @property {string} message - AI generated response
 * @property {RetrievalDetails} [retrievalDetails] - RAG metrics
 * @property {RerankingDetails} [rerankingDetails] - Reranking stats
 */
```

### Code Quality

- ✅ ESLint with JSDoc enforcement
- ✅ Comprehensive type definitions
- ✅ Anthropic-inspired patterns
- ✅ Test coverage for all components

## 📚 Anthropic Cookbook Adaptations

### 1. Retrieval Patterns
- Adapted vector search with metadata filtering
- Multi-stage retrieval pipeline
- Document relevance scoring

### 2. Prompt Engineering
- Context-aware prompt templates
- Multi-language support
- Consistent personality maintenance

### 3. Error Handling
- Graceful degradation patterns
- Informative error messages with mushroom theming
- Retry mechanisms for API calls

## 🧪 Testing

```bash
# Run all tests
npm test

# Lint code
npm run lint

# Type check
npm run type-check
```

## 📊 Performance

- Average response time: < 500ms
- RAG retrieval: < 100ms
- Document reranking: < 200ms
- 99.9% uptime target

## 🤝 Contributing

We follow Anthropic's standards:

1. **Type Safety**: All functions must have JSDoc comments
2. **Testing**: Write tests for new features
3. **Documentation**: Update relevant docs
4. **Code Style**: Follow ESLint rules

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🔗 Links

- [Shrooms Project](https://shrooms.io)
- [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook)
- [Claude API Docs](https://docs.anthropic.com)
- [Project Issues](https://github.com/g1orgi89/shrooms-support-bot/issues)

---

<p align="center">
  Built with 🍄 for the Shrooms community<br>
  <em>Inspired by Anthropic Cookbook patterns</em>
</p>
