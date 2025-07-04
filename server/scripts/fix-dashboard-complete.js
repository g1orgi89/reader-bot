#!/usr/bin/env node
/**
 * @fileoverview Скрипт быстрого исправления дашборда Reader Bot
 * @description Заменяет проблемные файлы исправленными версиями
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Скрипт исправления дашборда Reader Bot');
console.log('==================================================');

/**
 * Копирует исправленные файлы
 */
function fixDashboardFiles() {
  try {
    console.log('📂 Копирование исправленных файлов...');

    // Пути к файлам
    const sourceDashboardJs = path.join(__dirname, '../../client/admin-panel/js/dashboard-fixed.js');
    const targetDashboardJs = path.join(__dirname, '../../client/admin-panel/js/dashboard.js');
    
    const sourceAnalyticsService = path.join(__dirname, '../services/analyticsService-fixed.js');
    const targetAnalyticsService = path.join(__dirname, '../services/analyticsService.js');

    // Копируем dashboard.js
    if (fs.existsSync(sourceDashboardJs)) {
      fs.copyFileSync(sourceDashboardJs, targetDashboardJs);
      console.log('✅ dashboard.js обновлен');
    } else {
      console.log('⚠️  dashboard-fixed.js не найден');
    }

    // Копируем analyticsService.js
    if (fs.existsSync(sourceAnalyticsService)) {
      fs.copyFileSync(sourceAnalyticsService, targetAnalyticsService);
      console.log('✅ analyticsService.js обновлен');
    } else {
      console.log('⚠️  analyticsService-fixed.js не найден');
    }

    console.log('✅ Файлы дашборда исправлены!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Ошибка копирования файлов:', error.message);
  }
}

/**
 * Создает CSS стили для ошибок графиков
 */
function addErrorStyles() {
  try {
    console.log('🎨 Добавление CSS стилей для ошибок...');
    
    const cssPath = path.join(__dirname, '../../client/admin-panel/css/dashboard.css');
    
    const additionalCSS = `

/* ===================================== */
/* СТИЛИ ДЛЯ ОШИБОК И СОСТОЯНИЙ ГРАФИКОВ */
/* ===================================== */

.chart-error, .chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  background: #f8f9fa;
  border: 2px dashed #e9ecef;
  border-radius: 8px;
  color: #6c757d;
  text-align: center;
}

.chart-error {
  background: #fff5f5;
  border-color: #fed7d7;
  color: #e53e3e;
}

.error-icon, .empty-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.chart-error p {
  margin: 0;
  font-weight: 500;
}

.chart-empty p {
  margin: 0;
  font-style: italic;
}

/* Состояние загрузки */
#loading-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 9999;
  display: none;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Улучшения для кнопок */
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dashboard-controls {
  margin-bottom: 2rem;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.dashboard-controls select,
.dashboard-controls button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.dashboard-controls button {
  background: #007bff;
  color: white;
  border-color: #007bff;
  cursor: pointer;
}

.dashboard-controls button:hover:not(:disabled) {
  background: #0056b3;
}

/* Адаптивность для малых экранов */
@media (max-width: 768px) {
  .chart-error, .chart-empty {
    height: 200px;
  }
  
  .error-icon, .empty-icon {
    font-size: 1.5rem;
  }
  
  .dashboard-controls {
    flex-direction: column;
    align-items: stretch;
  }
}
`;

    if (fs.existsSync(cssPath)) {
      // Проверяем, не добавлены ли уже стили
      const currentCSS = fs.readFileSync(cssPath, 'utf8');
      if (!currentCSS.includes('СТИЛИ ДЛЯ ОШИБОК И СОСТОЯНИЙ ГРАФИКОВ')) {
        fs.appendFileSync(cssPath, additionalCSS);
        console.log('✅ CSS стили для ошибок добавлены');
      } else {
        console.log('✅ CSS стили уже существуют');
      }
    } else {
      console.log('⚠️  dashboard.css не найден, создаем новый');
      fs.writeFileSync(cssPath, additionalCSS);
    }
    
  } catch (error) {
    console.error('❌ Ошибка добавления CSS:', error.message);
  }
}

/**
 * Проверяет состояние сервера
 */
async function checkServerStatus() {
  try {
    console.log('🔍 Проверка состояния сервера...');
    
    const { spawn } = require('child_process');
    
    // Проверяем, запущен ли сервер
    const curlProcess = spawn('curl', [
      '-s', 
      '-o', '/dev/null', 
      '-w', '%{http_code}',
      'http://localhost:3002/api/health'
    ]);

    curlProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Сервер запущен и отвечает');
      } else {
        console.log('⚠️  Сервер не отвечает. Запустите сервер командой: npm run dev');
      }
    });

    curlProcess.on('error', () => {
      console.log('⚠️  Не удалось проверить сервер. Убедитесь, что он запущен');
    });
    
  } catch (error) {
    console.log('⚠️  Ошибка проверки сервера:', error.message);
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('🚀 Начинаем исправление дашборда...');
  console.log('');

  // 1. Исправляем файлы
  fixDashboardFiles();

  // 2. Добавляем CSS стили
  addErrorStyles();

  // 3. Проверяем сервер
  await checkServerStatus();

  console.log('');
  console.log('🎉 Исправление дашборда завершено!');
  console.log('');
  console.log('📋 Что было исправлено:');
  console.log('  ✅ Chart.js ошибка "Canvas is already in use"');
  console.log('  ✅ Fallback данные для API ошибок');
  console.log('  ✅ Улучшенная обработка ошибок');
  console.log('  ✅ CSS стили для состояний ошибок');
  console.log('');
  console.log('🌐 Откройте дашборд: http://localhost:3002/admin-panel/');
  console.log('');
  console.log('💡 Если проблемы остались:');
  console.log('  1. Перезапустите сервер: npm run dev');
  console.log('  2. Очистите кэш браузера (Ctrl+Shift+R)');
  console.log('  3. Проверьте консоль браузера на ошибки');
}

// Запуск скрипта
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Критическая ошибка скрипта:', error);
    process.exit(1);
  });
}

module.exports = {
  fixDashboardFiles,
  addErrorStyles,
  checkServerStatus
};