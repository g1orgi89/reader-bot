process.env.NODE_ENV = 'test';
process.env.ENABLE_SIMPLE_BOT = 'false'; // Disable auto-initialization
process.env.TELEGRAM_BOT_TOKEN = '123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test';

const express = require('express');
const http = require('http');

console.log('Testing direct Telegraf webhook callback...\n');

const SimpleTelegramBot = require('./bot/simpleBot');

const bot = new SimpleTelegramBot({
  token: process.env.TELEGRAM_BOT_TOKEN,
  environment: 'test',
  appWebAppUrl: 'https://test.example.com/mini-app/'
});

(async () => {
  await bot.initialize();
  console.log('Bot initialized\n');
  
  const app = express();
  app.use(express.json());
  
  const webhookPath = '/api/reader/telegram/webhook';
  const handler = bot.webhookCallback(webhookPath);
  
  app.post(webhookPath, handler);
  console.log(`Webhook registered at ${webhookPath}\n`);
  
  const server = http.createServer(app);
  server.listen(0, 'localhost', () => {
    const port = server.address().port;
    console.log(`Server listening on port ${port}\n`);
    
    const postData = JSON.stringify({
      update_id: 123,
      message: { message_id: 1, from: { id: 123, first_name: 'Test' }, chat: { id: 123, type: 'private' }, date: Math.floor(Date.now()/1000), text: '/start' }
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: webhookPath,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      console.log(`Response status: ${res.statusCode}\n`);
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`Response body: ${data}`);
        server.close(() => process.exit(0));
      });
    });
    
    req.on('error', (err) => {
      console.log(`Request error: ${err.message}`);
      server.close(() => process.exit(1));
    });
    
    req.write(postData);
    req.end();
  });
})();
