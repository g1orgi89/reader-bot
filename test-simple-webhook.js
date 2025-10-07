process.env.NODE_ENV = 'test';
process.env.ENABLE_SIMPLE_BOT = 'false';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test';

const express = require('express');

console.log('Creating minimal test...\n');

const app = express();
app.use(express.json());

const webhookPath = '/api/reader/telegram/webhook';

// Test 1: Simple handler
app.post(webhookPath, (req, res) => {
  console.log('Handler called!');
  res.status(200).json({ ok: true, test: 'success' });
});

console.log('Route registered\n');

const server = require('http').createServer(app);
server.listen(0, 'localhost', () => {
  const port = server.address().port;
  console.log(`Server on port ${port}\n`);
  
  const postData = JSON.stringify({ test: 'data' });
  
  const req = require('http').request({
    hostname: 'localhost',
    port: port,
    path: webhookPath,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`Body: ${data}`);
      server.close(() => process.exit(0));
    });
  });
  
  req.write(postData);
  req.end();
});
