/**
 * @fileoverview Скрипт инициализации проекта "Читатель" с тестовыми данными
 * @description Создает базовые данные для работы дашборда аналитики
 * @version 1.0.0 - Initial Reader Bot setup
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Подключение к базе данных
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-bot';

console.log('🚀 Инициализация проекта "Читатель"...');
console.log('📡 Подключение к MongoDB:', MONGODB_URI);

async function initializeReaderBot() {
  try {
    // Подключение к MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB подключена');

    // Импорт моделей после подключения
    const models = require('../models');
    const { 
      UserProfile, 
      Quote, 
      WeeklyReport, 
      MonthlyReport, 
      UTMClick, 
      PromoCodeUsage, 
      UserAction,
      Content,
      Prompt
    } = models;

    console.log('📦 Модели загружены, начинаем инициализацию...');

    // Очистка существующих данных (только для демо)
    console.log('🧹 Очистка существующих данных...');
    await UserProfile.deleteMany({});
    await Quote.deleteMany({});
    await WeeklyReport.deleteMany({});
    await MonthlyReport.deleteMany({});
    await UTMClick.deleteMany({});
    await PromoCodeUsage.deleteMany({});
    await UserAction.deleteMany({});

    // 1. СОЗДАНИЕ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ
    console.log('👥 Создание тестовых пользователей...');
    
    const testUsers = [
      {
        userId: 'user_001',
        telegramUsername: '@anna_test',
        name: 'Анна',
        email: 'anna@example.com',
        testResults: {
          name: 'Анна',
          lifestyle: 'Замужем, балансирую дом/работу/себя',
          timeForSelf: 'Читаю вечером перед сном',
          priorities: 'Саморазвитие и гармония',
          readingFeelings: 'Вдохновение и умиротворение',
          closestPhrase: 'Жизнь —