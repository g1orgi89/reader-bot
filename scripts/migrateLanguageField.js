/**
 * Migration Script - Change language field from 'auto' to 'none'
 * Скрипт миграции: Изменение поля language с 'auto' на 'none'
 * @file scripts/migrateLanguageField.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Используем прямые ссылки на модели без импорта, чтобы избежать конфликтов
const KnowledgeDocument = require('../server/models/knowledge');
const Prompt = require('../server/models/prompt');

/**
 * Подключение к MongoDB
 */
async function connectToMongoDB() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI не задан в переменных окружения');
    }

    await mongoose.connect(mongoUri);
    console.log('🍄 Подключение к MongoDB установлено');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  }
}

/**
 * Миграция документов Knowledge: auto → none
 */
async function migrateKnowledgeDocuments() {
  console.log('\n🍄 Начинаем миграцию Knowledge Documents...');
  
  try {
    // Ищем все документы с language: 'auto'
    const documentsWithAuto = await KnowledgeDocument.find({ language: 'auto' });
    console.log(`📄 Найдено ${documentsWithAuto.length} документов с language: 'auto'`);

    if (documentsWithAuto.length === 0) {
      console.log('✅ Миграция Knowledge Documents не требуется - нет документов с auto');
      return { updated: 0, total: 0 };
    }

    // Массовое обновление
    const updateResult = await KnowledgeDocument.updateMany(
      { language: 'auto' },
      { $set: { language: 'none', updatedAt: new Date() } }
    );

    console.log(`✅ Knowledge Documents обновлено: ${updateResult.modifiedCount} из ${documentsWithAuto.length}`);
    
    // Проверяем результат
    const remainingAuto = await KnowledgeDocument.countDocuments({ language: 'auto' });
    if (remainingAuto > 0) {
      console.warn(`⚠️  Остались документы с auto: ${remainingAuto}`);
    }

    return {
      total: documentsWithAuto.length,
      updated: updateResult.modifiedCount
    };
  } catch (error) {
    console.error('❌ Ошибка при миграции Knowledge Documents:', error.message);
    throw error;
  }
}

/**
 * Миграция промптов: auto → none
 */
async function migratePrompts() {
  console.log('\n🍄 Начинаем миграцию Prompts...');
  
  try {
    // Ищем все промпты с language: 'auto'
    const promptsWithAuto = await Prompt.find({ language: 'auto' });
    console.log(`📄 Найдено ${promptsWithAuto.length} промптов с language: 'auto'`);

    if (promptsWithAuto.length === 0) {
      console.log('✅ Миграция Prompts не требуется - нет промптов с auto');
      return { updated: 0, total: 0 };
    }

    // Массовое обновление
    const updateResult = await Prompt.updateMany(
      { language: 'auto' },
      { $set: { language: 'none', updatedAt: new Date() } }
    );

    console.log(`✅ Prompts обновлено: ${updateResult.modifiedCount} из ${promptsWithAuto.length}`);
    
    // Проверяем результат
    const remainingAuto = await Prompt.countDocuments({ language: 'auto' });
    if (remainingAuto > 0) {
      console.warn(`⚠️  Остались промпты с auto: ${remainingAuto}`);
    }

    return {
      total: promptsWithAuto.length,
      updated: updateResult.modifiedCount
    };
  } catch (error) {
    console.error('❌ Ошибка при миграции Prompts:', error.message);
    throw error;
  }
}

/**
 * Проверка состояния после миграции
 */
async function verifyMigration() {
  console.log('\n🔍 Проверяем состояние после миграции...');
  
  try {
    const [
      knowledgeTotal,
      knowledgeNone,
      knowledgeAuto,
      promptTotal,
      promptNone,
      promptAuto
    ] = await Promise.all([
      KnowledgeDocument.countDocuments(),
      KnowledgeDocument.countDocuments({ language: 'none' }),
      KnowledgeDocument.countDocuments({ language: 'auto' }),
      Prompt.countDocuments(),
      Prompt.countDocuments({ language: 'none' }),
      Prompt.countDocuments({ language: 'auto' })
    ]);

    console.log('\n📊 Статистика Knowledge Documents:');
    console.log(`   Всего документов: ${knowledgeTotal}`);
    console.log(`   С language='none': ${knowledgeNone}`);
    console.log(`   С language='auto': ${knowledgeAuto} ${knowledgeAuto > 0 ? '❌' : '✅'}`);

    console.log('\n📊 Статистика Prompts:');
    console.log(`   Всего промптов: ${promptTotal}`);
    console.log(`   С language='none': ${promptNone}`);
    console.log(`   С language='auto': ${promptAuto} ${promptAuto > 0 ? '❌' : '✅'}`);

    return {
      knowledge: { total: knowledgeTotal, none: knowledgeNone, auto: knowledgeAuto },
      prompts: { total: promptTotal, none: promptNone, auto: promptAuto }
    };
  } catch (error) {
    console.error('❌ Ошибка при проверке миграции:', error.message);
    throw error;
  }
}

/**
 * Откат миграции (для тестирования): none → auto
 */
async function rollbackMigration() {
  console.log('\n🔄 ОТКАТ: Возвращаем language с none на auto...');
  
  try {
    const [knowledgeRollback, promptRollback] = await Promise.all([
      KnowledgeDocument.updateMany(
        { language: 'none' },
        { $set: { language: 'auto', updatedAt: new Date() } }
      ),
      Prompt.updateMany(
        { language: 'none' },
        { $set: { language: 'auto', updatedAt: new Date() } }
      )
    ]);

    console.log(`🔄 Knowledge Documents откат: ${knowledgeRollback.modifiedCount}`);
    console.log(`🔄 Prompts откат: ${promptRollback.modifiedCount}`);

    return {
      knowledge: knowledgeRollback.modifiedCount,
      prompts: promptRollback.modifiedCount
    };
  } catch (error) {
    console.error('❌ Ошибка при откате:', error.message);
    throw error;
  }
}

/**
 * Основная функция миграции
 */
async function main() {
  console.log('🍄 Shrooms Migration: language field auto → none\n');
  
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);
  const isRollback = args.includes('--rollback');
  const isVerifyOnly = args.includes('--verify');

  try {
    await connectToMongoDB();

    if (isRollback) {
      // Режим отката
      const rollbackResult = await rollbackMigration();
      await verifyMigration();
      console.log('\n🔄 Откат миграции завершен');
    } else if (isVerifyOnly) {
      // Только проверка, без миграции
      await verifyMigration();
      console.log('\n✅ Проверка состояния завершена');
    } else {
      // Основная миграция
      const knowledgeResult = await migrateKnowledgeDocuments();
      const promptResult = await migratePrompts();
      const verification = await verifyMigration();

      console.log('\n🎉 Миграция завершена успешно!');
      console.log('📋 Итоги:');
      console.log(`   Knowledge Documents: ${knowledgeResult.updated}/${knowledgeResult.total} обновлено`);
      console.log(`   Prompts: ${promptResult.updated}/${promptResult.total} обновлено`);
      
      if (verification.knowledge.auto > 0 || verification.prompts.auto > 0) {
        console.log('\n⚠️  ВНИМАНИЕ: Остались записи с language="auto"!');
        console.log('   Возможно, потребуется повторный запуск миграции');
      }
    }

  } catch (error) {
    console.error('\n💥 Критическая ошибка миграции:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔐 Подключение к MongoDB закрыто');
  }
}

// Запуск скрипта
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateKnowledgeDocuments,
  migratePrompts,
  verifyMigration,
  rollbackMigration
};