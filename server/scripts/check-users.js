/**
 * @fileoverview Скрипт для просмотра всех пользователей в базе данных
 * @description Проверяет наличие анкеты пользователя созданной через Telegram бота
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader_bot';

async function checkUsers() {
  try {
    console.log('🔍 Подключение к MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Подключено к базе данных');

    // Импортируем модель с правильным путем
    const UserProfile = require('../models/userProfile');
    
    console.log('\n📊 Получение всех пользователей...');
    
    // Получаем всех пользователей
    const users = await UserProfile.find({}).sort({ registeredAt: -1 });
    
    console.log(`\n👥 Найдено пользователей: ${users.length}\n`);
    
    if (users.length === 0) {
      console.log('❌ Пользователи не найдены в базе данных');
      return;
    }

    // Показываем детальную информацию о каждом пользователе
    users.forEach((user, index) => {
      console.log(`==================== ПОЛЬЗОВАТЕЛЬ ${index + 1} ====================`);
      console.log(`📱 User ID: ${user.userId}`);
      console.log(`👤 Имя: ${user.name || 'не указано'}`);
      console.log(`📧 Email: ${user.email || 'не указан'}`);
      console.log(`🔗 Telegram: ${user.telegramUsername || 'не указан'}`);
      console.log(`📅 Зарегистрирован: ${user.registeredAt ? user.registeredAt.toLocaleString() : 'не указано'}`);
      console.log(`✅ Онбординг завершен: ${user.isOnboardingComplete ? 'Да' : 'Нет'}`);
      console.log(`📍 Источник: ${user.source || 'не указан'}`);
      
      if (user.testResults && typeof user.testResults === 'object') {
        console.log(`📝 Результаты теста:`);
        Object.entries(user.testResults).forEach(([key, value]) => {
          if (value) {
            console.log(`   ${key}: ${value}`);
          }
        });
      } else {
        console.log(`📝 Результаты теста: не заполнены`);
      }
      
      if (user.statistics && typeof user.statistics === 'object') {
        console.log(`📊 Статистика:`);
        console.log(`   Всего цитат: ${user.statistics.totalQuotes || 0}`);
        console.log(`   Текущая серия: ${user.statistics.currentStreak || 0}`);
        console.log(`   Лучшая серия: ${user.statistics.longestStreak || 0}`);
      } else {
        console.log(`📊 Статистика: не заполнена`);
      }
      
      console.log(`💾 Создан в MongoDB: ${user.createdAt ? user.createdAt.toLocaleString() : 'не указано'}`);
      console.log(`🔄 Обновлен: ${user.updatedAt ? user.updatedAt.toLocaleString() : 'не указано'}`);
      console.log('');
    });

    // Дополнительная статистика
    console.log('==================== ОБЩАЯ СТАТИСТИКА ====================');
    const completedOnboarding = users.filter(u => u.isOnboardingComplete).length;
    const withEmail = users.filter(u => u.email && u.email.trim() !== '').length;
    const withTelegram = users.filter(u => u.telegramUsername && u.telegramUsername.trim() !== '').length;
    const sources = users.reduce((acc, user) => {
      const source = user.source || 'неизвестно';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    console.log(`📊 Завершили онбординг: ${completedOnboarding}/${users.length}`);
    console.log(`📧 С указанным email: ${withEmail}/${users.length}`);
    console.log(`📱 С Telegram username: ${withTelegram}/${users.length}`);
    console.log('\n📍 Источники регистрации:');
    Object.entries(sources).forEach(([source, count]) => {
      console.log(`   ${source}: ${count}`);
    });

    // Проверяем цитаты
    console.log('\n📖 Проверка цитат...');
    try {
      const Quote = require('../models/quote');
      const totalQuotes = await Quote.countDocuments();
      const quotesPerUser = await Quote.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      console.log(`📚 Всего цитат в базе: ${totalQuotes}`);
      
      if (quotesPerUser.length > 0) {
        console.log('📊 Цитат по пользователям:');
        quotesPerUser.forEach(item => {
          const user = users.find(u => u.userId === item._id);
          const userName = user ? (user.name || 'Без имени') : 'Неизвестный пользователь';
          console.log(`   ${userName} (${item._id}): ${item.count} цитат`);
        });
      } else {
        console.log('📊 Цитаты пока не найдены');
      }
    } catch (quoteError) {
      console.log('❌ Ошибка при проверке цитат:', quoteError.message);
    }

    // Ищем пользователей с признаками создания через Telegram бота
    console.log('\n🤖 ПОИСК ПОЛЬЗОВАТЕЛЕЙ ИЗ TELEGRAM БОТА:');
    const telegramUsers = users.filter(u => 
      u.telegramUsername || 
      (u.testResults && Object.keys(u.testResults).length > 0) ||
      u.source !== 'test'
    );

    if (telegramUsers.length > 0) {
      console.log(`✅ Найдено ${telegramUsers.length} пользователей с признаками Telegram бота:`);
      telegramUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name || 'Без имени'} (${user.userId})`);
        console.log(`   Telegram: ${user.telegramUsername || 'не указан'}`);
        console.log(`   Email: ${user.email || 'не указан'}`);
        console.log(`   Источник: ${user.source || 'не указан'}`);
        console.log(`   Дата: ${user.registeredAt ? user.registeredAt.toLocaleString() : 'не указано'}`);
      });
    } else {
      console.log('❌ Пользователи из Telegram бота не найдены');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Отключен от базы данных');
  }
}

// Запуск проверки
if (require.main === module) {
  checkUsers().catch(console.error);
}

module.exports = { checkUsers };