/**
 * Специальный тест для WeeklyReportService
 * @file test-weekly-service.js
 */

require('dotenv').config();
const logger = require('./server/utils/simpleLogger');

async function testWeeklyService() {
  try {
    logger.info('🧪 Testing WeeklyReportService specifically...');
    
    const WeeklyReportService = require('./server/services/weeklyReportService');
    const weeklyService = new WeeklyReportService();
    
    // Мок данные
    const mockQuotes = [
      { 
        text: "Жизнь прекрасна когда ты знаешь, чего хочешь", 
        author: "Философ", 
        createdAt: new Date() 
      },
      { 
        text: "Любовь побеждает все страхи", 
        author: "Поэт", 
        createdAt: new Date() 
      },
      { 
        text: "Мудрость приходит с опытом", 
        author: "Мудрец", 
        createdAt: new Date() 
      }
    ];
    
    const mockUser = {
      userId: 'test_user_123',
      name: 'Мария Тестовая',
      testResults: { 
        mood: 'optimistic',
        lifestyle: 'Замужем, балансирую дом/работу/себя',
        priorities: 'Саморазвитие и семья'
      }
    };
    
    logger.info('📖 Calling analyzeWeeklyQuotes...');
    
    // ❗ ГЛАВНЫЙ ТЕСТ: Этот вызов НЕ должен загружать векторную базу
    const analysis = await weeklyService.analyzeWeeklyQuotes(mockQuotes, mockUser);
    
    logger.info('✅ Analysis completed!');
    logger.info(`📊 Summary: ${analysis.summary}`);
    logger.info(`🎯 Themes: ${analysis.dominantThemes.join(', ')}`);
    logger.info(`😊 Emotional tone: ${analysis.emotionalTone}`);
    logger.info(`💡 Insights: ${analysis.insights.substring(0, 100)}...`);
    
    // Тест полного отчета
    logger.info('📖 Testing full report generation...');
    const fullReport = await weeklyService.generateWeeklyReport('test_user_123', mockQuotes, mockUser);
    
    logger.info('✅ Full report generated!');
    logger.info(`📅 Week: ${fullReport.weekNumber}/${fullReport.year}`);
    logger.info(`📚 Recommendations: ${fullReport.recommendations.length}`);
    logger.info(`🎁 Promo code: ${fullReport.promoCode.code}`);
    
    // Тест форматирования для Telegram
    const telegramText = weeklyService.formatTelegramReport(fullReport, mockQuotes);
    logger.info('✅ Telegram format generated!');
    logger.info(`📱 Message length: ${telegramText.length} chars`);
    
    logger.info('🎉 WeeklyReportService test completed successfully!');
    
  } catch (error) {
    logger.error(`❌ WeeklyReportService test failed: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Запуск теста
if (require.main === module) {
  testWeeklyService().then(() => {
    logger.info('🎯 WeeklyReportService test completed - exiting');
    process.exit(0);
  });
}

module.exports = { testWeeklyService };