process.env.NODE_ENV = 'test';
process.env.ENABLE_SIMPLE_BOT = 'true';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test';

const originalMain = require.main;
require.main = null;

const serverModule = require('./server/index.js');

require.main = originalMain;

setTimeout(() => {
  const server = serverModule.server.listen(0, 'localhost', () => {
    const port = server.address().port;
    
    const http = require('http');
    const postData = JSON.stringify({
      update_id: 123,
      message: { message_id: 1, from: { id: 123, first_name: 'Test' }, chat: { id: 123, type: 'private' }, date: Date.now(), text: '/start' }
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/api/reader/telegram/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      console.log(`\nStatus: ${res.statusCode}`);
      console.log(`Headers: ${JSON.stringify(res.headers)}`);
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`Body: ${data}`);
        server.close(() => process.exit(0));
      });
    });
    
    req.on('error', (err) => {
      console.log(`Error: ${err.message}`);
      server.close(() => process.exit(1));
    });
    
    req.write(postData);
    req.end();
  });
}, 1500);
