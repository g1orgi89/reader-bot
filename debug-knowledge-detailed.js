/**
 * ДЕТАЛЬНАЯ ДИАГНОСТИКА Knowledge API - выяснить ТОЧНУЮ причину ошибки
 * @file debug-knowledge-detailed.js
 */

console.log('🔍 STARTING DETAILED KNOWLEDGE API DIAGNOSTICS...');
console.log('================================================');

async function diagnoseKnowledgeAPI() {
  try {
    console.log('🔍 Step 1: Testing basic Node.js modules...');
    
    // Тест базовых модулей
    const express = require('express');
    console.log('✅ express - OK');
    
    const path = require('path');
    console.log('✅ path - OK');
    
    const fs = require('fs');
    console.log('✅ fs - OK');
    
    console.log('\n🔍 Step 2: Testing file processing modules...');
    
    // Тест файловых модулей
    try {
      const multer = require('multer');
      console.log('✅ multer - OK');
    } catch (error) {
      console.error('❌ multer failed:', error.message);
      throw error;
    }
    
    try {
      const mammoth = require('mammoth');
      console.log('✅ mammoth - OK');
    } catch (error) {
      console.error('❌ mammoth failed:', error.message);
      throw error;
    }
    
    try {
      const XLSX = require('xlsx');
      console.log('✅ XLSX - OK');
    } catch (error) {
      console.error('❌ XLSX failed:', error.message);
      throw error;
    }
    
    console.log('\n🔍 Step 3: Testing project models...');
    
    // Тест моделей проекта
    try {
      const KnowledgeDocument = require('./server/models/knowledge');
      console.log('✅ KnowledgeDocument model - OK');
      console.log('📋 Model schema keys:', Object.keys(KnowledgeDocument.schema.paths));
    } catch (error) {
      console.error('❌ KnowledgeDocument model failed:', error.message);
      console.error('📋 Stack trace:', error.stack);
      throw error;
    }
    
    console.log('\n🔍 Step 4: Testing project services...');
    
    // Тест сервисов
    try {
      const knowledgeService = require('./server/services/knowledge');
      console.log('✅ knowledgeService - OK');
      console.log('📋 Service methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(knowledgeService)));
    } catch (error) {
      console.error('❌ knowledgeService failed:', error.message);
      console.error('📋 Stack trace:', error.stack);
      throw error;
    }
    
    try {
      const vectorStoreService = require('./server/services/vectorStore');
      console.log('✅ vectorStoreService - OK');
    } catch (error) {
      console.error('❌ vectorStoreService failed:', error.message);
      console.error('📋 Stack trace:', error.stack);
      throw error;
    }
    
    console.log('\n🔍 Step 5: Testing project utilities...');
    
    // Тест утилит
    try {
      const logger = require('./server/utils/logger');
      console.log('✅ logger - OK');
      console.log('📋 Logger methods:', Object.getOwnPropertyNames(logger));
    } catch (error) {
      console.error('❌ logger failed:', error.message);
      console.error('📋 Stack trace:', error.stack);
      throw error;
    }
    
    try {
      const adminAuth = require('./server/middleware/adminAuth');
      console.log('✅ adminAuth - OK');
      console.log('📋 AdminAuth exports:', Object.keys(adminAuth));
    } catch (error) {
      console.error('❌ adminAuth failed:', error.message);
      console.error('📋 Stack trace:', error.stack);
      throw error;
    }
    
    console.log('\n🔍 Step 6: Testing knowledge API import...');
    
    // Теперь тестируем сам knowledge API
    try {
      const knowledgeAPI = require('./server/api/knowledge');
      console.log('✅ Knowledge API imported successfully!');
      console.log('📋 API type:', typeof knowledgeAPI);
      console.log('📋 API constructor:', knowledgeAPI.constructor.name);
      
      if (knowledgeAPI && knowledgeAPI.stack) {
        console.log('📋 Routes stack length:', knowledgeAPI.stack.length);
      }
      
    } catch (error) {
      console.error('❌ KNOWLEDGE API IMPORT FAILED!');
      console.error('📋 Error name:', error.name);
      console.error('📋 Error message:', error.message);
      console.error('📋 Error code:', error.code);
      console.error('📋 Full stack trace:');
      console.error(error.stack);
      
      // Дополнительная диагностика
      if (error.message.includes('Cannot find module')) {
        const match = error.message.match(/'([^']+)'/);
        if (match) {
          console.error('🔍 Missing module:', match[1]);
        }
      }
      
      throw error;
    }
    
    console.log('\n🔍 Step 7: Testing Express app creation...');
    
    // Тест создания Express app
    try {
      const app = express();
      app.use('/test', knowledgeAPI);
      console.log('✅ Express app with knowledge routes created successfully!');
    } catch (error) {
      console.error('❌ Express app creation failed:', error.message);
      console.error('📋 Stack trace:', error.stack);
      throw error;
    }
    
    console.log('\n🎉 ALL DIAGNOSTICS PASSED!');
    console.log('================================================');
    console.log('✅ Knowledge API should work correctly');
    
  } catch (error) {
    console.log('\n💥 DIAGNOSTICS FAILED!');
    console.log('================================================');
    console.error('❌ Root cause found:', error.message);
    console.error('📋 Error details:', {
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Запуск диагностики
diagnoseKnowledgeAPI();
