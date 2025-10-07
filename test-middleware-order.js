// Test middleware registration order
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

console.log('\n🔍 Middleware Stack Analysis:\n');

const app = serverModule.app;
const stack = app._router.stack;

console.log(`Total middleware/routes: ${stack.length}\n`);

let foundWebhook = false;
let webhookIndex = -1;

stack.forEach((layer, index) => {
  const name = layer.name || 'anonymous';
  const path = layer.route?.path || layer.regexp?.toString() || 'middleware';
  
  if (path.includes('webhook') || (layer.route && layer.route.path === '/api/reader/telegram/webhook')) {
    console.log(`${index}. ✅ WEBHOOK: ${name} - ${path}`);
    foundWebhook = true;
    webhookIndex = index;
  } else if (path.includes('/api/') || path.includes('apiPrefix')) {
    console.log(`${index}. ${name} - ${path}`);
  } else if (index < 20) {
    console.log(`${index}. ${name} - ${path.substring(0, 50)}`);
  }
});

if (!foundWebhook) {
  console.log('\n❌ Webhook middleware not found in stack!');
} else {
  console.log(`\n✅ Webhook found at index ${webhookIndex}`);
}

setTimeout(() => process.exit(0), 500);
