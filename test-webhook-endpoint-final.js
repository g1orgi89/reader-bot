/**
 * Test webhook endpoint to verify it returns 200 OK (not 404)
 */
const http = require('http');

console.log('🧪 Testing Telegram Webhook Endpoint\n');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test_key';
process.env.ENABLE_SIMPLE_BOT = 'true';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
process.env.APP_WEBAPP_URL = 'https://test.example.com/mini-app/';

let serverModule;
let testServer;
let testPort;

async function runTest() {
  try {
    console.log('1️⃣ Loading server module...');
    
    // Prevent automatic server startup
    const originalMain = require.main;
    require.main = null;
    
    serverModule = require('./server/index.js');
    
    require.main = originalMain;
    
    console.log('   ✅ Server module loaded\n');
    
    // Wait a bit for bot initialization to complete
    console.log('2️⃣ Waiting for bot initialization...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Bot initialization complete\n');
    
    console.log('3️⃣ Starting test server...');
    
    await new Promise((resolve, reject) => {
      testServer = serverModule.server.listen(0, 'localhost', (error) => {
        if (error) {
          reject(error);
        } else {
          testPort = testServer.address().port;
          console.log(`   ✅ Test server listening on port ${testPort}\n`);
          resolve();
        }
      });
    });
    
    console.log('4️⃣ Testing webhook endpoint POST /api/reader/telegram/webhook...');
    
    const result = await testWebhookPost();
    
    if (result.statusCode === 200) {
      console.log(`   ✅ Webhook returned 200 OK`);
      console.log(`   ✅ Response: ${JSON.stringify(result.body)}`);
      console.log('\n✅ TEST PASSED: Webhook endpoint works correctly!');
      cleanup(0);
    } else if (result.statusCode === 404) {
      console.log(`   ❌ Webhook returned 404 NOT FOUND`);
      console.log(`   ❌ Response: ${JSON.stringify(result.body)}`);
      console.log('\n❌ TEST FAILED: Webhook still returns 404');
      cleanup(1);
    } else {
      console.log(`   ⚠️  Webhook returned ${result.statusCode}`);
      console.log(`   ⚠️  Response: ${JSON.stringify(result.body)}`);
      console.log('\n⚠️  TEST INCONCLUSIVE: Unexpected status code');
      cleanup(1);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    cleanup(1);
  }
}

function testWebhookPost() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      update_id: 123456789,
      message: {
        message_id: 1,
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser'
        },
        chat: {
          id: 123456,
          first_name: 'Test',
          username: 'testuser',
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: '/start'
      }
    });
    
    const options = {
      hostname: 'localhost',
      port: testPort,
      path: '/api/reader/telegram/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(data);
        } catch (e) {
          body = data;
        }
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

function cleanup(exitCode) {
  if (testServer) {
    testServer.close(() => {
      process.exit(exitCode);
    });
  } else {
    process.exit(exitCode);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  cleanup(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  cleanup(1);
});

// Run the test
runTest();
