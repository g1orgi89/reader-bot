# Shrooms Support Bot

AI-powered support bot for the Shrooms Web3 project, built with Claude API and MongoDB. This bot provides intelligent customer support through web chat and Telegram integration.

## Features

- 🤖 AI-powered responses using Claude API
- 🎫 Ticket management system
- 📚 Knowledge base with vector search
- 🌐 Multiple language support (English, Spanish, Russian)
- 💬 Web chat widget
- 📱 Telegram bot integration
- 🔍 Full-text search in tickets
- 📊 Analytics and statistics
- 🍄 Mushroom-themed personality

## Architecture

### Technology Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB with Mongoose
- **Vector Database**: Qdrant for knowledge base
- **AI**: Anthropic Claude API
- **Testing**: Jest with MongoDB Memory Server
- **Logging**: Winston
- **Type Safety**: JSDoc with TypeScript-style annotations

### Key Components

- **TicketService**: Manages ticket CRUD operations with full type safety
- **VectorStore**: Handles knowledge base searches
- **ClaudeService**: Integrates with Claude API for generating responses
- **Logger**: Structured logging with context support

## Installation

1. Clone the repository:
```bash
git clone https://github.com/g1orgi89/shrooms-support-bot.git
cd shrooms-support-bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

4. Start MongoDB and Qdrant (using Docker):
```bash
docker run -d --name mongodb -p 27017:27017 mongo:5.0
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

## Development

### Running the Application

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start

# Telegram bot only
npm run telegram
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Claude API
ANTHROPIC_API_KEY=your_claude_api_key

# Database
MONGODB_URI=mongodb://localhost:27017/shrooms-support

# Vector Database
VECTOR_DB_URL=http://localhost:6333

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## API Documentation

### Tickets Endpoint

The tickets API provides full CRUD operations for ticket management:

#### Create Ticket
```
POST /api/tickets
Content-Type: application/json

{
  "userId": "string",
  "conversationId": "string",
  "subject": "string",
  "initialMessage": "string",
  "priority": "low|medium|high|urgent",
  "category": "technical|account|billing|feature|other",
  "language": "en|es|ru"
}
```

#### Get Tickets
```
GET /api/tickets?status=open&priority=high&page=1&limit=20
```

#### Update Ticket
```
PATCH /api/tickets/:ticketId
Content-Type: application/json

{
  "status": "open|in_progress|resolved|closed",
  "priority": "low|medium|high|urgent",
  "assignedTo": "string",
  "resolution": "string"
}
```

#### Close Ticket
```
PATCH /api/tickets/:ticketId/close
Content-Type: application/json

{
  "resolution": "string",
  "closedBy": "string"
}
```

## Type System

This project uses comprehensive JSDoc typing for type safety without TypeScript:

```javascript
/**
 * @typedef {Object} Ticket
 * @property {string} ticketId - Unique ticket identifier
 * @property {string} userId - User identifier
 * @property {string} conversationId - Associated conversation ID
 * @property {('open'|'in_progress'|'resolved'|'closed')} status - Ticket status
 * @property {('low'|'medium'|'high'|'urgent')} priority - Ticket priority
 * @property {('technical'|'account'|'billing'|'feature'|'other')} category - Ticket category
 * @property {string} subject - Ticket subject
 * @property {string} initialMessage - Initial message
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} [resolvedAt] - Resolution timestamp
 */
```

## Testing Strategy

The project includes comprehensive testing:

1. **Unit Tests**: Test individual services and utilities
2. **Integration Tests**: Test API endpoints with real database
3. **Type Guards**: Validate enum values and data structures

Example test structure:
```javascript
describe('TicketService', () => {
  describe('createTicket', () => {
    test('should create a ticket with required fields', async () => {
      const ticketData = {
        userId: 'user123',
        subject: 'Test ticket',
        initialMessage: 'This is a test'
      };
      
      const ticket = await ticketService.createTicket(ticketData);
      
      expect(ticket).toBeDefined();
      expect(ticket.status).toBe('open');
    });
  });
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Code Style

- Use JSDoc for type annotations
- Follow the existing code style
- Write comprehensive tests
- Use descriptive variable names
- Add logging for important operations

## Deployment

### Docker

```bash
# Build the application
docker build -t shrooms-support-bot .

# Run with Docker Compose
docker-compose up -d
```

### Environment Setup

1. Set up MongoDB Atlas or self-hosted MongoDB
2. Configure Qdrant vector database
3. Set up environment variables
4. Deploy to your preferred platform (AWS, GCP, Azure)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions about this bot:
- Create an issue on GitHub
- Join our Telegram community
- Email: support@shrooms.io

---

Built with 🍄 by the Shrooms team