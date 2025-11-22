/**
 * @fileoverview Скрипт для копирования промптов и справочных данных из production в dev БД
 * @usage node scripts/copy-prompts-to-dev.js
 * @author g1orgi89
 */

const { MongoClient } = require('mongodb');

// Конфигурация - ПРАВИЛЬНЫЕ КРЕДЫ ДЛЯ СЕРВЕРА
const MONGO_USER = 'reader_bot_admin';
const MONGO_PASS = '54321Server105425';
const MONGO_HOST = '127.0.0.1:27017';

const PROD_DB = 'reader_bot';
const DEV_DB = 'reader_bot_dev';

// Разные authSource для разных БД
const PROD_URI = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}/${PROD_DB}?authSource=${PROD_DB}`;
const DEV_URI = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}/${DEV_DB}?authSource=${DEV_DB}`;

/**
 * Копирует коллекцию из production в dev
 */
async function copyCollection(prodDb, devDb, collectionName, uniqueField, displayField) {
  console.log(`\n📋 Копируем ${collectionName}...`);
  
  try {
    const items = await prodDb.collection(collectionName).find({}).toArray();
    console.log(`   Найдено: ${items.length} записей`);
    
    if (items.length === 0) {
      console.log(`   ⚠️ Коллекция пустая, пропускаем`);
      return { total: 0, copied: 0, errors: 0 };
    }
    
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
  } catch (error) {
    console.log(`   ❌ Ошибка чтения коллекции: ${error.message}`);
    return { total: 0, copied: 0, errors: 1 };
  }
}

/**
 * Основная функция копирования данных
 */
async function copyPromptsToDev() {
  let prodClient = null;
  let devClient = null;
  
  try {
    console.log('🔌 Подключаемся к Production БД...');
    console.log(`   URI: mongodb://${MONGO_USER}:***@${MONGO_HOST}/${PROD_DB}`);
    
    prodClient = new MongoClient(PROD_URI);
    await prodClient.connect();
    console.log('✅ Production подключение успешно!');
    
    console.log('\n🔌 Подключаемся к Dev БД...');
    console.log(`   URI: mongodb://${MONGO_USER}:***@${MONGO_HOST}/${DEV_DB}`);
    
    devClient = new MongoClient(DEV_URI);
    await devClient.connect();
    console.log('✅ Dev подключение успешно!');
    
    const prodDb = prodClient.db(PROD_DB);
    const devDb = devClient.db(DEV_DB);
    
    const stats = {};
    
    // 1. Копируем prompts (промпты для AI)
    stats.prompts = await copyCollection(
      prodDb, devDb,
      'prompts',
      'type',
      'type'
    );
    
    // 2. Копируем book_catalog (книги для рекомендаций)
    stats.books = await copyCollection(
      prodDb, devDb,
      'book_catalog',
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
    
    // 4. Копируем promo_codes (промокоды)
    stats.promocodes = await copyCollection(
      prodDb, devDb,
      'promo_codes',
      'code',
      'code'
    );
    
    // 5. Копируем announcement_catalog (анонсы)
    stats.announcements = await copyCollection(
      prodDb, devDb,
      'announcement_catalog',
      'slug',
      'title'
    );
    
    // 6. Копируем target_audiences (целевые аудитории)
    stats.audiences = await copyCollection(
      prodDb, devDb,
      'target_audiences',
      'code',
      'name'
    );
    
    // 7. Копируем utm_templates (UTM шаблоны)
    stats.utm = await copyCollection(
      prodDb, devDb,
      'utm_templates',
      'name',
      'name'
    );
    
    // 8. Копируем anna_persona (персона Анны)
    stats.anna = await copyCollection(
      prodDb, devDb,
      'anna_persona',
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
    if (prodClient) {
      await prodClient.close();
      console.log('🔌 Отключились от Production');
    }
    if (devClient) {
      await devClient.close();
      console.log('🔌 Отключились от Dev');
    }
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
