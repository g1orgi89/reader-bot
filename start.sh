#!/bin/bash

# 📖 Reader Support Bot - Quick Start Script

echo "📖 Starting Reader AI Support Bot..."
echo "=================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️ .env file not found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your API keys."
    echo "📝 Important: Configure your AI provider and API keys:"
    echo "   - For Claude/Anthropic: Set AI_PROVIDER=claude and add ANTHROPIC_API_KEY"
    echo "   - For OpenAI: Set AI_PROVIDER=openai and add OPENAI_API_KEY"
    echo ""
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed."
    echo ""
fi

# Start the server
echo "🚀 Starting server on port 3000..."
echo ""
echo "🔗 Available endpoints after startup:"
echo "   Main API: http://localhost:3000/"
echo "   Health Check: http://localhost:3000/api/health"
echo "   Test Interface: http://localhost:3000/test"
echo "   CORS Test: http://localhost:3000/test-cors"
echo ""
echo "💡 Press Ctrl+C to stop the server"
echo "=================================="
echo ""

# Start the application
npm start