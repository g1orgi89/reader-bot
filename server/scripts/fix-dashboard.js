#!/usr/bin/env node

/**
 * @fileoverview Скрипт исправления дашборда Reader Bot
 * @description Быстрое решение проблем с аналитикой и дашбордом
 */

const path = require('path');
const { initializeAnalytics, clearAnalyticsCache, getAnalyticsStatus } = require('../utils/analyticsInitializer');

console.log('🔧 Reader Bot Dashboard Fix Script');
console.log('===================================');

async function fixDashboard() {
  try {
    console.log('📊 Step 1: Checking analytics service status...');
    const status = getAnalyticsStatus();
    console.log(`   Service initialized: ${status.initialized}`);
    console.log(`   Fallback mode: ${status.fallbackMode}`);
    console.log(`   Cache size: ${status.cacheSize}`);
    
    console.log('\n📊 Step 2: Clearing analytics cache...');
    clearAnalyticsCache();
    console.log('   ✅ Cache cleared');
    
    console.log('\n📊 Step 3: Reinitializing analytics service...');
    const initResult = await initializeAnalytics();
    
    if (initResult.success) {
      console.log('   ✅ Analytics service initialized successfully');
      
      if (initResult.testData) {
        console.log('\n📊 Step 4: Verifying test data...');
        const { dashboard, retention, topContent } = initResult.testData;
        
        console.log(`   📈 Dashboard stats:
     - Total users: ${dashboard.overview.totalUsers}
     - Total quotes: ${dashboard.overview.totalQuotes}
     - Active users: ${dashboard.overview.activeUsers}
     - Source stats: ${dashboard.sourceStats.length} sources`);
        
        console.log(`   📊 Retention data: ${retention.length} cohorts`);
        
        console.log(`   🏆 Top content:
     - Top authors: ${topContent.topAuthors.length}
     - Top categories: ${topContent.topCategories.length}
     - Popular quotes: ${topContent.popularQuotes.length}`);
      }
      
      console.log('\n✅ Dashboard fix completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('   1. Refresh your browser dashboard page');
      console.log('   2. Check that charts are loading properly');
      console.log('   3. Verify that stat cards show numbers');
      console.log('   4. Test different time periods');
      
      return true;
    } else {
      console.error('   ❌ Analytics initialization failed:', initResult.error);
      console.log('\n🔧 Troubleshooting suggestions:');
      console.log('   1. Check MongoDB connection');
      console.log('   2. Verify model files exist in server/models/');
      console.log('   3. Check server logs for detailed errors');
      console.log('   4. Dashboard will use fallback demo data');
      
      return false;
    }
    
  } catch (error) {
    console.error('💥 Unexpected error during dashboard fix:', error);
    console.log('\n🔧 Manual troubleshooting steps:');
    console.log('   1. Restart the Reader Bot server');
    console.log('   2. Check all environment variables are set');
    console.log('   3. Verify database connectivity');
    console.log('   4. Check browser console for client-side errors');
    
    return false;
  }
}

// Информация о состоянии системы
function printSystemInfo() {
  console.log('\n📋 System Information:');
  console.log(`   Node.js version: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Architecture: ${process.arch}`);
  console.log(`   Working directory: ${process.cwd()}`);
  console.log(`   Script location: ${__filename}`);
  
  // Проверка наличия ключевых файлов
  const fs = require('fs');
  const keyFiles = [
    'server/services/analyticsService.js',
    'server/models/userProfile.js',
    'server/models/quote.js',
    'client/admin-panel/js/dashboard.js',
    'client/admin-panel/css/dashboard.css'
  ];
  
  console.log('\n📁 Key files check:');
  keyFiles.forEach(file => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  });
}

// Проверка проблем с Chart.js
function checkChartJsIssues() {
  console.log('\n📈 Chart.js Common Issues & Solutions:');
  console.log('   Problem: "Canvas is already in use" error');
  console.log('   Solution: ✅ Fixed in dashboard.js - charts are properly destroyed');
  console.log('');
  console.log('   Problem: Chart not displaying');
  console.log('   Solutions:');
  console.log('     - Check Chart.js is loaded (included in HTML)');
  console.log('     - Verify canvas elements exist in DOM');
  console.log('     - Check browser console for JavaScript errors');
  console.log('');
  console.log('   Problem: 404 errors for API endpoints');
  console.log('   Solutions:');
  console.log('     - Verify server is running on correct port');
  console.log('     - Check analytics routes are registered');
  console.log('     - Ensure API endpoints return proper JSON');
}

// Запуск скрипта
async function main() {
  printSystemInfo();
  
  console.log('\n🔧 Starting dashboard repair process...');
  const success = await fixDashboard();
  
  if (!success) {
    checkChartJsIssues();
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ Dashboard fix completed!' : '❌ Dashboard fix had issues');
  console.log('For more help, check the server logs or open an issue on GitHub');
  console.log('='.repeat(50));
  
  process.exit(success ? 0 : 1);
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --help, -h     Show this help message
  --status       Show analytics service status only
  --clear-cache  Clear analytics cache only

Examples:
  node ${path.basename(__filename)}                    # Full dashboard fix
  node ${path.basename(__filename)} --status          # Check status only
  node ${path.basename(__filename)} --clear-cache     # Clear cache only
`);
  process.exit(0);
}

if (args.includes('--status')) {
  console.log('📊 Analytics Service Status:');
  const status = getAnalyticsStatus();
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}

if (args.includes('--clear-cache')) {
  console.log('🧹 Clearing analytics cache...');
  clearAnalyticsCache();
  console.log('✅ Cache cleared successfully');
  process.exit(0);
}

// Запускаем основную функцию
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });
}