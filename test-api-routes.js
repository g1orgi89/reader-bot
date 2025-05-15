/**
 * Простой скрипт для тестирования API маршрутов
 * @file test-api-routes.js
 */

require('dotenv').config();

const fetch = require('node-fetch');

async function testRoutes() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing API routes...\n');
  
  // Тест 1: Health check
  try {
    console.log('1. Testing /api/chat/health...');
    const response = await fetch(`${baseUrl}/api/chat/health`);
    console.log(`   Status: ${response.status}`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Тест 2: Languages
  try {
    console.log('\n2. Testing /api/chat/languages...');
    const response = await fetch(`${baseUrl}/api/chat/languages`);
    console.log(`   Status: ${response.status}`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Тест 3: Message (правильный путь)
  try {
    console.log('\n3. Testing /api/chat/message (POST)...');
    const response = await fetch(`${baseUrl}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello, test message',
        userId: 'test-user-123',
        language: 'en'
      })
    });
    console.log(`   Status: ${response.status}`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Тест 4: Неправильный путь /api/chat
  try {
    console.log('\n4. Testing /api/chat (POST) - should be 404...');
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Test message',
        userId: 'test-user-123'
      })
    });
    console.log(`   Status: ${response.status}`);
    
    if (response.status !== 404) {
      const data = await response.json();
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    } else {
      console.log(`   ✅ Got expected 404 for /api/chat`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Тест 5: Main health endpoint
  try {
    console.log('\n5. Testing /api/health...');
    const response = await fetch(`${baseUrl}/api/health`);
    console.log(`   Status: ${response.status}`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('\n✅ Testing complete!');
}

// Запускаем тесты
testRoutes().catch(console.error);
