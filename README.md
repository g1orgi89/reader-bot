# Shrooms Support Bot

AI-powered support bot for the Shrooms Web3 project, built with Claude API and featuring mushroom-themed assistance.

## Features

- 🍄 AI-powered chat support with Claude 3
- 📚 RAG (Retrieval-Augmented Generation) with Qdrant vector database
- 🎯 Multi-language support (English, Spanish, Russian)
- 🎫 Ticket management system
- 📊 Admin panel for managing the knowledge base
- 🔒 Secure authentication with rate limiting
- 📱 WebSocket support for real-time chat
- 🏗️ Service Manager for dependency injection

## Prerequisites

- Node.js (v16 or higher)
- MongoDB
- Qdrant vector database
- Anthropic API key
- OpenAI API key (for embeddings)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/g1orgi89/shrooms-support-bot.git
   cd shrooms-support-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file and fill in the required values:
   - `ANTHROPIC_API_KEY` - Your Claude API key
   - `OPENAI_API_KEY` - Your OpenAI API key for embeddings
   - `MONGODB_URI` - Your MongoDB connection string
   - Other optional configurations

4. **Start the required services**
   - MongoDB
   - Qdrant (default: http://localhost:6333)

5. **Run the development server**
   ```bash
   npm run dev
   ```

The server will start on http://localhost:3000

## Configuration

### Required Environment Variables

- `ANTHROPIC_API_KEY` - API key from Anthropic for Claude access
- `OPENAI_API_KEY` - API key from OpenAI for embeddings
- `MONGODB_URI` - MongoDB connection string

### Optional Environment Variables

See `.env.example` for a full list of configurable options.

## Development

### Starting the development server

```bash
npm run dev
```

### Running tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## API Endpoints

### Chat

- `POST /api/chat/message` - Send a message to the AI assistant
- `GET /api/chat/conversations` - Get conversation history

### Tickets

- `GET /api/tickets` - Get all tickets
- `POST /api/tickets` - Create a new ticket
- `PUT /api/tickets/:id` - Update a ticket
- `DELETE /api/tickets/:id` - Delete a ticket

### Knowledge Base

- `GET /api/knowledge` - Get knowledge base documents
- `POST /api/knowledge` - Add a new document
- `PUT /api/knowledge/:id` - Update a document
- `DELETE /api/knowledge/:id` - Delete a document

### Admin

- `GET /api/admin/stats` - Get system statistics
- `POST /api/admin/update-yield` - Update farming yield display

## Architecture

The application uses a Service Manager pattern for dependency injection and service lifecycle management:

- **ClaudeService** - Handles AI interactions with Claude API
- **VectorStoreService** - Manages the Qdrant vector database
- **TicketService** - Handles support ticket operations
- **ServiceManager** - Coordinates all services with dependency resolution

## Knowledge Base

To populate the knowledge base:

1. Create markdown files in the appropriate directories:
   - `knowledge/general/` - General information
   - `knowledge/user-guide/` - User guides
   - `knowledge/tokenomics/` - Token information
   - `knowledge/technical/` - Technical documentation
   - `knowledge/troubleshooting/` - Common issues

2. Run the knowledge loading script:
   ```bash
   npm run load-knowledge
   ```

## Widget Integration

To embed the chat widget on your website:

```html
<div id="shrooms-chat"></div>
<script src="http://localhost:3000/widget/widget.js"></script>
<script>
  ShroomsWidget.init({
    containerId: 'shrooms-chat',
    apiUrl: 'http://localhost:3000',
    theme: 'dark'
  });
</script>
```

## Telegram Bot

To enable the Telegram bot:

1. Create a bot using [@BotFather](https://t.me/botfather)
2. Add your bot token to the environment variables:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```
3. Start the Telegram bot:
   ```bash
   npm run telegram
   ```

## Production Deployment

### Using Docker

```bash
# Build the image
docker build -t shrooms-support-bot .

# Run with docker-compose
docker-compose up -d
```

### Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# Save the configuration
pm2 save
pm2 startup
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please create an issue on GitHub or contact the development team.

---

🍄 Made with love by the Shrooms team
