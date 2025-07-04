/**
 * @fileoverview Исправленный скрипт для просмотра всех пользователей в базе данных
 * @description Проверяет наличие анкеты пользователя созданной через Telegram бота
 */

const path = require('path');

// Подгружаем .env из корня проекта
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');

// URI базы данных
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader_bot';

console.log('🔧 Настройки:');
console.log(`   MongoDB URI: ${MONGODB_URI}`);
console.log(`   Рабочая директория: ${process.cwd()}`);
console.log(`   Путь к скрипту: ${__dirname}`);

async function checkUsers() {
  try {
    console.log('\n🔍 Подключение к MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Подключено к базе данных');

    // Импортируем модели с абсолютным путем
    const UserProfile = require(path.join(__dirname, '../models/userProfile.js'));
    const Quote = require(path.join(__dirname, '../models/quote.js'));
    
    console.log('✅ Модели загружены успешно');
    
    console.log('\n📊 Получение всех пользователей...');
    
    // Получаем всех пользователей
    const users = await UserProfile.find({}).sort({ registeredAt: -1 });
    
    console.log(`\n👥 Найдено пользователей: ${users.length}\n`);
    
    if (users.length === 0) {
      console.log('❌ Пользователи не найдены в базе данных');
      console.log('\n🔧 Это может означать:');
      console.log('   1. База данных пустая');
      console.log('   2. Неправильное подключение к MongoDB');
      console.log('   3. Данные находятся в другой коллекции');
      
      // Проверим все коллекции
      console.log('\n📋 Проверка доступных коллекций...');
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Найденные коллекции:');
      collections.forEach(collection => {
        console.log(`   - ${collection.name}`);
      });
      
      return;
    }

    // Показываем детальную информацию о каждом пользователе
    users.forEach((user, index) => {
      console.log(`==================== ПОЛЬЗОВАТЕЛЬ ${index + 1} ====================`);
      console.log(`📱 User ID: ${user.userId}`);
      console.log(`👤 Имя: ${user.name || 'не указано'}`);
      console.log(`📧 Email: ${user.email || 'не указан'}`);
      console.log(`🔗 Telegram: ${user.telegramUsername ? '@' + user.telegramUsername : 'не указан'}`);
      console.log(`📅 Зарегистрирован: ${user.registeredAt ? user.registeredAt.toLocaleString('ru-RU') : 'не указано'}`);
      console.log(`✅ Онбординг завершен: ${user.isOnboardingComplete ? 'Да' : 'Нет'}`);
      console.log(`📍 Источник: ${user.source || 'не указан'}`);
      console.log(`🔄 Состояние бота: ${user.botState?.currentState || 'не указано'}`);
      
      if (user.testResults && typeof user.testResults === 'object') {
        console.log(`📝 Результаты теста:`);
        Object.entries(user.testResults.toObject ? user.testResults.toObject() : user.testResults).forEach(([key, value]) => {
          if (value && key !== '_id' && key !== '__v') {
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
        if (user.statistics.favoriteAuthors && user.statistics.favoriteAuthors.length > 0) {
          console.log(`   Любимые авторы: ${user.statistics.favoriteAuthors.join(', ')}`);
        }
      } else {
        console.log(`📊 Статистика: не заполнена`);
      }
      
      if (user.achievements && user.achievements.length > 0) {
        console.log(`🏆 Достижения: ${user.achievements.length}`);
        user.achievements.forEach(achievement => {
          console.log(`   - ${achievement.achievementId} (${achievement.unlockedAt.toLocaleDateString('ru-RU')})`);
        });
      }
      
      console.log(`⚙️ Настройки напоминаний: ${user.settings?.reminderEnabled ? 'включены' : 'выключены'}`);
      if (user.settings?.reminderTimes && user.settings.reminderTimes.length > 0) {
        console.log(`⏰ Время напоминаний: ${user.settings.reminderTimes.join(', ')}`);
      }
      
      console.log(`💾 Создан в MongoDB: ${user.createdAt ? user.createdAt.toLocaleString('ru-RU') : 'не указано'}`);
      console.log(`🔄 Обновлен: ${user.updatedAt ? user.updatedAt.toLocaleString('ru-RU') : 'не указано'}`);
      console.log(`📱 Последняя активность: ${user.lastActiveAt ? user.lastActiveAt.toLocaleString('ru-RU') : 'не указано'}`);
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
      
      // Показываем последние цитаты
      if (totalQuotes > 0) {
        console.log('\n📚 Последние 5 цитат:');
        const recentQuotes = await Quote.find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('userId', 'name');
          
        recentQuotes.forEach((quote, index) => {
          const userName = users.find(u => u.userId === quote.userId)?.name || 'Неизвестный';
          console.log(`   ${index + 1}. "${quote.text.substring(0, 50)}${quote.text.length > 50 ? '...' : ''}"`);
          console.log(`      Автор: ${quote.author || 'не указан'}, Пользователь: ${userName}`);
          console.log(`      Дата: ${quote.createdAt.toLocaleString('ru-RU')}`);
        });
      }
    } catch (quoteError) {
      console.log('❌ Ошибка при проверке цитат:', quoteError.message);
    }

    // Ищем пользователей с признаками создания через Telegram бота
    console.log('\n🤖 ПОИСК ПОЛЬЗОВАТЕЛЕЙ ИЗ TELEGRAM БОТА:');
    const telegramUsers = users.filter(u => 
      u.telegramUsername || 
      (u.testResults && Object.keys(u.testResults.toObject ? u.testResults.toObject() : u.testResults).some(key => key.startsWith('question'))) ||
      u.source !== 'test'
    );

    if (telegramUsers.length > 0) {
      console.log(`✅ Найдено ${telegramUsers.length} пользователей с признаками Telegram бота:`);
      telegramUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name || 'Без имени'} (${user.userId})`);
        console.log(`   Telegram: ${user.telegramUsername ? '@' + user.telegramUsername : 'не указан'}`);
        console.log(`   Email: ${user.email || 'не указан'}`);
        console.log(`   Источник: ${user.source || 'не указан'}`);
        console.log(`   Дата: ${user.registeredAt ? user.registeredAt.toLocaleString('ru-RU') : 'не указано'}`);
        console.log(`   Онбординг: ${user.isOnboardingComplete ? 'завершен' : 'не завершен'}`);
      });
    } else {
      console.log('❌ Пользователи из Telegram бота не найдены');
    }

    // Проверяем состояние бота
    console.log('\n🤖 СОСТОЯНИЯ ПОЛЬЗОВАТЕЛЕЙ В БОТЕ:');
    const botStates = users.reduce((acc, user) => {
      const state = user.botState?.currentState || 'неизвестно';
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    Object.entries(botStates).forEach(([state, count]) => {
      console.log(`   ${state}: ${count} пользователей`);
    });

    // Проверяем активность
    console.log('\n📈 АКТИВНОСТЬ ПОЛЬЗОВАТЕЛЕЙ:');
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    const activeToday = users.filter(u => u.lastActiveAt && (now - u.lastActiveAt) < oneDay).length;
    const activeThisWeek = users.filter(u => u.lastActiveAt && (now - u.lastActiveAt) < oneWeek).length;
    const activeThisMonth = users.filter(u => u.lastActiveAt && (now - u.lastActiveAt) < oneMonth).length;

    console.log(`   Активны сегодня: ${activeToday}`);
    console.log(`   Активны на этой неделе: ${activeThisWeek}`);
    console.log(`   Активны в этом месяце: ${activeThisMonth}`);

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