# Shrooms AI Support Bot

AI-powered support bot for the Shrooms Web3 project, built with Claude API integration.

## 🍄 Project Overview

The Shrooms Support Bot provides multilingual (EN/ES/RU) customer support for the Shrooms Web3 platform. It features:

- **AI-powered responses** using Anthropic's Claude API
- **Multi-platform support** - Web widget and Telegram bot
- **Knowledge base integration** with RAG (Retrieval-Augmented Generation)
- **Ticketing system** for issues requiring human intervention
- **Mushroom-themed personality** with crypto-focused assistance

## 🏗️ Architecture

The project follows a modular serverless architecture:

```
shrooms-support-bot/
├── server/              # Main API server
├── client/              # Web widget and admin panel
├── telegram/            # Telegram bot implementation
├── scripts/             # Utility scripts
├── knowledge/           # Knowledge base documents
├── docker/              # Docker configuration
└── tests/               # Test suites
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- MongoDB 5.0+
- Qdrant (vector database)
- Anthropic API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/g1orgi89/shrooms-support-bot.git
cd shrooms-support-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

4. Load knowledge base:
```bash
npm run load-kb
```

5. Start the development server:
```bash
npm run dev
```

6. (Optional) Start Telegram bot:
```bash
npm run telegram
```

## 🛠️ Development

### Type Safety

This project uses JSDoc for comprehensive type checking:

- All functions must include JSDoc comments with `@param` and `@returns`
- Shared types are defined in `server/types/index.js`
- ESLint enforces JSDoc requirements
- Use `npm run lint` to check code quality

### Project Structure

See the [Architecture Documentation](./docs/ARCHITECTURE.md) for detailed information about:
- Component interactions
- Database schemas
- API endpoints
- Message flows

## 📚 Documentation

- [Installation Guide](./docs/INSTALLATION.md)
- [API Reference](./docs/API.md)
- [Telegram Bot Setup](./docs/TELEGRAM.md)
- [Knowledge Base Management](./docs/KNOWLEDGE_BASE.md)

## 🤝 Contributing

1. Follow the existing code style and JSDoc standards
2. Write tests for new functionality
3. Update documentation for API changes
4. Ensure all linting passes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Shrooms Project](https://shrooms.io)
- [Anthropic Claude](https://www.anthropic.com)
- [Project Issues](https://github.com/g1orgi89/shrooms-support-bot/issues)

---

Built with 🍄 for the Shrooms community
