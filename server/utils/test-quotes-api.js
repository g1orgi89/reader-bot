#!/usr/bin/env node
/**
 * Скрипт диагностики проблем с quotes API
 * @file server/utils/test-quotes-api.js
 */

console.log('🔧 Тестирование quotes API...');

try {
    // Тестируем импорт всех зависимостей
    console.log('📦 Проверка зависимостей...');
    
    const express = require('express');
    console.log('✅ express - OK');
    
    const router = express.Router();
    console.log('✅ express.Router - OK');
    
    // Проверяем middleware
    const { basicAdminAuth } = require('../middleware/auth');
    console.log('✅ basicAdminAuth middleware - OK');
    
    // Проверяем logger
    const logger = require('./logger');
    console.log('✅ logger - OK');
    
    // Тестируем импорт quotes роутов
    const quotesRoutes = require('../api/quotes');
    console.log('✅ quotes routes - OK');
    
    // Проверяем что это Express Router
    if (typeof quotesRoutes === 'function') {
        console.log('✅ quotes routes правильно экспортирует router');
    } else {
        console.log('❌ quotes routes НЕ экспортирует router!');
        console.log('Type:', typeof quotesRoutes);
        console.log('Value:', quotesRoutes);
    }
    
    // Проверяем доступные роуты
    console.log('\n📋 Анализ роутов:');
    if (quotesRoutes.stack) {
        quotesRoutes.stack.forEach((layer, index) => {
            const methods = Object.keys(layer.route?.methods || {}).join(', ');
            const path = layer.route?.path || 'unknown';
            console.log(`${index + 1}. ${methods.toUpperCase()} ${path}`);
        });
    } else {
        console.log('❌ Роуты не найдены или router.stack недоступен');
    }
    
    console.log('\n🎉 Все зависимости загружены успешно!');
    
} catch (error) {
    console.error('❌ Ошибка загрузки зависимостей:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
}
