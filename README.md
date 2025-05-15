# 🍄 Shrooms AI Support Bot

AI-powered support bot for the Shrooms project using Claude API with RAG capabilities.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start MongoDB and Qdrant:**
   ```bash
   # MongoDB
   mongod
   
   # Qdrant (using Docker)
   docker run -p 6333:6333 qdrant/qdrant
   ```

4. **Start the server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

## Health Check

Visit `http://localhost:3000/api/health` to verify the server is running.

## CORS Test

Visit `http://localhost:3000/test-cors` to test CORS functionality.

## Environment Variables

Key required variables:
- `ANTHROPIC_API_KEY` - Your Claude API key
- `MONGODB_URI` - MongoDB connection string
- `OPENAI_API_KEY` - For embeddings (optional)

See `.env.example` for all available options.

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/chat/message` - Send chat message
- `GET /api/tickets` - Get tickets
- `POST /api/knowledge` - Add knowledge

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start with nodemon
- `npm run load-kb` - Load knowledge base
- `npm test` - Run tests

## Troubleshooting

### CORS Issues
The server is configured with permissive CORS settings for development. If you still have issues:
1. Check that you're accessing the correct port (3000)
2. Verify no other process is using the port
3. Try accessing `/api/health` directly

### Server Won't Start
1. Check that all required environment variables are set
2. Ensure MongoDB is running
3. Check the logs for specific error messages

## Development

The project uses:
- Express.js for the server
- Claude API for AI responses
- MongoDB for data storage
- Qdrant for vector search

Add your API keys to `.env` and start developing!