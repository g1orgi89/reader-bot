const http = require('http');

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test_key';
process.env.ENABLE_SIMPLE_BOT = 'true';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
process.env.APP_WEBAPP_URL = 'https://test.example.com/mini-app/';

console.log('🧪 Detailed Webhook Test\n');

const originalMain = require.main;
require.main = null;

console.log('Loading server module...');
const serverModule = require('./server/index.js');

require.main = originalMain;

// Wait for bot init
setTimeout(async () => {
  console.log('\nStarting test server...');
  
  const server = serverModule.server.listen(0, 'localhost', async () => {
    const port = server.address().port;
    console.log(`Server listening on port ${port}`);
    
    // Test different paths
    const paths = [
      '/api/reader/telegram/webhook',
      '/api/health',
      '/api/nonexistent'
    ];
    
    for (const path of paths) {
      console.log(`\nTesting ${path}:`);
      
      const result = await makeRequest(port, path);
      console.log(`  Status: ${result.statusCode}`);
      console.log(`  Body: ${JSON.stringify(result.body).substring(0, 100)}`);
    }
    
    server.close(() => process.exit(0));
  });
}, 1500);

function makeRequest(port, path) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      update_id: 123,
      message: {
        message_id: 1,
        from: { id: 123, first_name: 'Test' },
        chat: { id: 123, type: 'private' },
        date: Date.now(),
        text: '/start'
      }
    });
    
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', () => resolve({ statusCode: 0, body: 'error' }));
    req.write(postData);
    req.end();
  });
}
