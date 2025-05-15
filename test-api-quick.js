/**
 * Quick API test script for Shrooms Support Bot
 * @file test-api-quick.js
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function testAPI() {
  console.log('🧪 Running quick API tests...\n');

  const tests = [
    {
      name: 'Health Check',
      method: 'GET',
      url: `${API_BASE}/health`,
      expectedStatus: 200
    },
    {
      name: 'Chat Health Check',
      method: 'GET', 
      url: `${API_BASE}/chat/health`,
      expectedStatus: 200
    },
    {
      name: 'Languages API',
      method: 'GET',
      url: `${API_BASE}/chat/languages`,
      expectedStatus: 200
    },
    {
      name: 'Direct Chat API',
      method: 'POST',
      url: `${API_BASE}/chat`,
      data: {
        message: "Привет! Это тестовое сообщение.",
        userId: `test-${Date.now()}`,
        language: 'ru'
      },
      expectedStatus: 200
    },
    {
      name: 'Message API',
      method: 'POST',
      url: `${API_BASE}/chat/message`,
      data: {
        message: "Hello! This is a test message.",
        userId: `test-${Date.now()}`,
        language: 'en'
      },
      expectedStatus: 200
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}...`);
      
      const config = {
        method: test.method,
        url: test.url,
        timeout: 10000,
        ...(test.data && { data: test.data }),
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const response = await axios(config);
      
      if (response.status === test.expectedStatus) {
        console.log(`  ✅ ${test.name} - PASSED (${response.status})`);
        
        // Log some response details for certain endpoints
        if (test.name === 'Direct Chat API' || test.name === 'Message API') {
          const data = response.data;
          if (data.success && data.data) {
            console.log(`     Response: ${data.data.message.substring(0, 100)}...`);
            console.log(`     Tokens: ${data.data.tokensUsed}`);
            console.log(`     Language: ${data.data.language}`);
          }
        } else if (test.name === 'Health Check') {
          const data = response.data;
          console.log(`     Status: ${data.status}`);
          console.log(`     Environment: ${data.environment}`);
        }
        
        passed++;
      } else {
        console.log(`  ❌ ${test.name} - FAILED (${response.status} != ${test.expectedStatus})`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${test.name} - ERROR: ${error.message}`);
      
      if (error.response) {
        console.log(`     Status: ${error.response.status}`);
        console.log(`     Response: ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`     Server not running on ${API_BASE}`);
      }
      
      failed++;
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! The API is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
    
    if (failed === tests.length) {
      console.log('\n💡 Possible issues:');
      console.log('   - Server not running (try: npm start)');
      console.log('   - MongoDB not connected');
      console.log('   - Missing environment variables (check .env file)');
      console.log('   - API key issues (check ANTHROPIC_API_KEY)');
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Handle interrupt
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted');
  process.exit(1);
});

// Run tests
testAPI().catch(error => {
  console.error('❌ Test runner error:', error.message);
  process.exit(1);
});