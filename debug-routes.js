/**
 * Диагностический скрипт для проверки маршрутов API
 * @file debug-routes.js
 */

require('dotenv').config();
const express = require('express');

// Попробуем импортировать все API роуты
try {
  console.log('🔍 Checking API routes...');
  
  console.log('1. Importing chat routes...');
  const chatRoutes = require('./server/api/chat');
  console.log('✅ Chat routes imported successfully');
  console.log('Chat routes type:', typeof chatRoutes);
  console.log('Chat routes constructor:', chatRoutes.constructor.name);
  
  console.log('2. Importing tickets routes...');
  const ticketRoutes = require('./server/api/tickets');
  console.log('✅ Ticket routes imported successfully');
  
  console.log('3. Importing admin routes...');
  const adminRoutes = require('./server/api/admin');
  console.log('✅ Admin routes imported successfully');
  
  console.log('4. Importing knowledge routes...');
  const knowledgeRoutes = require('./server/api/knowledge');
  console.log('✅ Knowledge routes imported successfully');
  
  console.log('\n5. Checking required services...');
  
  console.log('  - Claude service...');
  const claudeService = require('./server/services/claude');
  console.log('  ✅ Claude service imported');
  
  console.log('  - Message service...');
  const messageService = require('./server/services/message');
  console.log('  ✅ Message service imported');
  
  console.log('  - Conversation service...');
  const conversationService = require('./server/services/conversation');
  console.log('  ✅ Conversation service imported');
  
  console.log('  - Language detect service...');
  const languageDetectService = require('./server/services/languageDetect');
  console.log('  ✅ Language detect service imported');
  
  console.log('  - Vector store service...');
  const vectorStoreService = require('./server/services/vectorStore');
  console.log('  ✅ Vector store service imported');
  
  console.log('  - Ticketing service...');
  const ticketService = require('./server/services/ticketing');
  console.log('  ✅ Ticketing service imported');
  
  console.log('\n6. Testing Express router creation...');
  const app = express();
  const { config } = require('./server/config');
  
  // Тестируем подключение роутов
  app.use(express.json());
  app.use(`${config.app.apiPrefix}/chat`, chatRoutes);
  app.use(`${config.app.apiPrefix}/tickets`, ticketRoutes);
  app.use(`${config.app.apiPrefix}/admin`, adminRoutes);
  app.use(`${config.app.apiPrefix}/knowledge`, knowledgeRoutes);
  
  console.log('✅ All routes connected successfully');
  console.log(`API prefix: ${config.app.apiPrefix}`);
  
  // Выводим все зарегистрированные роуты
  console.log('\n7. Registered routes:');
  app._router.stack.forEach((r) => {
    if (r.route) {
      console.log(`  ${Object.keys(r.route.methods)} ${r.route.path}`);
    } else if (r.name === 'router') {
      // Это middleware router
      const basePath = r.regexp.source.replace(/[\\\^\$]/g, '').replace(/\?\(\?\=/g, '');
      console.log(`  Router: ${basePath}`);
      
      if (r.handle && r.handle.stack) {
        r.handle.stack.forEach(route => {
          if (route.route) {
            const methods = Object.keys(route.route.methods);
            console.log(`    ${methods} ${basePath}${route.route.path}`);
          }
        });
      }
    }
  });
  
  console.log('\n✅ All checks passed! Routes should work correctly.');
  
} catch (error) {
  console.log('❌ Error during route check:');
  console.error(error);
  
  // Детальная информация об ошибке
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('\n🔍 Module not found details:');
    console.log('- Missing module:', error.requireStack ? error.requireStack[0] : 'Unknown');
    console.log('- Required by:', error.requireStack ? error.requireStack[1] : 'Unknown');
  }
  
  process.exit(1);
}
