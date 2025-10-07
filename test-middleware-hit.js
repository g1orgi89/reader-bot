process.env.NODE_ENV = 'test';
process.env.ENABLE_SIMPLE_BOT = 'true';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test';

const originalMain = require.main;
require.main = null;

const serverModule = require('./server/index.js');
const app = serverModule.app;

require.main = originalMain;

// Patch all middleware to log when they're hit
const stack = app._router.stack;
stack.forEach((layer, index) => {
  const originalHandle = layer.handle;
  layer.handle = function(req, res, next) {
    if (req.url.includes('/api/reader/telegram/webhook')) {
      console.log(`[${index}] Middleware hit: ${layer.name || 'anonymous'} - ${layer.route?.path || layer.regexp?.toString() || 'middleware'}`);
    }
    return originalHandle.call(this, req, res, next);
  };
});

console.log('Middleware patched for logging\n');

// Wait for bot init
setTimeout(() => {
  console.log('Starting server...\n');
  
  const server = serverModule.server.listen(0, 'localhost', () => {
    const port = server.address().port;
    console.log(`Server on port ${port}\n`);
    
    const http = require('http');
    const postData = JSON.stringify({
      update_id: 123,
      message: { message_id: 1, from: { id: 123 }, chat: { id: 123 }, date: Date.now(), text: '/start' }
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/api/reader/telegram/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      console.log(`\nResponse status: ${res.statusCode}`);
      res.on('data', () => {});
      res.on('end', () => {
        server.close(() => process.exit(0));
      });
    });
    
    req.write(postData);
    req.end();
  });
}, 1500);
