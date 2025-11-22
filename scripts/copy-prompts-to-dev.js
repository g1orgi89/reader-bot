/**
 * @fileoverview Скрипт для копирования промптов и справочных данных из production в dev БД
 * @usage node scripts/copy-prompts-to-dev.js
 * @author g1orgi89
 */

const { MongoClient } = require('mongodb');

// Конфигурация
const MONGO_USER = process.env.MONGO_USER || 'reader_admin';
const MONGO_PASS = process.env.MONGO_PASS || 'reader_secure_2025';
const MONGO_HOST = process.env.MONGO_HOST || 'localhost:27017';

const PROD_DB = process.env.PROD_DB || 'reader_bot';
const DEV_DB = process.env.DEV_DB || 'reader_bot_dev';

const MONGO_URI = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}/?authSource=admin`;

/**
 * Копирует коллекцию из production в dev
 * @param {Db} prodDb - Production database
 * @param {Db} devDb - Development database
 * @param {string} collectionName - Название коллекции
 * @param {string} uniqueField - Уникальное поле для upsert
 * @param {string} displayField - Поле для отображения в логах
 */
async function copyCollection(prodDb, devDb, collectionName, uniqueField, displayField) {
  console.log(`\n📋 Копируем ${collectionName}...`);
  
  const items = await prodDb.collection(collectionName).find({}).toArray();
  console.log(`   Найдено: ${items.length} записей`);
  
  let copied = 0;
  let errors = 0;
  
  for (const item of items) {
    try {
      const originalId = item._id;
      delete item._id;
      
      const filter = {};
      filter[uniqueField] = item[uniqueField];
      
      await devDb.collection(collectionName).updateOne(
        filter,
        { $set: item },
        { upsert: true }
      );
      
      const displayName = item[displayField] || item[uniqueField] || originalId;
      console.log(`   ✅ ${displayName}`);
      copied++;
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.message}`);
      errors++;
    }
  }
  
  return { total: items.length, copied, errors };
}

/**
 * Основная функция копирования данных
 */
async function copyPromptsToDev() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    console.log('🔌 Подключаемся к MongoDB...');
    console.log(`   Production DB: ${PROD_DB}`);
    console.log(`   Development DB: ${DEV_DB}`);
    
    await client.connect();
    console.log('✅ Подключение успешно!\n');
    
    const prodDb = client.db(PROD_DB);
    const devDb = client.db(DEV_DB);
    
    const stats = {};
    
    // 1. Копируем universalprompts (промпты для AI)
    stats.prompts = await copyCollection(
      prodDb, devDb,
      'universalprompts',
      'type',
      'type'
    );
    
    // 2. Копируем bookcatalogs (книги для рекомендаций)
    stats.books = await copyCollection(
      prodDb, devDb,
      'bookcatalogs',
      'slug',
      'title'
    );
    
    // 3. Копируем categories (категории цитат)
    stats.categories = await copyCollection(
      prodDb, devDb,
      'categories',
      'slug',
      'name'
    );
    
    // 4. Копируем promocodes (промокоды)
    stats.promocodes = await copyCollection(
      prodDb, devDb,
      'promocodes',
      'code',
      'code'
    );
    
    // 5. Копируем announcementcatalogs (анонсы)
    stats.announcements = await copyCollection(
      prodDb, devDb,
      'announcementcatalogs',
      'slug',
      'title'
    );
    
    // 6. Копируем targetaudiences (целевые аудитории)
    stats.audiences = await copyCollection(
      prodDb, devDb,
      'targetaudiences',
      'code',
      'name'
    );
    
    // 7. Копируем utmtemplates (UTM шаблоны)
    stats.utm = await copyCollection(
      prodDb, devDb,
      'utmtemplates',
      'name',
      'name'
    );
    
    // Итоговая статистика
    console.log('\n' + '='.repeat(50));
    console.log('🎉 КОПИРОВАНИЕ ЗАВЕРШЕНО!\n');
    console.log('📊 СТАТИСТИКА:');
    console.log('─'.repeat(40));
    
    let totalCopied = 0;
    let totalErrors = 0;
    
    for (const [key, value] of Object.entries(stats)) {
      console.log(`   ${key}: ${value.copied}/${value.total} (ошибок: ${value.errors})`);
      totalCopied += value.copied;
      totalErrors += value.errors;
    }
    
    console.log('─'.repeat(40));
    console.log(`   ИТОГО: ${totalCopied} записей скопировано`);
    
    if (totalErrors > 0) {
      console.log(`   ⚠️ Ошибок: ${totalErrors}`);
    }
    
    console.log('\n💡 Не забудь перезапустить dev сервер:');
    console.log('   pm2 restart reader-bot-dev\n');
    
  } catch (error) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Отключились от MongoDB');
  }
}

// Запуск
console.log('═'.repeat(50));
console.log('📦 КОПИРОВАНИЕ ДАННЫХ: PRODUCTION → DEV');
console.log('═'.repeat(50));

copyPromptsToDev()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
