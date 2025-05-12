# Shrooms Support Bot

AI-powered support bot for the Shrooms Web3 project, built with Claude API and MongoDB. This bot provides intelligent customer support through web chat and Telegram integration.

## Features

- 🤖 AI-powered responses using Claude API
- 🎫 Ticket management system with full CRUD operations
- 📚 Knowledge base with vector search
- 🌐 Multiple language support (English, Spanish, Russian)
- 💬 Web chat widget
- 📱 Telegram bot integration
- 🔍 Full-text search in tickets
- 📊 Analytics and statistics
- 🍄 Mushroom-themed personality
- 🔐 Secure admin authentication
- 📊 Comprehensive API with full type safety

## Architecture

### Technology Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB with Mongoose
- **Vector Database**: Qdrant for knowledge base
- **AI**: Anthropic Claude API
- **Testing**: Jest with comprehensive unit and integration tests
- **Logging**: Winston
- **Type Safety**: JSDoc with TypeScript-style annotations
- **Authentication**: Bearer token middleware

### Key Components

- **TicketService**: Manages ticket CRUD operations with full type safety
- **VectorStore**: Handles knowledge base searches
- **ClaudeService**: Integrates with Claude API for generating responses
- **AdminAuth**: Secure authentication middleware for protected endpoints
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

# Authentication
ADMIN_TOKEN=your_secure_admin_token

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

# Run specific test file
npm test -- server/tests/api/tickets.test.js
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## API Documentation

### 📚 Comprehensive API Documentation
For detailed API documentation including all endpoints, authentication, types, and examples, see:

**📁 [Tickets API Documentation](docs/API_TICKETS.md)**

This documentation covers:
- All 11 ticket management endpoints
- Authentication requirements
- Type definitions (TicketStatus, TicketPriority, TicketCategory)
- Request/response examples
- Error codes and handling
- Query parameters for filtering and pagination

### Quick API Overview

The Tickets API provides comprehensive ticket management functionality:

- **Public Access**: Create tickets
- **User Access**: View own tickets
- **Admin Access**: Full ticket management

#### Authentication
```
Authorization: Bearer <your-admin-token>
```

#### Key Endpoints

```javascript
// Create ticket (public)
POST /api/tickets

// Get tickets with filtering (admin)
GET /api/tickets?status=open&priority=high&search=connection

// Get specific ticket (admin)
GET /api/tickets/TKT-001

// Update ticket (admin)
PUT /api/tickets/TKT-001

// Close ticket (admin)
POST /api/tickets/TKT-001/close

// Assign ticket (admin)
POST /api/tickets/TKT-001/assign

// Get assigned tickets (admin)
GET /api/tickets/assigned/agent123

// Get user tickets (user/admin)
GET /api/tickets/user/user123

// Search tickets (admin)
GET /api/tickets/search?q=connection+issue

// Get tickets by status (admin)
GET /api/tickets/status/open

// Get statistics (admin)
GET /api/tickets/stats
```

## Type System

This project uses comprehensive JSDoc typing for type safety without TypeScript:

```javascript
/**
 * @typedef {Object} TicketCreateData
 * @property {string} userId - User identifier
 * @property {string} conversationId - Associated conversation ID
 * @property {string} subject - Ticket subject
 * @property {string} initialMessage - Initial message
 * @property {string} [context] - Additional context
 * @property {'en'|'es'|'ru'} [language='en'] - Language
 * @property {'low'|'medium'|'high'|'urgent'} [priority='medium'] - Priority
 * @property {'technical'|'account'|'billing'|'feature'|'other'} [category='other'] - Category
 * @property {string} [email] - User email
 */
```

### Type Guards and Validation

All enum values are validated using type guards:

```javascript
// Type guard example
function isValidStatus(value) {
  return Object.values(TicketStatus).includes(value);
}

// Usage in API
if (!isValidStatus(req.body.status)) {
  return res.status(400).json(createErrorResponse('Invalid status'));
}
```

## Testing Strategy

The project includes comprehensive testing:

1. **Unit Tests**: Test individual services and utilities
2. **Integration Tests**: Test API endpoints with mocked dependencies
3. **Type Guards**: Validate enum values and data structures
4. **Error Handling**: Test all error scenarios
5. **Authentication**: Test protected endpoints

Example test structure:
```javascript
describe('POST /api/tickets', () => {
  it('should create a new ticket successfully', async () => {
    const ticketData = {
      userId: 'user123',
      conversationId: 'conv123',
      subject: 'Test ticket',
      initialMessage: 'This is a test ticket'
    };

    const response = await request(app)
      .post('/api/tickets')
      .send(ticketData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.ticketId).toBeDefined();
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
- Protect admin endpoints appropriately

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
5. Configure secure admin tokens for production

## Monitoring and Logging

The application includes comprehensive logging:

- **Info Level**: Successful operations, admin actions
- **Warn Level**: Authentication failures, deprecated usage
- **Error Level**: Service errors, failed operations

All logs include contextual information:
```javascript
logger.info('Creating new ticket', { 
  userId: req.body.userId,
  subject: req.body.subject 
});
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions about this bot:
- Create an issue on GitHub
- Join our Telegram community
- Email: support@shrooms.io

---

Built with 🍄 by the Shrooms team