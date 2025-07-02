/**
 * Тест для проверки что векторная база НЕ загружается при useRag=false
 * @file test-rag-loading.js
 */

require('dotenv').config();

const logger = require('./server/utils/simpleLogger');

async function testRagLoading() {
  try {
    logger.info('🧪 Testing RAG loading behavior...');
    
    // Импортируем claudeService
    const claudeService = require('./server/services/claude');
    
    logger.info('📖 ClaudeService imported successfully');
    
    // Тест 1: Использование без RAG (useRag: false)
    logger.info('📖 TEST 1: Calling claudeService with useRag=false');
    
    const testPrompt = "Привет! Как дела?";
    
    const response1 = await claudeService.generateResponse(testPrompt, {
      platform: 'telegram',
      userId: 'test_user',
      useRag: false // ❗ Должно НЕ загружать векторную базу
    });
    
    logger.info(`📖 Response 1 (useRag=false): ${response1.message.substring(0, 50)}...`);
    logger.info(`📖 Tokens used: ${response1.tokensUsed}`);
    
    // Тест 2: Использование с RAG (useRag: true) - должно загрузить
    logger.info('📖 TEST 2: Calling claudeService with useRag=true');
    
    const response2 = await claudeService.generateResponse(testPrompt, {
      platform: 'telegram', 
      userId: 'test_user',
      useRag: true // ❗ Должно загружать векторную базу
    });
    
    logger.info(`📖 Response 2 (useRag=true): ${response2.message.substring(0, 50)}...`);
    logger.info(`📖 Tokens used: ${response2.tokensUsed}`);
    
    // Тест 3: WeeklyReportService (должен использовать useRag=false)
    logger.info('📖 TEST 3: Testing WeeklyReportService (should use useRag=false)');
    
    const WeeklyReportService = require('./server/services/weeklyReportService');
    const weeklyService = new WeeklyReportService();
    
    const mockQuotes = [
      { text: "Жизнь прекрасна", author: "Философ", createdAt: new Date() },
      { text: "Любовь побеждает все", author: "Поэт", createdAt: new Date() }
    ];
    
    const mockUser = {
      userId: 'test_user',
      name: 'Тестовый пользователь',
      testResults: { mood: 'optimistic' }
    };
    
    const analysis = await weeklyService.analyzeWeeklyQuotes(mockQuotes, mockUser);
    
    logger.info(`📖 Weekly analysis result: ${analysis.summary}`);
    logger.info(`📖 Dominant themes: ${analysis.dominantThemes.join(', ')}`);
    
    logger.info('✅ All tests completed successfully!');
    
    // Проверяем информацию о RAG
    const ragInfo = await claudeService.getRagInfo();
    logger.info(`📖 RAG Info: enabled=${ragInfo.enabled}, vectorStore status=${ragInfo.vectorStore.status}`);
    
  } catch (error) {
    logger.error(`❌ Test failed: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Запуск теста
if (require.main === module) {
  testRagLoading().then(() => {
    logger.info('🎉 Test completed - exiting');
    process.exit(0);
  });
}

module.exports = { testRagLoading };