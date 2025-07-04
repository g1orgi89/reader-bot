/**
 * @fileoverview Инициализатор аналитики для Reader Bot
 * @description Создает демонстрационные данные для дашборда аналитики
 */

const analyticsService = require('../services/analyticsService');

/**
 * Инициализация аналитики с созданием демонстрационных данных
 */
async function initializeAnalytics() {
  console.log('📊 Starting analytics initialization for Reader Bot...');
  
  try {
    // Принудительная инициализация сервиса аналитики
    await analyticsService.initialize();
    
    // Проверяем статус сервиса
    const serviceStatus = analyticsService.getServiceStatus();
    console.log('📊 Analytics service status:', serviceStatus);
    
    if (serviceStatus.fallbackMode) {
      console.log('📊 Analytics running in fallback mode - using demo data');
    } else {
      console.log('📊 Analytics initialized with real database connection');
    }
    
    // Очищаем кэш для свежих данных
    analyticsService.clearCache();
    
    // Генерируем тестовые данные для проверки
    console.log('📊 Generating test data for dashboard...');
    const [dashboardStats, retentionData, topContent] = await Promise.all([
      analyticsService.getDashboardStats('7d'),
      analyticsService.getUserRetentionStats(),
      analyticsService.getTopQuotesAndAuthors('30d')
    ]);
    
    console.log('📊 Test data generated successfully:');
    console.log('  - Dashboard stats:', dashboardStats.overview);
    console.log('  - Retention cohorts:', retentionData.length);
    console.log('  - Top authors:', topContent.topAuthors.length);
    console.log('  - Top categories:', topContent.topCategories.length);
    
    return {
      success: true,
      serviceStatus,
      testData: {
        dashboard: dashboardStats,
        retention: retentionData,
        topContent
      }
    };
    
  } catch (error) {
    console.error('📊 Analytics initialization failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Команда для создания дополнительных демонстрационных данных
 */
async function createAdditionalDemoData() {
  console.log('📊 Creating additional demo data for Reader Bot analytics...');
  
  try {
    // Принудительно создаем образцы данных
    await analyticsService.ensureTestData();
    
    // Очищаем кэш
    analyticsService.clearCache();
    
    console.log('📊 Additional demo data created successfully');
    return { success: true };
    
  } catch (error) {
    console.error('📊 Failed to create additional demo data:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Команда для очистки кэша аналитики
 */
function clearAnalyticsCache() {
  console.log('📊 Clearing analytics cache...');
  analyticsService.clearCache();
  console.log('📊 Analytics cache cleared');
  return { success: true };
}

/**
 * Получение статуса системы аналитики
 */
function getAnalyticsStatus() {
  const serviceStatus = analyticsService.getServiceStatus();
  console.log('📊 Current analytics status:', serviceStatus);
  return serviceStatus;
}

module.exports = {
  initializeAnalytics,
  createAdditionalDemoData,
  clearAnalyticsCache,
  getAnalyticsStatus
};

// Если файл запущен напрямую, выполняем инициализацию
if (require.main === module) {
  initializeAnalytics()
    .then(result => {
      if (result.success) {
        console.log('✅ Analytics initialization completed successfully');
        process.exit(0);
      } else {
        console.error('❌ Analytics initialization failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error during analytics initialization:', error);
      process.exit(1);
    });
}