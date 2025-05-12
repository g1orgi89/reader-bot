#!/usr/bin/env node
/**
 * Check Progress Script for Shrooms Support Bot
 * @file scripts/check-progress.js
 */

const fs = require('fs');
const path = require('path');

const CONTEXT_FILE = path.join(__dirname, '../CONTEXT_FIXES.md');
const PLAN_FILE = path.join(__dirname, '../DETAILED_REPAIR_PLAN.md');

function main() {
  console.log('🔍 ПРОВЕРКА ПРОГРЕССА ИСПРАВЛЕНИЙ\n');
  
  // Check if context files exist
  if (!fs.existsSync(CONTEXT_FILE)) {
    console.error('❌ Файл CONTEXT_FIXES.md не найден!');
    process.exit(1);
  }
  
  if (!fs.existsSync(PLAN_FILE)) {
    console.error('❌ Файл DETAILED_REPAIR_PLAN.md не найден!');
    process.exit(1);
  }
  
  // Read context file
  const contextContent = fs.readFileSync(CONTEXT_FILE, 'utf8');
  
  // Extract statistics
  const stats = extractStatistics(contextContent);
  
  // Display summary
  displaySummary(stats);
  
  // Show next steps
  showNextSteps(contextContent);
  
  console.log('\n📂 ФАЙЛЫ ДЛЯ РАБОТЫ:');
  console.log(`- CONTEXT_FIXES.md: ${CONTEXT_FILE}`);
  console.log(`- DETAILED_REPAIR_PLAN.md: ${PLAN_FILE}`);
  console.log('\n💡 СОВЕТ: Всегда обновляйте CONTEXT_FIXES.md после каждого исправления');
}

function extractStatistics(content) {
  const lines = content.split('\n');
  const stats = {
    total: 0,
    fixed: 0,
    inProgress: 0,
    pending: 0,
    fixedList: [],
    inProgressList: [],
    pendingList: []
  };
  
  let currentStatus = null;
  let currentItem = null;
  
  for (const line of lines) {
    if (line.includes('### ✅ ИСПРАВЛЕННЫЕ ОШИБКИ')) {
      currentStatus = 'fixed';
      const match = line.match(/\((\d+)\/(\d+)\)/);
      if (match) {
        stats.fixed = parseInt(match[1]);
      }
    } else if (line.includes('### 🔄 В РАБОТЕ')) {
      currentStatus = 'inProgress';
      const match = line.match(/\((\d+)\/(\d+)\)/);
      if (match) {
        stats.inProgress = parseInt(match[1]);
      }
    } else if (line.includes('### ❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ')) {
      currentStatus = 'pending';
      const match = line.match(/\((\d+)\/(\d+)\)/);
      if (match) {
        stats.pending = parseInt(match[1]);
        stats.total = parseInt(match[2]);
      }
    } else if (line.startsWith('#### ') && currentStatus) {
      currentItem = {
        title: line.replace('#### ', '').replace(/^\d+\.\s*/, ''),
        details: []
      };
    } else if (currentItem && line.startsWith('- **')) {
      const [key, value] = line.split(': ');
      if (key && value) {
        currentItem.details.push({
          key: key.replace('- **', '').replace('**', ''),
          value: value
        });
      }
    } else if (currentItem && line.trim() === '' && currentStatus) {
      stats[currentStatus + 'List'].push(currentItem);
      currentItem = null;
    }
  }
  
  return stats;
}

function displaySummary(stats) {
  console.log('📊 ОБЩАЯ СТАТИСТИКА:');
  console.log('─'.repeat(50));
  console.log(`📋 Всего ошибок:        ${stats.total}`);
  console.log(`✅ Исправлено:          ${stats.fixed} (${Math.round(stats.fixed/stats.total*100)}%)`);
  console.log(`🔄 В работе:            ${stats.inProgress} (${Math.round(stats.inProgress/stats.total*100)}%)`);
  console.log(`❌ Ожидают:             ${stats.pending} (${Math.round(stats.pending/stats.total*100)}%)`);
  console.log('─'.repeat(50));
  
  // Progress bar
  const progress = stats.fixed / stats.total;
  const barLength = 30;
  const filledLength = Math.round(barLength * progress);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  console.log(`\n📈 Прогресс: [${bar}] ${Math.round(progress * 100)}%\n`);
  
  // Show recently fixed
  if (stats.fixedList.length > 0) {
    console.log('✅ НЕДАВНО ИСПРАВЛЕННЫЕ:');
    stats.fixedList.slice(-3).forEach(item => {
      console.log(`  • ${item.title}`);
    });
    console.log('');
  }
  
  // Show in progress
  if (stats.inProgressList.length > 0) {
    console.log('🔄 В РАБОТЕ:');
    stats.inProgressList.forEach(item => {
      console.log(`  • ${item.title}`);
    });
    console.log('');
  }
}

function showNextSteps(content) {
  console.log('🎯 СЛЕДУЮЩИЕ ШАГИ:');
  console.log('─'.repeat(50));
  
  const nextStepMatch = content.match(/## 🎯 ПЛАН ДЕЙСТВИЙ\n\n(.*?)\n\n##/s);
  if (nextStepMatch) {
    const steps = nextStepMatch[1].split('\n').filter(line => line.trim().startsWith('**'));
    steps.slice(0, 3).forEach((step, index) => {
      console.log(`${index + 1}. ${step.replace(/\*\*/g, '')}`);
    });
  } else {
    console.log('1. Прочитать DETAILED_REPAIR_PLAN.md');
    console.log('2. Выбрать первую неисправленную ошибку');
    console.log('3. Следовать инструкциям в плане');
  }
  
  console.log('\n💡 ПОЛЕЗНЫЕ КОМАНДЫ:');
  console.log('  • git status                 - проверить состояние репозитория');
  console.log('  • npm test                   - запустить тесты (если есть)');
  console.log('  • npm start                  - запустить сервер');
}

if (require.main === module) {
  main();
}

module.exports = { main, extractStatistics, displaySummary, showNextSteps };
