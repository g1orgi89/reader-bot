/**
 * Скрипт для загрузки дефолтных промптов в MongoDB
 * @file scripts/loadDefaultPrompts.js
 * 🍄 Скрипт для инициализации базы данных промптами
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Prompt = require('../server/models/prompt');
const defaultPrompts = require('./defaultPrompts.json');
const logger = require('../server/utils/logger');

/**
 * Основная функция загрузки промптов
 */
async function loadDefaultPrompts() {
  try {
    logger.info('🍄 Starting default prompts loading...');
    
    // Подключение к MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('🍄 Connected to MongoDB');
    
    // Проверяем существующие промпты
    const existingCount = await Prompt.countDocuments();
    logger.info(`🍄 Found ${existingCount} existing prompts in database`);
    
    if (existingCount > 0) {
      const answer = await askQuestion('Database already has prompts. Do you want to continue? (y/N): ');
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        logger.info('🍄 Operation cancelled by user');
        process.exit(0);
      }
    }
    
    // Создаем backup если есть существующие промпты
    if (existingCount > 0) {
      await createBackup();
    }
    
    let loaded = 0;
    let updated = 0;
    let errors = 0;
    
    for (const promptData of defaultPrompts) {
      try {
        // Проверяем, существует ли промпт с таким именем
        const existing = await Prompt.findOne({ name: promptData.name });
        
        if (existing) {
          // Обновляем существующий промпт
          await Prompt.findByIdAndUpdate(existing._id, {
            ...promptData,
            updatedAt: new Date()
          });
          updated++;
          logger.info(`🍄 Updated prompt: ${promptData.name}`);
        } else {
          // Создаем новый промпт
          const newPrompt = new Prompt({
            ...promptData,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          await newPrompt.save();
          loaded++;
          logger.info(`🍄 Loaded prompt: ${promptData.name}`);
        }
      } catch (error) {
        errors++;
        logger.error(`🍄 Error loading prompt ${promptData.name}: ${error.message}`);
      }
    }
    
    // Статистика загрузки
    logger.info('🍄 Prompts loading completed!');
    logger.info(`🍄 Statistics: ${loaded} loaded, ${updated} updated, ${errors} errors`);
    
    // Проверяем итоговое состояние
    const finalCount = await Prompt.countDocuments();
    const activeCount = await Prompt.countDocuments({ active: true });
    const defaultCount = await Prompt.countDocuments({ isDefault: true });
    
    logger.info(`🍄 Final database state:`);
    logger.info(`   Total prompts: ${finalCount}`);
    logger.info(`   Active prompts: ${activeCount}`);
    logger.info(`   Default prompts: ${defaultCount}`);
    
    // Проверяем наличие промптов для всех языков
    await validatePrompts();
    
  } catch (error) {
    logger.error('🍄 Error loading default prompts:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('🍄 Disconnected from MongoDB');
  }
}

/**
 * Создание резервной копии существующих промптов
 */
async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `prompts_backup_${timestamp}`;
    
    const existingPrompts = await Prompt.find({});
    
    // Создаем коллекцию для backup
    const backupCollection = mongoose.connection.db.collection(backupName);
    
    if (existingPrompts.length > 0) {
      await backupCollection.insertMany(existingPrompts.map(p => p.toObject()));
      logger.info(`🍄 Created backup collection: ${backupName} with ${existingPrompts.length} prompts`);
    }
  } catch (error) {
    logger.error(`🍄 Error creating backup: ${error.message}`);
    throw error;
  }
}

/**
 * Валидация загруженных промптов
 */
async function validatePrompts() {
  try {
    logger.info('🍄 Validating loaded prompts...');
    
    const languages = ['en', 'ru', 'es'];
    const requiredTypes = ['basic', 'rag'];
    
    for (const language of languages) {
      for (const type of requiredTypes) {
        const prompt = await Prompt.findOne({
          type,
          language: { $in: [language, 'all'] },
          active: true
        });
        
        if (!prompt) {
          logger.warn(`🍄 WARNING: No active ${type} prompt found for language: ${language}`);
        } else {
          logger.info(`🍄 ✓ Found ${type} prompt for ${language}: ${prompt.name}`);
        }
      }
    }
    
    // Проверяем специальные промпты
    const specialTypes = ['ticket_detection', 'categorization', 'subject'];
    for (const type of specialTypes) {
      const prompt = await Prompt.findOne({ type, active: true });
      if (!prompt) {
        logger.warn(`🍄 WARNING: No active ${type} prompt found`);
      } else {
        logger.info(`🍄 ✓ Found ${type} prompt: ${prompt.name}`);
      }
    }
    
    logger.info('🍄 Prompt validation completed');
  } catch (error) {
    logger.error(`🍄 Error during validation: ${error.message}`);
  }
}

/**
 * Простая функция для запроса ввода пользователя
 * @param {string} question - Вопрос для пользователя
 * @returns {Promise<string>} Ответ пользователя
 */
function askQuestion(question) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Функция для восстановления из backup
 * @param {string} backupName - Имя backup коллекции
 */
async function restoreFromBackup(backupName) {
  try {
    logger.info(`🍄 Restoring prompts from backup: ${backupName}`);
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    const backupCollection = mongoose.connection.db.collection(backupName);
    const backupPrompts = await backupCollection.find({}).toArray();
    
    if (backupPrompts.length === 0) {
      logger.error('🍄 Backup collection is empty or not found');
      return;
    }
    
    // Очищаем текущие промпты
    await Prompt.deleteMany({});
    
    // Восстанавливаем из backup
    for (const promptData of backupPrompts) {
      delete promptData._id; // Удаляем старый ID
      const prompt = new Prompt(promptData);
      await prompt.save();
    }
    
    logger.info(`🍄 Restored ${backupPrompts.length} prompts from backup`);
    
  } catch (error) {
    logger.error(`🍄 Error restoring from backup: ${error.message}`);
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Функция для показа статистики промптов
 */
async function showStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const stats = await Prompt.getStats();
    
    logger.info('🍄 Current prompts statistics:');
    logger.info(`   Total: ${stats.total}`);
    logger.info(`   Active: ${stats.active}`);
    logger.info(`   Default: ${stats.default}`);
    
    logger.info('🍄 By type:');
    stats.byType.forEach(item => {
      logger.info(`   ${item._id}: ${item.count}`);
    });
    
    logger.info('🍄 By language:');
    stats.byLanguage.forEach(item => {
      logger.info(`   ${item._id}: ${item.count}`);
    });
    
    if (stats.mostUsed.length > 0) {
      logger.info('🍄 Most used prompts:');
      stats.mostUsed.forEach(item => {
        logger.info(`   ${item.name} (${item.type}): ${item.metadata.usage.totalUsed} uses`);
      });
    }
    
  } catch (error) {
    logger.error(`🍄 Error getting stats: ${error.message}`);
  } finally {
    await mongoose.disconnect();
  }
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'load':
    loadDefaultPrompts();
    break;
  case 'restore':
    if (!args[1]) {
      logger.error('🍄 Please provide backup collection name: npm run load-prompts restore <backup_name>');
      process.exit(1);
    }
    restoreFromBackup(args[1]);
    break;
  case 'stats':
    showStats();
    break;
  default:
    loadDefaultPrompts();
    break;
}