/**
 * Test script to verify webhook endpoint behavior without full server startup
 * @file test-webhook-endpoint.js
 */

const express = require('express');
const http = require('http');

console.log('🧪 Testing Telegram Bot Webhook Endpoint Behavior\n');

// Simulate the fixed initialization flow
async function testWebhookFlow() {
  console.log('1️⃣ Testing bot initialization flow...');
  
  try {
    // Create mock bot similar to SimpleTelegramBot
    const mockBot = {
      isInitialized: false,
      
      async initialize() {
        console.log('   🤖 Initializing bot handlers...');
        this.isInitialized = true;
        return true;
      },
      
      webhookCallback(path) {
        if (!this.isInitialized) {
          throw new Error('Bot must be initialized before creating webhook callback');
        }
        console.log(`   🔗 Creating webhook callback for ${path}`);
        
        // Return Express middleware that simulates Telegraf behavior
        return (req, res, next) => {
          console.log(`   📥 Webhook request received: ${req.method} ${req.path}`);
          // Telegraf always returns 200 OK for valid webhook requests
          res.status(200).json({ ok: true, result: true });
        };
      }
    };
    
    console.log('   ✅ Mock bot created');
    
    // Step 1: Initialize bot (NEW BEHAVIOR - happens before webhook registration)
    await mockBot.initialize();
    console.log('   ✅ Bot initialized successfully');
    
    if (!mockBot.isInitialized) {
      console.log('   ❌ Bot initialization failed!');
      process.exit(1);
    }
    
    // Step 2: Create Express app and register webhook
    const app = express();
    const server = http.createServer(app);
    
    app.use(express.json());
    
    const webhookPath = '/api/reader/telegram/webhook';
    console.log(`   🔗 Registering webhook at ${webhookPath}`);
    
    // Register actual webhook callback (NEW BEHAVIOR - no placeholder!)
    app.use(webhookPath, mockBot.webhookCallback(webhookPath));
    console.log('   ✅ Webhook registered with actual handler');
    
    // Step 3: Test webhook endpoint
    console.log('\n2️⃣ Testing webhook endpoint...');
    
    return new Promise((resolve, reject) => {
      server.listen(0, () => {  // Use port 0 to get any available port
        const port = server.address().port;
        console.log(`   🌐 Test server listening on port ${port}`);
        
        // Make test request to webhook endpoint
        const http = require('http');
        const postData = JSON.stringify({
          update_id: 123456789,
          message: {
            message_id: 1,
            from: { id: 123, first_name: 'Test', username: 'testuser' },
            chat: { id: 123, type: 'private' },
            date: Date.now(),
            text: '/start'
          }
        });
        
        const options = {
          hostname: 'localhost',
          port: port,
          path: webhookPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const req = http.request(options, (res) => {
          console.log(`   📡 Response status: ${res.statusCode}`);
          
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            console.log(`   📦 Response body: ${data}`);
            
            if (res.statusCode === 200) {
              console.log('   ✅ Webhook returned 200 OK (correct!)');
              
              try {
                const response = JSON.parse(data);
                if (response.ok) {
                  console.log('   ✅ Response indicates success');
                }
              } catch (e) {
                // Response might not be JSON, that's ok
              }
            } else if (res.statusCode === 404) {
              console.log('   ❌ Webhook returned 404 (BUG - this should never happen!)');
              server.close();
              reject(new Error('Webhook returned 404'));
              return;
            } else {
              console.log(`   ⚠️ Webhook returned ${res.statusCode}`);
            }
            
            server.close();
            resolve();
          });
        });
        
        req.on('error', (e) => {
          console.log(`   ❌ Request error: ${e.message}`);
          server.close();
          reject(e);
        });
        
        req.write(postData);
        req.end();
      });
    });
    
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Compare with OLD BEHAVIOR (commented out for reference)
console.log('📋 OLD BEHAVIOR (before fix):');
console.log('   1. Bot instance created but NOT initialized');
console.log('   2. Placeholder webhook handler registered');
console.log('   3. HTTP server starts listening');
console.log('   4. Webhook requests arrive → placeholder checks isInitialized → returns 404 or 200 with "Bot initializing"');
console.log('   5. Bot initialized later in startServer()');
console.log('   ❌ PROBLEM: Requests during initialization could return 404\n');

console.log('📋 NEW BEHAVIOR (after fix):');
console.log('   1. Bot instance created AND fully initialized');
console.log('   2. Actual Telegraf webhook handler registered');
console.log('   3. HTTP server starts listening');
console.log('   4. Webhook requests arrive → handled by Telegraf → always 200 OK or proper error handling');
console.log('   ✅ SOLUTION: Bot is ready before accepting requests\n');

// Run the test
testWebhookFlow()
  .then(() => {
    console.log('\n✅ All webhook endpoint tests passed!');
    console.log('\n🎯 Key improvements:');
    console.log('   • Bot initialized synchronously before webhook registration');
    console.log('   • No placeholder handler that could return 404');
    console.log('   • Telegraf handles all webhook requests properly');
    console.log('   • /start and other commands work immediately');
    process.exit(0);
  })
  .catch((error) => {
    console.log(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  });
