/**
 * @fileoverview Диагностика пользователя "Гио" - почему данные не сохраняются через Telegram бота
 * @description Комплексная проверка всех возможных причин отсутствия пользователя в базе
 */

const path = require('path');

// Подгружаем .env из корня проекта
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const fs = require('fs');

// URI базы данных
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader_bot';

console.log('🔧 ДИАГНОСТИКА ПОЛЬЗОВАТЕЛЯ "ГИО"');
console.log('=' .repeat(50));
console.log(`MongoDB URI: ${MONGODB_URI}`);
console.log(`Telegram Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`);
console.log(`Claude API Key: ${process.env.ANTHROPIC_API_KEY ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`);

async function diagnoseGioUser() {
  try {
    console.log('\n🔍 1. ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Подключено к базе данных');

    // Загружаем модели
    const UserProfile = require(path.join(__dirname, '../models/userProfile.js'));
    const Quote = require(path.join(__dirname, '../models/quote.js'));
    console.log('✅ Модели загружены');

    console.log('\n🔍 2. ПОИСК ПОЛЬЗОВАТЕЛЯ "ГИО" ПО РАЗНЫМ КРИТЕРИЯМ...');
    
    // Поиск по имени "Гио"
    const usersByName = await UserProfile.find({
      name: { $regex: /гио/i }
    });
    console.log(`📝 Поиск по имени "Гио": найдено ${usersByName.length} пользователей`);
    
    if (usersByName.length > 0) {
      usersByName.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.userId}) - ${user.email}`);
      });
    }

    // Поиск по возможным вариантам написания
    const variations = ['гио', 'gio', 'георгий', 'георги', 'george'];
    for (const variation of variations) {
      const users = await UserProfile.find({
        $or: [
          { name: { $regex: new RegExp(variation, 'i') } },
          { telegramUsername: { $regex: new RegExp(variation, 'i') } },
          { email: { $regex: new RegExp(variation, 'i') } }
        ]
      });
      
      if (users.length > 0) {
        console.log(`📝 Поиск по "${variation}": найдено ${users.length} пользователей`);
        users.forEach(user => {
          console.log(`   - ${user.name} (@${user.telegramUsername}) ${user.email}`);
        });
      }
    }

    console.log('\n🔍 3. АНАЛИЗ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ ПО ДАТЕ СОЗДАНИЯ...');
    
    // Получаем последних пользователей (возможно Гио среди них)
    const recentUsers = await UserProfile.find({}).sort({ createdAt: -1 }).limit(10);
    
    console.log('📅 Последние 10 пользователей:');
    recentUsers.forEach((user, index) => {
      const createdDate = user.createdAt.toLocaleString('ru-RU');
      const registeredDate = user.registeredAt.toLocaleString('ru-RU');
      const isRecent = (new Date() - user.createdAt) < (24 * 60 * 60 * 1000); // за последние 24 часа
      
      console.log(`   ${index + 1}. ${user.name} (${user.userId})`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Telegram: @${user.telegramUsername || 'не указан'}`);
      console.log(`      Создан: ${createdDate} ${isRecent ? '🔥 НЕДАВНО!' : ''}`);
      console.log(`      Зарегистрирован: ${registeredDate}`);
      console.log(`      Состояние: ${user.botState?.currentState || 'не указано'}`);
      console.log(`      Онбординг: ${user.isOnboardingComplete ? 'завершен' : 'НЕ завершен'}`);
      console.log('');
    });

    console.log('\n🔍 4. ПРОВЕРКА ПОЛЬЗОВАТЕЛЕЙ БЕЗ ЗАВЕРШЕННОГО ОНБОРДИНГА...');
    
    const incompleteUsers = await UserProfile.find({ 
      isOnboardingComplete: false 
    }).sort({ createdAt: -1 });
    
    console.log(`📝 Пользователи без завершенного онбординга: ${incompleteUsers.length}`);
    
    if (incompleteUsers.length > 0) {
      incompleteUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name || 'Имя не указано'} (${user.userId})`);
        console.log(`      Email: ${user.email || 'не указан'}`);
        console.log(`      Telegram: @${user.telegramUsername || 'не указан'}`);
        console.log(`      Состояние бота: ${user.botState?.currentState || 'не указано'}`);
        console.log(`      Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
        
        // Проверяем результаты теста
        if (user.testResults) {
          const testEntries = Object.entries(user.testResults.toObject());
          const completedQuestions = testEntries.filter(([key, value]) => 
            key.startsWith('question') && value
          ).length;
          console.log(`      Вопросов теста: ${completedQuestions}/7`);
        }
        console.log('');
      });
    }

    console.log('\n🔍 5. ПРОВЕРКА ЛОГА ОШИБОК И СОСТОЯНИЙ БОТA...');
    
    // Проверяем все состояния ботов
    const botStates = await UserProfile.aggregate([
      {
        $group: {
          _id: '$botState.currentState',
          count: { $sum: 1 },
          users: { 
            $push: { 
              name: '$name', 
              userId: '$userId',
              createdAt: '$createdAt'
            } 
          }
        }
      }
    ]);
    
    console.log('📊 Состояния ботов:');
    botStates.forEach(state => {
      console.log(`   ${state._id || 'неизвестно'}: ${state.count} пользователей`);
      
      if (state._id && state._id !== 'start' && state._id !== 'active') {
        console.log('     Пользователи в этом состоянии:');
        state.users.forEach(user => {
          console.log(`       - ${user.name || 'Без имени'} (${user.userId}) - ${user.createdAt.toLocaleString('ru-RU')}`);
        });
      }
    });

    console.log('\n🔍 6. ПОИСК ВСЕХ ВОЗМОЖНЫХ ID...');
    
    // Ищем пользователей с подозрительными ID
    const allUsers = await UserProfile.find({}).select('userId name telegramUsername email createdAt');
    
    console.log('📱 Все User ID в базе:');
    allUsers.forEach(user => {
      console.log(`   ${user.userId} - ${user.name} (@${user.telegramUsername || 'без username'})`);
    });

    console.log('\n🔍 7. ПРОВЕРКА ЛОГОВ НА ОШИБКИ...');
    
    // Проверяем, есть ли файлы логов
    const logsDir = path.join(__dirname, '../../logs');
    const serverLogsDir = path.join(__dirname, '../logs');
    
    const logDirs = [logsDir, serverLogsDir];
    
    logDirs.forEach(logDir => {
      if (fs.existsSync(logDir)) {
        console.log(`📄 Найдена папка логов: ${logDir}`);
        const logFiles = fs.readdirSync(logDir);
        console.log(`   Файлы логов: ${logFiles.join(', ')}`);
      } else {
        console.log(`❌ Папка логов не найдена: ${logDir}`);
      }
    });

    console.log('\n🔍 8. ПРОВЕРКА КОЛЛЕКЦИЙ В БАЗЕ ДАННЫХ...');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📚 Все коллекции в базе данных:');
    
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`   ${collection.name}: ${count} документов`);
      
      if (collection.name.includes('user') || collection.name.includes('profile')) {
        console.log(`     ⭐ Это коллекция пользователей!`);
      }
    }

    console.log('\n🔍 9. ТЕСТИРОВАНИЕ СОЗДАНИЯ ПОЛЬЗОВАТЕЛЯ...');
    
    // Попробуем создать тестового пользователя, чтобы убедиться, что все работает
    const testUserId = 'debug_test_' + Date.now();
    
    try {
      const testUser = new UserProfile({
        userId: testUserId,
        name: 'Тест Гио',
        email: 'gio.test@example.com',
        telegramUsername: 'gio_test',
        source: 'Telegram',
        testResults: {
          question1_name: 'Тест Гио',
          question2_lifestyle: 'Свободен',
          question3_time: 'Читаю книги',
          question4_priorities: 'Обучение',
          question5_reading_feeling: 'Вдохновение',
          question6_phrase: 'Жизнь прекрасна',
          question7_reading_time: '1-2 часа в день'
        },
        isOnboardingComplete: true
      });
      
      await testUser.save();
      console.log(`✅ Тестовый пользователь создан успешно: ${testUserId}`);
      
      // Удаляем тестового пользователя
      await UserProfile.deleteOne({ userId: testUserId });
      console.log(`🗑️ Тестовый пользователь удален`);
      
    } catch (error) {
      console.log(`❌ Ошибка создания тестового пользователя: ${error.message}`);
      console.log(`   Это может быть причиной, почему данные Гио не сохраняются!`);
    }

    console.log('\n🔍 10. РЕКОМЕНДАЦИИ ПО ДИАГНОСТИКЕ...');
    
    console.log('📋 ВОЗМОЖНЫЕ ПРИЧИНЫ:');
    console.log('   1. Telegram бот не запущен или не отвечает');
    console.log('   2. Ошибка в коде онбординга при сохранении');
    console.log('   3. Неправильная конфигурация базы данных в боте');
    console.log('   4. Ошибки валидации при сохранении пользователя');
    console.log('   5. Проблемы с правами доступа к базе данных');
    console.log('   6. Блокировка бота или проблемы с Telegram API');
    
    console.log('\n📋 ЧТО ДЕЛАТЬ ДАЛЬШЕ:');
    console.log('   1. Запустите Telegram бота заново: cd telegram && node start.js');
    console.log('   2. Проверьте логи бота на ошибки');
    console.log('   3. Попробуйте пройти регистрацию еще раз с другого аккаунта');
    console.log('   4. Проверьте, установлен ли правильный TELEGRAM_BOT_TOKEN');
    console.log('   5. Убедитесь, что бот имеет права на отправку сообщений');

  } catch (error) {
    console.error('❌ Ошибка диагностики:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Отключен от базы данных');
  }
}

// Запуск диагностики
if (require.main === module) {
  diagnoseGioUser().catch(console.error);
}

module.exports = { diagnoseGioUser };