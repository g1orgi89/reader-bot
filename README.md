# 🍄 Shrooms AI Support Bot

AI-powered support bot for the Shrooms Web3 platform with mushroom-themed personality and RAG capabilities.

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or higher
- MongoDB (local or cloud)
- Qdrant (optional, for RAG features)
- Anthropic API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/g1orgi89/shrooms-support-bot.git
   cd shrooms-support-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Essential Configuration
   ANTHROPIC_API_KEY=your-anthropic-api-key
   MONGODB_URI=mongodb://localhost:27017/shrooms-support
   OPENAI_API_KEY=your-openai-api-key  # Optional, for RAG
   ```

4. **Setup MongoDB**
   
   **Option A: Local MongoDB**
   ```bash
   # Install MongoDB (Ubuntu/Debian)
   sudo apt update
   sudo apt install mongodb
   sudo systemctl start mongodb
   sudo systemctl enable mongodb
   ```
   
   **Option B: MongoDB Atlas (Cloud)**
   - Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a cluster
   - Get connection string and update `MONGODB_URI` in `.env`

5. **Setup Qdrant (Optional, for RAG)**
   ```bash
   # Using Docker
   docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
   ```

6. **Start the server**
   ```bash
   npm start
   ```

## 🐛 Troubleshooting Database Connection

If you see the error:
```
[ERROR] ❌ Database connection failed: {}
```

### Solution 1: Check MongoDB Service

```bash
# Check if MongoDB is running
sudo systemctl status mongodb

# If not running, start it
sudo systemctl start mongodb

# Enable auto-start on boot
sudo systemctl enable mongodb
```

### Solution 2: Test Connection Manually

```bash
# Test MongoDB connection
mongosh mongodb://localhost:27017/shrooms-support

# Or use the included test script
npm run test:db
```

### Solution 3: Use MongoDB Atlas

1. Create free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a cluster
3. Get connection string (like `mongodb+srv://...`)
4. Update `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/shrooms-support
   ```

### Solution 4: Docker MongoDB

```bash
# Run MongoDB in Docker
docker run -d --name mongodb -p 27017:27017 mongo:latest

# Update .env to point to Docker instance
MONGODB_URI=mongodb://localhost:27017/shrooms-support
```

## 🏗️ Architecture

The bot follows a modular architecture with:

- **API Layer**: REST endpoints for chat, tickets, knowledge management
- **Services**: Business logic for Claude AI, vector search, database operations
- **Models**: MongoDB schemas for conversations, messages, tickets
- **Real-time**: Socket.IO for live chat functionality

## 📁 Project Structure

```
shrooms-support-bot/
├── server/
│   ├── api/           # REST API routes
│   ├── config/        # Configuration and prompts
│   ├── models/        # MongoDB models
│   ├── services/      # Business logic services
│   ├── types/         # JSDoc type definitions
│   ├── utils/         # Utility functions
│   └── index.js       # Main server file
├── client/            # Frontend chat widget
├── knowledge/         # Knowledge base documents
├── scripts/           # Utility scripts
└── docs/             # Documentation
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test database connection
npm run test:db

# Test Claude API
npm run test:claude

# Run core functionality test
npm run test:core
```

## 📝 Configuration

Key configuration options in `.env`:

```env
# Core Settings
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/shrooms-support

# Claude AI
ANTHROPIC_API_KEY=your-key-here
CLAUDE_MODEL=claude-3-haiku-20240307
CLAUDE_MAX_TOKENS=1000

# Features
ENABLE_RAG=true        # Enable knowledge base search
ENABLE_ANALYTICS=false # Enable usage analytics
ENABLE_METRICS=true    # Enable performance metrics

# Languages
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,es,ru
```

## 🍄 Mushroom Personality

The bot uses a unique "mushroom AI" personality with:

- Gribo-terminology for crypto concepts
- Multi-language support (EN, ES, RU)
- Context-aware responses
- Automatic ticket creation for complex issues

## 🔌 API Endpoints

- `GET /api/health` - Health check
- `POST /api/chat/message` - Send chat message
- `GET /api/tickets` - List support tickets
- `POST /api/knowledge` - Add knowledge document
- `GET /api/metrics` - Performance metrics

## 🚀 Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Production Setup

1. Set `NODE_ENV=production`
2. Use environment-specific `.env` file
3. Setup proper logging
4. Configure reverse proxy (Nginx)
5. Enable SSL/HTTPS

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🔗 Links

- [Shrooms Project](https://shrooms.io)
- [Anthropic Claude](https://www.anthropic.com/claude)
- [MongoDB](https://www.mongodb.com)
- [Qdrant](https://qdrant.tech)

---

Made with 🍄 by the Shrooms team