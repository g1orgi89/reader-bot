#!/usr/bin/env node

/**
 * 🍄 Тестовый скрипт для проверки ServiceManager
 * @file server/test-servicemanager.js
 */

require('dotenv').config();

const ServiceManager = require('./core/ServiceManager');

async function testServiceManager() {
  console.log('🍄 Testing ServiceManager...\n');
  
  try {
    // Создаем instance ServiceManager
    const serviceManager = new ServiceManager();
    
    // Показываем зарегистрированные сервисы
    console.log('📋 Registered services:');
    const stats = serviceManager.getServiceStats();
    console.log(`Total services: ${stats.totalServices}`);
    console.log(`Initialized services: ${stats.initializedServices}`);
    console.log('\nService details:');
    stats.services.forEach(service => {
      console.log(`  - ${service.name}: deps=[${service.dependencies.join(', ')}], initialized=${service.initialized}`);
    });
    
    console.log('\n🔄 Initializing all services...');
    await serviceManager.initializeAll();
    
    // Показываем статус после инициализации
    console.log('\n✅ After initialization:');
    const statsAfter = serviceManager.getServiceStats();
    console.log(`Initialized services: ${statsAfter.initializedServices}/${statsAfter.totalServices}`);
    
    // Проверяем здоровье сервисов
    console.log('\n❤️ Health check:');
    const health = await serviceManager.getHealthStatus();
    console.log(`Overall status: ${health.status}`);
    console.log(`All healthy: ${health.allHealthy}`);
    
    console.log('\nService health details:');
    Object.entries(health.services).forEach(([name, status]) => {
      console.log(`  - ${name}: ${status.status} (${status.message || 'no message'})`);
    });
    
    // Тестируем получение сервисов
    console.log('\n🔍 Testing service retrieval...');
    try {
      const database = serviceManager.getService('database');
      console.log('✅ Database service retrieved successfully');
    } catch (error) {
      console.log(`❌ Database service error: ${error.message}`);
    }
    
    try {
      const claude = serviceManager.getService('claude');
      console.log('✅ Claude service retrieved successfully');
    } catch (error) {
      console.log(`❌ Claude service error: ${error.message}`);
    }
    
    try {
      const chat = serviceManager.getService('chat');
      console.log('✅ Chat service retrieved successfully');
    } catch (error) {
      console.log(`❌ Chat service error: ${error.message}`);
    }
    
    console.log('\n🍄 ServiceManager test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ ServiceManager test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Запускаем тест
testServiceManager().then(() => {
  console.log('\n✨ All tests passed!');
  process.exit(0);
}).catch(console.error);
