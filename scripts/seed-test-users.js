/**
 * 🌱 SEED SCRIPT - Тестовые пользователи с цитатами
 * 
 * Создаёт тестовых пользователей с реалистичными данными:
 * - 5 пользователей с разными интересами
 * - По 8-12 цитат на каждого
 * - Часть цитат в избранном (likedBy)
 * - Разные авторы и темы
 * 
 * Запуск: node scripts/seed-test-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { UserProfile, Quote } = require('../server/models');

// 📊 Конфигурация
const MONGODB_URI = process.env.MONGODB_URI;

// 👥 Тестовые пользователи
const TEST_USERS = [
  {
    telegramId: 111111111,
    firstName: 'Алиса',
    lastName: 'Иванова',
    username: 'alice_reader',
    isOnboardingComplete: true,
    testResults: {
      lifeStage: 'Мама в декрете',
      readingTime: '30-60 минут в день',
      goals: ['Саморазвитие', 'Психология']
    }
  },
  {
    telegramId: 222222222,
    firstName: 'Борис',
    lastName: 'Петров',
    username: 'boris_books',
    isOnboardingComplete: true,
    testResults: {
      lifeStage: 'Работаю и учусь',
      readingTime: '15-30 минут в день',
      goals: ['Бизнес', 'Продуктивность']
    }
  },
  {
    telegramId: 333333333,
    firstName: 'Виктория',
    lastName: 'Смирнова',
    username: 'vika_wisdom',
    isOnboardingComplete: true,
    testResults: {
      lifeStage: 'В поиске себя',
      readingTime: '1-2 часа в день',
      goals: ['Философия', 'Литература']
    }
  },
  {
    telegramId: 444444444,
    firstName: 'Георгий',
    lastName: 'Козлов',
    username: 'george_quotes',
    isOnboardingComplete: true,
    testResults: {
      lifeStage: 'Предприниматель',
      readingTime: '30-60 минут в день',
      goals: ['Лидерство', 'Инновации']
    }
  },
  {
    telegramId: 555555555,
    firstName: 'Дарья',
    lastName: 'Новикова',
    username: 'dasha_reads',
    isOnboardingComplete: true,
    testResults: {
      lifeStage: 'Студентка',
      readingTime: '1-2 часа в день',
      goals: ['Творчество', 'Саморазвитие']
    }
  }
];

// 📚 Пул цитат с разными авторами и темами
const QUOTES_POOL = [
  // Психология и саморазвитие
  { text: 'Хорошая жизнь строится, а не дается по умолчанию', author: 'Анна Бусел', theme: 'psychology' },
  { text: 'Между стимулом и реакцией есть пространство. В этом пространстве наша сила выбирать свой ответ', author: 'Виктор Франкл', theme: 'psychology' },
  { text: 'Уязвимость — это не слабость. Это наша самая точная мера мужества', author: 'Брене Браун', theme: 'psychology' },
  { text: 'Мы не можем выбирать наши обстоятельства, но мы можем выбирать наше отношение к ним', author: 'Виктор Франкл', theme: 'psychology' },
  
  // Философия и мудрость
  { text: 'Единственная истинная мудрость в том, чтобы знать, что ты ничего не знаешь', author: 'Сократ', theme: 'philosophy' },
  { text: 'Жизнь — это то, что случается с тобой, пока ты строишь другие планы', author: 'Джон Леннон', theme: 'philosophy' },
  { text: 'Счастье — это не станция, на которую прибывают, а способ путешествовать', author: 'Маргарет Ли Ранбек', theme: 'philosophy' },
  { text: 'Знание — сила', author: 'Фрэнсис Бэкон', theme: 'philosophy' },
  
  // Бизнес и продуктивность
  { text: 'Единственный способ сделать великую работу — полюбить то, что делаешь', author: 'Стив Джобс', theme: 'business' },
  { text: 'Лучшее время, чтобы посадить дерево, было 20 лет назад. Следующее лучшее время — сегодня', author: 'Китайская пословица', theme: 'business' },
  { text: 'Не управляйте своим временем, управляйте своим фокусом', author: 'Робин Шарма', theme: 'productivity' },
  { text: 'Совершенство — это не пункт назначения, а непрерывное путешествие', author: 'Брайан Трейси', theme: 'business' },
  
  // Творчество и искусство
  { text: 'Будь собой; все остальные уже заняты', author: 'Оскар Уайльд', theme: 'creativity' },
  { text: 'Творчество требует мужества', author: 'Анри Матисс', theme: 'creativity' },
  { text: 'Искусство смывает с души пыль повседневности', author: 'Пабло Пикассо', theme: 'creativity' },
  { text: 'Воображение важнее знания', author: 'Альберт Эйнштейн', theme: 'creativity' },
  
  // Отношения и любовь
  { text: 'Любовь — это не смотреть друг на друга, а смотреть в одном направлении', author: 'Антуан де Сент-Экзюпери', theme: 'relationships' },
  { text: 'Самое важное в жизни — научиться отдавать любовь и позволить любви войти в вашу жизнь', author: 'Морри Шварц', theme: 'relationships' },
  { text: 'Любить — это не значит смотреть друг на друга, а значит смотреть в одном направлении', author: 'Антуан де Сент-Экзюпери', theme: 'relationships' },
  
  // Мотивация и цели
  { text: 'Будущее принадлежит тем, кто верит в красоту своих мечтаний', author: 'Элеонора Рузвельт', theme: 'motivation' },
  { text: 'Успех — это способность идти от неудачи к неудаче, не теряя энтузиазма', author: 'Уинстон Черчилль', theme: 'motivation' },
  { text: 'Не бойся медленно идти, бойся стоять на месте', author: 'Китайская пословица', theme: 'motivation' },
  { text: 'Мотивация — это то, с чего вы начинаете. Привычка — это то, что держит вас в движении', author: 'Джим Рюн', theme: 'motivation' },
  
  // Жизненная мудрость
  { text: 'Жизнь на 10% состоит из того, что с вами происходит, и на 90% из того, как вы на это реагируете', author: 'Чарльз Суиндолл', theme: 'wisdom' },
  { text: 'Самое трудное время в нашей жизни — это лучший учитель', author: 'Далай-лама', theme: 'wisdom' },
  { text: 'Измените свои мысли, и вы измените свой мир', author: 'Норман Винсент Пил', theme: 'wisdom' },
  { text: 'То, что не убивает нас, делает нас сильнее', author: 'Фридрих Ницше', theme: 'wisdom' }
];

/**
 * Получить случайные цитаты для пользователя
 */
function getRandomQuotes(count, excludeIndices = []) {
  const available = QUOTES_POOL.filter((_, idx) => !excludeIndices.includes(idx));
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Получить случайную дату в последние N дней
 */
function getRandomDate(daysAgo) {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  const randomHours = Math.floor(Math.random() * 24);
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000 - randomHours * 60 * 60 * 1000);
}

/**
 * 🌱 Главная функция seed
 */
async function seedTestUsers() {
  try {
    console.log('🌱 Начинаем seed тестовых данных...\n');
    
    // 1️⃣ Подключаемся к MongoDB
    console.log('📡 Подключение к MongoDB dev базе...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Подключено к:', MONGODB_URI.replace(/:[^:@]+@/, ':***@'), '\n');

    // 2️⃣ Очищаем старые тестовые данные
    console.log('🧹 Очистка старых тестовых данных...');
    const testTelegramIds = TEST_USERS.map(u => u.telegramId);
    
    // Удаляем цитаты тестовых пользователей
    const deletedQuotes = await Quote.deleteMany({
      userId: { $in: await UserProfile.find({ telegramId: { $in: testTelegramIds } }).distinct('_id') }
    });
    console.log(`   Удалено ${deletedQuotes.deletedCount} старых цитат`);
    
    // Удаляем тестовых пользователей
    const deletedUsers = await UserProfile.deleteMany({ telegramId: { $in: testTelegramIds } });
    console.log(`   Удалено ${deletedUsers.deletedCount} старых пользователей\n`);

    // 3️⃣ Создаём тестовых пользователей
    console.log('👥 Создание тестовых пользователей...');
    const createdUsers = await UserProfile.insertMany(TEST_USERS);
    console.log(`✅ Создано ${createdUsers.length} пользователей:\n`);
    createdUsers.forEach(u => {
      console.log(`   📱 @${u.username} (${u.firstName} ${u.lastName})`);
    });
    console.log('');

    // 4️⃣ Создаём цитаты для каждого пользователя
    console.log('📚 Создание цитат для пользователей...\n');
    
    let totalQuotesCreated = 0;
    let totalFavoritesAdded = 0;
    
    for (const user of createdUsers) {
      console.log(`   👤 ${user.firstName} (@${user.username}):`);
      
      // Случайное количество цитат от 8 до 12
      const quotesCount = 8 + Math.floor(Math.random() * 5);
      const userQuotes = getRandomQuotes(quotesCount);
      
      // Определяем какие цитаты будут избранными (30-50% от всех)
      const favoritesCount = Math.floor(quotesCount * (0.3 + Math.random() * 0.2));
      const favoriteIndices = new Set();
      while (favoriteIndices.size < favoritesCount) {
        favoriteIndices.add(Math.floor(Math.random() * quotesCount));
      }
      
      // Создаём цитаты
      const quotesToInsert = [];
      for (let i = 0; i < userQuotes.length; i++) {
        const quote = userQuotes[i];
        const isFavorite = favoriteIndices.has(i);
        
        quotesToInsert.push({
          text: quote.text,
          author: quote.author,
          userId: user._id,
          source: 'mini_app',
          createdAt: getRandomDate(30), // Цитаты за последние 30 дней
          aiAnalysis: {
            analyzed: true,
            theme: quote.theme,
            mood: 'positive',
            insights: [`Тема: ${quote.theme}`]
          },
          // Избранное - добавляем самого пользователя и случайных других
          likedBy: isFavorite ? [user._id] : []
        });
      }
      
      // Добавляем случайные лайки от других пользователей
      for (let quote of quotesToInsert) {
        if (Math.random() > 0.7) { // 30% шанс лайка от другого пользователя
          const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
          if (randomUser._id.toString() !== user._id.toString() && !quote.likedBy.includes(randomUser._id)) {
            quote.likedBy.push(randomUser._id);
          }
        }
      }
      
      await Quote.insertMany(quotesToInsert);
      
      const userFavoritesCount = quotesToInsert.filter(q => q.likedBy.includes(user._id)).length;
      totalQuotesCreated += quotesToInsert.length;
      totalFavoritesAdded += userFavoritesCount;
      
      console.log(`      ✅ Добавлено ${quotesToInsert.length} цитат (${userFavoritesCount} в избранном)`);
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 SEED УСПЕШНО ЗАВЕРШЁН!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 Создано:`);
    console.log(`   👥 Пользователей: ${createdUsers.length}`);
    console.log(`   📚 Цитат: ${totalQuotesCreated}`);
    console.log(`   ❤️  Избранных: ${totalFavoritesAdded}`);
    console.log('');
    console.log('🧪 Тестовые аккаунты:');
    createdUsers.forEach(u => {
      console.log(`   📱 Telegram ID: ${u.telegramId} → @${u.username}`);
    });
    console.log('');
    console.log('✅ Теперь можно тестировать подписки в dev среде!');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Ошибка при seed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('👋 Отключено от MongoDB\n');
  }
}

// Запуск
if (require.main === module) {
  seedTestUsers()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = { seedTestUsers };
